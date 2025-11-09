import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import env from "../config/env";

export interface AuthPayload {
  userId: number | string;
  tenantId: number | string;
  iat?: number;
  exp?: number;
}

declare module "express-serve-static-core" {
  interface Request {
    userId?: number | string;
    tenantId?: number | string;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: true, message: "Unauthorized" });
  }

  const token = authHeader.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    if (!decoded || !decoded.userId || !decoded.tenantId) {
      return res.status(401).json({ error: true, message: "Invalid token" });
    }
    req.userId = decoded.userId;
    req.tenantId = decoded.tenantId;
    return next();
  } catch (err) {
    return res.status(401).json({ error: true, message: "Invalid token" });
  }
}



