import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { getLegacyModel } from "../../utils/legacyModel";

const router = Router();

// Protege todas as rotas de ajuda (o frontend já envia Bearer token)
router.use(authMiddleware);

type HelpRow = {
  id: number;
  title?: string;
  description?: string;
  video?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
};

function normalizeText(v: any): string {
  return String(v ?? "").trim();
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
            plain?.admin ||
            String(plain?.profile || "") === "admin" ||
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
        'SELECT email, "super" as super, admin, profile FROM "Users" WHERE id = $1 LIMIT 1',
        [userId]
      );
    } catch {
      try {
        rows = await pgQuery<any>(
          "SELECT email, super, admin, profile FROM users WHERE id = $1 LIMIT 1",
          [userId]
        );
      } catch {
        rows = null;
      }
    }

    const u = Array.isArray(rows) && rows[0];
    const email = String(u?.email || "").toLowerCase();
    const isMasterEmail = email === "thercio@trtecnologias.com.br";
    return Boolean(u?.super || u?.admin || String(u?.profile || "") === "admin" || isMasterEmail);
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
router.post("/", async (req, res) => {
  try {
    const ok = await isAdminOrSuperFromAuth(req);
    if (!ok) return res.status(403).json({ error: true, message: "forbidden" });

    const body = req.body || {};
    const payload = {
      title: normalizeText(body.title),
      description: normalizeText(body.description),
      video: normalizeText(body.video)
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
router.put("/:id", async (req, res) => {
  try {
    const ok = await isAdminOrSuperFromAuth(req);
    if (!ok) return res.status(403).json({ error: true, message: "forbidden" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: true, message: "invalid help id" });
    }

    const body = req.body || {};
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


