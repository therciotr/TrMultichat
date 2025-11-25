import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { getLegacyModel } from "../../utils/legacyModel";

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
    // Load legacy Sequelize User model (works in dist or ts-node-dev)
    const User = getLegacyModel("User");
    if (!User) throw Object.assign(new Error("User model unavailable"), { status: 500 });
    const userInstance = await User.findOne({ where: { email } });
    if (!userInstance) {
      throw Object.assign(new Error("Invalid credentials"), { status: 401 });
    }
  
    const passwordHash: string | undefined = userInstance.passwordHash;
    if (!passwordHash) {
      throw Object.assign(new Error("Invalid credentials"), { status: 401 });
    }
  
    const ok = await bcrypt.compare(password, passwordHash);
    if (!ok) {
      throw Object.assign(new Error("Invalid credentials"), { status: 401 });
    }
  
    const user: AuthUser = {
      id: userInstance.id,
      name: userInstance.name,
      email: userInstance.email,
      tenantId: userInstance.companyId,
      admin: Boolean((userInstance as any).admin),
      profile: String((userInstance as any).profile || (Boolean((userInstance as any).admin) ? "admin" : "user"))
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


