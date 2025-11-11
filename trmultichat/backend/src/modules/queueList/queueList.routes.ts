import { Router } from "express";
import { findAllSafe, getLegacyModel } from "../../utils/legacyModel";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { hasCompanyId } from "../../utils/modelUtils";

const router = Router();

// Same output as GET /queue, used by UI
router.get("/", async (_req, res) => {
  try {
    const auth = (_req.headers.authorization || "").split(" ");
    const bearer = auth.length === 2 && auth[0] === "Bearer" ? auth[1] : undefined;
    let tenantId = 0;
    try {
      const payload = jwt.verify(bearer as string, env.JWT_SECRET) as { tenantId?: number };
      tenantId = Number(payload?.tenantId || 0);
    } catch {}
    const Queue = getLegacyModel("Queue");
    const where = Queue && hasCompanyId(Queue) && tenantId ? { companyId: tenantId } : undefined;
    if (Queue && typeof Queue.findAll === "function") {
      const rows = await Queue.findAll({ where, order: [["id", "ASC"]] });
      const list = Array.isArray(rows) ? rows.map((r: any) => (r?.toJSON ? r.toJSON() : r)) : [];
      return res.json(list);
    }
    const queues = await findAllSafe("Queue", { order: [["id", "ASC"]] });
    return res.json(queues);
  } catch (e) {
    return res.json([]);
  }
});

export default router;


