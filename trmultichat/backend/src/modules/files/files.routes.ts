import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";

const router = Router();

router.use(authMiddleware);

type FileRow = {
  id: number;
  companyId: number;
  name: string;
  message: string;
  createdAt?: string;
  updatedAt?: string;
  options?: any[];
};

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

const PUBLIC_DIR = path.join(process.cwd(), "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const FILES_UPLOADS_DIR = path.join(UPLOADS_DIR, "files");

function ensureUploadDirs() {
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR);
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
  if (!fs.existsSync(FILES_UPLOADS_DIR)) fs.mkdirSync(FILES_UPLOADS_DIR);
}

ensureUploadDirs();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, FILES_UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || ".bin");
    cb(null, unique + ext.replace(/\//g, "-"));
  }
});
const upload = multer({ storage });

async function queryTable<T>(
  candidates: string[],
  sqlBuilder: (tableQuoted: string) => string,
  params: any[]
): Promise<T[]> {
  let lastErr: any = null;
  for (const t of candidates) {
    try {
      const rows = await pgQuery<T>(sqlBuilder(t), params);
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

async function listFiles(companyId: number, searchParam: string, pageNumber: number) {
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const filesTableCandidates = [quoteIdent("Files"), "files"];
  const optTableCandidates = [quoteIdent("FilesOptions"), "filesoptions", "files_options"];

  const whereSearch = searchParam ? ` AND (f."name" ILIKE $2 OR f."message" ILIKE $2)` : "";
  const params = searchParam ? [companyId, `%${searchParam}%`, limit, offset] : [companyId, limit, offset];
  const rows = await queryTable<any>(
    filesTableCandidates,
    (t) =>
      `
      SELECT f.*
      FROM ${t} f
      WHERE f."companyId" = $1
      ${whereSearch}
      ORDER BY f.id DESC
      LIMIT $${searchParam ? 3 : 2} OFFSET $${searchParam ? 4 : 3}
    `,
    params
  );

  const ids = rows.map((r: any) => Number(r.id)).filter((n: any) => Number.isFinite(n));
  let optionsByFile: Record<number, any[]> = {};
  if (ids.length) {
    const optRows = await queryTable<any>(
      optTableCandidates,
      (t) => `SELECT * FROM ${t} WHERE "fileId" = ANY($1::int[]) ORDER BY id ASC`,
      [ids]
    );
    optionsByFile = optRows.reduce((acc: any, o: any) => {
      const fid = Number(o.fileId);
      if (!acc[fid]) acc[fid] = [];
      acc[fid].push(o);
      return acc;
    }, {});
  }

  const files = rows.map((f: any) => ({ ...f, options: optionsByFile[Number(f.id)] || [] }));
  return { files, hasMore: rows.length === limit };
}

router.get("/", async (req, res) => {
  try {
    const companyId = Number(req.tenantId);
    const pageNumber = Number(req.query.pageNumber || 1);
    const searchParam = normalizeText(req.query.searchParam).toLowerCase();
    const out = await listFiles(companyId, searchParam, pageNumber);
    return res.json(out);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "list error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const companyId = Number(req.tenantId);
    const id = Number(req.params.id);
    const filesTableCandidates = [quoteIdent("Files"), "files"];
    const optTableCandidates = [quoteIdent("FilesOptions"), "filesoptions", "files_options"];

    const rows = await queryTable<any>(
      filesTableCandidates,
      (t) => `SELECT * FROM ${t} WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
      [id, companyId]
    );
    const file = rows?.[0];
    if (!file) return res.status(404).json({ error: true, message: "not found" });

    const opts = await queryTable<any>(
      optTableCandidates,
      (t) => `SELECT * FROM ${t} WHERE "fileId" = $1 ORDER BY id ASC`,
      [id]
    );
    return res.json({ ...file, options: Array.isArray(opts) ? opts : [] });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "show error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const companyId = Number(req.tenantId);
    const name = normalizeText(req.body?.name);
    const message = normalizeText(req.body?.message);
    const options = Array.isArray(req.body?.options) ? req.body.options : [];
    if (!name) return res.status(400).json({ error: true, message: "name is required" });
    if (!message) return res.status(400).json({ error: true, message: "message is required" });

    const filesTableCandidates = [quoteIdent("Files"), "files"];
    const optTableCandidates = [quoteIdent("FilesOptions"), "filesoptions", "files_options"];

    const inserted = await queryTable<any>(
      filesTableCandidates,
      (t) =>
        `
        INSERT INTO ${t} ("companyId","name","message","createdAt","updatedAt")
        VALUES ($1,$2,$3,NOW(),NOW())
        RETURNING *
      `,
      [companyId, name, message]
    );
    const file = inserted?.[0];
    if (!file) return res.status(500).json({ error: true, message: "create failed" });

    let createdOpts: any[] = [];
    if (options.length) {
      for (const opt of options) {
        const optName = normalizeText(opt?.name);
        const rows = await queryTable<any>(
          optTableCandidates,
          (t) =>
            `
            INSERT INTO ${t} ("fileId","name","path","mediaType","createdAt","updatedAt")
            VALUES ($1,$2,'','',NOW(),NOW())
            RETURNING *
          `,
          [Number(file.id), optName]
        );
        if (rows?.[0]) createdOpts.push(rows[0]);
      }
    }
    return res.status(201).json({ ...file, options: createdOpts });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "create error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const companyId = Number(req.tenantId);
    const id = Number(req.params.id);
    const name = normalizeText(req.body?.name);
    const message = normalizeText(req.body?.message);
    const options = Array.isArray(req.body?.options) ? req.body.options : [];
    if (!name) return res.status(400).json({ error: true, message: "name is required" });
    if (!message) return res.status(400).json({ error: true, message: "message is required" });

    const filesTableCandidates = [quoteIdent("Files"), "files"];
    const optTableCandidates = [quoteIdent("FilesOptions"), "filesoptions", "files_options"];

    const updated = await queryTable<any>(
      filesTableCandidates,
      (t) =>
        `
        UPDATE ${t}
        SET "name" = $1, "message" = $2, "updatedAt" = NOW()
        WHERE id = $3 AND "companyId" = $4
        RETURNING *
      `,
      [name, message, id, companyId]
    );
    const file = updated?.[0];
    if (!file) return res.status(404).json({ error: true, message: "not found" });

    // sync options
    const existing = await queryTable<any>(
      optTableCandidates,
      (t) => `SELECT id FROM ${t} WHERE "fileId" = $1`,
      [id]
    );
    const existingIds = new Set((existing || []).map((r: any) => Number(r.id)));
    const keepIds = new Set<number>();
    const outOpts: any[] = [];

    for (const opt of options) {
      const optId = toInt(opt?.id, null);
      const optName = normalizeText(opt?.name);
      if (optId && existingIds.has(optId)) {
        keepIds.add(optId);
        const rows = await queryTable<any>(
          optTableCandidates,
          (t) =>
            `
            UPDATE ${t}
            SET "name" = $1, "updatedAt" = NOW()
            WHERE id = $2 AND "fileId" = $3
            RETURNING *
          `,
          [optName, optId, id]
        );
        if (rows?.[0]) outOpts.push(rows[0]);
      } else {
        const rows = await queryTable<any>(
          optTableCandidates,
          (t) =>
            `
            INSERT INTO ${t} ("fileId","name","path","mediaType","createdAt","updatedAt")
            VALUES ($1,$2,'','',NOW(),NOW())
            RETURNING *
          `,
          [id, optName]
        );
        const created = rows?.[0];
        if (created) {
          keepIds.add(Number(created.id));
          outOpts.push(created);
        }
      }
    }

    const toDelete = Array.from(existingIds).filter((x) => !keepIds.has(x));
    if (toDelete.length) {
      await queryTable<any>(
        optTableCandidates,
        (t) => `DELETE FROM ${t} WHERE "fileId" = $1 AND id = ANY($2::int[])`,
        [id, toDelete]
      );
    }

    return res.json({ ...file, options: outOpts });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "update error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const companyId = Number(req.tenantId);
    const id = Number(req.params.id);
    const filesTableCandidates = [quoteIdent("Files"), "files"];
    const optTableCandidates = [quoteIdent("FilesOptions"), "filesoptions", "files_options"];

    await queryTable<any>(
      optTableCandidates,
      (t) => `DELETE FROM ${t} WHERE "fileId" = $1`,
      [id]
    );
    const rows = await queryTable<any>(
      filesTableCandidates,
      (t) => `DELETE FROM ${t} WHERE id = $1 AND "companyId" = $2 RETURNING id`,
      [id, companyId]
    );
    if (!rows?.[0]) return res.status(404).json({ error: true, message: "not found" });
    return res.status(204).end();
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "delete error" });
  }
});

router.post("/uploadList/:id", upload.array("files"), async (req: any, res) => {
  try {
    const companyId = Number(req.tenantId);
    const fileId = Number(req.params.id);
    const optTableCandidates = [quoteIdent("FilesOptions"), "filesoptions", "files_options"];
    const filesTableCandidates = [quoteIdent("Files"), "files"];

    // ensure file belongs to company
    const frows = await queryTable<any>(
      filesTableCandidates,
      (t) => `SELECT id FROM ${t} WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
      [fileId, companyId]
    );
    if (!frows?.[0]) return res.status(404).json({ error: true, message: "not found" });

    const uploaded = Array.isArray(req.files) ? req.files : [];
    const ids = req.body?.id;
    const mediaType = req.body?.mediaType;

    for (let idx = 0; idx < uploaded.length; idx++) {
      const file = uploaded[idx];
      const optionId = Array.isArray(ids) ? Number(ids[idx]) : Number(ids);
      const mt = Array.isArray(mediaType) ? String(mediaType[idx] || "") : String(mediaType || "");
      if (!optionId || !file?.filename) continue;

      await queryTable<any>(
        optTableCandidates,
        (t) =>
          `
          UPDATE ${t}
          SET "path" = $1, "mediaType" = $2, "updatedAt" = NOW()
          WHERE id = $3 AND "fileId" = $4
        `,
        [String(file.filename).replace(/\//g, "-"), mt, optionId, fileId]
      );
    }

    return res.json({ message: "Arquivos atualizados" });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "upload error" });
  }
});

export default router;





