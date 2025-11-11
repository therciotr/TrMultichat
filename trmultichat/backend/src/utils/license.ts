import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { getLegacyModel } from "./legacyModel";

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

async function loadCompanyLicenseToken(companyId: number): Promise<string | undefined> {
  // Try Setting model key=licenseToken
  try {
    const Setting = getLegacyModel("Setting");
    if (Setting && typeof Setting.findOne === "function") {
      const row = await Setting.findOne({ where: { companyId, key: "licenseToken" } });
      if (row) {
        const plain = row?.toJSON ? row.toJSON() : row;
        if (plain?.value) return String(plain.value);
      }
    }
  } catch {}
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

export async function validateLicenseForCompany(companyId: number): Promise<{ ok: boolean; payload?: any; error?: string }> {
  const isProd = (process.env.NODE_ENV || "development") === "production";
  const required = String(process.env.LICENSE_REQUIRED || (isProd ? "true" : "false")).toLowerCase() === "true";
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


