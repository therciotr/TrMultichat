import { pgQuery } from "../utils/pgClient";
import { getIO } from "./socket";
import fs from "fs";
import path from "path";
import crypto from "crypto";

function quoteIdent(name: string): string {
  const safe = String(name).replace(/"/g, '""');
  return `"${safe}"`;
}

let cachedQueueOptionsTable: string | null = null; // quoted ident
let cachedQueueOptionsColsMap: Map<string, string> | null = null; // lower -> actual

async function resolveTableByILike(patterns: string[], fallback: string): Promise<string> {
  try {
    const params = patterns.map((p) => `%${p}%`);
    const cond = patterns.map((_, i) => `table_name ILIKE $${i + 1}`).join(" OR ");
    const rows = await pgQuery<{ table_name: string }>(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (${cond})
      LIMIT 1
    `,
      params
    );
    const name = rows?.[0]?.table_name;
    if (name) return quoteIdent(name);
  } catch {}
  return quoteIdent(fallback);
}

async function resolveQueueOptionsTable(): Promise<string> {
  if (cachedQueueOptionsTable) return cachedQueueOptionsTable;
  cachedQueueOptionsTable = await resolveTableByILike(
    ["queue_options", "queueoptions", "queue_option", "queueoption", "queues_options", "queuesoptions"],
    "QueueOptions"
  );
  return cachedQueueOptionsTable;
}

async function resolveQueueOptionsColumnsMap(tableIdentQuoted: string): Promise<Map<string, string>> {
  if (cachedQueueOptionsColsMap) return cachedQueueOptionsColsMap;
  try {
    const rawName = tableIdentQuoted.replace(/^"+|"+$/g, "").replace(/""/g, '"');
    const cols = await pgQuery<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
      [rawName]
    );
    cachedQueueOptionsColsMap = new Map(cols.map((c) => [String(c.column_name || "").toLowerCase(), c.column_name]));
    return cachedQueueOptionsColsMap;
  } catch {
    cachedQueueOptionsColsMap = new Map();
    return cachedQueueOptionsColsMap;
  }
}

function pickColumn(colsMap: Map<string, string>, candidates: string[], fallback?: string): string | null {
  for (const c of candidates) {
    const found = colsMap.get(c.toLowerCase());
    if (found) return found;
  }
  return fallback || null;
}

async function listRootQueueOptions(companyId: number, queueId: number): Promise<Array<{ id: number; option: string; title: string }>> {
  const t = await resolveQueueOptionsTable();
  const colsMap = await resolveQueueOptionsColumnsMap(t);
  const colQueueId = pickColumn(colsMap, ["queueId", "queue_id", "queueid"]);
  const colParentId = pickColumn(colsMap, ["parentId", "parent_id", "parentid"]);
  const colOption = pickColumn(colsMap, ["option", "order", "position"]);
  const colTitle = pickColumn(colsMap, ["title", "name"]);
  const colMessage = pickColumn(colsMap, ["message", "body", "text"]);
  const colCompanyId = pickColumn(colsMap, ["companyId", "company_id", "companyid"]);

  if (!colQueueId || !colOption) return [];

  const params: any[] = [queueId];
  let whereCompany = "";
  if (colCompanyId) {
    params.push(companyId);
    whereCompany = ` AND ${quoteIdent(colCompanyId)} = $${params.length}`;
  }

  const whereParent = colParentId ? ` AND ${quoteIdent(colParentId)} IS NULL` : "";
  const titleExpr = colTitle ? quoteIdent(colTitle) : colMessage ? quoteIdent(colMessage) : "NULL";
  const rows = await pgQuery<any>(
    `
      SELECT id,
             ${quoteIdent(colOption)} as "opt",
             ${titleExpr} as "ttl"
      FROM ${t}
      WHERE ${quoteIdent(colQueueId)} = $1
      ${whereCompany}
      ${whereParent}
      ORDER BY id ASC
    `,
    params
  );
  return (Array.isArray(rows) ? rows : [])
    .map((r: any) => ({
      id: Number(r?.id || 0) || 0,
      option: String(r?.opt ?? "").trim(),
      title: String(r?.ttl ?? "").trim()
    }))
    .filter((it: any) => it.id && it.option && it.title);
}

async function findQueueOptionByChoice(opts: { companyId: number; queueId: number; parentId: number | null; choice: string }): Promise<{ id: number } | null> {
  const { companyId, queueId, parentId, choice } = opts;
  const t = await resolveQueueOptionsTable();
  const colsMap = await resolveQueueOptionsColumnsMap(t);
  const colQueueId = pickColumn(colsMap, ["queueId", "queue_id", "queueid"]);
  const colParentId = pickColumn(colsMap, ["parentId", "parent_id", "parentid"]);
  const colOption = pickColumn(colsMap, ["option", "order", "position"]);
  const colCompanyId = pickColumn(colsMap, ["companyId", "company_id", "companyid"]);

  if (!colQueueId || !colOption) return null;

  const params: any[] = [queueId];
  let whereCompany = "";
  if (colCompanyId) {
    params.push(companyId);
    whereCompany = ` AND ${quoteIdent(colCompanyId)} = $${params.length}`;
  }

  let whereParent = "";
  if (colParentId) {
    if (parentId === null) {
      whereParent = ` AND ${quoteIdent(colParentId)} IS NULL`;
    } else {
      params.push(parentId);
      whereParent = ` AND ${quoteIdent(colParentId)} = $${params.length}`;
    }
  }

  params.push(String(choice).trim());
  const rows = await pgQuery<any>(
    `
      SELECT id
      FROM ${t}
      WHERE ${quoteIdent(colQueueId)} = $1
      ${whereCompany}
      ${whereParent}
      AND trim(${quoteIdent(colOption)}::text) = $${params.length}
      ORDER BY id ASC
      LIMIT 1
    `,
    params
  );
  const id = Number(rows?.[0]?.id || 0) || 0;
  return id ? { id } : null;
}

function isWaDebug(): boolean {
  return String(process.env.DEBUG_WA_MESSAGES || "").toLowerCase() === "true";
}

function waLog(...args: any[]) {
  if (!isWaDebug()) return;
  // eslint-disable-next-line no-console
  console.log("[wa]", ...args);
}

type ContactRow = {
  id: number;
  name: string;
  number: string;
  profilePicUrl?: string | null;
  companyId: number | null;
  whatsappId: number | null;
};

type TicketRow = {
  id: number;
  status: string;
  lastMessage: string;
  contactId: number | null;
  userId: number | null;
  whatsappId: number | null;
  isGroup: boolean;
  unreadMessages: number | null;
  queueId: number | null;
  queueOptionId?: number | null;
  companyId: number | null;
  updatedAt: string;
  createdAt: string;
  fromMe: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeNumberFromJid(jid: string): { number: string; isGroup: boolean } {
  const raw = String(jid || "");
  const isGroup = raw.endsWith("@g.us");
  const number = raw.split("@")[0] || raw;
  return { number, isGroup };
}

export function extractTextBody(msg: any): string {
  const m = msg?.message || {};
  return (
    m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    m?.documentMessage?.caption ||
    m?.buttonsResponseMessage?.selectedDisplayText ||
    m?.listResponseMessage?.title ||
    ""
  );
}

function detectMedia(msg: any): {
  kind: "audio" | "image" | "video" | "application" | "sticker" | "";
  mimetype?: string;
  fileName?: string;
} {
  const m = msg?.message || {};
  if (m?.audioMessage) return { kind: "audio", mimetype: m.audioMessage.mimetype, fileName: "audio" };
  if (m?.imageMessage) return { kind: "image", mimetype: m.imageMessage.mimetype, fileName: "image" };
  if (m?.videoMessage) return { kind: "video", mimetype: m.videoMessage.mimetype, fileName: "video" };
  if (m?.documentMessage) return { kind: "application", mimetype: m.documentMessage.mimetype, fileName: m.documentMessage.fileName || "document" };
  // Some Baileys messages wrap doc with caption
  if (m?.documentWithCaptionMessage?.message?.documentMessage) {
    const d = m.documentWithCaptionMessage.message.documentMessage;
    return { kind: "application", mimetype: d.mimetype, fileName: d.fileName || "document" };
  }
  if (m?.stickerMessage) return { kind: "sticker", mimetype: m.stickerMessage.mimetype, fileName: "sticker" };
  return { kind: "" };
}

function placeholderForKind(kind: string): string {
  if (kind === "audio") return "[Áudio]";
  if (kind === "image") return "[Imagem]";
  if (kind === "video") return "[Vídeo]";
  if (kind === "application") return "[Documento]";
  if (kind === "sticker") return "[Sticker]";
  return "";
}

function safeExtFromMimetype(mimetype?: string): string {
  const mt = String(mimetype || "").toLowerCase();
  if (mt.includes("ogg")) return "ogg";
  if (mt.includes("opus")) return "ogg";
  if (mt.includes("jpeg") || mt.includes("jpg")) return "jpg";
  if (mt.includes("png")) return "png";
  if (mt.includes("webp")) return "webp";
  if (mt.includes("mp4")) return "mp4";
  if (mt.includes("pdf")) return "pdf";
  const slash = mt.indexOf("/");
  if (slash > -1) {
    const ext = mt.slice(slash + 1).replace(/[^a-z0-9]/g, "");
    if (ext) return ext.slice(0, 10);
  }
  return "bin";
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

async function downloadAndStoreMedia(opts: {
  companyId: number;
  ticketId: number;
  messageId: string;
  msg: any;
  mimetype?: string;
  fileNameBase?: string;
  sock?: any;
}): Promise<{ mediaUrl: string | null; mediaType: string | null }> {
  const { companyId, ticketId, messageId, msg, mimetype, fileNameBase, sock } = opts;
  const det = detectMedia(msg);
  const kind = det.kind;
  if (!kind) return { mediaUrl: null, mediaType: null };
  if (!sock) return { mediaUrl: null, mediaType: kind === "application" ? "application" : kind };

  try {
    // Native dynamic import (avoid TS downlevel require())
    // eslint-disable-next-line no-new-func
    const baileysMod: any = await (new Function('return import("@whiskeysockets/baileys")'))();
    const downloadMediaMessage =
      baileysMod?.downloadMediaMessage || baileysMod?.default?.downloadMediaMessage;
    if (typeof downloadMediaMessage !== "function") {
      waLog("downloadMediaMessage export missing");
      return { mediaUrl: null, mediaType: kind === "application" ? "application" : kind };
    }

    const ext = safeExtFromMimetype(mimetype || det.mimetype);
    const baseName = safeFileName(fileNameBase || det.fileName || kind);
    const dir = path.join(process.cwd(), "public", "uploads", "messages", String(companyId), String(ticketId));
    ensureDir(dir);
    const file = `${baseName}-${String(messageId).slice(0, 25)}-${Date.now()}.${ext}`;
    const abs = path.join(dir, file);

    // Baileys can reupload if needed
    const buffer: Buffer = await downloadMediaMessage(
      msg,
      "buffer",
      {},
      {
        logger: undefined,
        reuploadRequest: sock?.updateMediaMessage
          ? (m: any) => sock.updateMediaMessage(m)
          : undefined
      }
    );
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      return { mediaUrl: null, mediaType: kind === "application" ? "application" : kind };
    }
    fs.writeFileSync(abs, buffer);
    const mediaUrl = `/uploads/messages/${companyId}/${ticketId}/${file}`;
    return { mediaUrl, mediaType: kind === "application" ? "application" : kind };
  } catch (e: any) {
    waLog("media download failed", { message: e?.message });
    return { mediaUrl: null, mediaType: kind === "application" ? "application" : kind };
  }
}

async function findOrCreateContact(opts: {
  companyId: number;
  whatsappId: number;
  jid: string;
  name?: string;
  profilePicUrl?: string | null;
}): Promise<ContactRow> {
  const { number, isGroup } = normalizeNumberFromJid(opts.jid);
  const name = String(opts.name || number).trim() || number;

  const existing = await pgQuery<ContactRow>(
    'SELECT id, name, number, "profilePicUrl", "companyId", "whatsappId" FROM "Contacts" WHERE number = $1 AND "companyId" = $2 LIMIT 1',
    [number, opts.companyId]
  );
  if (existing[0]) return existing[0];

  const created = await pgQuery<ContactRow>(
    `
      INSERT INTO "Contacts"
        (name, number, email, "profilePicUrl", "createdAt", "updatedAt", "isGroup", "companyId", "whatsappId")
      VALUES
        ($1, $2, '', $3, NOW(), NOW(), $4, $5, $6)
      RETURNING id, name, number, "profilePicUrl", "companyId", "whatsappId"
    `,
    [name, number, opts.profilePicUrl || null, isGroup, opts.companyId, opts.whatsappId]
  );
  return created[0];
}

async function findOrCreateTicket(opts: {
  companyId: number;
  whatsappId: number;
  contactId: number;
  isGroup: boolean;
}): Promise<{ ticket: TicketRow; created: boolean }> {
  const existing = await pgQuery<TicketRow>(
    `
      SELECT id, status, "lastMessage", "contactId", "userId", "whatsappId", "isGroup",
             "unreadMessages", "queueId", "queueOptionId", "companyId", "updatedAt", "createdAt", "fromMe"
      FROM "Tickets"
      WHERE "contactId" = $1 AND "companyId" = $2 AND "whatsappId" = $3
      LIMIT 1
    `,
    [opts.contactId, opts.companyId, opts.whatsappId]
  );
  if (existing[0]) return { ticket: existing[0], created: false };

  // Try to infer a default queue for this WhatsApp connection (keeps tickets "in the queue").
  // We keep this best-effort and compatible across varying schemas.
  let defaultQueueId: number | null = null;
  const joinTableCandidates = [
    `"WhatsappsQueues"`,
    `"WhatsappQueues"`,
    `"WhatsAppQueues"`,
    "whatsapps_queues",
    "whatsapp_queues"
  ];
  for (const tbl of joinTableCandidates) {
    try {
      const rows = await pgQuery<{ queueId: number }>(
        `SELECT "queueId" as "queueId" FROM ${tbl} WHERE ("whatsappId" = $1 OR "whatsAppId" = $1) AND ("companyId" = $2 OR "tenantId" = $2) LIMIT 1`,
        [opts.whatsappId, opts.companyId]
      );
      const qid = Number(rows?.[0]?.queueId || 0);
      if (qid) {
        defaultQueueId = qid;
        break;
      }
    } catch {
      // ignore and try next candidate
    }
  }

  const created = await pgQuery<TicketRow>(
    `
      INSERT INTO "Tickets"
        (status, "lastMessage", "contactId", "createdAt", "updatedAt", "whatsappId", "isGroup", "unreadMessages", "companyId", "queueId", "queueOptionId")
      VALUES
        ('pending', '', $1, NOW(), NOW(), $2, $3, 0, $4, $5, NULL)
      RETURNING id, status, "lastMessage", "contactId", "userId", "whatsappId", "isGroup",
                "unreadMessages", "queueId", "queueOptionId", "companyId", "updatedAt", "createdAt", "fromMe"
    `,
    [opts.contactId, opts.whatsappId, opts.isGroup, opts.companyId, defaultQueueId]
  );
  return { ticket: created[0], created: true };
}

async function loadTicketWithContact(ticketId: number) {
  const rows = await pgQuery<any>(
    `
      SELECT
        t.*,
        c.id as "contact_id",
        c.name as "contact_name",
        c.number as "contact_number",
        c."profilePicUrl" as "contact_profilePicUrl"
      FROM "Tickets" t
      JOIN "Contacts" c ON c.id = t."contactId"
      WHERE t.id = $1
      LIMIT 1
    `,
    [ticketId]
  );
  const r = rows[0];
  if (!r) return null;
  const ticket: any = { ...r };
  delete ticket.contact_id;
  delete ticket.contact_name;
  delete ticket.contact_number;
  delete ticket.contact_profilePicUrl;
  ticket.contact = {
    id: r.contact_id,
    name: r.contact_name,
    number: r.contact_number,
    profilePicUrl: r.contact_profilePicUrl
  };
  return ticket;
}

function stableMessageIdFallback(payload: any): string {
  try {
    const raw = JSON.stringify(payload || {});
    const h = crypto.createHash("sha1").update(raw).digest("hex").slice(0, 24);
    return `wa-${h}`;
  } catch {
    return `wa-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  }
}

async function sendTextWithRetry(sock: any, remoteJid: string, text: string, attempts = 3) {
  let lastErr: any = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await sock.sendMessage(remoteJid, { text });
    } catch (e: any) {
      lastErr = e;
      waLog("sendMessage failed", { attempt: i, message: e?.message });
      await new Promise((r) => setTimeout(r, 700 * i));
    }
  }
  throw lastErr;
}

export async function ingestBaileysMessage(opts: {
  companyId: number;
  whatsappId: number;
  msg: any;
  sock?: any;
}): Promise<{
  ticketId: number;
  contactId: number;
  whatsappId: number;
  companyId: number;
  isGroup: boolean;
  remoteJid: string;
  queueId: number | null;
  fromMe: boolean;
  isNewTicket: boolean;
}> {
  const { companyId, whatsappId, msg, sock } = opts;

  // ignore empty or protocol/status messages
  const remoteJid = String(msg?.key?.remoteJid || "");
  if (!remoteJid || remoteJid === "status@broadcast") return;

  const messageId =
    String(msg?.key?.id || "") ||
    stableMessageIdFallback({
      remoteJid,
      fromMe: Boolean(msg?.key?.fromMe),
      participant: msg?.key?.participant || null,
      ts: String(msg?.messageTimestamp || ""),
      body: extractTextBody(msg) || "",
      kind: detectMedia(msg).kind || "",
      idHint: msg?.key || null
    });

  const fromMe = Boolean(msg?.key?.fromMe);
  const participant = msg?.key?.participant ? String(msg.key.participant) : null;
  const pushName = String(msg?.pushName || "").trim();
  const det = detectMedia(msg);
  const baseBody = extractTextBody(msg);
  const body = baseBody || placeholderForKind(det.kind);

  const contact = await findOrCreateContact({
    companyId,
    whatsappId,
    jid: remoteJid,
    name: pushName || undefined
  });

  const { isGroup } = normalizeNumberFromJid(remoteJid);
  const ticket = await findOrCreateTicket({
    companyId,
    whatsappId,
    contactId: contact.id,
    isGroup
  });
  const isNewTicket = Boolean((ticket as any)?.created);
  const ticketRow: TicketRow = (ticket as any)?.ticket || (ticket as any);

  // Media download (best-effort). Never drop the message if this fails.
  const { mediaUrl, mediaType } = await downloadAndStoreMedia({
    companyId,
    ticketId: ticketRow.id,
    messageId,
    msg,
    mimetype: det.mimetype,
    fileNameBase: det.fileName,
    sock
  });
  waLog("messages.upsert received", {
    ticketId: ticketRow.id,
    fromMe,
    hasMedia: Boolean(det.kind),
    mediaType: mediaType || null,
    hasMediaUrl: Boolean(mediaUrl)
  });

  // If ticket exists without a queue, try to assign the first queue linked to this WhatsApp.
  if (!ticketRow.queueId) {
    let defaultQueueId: number | null = null;
    const joinTableCandidates = [
      `"WhatsappsQueues"`,
      `"WhatsappQueues"`,
      `"WhatsAppQueues"`,
      "whatsapps_queues",
      "whatsapp_queues"
    ];
    for (const tbl of joinTableCandidates) {
      try {
        const rows = await pgQuery<{ queueId: number }>(
          `SELECT "queueId" as "queueId" FROM ${tbl} WHERE ("whatsappId" = $1 OR "whatsAppId" = $1) AND ("companyId" = $2 OR "tenantId" = $2) LIMIT 1`,
          [whatsappId, companyId]
        );
        const qid = Number(rows?.[0]?.queueId || 0);
        if (qid) {
          defaultQueueId = qid;
          break;
        }
      } catch {
        // ignore
      }
    }
    if (defaultQueueId) {
      try {
        await pgQuery(`UPDATE "Tickets" SET "queueId" = $1 WHERE id = $2 AND "companyId" = $3 AND "queueId" IS NULL`, [
          defaultQueueId,
          ticketRow.id,
          companyId
        ]);
        // keep local copy in sync for downstream logic
        ticketRow.queueId = defaultQueueId;
      } catch {}
    }
  }

  // Chatbot selection persistence:
  // If the customer replies with a numeric option, store it on the ticket (queueOptionId).
  // This is used to track the chosen path and (if ticket has no queue yet) to attach it.
  let selectedQueueIdFromMenu: number | null = null;
  if (!fromMe && !isGroup) {
    const choice = String(baseBody || "").trim();
    if (choice && /^\d+$/.test(choice)) {
      try {
        // 1) If last system message is a queue menu, map selection to queueId (do NOT drop the user's message)
        let handledQueueMenu = false;
        try {
          const lastMenu = await pgQuery<any>(
            `
              SELECT "dataJson"
              FROM "Messages"
              WHERE "ticketId" = $1 AND "companyId" = $2
                AND "dataJson"::text ILIKE '%"system":"queue_menu"%'
              ORDER BY "createdAt" DESC
              LIMIT 1
            `,
            [ticketRow.id, companyId]
          );
          const dj = String(lastMenu?.[0]?.dataJson || "").trim();
          if (dj) {
            const parsed = JSON.parse(dj);
            const items = Array.isArray(parsed?.items) ? parsed.items : [];
            const picked = items.find((it: any) => Number(it?.n) === Number(choice));
            const targetQueueId = Number(picked?.queueId || 0) || 0;
            if (targetQueueId) {
              await pgQuery(
                `
                  UPDATE "Tickets"
                  SET
                    "queueId" = $1,
                    "queueOptionId" = NULL,
                    "updatedAt" = NOW()
                  WHERE id = $2 AND "companyId" = $3
                `,
                [targetQueueId, ticketRow.id, companyId]
              );
              ticketRow.queueId = targetQueueId;
              ticketRow.queueOptionId = null;
              handledQueueMenu = true;
              selectedQueueIdFromMenu = targetQueueId;
            }
          }
        } catch {
          // ignore queue menu parsing errors
        }

        // If queue menu was used, do not interpret this numeric reply as QueueOptions navigation yet.
        if (handledQueueMenu) {
          // continue flow (store message, update ticket, emit sockets) with updated queueId
        } else {
        const current = await pgQuery<any>(
          `SELECT id, "queueId", "queueOptionId", status FROM "Tickets" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
          [ticketRow.id, companyId]
        );
        const cur = current?.[0];
        const curQueueId = Number(cur?.queueId || ticketRow.queueId || 0) || 0;
        const curParentId = cur?.queueOptionId !== undefined && cur?.queueOptionId !== null ? Number(cur.queueOptionId) : null;
        if (curQueueId) {
          const found = await findQueueOptionByChoice({
            companyId,
            queueId: curQueueId,
            parentId: curParentId,
            choice
          });
          const optId = Number(found?.id || 0) || 0;
          if (optId) {
            await pgQuery(
              `
                UPDATE "Tickets"
                SET
                  "queueOptionId" = $1,
                  "queueId" = COALESCE("queueId", $2),
                  "updatedAt" = NOW()
                WHERE id = $3 AND "companyId" = $4
              `,
              [optId, curQueueId, ticketRow.id, companyId]
            );
            ticketRow.queueOptionId = optId;
            if (!ticketRow.queueId) ticketRow.queueId = curQueueId;
          }
        }
        }
      } catch {
        // ignore (best-effort)
      }
    }
  }

  // insert message idempotently
  await pgQuery(
    `
      INSERT INTO "Messages"
        (id, body, ack, read, "mediaType", "mediaUrl", "ticketId", "createdAt", "updatedAt", "fromMe", "isDeleted",
         "contactId", "companyId", "remoteJid", "dataJson", participant)
      VALUES
        ($1, $2, 0, false, $3, $4, $5, NOW(), NOW(), $6, false, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      messageId,
      body || "",
      mediaType,
      mediaUrl,
      ticketRow.id,
      fromMe,
      contact.id,
      companyId,
      remoteJid,
      JSON.stringify(msg || {}),
      participant
    ]
  );

  // update ticket last message + unread count
  await pgQuery(
    `
      UPDATE "Tickets"
      SET
        "lastMessage" = $1,
        "updatedAt" = NOW(),
        "fromMe" = $2,
        "unreadMessages" = COALESCE("unreadMessages", 0) + $3
      WHERE id = $4
    `,
    [body || "", fromMe, fromMe ? 0 : 1, ticketRow.id]
  );

  // If user picked a queue from our accept menu, immediately send QueueOptions root menu for that queue (professional flow).
  if (!fromMe && !isGroup && selectedQueueIdFromMenu && sock) {
    try {
      // Dedupe: only one root options menu per ticket+queue
      const already = await pgQuery<{ c: number }>(
        `SELECT COUNT(1)::int as c
         FROM "Messages"
         WHERE "ticketId" = $1 AND "companyId" = $2
           AND "dataJson"::text ILIKE '%"system":"queue_options_menu"%'
           AND "dataJson"::text ILIKE $3`,
        [ticketRow.id, companyId, `%"queueId":${selectedQueueIdFromMenu}%`]
      );
      if (Number(already?.[0]?.c || 0) === 0) {
        const items = await listRootQueueOptions(companyId, selectedQueueIdFromMenu);

        if (items.length) {
          const menuText =
            `Perfeito! Agora escolha uma opção para continuar:\n` +
            items.map((it: any) => `${it.option} - ${it.title}`).join("\n");

          const r = await sendTextWithRetry(sock, remoteJid, menuText, 3);
          const outId = String(r?.key?.id || `queue-options-${Date.now()}`);

          await pgQuery(
            `
              INSERT INTO "Messages"
                (id, body, ack, read, "ticketId", "createdAt", "updatedAt", "fromMe", "isDeleted",
                 "contactId", "companyId", "remoteJid", "dataJson")
              VALUES
                ($1, $2, 0, true, $3, NOW(), NOW(), true, false, $4, $5, $6, $7)
              ON CONFLICT (id) DO NOTHING
            `,
            [
              outId,
              menuText,
              ticketRow.id,
              contact.id,
              companyId,
              remoteJid,
              JSON.stringify({ system: "queue_options_menu", queueId: selectedQueueIdFromMenu, parentId: null, items })
            ]
          );
        }
      }
    } catch (e: any) {
      waLog("failed to send queue options menu after queue selection", { message: e?.message });
    }
  }

  // emit socket events to refresh ticket list
  const payloadTicket = await loadTicketWithContact(ticketRow.id);
  if (!payloadTicket) {
    return {
      ticketId: ticketRow.id,
      contactId: contact.id,
      whatsappId,
      companyId,
      isGroup,
      remoteJid,
      queueId: ticketRow.queueId || null,
      fromMe,
      isNewTicket
    };
  }

  try {
    const io = getIO();
    io.emit(`company-${companyId}-ticket`, { action: "update", ticket: payloadTicket });
    io.emit(`company-${companyId}-appMessage`, { action: "create", ticket: payloadTicket });
    io.emit(`company-${companyId}-contact`, { action: "update", contact: payloadTicket.contact });
  } catch {}

  // keep Typescript happy; used for debugging if needed
  void nowIso();

  return {
    ticketId: payloadTicket.id,
    contactId: contact.id,
    whatsappId,
    companyId,
    isGroup,
    remoteJid,
    queueId: (payloadTicket as any)?.queueId ?? ticketRow.queueId ?? null,
    fromMe,
    isNewTicket
  };
}


