import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { findAllSafe } from "../../utils/legacyModel";
import { pgQuery } from "../../utils/pgClient";

const router = Router();

// Financeiro deve ser privado e filtrado por empresa (tenant)
router.use(authMiddleware);

async function ensureUpcomingInvoicesForCompany(companyId: number, monthsAhead = 12) {
  if (!companyId) return;
  const months = Math.max(1, Math.min(36, Number(monthsAhead || 12)));
  try {
    // Obter plano atual da empresa
    const compRows = await pgQuery<{ planId?: number }>(
      'SELECT "planId" FROM "Companies" WHERE id = $1 LIMIT 1',
      [companyId]
    );
    const comp = Array.isArray(compRows) && compRows[0];
    const planId = comp ? Number((comp as any).planId || 0) : 0;
    if (!planId) return;

    // Obter valor/nome do plano
    const planRows = await pgQuery<{ value?: number; name?: string }>(
      'SELECT value, name FROM "Plans" WHERE id = $1 LIMIT 1',
      [planId]
    );
    const plan = Array.isArray(planRows) && planRows[0];
    const value = plan ? Number((plan as any).value || 0) : 0;
    const planName = plan ? String((plan as any).name || "") : "";
    if (!Number.isFinite(value) || value <= 0) return;

    const today = new Date();
    for (let i = 0; i < months; i += 1) {
      const d = new Date(today.getTime());
      d.setMonth(d.getMonth() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dueDate = `${yyyy}-${mm}-${dd}`;

      // Já existe fatura para esse vencimento?
      // eslint-disable-next-line no-await-in-loop
      const exists = await pgQuery<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM "Invoices" WHERE "companyId" = $1 AND "dueDate" = $2',
        [companyId, dueDate]
      );
      const count = exists && exists[0] ? Number(exists[0].count || 0) : 0;
      if (count > 0) continue;

      const detail = planName ? `Mensalidade - ${planName}` : `Mensalidade empresa ${companyId}`;
      // eslint-disable-next-line no-await-in-loop
      await pgQuery(
        'INSERT INTO "Invoices" ("detail","status","value","createdAt","updatedAt","dueDate","companyId") VALUES ($1,$2,$3,now(),now(),$4,$5)',
        [detail, "open", value, dueDate, companyId]
      );
    }
  } catch {
    // não bloquear listagem por falha na geração
  }
}

// PATCH /invoices/:id/sync-plan-value
// Sincroniza o valor da fatura (em aberto) com o valor do plano atual da empresa logada.
router.patch("/:id/sync-plan-value", async (req, res) => {
  const companyId = Number((req as any).tenantId || 0);
  const id = Number(req.params.id || 0);
  if (!companyId) return res.status(400).json({ error: true, message: "missing tenantId" });
  if (!id) return res.status(400).json({ error: true, message: "invalid invoice id" });

  try {
    const invRows = await pgQuery<{ id: number; status?: string; value?: number; companyId: number }>(
      'SELECT id, status, value, "companyId" FROM "Invoices" WHERE id = $1 AND "companyId" = $2 LIMIT 1',
      [id, companyId]
    );
    const inv = Array.isArray(invRows) && invRows[0];
    if (!inv) return res.status(404).json({ error: true, message: "invoice not found" });
    const status = String((inv as any).status || "").toLowerCase();
    if (status === "paid") {
      return res.status(400).json({ error: true, message: "invoice already paid" });
    }

    const compRows = await pgQuery<{ planId?: number }>(
      'SELECT "planId" FROM "Companies" WHERE id = $1 LIMIT 1',
      [companyId]
    );
    const comp = Array.isArray(compRows) && compRows[0];
    const planId = comp ? Number((comp as any).planId || 0) : 0;
    if (!planId) {
      return res.status(400).json({ error: true, message: "company has no planId" });
    }

    const planRows = await pgQuery<{ value?: number }>(
      'SELECT value FROM "Plans" WHERE id = $1 LIMIT 1',
      [planId]
    );
    const plan = Array.isArray(planRows) && planRows[0];
    const planValue = plan ? Number((plan as any).value || 0) : 0;
    if (!Number.isFinite(planValue) || planValue <= 0) {
      return res.status(400).json({ error: true, message: "invalid plan value" });
    }

    const updatedRows = await pgQuery<any>(
      'UPDATE "Invoices" SET value = $1, "updatedAt" = now() WHERE id = $2 AND "companyId" = $3 RETURNING id, detail, status, value, "createdAt", "updatedAt", "dueDate", "companyId"',
      [planValue, id, companyId]
    );
    const updated = Array.isArray(updatedRows) && updatedRows[0];
    return res.json(updated || { ok: true, value: planValue });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "sync error" });
  }
});

// GET /invoices/all?searchParam=&pageNumber=1
router.get("/all", async (req, res) => {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 200;
  const offset = (pageNumber - 1) * limit;
  const companyId = Number((req as any).tenantId || 0);
  try {
    // Garante que existam faturas futuras (para o cliente poder adiantar)
    if (companyId && Number.isFinite(companyId)) {
      await ensureUpcomingInvoicesForCompany(companyId, 12);
    }

    // Preferencial: Postgres direto (mais confiável em produção)
    if (companyId && Number.isFinite(companyId)) {
      const rows = await pgQuery<{
        id: number;
        detail: string;
        status: string;
        value: number;
        createdAt: string;
        updatedAt: string;
        dueDate: string;
        companyId: number;
      }>(
        'SELECT id, detail, status, value, "createdAt", "updatedAt", "dueDate", "companyId" FROM "Invoices" WHERE "companyId" = $1 ORDER BY "dueDate" DESC, id DESC LIMIT $2 OFFSET $3',
        [companyId, limit, offset]
      );
      return res.json(Array.isArray(rows) ? rows : []);
    }

    // Fallback: ORM legado (se tenantId não estiver disponível por algum motivo)
    const invoices = await findAllSafe("Invoices", {
      offset,
      limit,
      order: [["id", "DESC"]]
    });
    return res.json(Array.isArray(invoices) ? invoices : []);
  } catch {
    // Fallback mais permissivo: tentar ORM legado filtrando por companyId quando possível
    try {
      const invoices = await findAllSafe("Invoices", {
        offset,
        limit,
        order: [["id", "DESC"]],
        ...(companyId ? { where: { companyId } } : {})
      });
      return res.json(Array.isArray(invoices) ? invoices : []);
    } catch {
      return res.json([]);
    }
  }
});

export default router;




