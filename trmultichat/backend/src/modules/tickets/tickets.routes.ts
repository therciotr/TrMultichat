import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { getIO } from "../../libs/socket";
import { getInlineSock, getInlineSnapshot, startOrRefreshInlineSession } from "../../libs/waInlineManager";
import { getSettingValue } from "../../utils/settingsStore";
import { sendMail } from "../../utils/mailer";
import multer from "multer";
import fs from "fs";
import path from "path";

const router = Router();

function escHtml(s: any) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBytes(bytes: any) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let v = n;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx++;
  }
  const fixed = idx === 0 ? 0 : idx === 1 ? 1 : 2;
  return `${v.toFixed(fixed)} ${units[idx]}`;
}

async function getCompanyBrandingTheme(companyId: number): Promise<{ primary: string; secondary: string; logoUrl: string | null }> {
  // Best-effort read from CompanyBrandings JSON
  try {
    const rows = await pgQuery<any>(
      'SELECT data FROM "CompanyBrandings" WHERE "companyId" = $1 LIMIT 1',
      [companyId]
    );
    const data = rows?.[0]?.data;
    const primary = String(data?.primaryColor || "#0B4C46");
    const secondary = String(data?.secondaryColor || "#2BA9A5");
    const logoUrl = data?.logoUrl ? String(data.logoUrl) : null;
    return { primary, secondary, logoUrl };
  } catch {
    return { primary: "#0B4C46", secondary: "#2BA9A5", logoUrl: null };
  }
}

async function getCompanyLogoInline(companyId: number): Promise<{ cid: string; filename: string; path: string; contentType?: string; contentDisposition?: "inline"; publicUrl?: string } | null> {
  const { logoUrl } = await getCompanyBrandingTheme(companyId);
  const resolved = String(logoUrl || "/uploads/logo-tr.png");
  const rel = resolved.replace(/^\/+/, "");
  const absPath = path.join(process.cwd(), "public", rel);
  try {
    if (!fs.existsSync(absPath)) return null;
  } catch {
    return null;
  }
  const ext = path.extname(absPath).toLowerCase();
  const contentType =
    ext === ".png"
      ? "image/png"
      : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".webp"
          ? "image/webp"
          : undefined;
  const base = String(process.env.BACKEND_URL || "https://api.trmultichat.com.br").replace(/\/+$/, "");
  return {
    cid: "trlogo",
    filename: path.basename(absPath),
    path: absPath,
    contentType,
    contentDisposition: "inline",
    publicUrl: `${base}${resolved}`,
  };
}

function tenantIdFromReq(req: any): number {
  return Number(req?.tenantId || 0);
}

function ensureDir(p: string) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {}
}

function safeFileName(input: string): string {
  const s = String(input || "file").trim() || "file";
  return s.replace(/[^\w.\-]+/g, "_").slice(0, 140);
}

const emailUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        const companyId = tenantIdFromReq(req);
        const ticketId = Number((req as any)?.params?.ticketId || 0);
        const dir = path.join(process.cwd(), "public", "uploads", "email", String(companyId || 0), String(ticketId || 0));
        ensureDir(dir);
        cb(null, dir);
      } catch {
        cb(null, path.join(process.cwd(), "public", "uploads"));
      }
    },
    filename: (_req, file, cb) => {
      const orig = String(file?.originalname || "file").trim() || "file";
      const ext = path.extname(orig) || "";
      const base = safeFileName(orig.replace(ext, "")) || "file";
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${base}-${unique}${ext}`);
    }
  }),
});

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

function appendAcceptLog(line: any) {
  try {
    const dir = path.join(process.cwd(), "public");
    const file = path.join(dir, "tickets-accept.log");
    try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch {}
    fs.appendFileSync(file, `${new Date().toISOString()} ${typeof line === "string" ? line : JSON.stringify(line)}\n`, "utf8");
  } catch {}
}

async function ensureSockConnected(companyId: number, whatsappId: number, timeoutMs = 15000) {
  let sock = getInlineSock(whatsappId);
  if (!sock) {
    startOrRefreshInlineSession({ companyId, whatsappId, forceNewQr: false }).catch(() => {});
  }
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    sock = getInlineSock(whatsappId);
    const snap = getInlineSnapshot(whatsappId);
    const st = String(snap?.status || "");
    if (sock && (st === "CONNECTED" || st === "open" || st === "Open")) return sock;
    await new Promise((r) => setTimeout(r, 400));
  }
  return getInlineSock(whatsappId);
}

async function sendTextWithRetry(sock: any, remoteJid: string, text: string, attempts = 3) {
  let lastErr: any = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      const r = await sock.sendMessage(remoteJid, { text });
      return r;
    } catch (e: any) {
      lastErr = e;
      appendAcceptLog({ where: "sendTextWithRetry", attempt: i, remoteJid, err: e?.message || String(e) });
      await new Promise((r) => setTimeout(r, 800 * i));
    }
  }
  throw lastErr;
}

function emitRealtimeMessage(companyId: number, message: any) {
  try {
    const io = getIO();
    io.emit(`company-${companyId}-appMessage`, { action: "create", message });
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

// POST /tickets/:ticketId/email (send attachment by e-mail)
router.post("/:ticketId/email", authMiddleware, emailUpload.any(), async (req, res) => {
  try {
    setNoCache(res);
    const companyId = tenantIdFromReq(req);
    if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

    const ticketId = Number(req.params.ticketId || 0);
    if (!ticketId) return res.status(400).json({ error: true, message: "invalid ticketId" });

    const body: any = req.body || {};
    const toEmail = String(body?.toEmail || "").trim();
    const subject = String(body?.subject || "").trim();
    const message = String(body?.message || body?.body || "").trim();

    if (!toEmail) return res.status(400).json({ error: true, message: "toEmail is required" });

    const ticket = await loadTicketWithRelations(ticketId, companyId);
    if (!ticket) return res.status(404).json({ error: true, message: "ticket not found" });

    const files = Array.isArray((req as any)?.files) ? ((req as any).files as any[]) : [];
    if (!files.length) return res.status(400).json({ error: true, message: "attachment is required" });

    const defaultSubject = `Anexo do atendimento #${ticketId} - ${ticket?.contact?.name || "Cliente"}`;
    const safeSubject = subject || defaultSubject;

    const { primary, secondary } = await getCompanyBrandingTheme(companyId);
    const logoInline = await getCompanyLogoInline(companyId);
    const logoSrc = logoInline?.cid ? `cid:${logoInline.cid}` : (logoInline?.publicUrl || "");

    const contactName = String(ticket?.contact?.name || "Cliente");
    const greeting = `Olá, ${contactName}!`;
    const messageText = String(message || "").trim() || "Segue o anexo do atendimento abaixo.";
    const sentAt = new Date();
    const sentAtBr = `${String(sentAt.getDate()).padStart(2, "0")}/${String(sentAt.getMonth() + 1).padStart(2, "0")}/${sentAt.getFullYear()}`;

    const firstFile = files?.[0];
    const fileName = String(firstFile?.originalname || path.basename(String(firstFile?.path || "")) || "arquivo");
    const fileSize = formatBytes(firstFile?.size);

    // Professional, finance-like, table-based email (Roundcube-friendly)
    const html = `
      <div style="margin:0;padding:0;background:#f3f6f7;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f6f7;padding:20px 0;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:640px;max-width:94vw;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(15,23,42,0.08);">
                <tr>
                  <td style="padding:18px 22px;background:${escHtml(primary)};">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="56" valign="middle" style="width:56px;vertical-align:middle;">
                          ${
                            logoSrc
                              ? `
                                <img
                                  src="${escHtml(logoSrc)}"
                                  alt="Logo"
                                  height="44"
                                  style="display:block;height:44px;width:auto;max-width:180px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;"
                                />
                              `
                              : ""
                          }
                        </td>
                        <td style="vertical-align:middle;">
                          <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:#ffffff;line-height:1.1;">
                            Multichat
                          </div>
                          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:rgba(255,255,255,0.92);margin-top:4px;">
                            Envio de anexo • Atendimento #${escHtml(ticketId)}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:22px 22px 10px 22px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;color:#0f172a;margin:0 0 8px 0;">
                      ${escHtml(greeting)}
                    </div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#334155;">
                      ${escHtml(messageText).replace(/\n/g, "<br/>")}
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:12px 22px 22px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid rgba(15,23,42,0.10);border-radius:14px;overflow:hidden;">
                      <tr>
                        <td colspan="2" style="padding:12px 14px;background:rgba(2,132,199,0.08);border-bottom:1px solid rgba(15,23,42,0.08);">
                          <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;color:#0f172a;">Detalhes do anexo</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 14px;width:180px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0f172a;font-weight:700;">Atendimento:</td>
                        <td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0f172a;">#${escHtml(ticketId)}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 14px;width:180px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0f172a;font-weight:700;">Anexo:</td>
                        <td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0f172a;">${escHtml(fileName)}${files.length > 1 ? ` (+${files.length - 1})` : ""}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 14px;width:180px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0f172a;font-weight:700;">Tamanho:</td>
                        <td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0f172a;">${escHtml(fileSize || "—")}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 14px;width:180px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0f172a;font-weight:700;">Enviado em:</td>
                        <td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0f172a;">${escHtml(sentAtBr)}</td>
                      </tr>
                    </table>

                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#64748b;margin-top:14px;">
                      Obrigado por utilizar o TR Multichat.<br/>
                      <strong style="color:#0f172a;">Equipe TR Multichat</strong>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 22px;background:rgba(148,163,184,0.10);border-top:1px solid rgba(15,23,42,0.08);">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#64748b;">
                      © ${new Date().getFullYear()} TR Tecnologias • Todos os direitos reservados
                    </div>
                    <div style="height:2px;background:linear-gradient(90deg, ${escHtml(primary)} 0%, ${escHtml(secondary)} 100%);margin-top:10px;border-radius:999px;"></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    const attachments = files.map((f) => ({
      filename: String(f.originalname || path.basename(String(f.path || "")) || "arquivo"),
      path: String(f.path || ""),
      contentType: f.mimetype ? String(f.mimetype) : undefined,
    }));
    const finalAttachments: any[] = [];
    if (logoInline?.path) finalAttachments.push(logoInline);
    finalAttachments.push(...attachments);

    await sendMail(
      {
        to: toEmail,
        subject: safeSubject,
        // HTML-only to ensure webmails (Roundcube) render the premium template
        html,
        attachments: finalAttachments,
      },
      companyId
    );

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "send email error" });
  }
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
        if (!whatsappId || !contactId) {
          appendAcceptLog({ where: "accept", reason: "missing whatsappId/contactId", whatsappId, contactId, ticketId: id });
          return;
        }

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
        if (!remoteJid) {
          appendAcceptLog({ where: "accept", reason: "missing remoteJid", whatsappId, contactId, ticketId: id });
          return;
        }

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
        // Decide if we should send greeting (independent from queue menu)
        let shouldSendGreeting = Boolean(greeting);
        // Fallback: if no greeting configured, use sendGreetingAccepted setting default message
        if (!greeting) {
          try {
            const enabled = String((await getSettingValue(companyId, "sendGreetingAccepted")) || "").toLowerCase() === "enabled";
            if (!enabled) {
              shouldSendGreeting = false;
            } else {
              shouldSendGreeting = true;
            }
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
            shouldSendGreeting = false;
          }
        }

        const sock = await ensureSockConnected(companyId, whatsappId, 15000);
        if (!sock) {
          appendAcceptLog({ where: "accept", reason: "sock not ready", whatsappId, ticketId: id, status: getInlineSnapshot(whatsappId)?.status });
          return;
        }

        // Greeting (optional) — do not block menu if greeting was already sent / disabled
        if (shouldSendGreeting) {
          let alreadyGreeting = false;
          try {
            const already = await pgQuery<{ c: number }>(
              `SELECT COUNT(1)::int as c FROM "Messages" WHERE "ticketId" = $1 AND "companyId" = $2 AND "dataJson"::text ILIKE '%\"system\":\"greeting\"%'`,
              [id, companyId]
            );
            alreadyGreeting = Number(already?.[0]?.c || 0) > 0;
          } catch {}

          if (!alreadyGreeting && greeting) {
            try {
              const result = await sendTextWithRetry(sock, remoteJid, greeting, 3);
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
              emitRealtimeMessage(companyId, {
                id: sentId,
                body: greeting,
                ack: 0,
                read: true,
                mediaType: null,
                mediaUrl: null,
                ticketId: id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                fromMe: true,
                isDeleted: false,
                contactId,
                companyId,
                quotedMsgId: null,
                remoteJid,
                dataJson: JSON.stringify({ system: "greeting" }),
                participant: null
              });
            } catch (e: any) {
              appendAcceptLog({ where: "accept:greeting", ticketId: id, whatsappId, err: e?.message || String(e) });
            }
          }
        }

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

          const r2 = await sendTextWithRetry(sock, remoteJid, menuText, 3);
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
          emitRealtimeMessage(companyId, {
            id: menuId,
            body: menuText,
            ack: 0,
            read: true,
            mediaType: null,
            mediaUrl: null,
            ticketId: id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            fromMe: true,
            isDeleted: false,
            contactId,
            companyId,
            quotedMsgId: null,
            remoteJid,
            dataJson: JSON.stringify({ system: "queue_menu", items }),
            participant: null
          });
        } catch (e: any) {
          appendAcceptLog({ where: "accept:queue_menu", ticketId: id, whatsappId, err: e?.message || String(e) });
        }
      } catch (e: any) {
        appendAcceptLog({ where: "accept:outer", ticketId: id, err: e?.message || String(e) });
      }
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


