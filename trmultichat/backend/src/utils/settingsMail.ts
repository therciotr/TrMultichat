import { getLegacyModel } from "./legacyModel";
import { getSettingValue, setSettingValue } from "./settingsStore";

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

export async function getCompanyMailPassword(companyId: number): Promise<string | undefined> {
  // Prefer Postgres store (robust), fall back to legacy
  try {
    const v = await getSettingValue(companyId, "mail_pass");
    return v ? String(v) : undefined;
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
  // Prefer Postgres settingsStore (most reliable in production), then legacy as fallback.
  try {
    const mail_host = (await getSettingValue(companyId, "mail_host")) || null;
    const mail_port_raw = await getSettingValue(companyId, "mail_port");
    const mail_port = mail_port_raw ? Number(mail_port_raw) : null;
    const mail_user = (await getSettingValue(companyId, "mail_user")) || null;
    const mail_from = (await getSettingValue(companyId, "mail_from")) || null;
    const mail_secure_raw = await getSettingValue(companyId, "mail_secure");
    const mail_secure =
      mail_secure_raw !== undefined
        ? String(mail_secure_raw).toLowerCase() === "true"
        : null;
    const pass = await getSettingValue(companyId, "mail_pass");
    const hasPassword = Boolean(pass);

    // If at least one key exists, we treat it as configured from PG.
    if (
      mail_host !== null ||
      mail_port !== null ||
      mail_user !== null ||
      mail_from !== null ||
      mail_secure !== null ||
      hasPassword
    ) {
      return {
        mail_host,
        mail_port: Number.isNaN(mail_port as any) ? null : mail_port,
        mail_user,
        mail_from,
        mail_secure,
        hasPassword
      };
    }
  } catch {}

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
  // Prefer Postgres settingsStore (robust in production)
  try {
    if (dto.mail_host !== undefined) await setSettingValue(companyId, "mail_host", dto.mail_host || "");
    if (dto.mail_port !== undefined)
      await setSettingValue(companyId, "mail_port", dto.mail_port != null ? String(dto.mail_port) : "");
    if (dto.mail_user !== undefined) await setSettingValue(companyId, "mail_user", dto.mail_user || "");
    if (dto.mail_from !== undefined) await setSettingValue(companyId, "mail_from", dto.mail_from || "");
    if (dto.mail_secure !== undefined) await setSettingValue(companyId, "mail_secure", dto.mail_secure ? "true" : "false");
    if (dto.mail_pass !== undefined && dto.mail_pass !== "") {
      await setSettingValue(companyId, "mail_pass", dto.mail_pass);
    }
    return;
  } catch {
    // fall through to legacy below
  }

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
