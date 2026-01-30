import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { getIO } from "../../libs/socket";

const router = Router();

function tenantIdFromReq(req: any): number {
  return Number(req?.tenantId || 0);
}

function userIdFromReq(req: any): number {
  return Number(req?.userId || (req as any)?.userId || 0);
}

function isAdminProfile(profile: any): boolean {
  const p = String(profile || "").toLowerCase();
  return p === "admin" || p === "super";
}

async function getRequester(req: any): Promise<{
  id: number;
  companyId: number;
  profile: string;
  super: boolean;
}> {
  const id = userIdFromReq(req);
  const companyId = tenantIdFromReq(req);
  if (!id || !companyId) return { id, companyId, profile: "user", super: false };
  try {
    const rows = await pgQuery<any>(
      `SELECT id, "companyId", profile, COALESCE(super,false) as super FROM "Users" WHERE id = $1 LIMIT 1`,
      [id]
    );
    const u = rows?.[0] || {};
    return {
      id,
      companyId: Number(u.companyId || companyId),
      profile: String(u.profile || "user"),
      super: Boolean(u.super),
    };
  } catch {
    return { id, companyId, profile: "user", super: false };
  }
}

async function ensureQuickMessagesSchema() {
  // Adds "category" if missing (non-breaking)
  try {
    const hasCol = await pgQuery<any>(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'QuickMessages'
          AND column_name = 'category'
        LIMIT 1
      `,
      []
    );
    if (!hasCol?.length) {
      await pgQuery(`ALTER TABLE "QuickMessages" ADD COLUMN IF NOT EXISTS category VARCHAR(80)`, []);
    }
  } catch {
    // silent (avoid startup failing if permissions differ)
  }
}

async function ensureQuickMessagesMetaSchema() {
  // Non-breaking: create auxiliary tables for pins/usage if missing
  try {
    await pgQuery(
      `
        CREATE TABLE IF NOT EXISTS "QuickMessagePins" (
          "companyId" INTEGER NOT NULL,
          "userId" INTEGER NOT NULL,
          "quickMessageId" INTEGER NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY ("companyId", "userId", "quickMessageId")
        )
      `,
      []
    );
    await pgQuery(
      `
        CREATE TABLE IF NOT EXISTS "QuickMessageUsage" (
          "companyId" INTEGER NOT NULL,
          "userId" INTEGER NOT NULL,
          "quickMessageId" INTEGER NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          "lastUsedAt" TIMESTAMPTZ,
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY ("companyId", "userId", "quickMessageId")
        )
      `,
      []
    );
    await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_qm_usage_company_msg" ON "QuickMessageUsage" ("companyId", "quickMessageId")`, []);
    await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_qm_pins_company_msg" ON "QuickMessagePins" ("companyId", "quickMessageId")`, []);

    // Event log (enables period-based stats)
    await pgQuery(
      `
        CREATE TABLE IF NOT EXISTS "QuickMessageUsageEvents" (
          "companyId" INTEGER NOT NULL,
          "userId" INTEGER NOT NULL,
          "quickMessageId" INTEGER NOT NULL,
          delta INTEGER NOT NULL DEFAULT 1,
          "usedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `,
      []
    );
    await pgQuery(
      `CREATE INDEX IF NOT EXISTS "idx_qm_usage_events_company_usedat" ON "QuickMessageUsageEvents" ("companyId", "usedAt")`,
      []
    );
    await pgQuery(
      `CREATE INDEX IF NOT EXISTS "idx_qm_usage_events_company_user_usedat" ON "QuickMessageUsageEvents" ("companyId", "userId", "usedAt")`,
      []
    );
    await pgQuery(
      `CREATE INDEX IF NOT EXISTS "idx_qm_usage_events_company_msg_usedat" ON "QuickMessageUsageEvents" ("companyId", "quickMessageId", "usedAt")`,
      []
    );
  } catch {
    // silent
  }
}

function parseRangeToStart(range: any): Date | null {
  const r = String(range || "").toLowerCase().trim();
  if (!r || r === "total" || r === "all") return null;
  const now = new Date();
  if (r === "today" || r === "hoje") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (r === "7d" || r === "7") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (r === "30d" || r === "30") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const m = r.match(/^(\d{1,3})d$/);
  if (m?.[1]) {
    const n = Math.max(1, Math.min(365, Number(m[1])));
    return new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  }
  return null;
}

async function ensureQuickMessageBelongsToCompany(companyId: number, quickMessageId: number): Promise<boolean> {
  if (!companyId || !quickMessageId) return false;
  try {
    const rows = await pgQuery<any>(
      `SELECT id FROM "QuickMessages" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
      [quickMessageId, companyId]
    );
    return Boolean(rows?.[0]?.id);
  } catch {
    return false;
  }
}

// GET /quick-messages/meta - user pins + usage; admin-like also receives company totals
router.get("/meta", authMiddleware, async (req, res) => {
  await ensureQuickMessagesSchema();
  await ensureQuickMessagesMetaSchema();

  const companyId = tenantIdFromReq(req);
  const userId = userIdFromReq(req);
  if (!companyId || !userId) return res.status(401).json({ error: true, message: "missing auth context" });

  const requester = await getRequester(req);
  const isAdminLike = Boolean(requester.super) || isAdminProfile(requester.profile);

  const pinnedRows = await pgQuery<any>(
    `SELECT "quickMessageId" FROM "QuickMessagePins" WHERE "companyId" = $1 AND "userId" = $2`,
    [companyId, userId]
  );
  const usageRows = await pgQuery<any>(
    `SELECT "quickMessageId", count FROM "QuickMessageUsage" WHERE "companyId" = $1 AND "userId" = $2`,
    [companyId, userId]
  );

  const pinnedIds = (Array.isArray(pinnedRows) ? pinnedRows : []).map((r) => Number(r.quickMessageId || 0)).filter(Boolean);
  const usageById: Record<string, number> = {};
  for (const r of Array.isArray(usageRows) ? usageRows : []) {
    const id = Number(r.quickMessageId || 0);
    if (!id) continue;
    usageById[String(id)] = Number(r.count || 0);
  }

  if (!isAdminLike) return res.json({ pinnedIds, usageById });

  // Company totals for admin dashboard and management UI
  const totals = await pgQuery<any>(
    `
      SELECT "quickMessageId", SUM(count)::int AS total
      FROM "QuickMessageUsage"
      WHERE "companyId" = $1
      GROUP BY "quickMessageId"
    `,
    [companyId]
  );
  const pinCounts = await pgQuery<any>(
    `
      SELECT "quickMessageId", COUNT(1)::int AS total
      FROM "QuickMessagePins"
      WHERE "companyId" = $1
      GROUP BY "quickMessageId"
    `,
    [companyId]
  );
  const companyUsageById: Record<string, number> = {};
  const companyPinCountById: Record<string, number> = {};
  for (const r of Array.isArray(totals) ? totals : []) {
    const id = Number(r.quickMessageId || 0);
    if (!id) continue;
    companyUsageById[String(id)] = Number(r.total || 0);
  }
  for (const r of Array.isArray(pinCounts) ? pinCounts : []) {
    const id = Number(r.quickMessageId || 0);
    if (!id) continue;
    companyPinCountById[String(id)] = Number(r.total || 0);
  }

  return res.json({ pinnedIds, usageById, companyUsageById, companyPinCountById });
});

// POST /quick-messages/usage - batch increments (used by chat slash)
router.post("/usage", authMiddleware, async (req, res) => {
  await ensureQuickMessagesSchema();
  await ensureQuickMessagesMetaSchema();

  const companyId = tenantIdFromReq(req);
  const userId = userIdFromReq(req);
  if (!companyId || !userId) return res.status(401).json({ error: true, message: "missing auth context" });

  const body: any = req.body || {};
  const increments = Array.isArray(body.increments) ? body.increments : [];
  if (!increments.length) return res.json({ ok: true, applied: 0 });

  let applied = 0;
  for (const item of increments.slice(0, 50)) {
    const qid = Number(item?.id || item?.quickMessageId || 0);
    const delta = Math.max(1, Math.min(999, Number(item?.delta || 1)));
    if (!qid) continue;
    const ok = await ensureQuickMessageBelongsToCompany(companyId, qid);
    if (!ok) continue;

    // Event row (for period-based stats)
    await pgQuery(
      `
        INSERT INTO "QuickMessageUsageEvents" ("companyId", "userId", "quickMessageId", delta, "usedAt")
        VALUES ($1, $2, $3, $4, now())
      `,
      [companyId, userId, qid, delta]
    );

    await pgQuery(
      `
        INSERT INTO "QuickMessageUsage" ("companyId", "userId", "quickMessageId", count, "lastUsedAt", "updatedAt")
        VALUES ($1, $2, $3, $4, now(), now())
        ON CONFLICT ("companyId", "userId", "quickMessageId")
        DO UPDATE SET
          count = "QuickMessageUsage".count + EXCLUDED.count,
          "lastUsedAt" = now(),
          "updatedAt" = now()
      `,
      [companyId, userId, qid, delta]
    );
    applied += 1;
  }

  return res.json({ ok: true, applied });
});

// Pins: POST/DELETE
router.post("/pins/:id", authMiddleware, async (req, res) => {
  await ensureQuickMessagesSchema();
  await ensureQuickMessagesMetaSchema();
  const companyId = tenantIdFromReq(req);
  const userId = userIdFromReq(req);
  const qid = Number(req.params.id || 0);
  if (!companyId || !userId) return res.status(401).json({ error: true, message: "missing auth context" });
  if (!qid) return res.status(400).json({ error: true, message: "invalid id" });
  const ok = await ensureQuickMessageBelongsToCompany(companyId, qid);
  if (!ok) return res.status(404).json({ error: true, message: "not found" });

  await pgQuery(
    `
      INSERT INTO "QuickMessagePins" ("companyId", "userId", "quickMessageId", "createdAt")
      VALUES ($1, $2, $3, now())
      ON CONFLICT ("companyId", "userId", "quickMessageId") DO NOTHING
    `,
    [companyId, userId, qid]
  );
  return res.json({ ok: true });
});

router.delete("/pins/:id", authMiddleware, async (req, res) => {
  await ensureQuickMessagesSchema();
  await ensureQuickMessagesMetaSchema();
  const companyId = tenantIdFromReq(req);
  const userId = userIdFromReq(req);
  const qid = Number(req.params.id || 0);
  if (!companyId || !userId) return res.status(401).json({ error: true, message: "missing auth context" });
  if (!qid) return res.status(400).json({ error: true, message: "invalid id" });

  await pgQuery(
    `DELETE FROM "QuickMessagePins" WHERE "companyId" = $1 AND "userId" = $2 AND "quickMessageId" = $3`,
    [companyId, userId, qid]
  );
  return res.json({ ok: true });
});

// GET /quick-messages/stats - admin-like: company ranking
router.get("/stats", authMiddleware, async (req, res) => {
  await ensureQuickMessagesSchema();
  await ensureQuickMessagesMetaSchema();

  const companyId = tenantIdFromReq(req);
  const userId = userIdFromReq(req);
  if (!companyId || !userId) return res.status(401).json({ error: true, message: "missing auth context" });

  const requester = await getRequester(req);
  const isAdminLike = Boolean(requester.super) || isAdminProfile(requester.profile);

  if (!isAdminLike) return res.status(403).json({ error: true, message: "Forbidden" });

  const range = (req.query as any)?.range;
  const startAt = parseRangeToStart(range);
  const filterUserId = Number((req.query as any)?.userId || 0) || 0;

  const pinsSub =
    filterUserId > 0
      ? `SELECT "quickMessageId", COUNT(1) AS total FROM "QuickMessagePins" WHERE "companyId" = $1 AND "userId" = $2 GROUP BY "quickMessageId"`
      : `SELECT "quickMessageId", COUNT(1) AS total FROM "QuickMessagePins" WHERE "companyId" = $1 GROUP BY "quickMessageId"`;

  let usesSub = "";
  let params: any[] = [];
  if (!startAt) {
    // Total: fast path (cumulative table)
    usesSub =
      filterUserId > 0
        ? `SELECT "quickMessageId", SUM(count) AS total FROM "QuickMessageUsage" WHERE "companyId" = $1 AND "userId" = $2 GROUP BY "quickMessageId"`
        : `SELECT "quickMessageId", SUM(count) AS total FROM "QuickMessageUsage" WHERE "companyId" = $1 GROUP BY "quickMessageId"`;
    params = filterUserId > 0 ? [companyId, filterUserId] : [companyId];
  } else {
    // Period: accurate path (events table)
    usesSub =
      filterUserId > 0
        ? `SELECT "quickMessageId", SUM(delta) AS total FROM "QuickMessageUsageEvents" WHERE "companyId" = $1 AND "userId" = $2 AND "usedAt" >= $3 GROUP BY "quickMessageId"`
        : `SELECT "quickMessageId", SUM(delta) AS total FROM "QuickMessageUsageEvents" WHERE "companyId" = $1 AND "usedAt" >= $2 GROUP BY "quickMessageId"`;
    params = filterUserId > 0 ? [companyId, filterUserId, startAt.toISOString()] : [companyId, startAt.toISOString()];
  }

  const top = await pgQuery<any>(
    `
      SELECT qm.id, qm.shortcode, qm.message, qm.category,
             COALESCE(u.total,0)::int AS "totalUses",
             COALESCE(p.total,0)::int AS "totalPins"
      FROM "QuickMessages" qm
      LEFT JOIN (${usesSub}) u ON u."quickMessageId" = qm.id
      LEFT JOIN (${pinsSub}) p ON p."quickMessageId" = qm.id
      WHERE qm."companyId" = $1
      ORDER BY COALESCE(u.total,0) DESC, qm.id ASC
      LIMIT 20
    `,
    params
  );

  return res.json({
    range: startAt ? String(range || "custom") : "total",
    startAt: startAt ? startAt.toISOString() : null,
    userId: filterUserId || null,
    top: Array.isArray(top) ? top : [],
  });
});

// Legacy/UI compatibility: returns ARRAY
router.get("/list", authMiddleware, async (req, res) => {
  await ensureQuickMessagesSchema();
  const companyId = Number(req.query.companyId || tenantIdFromReq(req) || 0);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  const userId = req.query.userId ? Number(req.query.userId) : null;

  const params: any[] = [companyId];
  let where = `"companyId" = $1`;
  if (userId) {
    params.push(userId);
    where += ` AND ("userId" = $${params.length} OR "userId" IS NULL)`;
  }

  const rows = await pgQuery<any>(
    `SELECT id, shortcode, message, category, "companyId", "userId", "mediaPath", "mediaName" FROM "QuickMessages" WHERE ${where} ORDER BY id ASC`,
    params
  );
  return res.json(Array.isArray(rows) ? rows : []);
});

router.get("/", authMiddleware, async (req, res) => {
  await ensureQuickMessagesSchema();
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const searchParam = String(req.query.searchParam || "").trim().toLowerCase();

  const params: any[] = [companyId];
  let where = `"companyId" = $1`;
  if (searchParam) {
    params.push(`%${searchParam}%`);
    const p = `$${params.length}`;
    where += ` AND (lower(shortcode) LIKE ${p} OR lower(message) LIKE ${p})`;
  }

  params.push(limit);
  params.push(offset);
  const records = await pgQuery<any>(
    `SELECT id, shortcode, message, category, "companyId", "userId", "mediaPath", "mediaName"
     FROM "QuickMessages"
     WHERE ${where}
     ORDER BY id ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return res.json({ records, hasMore: (records || []).length === limit });
});

// POST /quick-messages (create)
router.post("/", authMiddleware, async (req, res) => {
  await ensureQuickMessagesSchema();
  const companyId = tenantIdFromReq(req);
  const userId = Number((req as any).userId || 0) || null;
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const body: any = req.body || {};
  const shortcode = String(body.shortcode || "").trim();
  const message = String(body.message || "").trim();
  const category = body.category !== undefined ? String(body.category || "").trim() : null;
  const mediaPath = body.mediaPath !== undefined ? body.mediaPath : null;

  if (!shortcode) return res.status(400).json({ error: true, message: "missing shortcode" });
  if (!message) return res.status(400).json({ error: true, message: "missing message" });

  // Keep compatibility: ignore extra fields (geral/status/isMedia) if DB doesn't have them.
  const inserted = await pgQuery<any>(
    `
      INSERT INTO "QuickMessages" (shortcode, message, category, "companyId", "userId", "mediaPath", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, shortcode, message, category, "companyId", "userId", "mediaPath", "mediaName"
    `,
    [shortcode, message, category, companyId, userId, mediaPath]
  );
  const record = inserted?.[0];
  if (!record) return res.status(500).json({ error: true, message: "failed to create quick message" });

  try {
    const io = getIO();
    // frontend listens on `company${companyId}-quickemessage`
    io.emit(`company${companyId}-quickemessage`, { action: "create", record });
  } catch {}

  return res.status(201).json(record);
});

// GET /quick-messages/:id (fetch one)
router.get("/:id", authMiddleware, async (req, res) => {
  await ensureQuickMessagesSchema();
  const companyId = tenantIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const rows = await pgQuery<any>(
    `SELECT id, shortcode, message, category, "companyId", "userId", "mediaPath", "mediaName" FROM "QuickMessages" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  const record = rows?.[0];
  if (!record) return res.status(404).json({ error: true, message: "not found" });
  return res.json(record);
});

// PUT /quick-messages/:id (update)
router.put("/:id", authMiddleware, async (req, res) => {
  await ensureQuickMessagesSchema();
  const companyId = tenantIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const body: any = req.body || {};
  const shortcode = body.shortcode !== undefined ? String(body.shortcode || "").trim() : undefined;
  const message = body.message !== undefined ? String(body.message || "").trim() : undefined;
  const category = body.category !== undefined ? String(body.category || "").trim() : undefined;
  const mediaPath = body.mediaPath !== undefined ? body.mediaPath : undefined;

  // allow partial update; but don't blank required fields if provided empty
  if (shortcode !== undefined && !shortcode) {
    return res.status(400).json({ error: true, message: "missing shortcode" });
  }
  if (message !== undefined && !message) {
    return res.status(400).json({ error: true, message: "missing message" });
  }

  // ensure exists
  const exists = await pgQuery<any>(
    `SELECT id FROM "QuickMessages" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  if (!exists?.[0]?.id) return res.status(404).json({ error: true, message: "not found" });

  await pgQuery(
    `
      UPDATE "QuickMessages"
      SET
        shortcode = COALESCE($1, shortcode),
        message = COALESCE($2, message),
        category = COALESCE($3, category),
        "mediaPath" = COALESCE($4, "mediaPath"),
        "updatedAt" = NOW()
      WHERE id = $5 AND "companyId" = $6
    `,
    [shortcode ?? null, message ?? null, category ?? null, mediaPath ?? null, id, companyId]
  );

  const rows = await pgQuery<any>(
    `SELECT id, shortcode, message, category, "companyId", "userId", "mediaPath", "mediaName" FROM "QuickMessages" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  const record = rows?.[0];
  if (!record) return res.status(404).json({ error: true, message: "not found" });

  try {
    const io = getIO();
    io.emit(`company${companyId}-quickemessage`, { action: "update", record });
  } catch {}

  return res.json(record);
});

// DELETE /quick-messages/:id (delete)
router.delete("/:id", authMiddleware, async (req, res) => {
  await ensureQuickMessagesSchema();
  const companyId = tenantIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  // ensure it belongs to company
  const exists = await pgQuery<any>(
    `SELECT id FROM "QuickMessages" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  if (!exists?.[0]?.id) return res.status(404).json({ error: true, message: "not found" });

  await pgQuery(`DELETE FROM "QuickMessages" WHERE id = $1 AND "companyId" = $2`, [
    id,
    companyId,
  ]);

  try {
    const io = getIO();
    // frontend listens on `company${companyId}-quickemessage`
    io.emit(`company${companyId}-quickemessage`, { action: "delete", id });
  } catch {}

  return res.status(204).end();
});

export default router;





