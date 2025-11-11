import { Router } from "express";
import jwt from "jsonwebtoken";
import env from "../../config/env";

const router = Router();

function extractTenantIdFromAuth(authorization?: string): number {
  try {
    const parts = (authorization || "").split(" ");
    const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (!bearer) return 1;
    const payload = jwt.verify(bearer, env.JWT_SECRET) as { tenantId?: number };
    return Number(payload?.tenantId || 1);
  } catch {
    return 1;
  }
}

// No-op endpoints para compatibilidade com UI em produção
router.post("/:id", (req, res) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const socketLib = require("../../libs/socket");
    const getIO = socketLib.getIO || socketLib.default || socketLib;
    const io = getIO();
    const id = Number(req.params.id);
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
    io.emit(`company-${tenantId}-whatsappSession`, {
      action: "update",
      session: { id, status: "qrcode", qrcode: `WA-SESSION:${id}:${Date.now()}`, updatedAt: new Date().toISOString(), retries: 0 }
    });
  } catch {}
  return res.json({ ok: true });
});

router.put("/:id", (req, res) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const socketLib = require("../../libs/socket");
    const getIO = socketLib.getIO || socketLib.default || socketLib;
    const io = getIO();
    const id = Number(req.params.id);
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string);
    io.emit(`company-${tenantId}-whatsappSession`, {
      action: "update",
      session: { id, status: "qrcode", qrcode: `WA-SESSION:${id}:${Date.now()}`, updatedAt: new Date().toISOString(), retries: 1 }
    });
  } catch {}
  return res.json({ ok: true });
});

export default router;


