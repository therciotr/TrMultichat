import fs from "fs";
import path from "path";
import { pgQuery } from "../utils/pgClient";
import { getIO } from "./socket";
import { ingestBaileysMessage } from "./ticketIngest";

type SessionSnapshot = {
  id: number;
  status: string;
  qrcode: string;
  updatedAt: string;
  retries: number;
  lastConnection?: string;
  lastDisconnectStatusCode?: number | null;
  lastDisconnectMessage?: string | null;
  restartAttempts?: number;
};

const PUBLIC_DIR = path.join(process.cwd(), "public");
const REAL_SESS_FILE = path.join(PUBLIC_DIR, "whatsapp-sessions-v2.json");
const REAL_AUTH_DIR = path.join(PUBLIC_DIR, "baileys");

const inlineSessions = new Map<number, any>();
const inlineRestartAttempts = new Map<number, number>();
const startLocks = new Map<number, Promise<void>>();

async function resolveGreetingText(companyId: number, whatsappId: number, queueId: number | null): Promise<string> {
  const pickColumn = (cols: string[], candidates: string[]) => {
    const set = new Set(cols.map((c) => c.toLowerCase()));
    for (const c of candidates) {
      if (set.has(c.toLowerCase())) return c;
    }
    return null;
  };

  const findColumns = async (tableILike: string) => {
    try {
      const rows = await pgQuery<{ column_name: string }>(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name ILIKE $1
      `,
        [tableILike]
      );
      return rows.map((r) => String(r.column_name || ""));
    } catch {
      return [];
    }
  };

  const greetingColsCandidates = [
    "greetingMessage",
    "greeting_message",
    "greeting",
    "welcomeMessage",
    "welcome_message",
    "welcome"
  ];

  if (queueId) {
    const queueCols = await findColumns("queues");
    const col = pickColumn(queueCols, greetingColsCandidates);
    if (col) {
      try {
        const rows = await pgQuery<any>(`SELECT "${col}" as v FROM "Queues" WHERE id = $1 AND "companyId" = $2 LIMIT 1`, [
          queueId,
          companyId
        ]);
        const v = String(rows?.[0]?.v || "").trim();
        if (v) return v;
      } catch {}
    }
  }

  const waCols = await findColumns("whatsapps");
  const col = pickColumn(waCols, greetingColsCandidates);
  if (col) {
    try {
      // tolerate table casing differences
      const tblCandidates = ['"Whatsapps"', '"WhatsApps"', "whatsapps", "whatsApps"];
      for (const t of tblCandidates) {
        try {
          const rows = await pgQuery<any>(`SELECT "${col}" as v FROM ${t} WHERE id = $1 AND "companyId" = $2 LIMIT 1`, [
            whatsappId,
            companyId
          ]);
          const v = String(rows?.[0]?.v || "").trim();
          if (v) return v;
        } catch {}
      }
    } catch {}
  }

  return "";
}

async function loadRootQueueOptions(companyId: number, queueId: number): Promise<Array<{ id: number; title: string }>> {
  // Best-effort: read QueueOptions roots (parentId is NULL) for this queue.
  const tableCandidates = ['"QueueOptions"', '"QueueOption"', "queue_options", "queueoptions"];
  for (const t of tableCandidates) {
    try {
      const rows = await pgQuery<any>(
        `
        SELECT *
        FROM ${t}
        WHERE ("queueId" = $1 OR "queue_id" = $1)
          AND ("companyId" = $2 OR "company_id" = $2 OR "tenantId" = $2 OR "tenant_id" = $2 OR $2 = $2)
          AND ("parentId" IS NULL OR "parent_id" IS NULL OR "parentId" = 0 OR "parent_id" = 0)
        ORDER BY id ASC
        LIMIT 20
      `,
        [queueId, companyId]
      );
      const list = Array.isArray(rows) ? rows : [];
      return list
        .map((r: any) => {
          const title = String(r?.title || r?.name || r?.option || r?.label || "").trim();
          return { id: Number(r?.id || 0), title };
        })
        .filter((r) => r.id && r.title);
    } catch {
      // try next table candidate
    }
  }
  return [];
}

async function persistAndEmitSystemMessage(opts: {
  companyId: number;
  ticketId: number;
  contactId: number;
  remoteJid: string;
  body: string;
  sentId: string;
  systemTag: "greeting" | "chatbot_menu";
}) {
  const { companyId, ticketId, contactId, remoteJid, body, sentId, systemTag } = opts;
  try {
    await pgQuery(
      `
      INSERT INTO "Messages"
        (id, body, ack, read, "ticketId", "createdAt", "updatedAt", "fromMe", "isDeleted",
         "contactId", "companyId", "remoteJid", "dataJson")
      VALUES
        ($1, $2, 0, true, $3, NOW(), NOW(), true, false, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING
    `,
      [sentId, body, ticketId, contactId, companyId, remoteJid, JSON.stringify({ system: systemTag })]
    );

    const rows = await pgQuery<any>(
      `
      SELECT id, body, ack, read, "mediaType", "mediaUrl", "ticketId", "createdAt", "updatedAt",
             "fromMe", "isDeleted", "contactId", "companyId", "quotedMsgId", "remoteJid", "dataJson", participant
      FROM "Messages"
      WHERE id = $1 AND "companyId" = $2
      LIMIT 1
    `,
      [sentId, companyId]
    );
    const message = rows?.[0];
    if (message) {
      try {
        const io = getIO();
        io.emit(`company-${companyId}-appMessage`, { action: "create", message });
        io.emit(`company-${companyId}-ticket`, {
          action: "update",
          ticket: { id: ticketId, lastMessage: body, updatedAt: new Date().toISOString(), fromMe: true }
        });
      } catch {}
    }
  } catch {}
}

async function maybeSendGreetingAndMenu(opts: {
  companyId: number;
  whatsappId: number;
  ticketId: number;
  contactId: number;
  remoteJid: string;
  queueId: number | null;
}) {
  const { companyId, whatsappId, ticketId, contactId, remoteJid, queueId } = opts;
  // Dedupe: do not send twice per ticket
  try {
    const already = await pgQuery<{ c: number }>(
      `SELECT COUNT(1)::int as c FROM "Messages" WHERE "ticketId" = $1 AND "companyId" = $2 AND "dataJson"::text ILIKE '%\"system\":\"greeting\"%'`,
      [ticketId, companyId]
    );
    const alreadyMenu = await pgQuery<{ c: number }>(
      `SELECT COUNT(1)::int as c FROM "Messages" WHERE "ticketId" = $1 AND "companyId" = $2 AND "dataJson"::text ILIKE '%\"system\":\"chatbot_menu\"%'`,
      [ticketId, companyId]
    );
    const hasGreeting = Number(already?.[0]?.c || 0) > 0;
    const hasMenu = Number(alreadyMenu?.[0]?.c || 0) > 0;

    let sock = getInlineSock(whatsappId);
    if (!sock) return;

    if (!hasGreeting) {
      const greeting = await resolveGreetingText(companyId, whatsappId, queueId);
      if (greeting) {
        const r = await sock.sendMessage(remoteJid, { text: greeting });
        const sentId = String(r?.key?.id || `greet-${Date.now()}`);
        await persistAndEmitSystemMessage({
          companyId,
          ticketId,
          contactId,
          remoteJid,
          body: greeting,
          sentId,
          systemTag: "greeting"
        });
      }
    }

    if (!hasMenu && queueId) {
      const options = await loadRootQueueOptions(companyId, queueId);
      if (options.length) {
        const menuText =
          `Escolha uma opção para continuar:\\n` +
          options.map((o, idx) => `${idx + 1} - ${o.title}`).join("\\n");
        const r = await sock.sendMessage(remoteJid, { text: menuText });
        const sentId = String(r?.key?.id || `menu-${Date.now()}`);
        await persistAndEmitSystemMessage({
          companyId,
          ticketId,
          contactId,
          remoteJid,
          body: menuText,
          sentId,
          systemTag: "chatbot_menu"
        });
      }
    }
  } catch {}
}

function ensurePublicDir() {
  try {
    if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR);
  } catch {}
}

function readRealSessions(): Record<string, SessionSnapshot> {
  try {
    ensurePublicDir();
    if (!fs.existsSync(REAL_SESS_FILE)) return {};
    return JSON.parse(fs.readFileSync(REAL_SESS_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

function writeRealSessions(obj: Record<string, SessionSnapshot>) {
  try {
    ensurePublicDir();
    fs.writeFileSync(REAL_SESS_FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch {}
}

function saveSessionSnapshot(companyId: number, whatsappId: number, patch: Partial<SessionSnapshot>) {
  const all = readRealSessions();
  const prev = all[String(whatsappId)] || ({} as any);
  const next: SessionSnapshot = {
    ...prev,
    ...patch,
    id: whatsappId,
    status: patch.status ?? prev.status ?? "OPENING",
    qrcode: patch.qrcode ?? prev.qrcode ?? "",
    retries: typeof patch.retries === "number" ? patch.retries : typeof prev.retries === "number" ? prev.retries : 0,
    restartAttempts:
      typeof (patch as any).restartAttempts === "number"
        ? (patch as any).restartAttempts
        : typeof (prev as any).restartAttempts === "number"
          ? (prev as any).restartAttempts
          : 0,
    updatedAt: new Date().toISOString()
  };
  all[String(whatsappId)] = next;
  writeRealSessions(all);

  try {
    const io = getIO();
    io.emit(`company-${companyId}-whatsappSession`, { action: "update", session: next });
  } catch {}
  return next;
}

async function updateWhatsAppStatus(companyId: number, whatsappId: number, status: string) {
  try {
    await pgQuery(
      `UPDATE "Whatsapps" SET status = $1, "updatedAt" = NOW() WHERE id = $2 AND "companyId" = $3`,
      [status, whatsappId, companyId]
    );
  } catch {}
}

export function getInlineSnapshot(whatsappId: number): SessionSnapshot | null {
  const all = readRealSessions();
  return all[String(whatsappId)] || null;
}

export function getInlineSock(whatsappId: number): any | null {
  return inlineSessions.get(whatsappId) || null;
}

export async function startOrRefreshInlineSession(opts: { companyId: number; whatsappId: number; forceNewQr?: boolean }) {
  const { companyId, whatsappId, forceNewQr } = opts;

  // Prevent concurrent starts for the same whatsappId (this can cause 440 conflict)
  const existingLock = startLocks.get(whatsappId);
  if (existingLock) {
    await existingLock;
    return;
  }

  const run = (async () => {

  // eslint-disable-next-line no-new-func
  const baileysMod: any = await (new Function('return import("@whiskeysockets/baileys")'))();
  const makeWASocket = baileysMod?.makeWASocket || baileysMod?.default;
  const useMultiFileAuthState = baileysMod?.useMultiFileAuthState;
  const DisconnectReason = baileysMod?.DisconnectReason;

  if (typeof makeWASocket !== "function" || typeof useMultiFileAuthState !== "function") {
    throw new Error("Baileys module exports missing (makeWASocket/useMultiFileAuthState)");
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const P = require("pino");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const NodeCache = require("node-cache");
  const logger = P({ level: "warn" });
  const msgRetryCounterCache = new NodeCache();

  const authPath = path.join(REAL_AUTH_DIR, String(companyId), String(whatsappId));
  try {
    if (forceNewQr) fs.rmSync(authPath, { recursive: true, force: true });
  } catch {}
  try {
    fs.mkdirSync(authPath, { recursive: true });
  } catch {}

  // close existing socket for this whatsappId
  try {
    const existing = inlineSessions.get(whatsappId);
    existing?.ws?.close?.();
  } catch {}
  inlineSessions.delete(whatsappId);

  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  if (!state || !state.creds || !state.keys) {
    throw new Error("Auth state inválido: state/creds/keys ausente");
  }

  saveSessionSnapshot(companyId, whatsappId, { status: "OPENING", qrcode: "", retries: 0 });
  void updateWhatsAppStatus(companyId, whatsappId, "OPENING");

  // Critical: use the SAME minimal config shape we proved works on this VPS.
  const sock = makeWASocket({
    printQRInTerminal: false,
    auth: state,
    logger,
    msgRetryCounterCache
  });
  inlineSessions.set(whatsappId, sock);

  if (typeof saveCreds === "function") {
    sock.ev.on("creds.update", saveCreds);
  }

  sock.ev.on("messages.upsert", async (upsert: any) => {
    try {
      const msgs = Array.isArray(upsert?.messages) ? upsert.messages : [];
      for (const m of msgs) {
        const meta = await ingestBaileysMessage({ companyId, whatsappId, msg: m });
        // Only on first inbound message (new ticket), send greeting/menu to the client
        if (meta && meta.isNewTicket && !meta.fromMe && !meta.isGroup) {
          await maybeSendGreetingAndMenu({
            companyId,
            whatsappId,
            ticketId: meta.ticketId,
            contactId: meta.contactId,
            remoteJid: meta.remoteJid,
            queueId: meta.queueId
          });
        }
      }
    } catch {}
  });

  sock.ev.on("connection.update", (u: any) => {
    const connection = u?.connection;
    const qr = u?.qr;
    const statusCode = u?.lastDisconnect?.error?.output?.statusCode;
    const disconnectMessage = u?.lastDisconnect?.error?.message || u?.lastDisconnect?.error?.toString?.();

    if (qr) {
      const prev = readRealSessions()[String(whatsappId)] || ({} as any);
      const retries = (typeof prev.retries === "number" ? prev.retries : 0) + 1;
      saveSessionSnapshot(companyId, whatsappId, {
        status: "qrcode",
        qrcode: String(qr),
        retries,
        lastConnection: connection || ""
      });
      void updateWhatsAppStatus(companyId, whatsappId, "qrcode");
    }

    if (connection === "open") {
      saveSessionSnapshot(companyId, whatsappId, {
        status: "CONNECTED",
        qrcode: "",
        lastConnection: "open",
        lastDisconnectStatusCode: null,
        lastDisconnectMessage: null
      });
      inlineRestartAttempts.delete(whatsappId);
      void updateWhatsAppStatus(companyId, whatsappId, "CONNECTED");
    }

    if (connection === "close") {
      const shouldLogout = Boolean(DisconnectReason) && statusCode === DisconnectReason.loggedOut;
      if (shouldLogout) {
        try {
          fs.rmSync(authPath, { recursive: true, force: true });
        } catch {}
        saveSessionSnapshot(companyId, whatsappId, {
          status: "DISCONNECTED",
          qrcode: "",
          lastConnection: "close",
          lastDisconnectStatusCode: statusCode ?? null,
          lastDisconnectMessage: disconnectMessage ? String(disconnectMessage).slice(0, 500) : null
        });
        void updateWhatsAppStatus(companyId, whatsappId, "DISCONNECTED");
        return;
      }

      const prev = readRealSessions()[String(whatsappId)] || ({} as any);
      saveSessionSnapshot(companyId, whatsappId, {
        status: "DISCONNECTED",
        qrcode: prev?.qrcode || "",
        lastConnection: "close",
        lastDisconnectStatusCode: statusCode ?? null,
        lastDisconnectMessage: disconnectMessage ? String(disconnectMessage).slice(0, 500) : null
      });
      void updateWhatsAppStatus(companyId, whatsappId, "DISCONNECTED");

      // Restart required / transient stream errors
      if (Number(statusCode) === 515 || Number(statusCode) === 503 || Number(statusCode) === 440) {
        const attempts = (inlineRestartAttempts.get(whatsappId) || 0) + 1;
        inlineRestartAttempts.set(whatsappId, attempts);
        saveSessionSnapshot(companyId, whatsappId, {
          status: "OPENING",
          qrcode: prev?.qrcode || "",
          restartAttempts: attempts
        } as any);
        void updateWhatsAppStatus(companyId, whatsappId, "OPENING");
        setTimeout(() => {
          startOrRefreshInlineSession({ companyId, whatsappId, forceNewQr: false }).catch(() => {});
        }, Math.min(10_000, 1500 * attempts));
      }
    }
  });
  })();

  startLocks.set(whatsappId, run);
  try {
    await run;
  } finally {
    startLocks.delete(whatsappId);
  }
}

export async function startAllInlineSessions() {
  try {
    const rows = await pgQuery<{ id: number; companyId: number; status: string }>(
      `SELECT id, "companyId" as "companyId", status FROM "Whatsapps" ORDER BY id ASC`,
      []
    );
    for (const w of rows || []) {
      const companyId = Number(w.companyId || 0);
      const whatsappId = Number(w.id || 0);
      if (!companyId || !whatsappId) continue;

      const authDir = path.join(REAL_AUTH_DIR, String(companyId), String(whatsappId));
      const hasAuthCreds = fs.existsSync(path.join(authDir, "creds.json"));
      if (!hasAuthCreds) continue;

      // Always start if creds exist. This keeps the session alive even if the DB status is stale.
      // Also avoid restarting if we already have a running socket.
      if (!getInlineSock(whatsappId)) {
        startOrRefreshInlineSession({ companyId, whatsappId, forceNewQr: false }).catch(() => {});
      }
    }
  } catch {}
}


