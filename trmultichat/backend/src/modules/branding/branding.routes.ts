import { Router, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { authMiddleware } from "../../middleware/authMiddleware";
import { findByPkSafe } from "../../utils/legacyModel";
import { pgQuery } from "../../utils/pgClient";
import jwt from "jsonwebtoken";
import env from "../../config/env";

type Branding = {
  // Identity
  appTitle?: string;
  faviconUrl?: string;
  logoUrl?: string;

  // Theme
  primaryColor: string;
  secondaryColor: string;
  headingColor?: string;
  buttonColor: string;
  textColor: string;
  backgroundType: "color" | "image";
  backgroundColor?: string;
  backgroundImage?: string;
  fontFamily?: string;
  borderRadius?: number;
  sidebarVariant?: "solid" | "gradient";
  loginBackgroundType?: "color" | "image";
  menuIconColor?: string;
  menuIconActiveColor?: string;
};

const router = Router();

const PUBLIC_DIR = path.join(process.cwd(), "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const BRANDING_FILE = path.join(PUBLIC_DIR, "branding.json");

function ensureDirs() {
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR);
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
}

function defaultBranding(): Branding {
  return {
    appTitle: "TR Multichat",
    faviconUrl: "/favicon.ico",
    primaryColor: "#0B4C46",
    secondaryColor: "#2BA9A5",
    headingColor: "#0B4C46",
    buttonColor: "#2BA9A5",
    textColor: "#1F2937",
    backgroundType: "color",
    backgroundColor: "#F4F7F7",
    backgroundImage: "/uploads/bg-tech.png",
    logoUrl: "/uploads/logo-tr.png",
    fontFamily: "Inter, sans-serif",
    borderRadius: 12,
    sidebarVariant: "gradient",
    loginBackgroundType: "image",
    menuIconColor: "#FFFFFF",
    menuIconActiveColor: "#FFFFFF",
  };
}

function readGlobalBranding(): Branding {
  ensureDirs();
  if (fs.existsSync(BRANDING_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(BRANDING_FILE, "utf8"));
    } catch (_) {}
  }
  return defaultBranding();
}

function writeGlobalBranding(data: Branding) {
  ensureDirs();
  fs.writeFileSync(BRANDING_FILE, JSON.stringify(data, null, 2), "utf8");
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

function extractAuthContext(authorization?: string): { tenantId?: number; userId?: number; profile?: string; admin?: boolean; super?: boolean } {
  try {
    const parts = (authorization || "").split(" ");
    const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (!bearer) return {};
    const payload = jwt.verify(bearer, env.JWT_SECRET) as any;
    return {
      tenantId: Number(payload?.tenantId || payload?.companyId || 0) || undefined,
      userId: Number(payload?.userId || payload?.id || 0) || undefined,
      profile: payload?.profile ? String(payload.profile) : undefined,
      admin: Boolean(payload?.admin),
      super: Boolean(payload?.super),
    };
  } catch {
    return {};
  }
}

async function ensureBrandingSchema() {
  await pgQuery(
    `
    CREATE TABLE IF NOT EXISTS "CompanyBrandings" (
      "companyId" integer PRIMARY KEY,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `
  );
  await pgQuery(`ALTER TABLE "CompanyBrandings" ADD COLUMN IF NOT EXISTS data jsonb`);
  await pgQuery(`ALTER TABLE "CompanyBrandings" ADD COLUMN IF NOT EXISTS "createdAt" timestamptz`);
  await pgQuery(`ALTER TABLE "CompanyBrandings" ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz`);
}

async function readCompanyBranding(companyId: number): Promise<Branding | null> {
  try {
    await ensureBrandingSchema();
    const rows = await pgQuery<{ data: any }>(
      `SELECT data FROM "CompanyBrandings" WHERE "companyId" = $1 LIMIT 1`,
      [companyId]
    );
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) return null;
    const obj = row.data && typeof row.data === "object" ? row.data : null;
    return obj ? (obj as Branding) : null;
  } catch {
    return null;
  }
}

async function upsertCompanyBranding(companyId: number, payload: Partial<Branding>): Promise<Branding> {
  await ensureBrandingSchema();
  const current = (await readCompanyBranding(companyId)) || {};
  const merged = { ...current, ...payload };
  await pgQuery(
    `
    INSERT INTO "CompanyBrandings" ("companyId", data, "createdAt", "updatedAt")
    VALUES ($1, $2::jsonb, now(), now())
    ON CONFLICT ("companyId")
    DO UPDATE SET data = EXCLUDED.data, "updatedAt" = now()
  `,
    [companyId, JSON.stringify(merged)]
  );
  return merged as Branding;
}

async function ensureAdminLike(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = Number(req.userId);
    if (!userId) return res.status(401).json({ error: true, message: "Unauthorized" });
    const user = await findByPkSafe("User", userId);
    const profile = String((user as any)?.profile || "").toLowerCase();
    const isSuper = Boolean((user as any)?.super) || profile === "super";
    const isAdmin = Boolean((user as any)?.admin) || profile === "admin";
    if (!user || (!isAdmin && !isSuper)) return res.status(403).json({ error: true, message: "Forbidden" });
    return next();
  } catch (e) {
    return res.status(403).json({ error: true, message: "Forbidden" });
  }
}

// GET /branding - public fallback + company-aware when companyId is known (token or query)
router.get("/", async (req, res) => {
  setNoCache(res);
  const qCompanyId = Number((req.query as any)?.companyId || 0);
  const authCtx = extractAuthContext(req.headers.authorization as string);
  const tenantId = Number(authCtx?.tenantId || 0);
  const companyId = qCompanyId > 0 ? qCompanyId : (tenantId > 0 ? tenantId : 0);

  const base = { ...defaultBranding(), ...readGlobalBranding() };
  if (companyId > 0) {
    const db = await readCompanyBranding(companyId);
    if (db) return res.json({ ...base, ...db });
  }
  return res.json(base);
});

// PUT /branding - admin/super; supports per-company via query param (super) or tenantId
router.put("/", authMiddleware, ensureAdminLike, async (req, res) => {
  setNoCache(res);
  const qCompanyId = Number((req.query as any)?.companyId || 0);
  const authCtx = extractAuthContext(req.headers.authorization as string);
  const tenantId = Number(authCtx?.tenantId || 0);
  const profile = String(authCtx?.profile || "").toLowerCase();
  const isSuper = Boolean(authCtx?.super) || profile === "super";

  const targetCompanyId = isSuper && qCompanyId > 0 ? qCompanyId : tenantId;
  if (!targetCompanyId) return res.status(400).json({ error: true, message: "companyId not resolved" });

  // Persist to DB as company branding
  const updated = await upsertCompanyBranding(targetCompanyId, req.body || {});
  return res.json({ ...defaultBranding(), ...readGlobalBranding(), ...updated });
});

// Upload setup
ensureDirs();
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const qCompanyId = Number((req.query as any)?.companyId || 0);
      const authCtx = extractAuthContext(req.headers.authorization as string);
      const tenantId = Number(authCtx?.tenantId || 0);
      const profile = String(authCtx?.profile || "").toLowerCase();
      const isSuper = Boolean(authCtx?.super) || profile === "super";
      const targetCompanyId = isSuper && qCompanyId > 0 ? qCompanyId : tenantId;

      const dir = targetCompanyId
        ? path.join(UPLOADS_DIR, "branding", String(targetCompanyId))
        : path.join(UPLOADS_DIR, "branding", "global");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch {
      cb(null, UPLOADS_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || ".png");
    cb(null, unique + ext);
  }
});
const upload = multer({ storage });

// POST /branding/upload - admin/super only (company-aware)
router.post("/upload", authMiddleware, ensureAdminLike, upload.single("file"), (req: Request, res: Response) => {
  setNoCache(res);
  if (!req.file) return res.status(400).json({ error: true, message: "file is required" });
  // build relative URL from /public
  const abs = req.file.path;
  const rel = "/" + path.relative(PUBLIC_DIR, abs).replace(/\\/g, "/");
  return res.json({ url: rel });
});

export default router;


