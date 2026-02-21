import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { deletePushToken, upsertPushToken } from "../../services/pushNotificationService";

const router = Router();

function tenantIdFromReq(req: any): number {
  return Number(req?.tenantId || 0);
}

function userIdFromReq(req: any): number {
  return Number(req?.userId || 0);
}

router.post("/push-token", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  const userId = userIdFromReq(req);
  if (!companyId || !userId) {
    return res.status(401).json({ error: true, message: "missing auth context" });
  }
  const token = String(req.body?.token || "").trim();
  if (!token || token.length < 20) {
    return res.status(400).json({ error: true, message: "invalid token" });
  }
  const platform = String(req.body?.platform || "").trim();
  const deviceId = String(req.body?.deviceId || "").trim();
  const appVersion = String(req.body?.appVersion || "").trim();
  await upsertPushToken({
    companyId,
    userId,
    token,
    platform,
    deviceId: deviceId || null,
    appVersion: appVersion || null
  });
  return res.json({ ok: true });
});

router.delete("/push-token", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  const userId = userIdFromReq(req);
  if (!companyId || !userId) {
    return res.status(401).json({ error: true, message: "missing auth context" });
  }
  const token = String(req.body?.token || req.query?.token || "").trim();
  await deletePushToken({
    companyId,
    userId,
    token: token || null
  });
  return res.json({ ok: true });
});

export default router;
