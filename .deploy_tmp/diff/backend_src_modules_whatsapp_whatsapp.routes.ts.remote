import { Router } from "express";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { findAllSafe, findByPkSafe, getLegacyModel } from "../../utils/legacyModel";

const router = Router();

// DEV storage helpers
const PUBLIC_DIR = path.join(process.cwd(), "public");
const DEV_WHATS_FILE = path.join(PUBLIC_DIR, "dev-whatsapps.json");
const DEV_WHATS_SESS_FILE = path.join(PUBLIC_DIR, "dev-whatsapp-sessions.json");
function ensurePublicDir() {
  try { if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR); } catch (_) {}
}
function readDevWhats(): any[] {
  try {
    ensurePublicDir();
    if (fs.existsSync(DEV_WHATS_FILE)) {
      const txt = fs.readFileSync(DEV_WHATS_FILE, "utf8");
      const arr = JSON.parse(txt);
      return Array.isArray(arr) ? arr : [];
    }
  } catch (_) {}
  return [];
}
function writeDevWhats(list: any[]) {
  try {
    ensurePublicDir();
    fs.writeFileSync(DEV_WHATS_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch (_) {}
}
function readDevSessions(): Record<string, any> {
  try {
    ensurePublicDir();
    if (fs.existsSync(DEV_WHATS_SESS_FILE)) {
      const txt = fs.readFileSync(DEV_WHATS_SESS_FILE, "utf8");
      const obj = JSON.parse(txt);
      return obj && typeof obj === "object" ? obj : {};
    }
  } catch (_) {}
  return {};
}
function writeDevSessions(sessions: Record<string, any>) {
  try {
    ensurePublicDir();
    fs.writeFileSync(DEV_WHATS_SESS_FILE, JSON.stringify(sessions, null, 2), "utf8");
  } catch (_) {}
}
function extractTenantIdFromAuth(authorization?: string): number {
  try {
    const parts = (authorization || "").split(" ");
    const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (!bearer) return 1;
    const payload = jwt.verify(bearer, env.JWT_SECRET) as { tenantId?: number };
    return Number(payload?.tenantId || 1);
  } catch {
    return 1;
  }
}

router.get("/", async (req, res) => {
  const companyId = Number(req.query.companyId || 0);
  const session = Number(req.query.session || 0);
  // DEV: return from file
  if (String(process.env.DEV_MODE || "false").toLowerCase() === "true") {
    const list = readDevWhats();
    return res.json(list);
  }
  // Legacy: try to read from DB
  const listDb = await findAllSafe("Whatsapp", { where: companyId ? { companyId } : undefined, order: [["id", "ASC"]] });
  // session param is ignored in this minimal implementation
  return res.json(listDb);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (String(process.env.DEV_MODE || "false").toLowerCase() === "true") {
    const rec = readDevWhats().find((w) => Number(w.id) === id);
    const sessions = readDevSessions();
    const sess = sessions[String(id)] || {};
    // Fallback when record not found: still return minimal object with qrcode so polling works
    if (!rec) {
      return res.json({ id, name: `WhatsApp ${id}`, status: sess.qrcode ? "qrcode" : "DISCONNECTED", qrcode: sess.qrcode || "" });
    }
    return res.json({ ...rec, qrcode: sess.qrcode || "" });
  }
  const record = await findByPkSafe("Whatsapp", id);
  if (!record) return res.status(404).json({ error: true, message: "not found" });
  return res.json(record);
});

// Minimal DEV-friendly create/update to avoid 404 when legacy routes are unavailable
router.post("/", async (req, res) => {
  const isDev = String(process.env.DEV_MODE || "false").toLowerCase() === "true";
  const body = req.body || {};

  // DEV: file-based mock
  if (isDev) {
    const id = Math.floor(Math.random() * 100000) + 1;
    const queues = Array.isArray(body.queueIds)
      ? body.queueIds.map((qid: number) => ({ id: qid, name: `Fila ${qid}` }))
      : [];
    const record = { id, status: "DISCONNECTED", updatedAt: new Date().toISOString(), ...body, queues };
    const list = readDevWhats();
    list.push(record);
    writeDevWhats(list);
    try {
      // emit update so the list screen adds it
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const socketLib = require("../../libs/socket");
      const getIO = socketLib.getIO || socketLib.default || socketLib;
      const io = getIO();
      const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
      io.emit(`company-${tenantId}-whatsapp`, { action: "update", whatsapp: record });
    } catch {}
    return res.json(record);
  }

  // PROD: minimal DB-backed create (legacy model)
  try {
    const Whatsapp = getLegacyModel("Whatsapp");
    if (!Whatsapp || typeof Whatsapp.create !== "function") {
      return res.status(501).json({ error: true, message: "whatsapp create not available" });
    }
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string) || 1;
    const payload = {
      name: body.name || "",
      status: "DISCONNECTED",
      isDefault: Boolean(body.isDefault),
      greetingMessage: body.greetingMessage || "",
      complationMessage: body.complationMessage || "",
      outOfHoursMessage: body.outOfHoursMessage || "",
      ratingMessage: body.ratingMessage || "",
      token: body.token || "",
      provider: body.provider || "beta",
      timeSendQueue: Number(body.timeSendQueue || 0),
      sendIdQueue: Number(body.sendIdQueue || 0),
      expiresInactiveMessage: body.expiresInactiveMessage || "",
      expiresTicket: String(body.expiresTicket ?? ""),
      timeUseBotQueues: Number(body.timeUseBotQueues || 0),
      maxUseBotQueues: Number(body.maxUseBotQueues || 0),
      companyId: tenantId
    };
    const created = await Whatsapp.create(payload);
    const json = created?.toJSON ? created.toJSON() : created;
    return res.status(201).json(json);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "create error" });
  }
});

router.put("/:id", async (req, res) => {
  const isDev = String(process.env.DEV_MODE || "false").toLowerCase() === "true";
  const id = Number(req.params.id);
  const body = req.body || {};

  if (isDev) {
    const queues = Array.isArray(body.queueIds)
      ? body.queueIds.map((qid: number) => ({ id: qid, name: `Fila ${qid}` }))
      : [];
    const list = readDevWhats();
    const idx = list.findIndex((w) => Number(w.id) === id);
    const updated = { id, ...list[idx], ...body, queues, updatedAt: new Date().toISOString() };
    if (idx >= 0) list[idx] = updated; else list.push(updated);
    writeDevWhats(list);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const socketLib = require("../../libs/socket");
      const getIO = socketLib.getIO || socketLib.default || socketLib;
      const io = getIO();
      const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
      io.emit(`company-${tenantId}-whatsapp`, { action: "update", whatsapp: updated });
    } catch {}
    return res.json(updated);
  }

  try {
    const Whatsapp = getLegacyModel("Whatsapp");
    if (!Whatsapp || typeof Whatsapp.findByPk !== "function") {
      return res.status(501).json({ error: true, message: "whatsapp update not available" });
    }
    const instance = await Whatsapp.findByPk(id);
    if (!instance) return res.status(404).json({ error: true, message: "not found" });
    const up = {
      name: body.name,
      greetingMessage: body.greetingMessage,
      complationMessage: body.complationMessage,
      outOfHoursMessage: body.outOfHoursMessage,
      ratingMessage: body.ratingMessage,
      token: body.token,
      provider: body.provider,
      timeSendQueue: body.timeSendQueue,
      sendIdQueue: body.sendIdQueue,
      expiresInactiveMessage: body.expiresInactiveMessage,
      expiresTicket: body.expiresTicket,
      timeUseBotQueues: body.timeUseBotQueues,
      maxUseBotQueues: body.maxUseBotQueues
    };
    await instance.update(up);
    const json = instance?.toJSON ? instance.toJSON() : instance;
    return res.json(json);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "update error" });
  }
});

router.delete("/:id", async (req, res) => {
  const isDev = String(process.env.DEV_MODE || "false").toLowerCase() === "true";
  const id = Number(req.params.id);

  if (isDev) {
    const list = readDevWhats();
    const idx = list.findIndex((w) => Number(w.id) === id);
    if (idx === -1) return res.status(404).json({ error: true, message: "not found" });
    list.splice(idx, 1);
    writeDevWhats(list);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const socketLib = require("../../libs/socket");
      const getIO = socketLib.getIO || socketLib.default || socketLib;
      const io = getIO();
      const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
      io.emit(`company-${tenantId}-whatsapp`, { action: "delete", whatsappId: id });
    } catch {}
    return res.status(204).end();
  }

  try {
    const Whatsapp = getLegacyModel("Whatsapp");
    if (!Whatsapp || typeof Whatsapp.destroy !== "function") {
      return res.status(501).json({ error: true, message: "whatsapp delete not available" });
    }
    const count = await Whatsapp.destroy({ where: { id } });
    if (!count) return res.status(404).json({ error: true, message: "not found" });
    return res.status(204).end();
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "delete error" });
  }
});

export default router;





