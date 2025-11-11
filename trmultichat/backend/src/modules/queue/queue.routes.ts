import { Router } from "express";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { findAllSafe, getLegacyModel } from "../../utils/legacyModel";

const router = Router();

router.get("/", async (_req, res) => {
  const queues = await findAllSafe("Queue", { order: [["id", "ASC"]] });
  return res.json(queues);
});

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

// Minimal CRUD to support queue create/update/delete in produção
router.post("/", async (req, res) => {
  try {
    const Queue = getLegacyModel("Queue");
    if (!Queue || typeof Queue.create !== "function") {
      return res.status(501).json({ error: true, message: "queue create not available" });
    }
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string) || 1;
    const body = req.body || {};
    const payload = {
      name: String(body.name ?? ""),
      color: String(body.color ?? "#0B4C46"),
      greetingMessage: String(body.greetingMessage ?? ""),
      outOfHoursMessage: String(body.outOfHoursMessage ?? ""),
      orderQueue: String(body.orderQueue ?? ""),
      integrationId: String(body.integrationId ?? ""),
      promptId: body.promptId ?? null,
      companyId: tenantId
    };
    const created = await Queue.create(payload);
    const json = created?.toJSON ? created.toJSON() : created;
    return res.status(201).json(json);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "create error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const Queue = getLegacyModel("Queue");
    if (!Queue || typeof Queue.findByPk !== "function") {
      return res.status(501).json({ error: true, message: "queue get not available" });
    }
    const instance = await Queue.findByPk(id);
    if (!instance) return res.status(404).json({ error: true, message: "not found" });
    const json = instance?.toJSON ? instance.toJSON() : instance;
    return res.json(json);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "get error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const Queue = getLegacyModel("Queue");
    if (!Queue || typeof Queue.findByPk !== "function") {
      return res.status(501).json({ error: true, message: "queue update not available" });
    }
    const instance = await Queue.findByPk(id);
    if (!instance) return res.status(404).json({ error: true, message: "not found" });
    const body = req.body || {};
    const up = {
      name: body.name,
      color: body.color,
      greetingMessage: body.greetingMessage,
      outOfHoursMessage: body.outOfHoursMessage,
      orderQueue: body.orderQueue,
      integrationId: body.integrationId,
      promptId: body.promptId
    };
    await instance.update(up);
    const json = instance?.toJSON ? instance.toJSON() : instance;
    return res.json(json);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "update error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const Queue = getLegacyModel("Queue");
    if (!Queue || typeof Queue.destroy !== "function") {
      return res.status(501).json({ error: true, message: "queue delete not available" });
    }
    const count = await Queue.destroy({ where: { id } });
    if (!count) return res.status(404).json({ error: true, message: "not found" });
    return res.status(204).end();
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "delete error" });
  }
});

export default router;





