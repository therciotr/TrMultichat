import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { getIO } from "../../libs/socket";
import { getInlineSnapshot, getInlineSock, startOrRefreshInlineSession } from "../../libs/waInlineManager";
import fs from "fs";
import multer from "multer";
import path from "path";

const router = Router();

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
  return s.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

function detectOutgoingMediaType(mimetype?: string): "image" | "video" | "audio" | "application" {
  const mt = String(mimetype || "").toLowerCase();
  if (mt.startsWith("image/")) return "image";
  if (mt.startsWith("video/")) return "video";
  if (mt.startsWith("audio/")) return "audio";
  return "application";
}

async function loadTicketWithContact(ticketId: number, companyId: number) {
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
  const r = rows?.[0];
  if (!r) return null;
  const ticket: any = { ...r };
  ticket.contact = r.contact_id
    ? {
        id: r.contact_id,
        name: r.contact_name,
        number: r.contact_number,
        profilePicUrl: r.contact_profilePicUrl,
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

// Multer: store outbound medias under /public/uploads/messages/:companyId/:ticketId
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        const companyId = tenantIdFromReq(req);
        const ticketId = Number((req as any)?.params?.ticketId || 0);
        const dir = path.join(process.cwd(), "public", "uploads", "messages", String(companyId || 0), String(ticketId || 0));
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
router.post("/:ticketId", authMiddleware, upload.any(), async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  // Prefer legacy implementation if available (it uses the real wbot session currently connected)
  if (tryRunLegacyMessageController("store", req, res)) return;

  const ticketId = Number(req.params.ticketId);
  const files = Array.isArray((req as any)?.files) ? ((req as any).files as any[]) : [];
  const hasMedia = files.length > 0;

  // Body is required only for pure text messages.
  // For media messages, if body/caption is empty we use the filename as caption to avoid blocking the send.
  const firstFileName = files?.[0]?.originalname ? String(files[0].originalname).trim() : "";
  const bodyTextRaw = String((req.body as any)?.body || "").trim();
  const bodyText = hasMedia ? (bodyTextRaw || firstFileName || "[Arquivo]") : bodyTextRaw;
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

  function sockReady(s: any): boolean {
    if (!s) return false;
    // Baileys uses WebSocket under sock.ws
    const rs = (s as any)?.ws?.readyState;
    // If readyState is unknown, assume usable.
    if (typeof rs !== "number") return true;
    // 1 = OPEN
    return rs === 1;
  }

  async function waitForConnectedSock(timeoutMs: number) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const s = getInlineSock(whatsappId);
      const snap = getInlineSnapshot(whatsappId);
      const ok = snap?.status === "CONNECTED" && sockReady(s);
      if (ok) return s;
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  }

  async function ensureSock() {
    // fast path: existing + connected
    const snap = getInlineSnapshot(whatsappId);
    const existing = getInlineSock(whatsappId);
    if (snap?.status === "CONNECTED" && sockReady(existing)) return existing;

    // kick a refresh and wait for CONNECTED
    try {
      startOrRefreshInlineSession({ companyId, whatsappId, forceNewQr: false }).catch(() => {});
    } catch {}
    return await waitForConnectedSock(7000);
  }

  // Send via inline session (auto-start/refresh if needed)
  let sock = await ensureSock();
  if (!sock) {
    return res.status(409).json({
      error: true,
      message:
        "Sessão do WhatsApp não está conectada/pronta. Reconecte o WhatsApp (QR Code) e tente novamente em alguns segundos.",
    });
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

  const createdIds: string[] = [];
  let lastBodyForTicket = bodyText;

  const sendOne = async (opts: { text: string; file?: any }, attempt: number = 0) => {
    const text = String(opts.text || "").trim();
    const file = opts.file;
    let sentId = `local-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    let mediaType: string | null = null;
    let mediaUrl: string | null = null;

    try {
      // If the socket is stale/closed, refresh it once before trying to send.
      if (!sockReady(sock) || getInlineSnapshot(whatsappId)?.status !== "CONNECTED") {
        const refreshed = await ensureSock();
        if (refreshed) sock = refreshed;
      }

      if (file) {
        const absPath = String(file.path || "").trim();
        const mimetype = String(file.mimetype || "").trim();
        const kind = detectOutgoingMediaType(mimetype);
        mediaType = kind;
        mediaUrl = `/uploads/messages/${companyId}/${ticketId}/${path.basename(absPath)}`;

        if (kind === "image") {
          const result = await sock.sendMessage(remoteJid, { image: { url: absPath }, caption: text || undefined });
          sentId = String(result?.key?.id || sentId);
        } else if (kind === "video") {
          const result = await sock.sendMessage(remoteJid, { video: { url: absPath }, caption: text || undefined });
          sentId = String(result?.key?.id || sentId);
        } else if (kind === "audio") {
          const result = await sock.sendMessage(remoteJid, { audio: { url: absPath }, mimetype: mimetype || undefined });
          sentId = String(result?.key?.id || sentId);
        } else {
          const result = await sock.sendMessage(remoteJid, {
            document: { url: absPath },
            mimetype: mimetype || undefined,
            fileName: String(file.originalname || path.basename(absPath) || "arquivo"),
            caption: text || undefined,
          });
          sentId = String(result?.key?.id || sentId);
        }
      } else {
        const result = await sock.sendMessage(remoteJid, { text });
        sentId = String(result?.key?.id || sentId);
      }
    } catch (e: any) {
      const msg = String(e?.message || e?.toString?.() || "sendMessage failed");
      // Common transient error when the WS is in a bad state. Refresh session and retry once.
      if (attempt < 1 && /connection closed|closed/i.test(msg)) {
        const refreshed = await ensureSock();
        if (refreshed) sock = refreshed;
        return await sendOne(opts, attempt + 1);
      }
      throw new Error(msg || "sendMessage failed");
    }

    // Persist message
    await pgQuery(
      `
        INSERT INTO "Messages"
          (id, body, ack, read, "mediaType", "mediaUrl", "ticketId", "createdAt", "updatedAt", "fromMe", "isDeleted",
           "contactId", "companyId", "remoteJid", "dataJson")
        VALUES
          ($1, $2, 0, true, $3, $4, $5, NOW(), NOW(), true, false, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        sentId,
        text,
        mediaType,
        mediaUrl,
        ticketId,
        Number(contact.id),
        companyId,
        remoteJid,
        JSON.stringify({ ...(req.body || {}), media: file ? { originalname: file.originalname, mimetype: file.mimetype, filename: path.basename(String(file.path || "")) } : null }),
      ]
    );

    createdIds.push(sentId);
    lastBodyForTicket = text || lastBodyForTicket;

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
        body: text,
        ack: 0,
        read: true,
        mediaType,
        mediaUrl,
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

      io.emit(`company-${companyId}-appMessage`, { action: "create", message });
    } catch {}
  };

  try {
    if (hasMedia) {
      // Send each media as its own message (compatible with UI + socket events)
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const caption = i === 0 ? bodyText : (String(f?.originalname || "").trim() || "[Arquivo]");
        await sendOne({ text: caption, file: f });
      }
    } else {
      await sendOne({ text: bodyText });
    }
  } catch (e: any) {
    const msg = String(e?.message || e?.toString?.() || "sendMessage failed");
    if (/connection closed|closed/i.test(msg)) {
      return res.status(409).json({
        error: true,
        message:
          "Sessão do WhatsApp foi desconectada. Reconecte o WhatsApp (QR Code) e tente enviar novamente.",
      });
    }
    return res.status(502).json({ error: true, message: msg || "sendMessage failed" });
  }

  await pgQuery(
    `UPDATE "Tickets" SET "lastMessage" = $1, "updatedAt" = NOW(), "fromMe" = true, "unreadMessages" = 0 WHERE id = $2 AND "companyId" = $3`,
    [lastBodyForTicket, ticketId, companyId]
  );

  try {
    const io = getIO();
    const fullTicket = await loadTicketWithContact(ticketId, companyId);
    io.emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket:
        fullTicket || {
          id: ticketId,
          lastMessage: lastBodyForTicket,
          updatedAt: new Date().toISOString(),
          fromMe: true,
          unreadMessages: 0,
        },
    });
  } catch {}

  const lastId = createdIds[createdIds.length - 1] || `local-${Date.now()}`;
  return res.status(201).json({ id: lastId, ids: createdIds });
});

export default router;





