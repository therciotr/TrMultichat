import { Router } from "express";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { getLegacyModel } from "../../utils/legacyModel";
import { getCompanyMailSettings, saveCompanyMailSettings } from "../../utils/settingsMail";
import { pgQuery } from "../../utils/pgClient";
import path from "path";

const router = Router();

function extractTenantIdFromAuth(authorization?: string): number {
  try {
    const parts = (authorization || "").split(" ");
    const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (!bearer) return 1;
    const payload = jwt.verify(bearer, env.JWT_SECRET) as { tenantId?: number };
    return Number(payload?.tenantId || 1);
  } catch {
    return 1;
  }
}

function setNoCache(res: any) {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("ETag", `W/\"${Date.now()}\"`);
  } catch {}
}

function quoteIdent(name: string): string {
  const safe = String(name).replace(/"/g, '""');
  return `"${safe}"`;
}

async function resolveSettingsTable(): Promise<string> {
  // Try to find a settings-like table in public schema; fall back to Sequelize default "Settings".
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

function requireFromCandidates(moduleRelPath: string): any | null {
  const cwd = process.cwd();
  const candidates = [
    // running from backend root
    path.resolve(cwd, moduleRelPath),
    path.resolve(cwd, "dist", moduleRelPath),
    // monorepo layouts
    path.resolve(cwd, "backend", moduleRelPath),
    path.resolve(cwd, "backend", "dist", moduleRelPath),
    path.resolve(cwd, "trmultichat", "backend", moduleRelPath),
    path.resolve(cwd, "trmultichat", "backend", "dist", moduleRelPath),
    // relative to compiled modules
    path.resolve(__dirname, "..", "..", "..", moduleRelPath),
    path.resolve(__dirname, "..", "..", "..", "..", "dist", moduleRelPath)
  ];
  for (const p of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const m = require(p);
      return m?.default || m;
    } catch {}
  }
  return null;
}

function ensureLegacyDbBooted() {
  // Legacy models require sequelize initialization, otherwise they throw "Model not initialized".
  // Best-effort boot: ignore errors and let SQL fallback handle.
  try {
    requireFromCandidates("database/index");
  } catch {}
  try {
    requireFromCandidates("database");
  } catch {}
}

router.get("/", async (req, res) => {
  setNoCache(res);
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string) || 1;
  try {
    ensureLegacyDbBooted();
    const Setting = getLegacyModel("Setting");
    if (!Setting || typeof Setting.findAll !== "function") {
      // SQL fallback
      const t = await resolveSettingsTable();
      const cols = await resolveColumnsMap(t);
      const colCompanyId = pickColumn(cols, ["companyId", "company_id", "tenantId", "tenant_id"]);
      const colKey = pickColumn(cols, ["key"]);
      const colValue = pickColumn(cols, ["value"]);
      if (!colKey || !colValue) return res.json([]);
      const whereCompany = colCompanyId ? `WHERE ${quoteIdent(colCompanyId)} = $1` : "";
      const params = colCompanyId ? [tenantId] : [];
      const rows = await pgQuery<any>(`SELECT ${quoteIdent(colKey)} as key, ${quoteIdent(colValue)} as value FROM ${t} ${whereCompany}`, params);
      const list = Array.isArray(rows) ? rows.map((r: any) => ({ key: r.key, value: String(r.value ?? "") })) : [];
      return res.json(list);
    }
    const rows = await Setting.findAll({ where: { companyId: tenantId } });
    const list = Array.isArray(rows) ? rows.map((r: any) => (r?.toJSON ? r.toJSON() : r)) : [];
    // UI espera array [{ key, value }]
    const simplified = list.map((r: any) => ({ key: r.key, value: r.value }));
    return res.json(simplified);
  } catch (e: any) {
    return res.status(200).json([]);
  }
});

router.put("/:key", async (req, res) => {
  const key = String(req.params.key);
  const value = String((req.body && req.body.value) ?? "");
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string) || 1;
  try {
    ensureLegacyDbBooted();
    const Setting = getLegacyModel("Setting");
    if (Setting && typeof Setting.findOne === "function") {
      try {
        let row = await Setting.findOne({ where: { companyId: tenantId, key } });
        if (row) {
          await row.update({ value });
        } else if (typeof Setting.create === "function") {
          row = await Setting.create({ key, value, companyId: tenantId });
        }
        const json = row?.toJSON ? row.toJSON() : row;
        return res.json({ key: json?.key ?? key, value: json?.value ?? value });
      } catch (e: any) {
        // If legacy model is not initialized / DB not available, fall back to SQL.
      }
    }

    // SQL fallback upsert
    const t = await resolveSettingsTable();
    const cols = await resolveColumnsMap(t);
    const colCompanyId = pickColumn(cols, ["companyId", "company_id", "tenantId", "tenant_id"]);
    const colKey = pickColumn(cols, ["key"]);
    const colValue = pickColumn(cols, ["value"]);
    if (!colKey || !colValue) return res.status(501).json({ error: true, message: "settings not available" });

    if (colCompanyId) {
      // Try update first
      const updated = await pgQuery<any>(
        `UPDATE ${t} SET ${quoteIdent(colValue)} = $1 WHERE ${quoteIdent(colCompanyId)} = $2 AND ${quoteIdent(colKey)} = $3 RETURNING ${quoteIdent(colKey)} as key, ${quoteIdent(colValue)} as value`,
        [value, tenantId, key]
      );
      if (updated?.[0]) return res.json({ key: updated[0].key, value: String(updated[0].value ?? "") });
      // Insert
      const inserted = await pgQuery<any>(
        `INSERT INTO ${t} (${quoteIdent(colKey)}, ${quoteIdent(colValue)}, ${quoteIdent(colCompanyId)}) VALUES ($1, $2, $3) RETURNING ${quoteIdent(colKey)} as key, ${quoteIdent(colValue)} as value`,
        [key, value, tenantId]
      );
      if (inserted?.[0]) return res.json({ key: inserted[0].key, value: String(inserted[0].value ?? "") });
      return res.json({ key, value });
    }

    // No company column: update by key only
    const updated = await pgQuery<any>(
      `UPDATE ${t} SET ${quoteIdent(colValue)} = $1 WHERE ${quoteIdent(colKey)} = $2 RETURNING ${quoteIdent(colKey)} as key, ${quoteIdent(colValue)} as value`,
      [value, key]
    );
    if (updated?.[0]) return res.json({ key: updated[0].key, value: String(updated[0].value ?? "") });
    const inserted = await pgQuery<any>(
      `INSERT INTO ${t} (${quoteIdent(colKey)}, ${quoteIdent(colValue)}) VALUES ($1, $2) RETURNING ${quoteIdent(colKey)} as key, ${quoteIdent(colValue)} as value`,
      [key, value]
    );
    if (inserted?.[0]) return res.json({ key: inserted[0].key, value: String(inserted[0].value ?? "") });
    return res.json({ key, value });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "settings error" });
  }
});

router.get("/email", async (req, res) => {
  try {
    const userHeader = req.headers.authorization as string;
    const tenantId = extractTenantIdFromAuth(userHeader) || 1;
    const settings = await getCompanyMailSettings(tenantId);
    return res.json({
      mail_host: settings.mail_host,
      mail_port: settings.mail_port,
      mail_user: settings.mail_user,
      mail_from: settings.mail_from,
      mail_secure: settings.mail_secure,
      has_password: settings.hasPassword
    });
  } catch (e: any) {
    return res
      .status(400)
      .json({ error: true, message: e?.message || "get email settings error" });
  }
});

router.put("/email", async (req, res) => {
  try {
    const auth = req.headers.authorization as string;
    const tenantId = extractTenantIdFromAuth(auth) || 1;

    // ensure user is admin or super
    const parts = (auth || "").split(" ");
    const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (bearer) {
      try {
        const payload = jwt.verify(bearer, env.JWT_SECRET) as { userId?: number };
        const User = getLegacyModel("User");
        if (User && typeof User.findByPk === "function" && payload?.userId) {
          const instance = await User.findByPk(payload.userId);
          const plain = instance?.get ? instance.get({ plain: true }) : instance;
          const isAdmin = !!plain?.admin;
          const isSuper = !!plain?.super;
          if (!isAdmin && !isSuper) {
            return res.status(403).json({ error: true, message: "forbidden" });
          }
        }
      } catch {
        return res.status(401).json({ error: true, message: "invalid token" });
      }
    }

    const { mail_host, mail_port, mail_user, mail_pass, mail_from, mail_secure } = req.body || {};

    await saveCompanyMailSettings(tenantId, {
      mail_host,
      mail_port,
      mail_user,
      mail_pass,
      mail_from,
      mail_secure
    });
    return res.json({ ok: true });
  } catch (e: any) {
    return res
      .status(400)
      .json({ error: true, message: e?.message || "update email settings error" });
  }
});

export default router;


