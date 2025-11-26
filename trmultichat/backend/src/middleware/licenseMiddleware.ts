import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

function loadPublicKey(): string | undefined {
  const inlinePem = process.env.LICENSE_PUBLIC_KEY;
  if (inlinePem && inlinePem.includes("BEGIN PUBLIC KEY")) return inlinePem;

  const b64 = process.env.LICENSE_PUBLIC_KEY_BASE64;
  if (b64) {
    try {
      return Buffer.from(b64, "base64").toString("utf8");
    } catch (_) {}
  }

  const p = process.env.LICENSE_PUBLIC_KEY_PATH;
  if (p) {
    try {
      return fs.readFileSync(path.resolve(p), "utf8");
    } catch (_) {}
  }
  return undefined;
}

function loadLicenseToken(): string | undefined {
  const envToken = process.env.LICENSE_TOKEN;
  if (envToken) return envToken.trim();

  const licenseFile = process.env.LICENSE_FILE || "/run/secrets/license.json";
  try {
    if (fs.existsSync(licenseFile)) {
      const raw = fs.readFileSync(licenseFile, "utf8");
      const obj = JSON.parse(raw);
      if (obj && typeof obj.token === "string") return obj.token;
    }
  } catch (_) {}

  const fallback = path.resolve(process.cwd(), "license.json");
  try {
    if (fs.existsSync(fallback)) {
      const raw = fs.readFileSync(fallback, "utf8");
      const obj = JSON.parse(raw);
      if (obj && typeof obj.token === "string") return obj.token;
    }
  } catch (_) {}
  return undefined;
}

export function licenseMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const isProd = (process.env.NODE_ENV || "development") === "production";
  const devMode =
    String(process.env.DEV_MODE || "false").toLowerCase() === "true";
  const required =
    String(
      process.env.LICENSE_REQUIRED || (isProd ? "true" : "false")
    ).toLowerCase() === "true";

  if (!isProd && devMode) {
    return next();
  }

  if (!required) {
    return next();
  }

  const pub = loadPublicKey();
  const token = loadLicenseToken();
  if (!pub || !token) {
    return res
      .status(401)
      .json({ error: "LICENSE_MISSING", message: "License not configured" });
  }

  try {
    const payload = jwt.verify(token, pub, {
      algorithms: ["RS256"],
      audience: process.env.LICENSE_AUD || "trmultichat",
      issuer: process.env.LICENSE_ISS || "TR MULTICHAT"
    }) as Record<string, unknown>;

    // Optional extra checks (e.g., domain/tenant limits) can be added here.
    (req as any).license = payload;
    return next();
  } catch (e: any) {
    return res.status(401).json({
      error: "LICENSE_INVALID",
      message: e?.message || "invalid license"
    });
  }
}
