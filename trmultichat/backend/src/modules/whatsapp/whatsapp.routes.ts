import { Router } from "express";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { findAllSafe, findByPkSafe, getLegacyModel } from "../../utils/legacyModel";
import { pgQuery } from "../../utils/pgClient";

const router = Router();

function isDevMode(): boolean {
  return (
    String(process.env.DEV_MODE || env.DEV_MODE || "false").toLowerCase() === "true"
  );
}

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
    if (!bearer) return 0;
    const payload = jwt.verify(bearer, env.JWT_SECRET) as { tenantId?: number };
    return Number(payload?.tenantId || 0);
  } catch {
    return 0;
  }
}

async function queryWhatsappsTable<T>(
  sqlOrBuilder: string | ((table: string) => string),
  params: any[]
): Promise<T[]> {
  const candidates = ['"Whatsapps"', '"WhatsApps"', "whatsapps", "whatsApps"];
  let lastErr: any = null;
  for (const table of candidates) {
    try {
      const sql =
        typeof sqlOrBuilder === "function"
          ? sqlOrBuilder(table)
          : sqlOrBuilder.replace(/\b"Whatsapps"\b/g, table);
      const rows = await pgQuery<T>(sql, params);
      return Array.isArray(rows) ? rows : [];
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || "");
      if (!/relation .* does not exist/i.test(msg)) throw e;
    }
  }
  if (lastErr) throw lastErr;
  return [];
}

async function getColumnsForTable(tableName: string): Promise<Set<string>> {
  const rawName = tableName.replace(/"/g, "");
  const cols = await pgQuery<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND lower(table_name) = lower($1)
    `,
    [rawName]
  );
  return new Set((cols || []).map((c) => c.column_name));
}

function firstString(...vals: any[]): string {
  for (const v of vals) {
    if (v === undefined || v === null) continue;
    const s = String(v);
    if (s.length) return s;
    return s; // allow empty string if explicitly passed
  }
  return "";
}

function toNumOrNull(v: any): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function emitSocket(tenantId: number, event: string, payload: any) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const socketLib = require("../../libs/socket");
    const getIO = socketLib.getIO || socketLib.default || socketLib;
    const io = getIO();
    io.emit(`company-${tenantId}-${event}`, payload);
  } catch {}
}

router.get("/", async (req, res) => {
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  const companyId = Number(req.query.companyId || tenantId || 0);
  const session = Number(req.query.session || 0);
  // DEV: return from file
  if (isDevMode()) {
    const list = readDevWhats();
    return res.json(list);
  }
  if (!companyId) {
    return res.status(401).json({ error: true, message: "missing tenantId" });
  }

  // Prefer SQL direto (mais robusto em produção)
  try {
    const rows = await queryWhatsappsTable<any>(
      (table) =>
        `SELECT * FROM ${table} WHERE "companyId" = $1 ORDER BY id ASC`,
      [companyId]
    );
    return res.json(Array.isArray(rows) ? rows : []);
  } catch (_) {
    // Legacy: try to read from DB
    const listDb = await findAllSafe("Whatsapp", {
      where: companyId ? { companyId } : undefined,
      order: [["id", "ASC"]],
    });
    // session param is ignored in this minimal implementation
    return res.json(listDb);
  }
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isDevMode()) {
    const rec = readDevWhats().find((w) => Number(w.id) === id);
    const sessions = readDevSessions();
    const sess = sessions[String(id)] || {};
    // Fallback when record not found: still return minimal object with qrcode so polling works
    if (!rec) {
      return res.json({ id, name: `WhatsApp ${id}`, status: sess.qrcode ? "qrcode" : "DISCONNECTED", qrcode: sess.qrcode || "" });
    }
    return res.json({ ...rec, qrcode: sess.qrcode || "" });
  }

  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  if (!tenantId) {
    return res.status(401).json({ error: true, message: "missing tenantId" });
  }

  try {
    const rows = await queryWhatsappsTable<any>(
      (table) => `SELECT * FROM ${table} WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
      [id, tenantId]
    );
    const rec = rows && rows[0];
    if (!rec) return res.status(404).json({ error: true, message: "not found" });
    return res.json(rec);
  } catch (_) {
    const record = await findByPkSafe("Whatsapp", id);
    if (!record) return res.status(404).json({ error: true, message: "not found" });
    return res.json(record);
  }
});

// Minimal DEV-friendly create/update to avoid 404 when legacy routes are unavailable
router.post("/", async (req, res) => {
  const isDev = isDevMode();
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

  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  if (!tenantId && !isDev) {
    return res.status(401).json({ error: true, message: "missing tenantId" });
  }

  // PROD: prefer SQL (robust) then fallback to legacy model
  try {
    const queueIds: number[] = Array.isArray(body.queueIds)
      ? body.queueIds.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n) && n > 0)
      : [];

    const promptId = toNumOrNull(body.promptId);

    const wanted: Record<string, any> = {
      name: firstString(body.name, ""),
      status: "DISCONNECTED",
      isDefault: Boolean(body.isDefault),
      greetingMessage: firstString(body.greetingMessage, ""),
      // aceitar os 2 nomes (typo histórico)
      complationMessage: firstString(body.complationMessage, body.completionMessage, ""),
      completionMessage: firstString(body.completionMessage, body.complationMessage, ""),
      outOfHoursMessage: firstString(body.outOfHoursMessage, ""),
      ratingMessage: firstString(body.ratingMessage, ""),
      token: firstString(body.token, ""),
      provider: firstString(body.provider, "beta"),
      timeSendQueue: toNumOrNull(body.timeSendQueue) ?? 0,
      sendIdQueue: toNumOrNull(body.sendIdQueue) ?? 0,
      expiresInactiveMessage: firstString(body.expiresInactiveMessage, ""),
      expiresTicket: toNumOrNull(body.expiresTicket) ?? 0,
      timeUseBotQueues: toNumOrNull(body.timeUseBotQueues) ?? 0,
      maxUseBotQueues: toNumOrNull(body.maxUseBotQueues) ?? 0,
      promptId: promptId,
      companyId: tenantId,
      updatedAt: new Date(),
      createdAt: new Date(),
    };

    const tableCandidates = ['"Whatsapps"', '"WhatsApps"', "whatsapps", "whatsApps"];
    let createdRow: any = null;
    let lastErr: any = null;
    for (const table of tableCandidates) {
      try {
        const cols = await getColumnsForTable(table);
        const payload: Record<string, any> = {};
        for (const [k, v] of Object.entries(wanted)) {
          if (cols.has(k) && v !== undefined) payload[k] = v;
        }

        // Se o schema só tem um dos campos, remove o outro pra evitar ambiguidade
        if (payload.complationMessage !== undefined && payload.completionMessage !== undefined) {
          if (cols.has("complationMessage") && !cols.has("completionMessage")) delete payload.completionMessage;
          if (cols.has("completionMessage") && !cols.has("complationMessage")) delete payload.complationMessage;
        }

        const keys = Object.keys(payload);
        const values = keys.map((k) => payload[k]);
        const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(", ");
        const columnsSql = keys.map((k) => `"${k}"`).join(", ");

        const rows = await pgQuery<any>(
          `INSERT INTO ${table} (${columnsSql}) VALUES (${placeholders}) RETURNING *`,
          values
        );
        createdRow = rows && rows[0];
        if (createdRow) break;
      } catch (e: any) {
        lastErr = e;
        const msg = String(e?.message || "");
        if (!/relation .* does not exist/i.test(msg)) throw e;
      }
    }

    if (!createdRow) {
      if (lastErr) throw lastErr;
      throw new Error("could not insert whatsapp");
    }

    // tentar salvar vínculo com filas (se existir tabela de junção)
    if (queueIds.length) {
      const joinCandidates = ['"WhatsappsQueues"', '"WhatsAppsQueues"', "whatsappsqueues", "whatsAppsQueues"];
      for (const jt of joinCandidates) {
        try {
          const joinCols = await getColumnsForTable(jt);
          const wCol = joinCols.has("whatsappId") ? "whatsappId" : joinCols.has("whatsAppId") ? "whatsAppId" : null;
          const qCol = joinCols.has("queueId") ? "queueId" : null;
          if (!wCol || !qCol) continue;
          for (const qid of queueIds) {
            await pgQuery(
              `INSERT INTO ${jt} ("${wCol}", "${qCol}") VALUES ($1, $2)`,
              [createdRow.id, qid]
            );
          }
          break;
        } catch (e: any) {
          const msg = String(e?.message || "");
          if (!/relation .* does not exist/i.test(msg)) {
            // ignora erro de vínculo para não bloquear criação
            break;
          }
        }
      }
    }

    emitSocket(tenantId, "whatsapp", { action: "update", whatsapp: createdRow });
    return res.status(201).json(createdRow);
  } catch (e: any) {
    // fallback legacy model
    try {
      const Whatsapp = getLegacyModel("Whatsapp");
      if (!Whatsapp || typeof Whatsapp.create !== "function") {
        return res.status(400).json({ error: true, message: e?.message || "create error" });
      }
      const payload = {
        name: body.name || "",
        status: "DISCONNECTED",
        isDefault: Boolean(body.isDefault),
        greetingMessage: body.greetingMessage || "",
        complationMessage: body.complationMessage || body.completionMessage || "",
        outOfHoursMessage: body.outOfHoursMessage || "",
        ratingMessage: body.ratingMessage || "",
        token: body.token || "",
        provider: body.provider || "beta",
        timeSendQueue: Number(body.timeSendQueue || 0),
        sendIdQueue: Number(body.sendIdQueue || 0),
        expiresInactiveMessage: body.expiresInactiveMessage || "",
        expiresTicket: Number(body.expiresTicket || 0),
        timeUseBotQueues: Number(body.timeUseBotQueues || 0),
        maxUseBotQueues: Number(body.maxUseBotQueues || 0),
        promptId: body.promptId ?? null,
        companyId: tenantId,
      };
      const created = await Whatsapp.create(payload);
      const json = created?.toJSON ? created.toJSON() : created;
      emitSocket(tenantId, "whatsapp", { action: "update", whatsapp: json });
      return res.status(201).json(json);
    } catch (e2: any) {
      return res.status(400).json({ error: true, message: e2?.message || e?.message || "create error" });
    }
  }
});

router.put("/:id", async (req, res) => {
  const isDev = isDevMode();
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
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
    if (!tenantId && !isDev) {
      return res.status(401).json({ error: true, message: "missing tenantId" });
    }

    const queueIds: number[] = Array.isArray(body.queueIds)
      ? body.queueIds.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n) && n > 0)
      : [];

    const wanted: Record<string, any> = {
      name: body.name,
      isDefault: body.isDefault,
      greetingMessage: body.greetingMessage,
      complationMessage: body.complationMessage ?? body.completionMessage,
      completionMessage: body.completionMessage ?? body.complationMessage,
      outOfHoursMessage: body.outOfHoursMessage,
      ratingMessage: body.ratingMessage,
      token: body.token,
      provider: body.provider,
      timeSendQueue: toNumOrNull(body.timeSendQueue),
      sendIdQueue: toNumOrNull(body.sendIdQueue),
      expiresInactiveMessage: body.expiresInactiveMessage,
      expiresTicket: toNumOrNull(body.expiresTicket),
      timeUseBotQueues: toNumOrNull(body.timeUseBotQueues),
      maxUseBotQueues: toNumOrNull(body.maxUseBotQueues),
      promptId: toNumOrNull(body.promptId),
      updatedAt: new Date(),
    };

    // Atualização robusta: tenta em tabelas candidatas e só atualiza colunas existentes.
    const tableCandidates = ['"Whatsapps"', '"WhatsApps"', "whatsapps", "whatsApps"];
    let updated: any = null;
    for (const table of tableCandidates) {
      try {
        const cols = await getColumnsForTable(table);
        const payload: Record<string, any> = {};
        for (const [k, v] of Object.entries(wanted)) {
          if (v === undefined) continue;
          if (!cols.has(k)) continue;
          payload[k] = v;
        }
        if (payload.complationMessage !== undefined && payload.completionMessage !== undefined) {
          if (cols.has("complationMessage") && !cols.has("completionMessage")) delete payload.completionMessage;
          if (cols.has("completionMessage") && !cols.has("complationMessage")) delete payload.complationMessage;
        }
        const keys = Object.keys(payload);
        const values = keys.map((k) => payload[k]);
        const sets = keys.map((k, idx) => `"${k}" = $${idx + 3}`).join(", ");
        const rows = await pgQuery<any>(
          keys.length
            ? `UPDATE ${table} SET ${sets} WHERE id = $1 AND "companyId" = $2 RETURNING *`
            : `SELECT * FROM ${table} WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
          [id, tenantId, ...values]
        );
        updated = rows && rows[0];
        if (updated) break;
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (!/relation .* does not exist/i.test(msg)) throw e;
      }
    }

    if (!updated) return res.status(404).json({ error: true, message: "not found" });

    // tentar atualizar vínculo com filas (se existir tabela de junção)
    if (Array.isArray(body.queueIds)) {
      const joinCandidates = ['"WhatsappsQueues"', '"WhatsAppsQueues"', "whatsappsqueues", "whatsAppsQueues"];
      for (const jt of joinCandidates) {
        try {
          const joinCols = await getColumnsForTable(jt);
          const wCol = joinCols.has("whatsappId") ? "whatsappId" : joinCols.has("whatsAppId") ? "whatsAppId" : null;
          const qCol = joinCols.has("queueId") ? "queueId" : null;
          if (!wCol || !qCol) continue;
          await pgQuery(`DELETE FROM ${jt} WHERE "${wCol}" = $1`, [id]);
          for (const qid of queueIds) {
            await pgQuery(
              `INSERT INTO ${jt} ("${wCol}", "${qCol}") VALUES ($1, $2)`,
              [id, qid]
            );
          }
          break;
        } catch (e: any) {
          const msg = String(e?.message || "");
          if (!/relation .* does not exist/i.test(msg)) {
            break;
          }
        }
      }
    }

    emitSocket(tenantId, "whatsapp", { action: "update", whatsapp: updated });
    return res.json(updated);
  } catch (e: any) {
    // legacy fallback
    try {
      const Whatsapp = getLegacyModel("Whatsapp");
      if (!Whatsapp || typeof Whatsapp.findByPk !== "function") {
        return res.status(400).json({ error: true, message: e?.message || "update error" });
      }
      const instance = await Whatsapp.findByPk(id);
      if (!instance) return res.status(404).json({ error: true, message: "not found" });
      const up = {
        name: body.name,
        greetingMessage: body.greetingMessage,
        complationMessage: body.complationMessage ?? body.completionMessage,
        outOfHoursMessage: body.outOfHoursMessage,
        ratingMessage: body.ratingMessage,
        token: body.token,
        provider: body.provider,
        timeSendQueue: body.timeSendQueue,
        sendIdQueue: body.sendIdQueue,
        expiresInactiveMessage: body.expiresInactiveMessage,
        expiresTicket: body.expiresTicket,
        timeUseBotQueues: body.timeUseBotQueues,
        maxUseBotQueues: body.maxUseBotQueues,
      };
      await instance.update(up);
      const json = instance?.toJSON ? instance.toJSON() : instance;
      const tenantId = extractTenantIdFromAuth(req.headers.authorization as string) || 0;
      if (tenantId) emitSocket(tenantId, "whatsapp", { action: "update", whatsapp: json });
      return res.json(json);
    } catch (e2: any) {
      return res.status(400).json({ error: true, message: e2?.message || e?.message || "update error" });
    }
  }
});

router.delete("/:id", async (req, res) => {
  const isDev = isDevMode();
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
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
    if (!tenantId && !isDev) {
      return res.status(401).json({ error: true, message: "missing tenantId" });
    }

    // Prefer SQL direct
    try {
      // delete join rows (optional)
      const joinCandidates = ['"WhatsappsQueues"', '"WhatsAppsQueues"', "whatsappsqueues", "whatsAppsQueues"];
      for (const jt of joinCandidates) {
        try {
          const joinCols = await getColumnsForTable(jt);
          const wCol = joinCols.has("whatsappId") ? "whatsappId" : joinCols.has("whatsAppId") ? "whatsAppId" : null;
          if (!wCol) continue;
          await pgQuery(`DELETE FROM ${jt} WHERE "${wCol}" = $1`, [id]);
          break;
        } catch (e: any) {
          const msg = String(e?.message || "");
          if (!/relation .* does not exist/i.test(msg)) break;
        }
      }

      const rows = await queryWhatsappsTable<any>(
        (table) => `DELETE FROM ${table} WHERE id = $1 AND "companyId" = $2 RETURNING id`,
        [id, tenantId]
      );
      if (!rows || !rows[0]) return res.status(404).json({ error: true, message: "not found" });
      emitSocket(tenantId, "whatsapp", { action: "delete", whatsappId: id });
      return res.status(204).end();
    } catch (_) {
      const Whatsapp = getLegacyModel("Whatsapp");
      if (!Whatsapp || typeof Whatsapp.destroy !== "function") {
        return res.status(501).json({ error: true, message: "whatsapp delete not available" });
      }
      const count = await Whatsapp.destroy({ where: { id } });
      if (!count) return res.status(404).json({ error: true, message: "not found" });
      emitSocket(tenantId, "whatsapp", { action: "delete", whatsappId: id });
      return res.status(204).end();
    }
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "delete error" });
  }
});

export default router;





