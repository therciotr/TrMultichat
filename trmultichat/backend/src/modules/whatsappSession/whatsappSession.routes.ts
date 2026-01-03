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

function emitSessionUpdate(tenantId: number, session: any) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const socketLib = require("../../libs/socket");
    const getIO = socketLib.getIO || socketLib.default || socketLib;
    const io = getIO();
    io.emit(`company-${tenantId}-whatsappSession`, { action: "update", session });
  } catch {}
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
  const id = Number(req.params.id);
  // Prefer real Baileys session snapshot (if any)
  const sess = getStoredQr(id) || (readSessions()[String(id)] || {});
  return res.json({
    id,
    status: sess.status || (sess.qrcode ? "qrcode" : "DISCONNECTED"),
    qrcode: sess.qrcode || "",
    updatedAt: sess.updatedAt || new Date().toISOString(),
    retries: typeof sess.retries === "number" ? sess.retries : 0
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

router.post("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  if (!tenantId) return res.status(401).json({ error: true, message: "missing tenantId" });

  // Start real Baileys session (QR válido)
  try {
    await startOrRefreshBaileysSession({
      companyId: tenantId,
      whatsappId: id,
      forceNewQr: true,
      emit: (companyId, payload) => {
        try {
          const io = getIO();
          io.emit(`company-${companyId}-whatsappSession`, payload);
        } catch {}
      }
    });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || "failed to start session" });
  }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  if (!tenantId) return res.status(401).json({ error: true, message: "missing tenantId" });

  // Refresh QR (Baileys)
  try {
    await startOrRefreshBaileysSession({
      companyId: tenantId,
      whatsappId: id,
      forceNewQr: true,
      emit: (companyId, payload) => {
        try {
          const io = getIO();
          io.emit(`company-${companyId}-whatsappSession`, payload);
        } catch {}
      }
    });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || "failed to refresh session" });
  }
});

export default router;




