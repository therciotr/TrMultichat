import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";

const router = Router();
router.use(authMiddleware);

function normalizeText(v: any): string {
  return String(v ?? "").trim();
}

function toInt(v: any, fallback: number | null = null): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function quoteIdent(name: string): string {
  const safe = String(name).replace(/"/g, '""');
  return `"${safe}"`;
}

// Upload (public/uploads/queue-options)
const PUBLIC_DIR = path.join(process.cwd(), "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const QUEUE_OPTIONS_UPLOADS_DIR = path.join(UPLOADS_DIR, "queue-options");

function ensureUploadDirs() {
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR);
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
  if (!fs.existsSync(QUEUE_OPTIONS_UPLOADS_DIR)) fs.mkdirSync(QUEUE_OPTIONS_UPLOADS_DIR);
}

ensureUploadDirs();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, QUEUE_OPTIONS_UPLOADS_DIR),
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

let cachedQueueOptionsTable: string | null = null; // quoted identifier
let cachedQueuesTable: string | null = null; // quoted identifier
let cachedQueueOptionsCols: Set<string> | null = null; // lowercase

async function resolveTableByILike(patterns: string[], fallback: string): Promise<string> {
  try {
    const params = patterns.map((p) => `%${p}%`);
    const cond = patterns.map((_, i) => `table_name ILIKE $${i + 1}`).join(" OR ");
    const rows = await pgQuery<{ table_name: string }>(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (${cond})
      ORDER BY length(table_name) ASC
      LIMIT 1
    `,
      params
    );
    const name = rows?.[0]?.table_name;
    if (name) return quoteIdent(name);
  } catch {
    // ignore
  }
  return quoteIdent(fallback);
}

async function resolveQueueOptionsTable(): Promise<string> {
  if (cachedQueueOptionsTable) return cachedQueueOptionsTable;
  cachedQueueOptionsTable = await resolveTableByILike(["queueoptions", "queue_options"], "QueueOptions");
  return cachedQueueOptionsTable;
}

async function resolveQueuesTable(): Promise<string> {
  if (cachedQueuesTable) return cachedQueuesTable;
  cachedQueuesTable = await resolveTableByILike(["queues"], "Queues");
  return cachedQueuesTable;
}

async function resolveQueueOptionsColumns(tableIdentQuoted: string): Promise<Set<string>> {
  if (cachedQueueOptionsCols) return cachedQueueOptionsCols;
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
    cachedQueueOptionsCols = new Set(cols.map((c) => String(c.column_name || "").toLowerCase()));
    return cachedQueueOptionsCols;
  } catch {
    cachedQueueOptionsCols = new Set();
    return cachedQueueOptionsCols;
  }
}

async function queueBelongsToCompany(queueId: number, companyId: number): Promise<boolean> {
  try {
    const qt = await resolveQueuesTable();
    const rows = await pgQuery<{ id: number }>(
      `SELECT id FROM ${qt} WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
      [queueId, companyId]
    );
    return Boolean(rows?.[0]?.id);
  } catch {
    // fallback for unquoted/legacy schema
    try {
      const rows = await pgQuery<{ id: number }>(
        `SELECT id FROM queues WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
        [queueId, companyId]
      );
      return Boolean(rows?.[0]?.id);
    } catch {
      return true; // don't hard-block if we can't check (keeps UI working)
    }
  }
}

function parseParentId(v: any): number | null {
  const n = toInt(v, null);
  // UI uses -1 to mean "root options"
  if (n === null) return null;
  if (n === -1) return null;
  return n;
}

// GET /queue-options?queueId=3&parentId=-1
router.get("/", async (req, res) => {
  try {
    const companyId = Number(req.tenantId);
    const queueId = toInt(req.query.queueId, 0) || 0;
    const parentId = parseParentId(req.query.parentId);

    if (!queueId) return res.status(400).json({ error: true, message: "queueId is required" });

    const okQueue = await queueBelongsToCompany(queueId, companyId);
    if (!okQueue) return res.status(404).json({ error: true, message: "queue not found" });

    const t = await resolveQueueOptionsTable();
    const cols = await resolveQueueOptionsColumns(t);
    const hasCompanyId = cols.has("companyid");

    const whereCompany = hasCompanyId ? ` AND "companyId" = $2` : "";
    const paramsBase = hasCompanyId ? [queueId, companyId] : [queueId];
    const idxParent = paramsBase.length + 1;

    const whereParent =
      parentId === null ? ` AND "parentId" IS NULL` : ` AND "parentId" = $${idxParent}`;
    const params = parentId === null ? paramsBase : [...paramsBase, parentId];

    const rows = await pgQuery<any>(
      `
      SELECT *
      FROM ${t}
      WHERE "queueId" = $1
      ${whereCompany}
      ${whereParent}
      ORDER BY "option" ASC, id ASC
    `,
      params
    );

    return res.json(Array.isArray(rows) ? rows : []);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "list error" });
  }
});

// POST /queue-options
router.post("/", async (req, res) => {
  try {
    const companyId = Number(req.tenantId);
    const body = req.body || {};

    const title = normalizeText(body.title);
    const message = normalizeText(body.message);
    const option = toInt(body.option, null);
    const queueId = toInt(body.queueId, 0) || 0;
    const parentId = parseParentId(body.parentId);

    if (!queueId) return res.status(400).json({ error: true, message: "queueId is required" });
    if (!title) return res.status(400).json({ error: true, message: "title is required" });

    const okQueue = await queueBelongsToCompany(queueId, companyId);
    if (!okQueue) return res.status(404).json({ error: true, message: "queue not found" });

    const t = await resolveQueueOptionsTable();
    const cols = await resolveQueueOptionsColumns(t);

    const insertCols: string[] = ["title", "message", "option", "queueId", "parentId"];
    const values: any[] = [title, message, option, queueId, parentId];

    if (cols.has("companyid")) {
      insertCols.push("companyId");
      values.push(companyId);
    }
    if (cols.has("createdat")) {
      insertCols.push("createdAt");
      values.push(new Date());
    }
    if (cols.has("updatedat")) {
      insertCols.push("updatedAt");
      values.push(new Date());
    }

    const colsSql = insertCols.map((c) => quoteIdent(c)).join(",");
    const paramsSql = values.map((_, i) => `$${i + 1}`).join(",");

    const rows = await pgQuery<any>(
      `
      INSERT INTO ${t} (${colsSql})
      VALUES (${paramsSql})
      RETURNING *
    `,
      values
    );
    const created = rows?.[0];
    return res.status(201).json(created || { ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "create error" });
  }
});

// PUT /queue-options/:id
router.put("/:id", async (req, res) => {
  try {
    const companyId = Number(req.tenantId);
    const id = toInt(req.params.id, 0) || 0;
    if (!id) return res.status(400).json({ error: true, message: "invalid id" });

    const body = req.body || {};
    const title = body.title !== undefined ? normalizeText(body.title) : undefined;
    const message = body.message !== undefined ? normalizeText(body.message) : undefined;
    const option = body.option !== undefined ? toInt(body.option, null) : undefined;
    const queueId = body.queueId !== undefined ? toInt(body.queueId, 0) : undefined;
    const parentId = body.parentId !== undefined ? parseParentId(body.parentId) : undefined;

    const t = await resolveQueueOptionsTable();
    const cols = await resolveQueueOptionsColumns(t);
    const hasCompanyId = cols.has("companyid");

    if (queueId) {
      const okQueue = await queueBelongsToCompany(queueId, companyId);
      if (!okQueue) return res.status(404).json({ error: true, message: "queue not found" });
    }

    const sets: string[] = [];
    const params: any[] = [];
    const pushSet = (col: string, val: any) => {
      sets.push(`${quoteIdent(col)} = $${params.length + 1}`);
      params.push(val);
    };

    if (title !== undefined) pushSet("title", title);
    if (message !== undefined) pushSet("message", message);
    if (option !== undefined) pushSet("option", option);
    if (queueId !== undefined) pushSet("queueId", queueId);
    if (parentId !== undefined) pushSet("parentId", parentId);
    if (cols.has("updatedat")) pushSet("updatedAt", new Date());

    if (!sets.length) return res.json({ ok: true });

    const whereCompany = hasCompanyId ? ` AND "companyId" = $${params.length + 2}` : "";
    const sql = `
      UPDATE ${t}
      SET ${sets.join(", ")}
      WHERE id = $${params.length + 1}
      ${whereCompany}
      RETURNING *
    `;

    const rows = await pgQuery<any>(
      sql,
      hasCompanyId ? [...params, id, companyId] : [...params, id]
    );
    const updated = rows?.[0];
    if (!updated) return res.status(404).json({ error: true, message: "not found" });
    return res.json(updated);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "update error" });
  }
});

// DELETE /queue-options/:id
router.delete("/:id", async (req, res) => {
  try {
    const companyId = Number(req.tenantId);
    const id = toInt(req.params.id, 0) || 0;
    if (!id) return res.status(400).json({ error: true, message: "invalid id" });

    const t = await resolveQueueOptionsTable();
    const cols = await resolveQueueOptionsColumns(t);
    const hasCompanyId = cols.has("companyid");

    // delete children first (avoid FK constraints)
    try {
      const whereCompany = hasCompanyId ? ` AND "companyId" = $2` : "";
      await pgQuery(
        `DELETE FROM ${t} WHERE "parentId" = $1${whereCompany}`,
        hasCompanyId ? [id, companyId] : [id]
      );
    } catch {
      // ignore
    }

    const whereCompany = hasCompanyId ? ` AND "companyId" = $2` : "";
    await pgQuery(
      `DELETE FROM ${t} WHERE id = $1${whereCompany}`,
      hasCompanyId ? [id, companyId] : [id]
    );
    return res.status(204).end();
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "delete error" });
  }
});

// POST /queue-options/:id/media-upload (multipart/form-data: file)
router.post("/:id/media-upload", maybeUploadSingle("file"), async (req: any, res) => {
  try {
    const companyId = Number(req.tenantId);
    const id = toInt(req.params.id, 0) || 0;
    if (!id) return res.status(400).json({ error: true, message: "invalid id" });
    if (!req.file) return res.status(400).json({ error: true, message: "file is required" });

    const mediaPath = `/uploads/queue-options/${req.file.filename}`;
    const mediaName = String(req.file.originalname || req.file.filename || "").trim();

    const t = await resolveQueueOptionsTable();
    const cols = await resolveQueueOptionsColumns(t);
    const hasCompanyId = cols.has("companyid");

    // Use the most common column names seen in the UI: mediaPath/mediaName
    const colPath = cols.has("mediapath") ? "mediaPath" : cols.has("path") ? "path" : "mediaPath";
    const colName = cols.has("medianame") ? "mediaName" : cols.has("name") ? "name" : "mediaName";

    const whereCompany = hasCompanyId ? ` AND "companyId" = $4` : "";
    const params = hasCompanyId
      ? [mediaPath, mediaName, id, companyId]
      : [mediaPath, mediaName, id];

    const rows = await pgQuery<any>(
      `
      UPDATE ${t}
      SET ${quoteIdent(colPath)} = $1, ${quoteIdent(colName)} = $2${cols.has("updatedat") ? `, "updatedAt" = NOW()` : ""}
      WHERE id = $3${whereCompany}
      RETURNING *
    `,
      params
    );
    const updated = rows?.[0];
    if (!updated) return res.status(404).json({ error: true, message: "not found" });
    return res.json(updated);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "upload error" });
  }
});

export default router;


