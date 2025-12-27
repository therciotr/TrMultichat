import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";

const router = Router();

function tenantIdFromReq(req: any): number {
  return Number(req?.tenantId || 0);
}

// GET /ticket-notes/list?ticketId=..&contactId=..
router.get("/list", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  const ticketId = req.query.ticketId ? Number(req.query.ticketId) : null;
  const contactId = req.query.contactId ? Number(req.query.contactId) : null;

  const params: any[] = [companyId];
  let where = `c."companyId" = $1`;
  if (ticketId) {
    params.push(ticketId);
    where += ` AND n."ticketId" = $${params.length}`;
  }
  if (contactId) {
    params.push(contactId);
    where += ` AND n."contactId" = $${params.length}`;
  }

  const rows = await pgQuery<any>(
    `
      SELECT n.id, n.note, n."userId", n."contactId", n."ticketId", n."createdAt", n."updatedAt"
      FROM "TicketNotes" n
      JOIN "Contacts" c ON c.id = n."contactId"
      WHERE ${where}
      ORDER BY n.id DESC
    `,
    params
  );
  return res.json(Array.isArray(rows) ? rows : []);
});

// POST /ticket-notes { note, ticketId, contactId }
router.post("/", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  const note = String((req.body as any)?.note || "").trim();
  const ticketId = (req.body as any)?.ticketId ? Number((req.body as any).ticketId) : null;
  const contactId = Number((req.body as any)?.contactId || 0);
  const userId = Number((req as any)?.userId || (req.body as any)?.userId || 0) || null;
  if (!note) return res.status(400).json({ error: true, message: "note is required" });
  if (!contactId) return res.status(400).json({ error: true, message: "contactId is required" });

  // ensure contact belongs to company
  const ok = await pgQuery<any>(
    `SELECT id FROM "Contacts" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [contactId, companyId]
  );
  if (!ok?.[0]?.id) return res.status(404).json({ error: true, message: "contact not found" });

  const rows = await pgQuery<any>(
    `
      INSERT INTO "TicketNotes"(note, "userId", "contactId", "ticketId", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, note, "userId", "contactId", "ticketId", "createdAt", "updatedAt"
    `,
    [note, userId, contactId, ticketId]
  );
  return res.status(201).json(rows[0]);
});

// DELETE /ticket-notes/:id
router.delete("/:id", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  const id = Number(req.params.id);

  // only delete notes that belong to company via contact
  await pgQuery(
    `
      DELETE FROM "TicketNotes" n
      USING "Contacts" c
      WHERE n.id = $1 AND c.id = n."contactId" AND c."companyId" = $2
    `,
    [id, companyId]
  );
  return res.status(204).end();
});

export default router;


