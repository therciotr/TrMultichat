import { Router } from "express";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import {
  findAllSafe,
  getLegacyModel,
  getSequelize
} from "../../utils/legacyModel";
import {
  validateLicenseForCompany,
  generateLicenseToken,
  validateLicenseForCompanyStrict
} from "../../utils/license";
import { pgQuery } from "../../utils/pgClient";

const router = Router();

type CompanyProfile = {
  personType?: "PF" | "PJ";
  // Identificação
  legalName?: string;      // Razão Social (PJ) / Nome completo (PF)
  tradeName?: string;      // Nome Fantasia (PJ) / Apelido (PF)
  document?: string;       // CPF/CNPJ
  stateRegistration?: string; // IE
  municipalRegistration?: string; // IM
  birthDate?: string;      // PF
  foundationDate?: string; // PJ
  // Contato
  email?: string;
  phone?: string;
  website?: string;
  // Endereço
  address?: {
    zip?: string;
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  // Cobrança
  billingEmail?: string;
  pixKey?: string;
  notes?: string;
};

async function ensureInitialInvoicesForCompany(
  companyId: number,
  planId?: number | null
) {
  if (!companyId) return;
  const masterCompanyId = Number(process.env.MASTER_COMPANY_ID || 1);
  // Empresa master (dona do SaaS) não deve gerar/cobrar faturas
  if (companyId === masterCompanyId) return;
  try {
    // já existem faturas para esta empresa? então não cria duplicadas
    const existing = await pgQuery<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM "Invoices" WHERE "companyId" = $1',
      [companyId]
    );
    const count = existing && existing[0] ? Number(existing[0].count || 0) : 0;
    if (Number.isFinite(count) && count > 0) return;

    // valor base vem do plano, se houver
    let value = 0;
    let planName = "";
    if (planId) {
      try {
        const planRows = await pgQuery<{
          value: number;
          name: string;
        }>('SELECT value, name FROM "Plans" WHERE id = $1 LIMIT 1', [planId]);
        const plan = Array.isArray(planRows) && planRows[0];
        if (plan) {
          value = Number((plan as any).value || 0);
          planName = String((plan as any).name || "");
        }
      } catch {
        // se falhar, continua com value 0
      }
    }

    const today = new Date();

    for (let i = 0; i < 12; i += 1) {
      const d = new Date(today.getTime());
      d.setMonth(d.getMonth() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dueDate = `${yyyy}-${mm}-${dd}`;
      const detail = planName
        ? `Mensalidade - ${planName}`
        : `Mensalidade empresa ${companyId}`;

      // cria fatura "em aberto" para o painel financeiro
      // campos obrigatórios: status, value, createdAt, updatedAt
      // dueDate é texto (varchar)
      // companyId vincula ao tenant
      // eslint-disable-next-line no-await-in-loop
      await pgQuery(
        'INSERT INTO "Invoices" ("detail","status","value","createdAt","updatedAt","dueDate","companyId") VALUES ($1,$2,$3,now(),now(),$4,$5)',
        [detail, "open", value, dueDate, companyId]
      );
    }
  } catch {
    // não bloquear criação de empresa se geração de faturas falhar
  }
}

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

// GET /companies - lista empresas diretamente do Postgres
router.get("/", async (_req, res) => {
  try {
    const rows = await pgQuery<{
      id: number;
      name: string;
      phone?: string;
      email?: string;
      createdAt: string;
      updatedAt: string;
      planId?: number;
      status?: boolean;
      schedules?: any;
      dueDate?: string;
      recurrence?: string;
    }>('SELECT id, name, phone, email, "createdAt", "updatedAt", "planId", status, schedules, "dueDate", recurrence FROM "Companies" WHERE status IS DISTINCT FROM false ORDER BY id ASC');
    return res.json(Array.isArray(rows) ? rows : []);
  } catch {
    return res.json([]);
  }
});

// GET /companies/all - caminho seguro (evita colisão com rotas legadas)
router.get("/all", async (_req, res) => {
  try {
    const list = await findAllSafe("Company", { order: [["id", "ASC"]] });
    return res.json(Array.isArray(list) ? list : []);
  } catch {
    return res.json([]);
  }
});

// GET /companies/list - lista empresas (igual a /companies, mas nome estável para o frontend)
router.get("/list", async (_req, res) => {
  try {
    const rows = await pgQuery<{
      id: number;
      name: string;
      phone?: string;
      email?: string;
      createdAt: string;
      updatedAt: string;
      planId?: number;
      status?: boolean;
      schedules?: any;
      dueDate?: string;
      recurrence?: string;
    }>('SELECT id, name, phone, email, "createdAt", "updatedAt", "planId", status, schedules, "dueDate", recurrence FROM "Companies" WHERE status IS DISTINCT FROM false ORDER BY id ASC');
    return res.json(Array.isArray(rows) ? rows : []);
  } catch {
    return res.json([]);
  }
});

// GET /companies/safe - rota robusta para listagem (fallback definitivo)
router.get("/safe", async (_req, res) => {
  try {
    // Tenta via ORM; se houver hook interferindo (NaN), faz fallback em SQL cru
    try {
      const list = await findAllSafe("Company", { offset: 0, limit: 10000, order: [["id", "ASC"]] });
      if (Array.isArray(list) && list.length >= 0) {
        return res.json(list);
      }
    } catch {}
    const sequelize = getSequelize();
    if (!sequelize || typeof sequelize.query !== "function") {
      return res.json([]);
    }
    const [rows] = await sequelize.query('SELECT id, name, "planId", token FROM "Companies" ORDER BY id ASC LIMIT 10000;');
    return res.json(Array.isArray(rows) ? rows : []);
  } catch {
    return res.json([]);
  }
});

// GET /companies/:id - detalhes (usa Postgres direto para evitar problemas de ORM legado)
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res
        .status(400)
        .json({ error: true, message: "invalid company id" });
    }

    const rows = await pgQuery<{
      id: number;
      name: string;
      planId?: number;
      phone?: string;
      email?: string;
      status?: boolean;
      dueDate?: string;
      recurrence?: string;
    }>('SELECT * FROM "Companies" WHERE id = $1 LIMIT 1', [id]);
    const company = Array.isArray(rows) && rows[0];
    if (!company) {
      return res.status(404).json({ error: true, message: "not found" });
    }
    return res.json(company);
  } catch (e: any) {
    return res
      .status(400)
      .json({ error: true, message: e?.message || "get error" });
  }
});

// PUT /companies/:id - atualizar campos básicos (name, planId, token)
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res
        .status(400)
        .json({ error: true, message: "invalid company id" });
    }

    const body = req.body || {};

    const updates: string[] = [];
    const params: any[] = [];

    if (body.name !== undefined) {
      updates.push(`name = $${updates.length + 1}`);
      params.push(String(body.name));
    }
    if (body.planId !== undefined) {
      updates.push(`"planId" = $${updates.length + 1}`);
      params.push(Number(body.planId));
    }
    if (body.email !== undefined) {
      updates.push(`email = $${updates.length + 1}`);
      params.push(String(body.email));
    }
    if (body.phone !== undefined) {
      updates.push(`phone = $${updates.length + 1}`);
      params.push(String(body.phone));
    }
    if (body.status !== undefined) {
      updates.push(`status = $${updates.length + 1}`);
      params.push(Boolean(body.status));
    }
    if (body.dueDate !== undefined) {
      updates.push(`"dueDate" = $${updates.length + 1}`);
      params.push(body.dueDate);
    }
    if (body.recurrence !== undefined) {
      updates.push(`recurrence = $${updates.length + 1}`);
      params.push(String(body.recurrence));
    }
    // coluna "token" nao existe na tabela Companies em Postgres; ignoramos para nao quebrar

    if (!updates.length) {
      // nada para atualizar
      const current = await pgQuery<{
        id: number;
        name: string;
        phone?: string;
        email?: string;
        createdAt: string;
        updatedAt: string;
        planId?: number;
        status?: boolean;
        schedules?: any;
        dueDate?: string;
        recurrence?: string;
      }>('SELECT id, name, phone, email, "createdAt", "updatedAt", "planId", status, schedules, "dueDate", recurrence FROM "Companies" WHERE id = $1 LIMIT 1', [
        id
      ]);
      const company = Array.isArray(current) && current[0];
      if (!company) {
        return res.status(404).json({ error: true, message: "not found" });
      }
      return res.json(company);
    }

    const setClause = updates.join(", ");
    params.push(id);

    const updated = await pgQuery<{
      id: number;
      name: string;
      phone?: string;
      email?: string;
      createdAt: string;
      updatedAt: string;
      planId?: number;
      status?: boolean;
      schedules?: any;
      dueDate?: string;
      recurrence?: string;
    }>(
      `UPDATE "Companies" SET ${setClause} WHERE id = $${
        updates.length + 1
      } RETURNING id, name, phone, email, "createdAt", "updatedAt", "planId", status, schedules, "dueDate", recurrence`,
      params
    );

    const company = Array.isArray(updated) && updated[0];
    if (!company) {
      return res.status(404).json({ error: true, message: "not found" });
    }
    // Persistir campaignsEnabled em Settings (mantendo comportamento legado)
    const Setting = getLegacyModel("Setting");
    if (
      Setting &&
      (typeof Setting.findOne === "function" ||
        typeof Setting.create === "function")
    ) {
      if (body.campaignsEnabled !== undefined) {
        const value =
          body.campaignsEnabled === true ||
          body.campaignsEnabled === "true" ||
          body.campaignsEnabled === "enabled"
            ? "enabled"
            : "false";
        try {
          let row =
            typeof Setting.findOne === "function"
              ? await Setting.findOne({
                  where: { companyId: id, key: "campaignsEnabled" }
                })
              : null;
          if (row && typeof row.update === "function") {
            await row.update({ value });
          } else if (typeof Setting.create === "function") {
            await Setting.create({ companyId: id, key: "campaignsEnabled", value });
          }
        } catch {}
      }
    }
    return res.json(company);
  } catch (e: any) {
    return res
      .status(400)
      .json({ error: true, message: e?.message || "update error" });
  }
});

// DELETE /companies/:id - remover empresa
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res
        .status(400)
        .json({ error: true, message: "invalid company id" });
    }

    // Em vez de usar o ORM legado (que não está inicializado em produção),
    // fazemos um "soft delete" marcando status = false no Postgres.
    const updated = await pgQuery<{
      id: number;
    }>('UPDATE "Companies" SET status = false WHERE id = $1 RETURNING id', [
      id
    ]);
    const company = Array.isArray(updated) && updated[0];
    if (!company) {
      return res.status(404).json({ error: true, message: "not found" });
    }
    return res.status(204).end();
  } catch (e: any) {
    return res
      .status(400)
      .json({ error: true, message: e?.message || "delete error" });
  }
});

// GET /companies/:id/profile - detalhes estendidos (salvos em Settings como JSON)
router.get("/:id/profile", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: true, message: "invalid company id" });
    const Setting = getLegacyModel("Setting");
    if (!Setting || typeof Setting.findOne !== "function") {
      return res.status(501).json({ error: true, message: "settings not available" });
    }
    const row = await Setting.findOne({ where: { companyId: id, key: "companyProfile" } });
    if (!row) return res.json({ companyId: id, profile: {} as CompanyProfile });
    const plain = row?.toJSON ? row.toJSON() : row;
    let profile: CompanyProfile = {};
    try {
      profile = plain?.value ? JSON.parse(String(plain.value)) : {};
    } catch {
      profile = {};
    }
    return res.json({ companyId: id, profile });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "profile get error" });
  }
});

// PUT /companies/:id/profile - salva detalhes estendidos em Settings (key: companyProfile)
router.put("/:id/profile", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: true, message: "invalid company id" });
    const Setting = getLegacyModel("Setting");
    if (!Setting || typeof Setting.findOne !== "function") {
      return res.status(501).json({ error: true, message: "settings not available" });
    }
    const profile = (req.body && (req.body.profile as CompanyProfile)) || {};
    const value = JSON.stringify(profile || {});
    let row = await Setting.findOne({ where: { companyId: id, key: "companyProfile" } });
    if (row) {
      await row.update({ value });
    } else if (typeof Setting.create === "function") {
      row = await Setting.create({ companyId: id, key: "companyProfile", value });
    }
    return res.json({ ok: true, companyId: id, profile });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "profile save error" });
  }
});

// GET /companies/:id/license - resume da licença (não retorna token)
router.get("/:id/license", async (req, res) => {
  try {
    const id = Number(req.params.id);
    // Fallback: permitir remoção via GET com query (?delete=1 ou ?action=delete)
    const del = String((req.query as any)?.delete || "").trim();
    const act = String((req.query as any)?.action || "").trim().toLowerCase();
    if (del === "1" || act === "delete") {
      const Setting = getLegacyModel("Setting");
      if (!Setting) return res.status(501).json({ error: true, message: "settings not available" });
      let removed = false;
      if (typeof Setting.destroy === "function") {
        try {
          const d = await Setting.destroy({ where: { companyId: id, key: "licenseToken" } });
          removed = d > 0;
        } catch {}
      }
      if (!removed && typeof Setting.findOne === "function") {
        const row = await Setting.findOne({ where: { companyId: id, key: "licenseToken" } });
        if (row && typeof row.update === "function") {
          await row.update({ value: "" });
          removed = true;
        }
      }
      if (!removed && typeof Setting.create === "function") {
        await Setting.create({ companyId: id, key: "licenseToken", value: "" });
      }
      return res.json({ ok: true });
    }
    // Strict: exibe status baseado apenas no token da empresa (sem fallback global)
    const check = await validateLicenseForCompanyStrict(id);
    if (!check.valid) return res.json({ has: check.has, valid: false, error: check.error || "LICENSE_INVALID" });
    const payload = (check as any).payload || {};
    const data = (payload as any).data || {};
    const exp = (payload as any).exp ? Number((payload as any).exp) : undefined;
    return res.json({
      has: check.has,
      valid: true,
      subject: (payload as any).sub || "",
      plan: data.plan || "",
      maxUsers: data.maxUsers || 0,
      exp
    });
  } catch (e: any) {
    return res.status(200).json({ has: false, valid: false, error: e?.message || "error" });
  }
});

// POST /companies - criação mínima (via Postgres, sem depender de Sequelize legado)
router.post("/", async (req, res) => {
  try {
    const tenantId =
      extractTenantIdFromAuth(req.headers.authorization as string) || 1;
    const body = req.body || {};
    const name = String(body.name || "").trim();
    if (!name) {
      return res
        .status(400)
        .json({ error: true, message: "name is required" });
    }

    const planId =
      body.planId !== undefined && body.planId !== null
        ? Number(body.planId)
        : null;
    const email = body.email ? String(body.email) : null;
    const phone = body.phone ? String(body.phone) : null;
    const dueDate = body.dueDate ? String(body.dueDate) : null;
    const recurrence = body.recurrence ? String(body.recurrence) : "";
    const status =
      body.status === undefined || body.status === null
        ? true
        : Boolean(body.status);

    // Se já existir empresa com mesmo nome (case-insensitive)
    const existingRows = await pgQuery<{
      id: number;
      name: string;
      planId?: number;
      status?: boolean;
    }>(
      'SELECT id, name, "planId", status FROM "Companies" WHERE lower(name) = lower($1) LIMIT 1',
      [name]
    );
    const existing = Array.isArray(existingRows) && existingRows[0];

          if (existing) {
      // Se estiver "soft-deleted" (status = false), reativa e atualiza dados básicos
      const isDeleted =
        typeof (existing as any).status === "boolean" &&
        (existing as any).status === false;
      if (isDeleted) {
        const revived = await pgQuery<{
          id: number;
          name: string;
          phone?: string;
          email?: string;
          createdAt: string;
          updatedAt: string;
          planId?: number;
          status?: boolean;
          schedules?: any;
          dueDate?: string;
          recurrence?: string;
        }>(
          'UPDATE "Companies" SET name = $1, phone = $2, email = $3, "planId" = $4, status = true, "dueDate" = $5, recurrence = $6, "updatedAt" = now() WHERE id = $7 RETURNING id, name, phone, email, "createdAt", "updatedAt", "planId", status, schedules, "dueDate", recurrence',
          [
            name,
            phone,
            email,
            planId,
            dueDate,
            recurrence,
            Number((existing as any).id || 0)
          ]
        );
        const revivedCompany = Array.isArray(revived) && revived[0];
        if (revivedCompany) {
          await ensureInitialInvoicesForCompany(
            Number(revivedCompany.id || 0),
            revivedCompany.planId ?? planId
          );
          return res.status(200).json({ ...revivedCompany, tenantId });
        }
      }
      // Empresa ativa com mesmo nome: impede duplicidade
      return res.status(400).json({
        error: true,
        message: "company with this name already exists"
      });
    }

    // Cria nova empresa em Companies
    const inserted = await pgQuery<{
      id: number;
      name: string;
      phone?: string;
      email?: string;
      createdAt: string;
      updatedAt: string;
      planId?: number;
      status?: boolean;
      schedules?: any;
      dueDate?: string;
      recurrence?: string;
    }>(
      'INSERT INTO "Companies" (name, phone, email, "createdAt", "updatedAt", "planId", status, schedules, "dueDate", recurrence) VALUES ($1,$2,$3,now(),now(),$4,$5,$6,$7,$8) RETURNING id, name, phone, email, "createdAt", "updatedAt", "planId", status, schedules, "dueDate", recurrence',
      [name, phone, email, planId, status, JSON.stringify([]), dueDate, recurrence]
    );
    const company = Array.isArray(inserted) && inserted[0];
    if (!company) {
      return res
        .status(400)
        .json({ error: true, message: "company create failed" });
    }

    await ensureInitialInvoicesForCompany(
      Number(company.id || 0),
      company.planId ?? planId
    );
    return res.status(201).json({ ...company, tenantId });
  } catch (e: any) {
    return res
      .status(400)
      .json({ error: true, message: e?.message || "create error" });
  }
});

// PUT /companies/:id/license - salva token em Settings (key: licenseToken)
router.put("/:id/license", async (req, res) => {
  try {
    const id = Number(req.params.id);
    // aceita token no corpo JSON, corpo texto ou query (?token=)
    let token: any = undefined;
    const rawBody = (req as any).body;
    if (rawBody && typeof rawBody === "object" && rawBody.token !== undefined) {
      token = rawBody.token;
    } else if (rawBody && typeof rawBody === "string") {
      token = rawBody;
    } else if (req.query && (req.query as any).token !== undefined) {
      token = (req.query as any).token;
    }
    const Setting = getLegacyModel("Setting");
    if (!Setting || (typeof Setting.findOne !== "function" && typeof Setting.destroy !== "function")) {
      return res.status(501).json({ error: true, message: "settings not available" });
    }
    // Se token vazio, interpretar como remoção (fallback à falta de DELETE em alguns ambientes)
    if (typeof token === "string" && token.trim() === "") {
      try {
        let removed = false;
        if (typeof Setting.destroy === "function") {
          const del = await Setting.destroy({ where: { companyId: id, key: "licenseToken" } });
          removed = del > 0;
        }
        if (!removed && typeof Setting.findOne === "function") {
          const row = await Setting.findOne({ where: { companyId: id, key: "licenseToken" } });
          if (row && typeof row.update === "function") {
            await row.update({ value: "" });
            removed = true;
          }
        }
        if (!removed && typeof Setting.create === "function") {
          // garante ausência de token criando registro vazio
          await Setting.create({ companyId: id, key: "licenseToken", value: "" });
        }
      } catch {}
      return res.json({ ok: true, deleted: true });
    }
    if (!token || typeof token !== "string") return res.status(400).json({ error: true, message: "token is required" });
    let row = await Setting.findOne({ where: { companyId: id, key: "licenseToken" } });
    if (row) {
      await row.update({ value: token });
    } else if (typeof Setting.create === "function") {
      row = await Setting.create({ companyId: id, key: "licenseToken", value: token });
    }
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "license save error" });
  }
});

// DELETE /companies/:id/license - remove token da licença
router.delete("/:id/license", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const Setting = getLegacyModel("Setting");
    if (!Setting) {
      return res.status(501).json({ error: true, message: "settings not available" });
    }
    let ok = false;
    if (typeof Setting.destroy === "function") {
      try {
        await Setting.destroy({ where: { companyId: id, key: "licenseToken" } });
        ok = true;
      } catch (_) {
        ok = false;
      }
    }
    if (!ok && typeof Setting.findOne === "function") {
      const row = await Setting.findOne({ where: { companyId: id, key: "licenseToken" } });
      if (row && typeof row.update === "function") {
        await row.update({ value: "" });
      }
      // se ainda não existir, cria vazio para garantir remoção efetiva
      if (!row && typeof Setting.create === "function") {
        await Setting.create({ companyId: id, key: "licenseToken", value: "" });
      }
    }
    return res.status(204).end();
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "license delete error" });
  }
});

// POST /companies/:id/license/delete - fallback para ambientes que bloqueiam DELETE
router.post("/:id/license/delete", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const Setting = getLegacyModel("Setting");
    if (!Setting) {
      return res.status(501).json({ error: true, message: "settings not available" });
    }
    let removed = false;
    if (typeof Setting.destroy === "function") {
      try {
        const del = await Setting.destroy({ where: { companyId: id, key: "licenseToken" } });
        removed = del > 0;
      } catch (_) {}
    }
    if (!removed && typeof Setting.findOne === "function") {
      const row = await Setting.findOne({ where: { companyId: id, key: "licenseToken" } });
      if (row && typeof row.update === "function") {
        await row.update({ value: "" });
        removed = true;
      }
    }
    if (!removed && typeof Setting.create === "function") {
      await Setting.create({ companyId: id, key: "licenseToken", value: "" });
    }
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "license delete error" });
  }
});

// GET fallback: /companies/:id/license/delete
router.get("/:id/license/delete", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const Setting = getLegacyModel("Setting");
    if (!Setting) {
      return res.status(501).json({ error: true, message: "settings not available" });
    }
    let removed = false;
    if (typeof Setting.destroy === "function") {
      try {
        const del = await Setting.destroy({ where: { companyId: id, key: "licenseToken" } });
        removed = del > 0;
      } catch (_) {}
    }
    if (!removed && typeof Setting.findOne === "function") {
      const row = await Setting.findOne({ where: { companyId: id, key: "licenseToken" } });
      if (row && typeof row.update === "function") {
        await row.update({ value: "" });
        removed = true;
      }
    }
    if (!removed && typeof Setting.create === "function") {
      await Setting.create({ companyId: id, key: "licenseToken", value: "" });
    }
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "license delete error" });
  }
});

// Rotas alternativas (compat/infra): /companies/license/:id
router.delete("/license/:id", async (req, res) => {
  req.params.id = String(req.params.id);
  // delega para rota principal
  return (router as any).handle(req, res, () => res.status(404).end());
});

router.post("/license/:id/delete", async (req, res) => {
  req.params.id = String(req.params.id);
  return (router as any).handle(req, res, () => res.status(404).end());
});

router.put("/license/:id", async (req, res) => {
  req.params.id = String(req.params.id);
  return (router as any).handle(req, res, () => res.status(404).end());
});

// GET global fallback: /companies/license/remove?companyId=#
router.get("/license/remove", async (req, res) => {
  try {
    const id = Number((req.query as any)?.companyId || 0);
    if (!id) return res.status(400).json({ error: true, message: "companyId is required" });
    const Setting = getLegacyModel("Setting");
    if (!Setting) {
      return res.status(501).json({ error: true, message: "settings not available" });
    }
    let removed = false;
    if (typeof Setting.destroy === "function") {
      try {
        const del = await Setting.destroy({ where: { companyId: id, key: "licenseToken" } });
        removed = del > 0;
      } catch (_) {}
    }
    if (!removed && typeof Setting.findOne === "function") {
      const row = await Setting.findOne({ where: { companyId: id, key: "licenseToken" } });
      if (row && typeof row.update === "function") {
        await row.update({ value: "" });
        removed = true;
      }
    }
    if (!removed && typeof Setting.create === "function") {
      await Setting.create({ companyId: id, key: "licenseToken", value: "" });
    }
    return res.json({ ok: true, companyId: id });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "license delete error" });
  }
});

// POST /companies/:id/license/delete - fallback para exclusão (ambientes que bloqueiam DELETE)
router.post("/:id/license/delete", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const Setting = getLegacyModel("Setting");
    if (!Setting) {
      return res.status(501).json({ error: true, message: "settings not available" });
    }
    if (typeof Setting.destroy === "function") {
      try {
        await Setting.destroy({ where: { companyId: id, key: "licenseToken" } });
        return res.json({ ok: true });
      } catch {}
    }
    if (typeof Setting.findOne === "function") {
      const row = await Setting.findOne({ where: { companyId: id, key: "licenseToken" } });
      if (row && typeof row.update === "function") {
        await row.update({ value: "" });
        return res.json({ ok: true });
      }
    }
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "license delete error" });
  }
});

// POST /companies/:id/license/generate - gera token RS256 (requer LICENSE_PRIVATE_KEY)
router.post("/:id/license/generate", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { subject, plan, maxUsers, days = 365, extra } = req.body || {};
    const seconds = Math.max(1, Number(days || 365)) * 24 * 60 * 60;
    const genResult = generateLicenseToken({
      subject: subject || `company:${id}`,
      companyId: id,
      plan,
      maxUsers: Number(maxUsers || 0),
      expiresInSeconds: seconds,
      extra: extra && typeof extra === "object" ? extra : {}
    });
    if (!genResult.ok) return res.status(501).json({ error: true, message: (genResult as any).error || "generate error" });
    return res.json({ token: (genResult as any).token });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "license generate error" });
  }
});

// PUT /companies/:id/mp-access-token - salva Access Token do Mercado Pago
router.put("/:id/mp-access-token", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { token } = req.body || {};
    if (!token || typeof token !== "string") return res.status(400).json({ error: true, message: "token is required" });
    const Setting = getLegacyModel("Setting");
    if (!Setting || typeof Setting.findOne !== "function") {
      return res.status(501).json({ error: true, message: "settings not available" });
    }
    let row = await Setting.findOne({ where: { companyId: id, key: "mpAccessToken" } });
    if (row) {
      await row.update({ value: token });
    } else if (typeof Setting.create === "function") {
      row = await Setting.create({ companyId: id, key: "mpAccessToken", value: token });
    }
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "mp token save error" });
  }
});

// GET /companies/licenses - lista empresas com status da licença
router.get("/licenses", async (_req, res) => {
  try {
    const Company = getLegacyModel("Company");
    if (!Company || typeof Company.findAll !== "function") {
      return res.json([]);
    }
    const rows = await Company.findAll();
    const companies = Array.isArray(rows) ? rows.map((r: any) => (r?.toJSON ? r.toJSON() : r)) : [];
    const list: any[] = [];
    for (const c of companies) {
      const id = Number(c.id);
      const v = await validateLicenseForCompanyStrict(id);
      const payload = (v as any).payload || {};
      const data = (payload as any).data || {};
      const exp = (payload as any).exp ? Number((payload as any).exp) : undefined;
      list.push({
        companyId: id,
        companyName: c.name || `Empresa ${id}`,
        has: v.has,
        valid: v.valid,
        subject: (payload as any).sub || "",
        plan: data.plan || "",
        maxUsers: data.maxUsers || 0,
        exp
      });
    }
    return res.json(list);
  } catch (e: any) {
    return res.status(200).json([]);
  }
});

export default router;


