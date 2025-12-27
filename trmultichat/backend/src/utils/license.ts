import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { pgQuery } from "./pgClient";
import { getSettingValue, setSettingValue } from "./settingsStore";

function loadPublicKey(): string | undefined {
  const inlinePem = process.env.LICENSE_PUBLIC_KEY;
  if (inlinePem && inlinePem.includes("BEGIN PUBLIC KEY")) return inlinePem;
  const b64 = process.env.LICENSE_PUBLIC_KEY_BASE64;
  if (b64) {
    try {
      return Buffer.from(b64, "base64").toString("utf8");
    } catch {}
  }
  const p = process.env.LICENSE_PUBLIC_KEY_PATH;
  if (p) {
    try {
      return fs.readFileSync(path.resolve(p), "utf8");
    } catch {}
  }
  return undefined;
}

function loadPrivateKey(): string | undefined {
  const inlinePem = process.env.LICENSE_PRIVATE_KEY;
  if (inlinePem && inlinePem.includes("BEGIN")) return inlinePem;
  const b64 = process.env.LICENSE_PRIVATE_KEY_BASE64;
  if (b64) {
    try {
      return Buffer.from(b64, "base64").toString("utf8");
    } catch {}
  }
  const p = process.env.LICENSE_PRIVATE_KEY_PATH;
  if (p) {
    try {
      return fs.readFileSync(path.resolve(p), "utf8");
    } catch {}
  }
  return undefined;
}

async function loadCompanyLicenseToken(
  companyId: number
): Promise<string | undefined> {
  // Primeiro tenta Settings por companyId (robusto em produção)
  const byCompany = await getSettingValue(companyId, "licenseToken");
  if (byCompany) return byCompany;
  // Fallback to global
  if (process.env.LICENSE_TOKEN) return process.env.LICENSE_TOKEN.trim();
  const licenseFile = process.env.LICENSE_FILE || "/run/secrets/license.json";
  try {
    if (fs.existsSync(licenseFile)) {
      const raw = fs.readFileSync(licenseFile, "utf8");
      const obj = JSON.parse(raw);
      if (obj && typeof obj.token === "string") return obj.token;
    }
  } catch {}
  const fallback = path.resolve(process.cwd(), "license.json");
  try {
    if (fs.existsSync(fallback)) {
      const raw = fs.readFileSync(fallback, "utf8");
      const obj = JSON.parse(raw);
      if (obj && typeof obj.token === "string") return obj.token;
    }
  } catch {}
  return undefined;
}

export async function validateLicenseForCompany(
  companyId: number
): Promise<{ ok: boolean; payload?: any; error?: string }> {
  const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
  if (companyId === masterCompanyId) {
    return {
      ok: true,
      payload: {
        sub: `company:${companyId}`,
        aud: process.env.LICENSE_AUD || "trmultichat",
        iss: process.env.LICENSE_ISS || "TR MULTICHAT",
        data: { companyId, plan: "MASTER", maxUsers: 999999 }
      }
    };
  }
  const isProd = (process.env.NODE_ENV || "development") === "production";
  const required =
    String(
      process.env.LICENSE_REQUIRED || (isProd ? "true" : "false")
    ).toLowerCase() === "true";
  if (!required) return { ok: true };
  const pub = loadPublicKey();
  const token = await loadCompanyLicenseToken(companyId);
  if (!pub || !token) return { ok: false, error: "LICENSE_MISSING" };
  try {
    const payload = jwt.verify(token, pub, {
      algorithms: ["RS256"],
      audience: process.env.LICENSE_AUD || "trmultichat",
      issuer: process.env.LICENSE_ISS || "TR MULTICHAT"
    });
    return { ok: true, payload };
  } catch (e: any) {
    return { ok: false, error: e?.message || "LICENSE_INVALID" };
  }
}

// Strict versions: NÃO usam fallback global; úteis para exibir status por empresa
export async function loadCompanyLicenseTokenOnlySetting(
  companyId: number
): Promise<string | undefined> {
  return await getSettingValue(companyId, "licenseToken");
}

export async function validateLicenseForCompanyStrict(
  companyId: number
): Promise<{ has: boolean; valid: boolean; payload?: any; error?: string }> {
  const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
  if (companyId === masterCompanyId) {
    return {
      has: true,
      valid: true,
      payload: {
        sub: `company:${companyId}`,
        aud: process.env.LICENSE_AUD || "trmultichat",
        iss: process.env.LICENSE_ISS || "TR MULTICHAT",
        exp: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60,
        data: { companyId, plan: "MASTER", maxUsers: 999999 }
      }
    };
  }
  const pub = loadPublicKey();
  const token = await loadCompanyLicenseTokenOnlySetting(companyId);
  if (!token) return { has: false, valid: false, error: "LICENSE_MISSING" };
  if (!pub) return { has: true, valid: false, error: "PUBLIC_KEY_MISSING" };
  try {
    const payload = jwt.verify(token, pub, {
      algorithms: ["RS256"],
      audience: process.env.LICENSE_AUD || "trmultichat",
      issuer: process.env.LICENSE_ISS || "TR MULTICHAT"
    });
    return { has: true, valid: true, payload };
  } catch (e: any) {
    return { has: true, valid: false, error: e?.message || "LICENSE_INVALID" };
  }
}

export function generateLicenseToken(input: {
  subject: string;
  companyId: number;
  plan?: string;
  maxUsers?: number;
  expiresInSeconds: number;
  extra?: Record<string, unknown>;
}): { ok: true; token: string } | { ok: false; error: string } {
  const priv = loadPrivateKey();
  if (!priv) return { ok: false, error: "PRIVATE_KEY_NOT_AVAILABLE" };
  const iss = process.env.LICENSE_ISS || "TR MULTICHAT";
  const aud = process.env.LICENSE_AUD || "trmultichat";
  const now = Math.floor(Date.now() / 1000);
  const payload: any = {
    sub: input.subject || `company:${input.companyId}`,
    aud,
    iss,
    iat: now,
    nbf: now,
    data: {
      companyId: input.companyId,
      plan: input.plan || "",
      maxUsers: input.maxUsers || 0,
      ...(input.extra || {})
    }
  };
  const token = jwt.sign(payload, priv, {
    algorithm: "RS256",
    expiresIn: input.expiresInSeconds
  });
  return { ok: true, token };
}

export async function renewCompanyLicenseFromDueDate(companyId: number, dueDate?: string | null): Promise<{ ok: boolean; reason?: string }> {
  const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
  if (companyId === masterCompanyId) return { ok: true, reason: "master-exempt" };

  const priv = loadPrivateKey();
  if (!priv) return { ok: false, reason: "PRIVATE_KEY_NOT_AVAILABLE" };

  // calcular expiração baseada no dueDate (YYYY-MM-DD). fallback: 30 dias.
  let expiresInSeconds = 30 * 24 * 60 * 60;
  try {
    if (dueDate) {
      const d = new Date(String(dueDate).slice(0, 10) + "T23:59:59Z");
      const now = Date.now();
      if (!Number.isNaN(d.getTime())) {
        const diff = Math.floor((d.getTime() - now) / 1000);
        expiresInSeconds = Math.max(60, Math.min(diff, 365 * 24 * 60 * 60));
      }
    }
  } catch {}

  // plano e maxUsers a partir do plano atual
  let planName = "";
  let maxUsers = 0;
  try {
    const compRows = await pgQuery<{ planId?: number }>('SELECT "planId" FROM "Companies" WHERE id = $1 LIMIT 1', [companyId]);
    const comp = Array.isArray(compRows) && compRows[0];
    const planId = comp ? Number((comp as any).planId || 0) : 0;
    if (planId) {
      const planRows = await pgQuery<{ name?: string; users?: number }>('SELECT name, users FROM "Plans" WHERE id = $1 LIMIT 1', [planId]);
      const plan = Array.isArray(planRows) && planRows[0];
      if (plan) {
        planName = String((plan as any).name || "");
        maxUsers = Number((plan as any).users || 0);
      }
    }
  } catch {}

  const gen = generateLicenseToken({
    subject: `company:${companyId}`,
    companyId,
    plan: planName,
    maxUsers,
    expiresInSeconds
  });
  if (!gen.ok) return { ok: false, reason: (gen as any).error || "generate-failed" };

  const saved = await setSettingValue(companyId, "licenseToken", (gen as any).token);
  return saved ? { ok: true } : { ok: false, reason: "save-failed" };
}
