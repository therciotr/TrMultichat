import { Request, Response } from "express";
import {
  findAllSafe,
  getSequelize,
  getLegacyModel
} from "../../utils/legacyModel";
import env from "../../config/env";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import appEnv from "../../config/env";
import { pgQuery } from "../../utils/pgClient";

export async function list(req: Request, res: Response) {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  const isSuper = await isSuperFromAuth(req);
  // Non-super users: only see users from their own company and never super users
  const where =
    !isSuper && tenantId
      ? { companyId: tenantId, super: false }
      : undefined;
  const users = await findAllSafe("User", { where, offset, limit, order: [["updatedAt", "DESC"]] });
  return res.json({ users, hasMore: users.length === limit });
}

export async function find(req: Request, res: Response) {
  const id = Number(req.params.id);
  // Lê usuário diretamente do Postgres para evitar problemas com modelos legacy não inicializados
  const rows = await pgQuery<{
    id: number;
    name: string;
    email: string;
    companyId: number;
    profile?: string;
    super?: boolean;
  }>('SELECT id, name, email, "companyId", profile, "super" FROM "Users" WHERE id = $1 LIMIT 1', [id]);
  const user = Array.isArray(rows) && rows[0];
  if (!user) {
    if (String(process.env.DEV_MODE || env.DEV_MODE || "false").toLowerCase() === "true") {
      return res.json({
        id,
        name: id === 1 ? "TR Admin" : `User ${id}`,
        email: id === 1 ? "thercio@trtecnologias.com.br" : `user${id}@example.com`,
        companyId: 1,
        admin: id === 1,
        profile: id === 1 ? "admin" : "user"
      });
    }
    return res.status(404).json({ error: true, message: "not found" });
  }
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  const isSuper = await isSuperFromAuth(req);
  const plain: any = user;
  const userCompanyId = Number(plain.companyId || 0);
  const targetIsSuper = Boolean(plain.super);
  // Non-super users cannot see users from other companies or any super user
  if (!isSuper) {
    if (tenantId && userCompanyId && userCompanyId !== tenantId) {
      return res.status(403).json({ error: true, message: "forbidden" });
    }
    if (targetIsSuper) {
      return res.status(403).json({ error: true, message: "forbidden" });
    }
  }
  return res.json(user);
}

export async function listByCompany(req: Request, res: Response) {
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
  const isSuper = await isSuperFromAuth(req);
  let companyId = Number(req.query.companyId || 0);
  if (!isSuper || !companyId) {
    companyId = tenantId;
  }
  // For non-super users we also hide any super users from the list
  const where: any = companyId ? { companyId } : {};
  if (!isSuper) {
    where.super = false;
  }
  const users = await findAllSafe("User", {
    where: Object.keys(where).length ? where : undefined,
    attributes: ["id", "name", "email", "companyId"],
    order: [["id", "ASC"]]
  });
  return res.json(users);
}

function extractTenantIdFromAuth(authorization?: string): number {
  try {
    const parts = (authorization || "").split(" ");
    const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (!bearer) return 0;
    const payload = jwt.verify(bearer, appEnv.JWT_SECRET) as { tenantId?: number };
    return Number(payload?.tenantId || 0);
  } catch {
    return 0;
  }
}

async function isSuperFromAuth(req: Request): Promise<boolean> {
  try {
    const auth = req.headers.authorization || "";
    const parts = auth.split(" ");
    const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (!bearer) return false;
    const payload = jwt.verify(bearer, appEnv.JWT_SECRET) as { userId?: number };
    const User = getLegacyModel("User");
    if (!User || typeof User.findByPk !== "function" || !payload?.userId) {
      return false;
    }
    const instance = await User.findByPk(payload.userId);
    const plain = instance?.get ? instance.get({ plain: true }) : (instance as any);
    return Boolean(plain?.super);
  } catch {
    return false;
  }
}

export async function update(req: Request, res: Response) {
  try {
    // Load legacy model dynamically
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const UserModel = require("../../models/User");
    const User = UserModel.default || UserModel;
    if (!User || typeof User.findByPk !== "function") {
      return res.status(501).json({ error: true, message: "user update not available" });
    }
    const id = Number(req.params.id);
    const instance = await User.findByPk(id);
    if (!instance) return res.status(404).json({ error: true, message: "not found" });
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string) || 0;
    const current = instance?.toJSON ? instance.toJSON() : instance;
    // If different company, respond with current data (no-op) to avoid legacy 400
    if (tenantId && Number(current?.companyId || 0) !== tenantId) {
      return res.json(current);
    }
    const body = req.body || {};
    const allowed: any = {
      name: body.name,
      email: body.email,
      profile: body.profile
    };
  if (body.password) {
    const pwd = String(body.password || "");
    if (pwd.length >= 4) {
      const hash = bcrypt.hashSync(pwd, 10);
      allowed.passwordHash = hash;
      // algumas bases usam 'password' para armazenar o hash
      (allowed as any).password = hash;
    }
  }
    // Remove undefined so we don't overwrite with undefined
    Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);
    await instance.update(allowed);
    if (allowed.passwordHash || (allowed as any).password) {
      if (typeof (instance as any).save === "function") {
        try {
          await (instance as any).save({ fields: ["passwordHash", "password"] });
        } catch (_) {}
      }
    }
    const json = instance?.toJSON ? instance.toJSON() : instance;
    return res.json(json);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "update error" });
  }
}

export async function updatePassword(req: Request, res: Response) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const UserModel = require("../../models/User");
    const User = UserModel.default || UserModel;
    if (!User || typeof User.findByPk !== "function") {
      return res.status(501).json({ error: true, message: "user update not available" });
    }
    const id = Number(req.params.id);
    const instance = await User.findByPk(id);
    if (!instance) return res.status(404).json({ error: true, message: "not found" });
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string) || 0;
    const current = instance?.toJSON ? instance.toJSON() : instance;
    if (tenantId && Number(current?.companyId || 0) !== tenantId) {
      return res.status(403).json({ error: true, message: "forbidden" });
    }
    const body = req.body || {};
    const newPassword = String(body.password || "");
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: true, message: "password is required" });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    try { instance.set("passwordHash", hash); } catch (_) {}
    try { (instance as any).set?.("password", hash); } catch (_) {}
    if (typeof (instance as any).save === "function") {
      await (instance as any).save({ fields: ["passwordHash", "password"] });
    } else {
      await (instance as any).update({ passwordHash: hash, password: hash });
    }
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "password update error" });
  }
}

export async function updatePasswordRaw(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string) || 0;
    if (!id || !tenantId) return res.status(400).json({ error: true, message: "invalid request" });
    const body = req.body || {};
    const newPassword = String(body.password || "");
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: true, message: "password is required" });
    }
    const sequelize = getSequelize();
    if (!sequelize || typeof sequelize.query !== "function") {
      return res.status(501).json({ error: true, message: "database not available" });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    const [rows] = await sequelize.query('SELECT "companyId" FROM "Users" WHERE id = :id LIMIT 1', { replacements: { id } });
    const row: any = Array.isArray(rows) && (rows as any[])[0];
    if (!row) return res.status(404).json({ error: true, message: "not found" });
    const cid = Number(row.companyId || row.company_id || 0);
    if (cid !== tenantId) return res.status(403).json({ error: true, message: "forbidden" });
    await sequelize.query('UPDATE "Users" SET "passwordHash" = :hash, "updatedAt" = NOW() WHERE id = :id', {
      replacements: { id, hash }
    });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "password update error" });
  }
}

export async function updatePasswordAdmin(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: true, message: "invalid user id" });
    const body = req.body || {};
    const newPassword = String(body.password || "");
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: true, message: "password is required" });
    }
    // Verify current bearer belongs to ADMIN_EMAIL
    const auth = req.headers.authorization || "";
    const parts = auth.split(" ");
    const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (!bearer) return res.status(401).json({ error: true, message: "missing bearer token" });
    const payload = jwt.verify(bearer, appEnv.JWT_SECRET) as { userId: number; tenantId: number };
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const UserModel = require("../../models/User");
    const User = UserModel.default || UserModel;
    if (!User || typeof User.findByPk !== "function") {
      return res.status(501).json({ error: true, message: "user update not available" });
    }
    const current = await User.findByPk(payload.userId);
    if (!current) return res.status(401).json({ error: true, message: "unauthorized" });
    const plain = current?.get ? current.get({ plain: true }) : (current as any);
    const isAdminEmail = String(plain?.email || "").toLowerCase() === String(process.env.ADMIN_EMAIL || "").toLowerCase();
    if (!isAdminEmail) return res.status(403).json({ error: true, message: "forbidden" });
    // Update target user via raw to bypass model restrictions
    const sequelize = getSequelize();
    if (!sequelize || typeof sequelize.query !== "function") {
      return res.status(501).json({ error: true, message: "database not available" });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    await sequelize.query('UPDATE "Users" SET "passwordHash" = :hash, "updatedAt" = NOW() WHERE id = :id', {
      replacements: { id, hash }
    });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "password update error" });
  }
}





