import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";

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

function parseDateOnly(v: any): string | null {
  const s = String(v || "").trim();
  if (!s) return null;
  // expects YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function toInt(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

router.get("/", async (req, res) => {
  setNoCache(res);
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const days = toInt(req.query.days, 0);
  const dateFrom = parseDateOnly(req.query.date_from);
  const dateTo = parseDateOnly(req.query.date_to);

  // Build time range (inclusive)
  let fromTsSql = "";
  let toTsSql = "";
  const params: any[] = [companyId];
  if (days > 0) {
    params.push(days);
    fromTsSql = ` AND t."createdAt" >= NOW() - ($2::int || ' days')::interval`;
  } else if (dateFrom) {
    params.push(dateFrom);
    fromTsSql = ` AND t."createdAt" >= ($2::date)::timestamp`;
  }
  if (days > 0) {
    // use same window; no separate toTs
  } else if (dateTo) {
    params.push(dateTo);
    const idx = params.length;
    // include entire day
    toTsSql = ` AND t."createdAt" < (($${idx}::date) + interval '1 day')::timestamp`;
  }

  // Counters
  const countersSql = `
    SELECT
      COALESCE(SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END), 0)::int as "supportPending",
      COALESCE(SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END), 0)::int as "supportHappening",
      COALESCE(SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END), 0)::int as "supportFinished"
    FROM "Tickets" t
    WHERE t."companyId" = $1
    ${fromTsSql}
    ${toTsSql}
  `;

  // Leads: contacts created in range
  const leadsParams: any[] = [companyId];
  let leadsFrom = "";
  let leadsTo = "";
  if (days > 0) {
    leadsParams.push(days);
    leadsFrom = ` AND c."createdAt" >= NOW() - ($2::int || ' days')::interval`;
  } else if (dateFrom) {
    leadsParams.push(dateFrom);
    leadsFrom = ` AND c."createdAt" >= ($2::date)::timestamp`;
  }
  if (days === 0 && dateTo) {
    leadsParams.push(dateTo);
    const idx = leadsParams.length;
    leadsTo = ` AND c."createdAt" < (($${idx}::date) + interval '1 day')::timestamp`;
  }
  const leadsSql = `
    SELECT COALESCE(COUNT(1), 0)::int as leads
    FROM "Contacts" c
    WHERE c."companyId" = $1
    ${leadsFrom}
    ${leadsTo}
  `;

  // Avg support time: closed tickets duration (updatedAt - createdAt), in minutes.
  const avgSupportParams: any[] = [companyId];
  let avgSupportWhere = "";
  if (days > 0) {
    avgSupportParams.push(days);
    avgSupportWhere = ` AND t."updatedAt" >= NOW() - ($2::int || ' days')::interval`;
  } else if (dateFrom) {
    avgSupportParams.push(dateFrom);
    avgSupportWhere = ` AND t."updatedAt" >= ($2::date)::timestamp`;
  }
  if (days === 0 && dateTo) {
    avgSupportParams.push(dateTo);
    const idx = avgSupportParams.length;
    avgSupportWhere += ` AND t."updatedAt" < (($${idx}::date) + interval '1 day')::timestamp`;
  }
  const avgSupportSql = `
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (t."updatedAt" - t."createdAt")) / 60.0), 0)::float as "avgSupportTime"
    FROM "Tickets" t
    WHERE t."companyId" = $1
      AND t.status = 'closed'
      ${avgSupportWhere}
  `;

  // Avg wait time: from ticket createdAt to first agent message (fromMe=true)
  const avgWaitParams: any[] = [companyId];
  let avgWaitWhere = "";
  if (days > 0) {
    avgWaitParams.push(days);
    avgWaitWhere = ` AND t."createdAt" >= NOW() - ($2::int || ' days')::interval`;
  } else if (dateFrom) {
    avgWaitParams.push(dateFrom);
    avgWaitWhere = ` AND t."createdAt" >= ($2::date)::timestamp`;
  }
  if (days === 0 && dateTo) {
    avgWaitParams.push(dateTo);
    const idx = avgWaitParams.length;
    avgWaitWhere += ` AND t."createdAt" < (($${idx}::date) + interval '1 day')::timestamp`;
  }
  const avgWaitSql = `
    WITH first_reply AS (
      SELECT
        t.id as "ticketId",
        MIN(m."createdAt") as "firstReplyAt",
        t."createdAt" as "ticketCreatedAt"
      FROM "Tickets" t
      LEFT JOIN "Messages" m
        ON m."ticketId" = t.id
        AND m."companyId" = t."companyId"
        AND m."fromMe" = true
      WHERE t."companyId" = $1
      ${avgWaitWhere}
      GROUP BY t.id, t."createdAt"
    )
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM ("firstReplyAt" - "ticketCreatedAt")) / 60.0), 0)::float as "avgWaitTime"
    FROM first_reply
    WHERE "firstReplyAt" IS NOT NULL
  `;

  // Attendants table
  const attendantsParams: any[] = [companyId];
  let attendantsWhere = "";
  if (days > 0) {
    attendantsParams.push(days);
    attendantsWhere = ` AND t."updatedAt" >= NOW() - ($2::int || ' days')::interval`;
  } else if (dateFrom) {
    attendantsParams.push(dateFrom);
    attendantsWhere = ` AND t."updatedAt" >= ($2::date)::timestamp`;
  }
  if (days === 0 && dateTo) {
    attendantsParams.push(dateTo);
    const idx = attendantsParams.length;
    attendantsWhere += ` AND t."updatedAt" < (($${idx}::date) + interval '1 day')::timestamp`;
  }

  const attendantsSql = `
    SELECT
      u.id,
      u.name,
      COALESCE(u.online, false) as online,
      NULL::float as rating,
      COALESCE(AVG(EXTRACT(EPOCH FROM (t."updatedAt" - t."createdAt")) / 60.0) FILTER (WHERE t.status = 'closed'), 0)::float as "avgSupportTime"
    FROM "Users" u
    LEFT JOIN "Tickets" t
      ON t."userId" = u.id
      AND t."companyId" = u."companyId"
      ${attendantsWhere}
    WHERE u."companyId" = $1
    GROUP BY u.id, u.name, u.online
    ORDER BY u.name ASC
  `;

  try {
    const [countersRows, leadsRows, avgSupportRows, avgWaitRows, attendantsRows] = await Promise.all([
      pgQuery<any>(countersSql, params),
      pgQuery<any>(leadsSql, leadsParams),
      pgQuery<any>(avgSupportSql, avgSupportParams),
      pgQuery<any>(avgWaitSql, avgWaitParams),
      pgQuery<any>(attendantsSql, attendantsParams)
    ]);

    const counters = {
      supportPending: Number(countersRows?.[0]?.supportPending || 0) || 0,
      supportHappening: Number(countersRows?.[0]?.supportHappening || 0) || 0,
      supportFinished: Number(countersRows?.[0]?.supportFinished || 0) || 0,
      leads: Number(leadsRows?.[0]?.leads || 0) || 0,
      avgSupportTime: Math.round(Number(avgSupportRows?.[0]?.avgSupportTime || 0) || 0),
      avgWaitTime: Math.round(Number(avgWaitRows?.[0]?.avgWaitTime || 0) || 0)
    };

    const attendants = (Array.isArray(attendantsRows) ? attendantsRows : []).map((a: any) => ({
      id: a.id,
      name: a.name,
      online: Boolean(a.online),
      rating: a.rating === null || a.rating === undefined ? null : Number(a.rating),
      avgSupportTime: Math.round(Number(a.avgSupportTime || 0) || 0)
    }));

    return res.json({ counters, attendants });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "dashboard error" });
  }
});

export default router;


