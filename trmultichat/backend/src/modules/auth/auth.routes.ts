import { Router } from "express";
import * as AuthController from "./auth.controller";
import { licenseMiddleware } from "../../middleware/licenseMiddleware";
import env from "../../config/env";

const router = Router();

if (String(process.env.DEV_MODE || env.DEV_MODE || "false").toLowerCase() === "true") {
  router.post("/login", AuthController.login);
  router.post("/refresh", AuthController.refresh);
  router.post("/refresh_token", AuthController.refreshLegacy);
  router.get("/me", AuthController.me);
} else {
  router.post("/login", licenseMiddleware, AuthController.login);
  router.post("/refresh", AuthController.refresh);
  router.post("/refresh_token", licenseMiddleware, AuthController.refreshLegacy);
  router.get("/me", AuthController.me);
}
router.delete("/logout", (_req, res) => res.status(204).end());

export default router;



