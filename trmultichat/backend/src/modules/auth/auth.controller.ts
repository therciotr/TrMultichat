import { Request, Response } from "express";
import * as AuthService from "./auth.service";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import {
  getLegacyModel,
  getSequelize,
  findByPkSafe,
  findAllSafe
} from "../../utils/legacyModel";
import { validateLicenseForCompany } from "../../utils/license";
import bcrypt from "bcryptjs";
import { sendPasswordResetMail } from "../../utils/mailer";
import { pgQuery } from "../../utils/pgClient";

async function loadCompanyRow(companyId: number): Promise<{ id: number; name?: string; dueDate?: any } | null> {
  const candidates = ['"Companies"', "companies"];
  let lastErr: any = null;
  for (const table of candidates) {
    try {
      const rows = await pgQuery<{ id: number; name?: string; dueDate?: any }>(
        `SELECT id, name, "dueDate" as "dueDate" FROM ${table} WHERE id = $1 LIMIT 1`,
        [companyId]
      );
      const row = Array.isArray(rows) && rows[0];
      return row || null;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || "");
      if (!/relation .* does not exist/i.test(msg)) throw e;
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: true, message: "email and password are required" });
  }
  const result = await AuthService.login({ email, password });

  // Legacy-compatible shape for existing frontend
  const isDev = String(process.env.DEV_MODE || "false").toLowerCase() === "true";

  // Validate license per company (prod)
  if (!isDev) {
    const licenseCheck = await validateLicenseForCompany(result.user.tenantId);
    if (!licenseCheck.ok) {
      // Permitir login se licença apenas está ausente (para onboarding/ambientes sem chave pública)
      if (String(licenseCheck.error || "").toUpperCase().includes("MISSING")) {
        // proceed
      } else {
        return res.status(401).json({ error: licenseCheck.error || "LICENSE_INVALID" });
      }
    }
  }

  let company: any = null;
  let settings: any[] = [];

  if (isDev) {
    company = {
      id: result.user.tenantId,
      name: "DEV",
      dueDate: new Date(Date.now() + 365 * 24 * 3600 * 1000)
    };
    settings = [];
  } else {
    // Carrega empresa via Postgres direto (mais confiável que modelos legacy)
    company = await loadCompanyRow(result.user.tenantId);
    settings = await findAllSafe("Setting", {
      where: { companyId: result.user.tenantId }
    });
  }

  const settingsArr = Array.isArray(settings)
    ? settings.map((s: any) => ({ key: s.key, value: String(s.value) }))
    : [];

  // admin/profile information já vem calculada de forma correta no result.user (via AuthService.login)
  const isAdmin = Boolean(result.user.admin);
  const profile = String(result.user.profile || (isAdmin ? "admin" : "user"));
  // Super (master): por companyId e/ou e-mail do dono (configurável)
  const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
  const masterEmail = String(process.env.ADMIN_EMAIL || "thercio@trtecnologias.com.br")
    .toLowerCase()
    .trim();
  const isMasterEmail = String(result.user.email || "").toLowerCase().trim() === masterEmail;
  const isSuper = Boolean(isAdmin && (result.user.tenantId === masterCompanyId || isMasterEmail));

  const legacy = {
    token: result.accessToken,
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      companyId: result.user.tenantId,
      admin: isAdmin,
      profile,
      super: isSuper,
      company: {
        id: result.user.tenantId,
        name: company?.name || "",
        // Em produção, não inventa vencimento: se não existir no banco, mantém null/undefined
        dueDate: isDev ? (company?.dueDate || new Date(Date.now() + 365 * 24 * 3600 * 1000)) : (company?.dueDate || null),
        settings: settingsArr
      }
    },
    accessToken: result.accessToken,
    refreshToken: result.refreshToken
  };

  return res.json(legacy);
}

// POST /auth/forgot-password
export async function forgotPassword(req: Request, res: Response) {
  try {
    const emailRaw = String((req.body?.email || "")).toLowerCase().trim();
    if (!emailRaw) return res.status(400).json({ error: true, message: "email is required" });
    const User = getLegacyModel("User");
    if (!User || typeof User.findOne !== "function") {
      return res.status(501).json({ error: true, message: "not available" });
    }
    const user = await User.findOne({ where: { email: emailRaw } });
    if (!user) {
      // avoid leaking if user exists: respond ok anyway
      return res.json({ ok: true });
    }
    const plain = user?.get ? user.get({ plain: true }) : (user as any);
    const currentHash = String((plain as any).passwordHash || (plain as any).password || "");
    const token = jwt.sign(
      { userId: plain.id, tenantId: plain.companyId, purpose: "pwdReset", pwdHash: currentHash || undefined },
      env.JWT_REFRESH_SECRET,
      { expiresIn: "30m" }
    );
    const appUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || "https://app.trmultichat.com.br";
    const link = `${appUrl.replace(/\/+$/,"")}/reset-password?token=${encodeURIComponent(token)}`;
    const companyId = Number(plain.companyId || plain.tenantId || 0);
    // Envia o link por e-mail (SMTP da empresa ou global)
    try {
      await sendPasswordResetMail(emailRaw, link, companyId || undefined);
    } catch (mailErr: any) {
      // eslint-disable-next-line no-console
      console.warn("[auth] forgotPassword mail error:", mailErr?.message || mailErr);
      return res.status(502).json({ error: true, message: "mail error" });
    }
    const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
    if (isProd) {
      return res.json({ ok: true });
    }
    // Em ambientes não-produtivos mantemos o link para facilitar debug
    return res.json({ ok: true, link, expiresInMinutes: 30 });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "forgot password error" });
  }
}

// POST /auth/reset-password (token-based, user flow)
export async function resetPasswordByEmail(req: Request, res: Response) {
  try {
    const token = String((req.body as any)?.token || "");
    const password = String((req.body as any)?.password || "");
    const debugFlag = Boolean((req.body as any)?.debug);
    if (!token || !password) {
      return res.status(400).json({ error: true, message: "token and password are required" });
    }

    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as {
      userId: number;
      tenantId: number;
      purpose?: string;
      pwdHash?: string;
      iat?: number;
    };
    if (!payload || payload.purpose !== "pwdReset" || !payload.userId) {
      return res.status(400).json({ error: true, message: "invalid token" });
    }

    const sequelize = getSequelize();
    if (!sequelize || typeof (sequelize as any).query !== "function") {
      return res.status(501).json({ error: true, message: "not available" });
    }

    const [rows]: any = await (sequelize as any).query(
      'SELECT "passwordHash","updatedAt" FROM "Users" WHERE id = :id LIMIT 1',
      { replacements: { id: payload.userId } }
    );
    const row = Array.isArray(rows) && rows[0];
    if (!row) {
      return res.status(404).json({ error: true, message: "user not found" });
    }

    const currentHash = String(row.passwordHash || "");
    const tokenHash = String(payload.pwdHash || "");
    const tokenIat = typeof (payload as any).iat === "number" ? (payload as any).iat : 0;
    const updatedAtSeconds = row.updatedAt ? Math.floor(new Date(row.updatedAt).getTime() / 1000) : 0;

    const reusedByHash = Boolean(tokenHash && currentHash && tokenHash !== currentHash);
    const reusedByTime = Boolean(tokenIat && updatedAtSeconds && updatedAtSeconds > tokenIat + 1);

    if (debugFlag) {
      return res.json({
        ok: true,
        debug: {
          currentHashEmpty: !currentHash,
          tokenHashEmpty: !tokenHash,
          sameHash: currentHash === tokenHash,
          tokenIat,
          updatedAtSeconds,
          reusedByHash,
          reusedByTime
        }
      });
    }

    if (reusedByHash || reusedByTime) {
      return res.status(400).json({ error: true, message: "invalid or already used token" });
    }

    const hash = bcrypt.hashSync(password, 10);
    await (sequelize as any).query(
      'UPDATE "Users" SET "passwordHash" = :hash, "updatedAt" = NOW() WHERE id = :id',
      { replacements: { id: payload.userId, hash } }
    );
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "reset password error" });
  }
}

export async function signup(req: Request, res: Response) {
  try {
    const body = req.body || {};
    const companyName = String(body.companyName || body.company || "").trim();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!companyName || !name || !email || !password) {
      return res.status(400).json({ error: true, message: "companyName, name, email and password are required" });
    }
    const Company = getLegacyModel("Company");
    const User = getLegacyModel("User");
    if (!Company || !User || typeof Company.create !== "function" || typeof User.create !== "function") {
      return res.status(501).json({ error: true, message: "signup not available" });
    }
    const exists = (await User.findOne?.({ where: { email } })) || null;
    if (exists) return res.status(409).json({ error: true, message: "email already exists" });
    const company = await Company.create({ name: companyName });
    const hash = bcrypt.hashSync(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash: hash,
      companyId: company.id,
      admin: true,
      super: false,
      profile: "admin"
    });
    const profile = "admin";
    const accessToken = jwt.sign(
      { userId: user.id, tenantId: company.id, id: user.id, companyId: company.id, profile },
      env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, tenantId: company.id, id: user.id, companyId: company.id, profile },
      env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );
    return res.status(201).json({
      token: accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        companyId: user.companyId,
        admin: true,
        profile: "admin"
      },
      accessToken,
      refreshToken
    });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "signup error" });
  }
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ error: true, message: "refreshToken is required" });
  }
  const tokens = await AuthService.refresh(refreshToken);
  return res.json(tokens);
}

export async function refreshLegacy(req: Request, res: Response) {
  try {
    const auth = req.headers.authorization || "";
    const parts = auth.split(" ");
    const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (!bearer) return res.status(401).json({ error: true, message: "missing bearer token" });

    const payload = jwt.verify(bearer, env.JWT_SECRET) as {
      userId: number;
      tenantId: number;
    };
    const isDev = String(process.env.DEV_MODE || "false").toLowerCase() === "true";

    let user: any = null;
    if (isDev) {
      user = {
        id: payload.userId,
        name: "TR Admin",
        email: process.env.ADMIN_EMAIL || "thercio@trtecnologias.com.br",
        companyId: payload.tenantId,
        admin: true,
        profile: "admin",
        super: true
      };
    } else {
      const rows = await pgQuery<{
        id: number;
        name: string;
        email: string;
        companyId: number;
        profile?: string;
        super?: boolean;
        admin?: boolean;
      }>(
        'SELECT id, name, email, \"companyId\", profile, \"super\" FROM \"Users\" WHERE id = $1 LIMIT 1',
        [payload.userId]
      );
      user = Array.isArray(rows) && rows[0];
    }

    if (!user) {
      return res.status(401).json({ error: true, message: "user not found" });
    }

    if (!isDev) {
      const licenseCheck = await validateLicenseForCompany(user.companyId);
      if (!licenseCheck.ok) {
        if (String(licenseCheck.error || "").toUpperCase().includes("MISSING")) {
          // proceed
        } else {
          return res.status(401).json({ error: licenseCheck.error || "LICENSE_INVALID" });
        }
      }
    }

    let company: any = null;
    let settings: any[] = [];
    if (isDev) {
      company = {
        id: user.companyId,
        name: "DEV",
        dueDate: new Date(Date.now() + 365 * 24 * 3600 * 1000)
      };
      settings = [];
    } else {
      company = await loadCompanyRow(user.companyId);
      settings = await findAllSafe("Setting", {
        where: { companyId: user.companyId }
      });
    }
    const settingsArr = Array.isArray(settings)
      ? settings.map((s: any) => ({ key: s.key, value: String(s.value) }))
      : [];

    const newToken = jwt.sign(
      {
        userId: user.id,
        tenantId: user.companyId,
        id: user.id,
        companyId: user.companyId,
        profile
      },
      env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const isAdmin = Boolean((user as any).admin);
    const profile = String(
      (user as any).profile || (isAdmin ? "admin" : "user")
    );
    const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
    const masterEmail = String(process.env.ADMIN_EMAIL || "thercio@trtecnologias.com.br")
      .toLowerCase()
      .trim();
    const email = String((user as any).email || "").toLowerCase().trim();
    const isSuper = Boolean((user as any).super) || Number((user as any).companyId || 0) === masterCompanyId || email === masterEmail;
    return res.json({
      token: newToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        companyId: user.companyId,
        admin: isAdmin,
        profile,
        super: isSuper,
        company: {
          id: user.companyId,
          name: company?.name || "",
          dueDate: isDev ? (company?.dueDate || new Date(Date.now() + 365 * 24 * 3600 * 1000)) : (company?.dueDate || null),
          settings: settingsArr
        }
      }
    });
  } catch (e: any) {
    return res.status(401).json({ error: true, message: e?.message || "invalid token" });
  }
}

export async function me(req: Request, res: Response) {
  try {
    const auth = req.headers.authorization || "";
    const parts = auth.split(" ");
    const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (!bearer) return res.status(401).json({ error: true, message: "missing bearer token" });

    const payload = jwt.verify(bearer, env.JWT_SECRET) as {
      userId: number;
      tenantId: number;
    };
    const isDev =
      String(process.env.DEV_MODE || "false").toLowerCase() === "true";

    let user: any = null;
    if (isDev) {
      user = {
        id: payload.userId,
        name: "TR Admin",
        email:
          process.env.ADMIN_EMAIL || "thercio@trtecnologias.com.br",
        companyId: payload.tenantId,
        admin: true,
        profile: "admin",
        super: true
      };
    } else {
      const rows = await pgQuery<{
        id: number;
        name: string;
        email: string;
        companyId: number;
        profile?: string;
        super?: boolean;
        admin?: boolean;
      }>(
        'SELECT id, name, email, "companyId", profile, "super" FROM "Users" WHERE id = $1 LIMIT 1',
        [payload.userId]
      );
      user = Array.isArray(rows) && rows[0];
    }

    if (!user) {
      return res
        .status(404)
        .json({ error: true, message: "user not found" });
    }

    const isAdmin = Boolean((user as any).admin);
    const profile = String(
      (user as any).profile || (isAdmin ? "admin" : "user")
    );
    const isSuper = Boolean((user as any).super);
    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      companyId: user.companyId,
      admin: isAdmin,
      profile,
      super: isSuper
    });
  } catch (e: any) {
    return res.status(401).json({ error: true, message: e?.message || "invalid token" });
  }
}



