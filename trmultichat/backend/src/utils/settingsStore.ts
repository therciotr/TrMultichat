import { pgQuery } from "./pgClient";
import { getLegacyModel } from "./legacyModel";

async function getValueFromPg(companyId: number, key: string): Promise<string | undefined | null> {
  try {
    const rows = await pgQuery<{ value: string }>(
      'SELECT value FROM "Settings" WHERE "companyId" = $1 AND "key" = $2 LIMIT 1',
      [companyId, key]
    );
    const row = Array.isArray(rows) && rows[0];
    if (!row) return undefined;
    return row.value !== undefined && row.value !== null ? String(row.value) : undefined;
  } catch {
    // fallback lower-case installs
    try {
      const rows2 = await pgQuery<{ value: string }>(
        'SELECT value FROM settings WHERE "companyId" = $1 AND key = $2 LIMIT 1',
        [companyId, key]
      );
      const row2 = Array.isArray(rows2) && rows2[0];
      if (!row2) return undefined;
      return row2.value !== undefined && row2.value !== null ? String(row2.value) : undefined;
    } catch {
      return null;
    }
  }
}

export async function getSettingValue(companyId: number, key: string): Promise<string | undefined> {
  if (!companyId || !key) return undefined;

  const pg = await getValueFromPg(companyId, key);
  if (pg !== null) return pg;

  // legacy fallback
  try {
    const Setting = getLegacyModel("Setting");
    if (Setting && typeof Setting.findOne === "function") {
      const row = await Setting.findOne({ where: { companyId, key } });
      if (row) {
        const plain = row?.toJSON ? row.toJSON() : row;
        if (plain?.value !== undefined && plain?.value !== null) return String(plain.value);
      }
    }
  } catch {}
  return undefined;
}

export async function setSettingValue(companyId: number, key: string, value: string): Promise<boolean> {
  if (!companyId || !key) return false;
  const val = value !== undefined && value !== null ? String(value) : "";

  // Postgres preferencial
  try {
    const updated = await pgQuery<{ id: number }>(
      'UPDATE "Settings" SET value = $1, "updatedAt" = now() WHERE "companyId" = $2 AND "key" = $3 RETURNING id',
      [val, companyId, key]
    );
    const okUpdate = Array.isArray(updated) && updated.length > 0;
    if (okUpdate) return true;

    await pgQuery(
      'INSERT INTO "Settings" ("key","value","companyId","createdAt","updatedAt") VALUES ($1,$2,$3,now(),now())',
      [key, val, companyId]
    );
    return true;
  } catch {
    // lower-case fallback
    try {
      const updated2 = await pgQuery<{ id: number }>(
        'UPDATE settings SET value = $1, "updatedAt" = now() WHERE "companyId" = $2 AND key = $3 RETURNING id',
        [val, companyId, key]
      );
      const okUpdate2 = Array.isArray(updated2) && updated2.length > 0;
      if (okUpdate2) return true;
      await pgQuery(
        'INSERT INTO settings (key,value,"companyId","createdAt","updatedAt") VALUES ($1,$2,$3,now(),now())',
        [key, val, companyId]
      );
      return true;
    } catch {
      // legacy fallback below
    }
  }

  // legacy fallback
  try {
    const Setting = getLegacyModel("Setting");
    if (!Setting || typeof Setting.findOne !== "function") return false;
    let row = await Setting.findOne({ where: { companyId, key } });
    if (row && typeof row.update === "function") {
      await row.update({ value: val });
      return true;
    }
    if (typeof Setting.create === "function") {
      await Setting.create({ companyId, key, value: val });
      return true;
    }
  } catch {}
  return false;
}

export async function deleteSettingKey(companyId: number, key: string): Promise<boolean> {
  if (!companyId || !key) return false;
  // Prefer: delete row
  try {
    await pgQuery('DELETE FROM "Settings" WHERE "companyId" = $1 AND "key" = $2', [companyId, key]);
    return true;
  } catch {
    try {
      await pgQuery('DELETE FROM settings WHERE "companyId" = $1 AND key = $2', [companyId, key]);
      return true;
    } catch {
      // fallback: set empty
      return await setSettingValue(companyId, key, "");
    }
  }
}


