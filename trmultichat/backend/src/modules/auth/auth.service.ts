import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { getSequelize } from "../../utils/legacyModel";

type LoginInput = { email: string; password: string };

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  tenantId: number;
  admin?: boolean;
  profile?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export async function login({ email, password }: LoginInput): Promise<{ user: AuthUser } & AuthTokens> {
  // DEV fallback without DB (avoid requiring legacy models to prevent DB connect)
  if (String(process.env.DEV_MODE || "false").toLowerCase() === "true") {
    const adminEmail = process.env.ADMIN_EMAIL || "thercio@trtecnologias.com.br";
    const adminPassword = process.env.ADMIN_PASSWORD || "Tr030785";
    if (email === adminEmail && password === adminPassword) {
      const user: AuthUser = {
        id: 1,
        name: "TR Admin",
        email: adminEmail,
        tenantId: 1,
        admin: true,
        profile: "admin"
      };
      const accessToken = jwt.sign(
        { userId: user.id, tenantId: user.tenantId },
        env.JWT_SECRET,
        { expiresIn: "15m" }
      );
      const refreshToken = jwt.sign(
        { userId: user.id, tenantId: user.tenantId },
        env.JWT_REFRESH_SECRET,
        { expiresIn: "7d" }
      );
      return { user, accessToken, refreshToken };
    }
  }
  try {
    // Use legacy Sequelize connection diretamente (raw SQL)
    const db = getSequelize();
    if (!db || typeof (db as any).query !== "function") {
      throw new Error("database connection not available");
    }
    const [rows] = await (db as any).query(
      'SELECT id, name, email, "companyId", profile, "passwordHash", "super" FROM "Users" WHERE lower(email)=lower(:email) LIMIT 1',
      { replacements: { email: email.toLowerCase() } }
    );
    const row: any = Array.isArray(rows) && (rows as any[])[0];
    if (!row) {
      throw Object.assign(new Error("Invalid credentials"), { status: 401 });
    }

    const passwordHash: string | undefined = row.passwordHash;
    if (!passwordHash) {
      throw Object.assign(new Error("Invalid credentials"), { status: 401 });
    }

    const ok = await bcrypt.compare(password, passwordHash);
    if (!ok) {
      throw Object.assign(new Error("Invalid credentials"), { status: 401 });
    }

    const isAdmin = Boolean((row as any).super) || String((row as any).profile || "").toLowerCase() === "admin";
    const user: AuthUser = {
      id: Number(row.id),
      name: String(row.name || ""),
      email: String(row.email || ""),
      tenantId: Number(row.companyId || 0),
      admin: isAdmin,
      profile: String((row as any).profile || (isAdmin ? "admin" : "user"))
    };
  
    const accessToken = jwt.sign(
      { userId: user.id, tenantId: user.tenantId },
      env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, tenantId: user.tenantId },
      env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );
  
    return { user, accessToken, refreshToken };
  } catch (e) {
    throw e;
  }
}

export async function refresh(oldRefreshToken: string): Promise<AuthTokens> {
  try {
    const payload = jwt.verify(oldRefreshToken, env.JWT_REFRESH_SECRET) as { userId: number; tenantId: number };
    const accessToken = jwt.sign(
      { userId: payload.userId, tenantId: payload.tenantId },
      env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
      { userId: payload.userId, tenantId: payload.tenantId },
      env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );
    return { accessToken, refreshToken };
  } catch (err) {
    throw Object.assign(new Error("Invalid refresh token"), { status: 401 });
  }
}


