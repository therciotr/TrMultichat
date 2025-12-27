import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { getIO } from "../../libs/socket";
import { getSessionSock } from "../../libs/baileysManager";

const router = Router();

function tenantIdFromReq(req: any): number {
  return Number(req?.tenantId || 0);
}

router.get("/:ticketId", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

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

  // Send via Baileys
  const sock = getSessionSock(whatsappId);
  if (!sock) {
    return res.status(409).json({ error: true, message: "whatsapp session not ready, try again" });
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





