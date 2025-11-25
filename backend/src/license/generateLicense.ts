/*
  Usage:
    npm run build && node dist/license/generateLicense.js \
      --privateKeyPath ./private.pem \
      --company "TR TECNOLOGIAS" \
      --aud trmultichat \
      --iss "TR MULTICHAT" \
      --plan pro \
      --maxUsers 50 \
      --expires 2026-12-31 \
      --out license.json
*/

import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

function getArg(name: string, fallback?: string): string | undefined {
  const ix = process.argv.indexOf(`--${name}`);
  if (ix >= 0 && ix + 1 < process.argv.length) return process.argv[ix + 1];
  return fallback;
}

function parseExpiry(input?: string): number | undefined {
  if (!input) return undefined;
  const dt = new Date(input);
  if (isNaN(dt.getTime())) throw new Error(`Invalid --expires date: ${input}`);
  return Math.floor(dt.getTime() / 1000);
}

function main() {
  const privateKeyPath = getArg("privateKeyPath");
  if (!privateKeyPath) throw new Error("--privateKeyPath is required (PEM RSA private key)");
  const privateKey = fs.readFileSync(path.resolve(privateKeyPath), "utf8");

  const company = getArg("company", "Unknown");
  const aud = getArg("aud", "trmultichat");
  const iss = getArg("iss", "TR MULTICHAT");
  const plan = getArg("plan", "pro");
  const maxUsers = getArg("maxUsers", "50");
  const expires = parseExpiry(getArg("expires"));
  const out = getArg("out", "license.json");

  const now = Math.floor(Date.now() / 1000);
  const payload: any = {
    sub: company,
    aud,
    iss,
    iat: now,
    data: {
      plan,
      maxUsers: Number(maxUsers)
    }
  };
  if (expires) payload.exp = expires;

  const token = jwt.sign(payload, privateKey, { algorithm: "RS256" });

  const license = { token };
  fs.writeFileSync(path.resolve(out), JSON.stringify(license, null, 2));
  // eslint-disable-next-line no-console
  console.log(`License generated → ${out}`);
}

try {
  main();
} catch (e: any) {
  // eslint-disable-next-line no-console
  console.error(e?.message || e);
  process.exit(1);
}


