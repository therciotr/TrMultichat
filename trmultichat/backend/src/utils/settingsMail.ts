import { getLegacyModel } from "./legacyModel";
import { pgQuery } from "./pgClient";

function quoteIdent(name: string): string {
  const safe = String(name).replace(/"/g, '""');
  return `"${safe}"`;
}

async function resolveSettingsTable(): Promise<string> {
  try {
    const rows = await pgQuery<{ table_name: string }>(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name ILIKE 'settings' OR table_name ILIKE 'Settings')
      LIMIT 1
    `
    );
    const name = rows?.[0]?.table_name;
    if (name) return quoteIdent(name);
  } catch {}
  return quoteIdent("Settings");
}

async function resolveColumnsMap(tableIdentQuoted: string): Promise<Map<string, string>> {
  try {
    const rawName = tableIdentQuoted.replace(/^"+|"+$/g, "").replace(/""/g, '"');
    const cols = await pgQuery<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
      [rawName]
    );
    return new Map((cols || []).map((c) => [String(c.column_name || "").toLowerCase(), c.column_name]));
  } catch {
    return new Map();
  }
}

function pickColumn(cols: Map<string, string>, candidates: string[]): string | null {
  for (const c of candidates) {
    const found = cols.get(String(c).toLowerCase());
    if (found) return found;
  }
  return null;
}

export type CompanyMailSettings = {
  mail_host: string | null;
  mail_port: number | null;
  mail_user: string | null;
  mail_from: string | null;
  mail_secure: boolean | null;
  hasPassword: boolean;
};

export type MailSettingsDto = {
  mail_host?: string;
  mail_port?: number;
  mail_user?: string;
  mail_pass?: string;
  mail_from?: string;
  mail_secure?: boolean;
};

const MAIL_KEYS = ["mail_host", "mail_port", "mail_user", "mail_from", "mail_secure", "mail_pass"];

async function loadFromPg(companyId: number): Promise<CompanyMailSettings | null> {
  try {
    const t = await resolveSettingsTable();
    const cols = await resolveColumnsMap(t);
    const colCompanyId = pickColumn(cols, ["companyId", "company_id", "tenantId", "tenant_id"]);
    const colKey = pickColumn(cols, ["key"]);
    const colValue = pickColumn(cols, ["value"]);
    if (!colKey || !colValue) return null;

    const where = colCompanyId
      ? `WHERE ${quoteIdent(colCompanyId)} = $1 AND ${quoteIdent(colKey)} = ANY($2::text[])`
      : `WHERE ${quoteIdent(colKey)} = ANY($1::text[])`;
    const params = colCompanyId ? [companyId, MAIL_KEYS] : [MAIL_KEYS];

    const rows = await pgQuery<any>(
      `SELECT ${quoteIdent(colKey)} as key, ${quoteIdent(colValue)} as value FROM ${t} ${where}`,
      params
    );
    const map = new Map<string, string>();
    for (const r of rows || []) {
      map.set(String(r.key), String(r.value ?? ""));
    }
    const mail_host = map.get("mail_host") || null;
    const mail_port = map.get("mail_port") ? Number(map.get("mail_port")) : null;
    const mail_user = map.get("mail_user") || null;
    const mail_from = map.get("mail_from") || null;
    const mail_secure = map.has("mail_secure")
      ? String(map.get("mail_secure")).toLowerCase() === "true"
      : null;
    const hasPassword = map.has("mail_pass") && !!map.get("mail_pass");

    return {
      mail_host,
      mail_port: Number.isNaN(mail_port as any) ? null : mail_port,
      mail_user,
      mail_from,
      mail_secure,
      hasPassword
    };
  } catch {
    return null;
  }
}

async function saveToPg(companyId: number, dto: MailSettingsDto): Promise<boolean> {
  try {
    const t = await resolveSettingsTable();
    const cols = await resolveColumnsMap(t);
    const colCompanyId = pickColumn(cols, ["companyId", "company_id", "tenantId", "tenant_id"]);
    const colKey = pickColumn(cols, ["key"]);
    const colValue = pickColumn(cols, ["value"]);
    if (!colKey || !colValue) return false;

    async function upsertSql(key: string, value: string) {
      if (colCompanyId) {
        const updated = await pgQuery<any>(
          `UPDATE ${t} SET ${quoteIdent(colValue)} = $1 WHERE ${quoteIdent(colCompanyId)} = $2 AND ${quoteIdent(colKey)} = $3 RETURNING ${quoteIdent(colKey)} as key`,
          [value, companyId, key]
        );
        if (updated?.[0]) return;
        await pgQuery<any>(
          `INSERT INTO ${t} (${quoteIdent(colKey)}, ${quoteIdent(colValue)}, ${quoteIdent(colCompanyId)}) VALUES ($1, $2, $3)`,
          [key, value, companyId]
        );
        return;
      }
      // no company column: best-effort (global)
      const updated = await pgQuery<any>(
        `UPDATE ${t} SET ${quoteIdent(colValue)} = $1 WHERE ${quoteIdent(colKey)} = $2 RETURNING ${quoteIdent(colKey)} as key`,
        [value, key]
      );
      if (updated?.[0]) return;
      await pgQuery<any>(
        `INSERT INTO ${t} (${quoteIdent(colKey)}, ${quoteIdent(colValue)}) VALUES ($1, $2)`,
        [key, value]
      );
    }

    if (dto.mail_host !== undefined) await upsertSql("mail_host", dto.mail_host || "");
    if (dto.mail_port !== undefined)
      await upsertSql("mail_port", dto.mail_port != null ? String(dto.mail_port) : "");
    if (dto.mail_user !== undefined) await upsertSql("mail_user", dto.mail_user || "");
    if (dto.mail_from !== undefined) await upsertSql("mail_from", dto.mail_from || "");
    if (dto.mail_secure !== undefined)
      await upsertSql("mail_secure", dto.mail_secure ? "true" : "false");
    if (dto.mail_pass !== undefined && dto.mail_pass !== "") {
      await upsertSql("mail_pass", dto.mail_pass);
    }

    return true;
  } catch {
    return false;
  }
}

export async function getCompanyMailPassword(companyId: number): Promise<string | undefined> {
  // Prefer PG, fall back to legacy
  try {
    const t = await resolveSettingsTable();
    const cols = await resolveColumnsMap(t);
    const colCompanyId = pickColumn(cols, ["companyId", "company_id", "tenantId", "tenant_id"]);
    const colKey = pickColumn(cols, ["key"]);
    const colValue = pickColumn(cols, ["value"]);
    if (!colKey || !colValue) throw new Error("missing columns");

    const where = colCompanyId
      ? `WHERE ${quoteIdent(colCompanyId)} = $1 AND ${quoteIdent(colKey)} = $2 LIMIT 1`
      : `WHERE ${quoteIdent(colKey)} = $1 LIMIT 1`;
    const params = colCompanyId ? [companyId, "mail_pass"] : ["mail_pass"];
    const rows = await pgQuery<any>(
      `SELECT ${quoteIdent(colValue)} as value FROM ${t} ${where}`,
      params
    );
    const val = rows?.[0]?.value;
    if (val === undefined || val === null) return undefined;
    const s = String(val);
    return s ? s : undefined;
  } catch {}

  try {
    const Setting = getLegacyModel("Setting");
    if (Setting && typeof Setting.findOne === "function") {
      const found = await Setting.findOne({ where: { companyId, key: "mail_pass" } });
      const plain = found?.get ? found.get({ plain: true }) : found;
      const pass = plain?.value ? String(plain.value) : "";
      return pass ? pass : undefined;
    }
  } catch {}
  return undefined;
}

export async function getCompanyMailSettings(
  companyId: number
): Promise<CompanyMailSettings> {
  // Prefer PG (most reliable in production), then legacy as fallback.
  const pg = await loadFromPg(companyId);
  if (pg) return pg;

  const Setting = getLegacyModel("Setting");
  if (!Setting || typeof Setting.findAll !== "function") {
    return {
      mail_host: null,
      mail_port: null,
      mail_user: null,
      mail_from: null,
      mail_secure: null,
      hasPassword: false
    };
  }

  const rows = await Setting.findAll({ where: { companyId } });
  const map = new Map<string, string>();
  for (const s of rows) {
    const plain = s?.get ? s.get({ plain: true }) : (s as any);
    map.set(String(plain.key), String(plain.value ?? ""));
  }

  const mail_host = map.get("mail_host") || null;
  const mail_port = map.get("mail_port") ? Number(map.get("mail_port")) : null;
  const mail_user = map.get("mail_user") || null;
  const mail_from = map.get("mail_from") || null;
  const mail_secure = map.has("mail_secure")
    ? String(map.get("mail_secure")).toLowerCase() === "true"
    : null;
  const hasPassword = map.has("mail_pass") && !!map.get("mail_pass");

  return {
    mail_host,
    mail_port: Number.isNaN(mail_port as any) ? null : mail_port,
    mail_user,
    mail_from,
    mail_secure,
    hasPassword
  };
}

export async function saveCompanyMailSettings(
  companyId: number,
  dto: MailSettingsDto
): Promise<void> {
  // Prefer PG save; if it fails, fall back to legacy.
  const pgOk = await saveToPg(companyId, dto);
  if (pgOk) return;

  const Setting = getLegacyModel("Setting");
  if (!Setting || typeof Setting.findOne !== "function") return;

  async function upsert(key: string, value: string) {
    const found = await Setting.findOne({ where: { companyId, key } });
    if (found) {
      await found.update({ value });
    } else {
      await Setting.create({ companyId, key, value });
    }
  }

  if (dto.mail_host !== undefined)
    await upsert("mail_host", dto.mail_host || "");
  if (dto.mail_port !== undefined)
    await upsert(
      "mail_port",
      dto.mail_port != null ? String(dto.mail_port) : ""
    );
  if (dto.mail_user !== undefined)
    await upsert("mail_user", dto.mail_user || "");
  if (dto.mail_from !== undefined)
    await upsert("mail_from", dto.mail_from || "");
  if (dto.mail_secure !== undefined)
    await upsert("mail_secure", dto.mail_secure ? "true" : "false");

  if (dto.mail_pass !== undefined && dto.mail_pass !== "") {
    await upsert("mail_pass", dto.mail_pass);
  }
}
