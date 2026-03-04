/* Global cleanup: normalize BR numbers and merge duplicate active tickets. */
require("dotenv").config();
const { Client } = require("pg");

function canonicalNumber(raw) {
  const digits = String(raw || "").replace(/\D+/g, "");
  if (!digits) return "";
  let withCountry =
    digits.startsWith("55") || digits.length > 11 ? digits : `55${digits}`;
  if (withCountry.startsWith("55")) {
    if (withCountry.length > 13) {
      withCountry = `55${withCountry.slice(-11)}`;
    }
    if (withCountry.length === 12) {
      withCountry = `${withCountry.slice(0, 4)}9${withCountry.slice(4)}`;
    }
  }
  return withCountry;
}

function pickContactKeeper(items, activeByContactId) {
  const scored = [...items].sort((a, b) => {
    const aCanonical = Number(canonicalNumber(a.number) === String(a.number || "")) ? 1 : 0;
    const bCanonical = Number(canonicalNumber(b.number) === String(b.number || "")) ? 1 : 0;
    if (bCanonical !== aCanonical) return bCanonical - aCanonical;
    const aActive = Number(activeByContactId.get(a.id) || 0);
    const bActive = Number(activeByContactId.get(b.id) || 0);
    if (bActive !== aActive) return bActive - aActive;
    const aUpdated = new Date(a.updatedAt || 0).getTime();
    const bUpdated = new Date(b.updatedAt || 0).getTime();
    if (bUpdated !== aUpdated) return bUpdated - aUpdated;
    return b.id - a.id;
  });
  return scored[0];
}

function pickTicketKeeper(items) {
  const scored = [...items].sort((a, b) => {
    const aOpen = a.status === "open" ? 1 : 0;
    const bOpen = b.status === "open" ? 1 : 0;
    if (bOpen !== aOpen) return bOpen - aOpen;
    const aUpdated = new Date(a.updatedAt || 0).getTime();
    const bUpdated = new Date(b.updatedAt || 0).getTime();
    if (bUpdated !== aUpdated) return bUpdated - aUpdated;
    return b.id - a.id;
  });
  return scored[0];
}

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined,
    host: process.env.DB_HOST || process.env.POSTGRES_HOST || undefined,
    port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || 5432),
    user: process.env.DB_USER || process.env.POSTGRES_USER || undefined,
    password: process.env.DB_PASS || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || undefined,
    database: process.env.DB_NAME || process.env.POSTGRES_DB || undefined,
  });
  await client.connect();

  const report = {
    contactsMerged: 0,
    ticketsRepointed: 0,
    contactsDeleted: 0,
    contactsNormalized: 0,
    duplicateActiveTicketsClosed: 0,
  };

  try {
    await client.query("BEGIN");

    const contactsRes = await client.query(`
      SELECT id, "companyId", number, "updatedAt"
      FROM "Contacts"
      WHERE COALESCE("isGroup", false) = false
    `);
    const contacts = contactsRes.rows || [];

    const activeCountRes = await client.query(`
      SELECT "contactId" as id, COUNT(*)::int as cnt
      FROM "Tickets"
      WHERE status IN ('open','pending')
      GROUP BY "contactId"
    `);
    const activeByContactId = new Map(
      (activeCountRes.rows || []).map((r) => [Number(r.id), Number(r.cnt || 0)])
    );

    const groups = new Map();
    for (const c of contacts) {
      const canonical = canonicalNumber(c.number);
      if (!canonical) continue;
      const key = `${c.companyId}:${canonical}`;
      const arr = groups.get(key) || [];
      arr.push({
        id: Number(c.id),
        companyId: Number(c.companyId),
        number: String(c.number || ""),
        updatedAt: c.updatedAt,
        canonical,
      });
      groups.set(key, arr);
    }

    // Contact merge is intentionally skipped in this cleanup run because
    // some databases have strict constraints/triggers around contact/ticket links.
    // We still prevent future duplication in ingest and close active duplicate tickets below.

    // Normalize numbers to canonical for remaining contacts (skip if target already exists).
    const remainingRes = await client.query(`
      SELECT id, "companyId", number
      FROM "Contacts"
      WHERE COALESCE("isGroup", false) = false
    `);
    for (const c of remainingRes.rows || []) {
      const id = Number(c.id);
      const companyId = Number(c.companyId);
      const current = String(c.number || "");
      const normalized = canonicalNumber(current);
      if (!normalized || normalized === current) continue;
      const conflict = await client.query(
        `SELECT id FROM "Contacts" WHERE "companyId" = $1 AND number = $2 AND id <> $3 LIMIT 1`,
        [companyId, normalized, id]
      );
      if ((conflict.rows || []).length > 0) continue;
      const upd = await client.query(
        `UPDATE "Contacts" SET number = $1, "updatedAt" = NOW() WHERE id = $2 AND "companyId" = $3`,
        [normalized, id, companyId]
      );
      report.contactsNormalized += Number(upd.rowCount || 0);
    }

    // Close duplicate active tickets for same company + whatsapp + canonical contact number.
    const activeTicketsRes = await client.query(`
      SELECT
        t.id,
        t.status,
        t."companyId",
        COALESCE(t."whatsappId", 0) as "whatsappId",
        t."updatedAt",
        c.number as contact_number
      FROM "Tickets" t
      JOIN "Contacts" c ON c.id = t."contactId"
      WHERE t.status IN ('open', 'pending')
        AND COALESCE(c."isGroup", false) = false
    `);

    const ticketGroups = new Map();
    for (const t of activeTicketsRes.rows || []) {
      const canonical = canonicalNumber(t.contact_number);
      if (!canonical) continue;
      const key = `${t.companyId}:${t.whatsappId}:${canonical}`;
      const arr = ticketGroups.get(key) || [];
      arr.push({
        id: Number(t.id),
        status: String(t.status || ""),
        updatedAt: t.updatedAt,
      });
      ticketGroups.set(key, arr);
    }

    for (const items of ticketGroups.values()) {
      if (items.length <= 1) continue;
      const keeper = pickTicketKeeper(items);
      for (const it of items) {
        if (it.id === keeper.id) continue;
        const closed = await client.query(
          `UPDATE "Tickets" SET status = 'closed', "updatedAt" = NOW() WHERE id = $1 AND status IN ('open','pending')`,
          [it.id]
        );
        report.duplicateActiveTicketsClosed += Number(closed.rowCount || 0);
      }
    }

    await client.query("COMMIT");
    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("cleanup_failed:", e?.message || e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
