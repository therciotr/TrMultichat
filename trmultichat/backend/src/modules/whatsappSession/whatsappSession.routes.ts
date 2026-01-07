import { Router } from "express";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { getIO } from "../../libs/socket";
import { getStoredQr, startOrRefreshBaileysSession } from "../../libs/baileysManager";

const router = Router();

const PUBLIC_DIR = path.join(process.cwd(), "public");
const SESS_FILE = path.join(PUBLIC_DIR, "dev-whatsapp-sessions.json");
const ERR_LOG_FILE = path.join(PUBLIC_DIR, "whatsappsession-errors.log");

// Inline Baileys starter (workaround): on this VPS build, importing Baileys inside baileysManager has been flaky.
// This implementation mirrors the known-working "manual" makeWASocket flow.
// Important: do NOT reuse "whatsapp-sessions.json" because other legacy flows may overwrite it.
const REAL_SESS_FILE = path.join(PUBLIC_DIR, "whatsapp-sessions-v2.json");
const REAL_AUTH_DIR = path.join(PUBLIC_DIR, "baileys");
const inlineSessions = new Map<number, any>();

function readRealSessions(): Record<string, any> {
  try {
    ensurePublicDir();
    if (!fs.existsSync(REAL_SESS_FILE)) return {};
    return JSON.parse(fs.readFileSync(REAL_SESS_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

function writeRealSessions(obj: Record<string, any>) {
  try {
    ensurePublicDir();
    fs.writeFileSync(REAL_SESS_FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch {}
}

function setNoCache(res: any) {
  // Avoid 304/ETag caching on polling endpoints (QR changes quickly)
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  // Force a new ETag so clients won't get 304 based on If-None-Match
  res.setHeader("ETag", `W/\"${Date.now()}\"`);
}

function saveSessionSnapshot(companyId: number, whatsappId: number, patch: Partial<any>) {
  const all = readRealSessions();
  const prev = all[String(whatsappId)] || {};
  const next = {
    ...prev,
    ...patch,
    id: whatsappId,
    status: patch?.status ?? prev.status ?? "OPENING",
    qrcode: patch?.qrcode ?? prev.qrcode ?? "",
    retries: typeof (patch as any)?.retries === "number" ? (patch as any).retries : typeof prev.retries === "number" ? prev.retries : 0,
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

async function startBaileysInline(opts: { companyId: number; whatsappId: number; forceNewQr?: boolean }) {
  const { companyId, whatsappId, forceNewQr } = opts;
  // Baileys is ESM in production; TypeScript (CommonJS output) rewrites `import()` into `require()`.
  // Use a native dynamic import via Function to avoid TS downleveling.
  // eslint-disable-next-line no-new-func
  const baileysMod: any = await (new Function('return import("@whiskeysockets/baileys")'))();
  const makeWASocket = baileysMod?.makeWASocket || baileysMod?.default;
  const useMultiFileAuthState = baileysMod?.useMultiFileAuthState;
  const makeCacheableSignalKeyStore = baileysMod?.makeCacheableSignalKeyStore;
  const DisconnectReason = baileysMod?.DisconnectReason;
  const fetchLatestBaileysVersion = baileysMod?.fetchLatestBaileysVersion;

  if (typeof makeWASocket !== "function" || typeof useMultiFileAuthState !== "function") {
    throw new Error("Baileys module exports missing (makeWASocket/useMultiFileAuthState)");
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const P = require("pino");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const NodeCache = require("node-cache");
  const logger = P({ level: "warn" });

  const authPath = path.join(REAL_AUTH_DIR, String(companyId), String(whatsappId));
  try {
    if (forceNewQr) fs.rmSync(authPath, { recursive: true, force: true });
  } catch {}
  try {
    fs.mkdirSync(authPath, { recursive: true });
  } catch {}

  // close existing
  try {
    const existing = inlineSessions.get(whatsappId);
    existing?.ws?.close?.();
  } catch {}
  inlineSessions.delete(whatsappId);

  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  if (!state || !state.creds || !state.keys) {
    throw new Error("Auth state inválido: state/creds/keys ausente");
  }
  const msgRetryCounterCache = new NodeCache();
  const wrapped = {
    creds: state.creds,
    keys: typeof makeCacheableSignalKeyStore === "function"
      ? makeCacheableSignalKeyStore(state.keys, logger)
      : state.keys
  };

  saveSessionSnapshot(companyId, whatsappId, { status: "OPENING", qrcode: "", retries: 0 });

  let version: any = undefined;
  try {
    if (typeof fetchLatestBaileysVersion === "function") {
      const v = await fetchLatestBaileysVersion();
      version = v?.version;
    }
  } catch {
    version = undefined;
  }

  const sock = makeWASocket({
    ...(version ? { version } : {}),
    logger,
    printQRInTerminal: false,
    msgRetryCounterCache,
    generateHighQualityLinkPreview: true,
    browser: ["TR Multichat", "Chrome", "1.0.0"],
    auth: wrapped
  });
  inlineSessions.set(whatsappId, sock);

  if (typeof saveCreds === "function") {
    sock.ev.on("creds.update", saveCreds);
  }

  sock.ev.on("connection.update", (u: any) => {
    const connection = u?.connection;
    const qr = u?.qr;
    const statusCode = u?.lastDisconnect?.error?.output?.statusCode;
    const disconnectMessage = u?.lastDisconnect?.error?.message || u?.lastDisconnect?.error?.toString?.();

    // Helpful server-side logs (no secrets)
    try {
      // eslint-disable-next-line no-console
      console.log("[wa] connection.update", {
        whatsappId,
        connection,
        hasQr: Boolean(qr),
        statusCode,
        disconnectMessage: disconnectMessage ? String(disconnectMessage).slice(0, 200) : undefined
      });
    } catch {}

    if (qr) {
      const prev = readRealSessions()[String(whatsappId)] || {};
      const retries = (typeof prev.retries === "number" ? prev.retries : 0) + 1;
      saveSessionSnapshot(companyId, whatsappId, {
        status: "qrcode",
        qrcode: String(qr),
        retries,
        lastConnection: connection || "",
        lastDisconnectStatusCode: null,
        lastDisconnectMessage: null
      });
    }
    if (connection === "open") {
      saveSessionSnapshot(companyId, whatsappId, {
        status: "CONNECTED",
        qrcode: "",
        lastConnection: "open",
        lastDisconnectStatusCode: null,
        lastDisconnectMessage: null
      });
    }
    if (connection === "close") {
      const shouldLogout = Boolean(DisconnectReason) && statusCode === DisconnectReason.loggedOut;
      if (shouldLogout) {
        try {
          fs.rmSync(authPath, { recursive: true, force: true });
        } catch {}
        // On logout, clear QR
        saveSessionSnapshot(companyId, whatsappId, {
          status: "DISCONNECTED",
          qrcode: "",
          lastConnection: "close",
          lastDisconnectStatusCode: statusCode ?? null,
          lastDisconnectMessage: disconnectMessage ? String(disconnectMessage).slice(0, 500) : null
        });
      } else {
        // Keep last QR snapshot so the UI can still show it (and/or request new QR)
        const prev = readRealSessions()[String(whatsappId)] || {};
        saveSessionSnapshot(companyId, whatsappId, {
          status: "DISCONNECTED",
          qrcode: prev?.qrcode || "",
          lastConnection: "close",
          lastDisconnectStatusCode: statusCode ?? null,
          lastDisconnectMessage: disconnectMessage ? String(disconnectMessage).slice(0, 500) : null
        });
      }
    }
  });
}

function ensurePublicDir() {
  try {
    if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR);
  } catch {}
}

function readSessions(): Record<string, any> {
  try {
    ensurePublicDir();
    if (!fs.existsSync(SESS_FILE)) return {};
    const txt = fs.readFileSync(SESS_FILE, "utf8");
    const obj = JSON.parse(txt);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function writeSessions(sessions: Record<string, any>) {
  try {
    ensurePublicDir();
    fs.writeFileSync(SESS_FILE, JSON.stringify(sessions, null, 2), "utf8");
  } catch {}
}

function extractTenantIdFromAuth(authorization?: string): number {
  try {
    const parts = (authorization || "").split(" ");
    const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (!bearer) return 0;
    const secrets = [env.JWT_SECRET, "mysecret"].filter(Boolean);
    for (const secret of secrets) {
      try {
        const payload = jwt.verify(bearer, secret) as { tenantId?: number; companyId?: number; exp?: number };
        const tenantId = Number((payload as any)?.tenantId || (payload as any)?.companyId || 0);
        if (tenantId) return tenantId;
      } catch (_) {}
    }
    const decoded: any = jwt.decode(bearer) || {};
    const exp = Number(decoded?.exp || 0);
    if (exp && Date.now() / 1000 > exp) return 0;
    return Number(decoded?.tenantId || decoded?.companyId || 0);
  } catch {
    return 0;
  }
}

function extractUserIdFromAuth(authorization?: string): number {
  try {
    const parts = (authorization || "").split(" ");
    const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (!bearer) return 0;
    const secrets = [env.JWT_SECRET, "mysecret"].filter(Boolean);
    for (const secret of secrets) {
      try {
        const payload = jwt.verify(bearer, secret) as { userId?: number; id?: number; exp?: number };
        const userId = Number((payload as any)?.userId || (payload as any)?.id || 0);
        if (userId) return userId;
      } catch (_) {}
    }
    const decoded: any = jwt.decode(bearer) || {};
    const exp = Number(decoded?.exp || 0);
    if (exp && Date.now() / 1000 > exp) return 0;
    return Number(decoded?.userId || decoded?.id || 0);
  } catch {
    return 0;
  }
}

function extractProfileFromAuth(authorization?: string): string {
  try {
    const parts = (authorization || "").split(" ");
    const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (!bearer) return "";
    const decoded: any = jwt.decode(bearer) || {};
    return String(decoded?.profile || "");
  } catch {
    return "";
  }
}

function emitSessionUpdate(tenantId: number, session: any) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const socketLib = require("../../libs/socket");
    const getIO = socketLib.getIO || socketLib.default || socketLib;
    const io = getIO();
    io.emit(`company-${tenantId}-whatsappSession`, { action: "update", session });
  } catch {}
}

function logWhatsappSessionError(req: any, err: any, extra?: Record<string, any>) {
  try {
    const tenantId = extractTenantIdFromAuth(req?.headers?.authorization as string);
    const userId = extractUserIdFromAuth(req?.headers?.authorization as string);
    // eslint-disable-next-line no-console
    console.error("[whatsappsession] error", {
      method: req?.method,
      url: req?.originalUrl,
      params: req?.params,
      tenantId,
      userId,
      message: err?.message,
      stack: err?.stack,
      ...extra
    });
  } catch {
    // ignore
  }
}

function appendErrorLogLine(line: string) {
  try {
    ensurePublicDir();
    fs.appendFileSync(ERR_LOG_FILE, line + "\n", "utf8");
  } catch {
    // ignore
  }
}

function tailFile(filePath: string, maxBytes = 20_000): string {
  try {
    if (!fs.existsSync(filePath)) return "";
    const stat = fs.statSync(filePath);
    const size = stat.size || 0;
    const start = Math.max(0, size - maxBytes);
    const fd = fs.openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      return buf.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return "";
  }
}

function requireLegacyController(moduleRelPath: string): any | null {
  const candidates = [
    path.resolve(process.cwd(), moduleRelPath),
    path.resolve(process.cwd(), "dist", moduleRelPath),
    // when running compiled JS, __dirname is usually `.../dist/modules/...`
    path.resolve(__dirname, "..", "..", moduleRelPath),
    path.resolve(__dirname, "..", "..", "..", "dist", moduleRelPath),
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

let legacyDbBooted = false;
function ensureLegacyDbBoot(): void {
  if (legacyDbBooted) return;
  try {
    // Initialize legacy Sequelize models (required by Baileys session services)
    requireLegacyController("database/index");
    legacyDbBooted = true;
  } catch {
    // ignore
  }
}

function tryRunLegacyWhatsAppSessionController(
  action: "store" | "update" | "remove",
  req: any,
  res: any
): boolean {
  try {
    // Load legacy controller (compiled) and call it directly (bypasses legacy isAuth token format).
    const ctrl = requireLegacyController("controllers/WhatsAppSessionController");
    const fn = ctrl && ctrl[action];
    if (typeof fn !== "function") return false;

    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
    const userId = extractUserIdFromAuth(req.headers.authorization as string);
    if (!tenantId || !userId) return false;

    // Legacy expects req.params.whatsappId and req.user.companyId
    req.params = { ...(req.params || {}), whatsappId: req.params?.id || req.params?.whatsappId };
    req.user = { id: userId, profile: "admin", companyId: tenantId };
    ensureLegacyDbBoot();
    // Call legacy controller (async) but don't await here; it will write to res.
    try {
      Promise.resolve(fn(req, res)).catch(() => {});
    } catch (e: any) {
      return res.status(500).json({
        error: true,
        message: e?.message || "legacy whatsapp session integration failed"
      });
    }
    return true;
  } catch {
    return false;
  }
}

// Endpoints para compatibilidade com UI em produção
router.get("/:id", (req, res) => {
  setNoCache(res);
  const id = Number(req.params.id);
  // Prefer real Baileys session snapshot (if any)
  const sess =
    readRealSessions()[String(id)] ||
    getStoredQr(id) ||
    (readSessions()[String(id)] || {});
  return res.json({
    id,
    status: sess.status || (sess.qrcode ? "qrcode" : "DISCONNECTED"),
    qrcode: sess.qrcode || "",
    updatedAt: sess.updatedAt || new Date().toISOString(),
    retries: typeof sess.retries === "number" ? sess.retries : 0,
    lastConnection: sess.lastConnection || "",
    lastDisconnectStatusCode: typeof sess.lastDisconnectStatusCode === "number" ? sess.lastDisconnectStatusCode : sess.lastDisconnectStatusCode ?? null,
    lastDisconnectMessage: sess.lastDisconnectMessage || null
  });
});

// Debug helper (admin only): inspect Baileys exports in production
router.get("/debug/baileys-exports", (req, res) => {
  if (String(process.env.ENABLE_DEBUG_ENDPOINTS || "").toLowerCase() !== "true") {
    return res.status(404).json({ error: true, message: "not found" });
  }
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  if (!tenantId) return res.status(401).json({ error: true, message: "missing tenantId" });
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const b = require("@whiskeysockets/baileys");
    const keys = Object.keys(b || {});
    const d = (b && (b.default || b)) || {};
    const defaultType = typeof d;
    const defaultKeys = (d && typeof d === "object") ? Object.keys(d) : [];
    return res.json({ keys, defaultType, defaultKeys });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || "failed" });
  }
});

// Debug helper (admin only): last whatsappsession errors
router.get("/debug/last-error", (req, res) => {
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  const userId = extractUserIdFromAuth(req.headers.authorization as string);
  const profile = extractProfileFromAuth(req.headers.authorization as string);
  if (!tenantId || !userId) return res.status(401).json({ error: true, message: "unauthorized" });
  if (String(profile).toLowerCase() !== "admin") return res.status(403).json({ error: true, message: "forbidden" });
  const tail = tailFile(ERR_LOG_FILE, 30_000);
  return res.json({ ok: true, tail });
});

router.post("/:id", async (req, res) => {
  // POST /whatsappsession/:id NÃO deve ser usado (frontend deve usar GET para consultar e PUT para gerar novo QR)
  return res.status(405).json({
    error: true,
    message: "Use GET /whatsappsession/:id para consultar e PUT /whatsappsession/:id para gerar novo QR"
  });
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  if (!tenantId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  // Refresh QR (Baileys)
  try {
    setNoCache(res);
    // Prefer inline starter (known-working manual flow)
    await startBaileysInline({ companyId: tenantId, whatsappId: id, forceNewQr: true });
    const sess = getStoredQr(id) || readRealSessions()[String(id)] || {};
    return res.json({
      id,
      status: sess?.status || "OPENING",
      qrcode: sess?.qrcode || "",
      updatedAt: sess?.updatedAt || new Date().toISOString(),
      retries: typeof sess?.retries === "number" ? sess.retries : 0
    });
  } catch (e: any) {
    logWhatsappSessionError(req, e, { action: "put_generate_qr" });
    const debugId = Date.now();
    appendErrorLogLine(
      JSON.stringify({
        ts: new Date().toISOString(),
        debugId,
        method: req?.method,
        url: req?.originalUrl,
        params: req?.params,
        tenantId,
        userId: extractUserIdFromAuth(req.headers.authorization as string),
        message: e?.message,
        stack: e?.stack
      })
    );

    // Fallback: try legacy WhatsAppSessionController update flow (older stacks generate QR correctly)
    // If it handles the response, we stop here.
    try {
      const handled = tryRunLegacyWhatsAppSessionController("update", req, res);
      if (handled) return;
    } catch {}

    const profile = extractProfileFromAuth(req.headers.authorization as string);
    const debugEnabled = String(process.env.ENABLE_DEBUG_ENDPOINTS || "").toLowerCase() === "true";
    const includeDebug = debugEnabled && String(profile).toLowerCase() === "admin";

    return res.status(422).json({
      error: true,
      message: "could not generate qrcode",
      details: e?.message || "unknown error",
      debugId,
      ...(includeDebug
        ? {
            // Helpful diagnostics for admins only (no creds content)
            stack: String(e?.stack || ""),
          }
        : {})
    });
  }
});

export default router;




