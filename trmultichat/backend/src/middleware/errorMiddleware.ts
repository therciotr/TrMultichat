import { Request, Response, NextFunction } from "express";
import env from "../config/env";

export function errorMiddleware(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err?.status || err?.statusCode || 500;
  const message = err?.message || "Internal server error";
  const body: any = { error: true, message };
  if (env.NODE_ENV !== "production" && err?.details) {
    body.details = err.details;
  }
  return res.status(status).json(body);
}
