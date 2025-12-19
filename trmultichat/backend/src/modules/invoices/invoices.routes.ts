import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { findAllSafe } from "../../utils/legacyModel";
import { pgQuery } from "../../utils/pgClient";

const router = Router();

// Financeiro deve ser privado e filtrado por empresa (tenant)
router.use(authMiddleware);

async function isMasterFromAuth(req: any): Promise<boolean> {
  try {
    const userId = Number(req.userId || 0);
    if (!userId) return false;
    const rows = await pgQuery<{ email: string; super?: boolean }>(
      'SELECT email, "super" FROM "Users" WHERE id = $1 LIMIT 1',
      [userId]
    );
    const u = Array.isArray(rows) && rows[0];
    if (!u) return false;
    const email = String((u as any).email || "").toLowerCase();
    const isMasterEmail = email === "thercio@trtecnologias.com.br";
    return Boolean((u as any).super) || isMasterEmail;
  } catch {
    return false;
  }
}

// GET /invoices/admin/companies - lista empresas (para filtros no painel master)
router.get("/admin/companies", async (req, res) => {
  const ok = await isMasterFromAuth(req);
  if (!ok) return res.status(403).json({ error: true, message: "forbidden" });
  try {
    const rows = await pgQuery<{ id: number; name: string; dueDate?: string }>(
      'SELECT id, name, "dueDate" FROM "Companies" WHERE status IS DISTINCT FROM false ORDER BY name ASC'
    );
    return res.json(Array.isArray(rows) ? rows : []);
  } catch {
    return res.json([]);
  }
});

// GET /invoices/admin/all - painel master: todas as faturas de todas as empresas
router.get("/admin/all", async (req, res) => {
  const ok = await isMasterFromAuth(req);
  if (!ok) return res.status(403).json({ error: true, message: "forbidden" });

  const pageNumber = Number(req.query.pageNumber || 1);
  const limitRaw = Number(req.query.limit || 5000);
  const limit = Math.max(1, Math.min(5000, limitRaw));
  const offset = (pageNumber - 1) * limit;

  const companyId = Number(req.query.companyId || 0);
  const q = String(req.query.q || "").trim().toLowerCase();
  const month = String(req.query.month || "").trim(); // "YYYY-MM"
  const status = String(req.query.status || "all").trim().toLowerCase(); // all|paid|open|overdue

  // opcional: gerar faturas futuras para todas as empresas (custo maior)
  const ensureUpcoming = String(req.query.ensureUpcoming || "0") === "1";
  if (ensureUpcoming) {
    try {
      const companies = await pgQuery<{ id: number }>(
        'SELECT id FROM "Companies" WHERE status IS DISTINCT FROM false ORDER BY id ASC LIMIT 2000'
      );
      for (const c of companies || []) {
        // eslint-disable-next-line no-await-in-loop
        await ensureUpcomingInvoicesForCompany(Number((c as any).id || 0), 12);
      }
    } catch {
      // ignore
    }
  }

  try {
    const where: string[] = [];
    const params: any[] = [];

    if (companyId) {
      where.push(`i."companyId" = $${params.length + 1}`);
      params.push(companyId);
    }

    if (q) {
      where.push(`(lower(c.name) LIKE $${params.length + 1} OR lower(i.detail) LIKE $${params.length + 1} OR CAST(i.id AS text) LIKE $${params.length + 1})`);
      params.push(`%${q}%`);
    }

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      where.push(`to_char(i."dueDate"::date, 'YYYY-MM') = $${params.length + 1}`);
      params.push(month);
    }

    if (status === "paid") {
      where.push(`lower(i.status) = 'paid'`);
    } else if (status === "open") {
      where.push(`lower(i.status) <> 'paid' AND i."dueDate"::date >= CURRENT_DATE`);
    } else if (status === "overdue") {
      where.push(`lower(i.status) <> 'paid' AND i."dueDate"::date < CURRENT_DATE`);
    }

    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT
        i.id, i.detail, i.status, i.value, i."createdAt", i."updatedAt", i."dueDate", i."companyId",
        c.name AS "companyName", c.email AS "companyEmail", c.phone AS "companyPhone", c."dueDate" AS "companyDueDate"
      FROM "Invoices" i
      JOIN "Companies" c ON c.id = i."companyId"
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY c.name ASC, i."dueDate" DESC, i.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const rows = await pgQuery<any>(sql, params);
    return res.json(Array.isArray(rows) ? rows : []);
  } catch (e: any) {
    return res.status(200).json([]);
  }
});

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




