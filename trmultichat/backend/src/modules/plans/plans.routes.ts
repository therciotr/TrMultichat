import { Router } from "express";
import { findByPkSafe, getLegacyModel } from "../../utils/legacyModel";
import { pgQuery } from "../../utils/pgClient";

const router = Router();

function parseMoneyBR(input: any): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  // aceita "10,00", "10.00", "R$ 10,00", "1.234,56"
  const s = String(input).trim();
  if (!s) return 0;
  const cleaned = s
    .replace(/[^\d,.-]/g, "") // remove moeda e espaços
    .replace(/\.(?=\d{3}(\D|$))/g, "") // remove separador de milhar
    .replace(",", "."); // converte decimal
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

async function getPlansColumns(): Promise<Set<string>> {
  try {
    const rows = await pgQuery<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'Plans'`
    );
    return new Set((rows || []).map((r: any) => String(r.column_name)));
  } catch {
    // fallback: pelo menos as colunas base
    return new Set(["id", "name", "users", "connections", "queues", "value"]);
  }
}

// GET /plans/list - lista de planos disponíveis (via Postgres)
// (registrada ANTES de /:id para não conflitar com /plans/all /plans/list)
router.get("/list", async (_req, res) => {
  try {
    const rows = await pgQuery<{
      id: number;
      name: string;
      users: number;
      connections: number;
      value: number;
    }>('SELECT id, name, users, connections, value FROM "Plans" ORDER BY id ASC');

    const normalized = (rows || []).map((p: any) => ({
      ...p,
      price: p?.price ?? p?.value ?? 0
    }));
    return res.json(normalized);
  } catch {
    return res.json([]);
  }
});

// Opcional: GET /plans/all (algumas UIs consultam) - também via Postgres
router.get("/all", async (_req, res) => {
  try {
    const rows = await pgQuery<{
      id: number;
      name: string;
      users: number;
      connections: number;
      value: number;
    }>('SELECT id, name, users, connections, value FROM "Plans" ORDER BY id ASC');

    const normalized = (rows || []).map((p: any) => ({
      ...p,
      price: p?.price ?? p?.value ?? 0
    }));
    return res.json(normalized);
  } catch {
    return res.json([]);
  }
});

// GET /plans/:id - obter detalhes de um plano específico
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: true, message: "invalid plan id" });
    }

    // Preferencial: Postgres direto (mesma fonte usada por /plans/list e /plans/all)
    try {
      const rows = await pgQuery<any>('SELECT * FROM "Plans" WHERE id = $1 LIMIT 1', [id]);
      const row = Array.isArray(rows) && rows[0];
      if (row) {
        row.price = row.price ?? row.value ?? 0;
        return res.json(row);
      }
    } catch {
      // fallback abaixo
    }

    // Fallback: model legado (Sequelize)
    const plan = await findByPkSafe("Plan", id);
    if (!plan) return res.status(404).json({ error: true, message: "not found" });

    (plan as any).price = (plan as any).price ?? (plan as any).value ?? 0;
    return res.json(plan);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "get error" });
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
    const numericPrice = parseMoneyBR(body.price ?? body.value);
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
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: true, message: "invalid plan id" });
    }
    const body = req.body || {};

    // Preferencial: atualizar direto no Postgres (evita validação errada de "nome duplicado" do ORM legado)
    try {
      const cols = await getPlansColumns();

      const name = body.name !== undefined ? String(body.name || "").trim() : undefined;
      if (name && cols.has("name")) {
        // Checagem de duplicidade (case-insensitive) excluindo o próprio id
        const dup = await pgQuery<{ id: number }>(
          'SELECT id FROM "Plans" WHERE lower(name) = lower($1) AND id <> $2 LIMIT 1',
          [name, id]
        );
        if (Array.isArray(dup) && dup[0]) {
          return res.status(400).json({ error: true, message: "plan name already exists" });
        }
      }

      const updates: string[] = [];
      const params: any[] = [];

      function setCol(col: string, val: any) {
        if (!cols.has(col) || val === undefined) return;
        updates.push(`"${col}" = $${updates.length + 1}`);
        params.push(val);
      }

      // Campos comuns
      setCol("name", name);
      if (body.users !== undefined) setCol("users", Number(body.users || 0));
      if (body.connections !== undefined) setCol("connections", Number(body.connections || 0));
      if (body.queues !== undefined) setCol("queues", Number(body.queues || 0));

      // Valor: persistir sempre em "value" (padrão do schema)
      if (body.price !== undefined || body.value !== undefined) {
        setCol("value", parseMoneyBR(body.price ?? body.value));
      }

      // Flags (apenas se existirem como colunas)
      setCol("useCampaigns", body.useCampaigns);
      setCol("useSchedules", body.useSchedules);
      setCol("useInternalChat", body.useInternalChat);
      setCol("useExternalApi", body.useExternalApi);
      setCol("useKanban", body.useKanban);
      setCol("useOpenAi", body.useOpenAi);
      setCol("useIntegrations", body.useIntegrations);

      if (!updates.length) {
        const rows = await pgQuery<any>('SELECT * FROM "Plans" WHERE id = $1 LIMIT 1', [id]);
        const row = Array.isArray(rows) && rows[0];
        if (!row) return res.status(404).json({ error: true, message: "not found" });
        row.price = row.price ?? row.value ?? 0;
        return res.json(row);
      }

      params.push(id);
      const rows = await pgQuery<any>(
        `UPDATE "Plans" SET ${updates.join(", ")}, "updatedAt" = now() WHERE id = $${updates.length + 1} RETURNING *`,
        params
      );
      const row = Array.isArray(rows) && rows[0];
      if (!row) return res.status(404).json({ error: true, message: "not found" });
      row.price = row.price ?? row.value ?? 0;
      return res.json(row);
    } catch {
      // fallback legado abaixo
    }

    const Plan = getLegacyModel("Plan");
    if (!Plan || typeof Plan.findByPk !== "function") {
      return res.status(501).json({ error: true, message: "plans update not available" });
    }
    const instance = await Plan.findByPk(id);
    if (!instance) return res.status(404).json({ error: true, message: "not found" });
    const up: any = {
      name: body.name,
      users: body.users,
      connections: body.connections,
      campaigns: body.campaigns,
      schedules: body.schedules
    };
    if (body.price !== undefined || body.value !== undefined) {
      up.value = parseMoneyBR(body.price ?? body.value);
    }
    await instance.update(up);
    const json = instance?.toJSON ? instance.toJSON() : instance;
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


