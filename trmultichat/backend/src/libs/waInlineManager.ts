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
        await ingestBaileysMessage({ companyId, whatsappId, msg: m });
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
      if (Number(statusCode) === 515 || Number(statusCode) === 503) {
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

      // Start for connected/opening sessions so messages are received after restarts
      if (String(w.status || "").toUpperCase() === "CONNECTED") {
        startOrRefreshInlineSession({ companyId, whatsappId, forceNewQr: false }).catch(() => {});
      }
    }
  } catch {}
}


