import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { getIO } from "../../libs/socket";

const router = Router();

function tenantIdFromReq(req: any): number {
  return Number(req?.tenantId || 0);
}

async function loadTicketWithRelations(ticketId: number, companyId: number) {
  const rows = await pgQuery<any>(
    `
      SELECT
        t.*,
        c.id as "contact_id",
        c.name as "contact_name",
        c.number as "contact_number",
        c."profilePicUrl" as "contact_profilePicUrl",
        q.id as "queue_id",
        q.name as "queue_name",
        q.color as "queue_color"
      FROM "Tickets" t
      LEFT JOIN "Contacts" c ON c.id = t."contactId"
      LEFT JOIN "Queues" q ON q.id = t."queueId"
      WHERE t.id = $1 AND t."companyId" = $2
      LIMIT 1
    `,
    [ticketId, companyId]
  );
  const r = rows[0];
  if (!r) return null;
  const ticket: any = { ...r };
  ticket.contact = r.contact_id
    ? {
        id: r.contact_id,
        name: r.contact_name,
        number: r.contact_number,
        profilePicUrl: r.contact_profilePicUrl
      }
    : null;
  ticket.queue = r.queue_id
    ? { id: r.queue_id, name: r.queue_name, color: r.queue_color }
    : null;
  delete ticket.contact_id;
  delete ticket.contact_name;
  delete ticket.contact_number;
  delete ticket.contact_profilePicUrl;
  delete ticket.queue_id;
  delete ticket.queue_name;
  delete ticket.queue_color;
  return ticket;
}

// GET /tickets
router.get("/", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const status = String(req.query.status || "").trim();
  const searchParam = String(req.query.searchParam || "").trim();

  const params: any[] = [companyId];
  let where = `t."companyId" = $1`;

  if (status) {
    params.push(status);
    where += ` AND t.status = $${params.length}`;
  }
  if (searchParam) {
    params.push(`%${searchParam.toLowerCase()}%`);
    const p = `$${params.length}`;
    where += ` AND (lower(c.name) LIKE ${p} OR lower(c.number) LIKE ${p} OR lower(t."lastMessage") LIKE ${p})`;
  }

  params.push(limit);
  params.push(offset);

  const rows = await pgQuery<any>(
    `
      SELECT
        t.*,
        c.id as "contact_id",
        c.name as "contact_name",
        c.number as "contact_number",
        c."profilePicUrl" as "contact_profilePicUrl",
        q.id as "queue_id",
        q.name as "queue_name",
        q.color as "queue_color"
      FROM "Tickets" t
      LEFT JOIN "Contacts" c ON c.id = t."contactId"
      LEFT JOIN "Queues" q ON q.id = t."queueId"
      WHERE ${where}
      ORDER BY t."updatedAt" DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );

  const list = (rows || []).map((r: any) => {
    const ticket: any = { ...r };
    ticket.contact = r.contact_id
      ? {
          id: r.contact_id,
          name: r.contact_name,
          number: r.contact_number,
          profilePicUrl: r.contact_profilePicUrl
        }
      : null;
    ticket.queue = r.queue_id
      ? { id: r.queue_id, name: r.queue_name, color: r.queue_color }
      : null;
    delete ticket.contact_id;
    delete ticket.contact_name;
    delete ticket.contact_number;
    delete ticket.contact_profilePicUrl;
    delete ticket.queue_id;
    delete ticket.queue_name;
    delete ticket.queue_color;
    return ticket;
  });

  return res.json(list);
});

// GET /tickets/:id
router.get("/:id", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  const ticket = await loadTicketWithRelations(id, companyId);
  if (!ticket) return res.status(404).json({ error: true, message: "not found" });
  return res.json(ticket);
});

// PUT /tickets/:id (accept ticket, change status, etc)
router.put("/:id", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  const id = Number(req.params.id);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const body: any = req.body || {};
  const nextStatus = body.status ? String(body.status) : undefined;
  const nextUserId = body.userId !== undefined && body.userId !== null ? Number(body.userId) : null;
  const nextQueueId = body.queueId !== undefined && body.queueId !== null ? Number(body.queueId) : null;

  await pgQuery(
    `
      UPDATE "Tickets"
      SET
        status = COALESCE($1, status),
        "userId" = $2,
        "queueId" = COALESCE($3, "queueId"),
        "updatedAt" = NOW(),
        "unreadMessages" = 0
      WHERE id = $4 AND "companyId" = $5
    `,
    [nextStatus || null, nextUserId, nextQueueId, id, companyId]
  );

  const ticket = await loadTicketWithRelations(id, companyId);
  if (!ticket) return res.status(404).json({ error: true, message: "not found" });

  try {
    const io = getIO();
    io.emit(`company-${companyId}-ticket`, { action: "update", ticket });
  } catch {}

  return res.json(ticket);
});

export default router;


