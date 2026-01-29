import { Router } from "express";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { getLegacyModel } from "../../utils/legacyModel";
import { getCompanyMailSettings, saveCompanyMailSettings } from "../../utils/settingsMail";
import { pgQuery } from "../../utils/pgClient";
import { deleteSettingKey } from "../../utils/settingsStore";
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

async function ensureMailProfilesSchema() {
  // Multi-profile SMTP support (company-scoped)
  await pgQuery(
    `
    CREATE TABLE IF NOT EXISTS "MailSettingsProfiles" (
      id SERIAL PRIMARY KEY,
      "companyId" integer NOT NULL,
      name text NOT NULL DEFAULT '',
      host text,
      port integer,
      "user" text,
      "from" text,
      secure boolean,
      pass text,
      "isDefault" boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `
  );
  await pgQuery(`ALTER TABLE "MailSettingsProfiles" ADD COLUMN IF NOT EXISTS "companyId" integer`);
  await pgQuery(`ALTER TABLE "MailSettingsProfiles" ADD COLUMN IF NOT EXISTS name text`);
  await pgQuery(`ALTER TABLE "MailSettingsProfiles" ADD COLUMN IF NOT EXISTS host text`);
  await pgQuery(`ALTER TABLE "MailSettingsProfiles" ADD COLUMN IF NOT EXISTS port integer`);
  await pgQuery(`ALTER TABLE "MailSettingsProfiles" ADD COLUMN IF NOT EXISTS "user" text`);
  await pgQuery(`ALTER TABLE "MailSettingsProfiles" ADD COLUMN IF NOT EXISTS "from" text`);
  await pgQuery(`ALTER TABLE "MailSettingsProfiles" ADD COLUMN IF NOT EXISTS secure boolean`);
  await pgQuery(`ALTER TABLE "MailSettingsProfiles" ADD COLUMN IF NOT EXISTS pass text`);
  await pgQuery(`ALTER TABLE "MailSettingsProfiles" ADD COLUMN IF NOT EXISTS "isDefault" boolean`);
  await pgQuery(`ALTER TABLE "MailSettingsProfiles" ADD COLUMN IF NOT EXISTS "createdAt" timestamptz`);
  await pgQuery(`ALTER TABLE "MailSettingsProfiles" ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "MailSettingsProfiles_companyId_idx" ON "MailSettingsProfiles" ("companyId")`);
}

async function ensureAdminFromAuth(auth: string): Promise<{ ok: true; tenantId: number } | { ok: false; status: number; message: string }> {
  const tenantId = extractTenantIdFromAuth(auth) || 1;
  const parts = (auth || "").split(" ");
  const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
  if (!bearer) return { ok: true, tenantId };
  try {
    const payload = jwt.verify(bearer, env.JWT_SECRET) as any;
    const userId = Number(payload?.userId || payload?.id || 0);
    const profile = String(payload?.profile || "").toLowerCase();
    const isSuperLike = Boolean(payload?.super) || profile === "super";
    const isAdminLike = isSuperLike || Boolean(payload?.admin) || profile === "admin";
    if (isAdminLike) return { ok: true, tenantId };
    if (!userId) return { ok: false, status: 401, message: "invalid token" };
    try {
      const rows = await pgQuery<{ admin?: boolean; super?: boolean; profile?: string }>(
        'SELECT admin, "super", profile FROM "Users" WHERE id = $1 LIMIT 1',
        [userId]
      );
      const u = Array.isArray(rows) ? rows[0] : undefined;
      const dbProfile = String(u?.profile || "").toLowerCase();
      const dbAdmin = Boolean(u?.admin) || dbProfile === "admin";
      const dbSuper = Boolean((u as any)?.super) || dbProfile === "super";
      if (!dbAdmin && !dbSuper) return { ok: false, status: 403, message: "forbidden" };
      return { ok: true, tenantId };
    } catch {
      return { ok: false, status: 403, message: "forbidden" };
    }
  } catch {
    return { ok: false, status: 401, message: "invalid token" };
  }
}

async function syncDefaultProfileToLegacy(companyId: number, profile: any) {
  // Keep backwards compatibility with old single-config keys used by mailer/settingsMail
  try {
    await saveCompanyMailSettings(companyId, {
      mail_host: profile?.host ?? null,
      mail_port: profile?.port ?? null,
      mail_user: profile?.user ?? null,
      mail_from: profile?.from ?? null,
      mail_secure: profile?.secure ?? null,
      mail_pass: profile?.pass ?? ""
    } as any);
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

router.get("/email", async (req, res) => {
  try {
    setNoCache(res);
    const userHeader = req.headers.authorization as string;
    const tenantId = extractTenantIdFromAuth(userHeader) || 1;
    // Prefer default profile (multi-profile SMTP)
    try {
      await ensureMailProfilesSchema();
      const rows = await pgQuery<any>(
        `
        SELECT id, name, host, port, "user", "from", secure,
               (CASE WHEN COALESCE(pass,'') <> '' THEN true ELSE false END) as "has_password",
               COALESCE("isDefault", false) as "isDefault"
        FROM "MailSettingsProfiles"
        WHERE "companyId" = $1 AND COALESCE("isDefault", false) = true
        ORDER BY "updatedAt" DESC
        LIMIT 1
      `,
        [tenantId]
      );
      const p = Array.isArray(rows) ? rows[0] : undefined;
      if (p && p.host) {
        return res.json({
          mail_host: p.host ?? null,
          mail_port: p.port ?? null,
          mail_user: p.user ?? null,
          mail_from: p.from ?? null,
          mail_secure: typeof p.secure === "boolean" ? p.secure : null,
          has_password: Boolean(p.has_password)
        });
      }
    } catch {}

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
    setNoCache(res);
    const auth = req.headers.authorization as string;
    const adminCheck = await ensureAdminFromAuth(auth);
    if (!adminCheck.ok) {
      const err = adminCheck as any;
      return res.status(Number(err.status || 403)).json({ error: true, message: String(err.message || "forbidden") });
    }
    const tenantId = (adminCheck as any).tenantId as number;

    const { mail_host, mail_port, mail_user, mail_pass, mail_from, mail_secure } = req.body || {};

    // Keep legacy single-config behavior, but ALSO ensure there is a default profile.
    try {
      await ensureMailProfilesSchema();
      const existingDefault = await pgQuery<any>(
        `SELECT id FROM "MailSettingsProfiles" WHERE "companyId" = $1 AND COALESCE("isDefault", false) = true ORDER BY "updatedAt" DESC LIMIT 1`,
        [tenantId]
      );
      const defaultId = existingDefault?.[0]?.id ? Number(existingDefault[0].id) : 0;
      const name = String(req.body?.name || mail_user || "SMTP").trim() || "SMTP";

      if (defaultId > 0) {
        // update default profile
        const params: any[] = [];
        const sets: string[] = [];
        if (mail_host !== undefined) { params.push(mail_host); sets.push(`host = $${params.length}`); }
        if (mail_port !== undefined) { params.push(mail_port); sets.push(`port = $${params.length}`); }
        if (mail_user !== undefined) { params.push(mail_user); sets.push(`"user" = $${params.length}`); }
        if (mail_from !== undefined) { params.push(mail_from); sets.push(`"from" = $${params.length}`); }
        if (mail_secure !== undefined) { params.push(mail_secure); sets.push(`secure = $${params.length}`); }
        if (mail_pass !== undefined && mail_pass !== "") { params.push(mail_pass); sets.push(`pass = $${params.length}`); }
        if (sets.length) {
          params.push(defaultId);
          await pgQuery<any>(`UPDATE "MailSettingsProfiles" SET ${sets.join(", ")}, "updatedAt" = now() WHERE id = $${params.length}`, params);
        }
      } else {
        // create default profile
        await pgQuery<any>(
          `
          INSERT INTO "MailSettingsProfiles"
            ("companyId", name, host, port, "user", "from", secure, pass, "isDefault", "createdAt", "updatedAt")
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, true, now(), now())
        `,
          [tenantId, name, mail_host ?? null, mail_port ?? null, mail_user ?? null, mail_from ?? null, mail_secure ?? null, mail_pass ?? ""]
        );
      }

      const def = await pgQuery<any>(
        `SELECT * FROM "MailSettingsProfiles" WHERE "companyId" = $1 AND COALESCE("isDefault", false) = true ORDER BY "updatedAt" DESC LIMIT 1`,
        [tenantId]
      );
      await syncDefaultProfileToLegacy(tenantId, def?.[0]);
    } catch {
      await saveCompanyMailSettings(tenantId, { mail_host, mail_port, mail_user, mail_pass, mail_from, mail_secure });
    }

    const settings = await getCompanyMailSettings(tenantId);
    return res.json({
      ok: true,
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
      .json({ error: true, message: e?.message || "update email settings error" });
  }
});

router.delete("/email", async (req, res) => {
  try {
    setNoCache(res);
    const auth = req.headers.authorization as string;
    const adminCheck = await ensureAdminFromAuth(auth);
    if (!adminCheck.ok) {
      const err = adminCheck as any;
      return res.status(Number(err.status || 403)).json({ error: true, message: String(err.message || "forbidden") });
    }
    const tenantId = (adminCheck as any).tenantId as number;

    const keys = ["mail_host", "mail_port", "mail_user", "mail_from", "mail_secure", "mail_pass"];
    for (const k of keys) {
      try {
        await deleteSettingKey(tenantId, k);
      } catch {}
    }

    return res.json({
      ok: true,
      mail_host: null,
      mail_port: null,
      mail_user: null,
      mail_from: null,
      mail_secure: null,
      has_password: false
    });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "delete email settings error" });
  }
});

// Multi-profile SMTP endpoints
router.get("/email/profiles", async (req, res) => {
  try {
    setNoCache(res);
    const auth = req.headers.authorization as string;
    const tenantId = extractTenantIdFromAuth(auth) || 1;
    await ensureMailProfilesSchema();

    // Seed first profile from legacy settings if table is empty (best-effort)
    const cnt = await pgQuery<any>(`SELECT COUNT(*)::int as c FROM "MailSettingsProfiles" WHERE "companyId" = $1`, [tenantId]);
    const c = Number(cnt?.[0]?.c || 0);
    if (!c) {
      const legacy = await getCompanyMailSettings(tenantId);
      if (legacy?.mail_host || legacy?.mail_user || legacy?.mail_from) {
        let pass = "";
        try {
          // we don't have getCompanyMailPassword here; legacy.hasPassword indicates it exists
          pass = "";
        } catch {}
        await pgQuery<any>(
          `
          INSERT INTO "MailSettingsProfiles"
            ("companyId", name, host, port, "user", "from", secure, pass, "isDefault", "createdAt", "updatedAt")
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, true, now(), now())
        `,
          [
            tenantId,
            String(legacy.mail_user || "SMTP Padrão"),
            legacy.mail_host ?? null,
            legacy.mail_port ?? null,
            legacy.mail_user ?? null,
            legacy.mail_from ?? null,
            legacy.mail_secure ?? null,
            pass
          ]
        );
      }
    }

    const rows = await pgQuery<any>(
      `
      SELECT
        id,
        "companyId",
        COALESCE(name, '') as name,
        host,
        port,
        "user",
        "from",
        secure,
        COALESCE("isDefault", false) as "isDefault",
        (CASE WHEN COALESCE(pass,'') <> '' THEN true ELSE false END) as "has_password",
        "updatedAt"
      FROM "MailSettingsProfiles"
      WHERE "companyId" = $1
      ORDER BY COALESCE("isDefault", false) DESC, "updatedAt" DESC, id DESC
    `,
      [tenantId]
    );
    return res.json({ ok: true, profiles: rows || [] });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "get email profiles error" });
  }
});

router.post("/email/profiles", async (req, res) => {
  try {
    setNoCache(res);
    const auth = req.headers.authorization as string;
    const adminCheck = await ensureAdminFromAuth(auth);
    if (!adminCheck.ok) {
      const err = adminCheck as any;
      return res.status(Number(err.status || 403)).json({ error: true, message: String(err.message || "forbidden") });
    }
    const tenantId = (adminCheck as any).tenantId as number;
    await ensureMailProfilesSchema();

    const body: any = req.body || {};
    const name = String(body?.name || body?.mail_user || "SMTP").trim() || "SMTP";
    const host = body?.mail_host ?? null;
    const port = body?.mail_port ?? null;
    const user = body?.mail_user ?? null;
    const from = body?.mail_from ?? null;
    const secure = body?.mail_secure ?? null;
    const pass = body?.mail_pass ?? "";
    const makeDefault = Boolean(body?.isDefault);

    if (makeDefault) {
      await pgQuery(`UPDATE "MailSettingsProfiles" SET "isDefault" = false WHERE "companyId" = $1`, [tenantId]);
    }

    const inserted = await pgQuery<any>(
      `
      INSERT INTO "MailSettingsProfiles"
        ("companyId", name, host, port, "user", "from", secure, pass, "isDefault", "createdAt", "updatedAt")
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
      RETURNING id
    `,
      [tenantId, name, host, port, user, from, secure, pass, makeDefault]
    );
    const id = Number(inserted?.[0]?.id || 0);

    if (makeDefault && id) {
      const p = await pgQuery<any>(`SELECT * FROM "MailSettingsProfiles" WHERE id = $1 LIMIT 1`, [id]);
      await syncDefaultProfileToLegacy(tenantId, p?.[0]);
    }

    return res.json({ ok: true, id });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "create email profile error" });
  }
});

router.put("/email/profiles/:id", async (req, res) => {
  try {
    setNoCache(res);
    const auth = req.headers.authorization as string;
    const adminCheck = await ensureAdminFromAuth(auth);
    if (!adminCheck.ok) {
      const err = adminCheck as any;
      return res.status(Number(err.status || 403)).json({ error: true, message: String(err.message || "forbidden") });
    }
    const tenantId = (adminCheck as any).tenantId as number;
    await ensureMailProfilesSchema();

    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: true, message: "invalid id" });

    const body: any = req.body || {};
    const sets: string[] = [];
    const params: any[] = [];
    if (body.name !== undefined) { params.push(String(body.name || "")); sets.push(`name = $${params.length}`); }
    if (body.mail_host !== undefined) { params.push(body.mail_host); sets.push(`host = $${params.length}`); }
    if (body.mail_port !== undefined) { params.push(body.mail_port); sets.push(`port = $${params.length}`); }
    if (body.mail_user !== undefined) { params.push(body.mail_user); sets.push(`"user" = $${params.length}`); }
    if (body.mail_from !== undefined) { params.push(body.mail_from); sets.push(`"from" = $${params.length}`); }
    if (body.mail_secure !== undefined) { params.push(body.mail_secure); sets.push(`secure = $${params.length}`); }
    if (body.mail_pass !== undefined && body.mail_pass !== "") { params.push(body.mail_pass); sets.push(`pass = $${params.length}`); }
    if (body.isDefault !== undefined) {
      const makeDefault = Boolean(body.isDefault);
      if (makeDefault) {
        await pgQuery(`UPDATE "MailSettingsProfiles" SET "isDefault" = false WHERE "companyId" = $1`, [tenantId]);
      }
      params.push(makeDefault);
      sets.push(`"isDefault" = $${params.length}`);
    }
    if (!sets.length) return res.json({ ok: true });

    params.push(id);
    params.push(tenantId);
    await pgQuery<any>(
      `UPDATE "MailSettingsProfiles" SET ${sets.join(", ")}, "updatedAt" = now() WHERE id = $${params.length - 1} AND "companyId" = $${params.length}`,
      params
    );

    // If this profile is default, sync to legacy keys
    const p = await pgQuery<any>(`SELECT * FROM "MailSettingsProfiles" WHERE id = $1 AND "companyId" = $2 LIMIT 1`, [id, tenantId]);
    const prof = p?.[0];
    if (prof && Boolean(prof.isDefault)) {
      await syncDefaultProfileToLegacy(tenantId, prof);
    }

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "update email profile error" });
  }
});

router.post("/email/profiles/:id/default", async (req, res) => {
  try {
    setNoCache(res);
    const auth = req.headers.authorization as string;
    const adminCheck = await ensureAdminFromAuth(auth);
    if (!adminCheck.ok) {
      const err = adminCheck as any;
      return res.status(Number(err.status || 403)).json({ error: true, message: String(err.message || "forbidden") });
    }
    const tenantId = (adminCheck as any).tenantId as number;
    await ensureMailProfilesSchema();

    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: true, message: "invalid id" });
    await pgQuery(`UPDATE "MailSettingsProfiles" SET "isDefault" = false WHERE "companyId" = $1`, [tenantId]);
    await pgQuery(`UPDATE "MailSettingsProfiles" SET "isDefault" = true, "updatedAt" = now() WHERE id = $1 AND "companyId" = $2`, [id, tenantId]);
    const p = await pgQuery<any>(`SELECT * FROM "MailSettingsProfiles" WHERE id = $1 AND "companyId" = $2 LIMIT 1`, [id, tenantId]);
    await syncDefaultProfileToLegacy(tenantId, p?.[0]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "set default email profile error" });
  }
});

router.delete("/email/profiles/:id", async (req, res) => {
  try {
    setNoCache(res);
    const auth = req.headers.authorization as string;
    const adminCheck = await ensureAdminFromAuth(auth);
    if (!adminCheck.ok) {
      const err = adminCheck as any;
      return res.status(Number(err.status || 403)).json({ error: true, message: String(err.message || "forbidden") });
    }
    const tenantId = (adminCheck as any).tenantId as number;
    await ensureMailProfilesSchema();

    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: true, message: "invalid id" });

    const was = await pgQuery<any>(`SELECT COALESCE("isDefault", false) as "isDefault" FROM "MailSettingsProfiles" WHERE id = $1 AND "companyId" = $2 LIMIT 1`, [id, tenantId]);
    const wasDefault = Boolean(was?.[0]?.isDefault);
    await pgQuery(`DELETE FROM "MailSettingsProfiles" WHERE id = $1 AND "companyId" = $2`, [id, tenantId]);

    // If deleted default, pick newest as new default and sync legacy; otherwise leave legacy as-is.
    if (wasDefault) {
      const next = await pgQuery<any>(
        `SELECT * FROM "MailSettingsProfiles" WHERE "companyId" = $1 ORDER BY "updatedAt" DESC, id DESC LIMIT 1`,
        [tenantId]
      );
      if (next?.[0]) {
        await pgQuery(`UPDATE "MailSettingsProfiles" SET "isDefault" = false WHERE "companyId" = $1`, [tenantId]);
        await pgQuery(`UPDATE "MailSettingsProfiles" SET "isDefault" = true, "updatedAt" = now() WHERE id = $1`, [next[0].id]);
        await syncDefaultProfileToLegacy(tenantId, next[0]);
      } else {
        // no profiles left -> clear legacy keys
        const keys = ["mail_host", "mail_port", "mail_user", "mail_from", "mail_secure", "mail_pass"];
        for (const k of keys) {
          try { await deleteSettingKey(tenantId, k); } catch {}
        }
      }
    }

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "delete email profile error" });
  }
});

// IMPORTANT: keep this generic setter AFTER the specific routes (like /email),
// otherwise Express will match /:key first and shadow them.
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

export default router;


