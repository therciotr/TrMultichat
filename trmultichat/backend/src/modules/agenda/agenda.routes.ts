import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { v4 as uuidv4 } from "uuid";
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
      "recurrenceType" text NULL,
      "recurrenceInterval" integer NULL,
      "recurrenceUntil" timestamp with time zone NULL,
      "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
      "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    []
  );

  // Ensure recurrence columns exist in legacy tables
  try {
    await pgQuery(`ALTER TABLE "UserCalendarEvents" ADD COLUMN IF NOT EXISTS "recurrenceType" text NULL`, []);
  } catch {}
  try {
    await pgQuery(`ALTER TABLE "UserCalendarEvents" ADD COLUMN IF NOT EXISTS "recurrenceInterval" integer NULL`, []);
  } catch {}
  try {
    await pgQuery(`ALTER TABLE "UserCalendarEvents" ADD COLUMN IF NOT EXISTS "recurrenceUntil" timestamp with time zone NULL`, []);
  } catch {}

  // Reminders definition
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS "UserCalendarEventReminders" (
      id uuid PRIMARY KEY,
      "companyId" integer NOT NULL,
      "userId" integer NOT NULL,
      "eventId" uuid NOT NULL,
      "minutesBefore" integer NOT NULL DEFAULT 10,
      "notifyInChat" boolean NOT NULL DEFAULT false,
      "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
      "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    []
  );
  await pgQuery(
    `CREATE INDEX IF NOT EXISTS "UserCalendarEventReminders_company_user_idx"
     ON "UserCalendarEventReminders" ("companyId","userId")`,
    []
  );
  await pgQuery(
    `CREATE INDEX IF NOT EXISTS "UserCalendarEventReminders_event_idx"
     ON "UserCalendarEventReminders" ("eventId")`,
    []
  );

  // Reminder fires (avoid duplicates per occurrence)
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS "UserCalendarEventReminderFires" (
      id uuid PRIMARY KEY,
      "companyId" integer NOT NULL,
      "userId" integer NOT NULL,
      "reminderId" uuid NOT NULL,
      "occurrenceStartAt" timestamp with time zone NOT NULL,
      "fireAt" timestamp with time zone NOT NULL,
      "createdAt" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    []
  );
  await pgQuery(
    `CREATE UNIQUE INDEX IF NOT EXISTS "UserCalendarEventReminderFires_unique"
     ON "UserCalendarEventReminderFires" ("reminderId","occurrenceStartAt")`,
    []
  );

  // Attachments
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS "UserCalendarEventAttachments" (
      id uuid PRIMARY KEY,
      "companyId" integer NOT NULL,
      "userId" integer NOT NULL,
      "eventId" uuid NOT NULL,
      "filePath" text NOT NULL,
      "fileName" text NOT NULL,
      "fileType" text NULL,
      "fileSize" integer NULL,
      "createdAt" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    []
  );
  await pgQuery(
    `CREATE INDEX IF NOT EXISTS "UserCalendarEventAttachments_event_idx"
     ON "UserCalendarEventAttachments" ("eventId")`,
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
  recurrenceType?: string | null;
  recurrenceInterval?: number | null;
  recurrenceUntil?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReminderRow = {
  id: string;
  companyId: number;
  userId: number;
  eventId: string;
  minutesBefore: number;
  notifyInChat: boolean;
  createdAt: string;
  updatedAt: string;
};

type AttachmentRow = {
  id: string;
  companyId: number;
  userId: number;
  eventId: string;
  filePath: string;
  fileName: string;
  fileType?: string | null;
  fileSize?: number | null;
  createdAt: string;
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

function toIso(d: Date): string {
  return new Date(d).toISOString();
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function addWeeks(d: Date, weeks: number): Date {
  return addDays(d, weeks * 7);
}

function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  const day = x.getDate();
  x.setMonth(x.getMonth() + months);
  // JS handles overflow; keep same day when possible
  if (x.getDate() !== day) {
    // fallback to last day of previous month
    x.setDate(0);
  }
  return x;
}

function durationMs(ev: CalendarEventRow): number {
  const a = new Date(ev.startAt).getTime();
  const b = new Date(ev.endAt).getTime();
  return Math.max(1, b - a);
}

function normalizeRecurrenceType(v: any): "none" | "daily" | "weekly" | "monthly" {
  const s = String(v || "").toLowerCase().trim();
  if (s === "daily" || s === "weekly" || s === "monthly") return s;
  return "none";
}

function normalizeRecurrenceInterval(v: any): number {
  const n = Number(v || 1);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(365, Math.floor(n));
}

function expandOccurrences(ev: CalendarEventRow, rangeStart: Date, rangeEnd: Date): Array<{ startAt: string; endAt: string; occurrenceStartAt: string; seriesId: string }> {
  const baseStart = new Date(ev.startAt);
  const baseEnd = new Date(ev.endAt);
  if (Number.isNaN(baseStart.getTime()) || Number.isNaN(baseEnd.getTime())) return [];

  const recType = normalizeRecurrenceType(ev.recurrenceType);
  const recInterval = normalizeRecurrenceInterval(ev.recurrenceInterval);
  const recUntil = ev.recurrenceUntil ? new Date(ev.recurrenceUntil) : null;
  const dur = durationMs(ev);

  const intersects = (s: Date, e: Date) => s.getTime() < rangeEnd.getTime() && e.getTime() > rangeStart.getTime();
  const out: Array<{ startAt: string; endAt: string; occurrenceStartAt: string; seriesId: string }> = [];

  if (recType === "none") {
    if (intersects(baseStart, baseEnd)) {
      out.push({ startAt: toIso(baseStart), endAt: toIso(baseEnd), occurrenceStartAt: toIso(baseStart), seriesId: ev.id });
    }
    return out;
  }

  const max = 300;
  let cursor = new Date(baseStart);
  let i = 0;
  while (i < max) {
    if (recUntil && cursor.getTime() > recUntil.getTime()) break;
    const occStart = new Date(cursor);
    const occEnd = new Date(occStart.getTime() + dur);
    if (occStart.getTime() > rangeEnd.getTime() + dur) break;
    if (intersects(occStart, occEnd)) {
      out.push({ startAt: toIso(occStart), endAt: toIso(occEnd), occurrenceStartAt: toIso(occStart), seriesId: ev.id });
    }
    if (recType === "daily") cursor = addDays(cursor, recInterval);
    else if (recType === "weekly") cursor = addWeeks(cursor, recInterval);
    else cursor = addMonths(cursor, recInterval);
    i += 1;
  }
  return out;
}

async function upsertRemindersForEvent(companyId: number, userId: number, eventId: string, reminders: any) {
  // reminders: [{ minutesBefore, notifyInChat }]
  if (!Array.isArray(reminders)) reminders = [];
  const normalized = reminders
    .map((r) => ({
      minutesBefore: Math.max(0, Math.min(24 * 60, Number(r?.minutesBefore || 0))),
      notifyInChat: Boolean(r?.notifyInChat),
    }))
    .filter((r) => Number.isFinite(r.minutesBefore) && r.minutesBefore > 0)
    .slice(0, 5);

  // Replace strategy (simple and safe)
  await pgQuery(`DELETE FROM "UserCalendarEventReminders" WHERE "companyId" = $1 AND "eventId" = $2`, [companyId, eventId]);
  for (const r of normalized) {
    const id = uuidv4();
    await pgQuery(
      `INSERT INTO "UserCalendarEventReminders" (id,"companyId","userId","eventId","minutesBefore","notifyInChat","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6, now(), now())`,
      [id, companyId, userId, eventId, r.minutesBefore, r.notifyInChat]
    );
  }
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
      COALESCE("recurrenceType",'none') as "recurrenceType",
      COALESCE("recurrenceInterval", 1) as "recurrenceInterval",
      "recurrenceUntil",
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

  const base = Array.isArray(rows) ? rows : [];
  const expanded: any[] = [];
  for (const ev of base) {
    const occs = expandOccurrences(ev, dateFrom, dateTo);
    if (occs.length <= 1 && normalizeRecurrenceType(ev.recurrenceType) === "none") {
      expanded.push({ ...ev, seriesId: ev.id, occurrenceStartAt: ev.startAt });
      continue;
    }
    for (const occ of occs) {
      expanded.push({
        ...ev,
        id: `${ev.id}__${occ.occurrenceStartAt}`,
        seriesId: ev.id,
        startAt: occ.startAt,
        endAt: occ.endAt,
        occurrenceStartAt: occ.occurrenceStartAt,
        isOccurrence: true,
      });
    }
  }

  // include reminders for this user
  const reminders = await pgQuery<ReminderRow>(
    `SELECT * FROM "UserCalendarEventReminders" WHERE "companyId" = $1 AND "userId" = $2`,
    [companyId, targetUserId]
  );
  const byEvent: Record<string, any[]> = {};
  for (const r of Array.isArray(reminders) ? reminders : []) {
    byEvent[String(r.eventId)] = byEvent[String(r.eventId)] || [];
    byEvent[String(r.eventId)].push({ id: r.id, minutesBefore: Number(r.minutesBefore || 0), notifyInChat: Boolean(r.notifyInChat) });
  }

  const withReminders = expanded.map((e) => ({
    ...e,
    reminders: byEvent[String(e.seriesId || e.id)] || [],
  }));

  return res.json({ records: withReminders });
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
  const recurrenceType = normalizeRecurrenceType(body.recurrenceType);
  const recurrenceInterval = normalizeRecurrenceInterval(body.recurrenceInterval);
  const recurrenceUntil = body.recurrenceUntil ? parseDateOrNull(body.recurrenceUntil) : null;

  const start = parseDateOrNull(body.startAt);
  const end = parseDateOrNull(body.endAt);
  if (!title) return res.status(400).json({ error: true, message: "title is required" });
  if (!start || !end) return res.status(400).json({ error: true, message: "startAt and endAt are required" });
  if (end.getTime() <= start.getTime()) return res.status(400).json({ error: true, message: "endAt must be after startAt" });

  const id = uuidv4();

  const inserted = await pgQuery<CalendarEventRow>(
    `INSERT INTO "UserCalendarEvents" (
      id, "companyId", "userId", title, description, "startAt", "endAt", "allDay", location, color,
      "recurrenceType","recurrenceInterval","recurrenceUntil",
      "createdAt", "updatedAt"
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now(), now())
    RETURNING *`,
    [
      id,
      companyId,
      targetUserId,
      title,
      description,
      start.toISOString(),
      end.toISOString(),
      allDay,
      location,
      color,
      recurrenceType,
      recurrenceInterval,
      recurrenceType === "none" ? null : recurrenceUntil ? toIso(recurrenceUntil) : null,
    ]
  );

  const record = inserted?.[0];
  // backfill recurrence columns if RETURNING didn't include due to legacy
  try {
    await pgQuery(
      `UPDATE "UserCalendarEvents" SET "recurrenceType"=$1,"recurrenceInterval"=$2,"recurrenceUntil"=$3 WHERE id=$4 AND "companyId"=$5`,
      [recurrenceType, recurrenceInterval, recurrenceType === "none" ? null : recurrenceUntil ? toIso(recurrenceUntil) : null, id, companyId]
    );
  } catch {}

  // reminders
  try {
    await upsertRemindersForEvent(companyId, targetUserId, id, body.reminders);
  } catch {}

  try {
    const io = getIO();
    io.emit(`company-${companyId}-agenda`, { action: "create", record });
  } catch {}

  return res.status(201).json({ ...(record || {}), recurrenceType, recurrenceInterval, recurrenceUntil: recurrenceUntil ? toIso(recurrenceUntil) : null });
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
  const recurrenceType = normalizeRecurrenceType(body.recurrenceType);
  const recurrenceInterval = normalizeRecurrenceInterval(body.recurrenceInterval);
  const recurrenceUntil = body.recurrenceUntil ? parseDateOrNull(body.recurrenceUntil) : null;

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
      "recurrenceType" = $9,
      "recurrenceInterval" = $10,
      "recurrenceUntil" = $11,
      "updatedAt" = now()
     WHERE id = $12 AND "companyId" = $13
     RETURNING *`,
    [
      targetUserId,
      title,
      description,
      start.toISOString(),
      end.toISOString(),
      allDay,
      location,
      color,
      recurrenceType,
      recurrenceInterval,
      recurrenceType === "none" ? null : recurrenceUntil ? toIso(recurrenceUntil) : null,
      id,
      companyId
    ]
  );

  const record = updated?.[0];
  try {
    await upsertRemindersForEvent(companyId, targetUserId, id, body.reminders);
  } catch {}
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

  await pgQuery(`DELETE FROM "UserCalendarEventReminders" WHERE "companyId" = $1 AND "eventId" = $2`, [companyId, id]);
  await pgQuery(`DELETE FROM "UserCalendarEventAttachments" WHERE "companyId" = $1 AND "eventId" = $2`, [companyId, id]);
  await pgQuery(`DELETE FROM "UserCalendarEvents" WHERE id = $1 AND "companyId" = $2`, [id, companyId]);

  try {
    const io = getIO();
    io.emit(`company-${companyId}-agenda`, { action: "delete", id });
  } catch {}

  return res.status(204).end();
});

async function createChatReminder(companyId: number, senderUserId: number, targetUserId: number, title: string, text: string) {
  // Best-effort: if announcements schema is missing, we just skip.
  try {
    const now = new Date();
    const rows = await pgQuery<any>(
      `
        INSERT INTO "Announcements" (priority, title, text, "companyId", status, "createdAt", "updatedAt", "sendToAll", "targetUserId", "allowReply", "userId")
        VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10)
        RETURNING id
      `,
      [2, title, text, companyId, true, now, false, targetUserId, false, senderUserId]
    );
    const createdId = Number(rows?.[0]?.id || 0);
    if (!createdId) return;
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
  } catch {}
}

router.get("/reminders/due", async (req, res) => {
  setNoCache(res);
  await ensureAgendaSchema();

  const requester = await getRequester(req);
  const companyId = requester.companyId;
  const userId = requester.id;

  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 1000); // 60s grace
  const rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const baseEvents = await pgQuery<CalendarEventRow>(
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
      COALESCE("recurrenceType",'none') as "recurrenceType",
      COALESCE("recurrenceInterval", 1) as "recurrenceInterval",
      "recurrenceUntil",
      "createdAt",
      "updatedAt"
     FROM "UserCalendarEvents"
     WHERE "companyId" = $1
       AND "userId" = $2
       AND "startAt" < $3
       AND "endAt" > $4`,
    [companyId, userId, toIso(rangeEnd), toIso(rangeStart)]
  );

  const reminders = await pgQuery<ReminderRow>(
    `SELECT * FROM "UserCalendarEventReminders" WHERE "companyId" = $1 AND "userId" = $2`,
    [companyId, userId]
  );
  const byEvent: Record<string, ReminderRow[]> = {};
  for (const r of Array.isArray(reminders) ? reminders : []) {
    byEvent[String(r.eventId)] = byEvent[String(r.eventId)] || [];
    byEvent[String(r.eventId)].push(r);
  }

  const due: any[] = [];
  for (const ev of Array.isArray(baseEvents) ? baseEvents : []) {
    const rs = byEvent[String(ev.id)] || [];
    if (!rs.length) continue;
    const occs = expandOccurrences(ev, rangeStart, rangeEnd);
    for (const occ of occs) {
      const occStart = new Date(occ.startAt);
      for (const r of rs) {
        const minutes = Math.max(1, Math.min(24 * 60, Number(r.minutesBefore || 0)));
        const fireAt = new Date(occStart.getTime() - minutes * 60 * 1000);
        if (fireAt.getTime() > now.getTime()) continue;
        if (fireAt.getTime() < windowStart.getTime()) continue;

        // Insert fire row (dedupe)
        const fireId = uuidv4();
        try {
          await pgQuery(
            `INSERT INTO "UserCalendarEventReminderFires" (id,"companyId","userId","reminderId","occurrenceStartAt","fireAt","createdAt")
             VALUES ($1,$2,$3,$4,$5,$6, now())`,
            [fireId, companyId, userId, r.id, occ.occurrenceStartAt, toIso(fireAt)]
          );
        } catch {
          continue; // already fired
        }

        const msgTitle = `Lembrete: ${ev.title}`;
        const when = occStart.toLocaleString("pt-BR");
        const link = `/agenda?eventId=${encodeURIComponent(ev.id)}&occurrence=${encodeURIComponent(occ.occurrenceStartAt)}`;
        const msgText = `⏰ ${ev.title}\nQuando: ${when}\nAbrir: ${link}`;

        if (Boolean(r.notifyInChat)) {
          await createChatReminder(companyId, userId, userId, msgTitle, msgText);
        }

        due.push({
          reminderId: r.id,
          eventId: ev.id,
          occurrenceStartAt: occ.occurrenceStartAt,
          fireAt: toIso(fireAt),
          title: ev.title,
          startAt: occ.startAt,
          minutesBefore: minutes,
          notifyInChat: Boolean(r.notifyInChat),
          link,
        });
      }
    }
  }

  return res.json({ records: due });
});

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "agenda");
try {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch {}

const storage = multer.diskStorage({
  destination: function (req, _file, cb) {
    const companyId = tenantIdFromReq(req);
    const eventId = String(req.params.id || "unknown");
    const dir = path.join(UPLOAD_DIR, String(companyId || "0"), eventId);
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch {}
    cb(null, dir);
  },
  filename: function (_req, file, cb) {
    const safe = String(file.originalname || "file").replace(/[^\w.\-]+/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({ storage });

router.get("/events/:id/attachments", async (req, res) => {
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

  const rows = await pgQuery<AttachmentRow>(
    `SELECT * FROM "UserCalendarEventAttachments" WHERE "companyId" = $1 AND "eventId" = $2 ORDER BY "createdAt" DESC`,
    [companyId, id]
  );
  return res.json({ records: Array.isArray(rows) ? rows : [] });
});

router.post("/events/:id/attachments", upload.single("file"), async (req, res) => {
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

  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: true, message: "file is required" });

  const filePath = `uploads/agenda/${companyId}/${id}/${file.filename}`;
  const rowId = uuidv4();
  const inserted = await pgQuery<AttachmentRow>(
    `INSERT INTO "UserCalendarEventAttachments" (id,"companyId","userId","eventId","filePath","fileName","fileType","fileSize","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
     RETURNING *`,
    [rowId, companyId, ownerId, id, filePath, file.originalname, file.mimetype || null, Number(file.size || 0) || null]
  );
  return res.status(201).json(inserted?.[0] || { id: rowId, filePath });
});

router.delete("/events/:id/attachments/:attachmentId", async (req, res) => {
  setNoCache(res);
  await ensureAgendaSchema();

  const requester = await getRequester(req);
  const companyId = requester.companyId;
  const id = String(req.params.id || "");
  const attachmentId = String(req.params.attachmentId || "");
  const canAdmin = isAdminLike(requester);

  const existing = await pgQuery<{ userId: number }>(
    `SELECT "userId" FROM "UserCalendarEvents" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
    [id, companyId]
  );
  const ownerId = Number(existing?.[0]?.userId || 0);
  if (!ownerId) return res.status(404).json({ error: true, message: "not found" });
  if (!canAdmin && ownerId !== requester.id) return res.status(403).json({ error: true, message: "forbidden" });

  const rows = await pgQuery<AttachmentRow>(
    `SELECT * FROM "UserCalendarEventAttachments" WHERE id = $1 AND "companyId" = $2 AND "eventId" = $3 LIMIT 1`,
    [attachmentId, companyId, id]
  );
  const att = rows?.[0];
  if (!att) return res.status(404).json({ error: true, message: "not found" });

  await pgQuery(`DELETE FROM "UserCalendarEventAttachments" WHERE id = $1 AND "companyId" = $2`, [attachmentId, companyId]);
  try {
    const abs = path.join(process.cwd(), "public", String(att.filePath || ""));
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {}
  return res.status(204).end();
});

export default router;

