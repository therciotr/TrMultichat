import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { getIO } from "../../libs/socket";

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

// GET /tags/:id (fetch one) - used by TagModal edit
router.get("/:id", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const rows = await pgQuery<any>(
    `SELECT id, name, color, "companyId" FROM "Tags" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  const tag = rows?.[0];
  if (!tag) return res.status(404).json({ error: true, message: "not found" });

  // UI expects `kanban` in some places; keep backwards-compatible default.
  return res.json({ ...tag, kanban: (tag as any)?.kanban ?? 0 });
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
  try {
    const io = getIO();
    io.emit(`company-${companyId}-tag`, { action: "create", tag: rows?.[0] });
  } catch {}
  return res.status(201).json(rows[0]);
});

// PUT /tags/:id (update)
router.put("/:id", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const name = (req.body as any)?.name !== undefined ? String((req.body as any).name || "").trim() : undefined;
  const color = (req.body as any)?.color !== undefined ? String((req.body as any).color || "") : undefined;

  if (name !== undefined && !name) return res.status(400).json({ error: true, message: "name is required" });

  const exists = await pgQuery<any>(
    `SELECT id FROM "Tags" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  if (!exists?.[0]?.id) return res.status(404).json({ error: true, message: "not found" });

  await pgQuery(
    `
      UPDATE "Tags"
      SET
        name = COALESCE($1, name),
        color = COALESCE($2, color),
        "updatedAt" = NOW()
      WHERE id = $3 AND "companyId" = $4
    `,
    [name ?? null, color ?? null, id, companyId]
  );

  const rows = await pgQuery<any>(
    `SELECT id, name, color, "companyId" FROM "Tags" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  const tag = rows?.[0];
  if (!tag) return res.status(404).json({ error: true, message: "not found" });

  try {
    const io = getIO();
    io.emit(`company-${companyId}-tag`, { action: "update", tag });
  } catch {}

  return res.json({ ...tag, kanban: (tag as any)?.kanban ?? 0 });
});

// DELETE /tags/:id (delete)
router.delete("/:id", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const exists = await pgQuery<any>(
    `SELECT id FROM "Tags" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  if (!exists?.[0]?.id) return res.status(404).json({ error: true, message: "not found" });

  // avoid FK issues
  await pgQuery(`DELETE FROM "TicketTags" WHERE "tagId" = $1`, [id]);
  await pgQuery(`DELETE FROM "Tags" WHERE id = $1 AND "companyId" = $2`, [id, companyId]);

  try {
    const io = getIO();
    io.emit(`company-${companyId}-tag`, { action: "delete", tagId: id });
  } catch {}

  return res.status(204).end();
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





