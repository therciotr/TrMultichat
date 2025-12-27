import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";

const router = Router();

function tenantIdFromReq(req: any): number {
  return Number(req?.tenantId || 0);
}

// Legacy/UI compatibility: returns ARRAY (not wrapped)
router.get("/list", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  const rows = await pgQuery<any>(
    `SELECT id, name, color, "companyId" FROM "Tags" WHERE "companyId" = $1 ORDER BY id ASC`,
    [companyId]
  );
  return res.json(Array.isArray(rows) ? rows : []);
});

// Keep existing endpoint but return in old shape
router.get("/", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const tags = await pgQuery<any>(
    `SELECT id, name, color, "companyId" FROM "Tags" WHERE "companyId" = $1 ORDER BY id ASC LIMIT $2 OFFSET $3`,
    [companyId, limit, offset]
  );
  return res.json({ tags, hasMore: (tags || []).length === limit });
});

router.get("/kanban", async (_req, res) => {
  return res.json({ lista: [] });
});

// POST /tags (create)
router.post("/", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  const name = String((req.body as any)?.name || "").trim();
  const color = (req.body as any)?.color ? String((req.body as any).color) : null;
  if (!name) return res.status(400).json({ error: true, message: "name is required" });
  const rows = await pgQuery<any>(
    `
      INSERT INTO "Tags"(name, color, "companyId", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING id, name, color, "companyId"
    `,
    [name, color, companyId]
  );
  return res.status(201).json(rows[0]);
});

// POST /tags/sync { ticketId, tags: [{id,...}] }
router.post("/sync", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  const ticketId = Number((req.body as any)?.ticketId || 0);
  const tags = Array.isArray((req.body as any)?.tags) ? (req.body as any).tags : [];
  if (!ticketId) return res.status(400).json({ error: true, message: "ticketId is required" });

  // delete existing
  await pgQuery(`DELETE FROM "TicketTags" WHERE "ticketId" = $1`, [ticketId]);
  // insert new
  for (const t of tags) {
    const tagId = Number(t?.id || 0);
    if (!tagId) continue;
    // ensure tag belongs to company
    const ok = await pgQuery<any>(
      `SELECT id FROM "Tags" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
      [tagId, companyId]
    );
    if (!ok?.[0]?.id) continue;
    await pgQuery(
      `INSERT INTO "TicketTags"("ticketId","tagId","createdAt","updatedAt") VALUES ($1,$2,NOW(),NOW())`,
      [ticketId, tagId]
    );
  }
  return res.json({ ok: true });
});

export default router;





