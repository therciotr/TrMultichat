import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { getIO } from "../../libs/socket";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

router.use(authMiddleware);

function setNoCache(res: any) {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("ETag", "0");
    res.setHeader("Last-Modified", "0");
  } catch {}
}

function tenantIdFromReq(req: any): number {
  return Number(req?.tenantId || 0);
}

function userIdFromReq(req: any): number {
  return Number(req?.userId || 0);
}

async function getRequester(req: any): Promise<{ id: number; companyId: number; profile: string; super: boolean }> {
  const id = userIdFromReq(req);
  const companyId = tenantIdFromReq(req);
  try {
    const rows = await pgQuery<any>(
      `SELECT id, "companyId", profile, COALESCE(super,false) as super FROM "Users" WHERE id = $1 LIMIT 1`,
      [id]
    );
    const u = rows?.[0] || {};
    return {
      id: Number(u.id || id),
      companyId: Number(u.companyId || companyId),
      profile: String(u.profile || "user"),
      super: Boolean(u.super)
    };
  } catch {
    return { id, companyId, profile: "user", super: false };
  }
}

function isAdminLike(u: { profile: string; super: boolean }): boolean {
  const p = String(u.profile || "").toLowerCase();
  return Boolean(u.super) || p === "admin" || p === "super";
}

async function ensureAnnouncementsSchema() {
  // Add columns for targeting and replies if missing.
  // Announcements table exists in this project as "Announcements".
  try {
    await pgQuery(
      `ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "targetUserId" integer NULL`,
      []
    );
  } catch {}
  try {
    await pgQuery(
      `ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "sendToAll" boolean NOT NULL DEFAULT true`,
      []
    );
  } catch {}
  try {
    await pgQuery(
      `ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "allowReply" boolean NOT NULL DEFAULT false`,
      []
    );
  } catch {}
  try {
    await pgQuery(
      `ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "userId" integer NULL`,
      []
    );
  } catch {}

  // Archive / finalize support (premium)
  try {
    await pgQuery(
      `ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "archived" boolean NOT NULL DEFAULT false`,
      []
    );
  } catch {}
  try {
    await pgQuery(
      `ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "archivedAt" timestamp with time zone NULL`,
      []
    );
  } catch {}
  try {
    await pgQuery(
      `ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "archivedById" integer NULL`,
      []
    );
  } catch {}

  // FK for archivedById
  try {
    await pgQuery(
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints
           WHERE constraint_type = 'FOREIGN KEY'
             AND table_name = 'Announcements'
             AND constraint_name = 'Announcements_archivedById_fkey'
         ) THEN
           ALTER TABLE "Announcements"
           ADD CONSTRAINT "Announcements_archivedById_fkey"
           FOREIGN KEY ("archivedById") REFERENCES "Users"(id)
           ON UPDATE CASCADE ON DELETE SET NULL;
         END IF;
       END$$;`,
      []
    );
  } catch {}

  // FK to Users (best-effort; ignore if constraint exists or fails)
  try {
    await pgQuery(
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints
           WHERE constraint_type = 'FOREIGN KEY'
             AND table_name = 'Announcements'
             AND constraint_name = 'Announcements_targetUserId_fkey'
         ) THEN
           ALTER TABLE "Announcements"
           ADD CONSTRAINT "Announcements_targetUserId_fkey"
           FOREIGN KEY ("targetUserId") REFERENCES "Users"(id)
           ON UPDATE CASCADE ON DELETE SET NULL;
         END IF;
       END$$;`,
      []
    );
  } catch {}

  // FK for sender userId
  try {
    await pgQuery(
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints
           WHERE constraint_type = 'FOREIGN KEY'
             AND table_name = 'Announcements'
             AND constraint_name = 'Announcements_userId_fkey'
         ) THEN
           ALTER TABLE "Announcements"
           ADD CONSTRAINT "Announcements_userId_fkey"
           FOREIGN KEY ("userId") REFERENCES "Users"(id)
           ON UPDATE CASCADE ON DELETE SET NULL;
         END IF;
       END$$;`,
      []
    );
  } catch {}

  // Replies table
  try {
    await pgQuery(
      `
      CREATE TABLE IF NOT EXISTS "AnnouncementReplies" (
        id SERIAL PRIMARY KEY,
        "announcementId" integer NOT NULL REFERENCES "Announcements"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "userId" integer NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "companyId" integer NOT NULL REFERENCES "Companies"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        text text NOT NULL,
        "mediaPath" text NULL,
        "mediaName" text NULL,
        "mediaType" text NULL,
        "createdAt" timestamp with time zone NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp with time zone NOT NULL DEFAULT NOW()
      )
      `,
      []
    );
    await pgQuery(
      `CREATE INDEX IF NOT EXISTS "AnnouncementReplies_announcementId_idx" ON "AnnouncementReplies" ("announcementId")`,
      []
    );
    await pgQuery(
      `CREATE INDEX IF NOT EXISTS "AnnouncementReplies_companyId_idx" ON "AnnouncementReplies" ("companyId")`,
      []
    );
  } catch {}

  // If the table already existed (older deployments), ensure new media columns exist.
  try {
    await pgQuery(`ALTER TABLE "AnnouncementReplies" ADD COLUMN IF NOT EXISTS "mediaPath" text NULL`, []);
  } catch {}
  try {
    await pgQuery(`ALTER TABLE "AnnouncementReplies" ADD COLUMN IF NOT EXISTS "mediaName" text NULL`, []);
  } catch {}
  try {
    await pgQuery(`ALTER TABLE "AnnouncementReplies" ADD COLUMN IF NOT EXISTS "mediaType" text NULL`, []);
  } catch {}

  // Backfill sender userId for old announcements (avoid "De: Sistema")
  // Strategy: set to first admin/super user of the company; if none, first user in company.
  try {
    await pgQuery(
      `
      UPDATE "Announcements" a
      SET "userId" = u.id
      FROM LATERAL (
        SELECT id
        FROM "Users" u
        WHERE u."companyId" = a."companyId"
          AND LOWER(COALESCE(u.profile,'')) IN ('admin','super')
        ORDER BY u.id ASC
        LIMIT 1
      ) u
      WHERE a."userId" IS NULL AND u.id IS NOT NULL
      `,
      []
    );
  } catch {}
  try {
    await pgQuery(
      `
      UPDATE "Announcements" a
      SET "userId" = u.id
      FROM LATERAL (
        SELECT id
        FROM "Users" u
        WHERE u."companyId" = a."companyId"
        ORDER BY u.id ASC
        LIMIT 1
      ) u
      WHERE a."userId" IS NULL AND u.id IS NOT NULL
      `,
      []
    );
  } catch {}
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "announcements");
try {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch {}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || "file").replace(/[^\w.\-]+/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({ storage });

const REPLIES_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "chat-interno");
try {
  if (!fs.existsSync(REPLIES_UPLOAD_DIR)) fs.mkdirSync(REPLIES_UPLOAD_DIR, { recursive: true });
} catch {}
const repliesStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, REPLIES_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || "file").replace(/[^\w.\-]+/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  }
});
const repliesUpload = multer({ storage: repliesStorage });

// Multer must only run for multipart/form-data. If a JSON request hits multer, it can throw
// "Multipart: Boundary not found" and break text-only replies.
function maybeRepliesUpload(req: any, res: any, next: any) {
  const ct = String(req?.headers?.["content-type"] || "").toLowerCase();
  if (ct.includes("multipart/form-data")) {
    return (repliesUpload.single("file") as any)(req, res, next);
  }
  return next();
}

router.get("/", async (req, res) => {
  setNoCache(res);
  await ensureAnnouncementsSchema();

  const companyId = tenantIdFromReq(req);
  const userId = userIdFromReq(req);
  if (!companyId || !userId) return res.status(401).json({ error: true, message: "missing auth context" });

  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const searchParam = String(req.query.searchParam || "").trim();

  const requester = await getRequester(req);
  const isAdmin = isAdminLike(requester);

  const archivedParamRaw = String(req.query.archived || "").toLowerCase(); // "true" | "false" | "all" | ""
  const includeArchived = ["1", "true", "yes"].includes(String(req.query.includeArchived || "").toLowerCase());
  const filterTargetUserId = Number(req.query.targetUserId || 0);
  const filterSenderUserId = Number(req.query.senderUserId || 0);
  const dateFromRaw = String(req.query.dateFrom || "").trim();
  const dateToRaw = String(req.query.dateTo || "").trim();

  // Visibility:
  // - admin: all announcements in company (including inactive)
  // - user: only active announcements where sendToAll=true or targetUserId=userId
  const whereParts: string[] = [`a."companyId" = $1`];
  const params: any[] = [companyId];

  if (!isAdmin) {
    whereParts.push(`COALESCE(a.status, true) = true`);
    params.push(userId);
    whereParts.push(`(COALESCE(a."sendToAll", true) = true OR a."targetUserId" = $${params.length})`);
  }

  // Archive filter (default: show only open/unarchived)
  const archivedWhere = (() => {
    if (archivedParamRaw === "all") return undefined;
    if (archivedParamRaw === "true" || archivedParamRaw === "1") return true;
    if (archivedParamRaw === "false" || archivedParamRaw === "0") return false;
    // default: open only for everyone, unless user explicitly asked to include archived
    if (!isAdmin) return includeArchived ? undefined : false;
    return false;
  })();
  if (archivedWhere !== undefined) {
    params.push(Boolean(archivedWhere));
    whereParts.push(`COALESCE(a."archived", false) = $${params.length}`);
  }

  // Admin filters: by recipient/sender
  if (isAdmin && filterTargetUserId) {
    params.push(filterTargetUserId);
    whereParts.push(`a."targetUserId" = $${params.length}`);
  }
  if (isAdmin && filterSenderUserId) {
    params.push(filterSenderUserId);
    whereParts.push(`a."userId" = $${params.length}`);
  }

  // Date range filter based on activity (last reply or updated/created)
  const parseDate = (v: string): Date | null => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
  };
  const dateFrom = parseDate(dateFromRaw);
  const dateTo = parseDate(dateToRaw);
  if (dateFrom) {
    params.push(dateFrom.toISOString());
    whereParts.push(`COALESCE(last."lastReplyAt", a."updatedAt", a."createdAt") >= $${params.length}`);
  }
  if (dateTo) {
    // inclusive end-of-day if date-only
    let d = dateTo;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateToRaw)) {
      d = new Date(`${dateToRaw}T23:59:59.999Z`);
    }
    params.push(d.toISOString());
    whereParts.push(`COALESCE(last."lastReplyAt", a."updatedAt", a."createdAt") <= $${params.length}`);
  }

  if (searchParam) {
    params.push(`%${searchParam}%`);
    const idx = params.length;
    whereParts.push(`(a.title ILIKE $${idx} OR a.text ILIKE $${idx})`);
  }

  params.push(limit);
  params.push(offset);

  const rows = await pgQuery<any>(
    `
      SELECT
        a.id, a.priority, a.title, a.text, a."mediaPath", a."mediaName",
        a."companyId", a.status, a."createdAt", a."updatedAt",
        a."userId",
        su.name as "senderName",
        COALESCE(a."sendToAll", true) as "sendToAll",
        a."targetUserId",
        tu.name as "targetUserName",
        COALESCE(a."allowReply", false) as "allowReply",
        COALESCE(a."archived", false) as "archived",
        a."archivedAt",
        a."archivedById",
        abu.name as "archivedByName",
        COALESCE(stats."repliesCount", 0)::int as "repliesCount",
        COALESCE(stats."attachmentsCount", 0)::int as "attachmentsCount",
        last."lastReplyAt" as "lastReplyAt",
        last."lastReplyUserName" as "lastReplyUserName",
        last."lastReplyText" as "lastReplyText",
        last."lastReplyMediaName" as "lastReplyMediaName",
        last."lastReplyMediaType" as "lastReplyMediaType"
      FROM "Announcements" a
      LEFT JOIN "Users" tu ON tu.id = a."targetUserId"
      LEFT JOIN "Users" su ON su.id = a."userId"
      LEFT JOIN "Users" abu ON abu.id = a."archivedById"
      LEFT JOIN LATERAL (
        SELECT
          COUNT(1)::int as "repliesCount",
          COUNT(1) FILTER (WHERE r."mediaPath" IS NOT NULL)::int as "attachmentsCount"
        FROM "AnnouncementReplies" r
        WHERE r."companyId" = a."companyId" AND r."announcementId" = a.id
      ) stats ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          r."createdAt" as "lastReplyAt",
          u.name as "lastReplyUserName",
          r.text as "lastReplyText",
          r."mediaName" as "lastReplyMediaName",
          r."mediaType" as "lastReplyMediaType"
        FROM "AnnouncementReplies" r
        JOIN "Users" u ON u.id = r."userId"
        WHERE r."companyId" = a."companyId" AND r."announcementId" = a.id
        ORDER BY r."createdAt" DESC
        LIMIT 1
      ) last ON TRUE
      WHERE ${whereParts.join(" AND ")}
      ORDER BY a."createdAt" DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );
  const records = Array.isArray(rows) ? rows : [];
  return res.json({ records, hasMore: records.length === limit });
});

router.get("/:id", async (req, res) => {
  setNoCache(res);
  await ensureAnnouncementsSchema();
  const companyId = tenantIdFromReq(req);
  const userId = userIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId || !userId) return res.status(401).json({ error: true, message: "missing auth context" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const requester = await getRequester(req);
  const isAdmin = isAdminLike(requester);

  const rows = await pgQuery<any>(
    `
      SELECT
        a.id, a.priority, a.title, a.text, a."mediaPath", a."mediaName",
        a."companyId", a.status, a."createdAt", a."updatedAt",
        a."userId",
        su.name as "senderName",
        COALESCE(a."sendToAll", true) as "sendToAll",
        a."targetUserId",
        tu.name as "targetUserName",
        COALESCE(a."allowReply", false) as "allowReply",
        COALESCE(a."archived", false) as "archived",
        a."archivedAt",
        a."archivedById",
        abu.name as "archivedByName"
      FROM "Announcements" a
      LEFT JOIN "Users" tu ON tu.id = a."targetUserId"
      LEFT JOIN "Users" su ON su.id = a."userId"
      LEFT JOIN "Users" abu ON abu.id = a."archivedById"
      WHERE a.id = $1 AND a."companyId" = $2
      LIMIT 1
    `,
    [id, companyId]
  );
  const record = rows?.[0];
  if (!record) return res.status(404).json({ error: true, message: "not found" });

  if (!isAdmin) {
    const canSee = Boolean(record.status !== false) && (Boolean(record.sendToAll) || Number(record.targetUserId || 0) === userId);
    if (!canSee) return res.status(403).json({ error: true, message: "forbidden" });
  }
  return res.json(record);
});

router.post("/", async (req, res) => {
  setNoCache(res);
  await ensureAnnouncementsSchema();
  const companyId = tenantIdFromReq(req);
  const requester = await getRequester(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!isAdminLike(requester)) return res.status(403).json({ error: true, message: "forbidden" });

  const body = req.body || {};
  const title = String(body.title || "").trim();
  const text = String(body.text || "").trim();
  const priority = Number(body.priority || 3) || 3;
  const status = body.status === false ? false : true;

  const sendToAll = body.sendToAll === false ? false : true;
  const targetUserId = !sendToAll && body.targetUserId !== undefined && body.targetUserId !== null ? Number(body.targetUserId) : null;
  const allowReply = body.allowReply === true;

  if (!title || !text) return res.status(400).json({ error: true, message: "title and text are required" });

  // validate target user belongs to company
  if (!sendToAll && targetUserId) {
    const u = await pgQuery<any>(`SELECT id FROM "Users" WHERE id = $1 AND "companyId" = $2 LIMIT 1`, [targetUserId, companyId]);
    if (!u?.[0]?.id) return res.status(400).json({ error: true, message: "invalid targetUserId" });
  }

  const now = new Date();
  const rows = await pgQuery<any>(
    `
      INSERT INTO "Announcements" (priority, title, text, "companyId", status, "createdAt", "updatedAt", "sendToAll", "targetUserId", "allowReply", "userId")
      VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10)
      RETURNING id
    `,
    [priority, title, text, companyId, status, now, sendToAll, targetUserId, allowReply, requester.id]
  );
  const createdId = Number(rows?.[0]?.id || 0);
  const full = await pgQuery<any>(
    `
      SELECT
        a.id, a.priority, a.title, a.text, a."mediaPath", a."mediaName",
        a."companyId", a.status, a."createdAt", a."updatedAt",
        a."userId", su.name as "senderName",
        COALESCE(a."sendToAll", true) as "sendToAll",
        a."targetUserId", tu.name as "targetUserName",
        COALESCE(a."allowReply", false) as "allowReply"
      FROM "Announcements" a
      LEFT JOIN "Users" tu ON tu.id = a."targetUserId"
      LEFT JOIN "Users" su ON su.id = a."userId"
      WHERE a.id = $1 AND a."companyId" = $2
      LIMIT 1
    `,
    [createdId, companyId]
  );
  const record = full?.[0];

  try {
    const io = getIO();
    io.emit("company-announcement", { action: "create", record });
  } catch {}

  return res.status(201).json(record);
});

router.put("/:id", async (req, res) => {
  setNoCache(res);
  await ensureAnnouncementsSchema();
  const companyId = tenantIdFromReq(req);
  const requester = await getRequester(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!isAdminLike(requester)) return res.status(403).json({ error: true, message: "forbidden" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const body = req.body || {};
  const title = body.title !== undefined ? String(body.title || "").trim() : undefined;
  const text = body.text !== undefined ? String(body.text || "").trim() : undefined;
  const priority = body.priority !== undefined ? Number(body.priority || 3) || 3 : undefined;
  const status = body.status !== undefined ? (body.status === false ? false : true) : undefined;
  const sendToAll = body.sendToAll !== undefined ? (body.sendToAll === false ? false : true) : undefined;
  const allowReply = body.allowReply !== undefined ? Boolean(body.allowReply) : undefined;
  const archived = body.archived !== undefined ? Boolean(body.archived) : undefined;
  const targetUserIdRaw = body.targetUserId !== undefined ? body.targetUserId : undefined;

  // current row
  const existing = await pgQuery<any>(`SELECT * FROM "Announcements" WHERE id = $1 AND "companyId" = $2 LIMIT 1`, [id, companyId]);
  const current = existing?.[0];
  if (!current) return res.status(404).json({ error: true, message: "not found" });

  const nextSendToAll = sendToAll !== undefined ? sendToAll : Boolean(current.sendToAll ?? true);
  let nextTargetUserId: number | null = current.targetUserId ?? null;
  if (nextSendToAll) {
    nextTargetUserId = null;
  } else if (targetUserIdRaw !== undefined) {
    const n = targetUserIdRaw === null || targetUserIdRaw === "" ? null : Number(targetUserIdRaw);
    nextTargetUserId = Number.isFinite(n as any) ? (n as any) : null;
  }

  if (!nextSendToAll && nextTargetUserId) {
    const u = await pgQuery<any>(`SELECT id FROM "Users" WHERE id = $1 AND "companyId" = $2 LIMIT 1`, [nextTargetUserId, companyId]);
    if (!u?.[0]?.id) return res.status(400).json({ error: true, message: "invalid targetUserId" });
  }

  const now = new Date();
  const nextArchived = archived !== undefined ? archived : Boolean(current.archived ?? false);
  const nextArchivedAt = nextArchived ? now : null;
  const nextArchivedById = nextArchived ? requester.id : null;
  const updated = await pgQuery<any>(
    `
      UPDATE "Announcements"
      SET
        priority = COALESCE($1, priority),
        title = COALESCE($2, title),
        text = COALESCE($3, text),
        status = COALESCE($4, status),
        "sendToAll" = COALESCE($5, "sendToAll"),
        "targetUserId" = $6,
        "allowReply" = COALESCE($7, "allowReply"),
        "archived" = $8,
        "archivedAt" = $9,
        "archivedById" = $10,
        "updatedAt" = $11
      WHERE id = $12 AND "companyId" = $13
      RETURNING id
    `,
    [
      priority ?? null,
      title ?? null,
      text ?? null,
      status ?? null,
      sendToAll ?? null,
      nextTargetUserId,
      allowReply ?? null,
      nextArchived,
      nextArchivedAt,
      nextArchivedById,
      now,
      id,
      companyId
    ]
  );
  const updatedId = Number(updated?.[0]?.id || 0);
  const full = await pgQuery<any>(
    `
      SELECT
        a.id, a.priority, a.title, a.text, a."mediaPath", a."mediaName",
        a."companyId", a.status, a."createdAt", a."updatedAt",
        a."userId", su.name as "senderName",
        COALESCE(a."sendToAll", true) as "sendToAll",
        a."targetUserId", tu.name as "targetUserName",
        COALESCE(a."allowReply", false) as "allowReply",
        COALESCE(a."archived", false) as "archived",
        a."archivedAt",
        a."archivedById",
        abu.name as "archivedByName"
      FROM "Announcements" a
      LEFT JOIN "Users" tu ON tu.id = a."targetUserId"
      LEFT JOIN "Users" su ON su.id = a."userId"
      LEFT JOIN "Users" abu ON abu.id = a."archivedById"
      WHERE a.id = $1 AND a."companyId" = $2
      LIMIT 1
    `,
    [updatedId, companyId]
  );
  const record = full?.[0];

  try {
    const io = getIO();
    io.emit("company-announcement", { action: "update", record });
  } catch {}

  return res.json(record);
});

router.delete("/:id", async (req, res) => {
  setNoCache(res);
  await ensureAnnouncementsSchema();
  const companyId = tenantIdFromReq(req);
  const requester = await getRequester(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!isAdminLike(requester)) return res.status(403).json({ error: true, message: "forbidden" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  await pgQuery<any>(`DELETE FROM "Announcements" WHERE id = $1 AND "companyId" = $2`, [id, companyId]);
  try {
    const io = getIO();
    io.emit("company-announcement", { action: "delete", id });
  } catch {}
  return res.status(200).json({ ok: true });
});

router.post("/:id/media-upload", upload.single("file"), async (req, res) => {
  setNoCache(res);
  await ensureAnnouncementsSchema();
  const companyId = tenantIdFromReq(req);
  const requester = await getRequester(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!isAdminLike(requester)) return res.status(403).json({ error: true, message: "forbidden" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const file = (req as any).file as any;
  if (!file) return res.status(400).json({ error: true, message: "missing file" });
  const mediaName = String(file.originalname || "");
  const mediaPath = `uploads/announcements/${String(file.filename)}`;

  const updated = await pgQuery<any>(
    `UPDATE "Announcements" SET "mediaName" = $1, "mediaPath" = $2, "updatedAt" = NOW() WHERE id = $3 AND "companyId" = $4 RETURNING *`,
    [mediaName, mediaPath, id, companyId]
  );
  const record = updated?.[0];

  try {
    const io = getIO();
    io.emit("company-announcement", { action: "update", record });
  } catch {}

  return res.json({ ok: true, mediaPath, mediaName });
});

router.delete("/:id/media-upload", async (req, res) => {
  setNoCache(res);
  await ensureAnnouncementsSchema();
  const companyId = tenantIdFromReq(req);
  const requester = await getRequester(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!isAdminLike(requester)) return res.status(403).json({ error: true, message: "forbidden" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const rows = await pgQuery<any>(`SELECT "mediaPath" FROM "Announcements" WHERE id = $1 AND "companyId" = $2 LIMIT 1`, [id, companyId]);
  const mediaPath = String(rows?.[0]?.mediaPath || "");
  if (mediaPath) {
    try {
      const abs = path.join(process.cwd(), "public", mediaPath);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch {}
  }
  const updated = await pgQuery<any>(
    `UPDATE "Announcements" SET "mediaName" = NULL, "mediaPath" = NULL, "updatedAt" = NOW() WHERE id = $1 AND "companyId" = $2 RETURNING *`,
    [id, companyId]
  );
  const record = updated?.[0];

  try {
    const io = getIO();
    io.emit("company-announcement", { action: "update", record });
  } catch {}

  return res.json({ ok: true });
});

// Replies
router.get("/:id/replies", async (req, res) => {
  setNoCache(res);
  await ensureAnnouncementsSchema();
  const companyId = tenantIdFromReq(req);
  const userId = userIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId || !userId) return res.status(401).json({ error: true, message: "missing auth context" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const requester = await getRequester(req);
  const isAdmin = isAdminLike(requester);

  const arows = await pgQuery<any>(
    `SELECT id, status, COALESCE("sendToAll", true) as "sendToAll", "targetUserId", COALESCE("allowReply", false) as "allowReply" FROM "Announcements" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  const ann = arows?.[0];
  if (!ann) return res.status(404).json({ error: true, message: "not found" });

  if (!isAdmin) {
    const canSee = Boolean(ann.status !== false) && (Boolean(ann.sendToAll) || Number(ann.targetUserId || 0) === userId);
    if (!canSee) return res.status(403).json({ error: true, message: "forbidden" });
  }

  const rows = await pgQuery<any>(
    `
      SELECT r.id, r.text, r."mediaPath", r."mediaName", r."mediaType", r."createdAt", r."updatedAt",
             u.id as "userId", u.name as "userName", u.email as "userEmail"
      FROM "AnnouncementReplies" r
      JOIN "Users" u ON u.id = r."userId"
      WHERE r."companyId" = $1 AND r."announcementId" = $2
      ORDER BY r."createdAt" ASC
    `,
    [companyId, id]
  );
  return res.json({ records: Array.isArray(rows) ? rows : [] });
});

router.post("/:id/replies", maybeRepliesUpload, async (req, res) => {
  setNoCache(res);
  await ensureAnnouncementsSchema();
  const companyId = tenantIdFromReq(req);
  const userId = userIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId || !userId) return res.status(401).json({ error: true, message: "missing auth context" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const file = (req as any).file as any;
  const text = String((req.body as any)?.text || "").trim();
  if (!text && !file) return res.status(400).json({ error: true, message: "text or file is required" });

  const requester = await getRequester(req);
  const isAdmin = isAdminLike(requester);

  const arows = await pgQuery<any>(
    `SELECT id, status, COALESCE("sendToAll", true) as "sendToAll", "targetUserId", COALESCE("allowReply", false) as "allowReply" FROM "Announcements" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  const ann = arows?.[0];
  if (!ann) return res.status(404).json({ error: true, message: "not found" });

  if (!isAdmin) {
    const canSee = Boolean(ann.status !== false) && (Boolean(ann.sendToAll) || Number(ann.targetUserId || 0) === userId);
    if (!canSee) return res.status(403).json({ error: true, message: "forbidden" });
  }

  // allowReply gates USER replies; admins can always reply (internal notes)
  if (!isAdmin && !Boolean(ann.allowReply)) {
    return res.status(409).json({ error: true, message: "replies disabled for this announcement" });
  }

  const now = new Date();
  const mediaName = file ? String(file.originalname || "") : null;
  const mediaPath = file ? `uploads/chat-interno/${String(file.filename)}` : null;
  const mediaType = file ? String(file.mimetype || "") : null;
  const rows = await pgQuery<any>(
    `
      INSERT INTO "AnnouncementReplies" ("announcementId", "userId", "companyId", text, "mediaPath", "mediaName", "mediaType", "createdAt", "updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
      RETURNING id, text, "mediaPath", "mediaName", "mediaType", "createdAt", "updatedAt"
    `,
    [id, userId, companyId, text || "", mediaPath, mediaName, mediaType, now]
  );
  const record = rows?.[0];
  let userName: string | undefined = undefined;
  try {
    const urows = await pgQuery<any>(`SELECT name FROM "Users" WHERE id = $1 LIMIT 1`, [userId]);
    userName = String(urows?.[0]?.name || "");
  } catch {}

  // Fetch full announcement context (sender + target names) for richer notifications
  let announcementRecord: any = undefined;
  try {
    const aFull = await pgQuery<any>(
      `
        SELECT
          a.id, a.title, a.text, a."companyId", a.status, a."createdAt", a."updatedAt",
          a."userId", su.name as "senderName",
          COALESCE(a."sendToAll", true) as "sendToAll",
          a."targetUserId", tu.name as "targetUserName",
          COALESCE(a."allowReply", false) as "allowReply"
        FROM "Announcements" a
        LEFT JOIN "Users" tu ON tu.id = a."targetUserId"
        LEFT JOIN "Users" su ON su.id = a."userId"
        WHERE a.id = $1 AND a."companyId" = $2
        LIMIT 1
      `,
      [id, companyId]
    );
    announcementRecord = aFull?.[0];
  } catch {}

  try {
    const io = getIO();
    io.emit("company-announcement", {
      action: "reply",
      announcementId: id,
      record: announcementRecord,
      reply: { ...record, userId, userName },
      sendToAll: Boolean(ann.sendToAll),
      targetUserId: ann.targetUserId ?? null,
      status: ann.status !== false
    });
  } catch {}

  return res.status(201).json(record);
});

export default router;





