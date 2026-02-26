import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { getLegacyModel } from "../../utils/legacyModel";

const router = Router();

type HelpRow = {
  id: number;
  title?: string;
  description?: string;
  video?: string;
  link?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
};

function normalizeText(v: any): string {
  return String(v ?? "").trim();
}

function toUploadPath(raw: string): string {
  const value = normalizeText(raw);
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return decodeURIComponent(parsed.pathname || "");
  } catch {
    const onlyPath = value.split("?")[0].split("#")[0];
    return decodeURIComponent(onlyPath);
  }
}

// Upload (public/uploads/helps)
const PUBLIC_DIR = path.join(process.cwd(), "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const HELPS_UPLOADS_DIR = path.join(UPLOADS_DIR, "helps");

function ensureUploadDirs() {
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR);
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
  if (!fs.existsSync(HELPS_UPLOADS_DIR)) fs.mkdirSync(HELPS_UPLOADS_DIR);
}

ensureUploadDirs();

// Public endpoint used by web app to trigger direct file download.
router.get("/attachment/download", async (req, res) => {
  try {
    const pathFromUrl = toUploadPath(String(req.query.url || ""));
    if (!pathFromUrl || !pathFromUrl.startsWith("/uploads/helps/")) {
      return res.status(400).json({ error: true, message: "invalid attachment url" });
    }

    const targetFile = path.resolve(PUBLIC_DIR, "." + pathFromUrl);
    const allowedBase = path.resolve(HELPS_UPLOADS_DIR);
    if (!targetFile.startsWith(allowedBase + path.sep) && targetFile !== allowedBase) {
      return res.status(400).json({ error: true, message: "invalid attachment path" });
    }
    if (!fs.existsSync(targetFile)) {
      return res.status(404).json({ error: true, message: "file not found" });
    }

    const fileName = path.basename(targetFile);
    return res.download(targetFile, fileName);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "download error" });
  }
});

// Protege todas as demais rotas de ajuda (o frontend já envia Bearer token)
router.use(authMiddleware);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, HELPS_UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || ".png");
    cb(null, unique + ext);
  }
});
const upload = multer({ storage });

function maybeUploadAttachment() {
  const handler = upload.fields([
    { name: "image", maxCount: 1 },
    { name: "attachment", maxCount: 1 },
    { name: "file", maxCount: 1 }
  ]);
  return (req: any, res: any, next: any) => {
    // Only run multer for multipart requests; otherwise keep JSON body behavior.
    if (req?.is?.("multipart/form-data")) return handler(req, res, next);
    return next();
  };
}

function getUploadedUrl(req: any): string {
  if (req?.file?.filename) return `/uploads/helps/${req.file.filename}`;
  const byField = req?.files || {};
  const candidates = ["attachment", "image", "file"];
  for (const key of candidates) {
    const current = byField?.[key];
    if (Array.isArray(current) && current[0]?.filename) {
      return `/uploads/helps/${current[0].filename}`;
    }
  }
  return "";
}

function quoteIdent(name: string): string {
  // Double-quote and escape quotes. Works for any case-sensitive identifiers.
  const safe = String(name).replace(/"/g, '""');
  return `"${safe}"`;
}

let cachedTable: string | null = null; // quoted identifier
let cachedHasCategory: boolean | null = null;
let cachedCols: Set<string> | null = null;

async function resolveHelpsTable(): Promise<string> {
  if (cachedTable) return cachedTable;
  // Try to detect exact table name (case) in public schema
  try {
    const rows = await pgQuery<{ table_name: string }>(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name ILIKE 'helps' OR table_name ILIKE 'help')
      ORDER BY CASE WHEN table_name ILIKE 'helps' THEN 0 ELSE 1 END, length(table_name) ASC
      LIMIT 1
    `
    );
    const name = rows?.[0]?.table_name;
    if (name) {
      cachedTable = quoteIdent(name);
      return cachedTable;
    }
  } catch {
    // ignore
  }

  // Fallback guesses (common in Sequelize projects)
  cachedTable = quoteIdent("Helps");
  return cachedTable;
}

async function resolveHasCategory(tableIdentQuoted: string): Promise<boolean> {
  if (cachedHasCategory !== null) return cachedHasCategory;
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
    cachedHasCategory = cols.some((c) => String(c.column_name).toLowerCase() === "category");
    return cachedHasCategory;
  } catch {
    cachedHasCategory = false;
    return false;
  }
}

async function resolveHelpsColumns(tableIdentQuoted: string): Promise<Set<string>> {
  if (cachedCols) return cachedCols;
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
    cachedCols = new Set(cols.map((c) => String(c.column_name || "").toLowerCase()));
    return cachedCols;
  } catch {
    cachedCols = new Set();
    return cachedCols;
  }
}

async function isAdminOrSuperFromAuth(req: any): Promise<boolean> {
  try {
    const userId = Number(req.userId || 0);
    if (!Number.isFinite(userId) || userId <= 0) return false;

    // 1) Prefer legacy Sequelize model (mais compatível com bases que não têm tabela "Users" com case correto)
    try {
      const User = getLegacyModel("User");
      if (User && typeof User.findByPk === "function") {
        const instance = await User.findByPk(userId);
        const plain = instance?.toJSON ? instance.toJSON() : instance;
        const email = String(plain?.email || "").toLowerCase();
        const isMasterEmail = email === "thercio@trtecnologias.com.br";
        return Boolean(
          plain?.super ||
            String(plain?.profile || "").toLowerCase() === "admin" ||
            isMasterEmail
        );
      }
    } catch {
      // ignore and fallback to raw SQL
    }

    // 2) Fallback raw SQL (tenta "Users" e depois users)
    let rows: any[] | null = null;
    try {
      rows = await pgQuery<any>(
        'SELECT email, "super" as super, profile FROM "Users" WHERE id = $1 LIMIT 1',
        [userId]
      );
    } catch {
      try {
        rows = await pgQuery<any>(
          "SELECT email, super, profile FROM users WHERE id = $1 LIMIT 1",
          [userId]
        );
      } catch {
        rows = null;
      }
    }

    const u = Array.isArray(rows) && rows[0];
    const email = String(u?.email || "").toLowerCase();
    const isMasterEmail = email === "thercio@trtecnologias.com.br";
    return Boolean(u?.super || String(u?.profile || "").toLowerCase() === "admin" || isMasterEmail);
  } catch {
    return false;
  }
}

async function listHelps(): Promise<HelpRow[]> {
  const t = await resolveHelpsTable();
  try {
    return await pgQuery<HelpRow>(`SELECT * FROM ${t} ORDER BY id ASC LIMIT 10000`);
  } catch (e: any) {
    // fallback: try lowercase helps if table was created unquoted
    try {
      return await pgQuery<HelpRow>(`SELECT * FROM ${quoteIdent("helps")} ORDER BY id ASC LIMIT 10000`);
    } catch {
      throw e;
    }
  }
}

// GET /helps - lista ajudas (qualquer usuário autenticado pode ver)
router.get("/", async (_req, res) => {
  try {
    const rows = await listHelps();
    return res.json(Array.isArray(rows) ? rows : []);
  } catch {
    return res.json([]);
  }
});

// GET /helps/list - compat (front antigo)
router.get("/list", async (_req, res) => {
  try {
    const rows = await listHelps();
    return res.json(Array.isArray(rows) ? rows : []);
  } catch {
    return res.json([]);
  }
});

// POST /helps - cria help
router.post("/", maybeUploadAttachment(), async (req, res) => {
  try {
    const ok = await isAdminOrSuperFromAuth(req);
    if (!ok) return res.status(403).json({ error: true, message: "forbidden" });

    const body = req.body || {};
    const uploadedUrl = getUploadedUrl(req);
    const payload = {
      title: normalizeText(body.title),
      description: normalizeText(body.description),
      video: normalizeText(body.video),
      link: normalizeText(body.link) || uploadedUrl
    };

    if (!payload.title) {
      return res.status(400).json({ error: true, message: "title is required" });
    }

    const t = await resolveHelpsTable();
    const hasCategory = await resolveHasCategory(t);
    const colsSet = await resolveHelpsColumns(t);
    const category = normalizeText(body.category);

    // Insert with optional category if the column exists AND a value was provided.
    const cols: string[] = ["title", "description", "video"];
    const vals: any[] = [payload.title, payload.description, payload.video];
    if (hasCategory && category) {
      cols.push("category");
      vals.push(category);
    }
    if (colsSet.has("link") && payload.link) {
      cols.push("link");
      vals.push(payload.link);
    }
    // Add timestamps if the table has them (Sequelize usually requires these)
    if (colsSet.has("createdat")) {
      cols.push("createdAt");
      vals.push(new Date());
    }
    if (colsSet.has("updatedat")) {
      cols.push("updatedAt");
      vals.push(new Date());
    }

    const colsSql = cols.map((c) => quoteIdent(c)).join(", ");
    const paramsSql = vals.map((_, idx) => `$${idx + 1}`).join(", ");
    const rows = await pgQuery<HelpRow>(
      `INSERT INTO ${t} (${colsSql}) VALUES (${paramsSql}) RETURNING *`,
      vals
    );
    const created = Array.isArray(rows) && rows[0];
    return res.status(201).json(created || {});
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "create error" });
  }
});

// PUT /helps/:id - atualiza help
router.put("/:id", maybeUploadAttachment(), async (req, res) => {
  try {
    const ok = await isAdminOrSuperFromAuth(req);
    if (!ok) return res.status(403).json({ error: true, message: "forbidden" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: true, message: "invalid help id" });
    }

    const body = req.body || {};
    const uploadedUrl = getUploadedUrl(req);
    const t = await resolveHelpsTable();
    const hasCategory = await resolveHasCategory(t);
    const colsSet = await resolveHelpsColumns(t);

    const sets: string[] = [];
    const params: any[] = [];

    if (body.title !== undefined) {
      sets.push(`${quoteIdent("title")} = $${params.length + 1}`);
      params.push(normalizeText(body.title));
    }
    if (body.description !== undefined) {
      sets.push(`${quoteIdent("description")} = $${params.length + 1}`);
      params.push(normalizeText(body.description));
    }
    if (body.video !== undefined) {
      sets.push(`${quoteIdent("video")} = $${params.length + 1}`);
      params.push(normalizeText(body.video));
    }
    if (hasCategory && body.category !== undefined) {
      sets.push(`${quoteIdent("category")} = $${params.length + 1}`);
      params.push(normalizeText(body.category));
    }
    if (colsSet.has("link")) {
      // Priority: uploaded file > provided link (can also clear with empty string)
      const linkValue =
        uploadedUrl || (body.link !== undefined ? normalizeText(body.link) : undefined);
      if (linkValue !== undefined) {
        sets.push(`${quoteIdent("link")} = $${params.length + 1}`);
        params.push(linkValue);
      }
    }

    if (!sets.length) {
      const current = await pgQuery<HelpRow>(`SELECT * FROM ${t} WHERE id = $1 LIMIT 1`, [id]);
      const row = Array.isArray(current) && current[0];
      if (!row) return res.status(404).json({ error: true, message: "not found" });
      return res.json(row);
    }

    params.push(id);
    const touchUpdatedAt = colsSet.has("updatedat") ? `, ${quoteIdent("updatedAt")} = now()` : "";
    const updated = await pgQuery<HelpRow>(
      `UPDATE ${t} SET ${sets.join(", ")}${touchUpdatedAt} WHERE id = $${params.length} RETURNING *`,
      params
    );
    const row = Array.isArray(updated) && updated[0];
    if (!row) return res.status(404).json({ error: true, message: "not found" });
    return res.json(row);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "update error" });
  }
});

// DELETE /helps/:id - remove help
router.delete("/:id", async (req, res) => {
  try {
    const ok = await isAdminOrSuperFromAuth(req);
    if (!ok) return res.status(403).json({ error: true, message: "forbidden" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: true, message: "invalid help id" });
    }
    const t = await resolveHelpsTable();
    const rows = await pgQuery<{ id: number }>(`DELETE FROM ${t} WHERE id = $1 RETURNING id`, [id]);
    const deleted = Array.isArray(rows) && rows[0];
    if (!deleted) return res.status(404).json({ error: true, message: "not found" });
    return res.status(204).end();
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "delete error" });
  }
});

export default router;


