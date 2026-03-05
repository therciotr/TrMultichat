import { Router } from "express";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { getIO } from "../../libs/socket";
import { getStoredQr } from "../../libs/baileysManager";
import {
  disconnectInlineSession,
  generateInlinePairingCode,
  getInlinePairingStatus,
  getInlineSock,
  getInlineSnapshot,
  startOrRefreshInlineSession
} from "../../libs/waInlineManager";
import { pgQuery } from "../../utils/pgClient";

const router = Router();

const PUBLIC_DIR = path.join(process.cwd(), "public");
const SESS_FILE = path.join(PUBLIC_DIR, "dev-whatsapp-sessions.json");
const ERR_LOG_FILE = path.join(PUBLIC_DIR, "whatsappsession-errors.log");

// Legacy snapshot file kept for backward compatibility only.
const REAL_SESS_FILE = path.join(PUBLIC_DIR, "whatsapp-sessions-v2.json");
const REAL_AUTH_DIR = path.join(PUBLIC_DIR, "baileys");

async function updateWhatsAppStatus(companyId: number, whatsappId: number, status: string) {
  try {
    await pgQuery(
      `UPDATE "Whatsapps" SET status = $1, "updatedAt" = NOW() WHERE id = $2 AND "companyId" = $3`,
      [status, whatsappId, companyId]
    );
  } catch {
    // do not crash session flow if DB is unavailable
  }
}

let pairingColumnsEnsured = false;
async function ensurePairingColumns() {
  if (pairingColumnsEnsured) return;
  try {
    await pgQuery(`ALTER TABLE "Whatsapps" ADD COLUMN IF NOT EXISTS "pairingCode" varchar(255)`, []);
  } catch {}
  try {
    await pgQuery(`ALTER TABLE "Whatsapps" ADD COLUMN IF NOT EXISTS "pairingExpiresAt" timestamptz`, []);
  } catch {}
  pairingColumnsEnsured = true;
}

async function updateWhatsAppPairingInfo(
  companyId: number,
  whatsappId: number,
  patch: { pairingCode?: string | null; pairingExpiresAt?: string | null; status?: string | null }
) {
  await ensurePairingColumns();
  try {
    await pgQuery(
      `
      UPDATE "Whatsapps"
      SET
        "pairingCode" = COALESCE($1, "pairingCode"),
        "pairingExpiresAt" = COALESCE($2::timestamptz, "pairingExpiresAt"),
        status = COALESCE($3, status),
        "updatedAt" = NOW()
      WHERE id = $4 AND "companyId" = $5
      `,
      [patch.pairingCode ?? null, patch.pairingExpiresAt ?? null, patch.status ?? null, whatsappId, companyId]
    );
  } catch {}
}

function normalizePairingPhoneNumber(raw: any): string {
  const digits = String(raw || "").replace(/\D+/g, "");
  if (!digits) return "";
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  if (!withCountry.startsWith("55")) return "";
  if (withCountry.length >= 13) return `55${withCountry.slice(-11)}`;
  if (withCountry.length === 12) return withCountry;
  return "";
}

function formatPairingPhonePreview(normalized: string): string {
  const d = String(normalized || "").replace(/\D+/g, "");
  if (!d.startsWith("55") || (d.length !== 12 && d.length !== 13)) return d;
  const local = d.slice(2);
  const ddd = local.slice(0, 2);
  const rest = local.slice(2);
  if (rest.length === 9) {
    return `+55 ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return `+55 ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

function emitWhatsAppPairingEvent(companyId: number, event: string, payload: any) {
  try {
    const io = getIO();
    io.emit(`company-${companyId}-whatsapp`, {
      event,
      ...payload,
    });
  } catch {}
}

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

// NOTE: previously we had an "inline Baileys starter" here.
// It was removed to avoid running multiple sockets for the same WhatsApp (causes conflicts/device_removed)
// and to centralize message ingestion in `baileysManager`.

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
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);

  // If the UI is loading and we have auth creds, ensure the real session is running in memory.
  // (Without a running socket, messages won't arrive.)
  try {
    if (tenantId && id && !getInlineSock(id)) {
      const authDir = path.join(REAL_AUTH_DIR, String(tenantId), String(id));
      const hasAuthCreds = fs.existsSync(path.join(authDir, "creds.json"));
      if (hasAuthCreds) {
        startOrRefreshInlineSession({ companyId: tenantId, whatsappId: id, forceNewQr: false }).catch(() => {});
      }
    }
  } catch {}

  // Inline manager snapshot is the authoritative one.
  const stored = getStoredQr(id);
  const sess = getInlineSnapshot(id) || stored || (readSessions()[String(id)] || {});
  const statusRaw = String(sess.status || "").toUpperCase();
  const hasQr = Boolean((sess as any).qrcode);
  const normalizedStatus =
    (statusRaw === "OPENING" || statusRaw === "DISCONNECTED") && hasQr
      ? "qrcode"
      : (sess.status || (hasQr ? "qrcode" : "DISCONNECTED"));
  return res.json({
    id,
    status: normalizedStatus,
    qrcode: sess.qrcode || "",
    updatedAt: sess.updatedAt || new Date().toISOString(),
    retries: typeof sess.retries === "number" ? sess.retries : 0,
    lastConnection: sess.lastConnection || "",
    lastDisconnectStatusCode: typeof sess.lastDisconnectStatusCode === "number" ? sess.lastDisconnectStatusCode : sess.lastDisconnectStatusCode ?? null,
    lastDisconnectMessage: sess.lastDisconnectMessage || null,
    restartAttempts: typeof (sess as any).restartAttempts === "number" ? (sess as any).restartAttempts : 0
  });
});

router.post("/:id/pairing-code", async (req, res) => {
  const id = Number(req.params.id);
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  if (!tenantId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const phoneNumber = normalizePairingPhoneNumber(req.body?.phoneNumber);
  if (
    !phoneNumber ||
    !phoneNumber.startsWith("55") ||
    (phoneNumber.length !== 12 && phoneNumber.length !== 13)
  ) {
    return res.status(400).json({
      error: true,
      message: "invalid phoneNumber. Use DDI 55 + DDD + numero (com ou sem 9). Ex.: +55 82 98133-0112"
    });
  }

  try {
    const pair = await generateInlinePairingCode({
      companyId: tenantId,
      whatsappId: id,
      phoneNumber,
      forceRestart: true,
      expiresInMs: 180_000
    });

    await updateWhatsAppPairingInfo(tenantId, id, {
      pairingCode: pair.pairingCode,
      pairingExpiresAt: pair.pairingExpiresAt,
      status: "pairing"
    });

    emitWhatsAppPairingEvent(tenantId, "whatsapp:pairing", {
      whatsappId: id,
      status: "pairing",
      pairingCode: pair.pairingCode,
      pairingExpiresAt: pair.pairingExpiresAt,
      phoneNumber: pair.pairingPhoneNumber
    });

    return res.json({
      whatsappId: id,
      status: "pairing",
      pairingCode: pair.pairingCode,
      pairingExpiresAt: pair.pairingExpiresAt,
      phoneNumber: pair.pairingPhoneNumber,
      phonePreview: formatPairingPhonePreview(pair.pairingPhoneNumber)
    });
  } catch (e: any) {
    logWhatsappSessionError(req, e, { action: "post_pairing_code" });
    const msg = String(e?.message || "failed to generate pairing code");
    if (/already connected/i.test(msg)) {
      return res.status(422).json({
        error: true,
        message: "session still connected. disconnect and try again",
        details: msg
      });
    }
    return res.status(422).json({ error: true, message: msg });
  }
});

router.get("/:id/pairing-status", async (req, res) => {
  const id = Number(req.params.id);
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  if (!tenantId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const snap = getInlineSnapshot(id) || getStoredQr(id) || {};
  const status = String((snap as any)?.status || "DISCONNECTED");
  const pairing = getInlinePairingStatus(id);

  // fallback from DB (useful after backend restart)
  let dbPairingCode: string | null = null;
  let dbPairingExpiresAt: string | null = null;
  try {
    await ensurePairingColumns();
    const rows = await pgQuery<{ pairingCode: string | null; pairingExpiresAt: string | null; status: string | null }>(
      `SELECT "pairingCode" as "pairingCode", "pairingExpiresAt"::text as "pairingExpiresAt", status
       FROM "Whatsapps" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
      [id, tenantId]
    );
    dbPairingCode = rows?.[0]?.pairingCode || null;
    dbPairingExpiresAt = rows?.[0]?.pairingExpiresAt || null;
  } catch {}

  const code = pairing.pairingCode || dbPairingCode;
  const expiresAt = pairing.pairingExpiresAt || dbPairingExpiresAt;
  const expMs = expiresAt ? Date.parse(expiresAt) : NaN;
  const remainingSeconds = Number.isFinite(expMs) ? Math.max(0, Math.ceil((expMs - Date.now()) / 1000)) : 0;
  const awaitingPairing =
    String(status).toUpperCase() !== "CONNECTED" &&
    Boolean(code) &&
    remainingSeconds > 0;

  if (!awaitingPairing && code && String(status).toUpperCase() === "PAIRING") {
    try {
      await ensurePairingColumns();
      await pgQuery(
        `UPDATE "Whatsapps"
         SET "pairingCode" = NULL, "pairingExpiresAt" = NULL, "updatedAt" = NOW()
         WHERE id = $1 AND "companyId" = $2`,
        [id, tenantId]
      );
    } catch {}
  }

  return res.json({
    whatsappId: id,
    status,
    awaitingPairing,
    pairingCode: code || null,
    pairingExpiresAt: expiresAt || null,
    remainingSeconds,
  });
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  if (!tenantId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  try {
    // Primary path: disconnect inline Baileys session and wipe auth to force fresh login.
    await disconnectInlineSession({
      companyId: tenantId,
      whatsappId: id,
      removeAuth: true
    });

    // Keep DB metadata coherent for UI after disconnect.
    try {
      await ensurePairingColumns();
      await pgQuery(
        `UPDATE "Whatsapps"
         SET
           status = 'DISCONNECTED',
           "pairingCode" = NULL,
           "pairingExpiresAt" = NULL,
           "updatedAt" = NOW()
         WHERE id = $1 AND "companyId" = $2`,
        [id, tenantId]
      );
    } catch {
      await updateWhatsAppStatus(tenantId, id, "DISCONNECTED");
    }

    const session = {
      id,
      status: "DISCONNECTED",
      qrcode: "",
      updatedAt: new Date().toISOString(),
      retries: 0,
      restartAttempts: 0
    };
    emitSessionUpdate(tenantId, session);
    emitWhatsAppPairingEvent(tenantId, "whatsapp:disconnected", { whatsappId: id });
    return res.status(200).json({ ok: true, id, status: "DISCONNECTED" });
  } catch (e: any) {
    logWhatsappSessionError(req, e, { action: "delete_disconnect_session" });

    // Fallback: legacy controller remove flow.
    try {
      const handled = tryRunLegacyWhatsAppSessionController("remove", req, res);
      if (handled) return;
    } catch {}

    return res.status(422).json({
      error: true,
      message: "could not disconnect session",
      details: e?.message || "unknown error"
    });
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
  const forceRestart =
    String((req.query as any)?.forceRestart || (req.query as any)?.force || "")
      .trim()
      .toLowerCase() === "1" ||
    String((req.query as any)?.forceRestart || (req.query as any)?.force || "")
      .trim()
      .toLowerCase() === "true";
  const forceNewQrRequested =
    String((req.query as any)?.forceNewQr || (req.query as any)?.newQr || "")
      .trim()
      .toLowerCase() === "1" ||
    String((req.query as any)?.forceNewQr || (req.query as any)?.newQr || "")
      .trim()
      .toLowerCase() === "true";

  // Refresh QR (Baileys)
  try {
    setNoCache(res);
    // IMPORTANT:
    // - Frontend may call PUT on page refresh (to "ensure session"), so PUT cannot always wipe auth.
    // - Only force new QR if there is no saved auth (creds.json) OR the last disconnect was loggedOut (401).
    const authDir = path.join(REAL_AUTH_DIR, String(tenantId), String(id));
    const hasAuthCreds = fs.existsSync(path.join(authDir, "creds.json"));

    const snap: any = getInlineSnapshot(id) || {};
    const lastDiscCode = Number(snap?.lastDisconnectStatusCode || 0);
    const snapStatus = String(snap?.status || "");

    // Also check DB status so refresh won't "think" it's disconnected.
    let dbStatus = "";
    try {
      const rows = await pgQuery<{ status: string }>(
        `SELECT status FROM "Whatsapps" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
        [id, tenantId]
      );
      dbStatus = String(rows?.[0]?.status || "");
    } catch {
      dbStatus = "";
    }

    const isConnected = snapStatus === "CONNECTED" || dbStatus === "CONNECTED";
    // 401 (logged out) or 440 (conflict) require generating a new QR to recover quickly.
    const shouldForceNewQr = !hasAuthCreds || lastDiscCode === 401 || lastDiscCode === 440;

    // If already connected and we have auth, do NOT force a new QR.
    // Also avoid restarting a running in-memory socket on regular refresh.
    // But allow explicit forced restart (useful when session is "connected" but not receiving messages).
    const hasRunningSocket = Boolean(getInlineSock(id));
    if (!forceRestart && !forceNewQrRequested && isConnected && hasAuthCreds && hasRunningSocket) {
      const sessNow: any = getInlineSnapshot(id) || snap || {};
      return res.json({
        id,
        status: sessNow?.status || "CONNECTED",
        qrcode: sessNow?.qrcode || "",
        updatedAt: sessNow?.updatedAt || new Date().toISOString(),
        retries: typeof sessNow?.retries === "number" ? sessNow.retries : 0
      });
    }

    // Start / refresh the inline manager (this one ingests incoming messages).
    await startOrRefreshInlineSession({
      companyId: tenantId,
      whatsappId: id,
      // On explicit QR refresh, always drop creds to force a brand-new QR.
      // On forced restart, keep auth when possible (unless forceNewQr was requested).
      forceNewQr: forceNewQrRequested ? true : (forceRestart ? false : shouldForceNewQr)
    });

    const stored = getStoredQr(id);
    const sess: any = getInlineSnapshot(id) || stored || {};
    const statusRaw = String(sess?.status || "").toUpperCase();
    const hasQr = Boolean(sess?.qrcode);
    const normalizedStatus =
      (statusRaw === "OPENING" || statusRaw === "DISCONNECTED") && hasQr
        ? "qrcode"
        : (sess?.status || (hasQr ? "qrcode" : "OPENING"));
    return res.json({
      id,
      status: normalizedStatus,
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




