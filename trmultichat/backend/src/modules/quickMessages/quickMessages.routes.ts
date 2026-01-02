import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { getIO } from "../../libs/socket";

const router = Router();

function tenantIdFromReq(req: any): number {
  return Number(req?.tenantId || 0);
}

// Legacy/UI compatibility: returns ARRAY
router.get("/list", authMiddleware, async (req, res) => {
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
    `SELECT id, shortcode, message, "companyId", "userId", "mediaPath", "mediaName" FROM "QuickMessages" WHERE ${where} ORDER BY id ASC`,
    params
  );
  return res.json(Array.isArray(rows) ? rows : []);
});

router.get("/", authMiddleware, async (req, res) => {
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
    `SELECT id, shortcode, message, "companyId", "userId", "mediaPath", "mediaName"
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
  const companyId = tenantIdFromReq(req);
  const userId = Number((req as any).userId || 0) || null;
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const body: any = req.body || {};
  const shortcode = String(body.shortcode || "").trim();
  const message = String(body.message || "").trim();
  const mediaPath = body.mediaPath !== undefined ? body.mediaPath : null;

  if (!shortcode) return res.status(400).json({ error: true, message: "missing shortcode" });
  if (!message) return res.status(400).json({ error: true, message: "missing message" });

  // Keep compatibility: ignore extra fields (geral/status/isMedia) if DB doesn't have them.
  const inserted = await pgQuery<any>(
    `
      INSERT INTO "QuickMessages" (shortcode, message, "companyId", "userId", "mediaPath", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, shortcode, message, "companyId", "userId", "mediaPath", "mediaName"
    `,
    [shortcode, message, companyId, userId, mediaPath]
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
  const companyId = tenantIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const rows = await pgQuery<any>(
    `SELECT id, shortcode, message, "companyId", "userId", "mediaPath", "mediaName" FROM "QuickMessages" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  const record = rows?.[0];
  if (!record) return res.status(404).json({ error: true, message: "not found" });
  return res.json(record);
});

// PUT /quick-messages/:id (update)
router.put("/:id", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const body: any = req.body || {};
  const shortcode = body.shortcode !== undefined ? String(body.shortcode || "").trim() : undefined;
  const message = body.message !== undefined ? String(body.message || "").trim() : undefined;
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
        "mediaPath" = COALESCE($3, "mediaPath"),
        "updatedAt" = NOW()
      WHERE id = $4 AND "companyId" = $5
    `,
    [shortcode ?? null, message ?? null, mediaPath ?? null, id, companyId]
  );

  const rows = await pgQuery<any>(
    `SELECT id, shortcode, message, "companyId", "userId", "mediaPath", "mediaName" FROM "QuickMessages" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
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





