import fs from "fs";
import path from "path";
import NodeCache from "node-cache";
import P from "pino";
import {
  DisconnectReason
} from "@whiskeysockets/baileys";
import { pgQuery } from "../utils/pgClient";
import { ingestBaileysMessage } from "./ticketIngest";
import { getIO } from "./socket";

type SessionSnapshot = {
  id: number;
  status: string;
  qrcode: string;
  updatedAt: string;
  retries: number;
};

const PUBLIC_DIR = path.join(process.cwd(), "public");
const SESS_FILE = path.join(PUBLIC_DIR, "whatsapp-sessions.json");
const AUTH_DIR = path.join(PUBLIC_DIR, "baileys");

function ensureDir(dir: string) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
}

function readSessionsFile(): Record<string, SessionSnapshot> {
  try {
    ensureDir(PUBLIC_DIR);
    if (!fs.existsSync(SESS_FILE)) return {};
    const txt = fs.readFileSync(SESS_FILE, "utf8");
    const obj = JSON.parse(txt);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function writeSessionsFile(sessions: Record<string, SessionSnapshot>) {
  try {
    ensureDir(PUBLIC_DIR);
    fs.writeFileSync(SESS_FILE, JSON.stringify(sessions, null, 2), "utf8");
  } catch {}
}

async function queryWhatsappsTable(
  sqlOrBuilder: string | ((table: string) => string),
  params: any[]
) {
  const candidates = ['"Whatsapps"', '"WhatsApps"', "whatsapps", "whatsApps"];
  let lastErr: any = null;
  for (const table of candidates) {
    try {
      const sql =
        typeof sqlOrBuilder === "function"
          ? sqlOrBuilder(table)
          : sqlOrBuilder.replace(/\b"Whatsapps"\b/g, table);
      await pgQuery(sql, params);
      return;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || "");
      if (!/relation .* does not exist/i.test(msg)) throw e;
    }
  }
  if (lastErr) throw lastErr;
}

async function updateWhatsAppStatus(companyId: number, whatsappId: number, status: string) {
  try {
    await queryWhatsappsTable(
      (table) =>
        `UPDATE ${table} SET status = $1, "updatedAt" = NOW() WHERE id = $2 AND "companyId" = $3`,
      [status, whatsappId, companyId]
    );
  } catch {}
}

async function listWhatsappsBasic(): Promise<Array<{ id: number; companyId: number }>> {
  const candidates = ['"Whatsapps"', '"WhatsApps"', "whatsapps", "whatsApps"];
  for (const table of candidates) {
    try {
      const rows = await pgQuery<{ id: number; companyId: number }>(
        `SELECT id, "companyId" as "companyId" FROM ${table} ORDER BY id ASC`,
        []
      );
      return Array.isArray(rows) ? rows : [];
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (!/relation .* does not exist/i.test(msg)) throw e;
    }
  }
  return [];
}

// NOTE: We intentionally create logger/cache per-session start to avoid any cross-module weirdness
// between CJS (our code) and ESM (Baileys) in production.

type ManagedSession = {
  sock: any;
  store?: any;
  companyId: number;
  retries: number;
};

const sessions = new Map<number, ManagedSession>();

function isDebugBaileys(): boolean {
  return String(process.env.DEBUG_BAILEYS || "").toLowerCase() === "true";
}

function debugLog(...args: any[]) {
  if (!isDebugBaileys()) return;
  // eslint-disable-next-line no-console
  console.log("[baileysManager]", ...args);
}

export function getStoredQr(whatsappId: number): SessionSnapshot | null {
  const all = readSessionsFile();
  return all[String(whatsappId)] || null;
}

export function getSessionStore(whatsappId: number): any | null {
  const s = sessions.get(whatsappId);
  return s?.store || null;
}

export function getSessionSock(whatsappId: number): any | null {
  const s = sessions.get(whatsappId);
  return s?.sock || null;
}

export function listSessionIds(): number[] {
  return Array.from(sessions.keys());
}

export async function startAllBaileysSessions(): Promise<void> {
  const rows = await listWhatsappsBasic();
  for (const r of rows) {
    const companyId = Number((r as any).companyId || 0);
    const whatsappId = Number((r as any).id || 0);
    if (!companyId || !whatsappId) continue;
    // fire and forget (do not block startup)
    startOrRefreshBaileysSession({
      companyId,
      whatsappId,
      emit: (cId, payload) => {
        try {
          const io = getIO();
          io.emit(`company-${cId}-whatsappSession`, payload);
        } catch {}
      }
    }).catch(() => {});
  }
}

export async function startOrRefreshBaileysSession(opts: {
  companyId: number;
  whatsappId: number;
  emit?: (companyId: number, payload: { action: string; session: SessionSnapshot }) => void;
  forceNewQr?: boolean;
}): Promise<void> {
  const { companyId, whatsappId, emit, forceNewQr } = opts;
  const logger = P({ level: process.env.NODE_ENV === "production" ? "warn" : "info" });
  const msgRetryCounterCache = new NodeCache();

  // Runtime-safe Baileys exports (GitHub build can vary CJS/ESM exports)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const baileysRuntime = require("@whiskeysockets/baileys");
  // In this project we pin to the runtime exports present in production:
  // - makeWASocket is exported both as named + default function
  // - useMultiFileAuthState is exported as named function
  const makeWASocketFn =
    baileysRuntime?.makeWASocket || (typeof baileysRuntime?.default === "function" ? baileysRuntime.default : null);
  const useMultiFileAuthStateFn = baileysRuntime?.useMultiFileAuthState;
  const makeCacheableSignalKeyStoreFn = baileysRuntime?.makeCacheableSignalKeyStore;
  const fetchLatestBaileysVersionFn = baileysRuntime?.fetchLatestBaileysVersion;

  if (typeof makeWASocketFn !== "function" || typeof useMultiFileAuthStateFn !== "function") {
    const keys = Object.keys(baileysRuntime || {});
    const defType = typeof baileysRuntime?.default;
    throw new Error(
      `Baileys exports mismatch (makeWASocket/useMultiFileAuthState not found). keys=${keys.join(",")} defaultType=${defType}`
    );
  }
  debugLog("baileys exports ok", {
    makeWASocket: typeof makeWASocketFn,
    useMultiFileAuthState: typeof useMultiFileAuthStateFn,
    makeCacheableSignalKeyStore: typeof makeCacheableSignalKeyStoreFn,
    fetchLatestBaileysVersion: typeof fetchLatestBaileysVersionFn
  });

  // restart existing session if any
  const existing = sessions.get(whatsappId);
  if (existing?.sock) {
    try {
      existing.sock?.ws?.close?.();
    } catch {}
    sessions.delete(whatsappId);
  }

  ensureDir(AUTH_DIR);
  const authPath = path.join(AUTH_DIR, String(companyId), String(whatsappId));
  ensureDir(authPath);

  // Force a brand new QR code by wiping auth state (used by "Novo QR Code" in UI).
  if (forceNewQr) {
    try {
      fs.rmSync(authPath, { recursive: true, force: true });
    } catch {}
    // Recreate folder for multi-file auth state
    ensureDir(authPath);
    // Reset session snapshot to prompt UI to wait for QR
    try {
      const all = readSessionsFile();
      all[String(whatsappId)] = {
        id: whatsappId,
        status: "DISCONNECTED",
        qrcode: "",
        updatedAt: new Date().toISOString(),
        retries: 0
      };
      writeSessionsFile(all);
    } catch {}
    try {
      await updateWhatsAppStatus(companyId, whatsappId, "DISCONNECTED");
    } catch {}
  }

  // Baileys builds differ: some return { state, saveCreds }, others return { authState, saveCreds }.
  const authRes: any = await useMultiFileAuthStateFn(authPath);
  let state: any =
    authRes?.state ||
    authRes?.authState ||
    authRes?.auth ||
    null;
  // Some weird builds may return { creds, keys } at top-level
  if (!state && authRes?.creds && authRes?.keys) {
    state = { creds: authRes.creds, keys: authRes.keys };
  }
  // Some wrappers nest it as { state: { state: { creds, keys } } }
  if (state?.state && (state.state.creds || state.state.keys)) {
    state = state.state;
  }

  const saveCreds: any = authRes?.saveCreds || authRes?.saveState || authRes?.save;
  if (!state || typeof state !== "object") {
    const topKeys = Object.keys(authRes || {});
    debugLog("authRes keys", topKeys);
    throw new Error(`Baileys auth state is undefined (authRes keys: ${topKeys.join(",")})`);
  }
  if (!state?.creds || !state?.keys) {
    const stateKeys = Object.keys(state || {});
    debugLog("authRes/state shape mismatch", { authResKeys: Object.keys(authRes || {}), stateKeys });
    throw new Error(
      `Baileys auth state missing creds/keys (state keys: ${stateKeys.join(",")})`
    );
  }
  let version: any = undefined;
  try {
    if (typeof fetchLatestBaileysVersionFn === "function") {
      const v = await fetchLatestBaileysVersionFn();
      version = v?.version;
    }
  } catch {
    // VPS pode não ter saída para internet; Baileys consegue operar sem buscar versão "latest".
    version = undefined;
  }

  // Baileys (atual) expects config.auth. Internally it aliases it as `authState`.
  const sockOptsBase: any = {
    ...(version ? { version } : {}),
    logger,
    printQRInTerminal: false,
    msgRetryCounterCache,
    generateHighQualityLinkPreview: true
  };
  const wrapped = {
    creds: (state as any).creds,
    keys:
      typeof makeCacheableSignalKeyStoreFn === "function"
        ? makeCacheableSignalKeyStoreFn((state as any).keys, logger)
        : (state as any).keys
  };
  debugLog("makeWASocket cfg", {
    keys: Object.keys({ ...sockOptsBase, auth: wrapped }),
    authType: typeof wrapped,
    authHasCreds: Boolean(wrapped?.creds),
    authHasKeys: Boolean(wrapped?.keys)
  });
  const sock = makeWASocketFn({ ...sockOptsBase, auth: wrapped } as any);

  // Some Baileys builds export makeInMemoryStore as default-only; require it to be safe.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const baileysAny = require("@whiskeysockets/baileys");
  const makeInMemoryStore =
    baileysAny.makeInMemoryStore || baileysAny.default?.makeInMemoryStore || baileysAny.default;
  const store = typeof makeInMemoryStore === "function" ? makeInMemoryStore({ logger }) : null;
  if (store && typeof store.bind === "function") {
    store.bind(sock.ev);
  }
  const managed: ManagedSession = { sock, store: store || undefined, companyId, retries: 0 };
  sessions.set(whatsappId, managed);

  if (typeof saveCreds === "function") {
    sock.ev.on("creds.update", saveCreds);
  }

  sock.ev.on("messages.upsert", async (upsert: any) => {
    try {
      const msgs = Array.isArray(upsert?.messages) ? upsert.messages : [];
      for (const m of msgs) {
        // Only ingest real messages that belong to this whatsapp session
        await ingestBaileysMessage({ companyId, whatsappId, msg: m });
      }
    } catch {}
  });

  sock.ev.on("connection.update", async (u: any) => {
    const connection = u?.connection;
    const qr = u?.qr;

    if (qr) {
      managed.retries += 1;
      const snap: SessionSnapshot = {
        id: whatsappId,
        status: "qrcode",
        qrcode: String(qr),
        updatedAt: new Date().toISOString(),
        retries: managed.retries
      };
      const all = readSessionsFile();
      all[String(whatsappId)] = snap;
      writeSessionsFile(all);
      await updateWhatsAppStatus(companyId, whatsappId, "qrcode");
      emit?.(companyId, { action: "update", session: snap });
    }

    if (connection === "open") {
      const snap: SessionSnapshot = {
        id: whatsappId,
        status: "CONNECTED",
        qrcode: "",
        updatedAt: new Date().toISOString(),
        retries: managed.retries
      };
      const all = readSessionsFile();
      all[String(whatsappId)] = snap;
      writeSessionsFile(all);
      await updateWhatsAppStatus(companyId, whatsappId, "CONNECTED");
      emit?.(companyId, { action: "update", session: snap });
    }

    if (connection === "close") {
      const statusCode = u?.lastDisconnect?.error?.output?.statusCode;
      const shouldLogout = statusCode === DisconnectReason.loggedOut;
      if (shouldLogout) {
        // remove auth state
        try {
          fs.rmSync(authPath, { recursive: true, force: true });
        } catch {}
      }
      const snap: SessionSnapshot = {
        id: whatsappId,
        status: "DISCONNECTED",
        qrcode: "",
        updatedAt: new Date().toISOString(),
        retries: managed.retries
      };
      const all = readSessionsFile();
      all[String(whatsappId)] = snap;
      writeSessionsFile(all);
      await updateWhatsAppStatus(companyId, whatsappId, "DISCONNECTED");
      emit?.(companyId, { action: "update", session: snap });
    }
  });
}


