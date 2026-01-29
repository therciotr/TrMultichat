import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { v4 as uuidv4 } from "uuid";
import { getIO } from "../../libs/socket";

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
      super: Boolean(u.super),
    };
  } catch {
    return { id, companyId, profile: "user", super: false };
  }
}

function isAdminLike(u: { profile: string; super: boolean }): boolean {
  const p = String(u.profile || "").toLowerCase();
  return Boolean(u.super) || p === "admin" || p === "super";
}

async function ensureAgendaSchema() {
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS "UserCalendarEvents" (
      id uuid PRIMARY KEY,
      "companyId" integer NOT NULL,
      "userId" integer NOT NULL,
      title text NOT NULL,
      description text NULL,
      "startAt" timestamp with time zone NOT NULL,
      "endAt" timestamp with time zone NOT NULL,
      "allDay" boolean NOT NULL DEFAULT false,
      location text NULL,
      color text NULL,
      "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
      "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    []
  );

  // Helpful indexes
  await pgQuery(
    `CREATE INDEX IF NOT EXISTS "UserCalendarEvents_company_user_start_idx"
     ON "UserCalendarEvents" ("companyId","userId","startAt")`,
    []
  );
  await pgQuery(
    `CREATE INDEX IF NOT EXISTS "UserCalendarEvents_company_start_idx"
     ON "UserCalendarEvents" ("companyId","startAt")`,
    []
  );
}

type CalendarEventRow = {
  id: string;
  companyId: number;
  userId: number;
  title: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location?: string | null;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
};

function parseDateOrNull(v: any): Date | null {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function safeString(v: any, max = 3000): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

router.get("/events", async (req, res) => {
  setNoCache(res);
  await ensureAgendaSchema();

  const requester = await getRequester(req);
  const companyId = requester.companyId;

  const dateFrom = parseDateOrNull(req.query.dateFrom) || new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
  const dateTo = parseDateOrNull(req.query.dateTo) || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  const requestedUserId = Number(req.query.userId || 0);
  const targetUserId = requestedUserId && isAdminLike(requester) ? requestedUserId : requester.id;

  const rows = await pgQuery<CalendarEventRow>(
    `SELECT
      id,
      "companyId",
      "userId",
      title,
      description,
      "startAt",
      "endAt",
      "allDay",
      location,
      color,
      "createdAt",
      "updatedAt"
     FROM "UserCalendarEvents"
     WHERE "companyId" = $1
       AND "userId" = $2
       AND "startAt" < $3
       AND "endAt" > $4
     ORDER BY "startAt" ASC`,
    [companyId, targetUserId, dateTo.toISOString(), dateFrom.toISOString()]
  );

  return res.json({ records: Array.isArray(rows) ? rows : [] });
});

router.post("/events", async (req, res) => {
  setNoCache(res);
  await ensureAgendaSchema();

  const requester = await getRequester(req);
  const companyId = requester.companyId;

  const body = req.body || {};
  const requestedUserId = Number(body.userId || 0);
  const targetUserId = requestedUserId && isAdminLike(requester) ? requestedUserId : requester.id;

  const title = safeString(body.title, 200);
  const description = safeString(body.description, 4000) || null;
  const location = safeString(body.location, 300) || null;
  const color = safeString(body.color, 40) || null;
  const allDay = Boolean(body.allDay);

  const start = parseDateOrNull(body.startAt);
  const end = parseDateOrNull(body.endAt);
  if (!title) return res.status(400).json({ error: true, message: "title is required" });
  if (!start || !end) return res.status(400).json({ error: true, message: "startAt and endAt are required" });
  if (end.getTime() <= start.getTime()) return res.status(400).json({ error: true, message: "endAt must be after startAt" });

  const id = uuidv4();

  const inserted = await pgQuery<CalendarEventRow>(
    `INSERT INTO "UserCalendarEvents" (
      id, "companyId", "userId", title, description, "startAt", "endAt", "allDay", location, color, "createdAt", "updatedAt"
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), now())
    RETURNING *`,
    [id, companyId, targetUserId, title, description, start.toISOString(), end.toISOString(), allDay, location, color]
  );

  const record = inserted?.[0];
  try {
    const io = getIO();
    io.emit(`company-${companyId}-agenda`, { action: "create", record });
  } catch {}

  return res.status(201).json(record);
});

router.put("/events/:id", async (req, res) => {
  setNoCache(res);
  await ensureAgendaSchema();

  const requester = await getRequester(req);
  const companyId = requester.companyId;
  const id = String(req.params.id || "");

  const body = req.body || {};
  const requestedUserId = Number(body.userId || 0);
  const canAdmin = isAdminLike(requester);
  const targetUserId = requestedUserId && canAdmin ? requestedUserId : requester.id;

  const title = safeString(body.title, 200);
  const description = safeString(body.description, 4000) || null;
  const location = safeString(body.location, 300) || null;
  const color = safeString(body.color, 40) || null;
  const allDay = Boolean(body.allDay);

  const start = parseDateOrNull(body.startAt);
  const end = parseDateOrNull(body.endAt);
  if (!title) return res.status(400).json({ error: true, message: "title is required" });
  if (!start || !end) return res.status(400).json({ error: true, message: "startAt and endAt are required" });
  if (end.getTime() <= start.getTime()) return res.status(400).json({ error: true, message: "endAt must be after startAt" });

  // Ownership check
  const existing = await pgQuery<{ userId: number }>(
    `SELECT "userId" FROM "UserCalendarEvents" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  const ownerId = Number(existing?.[0]?.userId || 0);
  if (!ownerId) return res.status(404).json({ error: true, message: "not found" });
  if (!canAdmin && ownerId !== requester.id) return res.status(403).json({ error: true, message: "forbidden" });

  const updated = await pgQuery<CalendarEventRow>(
    `UPDATE "UserCalendarEvents"
     SET
      "userId" = $1,
      title = $2,
      description = $3,
      "startAt" = $4,
      "endAt" = $5,
      "allDay" = $6,
      location = $7,
      color = $8,
      "updatedAt" = now()
     WHERE id = $9 AND "companyId" = $10
     RETURNING *`,
    [targetUserId, title, description, start.toISOString(), end.toISOString(), allDay, location, color, id, companyId]
  );

  const record = updated?.[0];
  try {
    const io = getIO();
    io.emit(`company-${companyId}-agenda`, { action: "update", record });
  } catch {}

  return res.json(record);
});

router.delete("/events/:id", async (req, res) => {
  setNoCache(res);
  await ensureAgendaSchema();

  const requester = await getRequester(req);
  const companyId = requester.companyId;
  const id = String(req.params.id || "");

  const canAdmin = isAdminLike(requester);
  const existing = await pgQuery<{ userId: number }>(
    `SELECT "userId" FROM "UserCalendarEvents" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  const ownerId = Number(existing?.[0]?.userId || 0);
  if (!ownerId) return res.status(404).json({ error: true, message: "not found" });
  if (!canAdmin && ownerId !== requester.id) return res.status(403).json({ error: true, message: "forbidden" });

  await pgQuery(`DELETE FROM "UserCalendarEvents" WHERE id = $1 AND "companyId" = $2`, [id, companyId]);

  try {
    const io = getIO();
    io.emit(`company-${companyId}-agenda`, { action: "delete", id });
  } catch {}

  return res.status(204).end();
});

export default router;

