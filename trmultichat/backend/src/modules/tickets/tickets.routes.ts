import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { getIO } from "../../libs/socket";
import { getInlineSock, startOrRefreshInlineSession } from "../../libs/waInlineManager";
import { getSettingValue } from "../../utils/settingsStore";

const router = Router();

function tenantIdFromReq(req: any): number {
  return Number(req?.tenantId || 0);
}

function setNoCache(res: any) {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    // Ensure we never hit 304 Not Modified on list/detail endpoints
    res.setHeader("ETag", `W/\"${Date.now()}\"`);
  } catch {}
}

async function loadTicketWithRelations(ticketId: number, companyId: number) {
  const rows = await pgQuery<any>(
    `
      SELECT
        t.*,
        c.id as "contact_id",
        c.name as "contact_name",
        c.number as "contact_number",
        c."profilePicUrl" as "contact_profilePicUrl",
        q.id as "queue_id",
        q.name as "queue_name",
        q.color as "queue_color"
      FROM "Tickets" t
      LEFT JOIN "Contacts" c ON c.id = t."contactId"
      LEFT JOIN "Queues" q ON q.id = t."queueId"
      WHERE t.id = $1 AND t."companyId" = $2
      LIMIT 1
    `,
    [ticketId, companyId]
  );
  const r = rows[0];
  if (!r) return null;
  const ticket: any = { ...r };
  ticket.contact = r.contact_id
    ? {
        id: r.contact_id,
        name: r.contact_name,
        number: r.contact_number,
        profilePicUrl: r.contact_profilePicUrl
      }
    : null;
  ticket.queue = r.queue_id
    ? { id: r.queue_id, name: r.queue_name, color: r.queue_color }
    : null;
  delete ticket.contact_id;
  delete ticket.contact_name;
  delete ticket.contact_number;
  delete ticket.contact_profilePicUrl;
  delete ticket.queue_id;
  delete ticket.queue_name;
  delete ticket.queue_color;
  return ticket;
}

async function loadTicketTags(ticketId: number, companyId: number) {
  const rows = await pgQuery<any>(
    `
      SELECT tg.id, tg.name, tg.color
      FROM "TicketTags" tt
      JOIN "Tags" tg ON tg.id = tt."tagId"
      WHERE tt."ticketId" = $1 AND tg."companyId" = $2
      ORDER BY tg.id ASC
    `,
    [ticketId, companyId]
  );
  return Array.isArray(rows) ? rows : [];
}

function isAdminProfile(profile: any): boolean {
  const p = String(profile || "").toLowerCase();
  return p === "admin" || p === "super";
}

function quoteIdent(ident: string): string {
  // Basic identifier quoting for safe dynamic SQL
  const s = String(ident || "");
  return `"${s.replace(/"/g, '""')}"`;
}

async function deleteTicketCascade(ticketId: number, companyId: number) {
  // Generic FK cascade: delete rows in tables referencing Tickets (best-effort).
  // This prevents FK errors when deleting a ticket in customized schemas.
  try {
    const refs = await pgQuery<{ table: string; column: string }>(
      `
        SELECT
          c.conrelid::regclass::text as "table",
          a.attname as "column"
        FROM pg_constraint c
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'f'
          AND c.confrelid = '"Tickets"'::regclass
      `,
      []
    );
    for (const r of refs || []) {
      const table = String(r.table || "").trim();
      const col = String(r.column || "").trim();
      if (!table || !col) continue;
      // Skip self
      if (table.replace(/"/g, "").toLowerCase() === "tickets") continue;
      try {
        // If table has companyId column, restrict deletion to company too.
        const rawTable = table.replace(/^public\./i, "").replace(/"/g, "");
        const cols = await pgQuery<{ column_name: string }>(
          `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND lower(table_name) = lower($1)
          `,
          [rawTable]
        );
        const hasCompanyId = (cols || []).some((c) => String(c.column_name).toLowerCase() === "companyid");
        if (hasCompanyId) {
          await pgQuery(`DELETE FROM ${table} WHERE ${quoteIdent(col)} = $1 AND "companyId" = $2`, [ticketId, companyId]);
        } else {
          await pgQuery(`DELETE FROM ${table} WHERE ${quoteIdent(col)} = $1`, [ticketId]);
        }
      } catch {
        // ignore per-table failures (missing table/column/etc)
      }
    }
  } catch {
    // ignore
  }
}

// GET /tickets
router.get("/", authMiddleware, async (req, res) => {
  setNoCache(res);
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const status = String(req.query.status || "").trim();
  const searchParam = String(req.query.searchParam || "").trim();

  const params: any[] = [companyId];
  let where = `t."companyId" = $1`;

  if (status) {
    params.push(status);
    where += ` AND t.status = $${params.length}`;
  }
  if (searchParam) {
    params.push(`%${searchParam.toLowerCase()}%`);
    const p = `$${params.length}`;
    where += ` AND (lower(c.name) LIKE ${p} OR lower(c.number) LIKE ${p} OR lower(t."lastMessage") LIKE ${p})`;
  }

  params.push(limit);
  params.push(offset);

  const rows = await pgQuery<any>(
    `
      SELECT
        t.*,
        c.id as "contact_id",
        c.name as "contact_name",
        c.number as "contact_number",
        c."profilePicUrl" as "contact_profilePicUrl",
        q.id as "queue_id",
        q.name as "queue_name",
        q.color as "queue_color"
      FROM "Tickets" t
      LEFT JOIN "Contacts" c ON c.id = t."contactId"
      LEFT JOIN "Queues" q ON q.id = t."queueId"
      WHERE ${where}
      ORDER BY t."updatedAt" DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );

  const list = (rows || []).map((r: any) => {
    const ticket: any = { ...r };
    ticket.contact = r.contact_id
      ? {
          id: r.contact_id,
          name: r.contact_name,
          number: r.contact_number,
          profilePicUrl: r.contact_profilePicUrl
        }
      : null;
    ticket.queue = r.queue_id
      ? { id: r.queue_id, name: r.queue_name, color: r.queue_color }
      : null;
    delete ticket.contact_id;
    delete ticket.contact_name;
    delete ticket.contact_number;
    delete ticket.contact_profilePicUrl;
    delete ticket.queue_id;
    delete ticket.queue_name;
    delete ticket.queue_color;
    return ticket;
  });

  return res.json(list);
});

// GET /tickets/u/:uuid (frontend uses this when opening a ticket)
router.get("/u/:uuid", authMiddleware, async (req, res) => {
  setNoCache(res);
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const uuid = String(req.params.uuid || "").trim();
  if (!uuid) return res.status(400).json({ error: true, message: "missing uuid" });

  const rows = await pgQuery<any>(
    `SELECT id FROM "Tickets" WHERE uuid = $1 AND "companyId" = $2 LIMIT 1`,
    [uuid, companyId]
  );
  const id = Number(rows?.[0]?.id || 0);
  if (!id) return res.status(404).json({ error: true, message: "not found" });

  const ticket = await loadTicketWithRelations(id, companyId);
  if (!ticket) return res.status(404).json({ error: true, message: "not found" });

  // attach assigned user (TicketInfo expects ticket.user possibly)
  if (ticket.userId) {
    const u = await pgQuery<any>(
      `SELECT id, name, email FROM "Users" WHERE id = $1 LIMIT 1`,
      [Number(ticket.userId)]
    );
    ticket.user = u?.[0] || null;
  } else {
    ticket.user = null;
  }

  // attach tags for TagsContainer
  ticket.tags = await loadTicketTags(id, companyId);
  return res.json(ticket);
});

// GET /tickets/:id
router.get("/:id", authMiddleware, async (req, res) => {
  setNoCache(res);
  const companyId = tenantIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  const ticket = await loadTicketWithRelations(id, companyId);
  if (!ticket) return res.status(404).json({ error: true, message: "not found" });
  return res.json(ticket);
});

// PUT /tickets/:id (accept ticket, change status, etc)
router.put("/:id", authMiddleware, async (req, res) => {
  setNoCache(res);
  const companyId = tenantIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const body: any = req.body || {};
  const nextStatus = body.status ? String(body.status) : undefined;
  const nextUserId = body.userId !== undefined && body.userId !== null ? Number(body.userId) : null;
  const nextQueueId = body.queueId !== undefined && body.queueId !== null ? Number(body.queueId) : null;

  // Capture previous state (needed for greeting automation)
  let prevTicket: any = null;
  try {
    const prevRows = await pgQuery<any>(
      `SELECT id, status, "queueId", "whatsappId", "contactId", "userId" FROM "Tickets" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
      [id, companyId]
    );
    prevTicket = prevRows?.[0] || null;
  } catch {}

  await pgQuery(
    `
      UPDATE "Tickets"
      SET
        status = COALESCE($1, status),
        "userId" = $2,
        "queueId" = COALESCE($3, "queueId"),
        "updatedAt" = NOW(),
        "unreadMessages" = 0
      WHERE id = $4 AND "companyId" = $5
    `,
    [nextStatus || null, nextUserId, nextQueueId, id, companyId]
  );

  const ticket = await loadTicketWithRelations(id, companyId);
  if (!ticket) return res.status(404).json({ error: true, message: "not found" });

  // Auto greeting message on accept (pending -> open), using queue/whatsapp configured greeting when available.
  const becameOpen =
    String(prevTicket?.status || "").toLowerCase() !== "open" &&
    String(ticket?.status || "").toLowerCase() === "open" &&
    Boolean(ticket?.userId);
  if (becameOpen) {
    (async () => {
      try {
        const whatsappId = Number(ticket?.whatsappId || prevTicket?.whatsappId || 0);
        const contactId = Number(ticket?.contactId || prevTicket?.contactId || 0);
        if (!whatsappId || !contactId) return;

        // Find remoteJid
        let remoteJid = "";
        try {
          const m = await pgQuery<{ remoteJid: string }>(
            `SELECT "remoteJid" FROM "Messages" WHERE "ticketId" = $1 AND "companyId" = $2 ORDER BY "createdAt" DESC LIMIT 1`,
            [id, companyId]
          );
          remoteJid = String(m?.[0]?.remoteJid || "").trim();
        } catch {}
        if (!remoteJid) {
          const c = await pgQuery<{ number: string }>(
            `SELECT number FROM "Contacts" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
            [contactId, companyId]
          );
          const number = String(c?.[0]?.number || "").replace(/\D/g, "");
          if (number) remoteJid = `${number}@s.whatsapp.net`;
        }
        if (!remoteJid) return;

        // Resolve greeting text (try queue first, then whatsapp)
        let greeting = "";
        const queueId = Number(ticket?.queueId || prevTicket?.queueId || 0) || null;
        if (queueId) {
          try {
            const q = await pgQuery<any>(
              `SELECT "greetingMessage" as gm, "welcomeMessage" as wm FROM "Queues" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
              [queueId, companyId]
            );
            greeting = String(q?.[0]?.gm || q?.[0]?.wm || "").trim();
          } catch {}
        }
        if (!greeting) {
          try {
            const w = await pgQuery<any>(
              `SELECT "greetingMessage" as gm, "welcomeMessage" as wm FROM "Whatsapps" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
              [whatsappId, companyId]
            );
            greeting = String(w?.[0]?.gm || w?.[0]?.wm || "").trim();
          } catch {}
        }
        // Fallback: if no greeting configured, use sendGreetingAccepted setting default message
        if (!greeting) {
          try {
            const enabled = String((await getSettingValue(companyId, "sendGreetingAccepted")) || "").toLowerCase() === "enabled";
            if (!enabled) return;
            const hour = new Date().getHours();
            const ms = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
            let agentName = "";
            try {
              const u = await pgQuery<any>(`SELECT name FROM "Users" WHERE id = $1 AND "companyId" = $2 LIMIT 1`, [
                Number(ticket?.userId || 0),
                companyId
              ]);
              agentName = String(u?.[0]?.name || "").trim();
            } catch {}
            const clientName = String(ticket?.contact?.name || "Cliente").trim() || "Cliente";
            const agentPart = agentName ? `*${agentName}*` : "*Atendente*";
            greeting = `${ms} *${clientName}*, meu nome é ${agentPart} e agora vou prosseguir com seu atendimento!`;
          } catch {
            return;
          }
        }

        // Avoid sending greeting twice: only if we already sent our system greeting
        try {
          const already = await pgQuery<{ c: number }>(
            `SELECT COUNT(1)::int as c FROM "Messages" WHERE "ticketId" = $1 AND "companyId" = $2 AND "dataJson"::text ILIKE '%\"system\":\"greeting\"%'`,
            [id, companyId]
          );
          if (Number(already?.[0]?.c || 0) > 0) return;
        } catch {}

        let sock = getInlineSock(whatsappId);
        if (!sock) {
          startOrRefreshInlineSession({ companyId, whatsappId, forceNewQr: false }).catch(() => {});
          const startedAt = Date.now();
          while (!sock && Date.now() - startedAt < 5000) {
            await new Promise((r) => setTimeout(r, 250));
            sock = getInlineSock(whatsappId);
          }
        }
        if (!sock) return;

        const result = await sock.sendMessage(remoteJid, { text: greeting });
        const sentId = String(result?.key?.id || `greet-${Date.now()}`);

        await pgQuery(
          `
            INSERT INTO "Messages"
              (id, body, ack, read, "ticketId", "createdAt", "updatedAt", "fromMe", "isDeleted",
               "contactId", "companyId", "remoteJid", "dataJson")
            VALUES
              ($1, $2, 0, true, $3, NOW(), NOW(), true, false, $4, $5, $6, $7)
            ON CONFLICT (id) DO NOTHING
          `,
          [sentId, greeting, id, contactId, companyId, remoteJid, JSON.stringify({ system: "greeting" })]
        );

        // Send "queue menu" to the client so they can choose the target queue
        // (this is the expected flow when accepting a ticket).
        try {
          // Dedupe: only one menu per ticket (unless you delete it)
          const alreadyMenu = await pgQuery<{ c: number }>(
            `SELECT COUNT(1)::int as c FROM "Messages" WHERE "ticketId" = $1 AND "companyId" = $2 AND "dataJson"::text ILIKE '%\"system\":\"queue_menu\"%'`,
            [id, companyId]
          );
          if (Number(alreadyMenu?.[0]?.c || 0) > 0) return;

          // Load queues (ordered)
          let queues: Array<{ id: number; name: string }> = [];
          try {
            queues = await pgQuery<any>(
              `SELECT id, name FROM "Queues" WHERE "companyId" = $1 ORDER BY COALESCE("orderQueue", id) ASC, id ASC`,
              [companyId]
            );
          } catch {
            queues = await pgQuery<any>(
              `SELECT id, name FROM "Queues" WHERE "companyId" = $1 ORDER BY id ASC`,
              [companyId]
            );
          }
          queues = Array.isArray(queues) ? queues.filter((q) => q?.id && q?.name) : [];
          if (!queues.length) return;

          const items = queues.map((q, idx) => ({ n: idx + 1, queueId: Number(q.id), name: String(q.name) }));
          const menuText =
            `Escolha a fila para continuar:\n` +
            items.map((it) => `${it.n} - ${it.name}`).join("\n");

          const r2 = await sock.sendMessage(remoteJid, { text: menuText });
          const menuId = String(r2?.key?.id || `queue-menu-${Date.now()}`);
          await pgQuery(
            `
              INSERT INTO "Messages"
                (id, body, ack, read, "ticketId", "createdAt", "updatedAt", "fromMe", "isDeleted",
                 "contactId", "companyId", "remoteJid", "dataJson")
              VALUES
                ($1, $2, 0, true, $3, NOW(), NOW(), true, false, $4, $5, $6, $7)
              ON CONFLICT (id) DO NOTHING
            `,
            [menuId, menuText, id, contactId, companyId, remoteJid, JSON.stringify({ system: "queue_menu", items })]
          );
        } catch {}
      } catch {}
    })();
  }

  try {
    const io = getIO();
    io.emit(`company-${companyId}-ticket`, { action: "update", ticket });
  } catch {}

  return res.json(ticket);
});

// DELETE /tickets/bulk (admin only) - delete many tickets at once
// IMPORTANT: must be declared BEFORE DELETE /tickets/:id, otherwise ":id" would match "bulk".
router.delete("/bulk", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  // only admin/super can delete tickets
  const requesterId = Number((req as any).userId || 0);
  if (!requesterId) return res.status(401).json({ error: true, message: "missing userId" });
  const requesterRows = await pgQuery<any>(
    `SELECT id, profile FROM "Users" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [requesterId, companyId]
  );
  const requester = requesterRows?.[0];
  const isAdmin = isAdminProfile(requester?.profile);
  if (!isAdmin) return res.status(403).json({ error: true, message: "Only admins can delete tickets" });

  const bodyIds = (req.body as any)?.ids;
  const queryIds = String((req.query as any)?.ids || "").trim();
  const ids: number[] = Array.isArray(bodyIds)
    ? bodyIds.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n) && n > 0)
    : queryIds
      ? queryIds.split(",").map((s) => Number(String(s).trim())).filter((n) => Number.isFinite(n) && n > 0)
      : [];

  if (!ids.length) return res.status(400).json({ error: true, message: "ids is required" });

  const deletedIds: number[] = [];
  const failed: Array<{ id: number; error: string }> = [];

  for (const id of ids) {
    try {
      // ensure ticket belongs to company
      const exists = await pgQuery<{ id: number }>(
        `SELECT id FROM "Tickets" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
        [id, companyId]
      );
      if (!exists?.[0]?.id) {
        failed.push({ id, error: "not_found" });
        continue;
      }

      await deleteTicketCascade(id, companyId);
      try { await pgQuery(`DELETE FROM "TicketTags" WHERE "ticketId" = $1`, [id]); } catch {}
      try { await pgQuery(`DELETE FROM "TicketNotes" WHERE "ticketId" = $1`, [id]); } catch {}
      try { await pgQuery(`DELETE FROM "Messages" WHERE "ticketId" = $1`, [id]); } catch {}
      await pgQuery(`DELETE FROM "Tickets" WHERE id = $1 AND "companyId" = $2`, [id, companyId]);

      deletedIds.push(id);
      try {
        const io = getIO();
        io.emit(`company-${companyId}-ticket`, { action: "delete", ticket: { id } });
      } catch {}
    } catch (e: any) {
      failed.push({ id, error: String(e?.message || "delete_failed") });
    }
  }

  return res.json({ deletedIds, failed });
});

// DELETE /tickets/:id (delete ticket)
router.delete("/:id", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  // only admin can delete tickets
  const requesterId = Number((req as any).userId || 0);
  if (!requesterId) return res.status(401).json({ error: true, message: "missing userId" });
  const requesterRows = await pgQuery<any>(
    // Some schemas do NOT have "admin" boolean column; rely on "profile" (admin/super).
    `SELECT id, profile FROM "Users" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [requesterId, companyId]
  );
  const requester = requesterRows?.[0];
  const isAdmin = isAdminProfile(requester?.profile);
  if (!isAdmin) {
    return res.status(403).json({ error: true, message: "Only admins can delete tickets" });
  }

  // ensure ticket belongs to company
  const exists = await pgQuery<{ id: number }>(
    `SELECT id FROM "Tickets" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  if (!exists?.[0]?.id) return res.status(404).json({ error: true, message: "not found" });

  // generic FK cleanup first (avoid FK issues across custom schemas)
  await deleteTicketCascade(id, companyId);

  // cascade-like cleanup (known tables)
  try { await pgQuery(`DELETE FROM "TicketTags" WHERE "ticketId" = $1`, [id]); } catch {}
  try { await pgQuery(`DELETE FROM "TicketNotes" WHERE "ticketId" = $1`, [id]); } catch {}
  try { await pgQuery(`DELETE FROM "Messages" WHERE "ticketId" = $1`, [id]); } catch {}
  await pgQuery(`DELETE FROM "Tickets" WHERE id = $1 AND "companyId" = $2`, [id, companyId]);

  try {
    const io = getIO();
    io.emit(`company-${companyId}-ticket`, { action: "delete", ticket: { id } });
  } catch {}

  return res.status(204).end();
});

export default router;


