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
let cachedQueueOptionsColsMap: Map<string, string> | null = null; // lower -> actual

const QUEUE_OPTIONS_TABLE_CANDIDATES: string[] = [
  // quoted (Sequelize default)
  quoteIdent("QueueOptions"),
  quoteIdent("QueueOption"),
  quoteIdent("QueuesOptions"),
  quoteIdent("QueuesOption"),
  // unquoted common
  "queue_options",
  "queue_option",
  "queueoptions",
  "queueoption",
  "queues_options",
  "queuesoptions"
];

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
  cachedQueueOptionsTable = await resolveTableByILike(
    ["queueoptions", "queue_options", "queueoption", "queue_option"],
    "QueueOptions"
  );
  return cachedQueueOptionsTable;
}

async function resolveQueuesTable(): Promise<string> {
  if (cachedQueuesTable) return cachedQueuesTable;
  cachedQueuesTable = await resolveTableByILike(["queues"], "Queues");
  return cachedQueuesTable;
}

async function resolveQueueOptionsColumns(tableIdentQuoted: string): Promise<Set<string>> {
  const map = await resolveQueueOptionsColumnsMap(tableIdentQuoted);
  return new Set(Array.from(map.keys()));
}

async function resolveQueueOptionsColumnsMap(tableIdentQuoted: string): Promise<Map<string, string>> {
  if (cachedQueueOptionsColsMap) return cachedQueueOptionsColsMap;
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
    const m = new Map<string, string>();
    for (const c of cols) {
      const actual = String(c.column_name || "");
      if (!actual) continue;
      m.set(actual.toLowerCase(), actual);
    }
    cachedQueueOptionsColsMap = m;
    return m;
  } catch {
    cachedQueueOptionsColsMap = new Map();
    return cachedQueueOptionsColsMap;
  }
}

function pickColumn(
  colsMap: Map<string, string>,
  candidates: string[],
  fallback?: string
): string | null {
  for (const c of candidates) {
    const actual = colsMap.get(String(c).toLowerCase());
    if (actual) return actual;
  }
  return fallback ?? null;
}

async function resolveColumnsMapForTable(tableIdent: string): Promise<Map<string, string>> {
  // Do not cache globally per-process for different candidates (schemas may differ).
  // Use direct lookup each time.
  try {
    const rawName = tableIdent.replace(/^"+|"+$/g, "").replace(/""/g, '"');
    const cols = await pgQuery<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
      [rawName]
    );
    const m = new Map<string, string>();
    for (const c of cols) {
      const actual = String(c.column_name || "");
      if (!actual) continue;
      m.set(actual.toLowerCase(), actual);
    }
    return m;
  } catch {
    return new Map();
  }
}

function isRelationMissingError(e: any): boolean {
  const msg = String(e?.message || "");
  return /relation .* does not exist/i.test(msg);
}

async function tryEachQueueOptionsTable<T>(
  fn: (tableIdent: string, colsMap: Map<string, string>) => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; error: any }> {
  let lastErr: any = null;
  for (const t of QUEUE_OPTIONS_TABLE_CANDIDATES) {
    const colsMap = await resolveColumnsMapForTable(t);
    if (!colsMap.size) {
      // maybe table doesn't exist or schema is different
      continue;
    }
    try {
      const v = await fn(t, colsMap);
      return { ok: true, value: v };
    } catch (e: any) {
      lastErr = e;
      // if table doesn't exist, keep trying other candidates
      if (isRelationMissingError(e)) continue;
      // if column mismatch etc, keep trying other candidates
      continue;
    }
  }
  return { ok: false, error: lastErr || new Error("queue-options table not found") };
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

    const out = await tryEachQueueOptionsTable(async (t, colsMap) => {
      const cols = new Set(Array.from(colsMap.keys()));
      const colQueueId = pickColumn(colsMap, ["queueId", "queue_id", "queueid"]);
      const colParentId = pickColumn(colsMap, ["parentId", "parent_id", "parentid"]);
      const colOption = pickColumn(colsMap, ["option", "order", "position"]);
      const colCompanyId = pickColumn(colsMap, ["companyId", "company_id", "companyid"]);

      if (!colQueueId) throw new Error("queueId column not found on queue-options table");

      const hasCompanyId = Boolean(colCompanyId);
      const whereCompany = hasCompanyId ? ` AND ${quoteIdent(colCompanyId as string)} = $2` : "";
      const paramsBase = hasCompanyId ? [queueId, companyId] : [queueId];

      let whereParent = "";
      let params = paramsBase;
      if (colParentId) {
        if (parentId === null) {
          // Root: frontend queries with -1; some DBs store root as NULL, others as -1.
          whereParent = ` AND (${quoteIdent(colParentId)} IS NULL OR ${quoteIdent(colParentId)} = -1)`;
        } else {
          whereParent = ` AND ${quoteIdent(colParentId)} = $${paramsBase.length + 1}`;
          params = [...paramsBase, parentId];
        }
      }

      const orderBy = colOption ? `${quoteIdent(colOption)} ASC, id ASC` : "id ASC";
      const rows = await pgQuery<any>(
        `
        SELECT *
        FROM ${t}
        WHERE ${quoteIdent(colQueueId)} = $1
        ${whereCompany}
        ${whereParent}
        ORDER BY ${orderBy}
      `,
        params
      );
      return Array.isArray(rows) ? rows : [];
    });

    if (!out.ok) {
      throw (out as { ok: false; error: any }).error;
    }
    return res.json(out.value);
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

    const out = await tryEachQueueOptionsTable(async (t, colsMap) => {
      const cols = new Set(Array.from(colsMap.keys()));

      const colTitle = pickColumn(colsMap, ["title", "name"]);
      const colMessage = pickColumn(colsMap, ["message", "body", "text"]);
      const colOption = pickColumn(colsMap, ["option", "order", "position"]);
      const colQueueId = pickColumn(colsMap, ["queueId", "queue_id", "queueid"]);
      const colParentId = pickColumn(colsMap, ["parentId", "parent_id", "parentid"]);
      const colCompanyId = pickColumn(colsMap, ["companyId", "company_id", "companyid"]);
      const colCreatedAt = pickColumn(colsMap, ["createdAt", "created_at", "createdat"]);
      const colUpdatedAt = pickColumn(colsMap, ["updatedAt", "updated_at", "updatedat"]);

      if (!colTitle) throw new Error("title/name column not found on queue-options table");
      if (!colQueueId) throw new Error("queueId column not found on queue-options table");
      if (!colOption) throw new Error("option/order column not found on queue-options table");

      // Root option: must be NULL to satisfy FK constraints on parentId (parentId references QueueOptions.id).
      // UI also queries root using parentId=-1; we already treat -1 as "root" on GET via IS NULL.
      const normalizedParentId = parentId;

      const insertCols: string[] = [colTitle, colOption, colQueueId];
      const values: any[] = [title, option, queueId];

      if (colMessage) {
        insertCols.push(colMessage);
        values.push(message);
      }
      if (colParentId) {
        insertCols.push(colParentId);
        values.push(normalizedParentId);
      }
      if (colCompanyId) {
        insertCols.push(colCompanyId);
        values.push(companyId);
      }
      if (colCreatedAt) {
        insertCols.push(colCreatedAt);
        values.push(new Date());
      }
      if (colUpdatedAt) {
        insertCols.push(colUpdatedAt);
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
      if (!created) return { ok: true };
      // Ensure id exists for frontend
      const createdId = created?.id ?? created?.ID ?? created?.Id;
      return createdId ? created : { ...created, id: createdId };
    });

    if (!out.ok) {
      throw (out as { ok: false; error: any }).error;
    }
    return res.status(201).json(out.value);
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
    const colsMap = await resolveQueueOptionsColumnsMap(t);
    const cols = new Set(Array.from(colsMap.keys()));
    const hasCompanyId = cols.has("companyid");

    const colTitle = pickColumn(colsMap, ["title", "name"], "title");
    const colMessage = pickColumn(colsMap, ["message", "body", "text"], "message");
    const colOption = pickColumn(colsMap, ["option", "order", "position"], "option");
    const colQueueId = pickColumn(colsMap, ["queueId", "queue_id", "queueid"], "queueId");
    const colParentId = pickColumn(colsMap, ["parentId", "parent_id", "parentid"], "parentId");
    const colUpdatedAt = pickColumn(colsMap, ["updatedAt", "updated_at", "updatedat"], "updatedAt");

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

    if (title !== undefined) pushSet(colTitle, title);
    if (message !== undefined) pushSet(colMessage, message);
    if (option !== undefined) pushSet(colOption, option);
    if (queueId !== undefined) pushSet(colQueueId, queueId);
    if (parentId !== undefined) pushSet(colParentId, parentId);
    if (cols.has("updatedat")) pushSet(colUpdatedAt, new Date());

    if (!sets.length) return res.json({ ok: true });

    const whereCompany = hasCompanyId ? ` AND "companyId" = $${params.length + 2}` : "";
    const sql = `
      UPDATE ${t}
      SET ${sets.join(", ")}
      WHERE id = $${params.length + 1}
      ${whereCompany}
      RETURNING *
    `;

    try {
      const rows = await pgQuery<any>(
        sql,
        hasCompanyId ? [...params, id, companyId] : [...params, id]
      );
      const updated = rows?.[0];
      if (!updated) return res.status(404).json({ error: true, message: "not found" });
      return res.json(updated);
    } catch (e: any) {
      throw e;
    }
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
    const colsMap = await resolveQueueOptionsColumnsMap(t);
    const cols = new Set(Array.from(colsMap.keys()));
    const hasCompanyId = cols.has("companyid");
    const colParentId = pickColumn(colsMap, ["parentId", "parent_id", "parentid"], "parentId");

    // delete children first (avoid FK constraints)
    try {
      const whereCompany = hasCompanyId ? ` AND "companyId" = $2` : "";
      await pgQuery(
        `DELETE FROM ${t} WHERE ${quoteIdent(colParentId)} = $1${whereCompany}`,
        hasCompanyId ? [id, companyId] : [id]
      );
    } catch {
      // ignore
    }

    try {
      const whereCompany = hasCompanyId ? ` AND "companyId" = $2` : "";
      await pgQuery(
        `DELETE FROM ${t} WHERE id = $1${whereCompany}`,
        hasCompanyId ? [id, companyId] : [id]
      );
      return res.status(204).end();
    } catch (e: any) {
      throw e;
    }
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
    const colsMap = await resolveQueueOptionsColumnsMap(t);
    const cols = new Set(Array.from(colsMap.keys()));
    const hasCompanyId = cols.has("companyid");

    // Use the most common column names seen in the UI: mediaPath/mediaName
    const colPath = pickColumn(colsMap, ["mediaPath", "media_path", "mediapath", "path"], "mediaPath");
    const colName = pickColumn(colsMap, ["mediaName", "media_name", "medianame", "name", "fileName", "filename"], "mediaName");
    const colUpdatedAt = pickColumn(colsMap, ["updatedAt", "updated_at", "updatedat"], "updatedAt");

    const whereCompany = hasCompanyId ? ` AND "companyId" = $4` : "";
    const params = hasCompanyId
      ? [mediaPath, mediaName, id, companyId]
      : [mediaPath, mediaName, id];

    try {
      const rows = await pgQuery<any>(
        `
        UPDATE ${t}
        SET ${quoteIdent(colPath)} = $1, ${quoteIdent(colName)} = $2${cols.has("updatedat") ? `, ${quoteIdent(colUpdatedAt)} = NOW()` : ""}
        WHERE id = $3${whereCompany}
        RETURNING *
      `,
        params
      );
      const updated = rows?.[0];
      if (!updated) return res.status(404).json({ error: true, message: "not found" });
      return res.json(updated);
    } catch (e: any) {
      throw e;
    }
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "upload error" });
  }
});

export default router;


