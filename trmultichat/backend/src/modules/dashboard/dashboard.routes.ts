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

function userIdFromReq(req: any): number {
  return Number(req?.userId || 0);
}

function isAdminProfile(profile: any): boolean {
  const p = String(profile || "").toLowerCase();
  return p === "admin" || p === "super";
}

async function getRequester(req: any): Promise<{
  id: number;
  companyId: number;
  email: string;
  profile: string;
  super: boolean;
}> {
  const id = userIdFromReq(req);
  const companyId = tenantIdFromReq(req);
  if (!id || !companyId) return { id, companyId, email: "", profile: "user", super: false };
  try {
    const rows = await pgQuery<any>(
      `SELECT id, email, "companyId", profile, COALESCE(super,false) as super FROM "Users" WHERE id = $1 LIMIT 1`,
      [id]
    );
    const u = rows?.[0] || {};
    const email = String(u.email || "");
    const profile = String(u.profile || "user");
    const isSuper = Boolean(u.super);
    return { id, companyId: Number(u.companyId || companyId), email, profile, super: isSuper };
  } catch {
    return { id, companyId, email: "", profile: "user", super: false };
  }
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
  const authCompanyId = tenantIdFromReq(req);
  const requesterId = userIdFromReq(req);
  if (!authCompanyId || !requesterId) return res.status(401).json({ error: true, message: "missing auth context" });

  const requester = await getRequester(req);
  const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
  const masterEmail = String(process.env.ADMIN_EMAIL || "thercio@trtecnologias.com.br").toLowerCase().trim();
  const isMasterEmail = String(requester.email || "").toLowerCase().trim() === masterEmail;
  const isSuper = Boolean(requester.super || (isAdminProfile(requester.profile) && (requester.companyId === masterCompanyId || isMasterEmail)));
  const isAdmin = Boolean(isAdminProfile(requester.profile));

  // scope: user (default for non-admin), company (default for admin), system (default for super)
  const requestedScope = String((req.query as any)?.scope || "").toLowerCase().trim();
  let scope: "user" | "company" | "system" = "user";
  if (isSuper) scope = (requestedScope === "user" || requestedScope === "company" || requestedScope === "system") ? (requestedScope as any) : "system";
  else if (isAdmin) scope = "company";
  else scope = "user";

  const requestedCompanyId = toInt((req.query as any)?.companyId, 0);
  const requestedUserId = toInt((req.query as any)?.userId, 0);

  // Resolve effective company/user scope
  let companyId: number | null = null;
  let targetUserId: number | null = null;

  if (scope === "system") {
    companyId = requestedCompanyId > 0 ? requestedCompanyId : null; // null = all companies
  } else if (scope === "company") {
    companyId = isSuper && requestedCompanyId > 0 ? requestedCompanyId : requester.companyId;
  } else {
    targetUserId = isSuper && requestedUserId > 0 ? requestedUserId : requester.id;
    // constrain to the user's company (prevents mixing companies on user view)
    try {
      const urows = await pgQuery<any>(`SELECT "companyId" FROM "Users" WHERE id = $1 LIMIT 1`, [targetUserId]);
      companyId = Number(urows?.[0]?.companyId || requester.companyId || authCompanyId || 0) || requester.companyId;
    } catch {
      companyId = requester.companyId;
    }
  }

  const days = toInt(req.query.days, 0);
  const dateFrom = parseDateOnly(req.query.date_from);
  const dateTo = parseDateOnly(req.query.date_to);

  // Build time range (inclusive)
  let fromTsSql = "";
  let toTsSql = "";
  const params: any[] = [];
  let whereCompany = "";
  if (companyId) {
    params.push(companyId);
    whereCompany = `t."companyId" = $${params.length}`;
  } else {
    whereCompany = `TRUE`;
  }
  let whereUser = "";
  if (scope === "user" && targetUserId) {
    params.push(targetUserId);
    whereUser = ` AND t."userId" = $${params.length}`;
  }

  if (days > 0) {
    params.push(days);
    fromTsSql = ` AND t."createdAt" >= NOW() - ($${params.length}::int || ' days')::interval`;
  } else if (dateFrom) {
    params.push(dateFrom);
    fromTsSql = ` AND t."createdAt" >= ($${params.length}::date)::timestamp`;
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
    WHERE ${whereCompany}
    ${whereUser}
    ${fromTsSql}
    ${toTsSql}
  `;

  // Leads: contacts created in range
  const leadsParams: any[] = [];
  let leadsWhereCompany = "";
  if (companyId) {
    leadsParams.push(companyId);
    leadsWhereCompany = `c."companyId" = $1`;
  } else {
    leadsWhereCompany = `TRUE`;
  }
  let leadsFrom = "";
  let leadsTo = "";
  if (days > 0) {
    leadsParams.push(days);
    leadsFrom = ` AND c."createdAt" >= NOW() - ($${leadsParams.length}::int || ' days')::interval`;
  } else if (dateFrom) {
    leadsParams.push(dateFrom);
    leadsFrom = ` AND c."createdAt" >= ($${leadsParams.length}::date)::timestamp`;
  }
  if (days === 0 && dateTo) {
    leadsParams.push(dateTo);
    const idx = leadsParams.length;
    leadsTo = ` AND c."createdAt" < (($${idx}::date) + interval '1 day')::timestamp`;
  }
  const leadsSql = `
    SELECT COALESCE(COUNT(1), 0)::int as leads
    FROM "Contacts" c
    WHERE ${leadsWhereCompany}
    ${leadsFrom}
    ${leadsTo}
  `;

  // Avg support time: closed tickets duration (updatedAt - createdAt), in minutes.
  const avgSupportParams: any[] = [];
  let avgSupportWhereCompany = "";
  if (companyId) {
    avgSupportParams.push(companyId);
    avgSupportWhereCompany = `t."companyId" = $1`;
  } else {
    avgSupportWhereCompany = `TRUE`;
  }
  let avgSupportWhereUser = "";
  if (scope === "user" && targetUserId) {
    avgSupportParams.push(targetUserId);
    avgSupportWhereUser = ` AND t."userId" = $${avgSupportParams.length}`;
  }
  let avgSupportWhere = "";
  if (days > 0) {
    avgSupportParams.push(days);
    avgSupportWhere = ` AND t."updatedAt" >= NOW() - ($${avgSupportParams.length}::int || ' days')::interval`;
  } else if (dateFrom) {
    avgSupportParams.push(dateFrom);
    avgSupportWhere = ` AND t."updatedAt" >= ($${avgSupportParams.length}::date)::timestamp`;
  }
  if (days === 0 && dateTo) {
    avgSupportParams.push(dateTo);
    const idx = avgSupportParams.length;
    avgSupportWhere += ` AND t."updatedAt" < (($${idx}::date) + interval '1 day')::timestamp`;
  }
  const avgSupportSql = `
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (t."updatedAt" - t."createdAt")) / 60.0), 0)::float as "avgSupportTime"
    FROM "Tickets" t
    WHERE ${avgSupportWhereCompany}
      ${avgSupportWhereUser}
      AND t.status = 'closed'
      ${avgSupportWhere}
  `;

  // Avg wait time: from ticket createdAt to first agent message (fromMe=true)
  const avgWaitParams: any[] = [];
  let avgWaitWhereCompany = "";
  if (companyId) {
    avgWaitParams.push(companyId);
    avgWaitWhereCompany = `t."companyId" = $1`;
  } else {
    avgWaitWhereCompany = `TRUE`;
  }
  let avgWaitWhereUser = "";
  if (scope === "user" && targetUserId) {
    avgWaitParams.push(targetUserId);
    avgWaitWhereUser = ` AND t."userId" = $${avgWaitParams.length}`;
  }
  let avgWaitWhere = "";
  if (days > 0) {
    avgWaitParams.push(days);
    avgWaitWhere = ` AND t."createdAt" >= NOW() - ($${avgWaitParams.length}::int || ' days')::interval`;
  } else if (dateFrom) {
    avgWaitParams.push(dateFrom);
    avgWaitWhere = ` AND t."createdAt" >= ($${avgWaitParams.length}::date)::timestamp`;
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
      WHERE ${avgWaitWhereCompany}
      ${avgWaitWhereUser}
      ${avgWaitWhere}
      GROUP BY t.id, t."createdAt"
    )
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM ("firstReplyAt" - "ticketCreatedAt")) / 60.0), 0)::float as "avgWaitTime"
    FROM first_reply
    WHERE "firstReplyAt" IS NOT NULL
  `;

  // Rankings
  const rankingsParams: any[] = [];
  let rCompanyWhere = "";
  if (companyId) {
    rankingsParams.push(companyId);
    rCompanyWhere = `t."companyId" = $1`;
  } else {
    rCompanyWhere = `TRUE`;
  }
  let rUserWhere = "";
  if (scope === "user" && targetUserId) {
    rankingsParams.push(targetUserId);
    rUserWhere = ` AND t."userId" = $${rankingsParams.length}`;
  }
  let rFrom = "";
  let rTo = "";
  if (days > 0) {
    rankingsParams.push(days);
    rFrom = ` AND t."createdAt" >= NOW() - ($${rankingsParams.length}::int || ' days')::interval`;
  } else if (dateFrom) {
    rankingsParams.push(dateFrom);
    rFrom = ` AND t."createdAt" >= ($${rankingsParams.length}::date)::timestamp`;
  }
  if (days === 0 && dateTo) {
    rankingsParams.push(dateTo);
    rTo = ` AND t."createdAt" < (($${rankingsParams.length}::date) + interval '1 day')::timestamp`;
  }

  // Attendants ranking (by closed tickets)
  const attendantsUserFilter = scope === "user" && targetUserId ? ` AND u.id = $2` : "";
  const attendantsRankSql = `
    SELECT
      u.id,
      u.name,
      COALESCE(u.online, false) as online,
      COUNT(t.id) FILTER (WHERE t.status = 'closed')::int as "closedCount",
      COUNT(t.id) FILTER (WHERE t.status = 'open')::int as "openCount",
      COUNT(t.id) FILTER (WHERE t.status = 'pending')::int as "pendingCount",
      COALESCE(AVG(EXTRACT(EPOCH FROM (t."updatedAt" - t."createdAt")) / 60.0) FILTER (WHERE t.status = 'closed'), 0)::float as "avgSupportTime"
    FROM "Users" u
    LEFT JOIN "Tickets" t
      ON t."userId" = u.id
      AND (${rCompanyWhere})
      ${rFrom}
      ${rTo}
    WHERE ${companyId ? 'u."companyId" = $1' : "TRUE"}
    ${attendantsUserFilter}
    ${companyId ? "" : ""}
    GROUP BY u.id, u.name, u.online
    ORDER BY "closedCount" DESC, "openCount" DESC, u.name ASC
    LIMIT 20
  `;

  // Queue ranking
  const queuesRankSql = `
    SELECT
      COALESCE(q.id, 0)::int as id,
      COALESCE(q.name, 'Sem fila')::text as name,
      COALESCE(q.color, '#7c7c7c')::text as color,
      COUNT(t.id)::int as "totalTickets",
      COUNT(t.id) FILTER (WHERE t.status = 'closed')::int as "closedTickets",
      COUNT(t.id) FILTER (WHERE t.status = 'open')::int as "openTickets",
      COUNT(t.id) FILTER (WHERE t.status = 'pending')::int as "pendingTickets"
    FROM "Tickets" t
    LEFT JOIN "Queues" q ON q.id = t."queueId"
    WHERE ${rCompanyWhere}
      ${rUserWhere}
      ${rFrom}
      ${rTo}
    GROUP BY q.id, q.name, q.color
    ORDER BY "totalTickets" DESC, "pendingTickets" DESC
    LIMIT 20
  `;

  // Clients ranking (who contacts most)
  const clientsRankSql = `
    SELECT
      c.id,
      c.name,
      c.number,
      COUNT(t.id)::int as "ticketsCount",
      MAX(t."createdAt") as "lastTicketAt"
    FROM "Tickets" t
    JOIN "Contacts" c ON c.id = t."contactId"
    WHERE ${rCompanyWhere}
      ${rUserWhere}
      ${rFrom}
      ${rTo}
    GROUP BY c.id, c.name, c.number
    ORDER BY "ticketsCount" DESC, "lastTicketAt" DESC
    LIMIT 20
  `;

  try {
    const [countersRows, leadsRows, avgSupportRows, avgWaitRows, attendantsRankRows, queuesRankRows, clientsRankRows] = await Promise.all([
      pgQuery<any>(countersSql, params),
      pgQuery<any>(leadsSql, leadsParams),
      pgQuery<any>(avgSupportSql, avgSupportParams),
      pgQuery<any>(avgWaitSql, avgWaitParams),
      pgQuery<any>(attendantsRankSql, rankingsParams),
      pgQuery<any>(queuesRankSql, rankingsParams),
      pgQuery<any>(clientsRankSql, rankingsParams)
    ]);

    const counters = {
      supportPending: Number(countersRows?.[0]?.supportPending || 0) || 0,
      supportHappening: Number(countersRows?.[0]?.supportHappening || 0) || 0,
      supportFinished: Number(countersRows?.[0]?.supportFinished || 0) || 0,
      leads: Number(leadsRows?.[0]?.leads || 0) || 0,
      avgSupportTime: Math.round(Number(avgSupportRows?.[0]?.avgSupportTime || 0) || 0),
      avgWaitTime: Math.round(Number(avgWaitRows?.[0]?.avgWaitTime || 0) || 0)
    };

    const attendants = (Array.isArray(attendantsRankRows) ? attendantsRankRows : []).map((a: any) => ({
      id: a.id,
      name: a.name,
      online: Boolean(a.online),
      closedCount: Number(a.closedCount || 0) || 0,
      openCount: Number(a.openCount || 0) || 0,
      pendingCount: Number(a.pendingCount || 0) || 0,
      avgSupportTime: Math.round(Number(a.avgSupportTime || 0) || 0)
    }));

    const queuesRanking = (Array.isArray(queuesRankRows) ? queuesRankRows : []).map((q: any) => ({
      id: Number(q.id || 0) || 0,
      name: String(q.name || ""),
      color: String(q.color || "#7c7c7c"),
      totalTickets: Number(q.totalTickets || 0) || 0,
      closedTickets: Number(q.closedTickets || 0) || 0,
      openTickets: Number(q.openTickets || 0) || 0,
      pendingTickets: Number(q.pendingTickets || 0) || 0
    }));

    const clientsRanking = (Array.isArray(clientsRankRows) ? clientsRankRows : []).map((c: any) => ({
      id: Number(c.id || 0) || 0,
      name: String(c.name || ""),
      number: String(c.number || ""),
      ticketsCount: Number(c.ticketsCount || 0) || 0,
      lastTicketAt: c.lastTicketAt || null
    }));

    // Companies list for super filter
    let companies: any[] = [];
    if (isSuper) {
      try {
        const rows = await pgQuery<any>(
          `SELECT id, name FROM "Companies" ORDER BY id ASC LIMIT 10000`,
          []
        );
        companies = Array.isArray(rows) ? rows.map((r: any) => ({ id: Number(r.id), name: String(r.name || "") })) : [];
      } catch {
        companies = [];
      }
    }

    return res.json({
      scope: {
        mode: isSuper ? "super" : isAdmin ? "admin" : "user",
        scope,
        companyId: companyId || null,
        userId: targetUserId || null,
        canSelectCompany: Boolean(isSuper),
        companies
      },
      counters,
      rankings: {
        attendants,
        queues: queuesRanking,
        clients: clientsRanking
      }
    });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "dashboard error" });
  }
});

export default router;


