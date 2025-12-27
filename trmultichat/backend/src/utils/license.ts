import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { generateKeyPairSync } from "crypto";
import { pgQuery } from "./pgClient";
import { getSettingValue, setSettingValue } from "./settingsStore";

function ensureLocalRsaKeypair(): boolean {
  try {
    const privatePath = path.resolve(process.cwd(), "private.pem");
    const publicPath = path.resolve(process.cwd(), "certs", "public.pem");
    if (fs.existsSync(privatePath) && fs.existsSync(publicPath)) return true;
    fs.mkdirSync(path.dirname(publicPath), { recursive: true });
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs1", format: "pem" }
    });
    // Nunca commitar esses arquivos; são gerados no servidor.
    fs.writeFileSync(privatePath, privateKey, { encoding: "utf8", mode: 0o600 });
    fs.writeFileSync(publicPath, publicKey, { encoding: "utf8", mode: 0o644 });
    return true;
  } catch {
    return false;
  }
}

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
  // Fallback: chave local no servidor
  try {
    const local = path.resolve(process.cwd(), "certs", "public.pem");
    if (fs.existsSync(local)) return fs.readFileSync(local, "utf8");
  } catch {}
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
  // Fallback: chave local no servidor (gera se não existir)
  try {
    const local = path.resolve(process.cwd(), "private.pem");
    if (!fs.existsSync(local)) {
      ensureLocalRsaKeypair();
    }
    if (fs.existsSync(local)) return fs.readFileSync(local, "utf8");
  } catch {}
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

async function isCompanyAccessDisabled(companyId: number): Promise<boolean> {
  try {
    const v = await getSettingValue(companyId, "accessDisabled");
    const s = String(v || "").trim().toLowerCase();
    return s === "1" || s === "true" || s === "enabled" || s === "yes";
  } catch {
    return false;
  }
}

function toDateOnly(v: any): string | null {
  if (!v) return null;
  try {
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      return v.toISOString().slice(0, 10);
    }
    const s = String(v);
    // Se já está no formato ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // Tenta parse
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {}
  return null;
}

async function isCompanyPaidByDueDate(companyId: number): Promise<{ paid: boolean; dueDate?: string | null }> {
  try {
    const rows = await pgQuery<{ dueDate?: string | null }>(
      'SELECT "dueDate" FROM "Companies" WHERE id = $1 LIMIT 1',
      [companyId]
    );
    const row = Array.isArray(rows) && rows[0];
    const dueRaw = row ? (row as any).dueDate : null;
    const due = toDateOnly(dueRaw);
    if (!due) return { paid: false, dueDate: null };
    const d = new Date(`${due}T23:59:59Z`);
    if (Number.isNaN(d.getTime())) return { paid: false, dueDate: due };
    if (d.getTime() >= Date.now()) return { paid: true, dueDate: due };

    // Fallback: se o dueDate estiver vencido mas existir fatura paga recente, sincroniza.
    try {
      const invRows = await pgQuery<{ updatedAt: Date | string; paidAt?: Date | string | null }>(
        'SELECT "updatedAt", "paidAt" FROM "Invoices" WHERE "companyId" = $1 AND lower(status) = \'paid\' ORDER BY COALESCE("paidAt","updatedAt") DESC, "updatedAt" DESC LIMIT 1',
        [companyId]
      );
      const inv = Array.isArray(invRows) && invRows[0];
      if (inv) {
        const baseRaw = (inv as any).paidAt || (inv as any).updatedAt;
        const base = baseRaw instanceof Date ? baseRaw : new Date(String(baseRaw));
        if (!Number.isNaN(base.getTime())) {
          const paidUntil = new Date(base.getTime());
          paidUntil.setDate(paidUntil.getDate() + 30);
          if (paidUntil.getTime() >= Date.now()) {
            const nextDue = paidUntil.toISOString().slice(0, 10);
            // tentar corrigir Companies.dueDate para refletir pagamento
            try {
              await pgQuery('UPDATE "Companies" SET "dueDate" = $1, "updatedAt" = now() WHERE id = $2', [nextDue, companyId]);
            } catch {}
            return { paid: true, dueDate: nextDue };
          }
        }
      }
    } catch {}

    return { paid: false, dueDate: due };
  } catch {
    return { paid: false, dueDate: null };
  }
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

  // Bloqueio manual de acesso (admin)
  if (await isCompanyAccessDisabled(companyId)) {
    return { ok: false, error: "ACCESS_DISABLED" };
  }

  // Se a empresa está paga (dueDate futuro), libera acesso mesmo sem token.
  // Isso garante sincronia com pagamento quando chave privada/token não estiverem disponíveis.
  const paidInfo = await isCompanyPaidByDueDate(companyId);
  if (paidInfo.paid) {
    return {
      ok: true,
      payload: {
        sub: `company:${companyId}`,
        aud: process.env.LICENSE_AUD || "trmultichat",
        iss: process.env.LICENSE_ISS || "TR MULTICHAT",
        data: { companyId, plan: "PAID", maxUsers: 0, dueDate: paidInfo.dueDate || undefined }
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

  // Bloqueio manual
  if (await isCompanyAccessDisabled(companyId)) {
    return { has: true, valid: false, error: "ACCESS_DISABLED" };
  }

  // Válido por pagamento (dueDate)
  const paidInfo = await isCompanyPaidByDueDate(companyId);
  if (paidInfo.paid) {
    return {
      has: true,
      valid: true,
      payload: {
        sub: `company:${companyId}`,
        aud: process.env.LICENSE_AUD || "trmultichat",
        iss: process.env.LICENSE_ISS || "TR MULTICHAT",
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        data: { companyId, plan: "PAID", maxUsers: 0, dueDate: paidInfo.dueDate || undefined }
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

export async function setCompanyAccessDisabled(companyId: number, disabled: boolean): Promise<boolean> {
  return await setSettingValue(companyId, "accessDisabled", disabled ? "true" : "false");
}
