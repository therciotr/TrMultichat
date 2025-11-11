import { Router } from "express";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { findAllSafe, getLegacyModel } from "../../utils/legacyModel";

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

// Lista planos disponíveis e o plano atual da empresa (mínimo para UI)
router.get("/listPlan/:id", async (req, res) => {
  const companyId = Number(req.params.id || 0);
  try {
    // Tentativa de ler planos do modelo legado, senão devolve array vazio
    const plans = await findAllSafe("Plan", { order: [["id", "ASC"]] });
    return res.json({ companyId, plans, current: null });
  } catch {
    return res.json({ companyId, plans: [], current: null });
  }
});

// GET /companies - lista empresas do tenant (mínimo)
router.get("/", async (req, res) => {
  try {
    const Company = getLegacyModel("Company");
    if (!Company || typeof Company.findAll !== "function") {
      return res.json([]);
    }
    const rows = await Company.findAll();
    const list = Array.isArray(rows) ? rows.map((r: any) => (r?.toJSON ? r.toJSON() : r)) : [];
    return res.json(list);
  } catch {
    return res.json([]);
  }
});

// GET /companies/:id - detalhes
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const Company = getLegacyModel("Company");
    if (!Company || typeof Company.findByPk !== "function") {
      return res.status(501).json({ error: true, message: "company get not available" });
    }
    const instance = await Company.findByPk(id);
    if (!instance) return res.status(404).json({ error: true, message: "not found" });
    const json = instance?.toJSON ? instance.toJSON() : instance;
    return res.json(json);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "get error" });
  }
});

// POST /companies - criação mínima
router.post("/", async (req, res) => {
  try {
    const Company = getLegacyModel("Company");
    if (!Company || typeof Company.create !== "function") {
      return res.status(501).json({ error: true, message: "company create not available" });
    }
    const tenantId = extractTenantIdFromAuth(req.headers.authorization as string) || 1;
    const body = req.body || {};
    const payload = {
      name: String(body.name || ""),
      planId: body.planId ?? null,
      token: String(body.token || ""),
      id: undefined
    } as any;
    // Se já existir empresa com mesmo nome, retorna a existente (idempotente)
    if (typeof Company.findOne === "function" && payload.name) {
      const existing = await Company.findOne({ where: { name: payload.name } });
      if (existing) {
        const json = existing?.toJSON ? existing.toJSON() : existing;
        return res.status(200).json({ ...json, tenantId });
      }
    }
    // Algumas bases usam companyId nos vínculos, mas o model Company não exige companyId
    const created = await Company.create(payload);
    const json = created?.toJSON ? created.toJSON() : created;
    return res.status(201).json({ ...json, tenantId });
  } catch (e: any) {
    try {
      // Em caso de violação de unicidade, retorna registro existente
      const Company = getLegacyModel("Company");
      if (Company && typeof Company.findOne === "function") {
        const body = req.body || {};
        const name = String(body.name || "");
        if (name) {
          const existing = await Company.findOne({ where: { name } });
          if (existing) {
            const json = existing?.toJSON ? existing.toJSON() : existing;
            return res.status(200).json(json);
          }
        }
      }
    } catch {}
    return res.status(400).json({ error: true, message: e?.message || "create error" });
  }
});

export default router;


