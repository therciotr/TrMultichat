import { Request, Response } from "express";
import * as AuthService from "./auth.service";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { getLegacyModel } from "../../utils/legacyModel";
import { validateLicenseForCompany } from "../../utils/license";
import bcrypt from "bcryptjs";

export async function login(req: Request, res: Response) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: true, message: "email and password are required" });
  }
  const result = await AuthService.login({ email, password });

  // Legacy-compatible shape for existing frontend
  const isDev = String(process.env.DEV_MODE || "false").toLowerCase() === "true";
  const Company = isDev ? undefined : getLegacyModel("Company");
  const Setting = isDev ? undefined : getLegacyModel("Setting");

  // Validate license per company (prod)
  if (!isDev) {
    const licenseCheck = await validateLicenseForCompany(result.user.tenantId);
    if (!licenseCheck.ok) {
      return res.status(401).json({ error: licenseCheck.error || "LICENSE_INVALID" });
    }
  }

  let company = Company?.findByPk ? await Company.findByPk(result.user.tenantId) : undefined;
  let settings = Setting?.findAll ? await Setting.findAll({ where: { companyId: result.user.tenantId } }) : [];
  if (!company && String(process.env.DEV_MODE || "false").toLowerCase() === "true") {
    company = { id: result.user.tenantId, dueDate: new Date(Date.now() + 365 * 24 * 3600 * 1000) };
    settings = [];
  }
  const settingsArr = Array.isArray(settings)
    ? settings.map((s: any) => ({ key: s.key, value: String(s.value) }))
    : [];

  // load admin/profile from DB to expose to frontend
  const User2 = isDev ? undefined : getLegacyModel("User");
  let dbUser = User2?.findByPk ? await User2.findByPk(result.user.id) : undefined;
  if (!dbUser && String(process.env.DEV_MODE || "false").toLowerCase() === "true") {
    dbUser = { id: result.user.id, admin: true, profile: "admin" };
  }
  const plainLogin = dbUser?.get ? dbUser.get({ plain: true }) : dbUser;
  const isAdmin = Boolean(plainLogin?.admin);
  const profile = String(plainLogin?.profile || (isAdmin ? "admin" : "user"));

  const legacy = {
    token: result.accessToken,
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      companyId: result.user.tenantId,
      admin: isAdmin,
      profile,
      company: {
        id: result.user.tenantId,
        dueDate: company?.dueDate || new Date(Date.now() + 365 * 24 * 3600 * 1000),
        settings: settingsArr
      }
    },
    accessToken: result.accessToken,
    refreshToken: result.refreshToken
  };

  return res.json(legacy);
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
      super: true,
      profile: "admin"
    });
    const accessToken = jwt.sign({ userId: user.id, tenantId: company.id }, env.JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ userId: user.id, tenantId: company.id }, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
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

    const payload = jwt.verify(bearer, env.JWT_SECRET) as { userId: number; tenantId: number };
    const isDev = String(process.env.DEV_MODE || "false").toLowerCase() === "true";
    const User = isDev ? undefined : getLegacyModel("User");
    const Company = isDev ? undefined : getLegacyModel("Company");
    const Setting = isDev ? undefined : getLegacyModel("Setting");

    let userInstance = User?.findByPk ? await User.findByPk(payload.userId) : undefined;
    if (!userInstance && String(process.env.DEV_MODE || "false").toLowerCase() === "true") {
      userInstance = { id: payload.userId, name: "TR Admin", email: process.env.ADMIN_EMAIL || "thercio@trtecnologias.com.br", companyId: payload.tenantId, admin: true, profile: "admin" };
    }
    if (!userInstance) return res.status(401).json({ error: true, message: "user not found" });

    if (!isDev) {
      const licenseCheck = await validateLicenseForCompany(userInstance.companyId);
      if (!licenseCheck.ok) {
        return res.status(401).json({ error: licenseCheck.error || "LICENSE_INVALID" });
      }
    }

    let company = Company?.findByPk ? await Company.findByPk(userInstance.companyId) : undefined;
    let settings = Setting?.findAll ? await Setting.findAll({ where: { companyId: userInstance.companyId } }) : [];
    if (!company && String(process.env.DEV_MODE || "false").toLowerCase() === "true") {
      company = { id: userInstance.companyId, dueDate: new Date(Date.now() + 365 * 24 * 3600 * 1000) };
      settings = [];
    }
    const settingsArr = Array.isArray(settings)
      ? settings.map((s: any) => ({ key: s.key, value: String(s.value) }))
      : [];

    const newToken = jwt.sign({ userId: userInstance.id, tenantId: userInstance.companyId }, env.JWT_SECRET, { expiresIn: "15m" });

    const plain = userInstance?.get ? userInstance.get({ plain: true }) : (userInstance as any);
    const isAdmin = Boolean(plain?.admin);
    const profile = String(plain?.profile || (isAdmin ? "admin" : "user"));
    return res.json({
      token: newToken,
      user: {
        id: userInstance.id,
        name: userInstance.name,
        email: userInstance.email,
        companyId: userInstance.companyId,
        admin: isAdmin,
        profile,
        company: {
          id: userInstance.companyId,
          dueDate: company?.dueDate || new Date(Date.now() + 365 * 24 * 3600 * 1000),
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

    const payload = jwt.verify(bearer, env.JWT_SECRET) as { userId: number; tenantId: number };
    const User = String(process.env.DEV_MODE || "false").toLowerCase() === "true" ? undefined : getLegacyModel("User");
    let userInstance = User?.findByPk ? await User.findByPk(payload.userId) : undefined;
    if (!userInstance && String(process.env.DEV_MODE || "false").toLowerCase() === "true") {
      userInstance = { id: payload.userId, name: "TR Admin", email: process.env.ADMIN_EMAIL || "thercio@trtecnologias.com.br", companyId: payload.tenantId, admin: true, profile: "admin" };
    }
    if (!userInstance) return res.status(404).json({ error: true, message: "user not found" });
    const plain = userInstance?.get ? userInstance.get({ plain: true }) : (userInstance as any);
    const isAdmin = Boolean(plain?.admin);
    const profile = String(plain?.profile || (isAdmin ? "admin" : "user"));
    return res.json({
      id: userInstance.id,
      name: userInstance.name,
      email: userInstance.email,
      companyId: userInstance.companyId,
      admin: isAdmin,
      profile
    });
  } catch (e: any) {
    return res.status(401).json({ error: true, message: e?.message || "invalid token" });
  }
}



