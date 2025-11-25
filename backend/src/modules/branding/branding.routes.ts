import { Router, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { authMiddleware } from "../../middleware/authMiddleware";
import { findByPkSafe } from "../../utils/legacyModel";

type Branding = {
  primaryColor: string;
  secondaryColor: string;
  buttonColor: string;
  textColor: string;
  backgroundType: "color" | "image";
  backgroundColor?: string;
  backgroundImage?: string;
  logoUrl?: string;
  fontFamily?: string;
  borderRadius?: number;
  sidebarVariant?: "solid" | "gradient";
  loginBackgroundType?: "color" | "image";
};

const router = Router();

const PUBLIC_DIR = path.join(process.cwd(), "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const BRANDING_FILE = path.join(PUBLIC_DIR, "branding.json");

function ensureDirs() {
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR);
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
}

function readBranding(): Branding {
  ensureDirs();
  if (fs.existsSync(BRANDING_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(BRANDING_FILE, "utf8"));
    } catch (_) {}
  }
  const defaults: Branding = {
    primaryColor: "#0B4C46",
    secondaryColor: "#2BA9A5",
    buttonColor: "#2BA9A5",
    textColor: "#1F2937",
    backgroundType: "color",
    backgroundColor: "#F4F7F7",
    backgroundImage: "/uploads/bg-tech.png",
    logoUrl: "/uploads/logo-tr.png",
    fontFamily: "Inter, sans-serif",
    borderRadius: 12,
    sidebarVariant: "gradient",
    loginBackgroundType: "image"
  };
  return defaults;
}

function writeBranding(data: Branding) {
  ensureDirs();
  fs.writeFileSync(BRANDING_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function ensureAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = Number(req.userId);
    if (!userId) return res.status(401).json({ error: true, message: "Unauthorized" });
    const user = await findByPkSafe("User", userId);
    if (!user || !user.admin) return res.status(403).json({ error: true, message: "Forbidden" });
    return next();
  } catch (e) {
    return res.status(403).json({ error: true, message: "Forbidden" });
  }
}

// GET /branding - public (frontend needs it before auth), but we keep CORS open already
router.get("/", (_req, res) => {
  return res.json(readBranding());
});

// PUT /branding - admin only
router.put("/", authMiddleware, ensureAdmin, (req, res) => {
  const current = readBranding();
  const updated = { ...current, ...req.body } as Branding;
  writeBranding(updated);
  return res.json(updated);
});

// Upload setup
ensureDirs();
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || ".png");
    cb(null, unique + ext);
  }
});
const upload = multer({ storage });

// POST /branding/upload - admin only
router.post("/upload", authMiddleware, ensureAdmin, upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: true, message: "file is required" });
  const rel = "/uploads/" + req.file.filename;
  return res.json({ url: rel });
});

export default router;


