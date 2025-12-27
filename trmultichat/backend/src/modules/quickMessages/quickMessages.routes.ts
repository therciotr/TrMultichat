import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";

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
  const records = await pgQuery<any>(
    `SELECT id, shortcode, message, "companyId", "userId", "mediaPath", "mediaName" FROM "QuickMessages" WHERE "companyId" = $1 ORDER BY id ASC LIMIT $2 OFFSET $3`,
    [companyId, limit, offset]
  );
  return res.json({ records, hasMore: (records || []).length === limit });
});

export default router;





