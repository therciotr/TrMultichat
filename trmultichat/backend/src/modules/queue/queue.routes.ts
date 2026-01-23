import { Router, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { findAllSafe, getLegacyModel } from "../../utils/legacyModel";
import { hasCompanyId } from "../../utils/modelUtils";
import { pgQuery } from "../../utils/pgClient";

const router = Router();

function setNoCache(res: Response) {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("ETag", "0");
    res.setHeader("Last-Modified", "0");
  } catch {}
}

function removeCacheHeaders(req: Request, _res: Response, next: NextFunction) {
  try {
    if ((req.headers as any)["if-none-match"]) delete (req.headers as any)["if-none-match"];
    if ((req.headers as any)["if-modified-since"]) delete (req.headers as any)["if-modified-since"];
  } catch {}
  next();
}

router.use(removeCacheHeaders);

function isDevMode(): boolean {
  return (
    String(process.env.DEV_MODE || env.DEV_MODE || "false").toLowerCase() === "true"
  );
}

function quoteIdent(name: string): string {
  const safe = String(name).replace(/"/g, '""');
  return `"${safe}"`;
}

function extractTenantIdFromAuth(authorization?: string): number {
  try {
    const parts = (authorization || "").split(" ");
    const bearer =
      parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (!bearer) return 0;
    const payload = jwt.verify(bearer, env.JWT_SECRET) as { tenantId?: number };
    return Number(payload?.tenantId || 0);
  } catch {
    return 0;
  }
}

// Upload (public/uploads/queue)
const PUBLIC_DIR = path.join(process.cwd(), "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const QUEUE_UPLOADS_DIR = path.join(UPLOADS_DIR, "queue");

function ensureUploadDirs() {
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR);
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
  if (!fs.existsSync(QUEUE_UPLOADS_DIR)) fs.mkdirSync(QUEUE_UPLOADS_DIR);
}

ensureUploadDirs();
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, QUEUE_UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || ".bin");
    cb(null, unique + ext.replace(/\//g, "-"));
  }
});
const upload = multer({ storage });

function maybeUploadSingle(fieldName: string) {
  const handler = upload.single(fieldName);
  return (req: any, res: any, next: any) => {
    if (req?.is?.("multipart/form-data")) return handler(req, res, next);
    return next();
  };
}

let cachedQueuesTableIdent: string | null = null; // quoted identifier
let cachedQueuesCols: Set<string> | null = null; // lowercase

async function resolveQueuesTable(): Promise<string> {
  if (cachedQueuesTableIdent) return cachedQueuesTableIdent;
  try {
    const rows = await pgQuery<{ table_name: string }>(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name ILIKE 'queues'
      LIMIT 1
    `
    );
    const name = rows?.[0]?.table_name;
    if (name) {
      cachedQueuesTableIdent = quoteIdent(name);
      return cachedQueuesTableIdent;
    }
  } catch {}
  cachedQueuesTableIdent = quoteIdent("Queues");
  return cachedQueuesTableIdent;
}

async function resolveQueuesColumns(tableIdentQuoted: string): Promise<Set<string>> {
  if (cachedQueuesCols) return cachedQueuesCols;
  try {
    const rawName = tableIdentQuoted.replace(/^"+|"+$/g, "").replace(/""/g, '"');
    const cols = await pgQuery<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
      [rawName]
    );
    cachedQueuesCols = new Set(cols.map((c) => String(c.column_name || "").toLowerCase()));
    return cachedQueuesCols;
  } catch {
    cachedQueuesCols = new Set();
    return cachedQueuesCols;
  }
}

async function queryQueuesTable<T>(
  sqlOrBuilder: string | ((table: string) => string),
  params: any[]
): Promise<T[]> {
  const candidates = ['"Queues"', "queues"];
  let lastErr: any = null;
  for (const table of candidates) {
    try {
      const sql =
        typeof sqlOrBuilder === "function"
          ? sqlOrBuilder(table)
          : sqlOrBuilder.replace(/\b"Queues"\b/g, table);
      const rows = await pgQuery<T>(sql, params);
      return Array.isArray(rows) ? rows : [];
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || "");
      // só tenta fallback quando a tabela não existe
      if (!/relation .* does not exist/i.test(msg)) throw e;
    }
  }
  if (lastErr) throw lastErr;
  return [];
}

function normalizeJsonParam(value: any): any {
  if (value === undefined || value === null) return null;
  // If the UI already sends JSON as string, keep it (but validate it is JSON)
  if (typeof value === "string") {
    const v = value.trim();
    if (!v) return null;
    try {
      JSON.parse(v);
      return v;
    } catch {
      // not valid JSON -> keep raw string (avoids throwing here); DB cast will error clearly
      return v;
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

router.get("/", async (_req, res) => {
  try {
    setNoCache(res as any);
    const tenantId = extractTenantIdFromAuth(_req.headers.authorization as string);
    if (!tenantId && !isDevMode()) {
      return res.status(401).json({ error: true, message: "missing tenantId" });
    }

    // Prefer SQL direto (mais robusto em produção)
    try {
      const rows = await queryQueuesTable<any>(
        (table) =>
          `SELECT * FROM ${table} ${
            tenantId ? `WHERE "companyId" = $1` : ""
          } ORDER BY id ASC`,
        tenantId ? [tenantId] : []
      );
      return res.json(Array.isArray(rows) ? rows : []);
    } catch (_) {
      const Queue = getLegacyModel("Queue");
      const where =
        Queue && hasCompanyId(Queue) && tenantId ? { companyId: tenantId } : undefined;
      if (Queue && typeof Queue.findAll === "function") {
        const rows = await Queue.findAll({ where, order: [["id", "ASC"]] });
        const list = Array.isArray(rows)
          ? rows.map((r: any) => (r?.toJSON ? r.toJSON() : r))
          : [];
        return res.json(list);
      }
      const queues = await findAllSafe("Queue", { order: [["id", "ASC"]] });
      return res.json(queues);
    }
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "list error" });
  }
});

// Upload attachment for a queue (used by QueueModal)
router.post("/:id/media-upload", maybeUploadSingle("file"), async (req: any, res) => {
  try {
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
    if (!tenantId && !isDevMode()) {
      return res.status(401).json({ error: true, message: "missing tenantId" });
    }
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: true, message: "invalid id" });
    if (!req.file) return res.status(400).json({ error: true, message: "file is required" });

    const t = await resolveQueuesTable();
    const cols = await resolveQueuesColumns(t);
    if (!cols.has("mediapath") && !cols.has("medianame")) {
      // Column(s) not present in this schema
      return res.status(501).json({ error: true, message: "media fields not available" });
    }

    const mediaPath = `/uploads/queue/${req.file.filename}`;
    const mediaName = String(req.file.originalname || req.file.filename || "").trim();

    const rows = await pgQuery<any>(
      `
      UPDATE ${t}
      SET
        ${cols.has("mediapath") ? `"mediaPath" = $1` : `"mediaPath" = "mediaPath"`},
        ${cols.has("medianame") ? `"mediaName" = $2` : `"mediaName" = "mediaName"`},
        ${cols.has("updatedat") ? `"updatedAt" = NOW()` : `"id" = "id"`}
      WHERE id = $3 AND "companyId" = $4
      RETURNING *
    `,
      [mediaPath, mediaName, id, tenantId || 1]
    );
    const updated = rows?.[0];
    if (!updated) return res.status(404).json({ error: true, message: "not found" });
    return res.json(updated);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "upload error" });
  }
});

router.delete("/:id/media-upload", async (req, res) => {
  try {
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
    if (!tenantId && !isDevMode()) {
      return res.status(401).json({ error: true, message: "missing tenantId" });
    }
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: true, message: "invalid id" });

    const t = await resolveQueuesTable();
    const cols = await resolveQueuesColumns(t);
    if (!cols.has("mediapath") && !cols.has("medianame")) {
      return res.status(204).end();
    }

    // Clear fields; keep file on disk (safe default)
    await pgQuery(
      `
      UPDATE ${t}
      SET
        ${cols.has("mediapath") ? `"mediaPath" = NULL` : `"mediaPath" = "mediaPath"`},
        ${cols.has("medianame") ? `"mediaName" = NULL` : `"mediaName" = "mediaName"`},
        ${cols.has("updatedat") ? `"updatedAt" = NOW()` : `"id" = "id"`}
      WHERE id = $1 AND "companyId" = $2
    `,
      [id, tenantId || 1]
    );

    return res.status(204).end();
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "delete upload error" });
  }
});

// Minimal CRUD to support queue create/update/delete in produção
router.post("/", async (req, res) => {
  try {
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
    if (!tenantId && !isDevMode()) {
      return res.status(401).json({ error: true, message: "missing tenantId" });
    }
    const body = req.body || {};
    const name = String(body.name ?? "").trim();
    const color = String(body.color ?? "#0B4C46").trim() || "#0B4C46";
    const greetingMessage = String(body.greetingMessage ?? "");
    const outOfHoursMessage = String(body.outOfHoursMessage ?? "");
    // Important: pg treats arrays as Postgres arrays, not JSON.
    // UI sends schedules as array of objects -> store as JSON/JSONB safely.
    const schedules = normalizeJsonParam(body.schedules);
    const orderQueue =
      body.orderQueue === undefined ||
      body.orderQueue === null ||
      String(body.orderQueue).trim() === ""
        ? null
        : Number(body.orderQueue);
    const integrationId =
      body.integrationId === undefined ||
      body.integrationId === null ||
      String(body.integrationId).trim() === ""
        ? null
        : Number(body.integrationId);
    const promptId =
      body.promptId === undefined ||
      body.promptId === null ||
      String(body.promptId).trim() === ""
        ? null
        : Number(body.promptId);

    if (!name) return res.status(400).json({ error: true, message: "name is required" });
    if (orderQueue !== null && Number.isNaN(orderQueue)) {
      return res.status(400).json({ error: true, message: "orderQueue must be a number" });
    }
    if (integrationId !== null && Number.isNaN(integrationId)) {
      return res.status(400).json({ error: true, message: "integrationId must be a number" });
    }
    if (promptId !== null && Number.isNaN(promptId)) {
      return res.status(400).json({ error: true, message: "promptId must be a number" });
    }

    const rows = await queryQueuesTable<any>(
      (table) => `
        INSERT INTO ${table}
          ("name","color","greetingMessage","outOfHoursMessage","schedules","orderQueue","integrationId","promptId","companyId","createdAt","updatedAt")
        VALUES
          ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,NOW(),NOW())
        RETURNING *
      `,
      [
        name,
        color,
        greetingMessage,
        outOfHoursMessage,
        schedules,
        orderQueue,
        integrationId,
        promptId,
        tenantId || 1
      ]
    );
    const created = Array.isArray(rows) && rows[0];
    return res.status(201).json(created || { ok: true });
  } catch (e: any) {
    // fallback legacy, if available
    try {
      const Queue = getLegacyModel("Queue");
      if (Queue && typeof Queue.create === "function") {
        const tenantId = extractTenantIdFromAuth(req.headers.authorization as string) || 1;
        const created = await Queue.create({ ...(req.body || {}), companyId: tenantId });
        const json = created?.toJSON ? created.toJSON() : created;
        return res.status(201).json(json);
      }
    } catch (_) {}
    return res.status(400).json({ error: true, message: e?.message || "create error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    setNoCache(res as any);
    const id = Number(req.params.id);
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
    if (!tenantId && !isDevMode()) {
      return res.status(401).json({ error: true, message: "missing tenantId" });
    }
    // Prefer SQL
    try {
      const rows = await queryQueuesTable<any>(
        (table) => `SELECT * FROM ${table} WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
        [id, tenantId]
      );
      const row = Array.isArray(rows) && rows[0];
      if (!row) return res.status(404).json({ error: true, message: "not found" });
      return res.json(row);
    } catch (_) {
      const Queue = getLegacyModel("Queue");
      if (!Queue || typeof Queue.findByPk !== "function") {
        return res.status(501).json({ error: true, message: "queue get not available" });
      }
      const instance = await Queue.findByPk(id);
      if (!instance) return res.status(404).json({ error: true, message: "not found" });
      const json = instance?.toJSON ? instance.toJSON() : instance;
      return res.json(json);
    }
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "get error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
    if (!tenantId && !isDevMode()) {
      return res.status(401).json({ error: true, message: "missing tenantId" });
    }
    const body = req.body || {};
    const up: any = {
      name: body.name,
      color: body.color,
      greetingMessage: body.greetingMessage,
      outOfHoursMessage: body.outOfHoursMessage,
      schedules: normalizeJsonParam(body.schedules),
      orderQueue:
        body.orderQueue === undefined || body.orderQueue === null || String(body.orderQueue).trim() === ""
          ? null
          : Number(body.orderQueue),
      integrationId:
        body.integrationId === undefined || body.integrationId === null || String(body.integrationId).trim() === ""
          ? null
          : Number(body.integrationId),
      promptId:
        body.promptId === undefined || body.promptId === null || String(body.promptId).trim() === ""
          ? null
          : Number(body.promptId)
    };
    Object.keys(up).forEach((k) => up[k] === undefined && delete up[k]);

    // Prefer SQL
    try {
      const rows = await queryQueuesTable<any>(
        (table) => `
          UPDATE ${table}
          SET
            "name" = COALESCE($1, "name"),
            "color" = COALESCE($2, "color"),
            "greetingMessage" = COALESCE($3, "greetingMessage"),
            "outOfHoursMessage" = COALESCE($4, "outOfHoursMessage"),
            "schedules" = COALESCE($5::jsonb, "schedules"),
            "orderQueue" = $6,
            "integrationId" = $7,
            "promptId" = $8,
            "updatedAt" = NOW()
          WHERE id = $9 AND "companyId" = $10
          RETURNING *
        `,
        [
          up.name ?? null,
          up.color ?? null,
          up.greetingMessage ?? null,
          up.outOfHoursMessage ?? null,
          up.schedules ?? null,
          up.orderQueue ?? null,
          up.integrationId ?? null,
          up.promptId ?? null,
          id,
          tenantId
        ]
      );
      const row = Array.isArray(rows) && rows[0];
      if (!row) return res.status(404).json({ error: true, message: "not found" });
      return res.json(row);
    } catch (_) {
      const Queue = getLegacyModel("Queue");
      if (!Queue || typeof Queue.findByPk !== "function") {
        return res.status(501).json({ error: true, message: "queue update not available" });
      }
      const instance = await Queue.findByPk(id);
      if (!instance) return res.status(404).json({ error: true, message: "not found" });
      await instance.update(up);
      const json = instance?.toJSON ? instance.toJSON() : instance;
      return res.json(json);
    }
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "update error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
    if (!tenantId && !isDevMode()) {
      return res.status(401).json({ error: true, message: "missing tenantId" });
    }
    // Prefer SQL
    try {
      await queryQueuesTable<any>(
        (table) => `DELETE FROM ${table} WHERE id = $1 AND "companyId" = $2`,
        [id, tenantId]
      );
      return res.status(204).end();
    } catch (_) {
      const Queue = getLegacyModel("Queue");
      if (!Queue || typeof Queue.destroy !== "function") {
        return res.status(501).json({ error: true, message: "queue delete not available" });
      }
      const count = await Queue.destroy({ where: { id } });
      if (!count) return res.status(404).json({ error: true, message: "not found" });
      return res.status(204).end();
    }
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "delete error" });
  }
});

export default router;





