import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { getIO } from "../../libs/socket";
import { getInlineSock, startOrRefreshInlineSession } from "../../libs/waInlineManager";
import path from "path";

const router = Router();

function tenantIdFromReq(req: any): number {
  return Number(req?.tenantId || 0);
}

function setNoCache(res: any) {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    // Do NOT allow cache validation for this resource.
    res.setHeader("ETag", "0");
    res.setHeader("Last-Modified", "0");
  } catch {}
}

// IMPORTANT: Prevent conditional requests from ever producing 304 on /messages/*
router.use((req, res, next) => {
  try {
    delete (req as any).headers?.["if-none-match"];
    delete (req as any).headers?.["if-modified-since"];
    delete (req as any).headers?.["if-match"];
  } catch {}
  setNoCache(res);
  next();
});

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
  // Page using DESC windows but return ASC for UI rendering
  let messages = Array.isArray(rows) ? rows.slice().reverse() : [];

  // Attach contact objects (UI uses message.contact?.name)
  try {
    const ids = Array.from(new Set(messages.map((m: any) => Number(m.contactId || 0)).filter(Boolean)));
    if (ids.length) {
      const contacts = await pgQuery<any>(
        `
          SELECT id, name, number, "profilePicUrl"
          FROM "Contacts"
          WHERE "companyId" = $1 AND id = ANY($2::int[])
        `,
        [companyId, ids]
      );
      const map = new Map<number, any>();
      for (const c of contacts || []) {
        map.set(Number(c.id), { id: c.id, name: c.name, number: c.number, profilePicUrl: c.profilePicUrl });
      }
      messages = messages.map((m: any) => ({ ...m, contact: map.get(Number(m.contactId)) || null }));
    }
  } catch {}

  // Provide placeholder body for media messages when body is empty (so UI doesn't look blank)
  try {
    messages = messages.map((m: any) => {
      const body = String(m?.body || "");
      if (body.trim()) return m;
      const dj = String(m?.dataJson || "");
      if (!dj && !m?.mediaUrl) return m;
      let kind = "";
      // Fast string checks (avoid heavy JSON parse for huge payloads)
      if (dj.includes("audioMessage")) kind = "audio";
      else if (dj.includes("imageMessage")) kind = "image";
      else if (dj.includes("videoMessage")) kind = "video";
      else if (dj.includes("documentMessage") || dj.includes("documentWithCaptionMessage")) kind = "application";
      else if (dj.includes("stickerMessage")) kind = "sticker";
      else if (dj.includes("reactionMessage")) kind = "reaction";

      if (!kind) return m;
      const placeholder =
        kind === "audio"
          ? "[Áudio]"
          : kind === "image"
            ? "[Imagem]"
            : kind === "video"
              ? "[Vídeo]"
              : kind === "application"
                ? "[Documento]"
                : kind === "sticker"
                  ? "[Sticker]"
                  : kind === "reaction"
                    ? "[Reação]"
                    : "";
      if (!placeholder) return m;
      return { ...m, body: placeholder, mediaType: m.mediaType || kind };
    });
  } catch {}

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

  // Send via inline session (auto-start if needed)
  let sock = getInlineSock(whatsappId);
  if (!sock) {
    // Try to start/reconnect session on-demand (same behavior as /whatsappsession/:id)
    try {
      startOrRefreshInlineSession({ companyId, whatsappId }).catch(() => {});
    } catch {}
    const startedAt = Date.now();
    while (!sock && Date.now() - startedAt < 5000) {
      await new Promise((r) => setTimeout(r, 250));
      sock = getInlineSock(whatsappId);
    }
  }
  if (!sock) {
    return res.status(409).json({ error: true, message: "whatsapp session not ready yet, retry in a few seconds" });
  }

  // Prefer the ticket's last known remoteJid (more reliable than reformatting number)
  let remoteJid = `${String(contact.number).replace(/\D/g, "")}@s.whatsapp.net`;
  try {
    const r = await pgQuery<{ remoteJid: string }>(
      `SELECT "remoteJid" FROM "Messages" WHERE "ticketId" = $1 AND "companyId" = $2 ORDER BY "createdAt" DESC LIMIT 1`,
      [ticketId, companyId]
    );
    const last = String(r?.[0]?.remoteJid || "").trim();
    if (last) remoteJid = last;
  } catch {}

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
    const msgRows = await pgQuery<any>(
      `
        SELECT id, body, ack, read, "mediaType", "mediaUrl", "ticketId", "createdAt", "updatedAt",
               "fromMe", "isDeleted", "contactId", "companyId", "quotedMsgId", "remoteJid", "dataJson", participant
        FROM "Messages"
        WHERE id = $1 AND "companyId" = $2
        LIMIT 1
      `,
      [sentId, companyId]
    );
    const message = msgRows?.[0] || {
      id: sentId,
      body: bodyText,
      ack: 0,
      read: true,
      mediaType: null,
      mediaUrl: null,
      ticketId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fromMe: true,
      isDeleted: false,
      contactId: Number(contact.id),
      companyId,
      quotedMsgId: null,
      remoteJid,
      dataJson: JSON.stringify(req.body || {}),
      participant: null
    };

    // MessagesList expects { action, message }
    io.emit(`company-${companyId}-appMessage`, { action: "create", message });
    io.emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket: { id: ticketId, lastMessage: bodyText, updatedAt: new Date().toISOString(), fromMe: true, unreadMessages: 0 }
    });
  } catch {}

  return res.status(201).json({ id: sentId });
});

export default router;





