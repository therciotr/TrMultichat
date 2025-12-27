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

  const isDev = String(process.env.DEV_MODE || env.DEV_MODE || "false").toLowerCase() === "true";
  if (!tenantId && !isDev) {
    return res.status(401).json({ error: true, message: "missing tenantId" });
  }

  const searchParam = String(req.query.searchParam || "").trim().toLowerCase();
  const where: string[] = [];
  const params: any[] = [];

  // Escopo: master/super vê tudo; demais só o próprio tenant e nunca super users
  if (!isSuper && tenantId) {
    where.push(`"companyId" = $${params.length + 1}`);
    params.push(tenantId);
    where.push(`COALESCE("super", false) = false`);
  }

  if (searchParam) {
    where.push(`(lower(name) LIKE $${params.length + 1} OR lower(email) LIKE $${params.length + 1})`);
    params.push(`%${searchParam}%`);
  }

  params.push(limit);
  params.push(offset);

  const sql = (table: string) => `
    SELECT id, name, email, "companyId", profile, "super"
    FROM ${table}
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY "updatedAt" DESC, id DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const rows = await queryUsersTable<any>(sql, params);
  const users = Array.isArray(rows) ? rows : [];
  return res.json({ users, hasMore: users.length === limit });
}

export async function find(req: Request, res: Response) {
  const id = Number(req.params.id);
  // Lê usuário diretamente do Postgres para evitar problemas com modelos legacy não inicializados
  const rows = await queryUsersTable<{
    id: number;
    name: string;
    email: string;
    companyId: number;
    profile?: string;
    super?: boolean;
  }>((table) => `SELECT id, name, email, "companyId", profile, "super" FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
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
  const tenantId = extractTenantIdFromAuth(
    req.headers.authorization as string
  );
  const isSuper = await isSuperFromAuth(req);
  const currentUserId = extractUserIdFromAuth(
    req.headers.authorization as string
  );
  const isSelf = Number(currentUserId || 0) === Number(id || 0);
  const plain: any = user;
  const userCompanyId = Number(plain.companyId || 0);
  const targetIsSuper = Boolean(plain.super);
  // Non-super users cannot see users from other companies or any super user,
  // exceto eles mesmos (para permitir que o próprio admin-super veja seu perfil)
  if (!isSuper) {
    if (tenantId && userCompanyId && userCompanyId !== tenantId) {
      return res.status(403).json({ error: true, message: "forbidden" });
    }
    if (targetIsSuper && !isSelf) {
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
  const isDev = String(process.env.DEV_MODE || env.DEV_MODE || "false").toLowerCase() === "true";
  if (!tenantId && !isDev) {
    return res.status(401).json({ error: true, message: "missing tenantId" });
  }

  const where: string[] = [];
  const params: any[] = [];
  if (companyId) {
    where.push(`"companyId" = $${params.length + 1}`);
    params.push(companyId);
  }
  if (!isSuper) {
    where.push(`COALESCE("super", false) = false`);
  }

  const sql = (table: string) => `
    SELECT id, name, email, "companyId", profile, "super"
    FROM ${table}
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY id ASC
  `;
  const rows = await queryUsersTable<any>(sql, params);
  return res.json(Array.isArray(rows) ? rows : []);
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
    const payload = jwt.verify(bearer, appEnv.JWT_SECRET) as { userId?: number; id?: number; tenantId?: number };
    const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
    const masterEmail = String(process.env.ADMIN_EMAIL || "thercio@trtecnologias.com.br")
      .toLowerCase()
      .trim();
    const masterUserId = Number(process.env.MASTER_USER_ID || 1);
    // Se o token já carrega tenantId, e for master, já considera super (evita depender de DB/modelo)
    if (Number((payload as any)?.tenantId || 0) === masterCompanyId) return true;
    const uid = Number((payload as any)?.userId || (payload as any)?.id || 0);
    if (!uid) return false;
    // Fallback forte: o primeiro usuário do sistema costuma ser o master (seed)
    if (uid === masterUserId) return true;
    const userRows = await queryUsersTable<{ email?: string; super?: boolean; companyId?: number }>(
      (table) => `SELECT email, "super", "companyId" FROM ${table} WHERE id = $1 LIMIT 1`,
      [uid]
    );
    const u = Array.isArray(userRows) && userRows[0];
    if (!u) return false;
    const email = String((u as any).email || "").toLowerCase().trim();
    const isMasterCompany = Number((u as any).companyId || 0) === masterCompanyId;
    const isMasterEmail = email === masterEmail;
    return Boolean((u as any).super) || isMasterCompany || isMasterEmail;
  } catch {
    return false;
  }
}

function extractUserIdFromAuth(authorization?: string): number {
  try {
    const parts = (authorization || "").split(" ");
    const bearer =
      parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (!bearer) return 0;
    const payload = jwt.verify(bearer, appEnv.JWT_SECRET) as { userId?: number; id?: number };
    return Number((payload as any)?.userId || (payload as any)?.id || 0);
  } catch {
    return 0;
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
    const isSuper = await isSuperFromAuth(req);
    const current = instance?.toJSON ? instance.toJSON() : instance;
    // If different company, respond with current data (no-op) to avoid legacy 400
    if (!isSuper && tenantId && Number(current?.companyId || 0) !== tenantId) {
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

export async function create(req: Request, res: Response) {
  try {
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string) || 0;
    const isSuper = await isSuperFromAuth(req);
    const isDev = String(process.env.DEV_MODE || env.DEV_MODE || "false").toLowerCase() === "true";
    if (!tenantId && !isDev) {
      return res.status(401).json({ error: true, message: "missing tenantId" });
    }

    const body = req.body || {};
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const profile = String(body.profile || "user").trim();
    let companyId = Number(body.companyId || body.tenantId || tenantId || 0);

    if (!name || !email || !password) {
      return res.status(400).json({ error: true, message: "name, email and password are required" });
    }

    if (!isSuper) {
      companyId = tenantId;
    }
    if (!companyId) {
      return res.status(400).json({ error: true, message: "companyId is required" });
    }

    // email unique
    const exists = await queryUsersTable<{ id: number }>(
      (table) => `SELECT id FROM ${table} WHERE lower(email)=lower($1) LIMIT 1`,
      [email]
    );
    if (Array.isArray(exists) && exists[0]?.id) {
      return res.status(409).json({ error: true, message: "email already exists" });
    }

    const hash = bcrypt.hashSync(password, 10);
    const now = new Date();
    const inserted = await queryUsersTable<any>(
      (table) => `
        INSERT INTO ${table} (name, email, "companyId", profile, "passwordHash", password, super, "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id, name, email, "companyId", profile, "super"
      `,
      [name, email, companyId, profile, hash, hash, false, now, now]
    );
    const user = Array.isArray(inserted) && inserted[0];
    return res.status(201).json(user || { ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "create error" });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: true, message: "invalid user id" });
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string) || 0;
    const isSuper = await isSuperFromAuth(req);
    const masterUserId = Number(process.env.MASTER_USER_ID || 1);
    if (id === masterUserId) {
      return res.status(403).json({ error: true, message: "cannot delete master user" });
    }

    const rows = await queryUsersTable<any>(
      (table) => `SELECT id, "companyId", COALESCE("super", false) as super FROM ${table} WHERE id = $1 LIMIT 1`,
      [id]
    );
    const target = Array.isArray(rows) && rows[0];
    if (!target) return res.status(404).json({ error: true, message: "not found" });
    if (!isSuper) {
      if (tenantId && Number(target.companyId || 0) !== tenantId) {
        return res.status(403).json({ error: true, message: "forbidden" });
      }
      if (Boolean(target.super)) {
        return res.status(403).json({ error: true, message: "forbidden" });
      }
    }

    await queryUsersTable<any>(
      (table) => `DELETE FROM ${table} WHERE id = $1`,
      [id]
    );
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "delete error" });
  }
}

async function queryUsersTable<T>(
  sqlOrBuilder: string | ((table: string) => string),
  params: any[]
): Promise<T[]> {
  const candidates = ['"Users"', "users"];
  let lastErr: any = null;
  for (const table of candidates) {
    try {
      const sql = typeof sqlOrBuilder === "function" ? sqlOrBuilder(table) : sqlOrBuilder.replace(/\\b\"Users\"\\b/g, table);
      const rows = await pgQuery<T>(sql, params);
      return Array.isArray(rows) ? rows : [];
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || "");
      // só tenta fallback quando a tabela não existe
      if (!/relation .* does not exist/i.test(msg)) {
        throw e;
      }
    }
  }
  if (lastErr) throw lastErr;
  return [];
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
    const isSuper = await isSuperFromAuth(req);
    const current = instance?.toJSON ? instance.toJSON() : instance;
    if (!isSuper && tenantId && Number(current?.companyId || 0) !== tenantId) {
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
    const isSuper = await isSuperFromAuth(req);
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
    if (!isSuper && cid !== tenantId) return res.status(403).json({ error: true, message: "forbidden" });
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





