import { Router } from "express";
import { findAllSafe, findByPkSafe, getLegacyModel } from "../../utils/legacyModel";

const router = Router();

// GET /plans/:id - obter detalhes de um plano específico
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: true, message: "invalid plan id" });
    }

    const plan = await findByPkSafe("Plan", id);
    if (!plan) {
      return res.status(404).json({ error: true, message: "not found" });
    }

    // garantir que a resposta contenha sempre a chave price
    (plan as any).price = (plan as any).price ?? (plan as any).value ?? 0;

    return res.json(plan);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "get error" });
  }
});

// GET /plans/list - lista de planos disponíveis
router.get("/list", async (_req, res) => {
  try {
    const plans = await findAllSafe("Plan", { order: [["id", "ASC"]] });
    const normalized = plans.map((p: any) => ({
      ...p,
      // expõe sempre price, mesmo que o model use "value"
      price: p?.price ?? p?.value ?? 0
    }));
    return res.json(normalized);
  } catch {
    return res.json([]);
  }
});

// Opcional: GET /plans/all (algumas UIs consultam)
router.get("/all", async (_req, res) => {
  try {
    const plans = await findAllSafe("Plan", { order: [["id", "ASC"]] });
    const normalized = plans.map((p: any) => ({
      ...p,
      price: p?.price ?? p?.value ?? 0
    }));
    return res.json(normalized);
  } catch {
    return res.json([]);
  }
});

// POST /plans - criar plano
router.post("/", async (req, res) => {
  try {
    const Plan = getLegacyModel("Plan");
    if (!Plan || typeof Plan.create !== "function") {
      return res.status(501).json({ error: true, message: "plans create not available" });
    }
    const body = req.body || {};
    const numericPrice = Number((body.price ?? body.value) || 0);
    const payload = {
      name: body.name || "",
      users: Number(body.users || 0),
      connections: Number(body.connections || 0),
      // alguns modelos legados usam "useCampaign"/"useSchedule"; mantemos as chaves antigas se existirem
      campaigns: Boolean(body.campaigns),
      schedules: Boolean(body.schedules),
      // gravar sempre no campo esperado pelo model legado
      value: numericPrice
    };
    const created = await Plan.create(payload);
    const json = created?.toJSON ? created.toJSON() : created;
    // garantir que a resposta contenha price
    (json as any).price = (json as any).price ?? (json as any).value ?? numericPrice;
    return res.status(201).json(json);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "create error" });
  }
});

// PUT /plans/:id - atualizar plano
router.put("/:id", async (req, res) => {
  try {
    const Plan = getLegacyModel("Plan");
    if (!Plan || typeof Plan.findByPk !== "function") {
      return res.status(501).json({ error: true, message: "plans update not available" });
    }
    const id = Number(req.params.id);
    const instance = await Plan.findByPk(id);
    if (!instance) return res.status(404).json({ error: true, message: "not found" });
    const body = req.body || {};
    const up: any = {
      name: body.name,
      users: body.users,
      connections: body.connections,
      campaigns: body.campaigns,
      schedules: body.schedules
    };
    // aceitar tanto price quanto value no payload e persistir em "value"
    if (body.price !== undefined || body.value !== undefined) {
      up.value = Number((body.price ?? body.value) || 0);
    }
    await instance.update(up);
    const json = instance?.toJSON ? instance.toJSON() : instance;
    // garantir que a resposta contenha price atualizado
    (json as any).price = (json as any).price ?? (json as any).value ?? up.value ?? 0;
    return res.json(json);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "update error" });
  }
});

// DELETE /plans/:id - remover plano
router.delete("/:id", async (req, res) => {
  try {
    const Plan = getLegacyModel("Plan");
    if (!Plan || typeof Plan.destroy !== "function") {
      return res.status(501).json({ error: true, message: "plans delete not available" });
    }
    const id = Number(req.params.id);
    const count = await Plan.destroy({ where: { id } });
    if (!count) return res.status(404).json({ error: true, message: "not found" });
    return res.status(204).end();
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "delete error" });
  }
});

export default router;


