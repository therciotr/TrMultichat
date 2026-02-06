import { pgQuery } from "./pgClient";
import { getSettingValue, setSettingValue } from "./settingsStore";
import { sendMail } from "./mailer";

export type BillingEmailConfig = {
  enabled: boolean;
  autoEnabled: boolean;
  autoTime: string; // "HH:MM"
  daysBefore: number; // 0..30
  includeOverdue: boolean;
  subjectTemplate: string;
  bodyTemplate: string; // plaintext (we also generate html)
};

const DEFAULT_CONFIG: BillingEmailConfig = {
  enabled: false,
  autoEnabled: false,
  autoTime: "09:00",
  daysBefore: 0,
  includeOverdue: true,
  subjectTemplate: "Cobrança - Fatura #{{invoiceId}} (Venc. {{dueDate}})",
  bodyTemplate: [
    "Olá, {{companyName}}!",
    "",
    "Segue a cobrança referente ao TrMultichat:",
    "",
    "- Fatura: #{{invoiceId}}",
    "- Descrição: {{detail}}",
    "- Valor: {{value}}",
    "- Vencimento: {{dueDate}}",
    "- Status: {{status}}",
    "",
    "Para realizar o pagamento, acesse o sistema e vá em Financeiro.",
    "",
    "Atenciosamente,",
    "Equipe TR Multichat",
  ].join("\n"),
};

function boolFromSetting(v: any, fallback = false): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
  if (s === "false" || s === "0" || s === "no" || s === "off") return false;
  return fallback;
}

function numFromSetting(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function safeTime(v: string, fallback = "09:00"): string {
  const s = String(v || "").trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  return fallback;
}

export async function getBillingEmailConfig(masterCompanyId: number): Promise<BillingEmailConfig> {
  const enabled = await getSettingValue(masterCompanyId, "billingEmailEnabled");
  const autoEnabled = await getSettingValue(masterCompanyId, "billingEmailAutoEnabled");
  const autoTime = await getSettingValue(masterCompanyId, "billingEmailAutoTime");
  const daysBefore = await getSettingValue(masterCompanyId, "billingEmailDaysBefore");
  const includeOverdue = await getSettingValue(masterCompanyId, "billingEmailIncludeOverdue");
  const subjectTemplate = await getSettingValue(masterCompanyId, "billingEmailSubjectTemplate");
  const bodyTemplate = await getSettingValue(masterCompanyId, "billingEmailBodyTemplate");

  return {
    enabled: boolFromSetting(enabled, DEFAULT_CONFIG.enabled),
    autoEnabled: boolFromSetting(autoEnabled, DEFAULT_CONFIG.autoEnabled),
    autoTime: safeTime(autoTime || DEFAULT_CONFIG.autoTime, DEFAULT_CONFIG.autoTime),
    daysBefore: clamp(numFromSetting(daysBefore, DEFAULT_CONFIG.daysBefore), 0, 30),
    includeOverdue: boolFromSetting(includeOverdue, DEFAULT_CONFIG.includeOverdue),
    subjectTemplate: String(subjectTemplate || DEFAULT_CONFIG.subjectTemplate),
    bodyTemplate: String(bodyTemplate || DEFAULT_CONFIG.bodyTemplate),
  };
}

export async function saveBillingEmailConfig(masterCompanyId: number, cfg: Partial<BillingEmailConfig>) {
  const merged = { ...(await getBillingEmailConfig(masterCompanyId)), ...(cfg || {}) };
  await setSettingValue(masterCompanyId, "billingEmailEnabled", String(Boolean(merged.enabled)));
  await setSettingValue(masterCompanyId, "billingEmailAutoEnabled", String(Boolean(merged.autoEnabled)));
  await setSettingValue(masterCompanyId, "billingEmailAutoTime", safeTime(String(merged.autoTime || "09:00"), "09:00"));
  await setSettingValue(masterCompanyId, "billingEmailDaysBefore", String(clamp(Number(merged.daysBefore || 0), 0, 30)));
  await setSettingValue(masterCompanyId, "billingEmailIncludeOverdue", String(Boolean(merged.includeOverdue)));
  await setSettingValue(masterCompanyId, "billingEmailSubjectTemplate", String(merged.subjectTemplate || DEFAULT_CONFIG.subjectTemplate));
  await setSettingValue(masterCompanyId, "billingEmailBodyTemplate", String(merged.bodyTemplate || DEFAULT_CONFIG.bodyTemplate));
  return await getBillingEmailConfig(masterCompanyId);
}

function escHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBRL(v: any) {
  const n = Number(v || 0);
  try {
    return n.toLocaleString("pt-br", { style: "currency", currency: "BRL" });
  } catch {
    return `R$ ${n.toFixed(2)}`;
  }
}

function interpolate(tpl: string, vars: Record<string, any>) {
  return String(tpl || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
    const v = vars[String(k)] ?? "";
    return String(v);
  });
}

async function ensureInvoiceEmailLogsSchema() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "InvoiceEmailLogs" (
      id SERIAL PRIMARY KEY,
      "invoiceId" integer NOT NULL,
      "companyId" integer NOT NULL,
      "toEmail" text NOT NULL,
      kind text NOT NULL DEFAULT 'billing',
      subject text NOT NULL DEFAULT '',
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pgQuery('CREATE INDEX IF NOT EXISTS "InvoiceEmailLogs_invoiceId_idx" ON "InvoiceEmailLogs" ("invoiceId")');
  await pgQuery('CREATE INDEX IF NOT EXISTS "InvoiceEmailLogs_companyId_idx" ON "InvoiceEmailLogs" ("companyId")');
  await pgQuery('CREATE INDEX IF NOT EXISTS "InvoiceEmailLogs_createdAt_idx" ON "InvoiceEmailLogs" ("createdAt")');
}

async function alreadySentRecently(invoiceId: number, toEmail: string, hours = 20): Promise<boolean> {
  try {
    await ensureInvoiceEmailLogsSchema();
    const rows = await pgQuery<{ c: number }>(
      `
        SELECT COUNT(*)::int as c
        FROM "InvoiceEmailLogs"
        WHERE "invoiceId" = $1
          AND lower("toEmail") = lower($2)
          AND kind = 'billing'
          AND "createdAt" >= (now() - ($3::text || ' hours')::interval)
      `,
      [invoiceId, toEmail, String(hours)]
    );
    return Number(rows?.[0]?.c || 0) > 0;
  } catch {
    return false;
  }
}

export async function sendBillingEmailForInvoice(opts: {
  masterCompanyId: number;
  invoiceId: number;
  toEmail?: string | null;
  force?: boolean;
}): Promise<{ ok: true; skipped?: boolean; reason?: string } | { ok: false; message: string }> {
  const { masterCompanyId, invoiceId } = opts;
  try {
    const cfg = await getBillingEmailConfig(masterCompanyId);
    if (!cfg.enabled) {
      return {
        ok: false,
        message:
          'Cobrança por e-mail está desativada. Ative em "Financeiro → Cobranças por e-mail (Admin Master)" e clique em "Salvar configurações".',
      };
    }

    const rows = await pgQuery<any>(
      `
        SELECT
          i.id, i.detail, i.status, i.value, i."dueDate", i."companyId",
          c.name as "companyName", c.email as "companyEmail"
        FROM "Invoices" i
        JOIN "Companies" c ON c.id = i."companyId"
        WHERE i.id = $1
        LIMIT 1
      `,
      [invoiceId]
    );
    const inv = rows?.[0];
    if (!inv) return { ok: false, message: "invoice not found" };

    const to = String(opts.toEmail || inv.companyEmail || "").trim();
    if (!to) return { ok: false, message: "company has no email" };

    if (!opts.force) {
      const sent = await alreadySentRecently(Number(inv.id), to, 20);
      if (sent) return { ok: true, skipped: true, reason: "already sent recently" };
    }

    const vars = {
      companyName: String(inv.companyName || ""),
      invoiceId: String(inv.id || ""),
      dueDate: String(inv.dueDate || "").slice(0, 10),
      value: formatBRL(inv.value),
      status: String(inv.status || ""),
      detail: String(inv.detail || ""),
    };
    const subject = interpolate(cfg.subjectTemplate, vars);
    const text = interpolate(cfg.bodyTemplate, vars);
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.45;color:#0f172a;">
        <pre style="white-space:pre-wrap;font-family:inherit;margin:0;">${escHtml(text)}</pre>
      </div>
    `;

    await sendMail({ to, subject, text, html }, masterCompanyId);

    await ensureInvoiceEmailLogsSchema();
    await pgQuery(
      'INSERT INTO "InvoiceEmailLogs" ("invoiceId","companyId","toEmail",kind,subject,"createdAt") VALUES ($1,$2,$3,$4,$5,now())',
      [Number(inv.id), Number(inv.companyId), to, "billing", subject]
    );

    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message || "send billing email failed" };
  }
}

export async function runBillingEmailAuto(masterCompanyId: number): Promise<{ ok: true; sent: number; skipped: number; total: number }> {
  const cfg = await getBillingEmailConfig(masterCompanyId);
  if (!cfg.enabled || !cfg.autoEnabled) return { ok: true, sent: 0, skipped: 0, total: 0 };

  await ensureInvoiceEmailLogsSchema();

  const daysBefore = clamp(Number(cfg.daysBefore || 0), 0, 30);
  const includeOverdue = Boolean(cfg.includeOverdue);
  const dueLimitExpr = `CURRENT_DATE + ($1::int)`;

  // Only open (not paid), for active companies excluding master
  const masterCompanyEnv = Number(process.env.MASTER_COMPANY_ID || masterCompanyId || 1);

  const rows = await pgQuery<any>(
    `
      SELECT
        i.id as "invoiceId",
        i."companyId" as "companyId",
        c.email as "companyEmail"
      FROM "Invoices" i
      JOIN "Companies" c ON c.id = i."companyId"
      WHERE c.status IS DISTINCT FROM false
        AND c.id <> $2
        AND lower(COALESCE(i.status,'')) <> 'paid'
        AND c.email IS NOT NULL
        AND trim(c.email) <> ''
        AND (
          ${includeOverdue ? `i."dueDate"::date <= ${dueLimitExpr}` : `i."dueDate"::date BETWEEN CURRENT_DATE AND ${dueLimitExpr}`}
        )
      ORDER BY i."dueDate" ASC, i.id ASC
      LIMIT 5000
    `,
    [daysBefore, masterCompanyEnv]
  );

  let sent = 0;
  let skipped = 0;
  for (const r of rows || []) {
    // eslint-disable-next-line no-await-in-loop
    const resp = await sendBillingEmailForInvoice({
      masterCompanyId,
      invoiceId: Number(r.invoiceId || 0),
      toEmail: String(r.companyEmail || ""),
      force: false,
    });
    if (!resp.ok) {
      skipped += 1;
      continue;
    }
    if ((resp as any).skipped) {
      skipped += 1;
    } else {
      sent += 1;
    }
  }

  return { ok: true, sent, skipped, total: Array.isArray(rows) ? rows.length : 0 };
}

