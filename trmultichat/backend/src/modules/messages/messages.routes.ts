import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { getIO } from "../../libs/socket";
import { getSessionSock, listSessionIds, startOrRefreshBaileysSession } from "../../libs/baileysManager";
import path from "path";

const router = Router();

function tenantIdFromReq(req: any): number {
  return Number(req?.tenantId || 0);
}

function requireLegacyController(moduleRelPath: string): any | null {
  const cwd = process.cwd();
  const candidates = [
    // running from backend root
    path.resolve(cwd, moduleRelPath),
    path.resolve(cwd, "dist", moduleRelPath),
    // running from monorepo root
    path.resolve(cwd, "backend", moduleRelPath),
    path.resolve(cwd, "backend", "dist", moduleRelPath),
    path.resolve(cwd, "trmultichat", "backend", moduleRelPath),
    path.resolve(cwd, "trmultichat", "backend", "dist", moduleRelPath),
    // running from compiled JS (dist/modules/messages)
    path.resolve(__dirname, "..", "..", "..", moduleRelPath),
    path.resolve(__dirname, "..", "..", "..", "..", "dist", moduleRelPath),
    path.resolve(__dirname, "..", "..", "..", "..", "..", "backend", "dist", moduleRelPath)
  ];
  for (const p of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const m = require(p);
      return m?.default || m;
    } catch {}
  }
  return null;
}

function tryRunLegacyMessageController(action: "store" | "index", req: any, res: any): boolean {
  try {
    const ctrl = requireLegacyController("controllers/MessageController");
    const fn = ctrl && ctrl[action];
    if (typeof fn !== "function") return false;

    // Legacy expects req.user with companyId/profile and req.params.ticketId
    const companyId = tenantIdFromReq(req);
    const userId = Number(req?.userId || 0);
    if (!companyId || !userId) return false;
    req.user = { id: userId, companyId, profile: "admin" };
    req.params = { ...(req.params || {}), ticketId: req.params?.ticketId };

    // Ensure legacy sequelize boot (MessageController uses legacy models/services)
    try {
      requireLegacyController("database/index");
    } catch {}

    Promise.resolve(fn(req, res)).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

router.get("/:ticketId", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  // Prefer legacy implementation if available (matches UI expectations)
  if (tryRunLegacyMessageController("index", req, res)) return;

  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const ticketId = Number(req.params.ticketId);
  const rows = await pgQuery<any>(
    `
      SELECT id, body, ack, read, "mediaType", "mediaUrl", "ticketId", "createdAt", "updatedAt",
             "fromMe", "isDeleted", "contactId", "companyId", "quotedMsgId", "remoteJid", "dataJson", participant
      FROM "Messages"
      WHERE "ticketId" = $1 AND "companyId" = $2
      ORDER BY "createdAt" DESC
      LIMIT $3 OFFSET $4
    `,
    [ticketId, companyId, limit, offset]
  );
  const messages = Array.isArray(rows) ? rows : [];
  return res.json({ messages, hasMore: messages.length === limit });
});

// POST /messages/:ticketId (send message)
router.post("/:ticketId", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  // Prefer legacy implementation if available (it uses the real wbot session currently connected)
  if (tryRunLegacyMessageController("store", req, res)) return;

  const ticketId = Number(req.params.ticketId);
  const bodyText = String((req.body as any)?.body || "").trim();
  if (!ticketId) return res.status(400).json({ error: true, message: "invalid ticketId" });
  if (!bodyText) return res.status(400).json({ error: true, message: "body is required" });

  const ticketRows = await pgQuery<any>(
    `SELECT id, "contactId", "whatsappId", "companyId" FROM "Tickets" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [ticketId, companyId]
  );
  const ticket = ticketRows[0];
  if (!ticket) return res.status(404).json({ error: true, message: "ticket not found" });

  const contactRows = await pgQuery<any>(
    `SELECT id, number, name FROM "Contacts" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [Number(ticket.contactId || 0), companyId]
  );
  const contact = contactRows[0];
  if (!contact) return res.status(404).json({ error: true, message: "contact not found" });

  const whatsappId = Number(ticket.whatsappId || 0);
  if (!whatsappId) return res.status(400).json({ error: true, message: "ticket has no whatsappId" });

  // Send via Baileys (auto-start session if needed)
  let sock = getSessionSock(whatsappId);
  if (!sock) {
    // Try to start/reconnect session on-demand (same behavior as /whatsappsession/:id)
    try {
      startOrRefreshBaileysSession({ companyId, whatsappId }).catch(() => {});
    } catch {}
    const startedAt = Date.now();
    while (!sock && Date.now() - startedAt < 5000) {
      await new Promise((r) => setTimeout(r, 250));
      sock = getSessionSock(whatsappId);
    }
  }
  if (!sock) {
    return res.status(409).json({
      error: true,
      message: "whatsapp session not ready yet, retry in a few seconds",
      debug: { whatsappId, knownSessions: listSessionIds() }
    });
  }

  const remoteJid = `${String(contact.number).replace(/\D/g, "")}@s.whatsapp.net`;
  let sentId = `local-${Date.now()}`;
  try {
    const result = await sock.sendMessage(remoteJid, { text: bodyText });
    sentId = String(result?.key?.id || sentId);
  } catch (e: any) {
    return res.status(502).json({ error: true, message: e?.message || "sendMessage failed" });
  }

  // Persist message
  await pgQuery(
    `
      INSERT INTO "Messages"
        (id, body, ack, read, "ticketId", "createdAt", "updatedAt", "fromMe", "isDeleted",
         "contactId", "companyId", "remoteJid", "dataJson")
      VALUES
        ($1, $2, 0, true, $3, NOW(), NOW(), true, false, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING
    `,
    [sentId, bodyText, ticketId, Number(contact.id), companyId, remoteJid, JSON.stringify(req.body || {})]
  );

  await pgQuery(
    `UPDATE "Tickets" SET "lastMessage" = $1, "updatedAt" = NOW(), "fromMe" = true, "unreadMessages" = 0 WHERE id = $2 AND "companyId" = $3`,
    [bodyText, ticketId, companyId]
  );

  // Emit updates for ticket list
  try {
    const io = getIO();
    io.emit(`company-${companyId}-appMessage`, { action: "create", ticket: { id: ticketId } });
    io.emit(`company-${companyId}-ticket`, { action: "update", ticket: { id: ticketId, lastMessage: bodyText, updatedAt: new Date().toISOString(), fromMe: true, unreadMessages: 0 } });
  } catch {}

  return res.status(201).json({ ok: true, id: sentId });
});

export default router;





