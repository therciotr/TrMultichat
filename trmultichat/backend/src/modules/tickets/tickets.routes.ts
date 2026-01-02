import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { getIO } from "../../libs/socket";

const router = Router();

function tenantIdFromReq(req: any): number {
  return Number(req?.tenantId || 0);
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

// GET /tickets
router.get("/", authMiddleware, async (req, res) => {
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
  const companyId = tenantIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  const ticket = await loadTicketWithRelations(id, companyId);
  if (!ticket) return res.status(404).json({ error: true, message: "not found" });
  return res.json(ticket);
});

// PUT /tickets/:id (accept ticket, change status, etc)
router.put("/:id", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const body: any = req.body || {};
  const nextStatus = body.status ? String(body.status) : undefined;
  const nextUserId = body.userId !== undefined && body.userId !== null ? Number(body.userId) : null;
  const nextQueueId = body.queueId !== undefined && body.queueId !== null ? Number(body.queueId) : null;

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

  try {
    const io = getIO();
    io.emit(`company-${companyId}-ticket`, { action: "update", ticket });
  } catch {}

  return res.json(ticket);
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
    `SELECT id, admin, profile FROM "Users" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [requesterId, companyId]
  );
  const requester = requesterRows?.[0];
  const isAdmin = Boolean(requester?.admin) || String(requester?.profile || "") === "admin";
  if (!isAdmin) {
    return res.status(403).json({ error: true, message: "Only admins can delete tickets" });
  }

  // ensure ticket belongs to company
  const exists = await pgQuery<{ id: number }>(
    `SELECT id FROM "Tickets" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  if (!exists?.[0]?.id) return res.status(404).json({ error: true, message: "not found" });

  // cascade-like cleanup (avoid FK issues)
  await pgQuery(`DELETE FROM "TicketTags" WHERE "ticketId" = $1`, [id]);
  await pgQuery(`DELETE FROM "TicketNotes" WHERE "ticketId" = $1`, [id]);
  await pgQuery(`DELETE FROM "Messages" WHERE "ticketId" = $1`, [id]);
  await pgQuery(`DELETE FROM "Tickets" WHERE id = $1 AND "companyId" = $2`, [id, companyId]);

  try {
    const io = getIO();
    io.emit(`company-${companyId}-ticket`, { action: "delete", ticket: { id } });
  } catch {}

  return res.status(204).end();
});

export default router;


