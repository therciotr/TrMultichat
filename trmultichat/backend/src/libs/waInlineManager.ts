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
  pairingCode?: string | null;
  pairingExpiresAt?: string | null;
  pairingPhoneNumber?: string | null;
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
const inlinePairingKeepAliveAttempts = new Map<number, number>();
const startLocks = new Map<number, Promise<void>>();
const inlineConnectionState = new Map<number, string>();

// NOTE:
// Automatic greeting/menu messages must be triggered ONLY when the agent accepts a ticket (pending -> open).
// Do NOT send any automatic replies on inbound messages here.

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
    io.emit(`company-${companyId}-whatsapp`, { event: "whatsapp:update", whatsappId, session: next });
  } catch {}
  return next;
}

function isPairingStillActive(snapshot: any): boolean {
  const code = String(snapshot?.pairingCode || "").trim();
  const exp = String(snapshot?.pairingExpiresAt || "").trim();
  if (!code || !exp) return false;
  const expMs = Date.parse(exp);
  if (!Number.isFinite(expMs)) return false;
  return expMs > Date.now();
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tracePairing(whatsappId: number, message: string, extra?: Record<string, any>) {
  try {
    const payload = {
      tag: "pairing-trace",
      whatsappId,
      ts: new Date().toISOString(),
      message,
      ...(extra || {})
    };
    console.log(JSON.stringify(payload));
  } catch {}
}

async function safeStopSession(opts: {
  companyId: number;
  whatsappId: number;
  removeAuth?: boolean;
  closeDelayMs?: number;
}) {
  const companyId = Number(opts.companyId || 0);
  const whatsappId = Number(opts.whatsappId || 0);
  const removeAuth = opts.removeAuth !== false;
  const closeDelayMs = Math.max(600, Number(opts.closeDelayMs || 2000));
  const authPath = path.join(REAL_AUTH_DIR, String(companyId), String(whatsappId));

  const sock = inlineSessions.get(whatsappId);
  inlineSessions.delete(whatsappId);
  inlineConnectionState.delete(whatsappId);
  try {
    if (sock?.ev?.removeAllListeners) sock.ev.removeAllListeners();
  } catch {}
  try {
    if (typeof sock?.logout === "function") await sock.logout();
  } catch {}
  try {
    if (typeof sock?.end === "function") sock.end(new Error("session restart"));
  } catch {}
  try {
    sock?.ws?.close?.();
  } catch {}

  await sleep(closeDelayMs);

  if (removeAuth) {
    try {
      fs.rmSync(authPath, { recursive: true, force: true });
    } catch {}
  }
  try {
    fs.mkdirSync(authPath, { recursive: true });
  } catch {}
}

async function waitForInlineSock(whatsappId: number, timeoutMs = 10_000) {
  const started = Date.now();
  let lastSock: any = null;
  while (Date.now() - started < timeoutMs) {
    const sock = getInlineSock(whatsappId);
    if (sock) {
      lastSock = sock;
      const wsState = Number((sock as any)?.ws?.readyState);
      // Prefer OPEN state (1). If state is unavailable, still accept.
      if (!Number.isFinite(wsState) || wsState === 1) return sock;
    }
    await sleep(120);
  }
  return lastSock;
}

async function waitForConnectionState(
  whatsappId: number,
  acceptedStates: string[] = ["connecting", "open"],
  timeoutMs = 10_000
) {
  const accepted = acceptedStates.map((s) => String(s || "").toLowerCase());
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = String(inlineConnectionState.get(whatsappId) || "").toLowerCase();
    if (accepted.includes(state)) return state;
    await sleep(120);
  }
  return String(inlineConnectionState.get(whatsappId) || "").toLowerCase();
}

export async function disconnectInlineSession(opts: {
  companyId: number;
  whatsappId: number;
  removeAuth?: boolean;
}) {
  const companyId = Number(opts.companyId || 0);
  const whatsappId = Number(opts.whatsappId || 0);
  if (!companyId || !whatsappId) return;

  await safeStopSession({
    companyId,
    whatsappId,
    removeAuth: opts.removeAuth !== false,
    closeDelayMs: 2000
  });
  inlineRestartAttempts.delete(whatsappId);
  inlinePairingKeepAliveAttempts.delete(whatsappId);

  saveSessionSnapshot(companyId, whatsappId, {
    status: "DISCONNECTED",
    qrcode: "",
    pairingCode: null,
    pairingExpiresAt: null,
    pairingPhoneNumber: null,
    lastConnection: "close",
    lastDisconnectStatusCode: null,
    lastDisconnectMessage: null,
    restartAttempts: 0
  } as any);
  void updateWhatsAppStatus(companyId, whatsappId, "DISCONNECTED");
}

function normalizePairingPhoneNumber(raw: any): string {
  const digits = String(raw || "").replace(/\D+/g, "");
  if (!digits) return "";
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  if (!withCountry.startsWith("55")) return "";
  // Keep exactly what operator typed regarding the mobile 9th digit:
  // both 55 + DDD + 8 digits (12) and 55 + DDD + 9 digits (13) are accepted.
  if (withCountry.length >= 13) return `55${withCountry.slice(-11)}`;
  if (withCountry.length === 12) return withCountry;
  return "";
}

function pairingPhoneCandidates(raw: string): string[] {
  const normalized = normalizePairingPhoneNumber(raw);
  if (!normalized) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (v: string) => {
    const d = String(v || "").replace(/\D+/g, "");
    if (!d || seen.has(d)) return;
    seen.add(d);
    out.push(d);
  };

  // Always try exactly what the operator informed first.
  push(normalized);

  // BR fallback: if number came with 9th digit, also try without it.
  if (normalized.length === 13 && normalized.startsWith("55") && normalized[4] === "9") {
    push(`${normalized.slice(0, 4)}${normalized.slice(5)}`);
  }
  // BR fallback: if number came without 9th digit, also try with it.
  if (normalized.length === 12 && normalized.startsWith("55")) {
    push(`${normalized.slice(0, 4)}9${normalized.slice(4)}`);
  }
  return out;
}

export function getInlinePairingStatus(whatsappId: number): {
  awaitingPairing: boolean;
  pairingCode: string | null;
  pairingExpiresAt: string | null;
  pairingPhoneNumber: string | null;
  remainingSeconds: number;
  status: string;
} {
  const snap: any = getInlineSnapshot(whatsappId) || {};
  const code = String(snap?.pairingCode || "").trim();
  const expiresAt = String(snap?.pairingExpiresAt || "").trim();
  const phone = String(snap?.pairingPhoneNumber || "").trim();
  const status = String(snap?.status || "");
  const expMs = expiresAt ? Date.parse(expiresAt) : NaN;
  const remainingMs = Number.isFinite(expMs) ? Math.max(0, expMs - Date.now()) : 0;
  const awaitingPairing =
    status.toUpperCase() !== "CONNECTED" &&
    Boolean(code) &&
    remainingMs > 0;
  return {
    awaitingPairing,
    pairingCode: code || null,
    pairingExpiresAt: expiresAt || null,
    pairingPhoneNumber: phone || null,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    status,
  };
}

export async function generateInlinePairingCode(opts: {
  companyId: number;
  whatsappId: number;
  phoneNumber: string;
  forceRestart?: boolean;
  expiresInMs?: number;
}): Promise<{ pairingCode: string; pairingExpiresAt: string; pairingPhoneNumber: string }> {
  const companyId = Number(opts.companyId || 0);
  const whatsappId = Number(opts.whatsappId || 0);
  const phoneNumber = normalizePairingPhoneNumber(opts.phoneNumber);
  const phoneCandidates = pairingPhoneCandidates(opts.phoneNumber);
  if (!companyId || !whatsappId) {
    throw new Error("missing companyId/whatsappId");
  }
  if (
    !phoneNumber ||
    !phoneNumber.startsWith("55") ||
    (phoneNumber.length !== 12 && phoneNumber.length !== 13)
  ) {
    throw new Error("invalid phoneNumber");
  }

  const expiresInMs = Math.max(60_000, Math.min(Number(opts.expiresInMs || 180_000), 600_000));
  inlinePairingKeepAliveAttempts.set(whatsappId, 0);
  const forceRestart = opts.forceRestart !== false;
  tracePairing(whatsappId, "generate:start", { phoneNumber, phoneCandidates, forceRestart, expiresInMs });

  if (forceRestart) {
    // Hard reset once before generating a new pairing code to avoid stale auth state.
    await disconnectInlineSession({ companyId, whatsappId, removeAuth: true });
    await sleep(300);
  }

  // Ensure we start from a fresh auth state when requesting pairing code.
  let pairingCode = "";
  let phoneUsed = phoneNumber;
  let lastErr: any = null;
  // Try informed number first, then BR fallback variant (com/sem 9) when applicable.
  const candidates = phoneCandidates.length ? phoneCandidates : [phoneNumber];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      tracePairing(whatsappId, "generate:attempt:start", { attempt });
      // First try wipes auth; retries keep auth state and only refresh transport.
      await startOrRefreshInlineSession({
        companyId,
        whatsappId,
        forceNewQr: attempt === 1
      });
      const connState = await waitForConnectionState(whatsappId, ["connecting", "open"], 10_000);
      tracePairing(whatsappId, "generate:attempt:connection-state", { attempt, connState });
      await sleep(900 + 350 * attempt);
      const sock = await waitForInlineSock(whatsappId, 10_000);
      if (!sock) throw new Error("session socket unavailable");
      const wsState = Number((sock as any)?.ws?.readyState);
      if (Number.isFinite(wsState) && wsState !== 1) {
        throw new Error(`session socket not ready (${wsState})`);
      }
      tracePairing(whatsappId, "generate:attempt:socket-ready", { attempt, wsState });
      if (typeof sock.requestPairingCode !== "function") {
        throw new Error("baileys requestPairingCode not available");
      }

      const registered = Boolean((sock as any)?.authState?.creds?.registered);
      if (registered) {
        throw new Error("session already connected");
      }

      let generated = "";
      let used = "";
      let candidateErr: any = null;
      for (const candidate of candidates) {
        try {
          tracePairing(whatsappId, "generate:attempt:request-code", { attempt, candidate });
          const pairingCodeRaw = await sock.requestPairingCode(candidate);
          generated = String(pairingCodeRaw || "").trim();
          if (generated) {
            used = candidate;
            tracePairing(whatsappId, "generate:attempt:code-generated", { attempt, candidate, codeLen: generated.length });
            break;
          }
        } catch (err) {
          candidateErr = err;
          tracePairing(whatsappId, "generate:attempt:request-code-error", {
            attempt,
            candidate,
            error: String((err as any)?.message || err || "")
          });
        }
      }
      pairingCode = generated;
      if (!pairingCode) {
        throw (candidateErr || new Error("failed to generate pairing code"));
      }
      phoneUsed = used || phoneNumber;
      lastErr = null;
      break;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || "");
      tracePairing(whatsappId, "generate:attempt:failed", { attempt, error: msg });
      const retryable =
        /connection closed|not connected|timed out|stream errored|connection lost|socket unavailable|socket not ready/i.test(msg);
      if (!retryable || attempt === 3) break;
      await sleep(700 * Math.pow(2, attempt - 1));
    }
  }
  if (!pairingCode) {
    throw (lastErr || new Error("failed to generate pairing code"));
  }
  const pairingExpiresAt = new Date(Date.now() + expiresInMs).toISOString();
  tracePairing(whatsappId, "generate:success", { pairingExpiresAt });

  saveSessionSnapshot(companyId, whatsappId, {
    status: "pairing",
    qrcode: "",
    pairingCode,
    pairingExpiresAt,
    pairingPhoneNumber: phoneUsed,
  } as any);
  void updateWhatsAppStatus(companyId, whatsappId, "pairing");

  return { pairingCode, pairingExpiresAt, pairingPhoneNumber: phoneUsed };
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
  const fetchLatestBaileysVersion = baileysMod?.fetchLatestBaileysVersion;
  const Browsers = baileysMod?.Browsers;

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
  await safeStopSession({
    companyId,
    whatsappId,
    removeAuth: Boolean(forceNewQr),
    closeDelayMs: forceNewQr ? 2000 : 900
  });

  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  if (!state || !state.creds || !state.keys) {
    throw new Error("Auth state inválido: state/creds/keys ausente");
  }

  saveSessionSnapshot(companyId, whatsappId, { status: "OPENING", qrcode: "", retries: 0 });
  void updateWhatsAppStatus(companyId, whatsappId, "OPENING");

  // Keep protocol/browser aligned with latest WA Web to avoid connection failures
  // on stale default versions (e.g. immediate close with code 405).
  let waVersion: number[] | undefined;
  try {
    if (typeof fetchLatestBaileysVersion === "function") {
      const latest = await fetchLatestBaileysVersion();
      if (Array.isArray(latest?.version)) waVersion = latest.version;
    }
  } catch {}

  // Critical: use the SAME minimal config shape we proved works on this VPS.
  const sock = makeWASocket({
    printQRInTerminal: false,
    auth: state,
    logger,
    msgRetryCounterCache,
    ...(waVersion ? { version: waVersion } : {}),
    ...(Browsers?.macOS ? { browser: Browsers.macOS("Desktop") } : {}),
    connectTimeoutMs: 60_000,
  });
  inlineSessions.set(whatsappId, sock);
  inlineConnectionState.set(whatsappId, "connecting");

  if (typeof saveCreds === "function") {
    const safeSaveCreds = async () => {
      try {
        fs.mkdirSync(authPath, { recursive: true });
      } catch {}
      try {
        await saveCreds();
      } catch {}
    };
    sock.ev.on("creds.update", safeSaveCreds);
  }

  sock.ev.on("messages.upsert", async (upsert: any) => {
    try {
      const msgs = Array.isArray(upsert?.messages) ? upsert.messages : [];
      for (const m of msgs) {
        await ingestBaileysMessage({ companyId, whatsappId, msg: m, sock });
      }
    } catch {}
  });

  sock.ev.on("connection.update", (u: any) => {
    const connection = u?.connection;
    const qr = u?.qr;
    const statusCode = u?.lastDisconnect?.error?.output?.statusCode;
    const disconnectMessage = u?.lastDisconnect?.error?.message || u?.lastDisconnect?.error?.toString?.();

    if (connection) {
      inlineConnectionState.set(whatsappId, String(connection));
      tracePairing(whatsappId, "connection:update", {
        connection: String(connection),
        statusCode: Number.isFinite(Number(statusCode)) ? Number(statusCode) : null,
        hasQr: Boolean(qr)
      });
    }

    if (qr) {
      const prev = readRealSessions()[String(whatsappId)] || ({} as any);
      const retries = (typeof prev.retries === "number" ? prev.retries : 0) + 1;
      const pairingActive = isPairingStillActive(prev);
      saveSessionSnapshot(companyId, whatsappId, {
        // While pairing code is active, keep session in pairing mode and avoid flipping UI to QR.
        status: pairingActive ? "pairing" : "qrcode",
        qrcode: pairingActive ? "" : String(qr),
        retries,
        lastConnection: connection || ""
      });
      void updateWhatsAppStatus(companyId, whatsappId, pairingActive ? "pairing" : "qrcode");
    }

    if (connection === "open") {
      saveSessionSnapshot(companyId, whatsappId, {
        status: "CONNECTED",
        qrcode: "",
        pairingCode: null,
        pairingExpiresAt: null,
        pairingPhoneNumber: null,
        lastConnection: "open",
        lastDisconnectStatusCode: null,
        lastDisconnectMessage: null
      });
      inlineRestartAttempts.delete(whatsappId);
      inlinePairingKeepAliveAttempts.delete(whatsappId);
      inlineConnectionState.set(whatsappId, "open");
      void updateWhatsAppStatus(companyId, whatsappId, "CONNECTED");
      try {
        void pgQuery(
          `UPDATE "Whatsapps"
           SET "pairingCode" = NULL, "pairingExpiresAt" = NULL, "updatedAt" = NOW()
           WHERE id = $1 AND "companyId" = $2`,
          [whatsappId, companyId]
        ).catch(() => {});
      } catch {}
      try {
        const io = getIO();
        io.emit(`company-${companyId}-whatsapp`, { event: "whatsapp:connected", whatsappId });
      } catch {}
    }

    if (connection === "close") {
      inlineConnectionState.set(whatsappId, "close");
      const shouldLogout = Boolean(DisconnectReason) && statusCode === DisconnectReason.loggedOut;
      const prev = readRealSessions()[String(whatsappId)] || ({} as any);
      const pairingActive = isPairingStillActive(prev);

      // During phone-number pairing flow, 401 can happen transiently before final link.
      // Keep the same pairing context until expiration; avoid restart loops.
      if (shouldLogout && pairingActive) {
        saveSessionSnapshot(companyId, whatsappId, {
          status: "pairing",
          qrcode: "",
          pairingCode: prev?.pairingCode || null,
          pairingExpiresAt: prev?.pairingExpiresAt || null,
          pairingPhoneNumber: prev?.pairingPhoneNumber || null,
          lastConnection: "close",
          lastDisconnectStatusCode: statusCode ?? null,
          lastDisconnectMessage: disconnectMessage ? String(disconnectMessage).slice(0, 500) : null
        } as any);
        void updateWhatsAppStatus(companyId, whatsappId, "pairing");
        return;
      }

      if (shouldLogout) {
        try {
          const existing = inlineSessions.get(whatsappId);
          existing?.ws?.close?.();
        } catch {}
        inlineSessions.delete(whatsappId);
        setTimeout(() => {
          try {
            fs.rmSync(authPath, { recursive: true, force: true });
          } catch {}
        }, 160);
        try {
          fs.mkdirSync(authPath, { recursive: true });
        } catch {}
        saveSessionSnapshot(companyId, whatsappId, {
          status: "DISCONNECTED",
          qrcode: "",
          pairingCode: null,
          pairingExpiresAt: null,
          pairingPhoneNumber: null,
          lastConnection: "close",
          lastDisconnectStatusCode: statusCode ?? null,
          lastDisconnectMessage: disconnectMessage ? String(disconnectMessage).slice(0, 500) : null
        });
        void updateWhatsAppStatus(companyId, whatsappId, "DISCONNECTED");
        try {
          void pgQuery(
            `UPDATE "Whatsapps"
             SET "pairingCode" = NULL, "pairingExpiresAt" = NULL, "updatedAt" = NOW()
             WHERE id = $1 AND "companyId" = $2`,
            [whatsappId, companyId]
          ).catch(() => {});
        } catch {}
        try {
          const io = getIO();
          io.emit(`company-${companyId}-whatsapp`, { event: "whatsapp:disconnected", whatsappId });
        } catch {}
        return;
      }

      saveSessionSnapshot(companyId, whatsappId, {
        status: "DISCONNECTED",
        qrcode: prev?.qrcode || "",
        lastConnection: "close",
        lastDisconnectStatusCode: statusCode ?? null,
        lastDisconnectMessage: disconnectMessage ? String(disconnectMessage).slice(0, 500) : null
      });
      void updateWhatsAppStatus(companyId, whatsappId, "DISCONNECTED");
      try {
        void pgQuery(
          `UPDATE "Whatsapps"
           SET "pairingCode" = NULL, "pairingExpiresAt" = NULL, "updatedAt" = NOW()
           WHERE id = $1 AND "companyId" = $2`,
          [whatsappId, companyId]
        ).catch(() => {});
      } catch {}
      try {
        const io = getIO();
        io.emit(`company-${companyId}-whatsapp`, { event: "whatsapp:disconnected", whatsappId });
      } catch {}

      // Restart required / transient stream errors
      // 428 ("Connection Terminated") is common during pairing and should auto-recover.
      if (
        Number(statusCode) === 515 ||
        Number(statusCode) === 503 ||
        Number(statusCode) === 440 ||
        Number(statusCode) === 428 ||
        Number(statusCode) === 408
      ) {
        if (pairingActive) {
          // Do not auto-restart while pairing is active.
          // A new start is only triggered by explicit new pairing code request.
          return;
        }
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

export async function startWhatsAppSession(companyId: number, whatsappId: number) {
  await startOrRefreshInlineSession({ companyId, whatsappId, forceNewQr: false });
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


