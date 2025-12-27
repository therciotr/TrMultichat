import { Router } from "express";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import env from "../../config/env";

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
    const payload = jwt.verify(bearer, env.JWT_SECRET) as { tenantId?: number };
    return Number(payload?.tenantId || 0);
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

// Endpoints para compatibilidade com UI em produção (gera QR dummy + persiste em arquivo)
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const sessions = readSessions();
  const sess = sessions[String(id)] || {};
  return res.json({
    id,
    status: sess.status || (sess.qrcode ? "qrcode" : "DISCONNECTED"),
    qrcode: sess.qrcode || "",
    updatedAt: sess.updatedAt || new Date().toISOString(),
    retries: typeof sess.retries === "number" ? sess.retries : 0
  });
});

router.post("/:id", (req, res) => {
  const id = Number(req.params.id);
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  if (!tenantId) return res.status(401).json({ error: true, message: "missing tenantId" });

  try {
    const qrcode = `WA-SESSION:${id}:${Date.now()}`;
    const sessions = readSessions();
    sessions[String(id)] = {
      id,
      status: "qrcode",
      qrcode,
      updatedAt: new Date().toISOString(),
      retries: 0
    };
    writeSessions(sessions);
    emitSessionUpdate(tenantId, sessions[String(id)]);
  } catch {}
  return res.json({ ok: true });
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  if (!tenantId) return res.status(401).json({ error: true, message: "missing tenantId" });

  try {
    const qrcode = `WA-SESSION:${id}:${Date.now()}`;
    const sessions = readSessions();
    const prevRetries = Number((sessions[String(id)] && sessions[String(id)].retries) || 0);
    sessions[String(id)] = {
      id,
      status: "qrcode",
      qrcode,
      updatedAt: new Date().toISOString(),
      retries: prevRetries + 1
    };
    writeSessions(sessions);
    emitSessionUpdate(tenantId, sessions[String(id)]);
  } catch {}
  return res.json({ ok: true });
});

export default router;




