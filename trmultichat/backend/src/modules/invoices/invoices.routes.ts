import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { findAllSafe } from "../../utils/legacyModel";
import { pgQuery } from "../../utils/pgClient";
import { renewCompanyLicenseFromDueDate } from "../../utils/license";
import { getBillingEmailConfig, runBillingEmailAuto, saveBillingEmailConfig, sendBillingEmailForInvoice } from "../../utils/billingEmail";

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

async function ensureInvoicesAdminColumns() {
  // Idempotente: adiciona colunas extras para controle administrativo
  try {
    await pgQuery('ALTER TABLE "Invoices" ADD COLUMN IF NOT EXISTS "originalValue" numeric');
    await pgQuery('ALTER TABLE "Invoices" ADD COLUMN IF NOT EXISTS "discountValue" numeric');
    await pgQuery('ALTER TABLE "Invoices" ADD COLUMN IF NOT EXISTS "paidAt" timestamptz');
    await pgQuery('ALTER TABLE "Invoices" ADD COLUMN IF NOT EXISTS "paidMethod" text');
    await pgQuery('ALTER TABLE "Invoices" ADD COLUMN IF NOT EXISTS "paidNote" text');
  } catch {
    // ignore
  }
}

// GET /invoices/admin/companies - lista empresas (para filtros no painel master)
router.get("/admin/companies", async (req, res) => {
  const ok = await isMasterFromAuth(req);
  if (!ok) return res.status(403).json({ error: true, message: "forbidden" });
  try {
    const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
    const rows = await pgQuery<{ id: number; name: string; dueDate?: string }>(
      'SELECT id, name, "dueDate" FROM "Companies" WHERE status IS DISTINCT FROM false AND id <> $1 ORDER BY name ASC',
      [masterCompanyId]
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
  const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
  await ensureInvoicesAdminColumns();

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
        'SELECT id FROM "Companies" WHERE status IS DISTINCT FROM false AND id <> $1 ORDER BY id ASC LIMIT 2000',
        [masterCompanyId]
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
        i."originalValue", i."discountValue", i."paidAt", i."paidMethod", i."paidNote",
        c.name AS "companyName", c.email AS "companyEmail", c.phone AS "companyPhone", c."dueDate" AS "companyDueDate"
      FROM "Invoices" i
      JOIN "Companies" c ON c.id = i."companyId"
      ${where.length
        ? `WHERE ${where.join(" AND ")} AND c.status IS DISTINCT FROM false AND c.id <> ${masterCompanyId}`
        : `WHERE c.status IS DISTINCT FROM false AND c.id <> ${masterCompanyId}`}
      ORDER BY c.name ASC, i."dueDate" DESC, i.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const rows = await pgQuery<any>(sql, params);
    return res.json(Array.isArray(rows) ? rows : []);
  } catch (e: any) {
    return res.status(200).json([]);
  }
});

// ===== Billing by e-mail (MASTER only) =====
router.get("/admin/billing-email-config", async (req, res) => {
  const ok = await isMasterFromAuth(req);
  if (!ok) return res.status(403).json({ error: true, message: "forbidden" });
  try {
    const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
    const cfg = await getBillingEmailConfig(masterCompanyId);
    return res.json({ ok: true, config: cfg });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "get config error" });
  }
});

router.put("/admin/billing-email-config", async (req, res) => {
  const ok = await isMasterFromAuth(req);
  if (!ok) return res.status(403).json({ error: true, message: "forbidden" });
  try {
    const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
    const cfg = await saveBillingEmailConfig(masterCompanyId, req.body || {});
    return res.json({ ok: true, config: cfg });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "save config error" });
  }
});

// Send billing e-mail for a single invoice
router.post("/admin/:id/send-email", async (req, res) => {
  const ok = await isMasterFromAuth(req);
  if (!ok) return res.status(403).json({ error: true, message: "forbidden" });
  try {
    const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: true, message: "invalid invoice id" });
    const toEmail = req.body?.toEmail ? String(req.body.toEmail) : null;
    const force = Boolean(req.body?.force);
    const r = await sendBillingEmailForInvoice({ masterCompanyId, invoiceId: id, toEmail, force });
    if (!r.ok) return res.status(400).json({ error: true, message: (r as any).message || "send error" });
    return res.json(r);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "send email error" });
  }
});

// Manual run (same as auto), useful for immediate dispatch
router.post("/admin/billing-email/run-now", async (req, res) => {
  const ok = await isMasterFromAuth(req);
  if (!ok) return res.status(403).json({ error: true, message: "forbidden" });
  try {
    const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
    const r = await runBillingEmailAuto(masterCompanyId);
    return res.json(r);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "run error" });
  }
});

// PATCH /invoices/admin/:id/manual-settlement
// Permite ao master: aplicar desconto (ajustar value) e/ou marcar como pago manualmente.
router.patch("/admin/:id/manual-settlement", async (req, res) => {
  const ok = await isMasterFromAuth(req);
  if (!ok) return res.status(403).json({ error: true, message: "forbidden" });

  const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
  await ensureInvoicesAdminColumns();

  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ error: true, message: "invalid invoice id" });

  const body = req.body || {};
  const markPaid = Boolean(body.markPaid);
  const paidMethod = body.paidMethod ? String(body.paidMethod) : null;
  const paidNote = body.paidNote ? String(body.paidNote) : null;

  const discountValueRaw = body.discountValue;
  const discountValue =
    discountValueRaw === undefined || discountValueRaw === null || discountValueRaw === ""
      ? null
      : Number(discountValueRaw);

  try {
    // Carregar fatura + empresa
    const invRows = await pgQuery<any>(
      'SELECT * FROM "Invoices" WHERE id = $1 LIMIT 1',
      [id]
    );
    const inv = Array.isArray(invRows) && invRows[0];
    if (!inv) return res.status(404).json({ error: true, message: "invoice not found" });

    const companyId = Number(inv.companyId || 0);
    if (companyId === masterCompanyId) {
      return res.status(400).json({ error: true, message: "master company is exempt" });
    }

    const currentValue = Number(inv.value || 0);
    const currentStatus = String(inv.status || "").toLowerCase();

    // Aplicar desconto: value := value - desconto (mínimo 0)
    let newValue = currentValue;
    let appliedDiscount: number | null = null;
    if (discountValue !== null) {
      if (!Number.isFinite(discountValue) || discountValue < 0) {
        return res.status(400).json({ error: true, message: "invalid discountValue" });
      }
      appliedDiscount = Math.min(discountValue, currentValue);
      newValue = Math.max(0, currentValue - appliedDiscount);
    }

    // Se for marcar como pago, status = paid + paidAt now
    const nextStatus = markPaid ? "paid" : (inv.status || "open");

    // Guardar originalValue apenas na primeira vez
    const originalValue = inv.originalValue !== null && inv.originalValue !== undefined
      ? Number(inv.originalValue)
      : currentValue;

    const updates: string[] = [];
    const params: any[] = [];
    function set(col: string, val: any) {
      updates.push(`"${col}" = $${updates.length + 1}`);
      params.push(val);
    }

    if (appliedDiscount !== null) {
      set("originalValue", originalValue);
      set("discountValue", appliedDiscount);
      set("value", newValue);
    }

    if (markPaid && currentStatus !== "paid") {
      set("status", "paid");
      set("paidAt", new Date().toISOString());
      if (paidMethod) set("paidMethod", paidMethod);
      if (paidNote) set("paidNote", paidNote);
    } else {
      // mesmo sem marcar pago, pode salvar obs/método se enviados
      if (paidMethod) set("paidMethod", paidMethod);
      if (paidNote) set("paidNote", paidNote);
    }

    set("updatedAt", new Date().toISOString());

    params.push(id);
    const rows = await pgQuery<any>(
      `UPDATE "Invoices" SET ${updates.join(", ")} WHERE id = $${updates.length + 1} RETURNING *`,
      params
    );
    const row = Array.isArray(rows) && rows[0];
    // Se marcou como pago, também renova token de licença para manter sincronia com pagamento.
    if (markPaid && companyId) {
      try {
        // 1) Estender dueDate em +30d (mesma regra do webhook)
        const compRows = await pgQuery<{ dueDate?: string | null }>('SELECT "dueDate" FROM "Companies" WHERE id = $1 LIMIT 1', [companyId]);
        const comp = Array.isArray(compRows) && compRows[0];
        const current = comp ? (comp as any).dueDate : null;
        const base = current ? new Date(String(current)) : new Date();
        if (!Number.isNaN(base.getTime())) {
          base.setDate(base.getDate() + 30);
          const nextDue = base.toISOString().split("T")[0];
          await pgQuery('UPDATE "Companies" SET "dueDate" = $1, "updatedAt" = now() WHERE id = $2', [nextDue, companyId]);
          // 2) Renovar token (se houver chave privada) - e/ou será válido por dueDate
          await renewCompanyLicenseFromDueDate(companyId, nextDue);
        } else {
          await renewCompanyLicenseFromDueDate(companyId, null);
        }
      } catch {
        // ignore
      }
    }
    return res.json(row || { ok: true, status: nextStatus, value: newValue });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "manual settlement error" });
  }
});

async function ensureUpcomingInvoicesForCompany(companyId: number, monthsAhead = 12) {
  if (!companyId) return;
  const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
  // Empresa master (dona do SaaS) não deve gerar/cobrar faturas
  if (companyId === masterCompanyId) return;
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
      const monthKey = `${yyyy}-${mm}`;

      // Regra: 1 fatura por empresa por mês (evita duplicação por dias diferentes).
      // Se já existir mais de uma no mês, remove duplicadas (mantém a mais recente;
      // se houver uma paga, mantém a paga).
      // eslint-disable-next-line no-await-in-loop
      const existing = await pgQuery<{ id: number; status?: string; dueDate?: string }>(
        'SELECT id, status, "dueDate" FROM "Invoices" WHERE "companyId" = $1 AND substring("dueDate", 1, 7) = $2 ORDER BY id DESC',
        [companyId, monthKey]
      );
      if (Array.isArray(existing) && existing.length > 1) {
        const paid = existing.find((x: any) => String(x.status || "").toLowerCase() === "paid");
        const keepId = paid ? Number((paid as any).id) : Number((existing[0] as any).id);
        const toDelete = existing
          .filter((x: any) => Number(x.id) !== keepId)
          .map((x: any) => Number(x.id))
          .filter((n: any) => Number.isFinite(n) && n > 0);
        if (toDelete.length) {
          // eslint-disable-next-line no-await-in-loop
          await pgQuery('DELETE FROM "Invoices" WHERE id = ANY($1::int[])', [toDelete]);
        }
      }
      if (Array.isArray(existing) && existing.length >= 1) {
        continue;
      }

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
      const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
      // Empresa master não deve ter cobrança/visão de faturas (dona do SaaS)
      if (companyId === masterCompanyId) {
        return res.json([]);
      }
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




