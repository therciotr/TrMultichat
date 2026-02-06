import { pgQuery } from "./pgClient";
import { getSettingValue, setSettingValue } from "./settingsStore";
import { sendMail } from "./mailer";
import { createSubscriptionPreference } from "../services/mercadoPagoService";
import { getCompanyAccessToken } from "../services/mercadoPagoService";
import fs from "fs";
import path from "path";

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

function formatDateBR(isoLike: any) {
  const s = String(isoLike || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function invoiceStatusPt(raw: any) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  const map: Record<string, string> = {
    open: "Aberto",
    opened: "Aberto",
    pending: "Pendente",
    paid: "Pago",
    overdue: "Vencido",
    expired: "Vencido",
    canceled: "Cancelado",
    cancelled: "Cancelado",
  };
  return map[s] || s;
}

function interpolate(tpl: string, vars: Record<string, any>) {
  return String(tpl || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
    const v = vars[String(k)] ?? "";
    return String(v);
  });
}

async function ensureInvoicePaymentColumns() {
  // Cache payment data on invoices so we don't create multiple MP payments for the same invoice
  await pgQuery('ALTER TABLE "Invoices" ADD COLUMN IF NOT EXISTS "pixCopyPaste" text');
  await pgQuery('ALTER TABLE "Invoices" ADD COLUMN IF NOT EXISTS "pixQrCodeBase64" text');
  await pgQuery('ALTER TABLE "Invoices" ADD COLUMN IF NOT EXISTS "mpPaymentId" text');
  await pgQuery('ALTER TABLE "Invoices" ADD COLUMN IF NOT EXISTS "mpPaymentUrl" text');
}

async function getMasterLogoAttachment(masterCompanyId: number): Promise<{ cid: string; filename: string; path: string; contentType?: string } | null> {
  try {
    // Prefer per-company branding (DB), fallback to default branding path
    let logoUrl: string | null = null;
    try {
      const rows = await pgQuery<any>(
        'SELECT data FROM "CompanyBrandings" WHERE "companyId" = $1 LIMIT 1',
        [Number(masterCompanyId || 0)]
      );
      const data = rows?.[0]?.data;
      if (data && typeof data === "object" && data.logoUrl) logoUrl = String(data.logoUrl);
    } catch {}

    if (!logoUrl) logoUrl = "/uploads/logo-tr.png";
    const rel = String(logoUrl || "").replace(/^\/+/, "");
    const abs = path.join(process.cwd(), "public", rel);
    if (!fs.existsSync(abs)) return null;
    return { cid: "trlogo", filename: path.basename(abs) || "logo.png", path: abs, contentType: "image/png" };
  } catch {
    return null;
  }
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
    await ensureInvoicePaymentColumns();
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
          i."pixCopyPaste", i."pixQrCodeBase64", i."mpPaymentId", i."mpPaymentUrl",
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
      dueDate: formatDateBR(inv.dueDate),
      value: formatBRL(inv.value),
      status: invoiceStatusPt(inv.status),
      detail: String(inv.detail || ""),
    };
    // Ensure we have payment data (PIX copy/paste + QR) for this invoice
    let pixCopyPaste: string = String(inv.pixCopyPaste || "").trim();
    let pixQrCodeBase64: string = String(inv.pixQrCodeBase64 || "").trim();
    let mpPaymentUrl: string = String(inv.mpPaymentUrl || "").trim();
    let mpPaymentId: string = String(inv.mpPaymentId || "").trim();

    if (!pixCopyPaste && !pixQrCodeBase64 && !mpPaymentUrl) {
      // Create MercadoPago PIX payment and cache on invoice
      const payerName = String(inv.companyName || "").trim();
      const parts = payerName.split(/\s+/).filter(Boolean);
      const payerFirstName = parts[0] || "Cliente";
      const payerLastName = parts.slice(1).join(" ");

      // If MercadoPago is configured, we should not send an incomplete email without PIX
      const mpToken = await getCompanyAccessToken(Number(masterCompanyId || 1));
      try {
        const mp = await createSubscriptionPreference({
          companyId: Number(masterCompanyId || 1),
          invoiceId: Number(inv.id || invoiceId || 0),
          price: Number(inv.value || 0),
          users: 0,
          connections: 0,
          payerEmail: to || undefined,
          payerFirstName,
          payerLastName: payerLastName || undefined
        } as any);

        pixCopyPaste = String(mp?.pixCopyPaste || "").trim();
        pixQrCodeBase64 = String(mp?.pixQrCodeBase64 || "").trim();
        mpPaymentUrl = String(mp?.ticketUrl || "").trim();
        mpPaymentId = mp?.paymentId != null ? String(mp.paymentId) : "";

        try {
          await pgQuery(
            'UPDATE "Invoices" SET "pixCopyPaste" = $1, "pixQrCodeBase64" = $2, "mpPaymentId" = $3, "mpPaymentUrl" = $4, "updatedAt" = now() WHERE id = $5',
            [pixCopyPaste || null, pixQrCodeBase64 || null, mpPaymentId || null, mpPaymentUrl || null, Number(inv.id)]
          );
        } catch {}
      } catch (e: any) {
        // If MP is configured but failed, surface the error (don't send incomplete billing email)
        if (mpToken) {
          throw new Error(e?.message || "Falha ao gerar PIX no Mercado Pago");
        }
        // If MP is not configured, still send the billing email without PIX details
      }
    }

    const pixQrSrc =
      pixQrCodeBase64
        ? (pixQrCodeBase64.startsWith("data:") ? pixQrCodeBase64 : `data:image/png;base64,${pixQrCodeBase64}`)
        : "";

    const varsPay = {
      ...vars,
      pixCopyPaste,
      paymentUrl: mpPaymentUrl,
    };

    const subject = interpolate(cfg.subjectTemplate, varsPay);
    const baseText = interpolate(cfg.bodyTemplate, varsPay);
    const text = [
      baseText,
      "",
      "Pagamento via PIX",
      pixCopyPaste ? `PIX copia e cola: ${pixCopyPaste}` : "",
      !pixCopyPaste && mpPaymentUrl ? `Link de pagamento: ${mpPaymentUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const logoAttachment = await getMasterLogoAttachment(masterCompanyId);
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.45;color:#0f172a;background:#ffffff;padding:0;margin:0;">
        <div style="max-width:640px;margin:0 auto;padding:24px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
            ${
              logoAttachment
                ? `<img src="cid:${logoAttachment.cid}" alt="TR Multichat" style="height:44px;max-width:220px;object-fit:contain;" />`
                : `<div style="font-size:18px;font-weight:700;letter-spacing:.2px;color:#0b4c46;">TR Multichat</div>`
            }
          </div>

          <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;background:#f8fafc;">
            <div style="font-size:14px;color:#334155;margin-bottom:10px;"><strong>Cobrança</strong> · Fatura <strong>#${escHtml(String(vars.invoiceId))}</strong></div>
            <table style="width:100%;border-collapse:collapse;font-size:14px;color:#0f172a;">
              <tr><td style="padding:6px 0;color:#64748b;">Empresa</td><td style="padding:6px 0;text-align:right;"><strong>${escHtml(String(vars.companyName))}</strong></td></tr>
              <tr><td style="padding:6px 0;color:#64748b;">Descrição</td><td style="padding:6px 0;text-align:right;">${escHtml(String(vars.detail))}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;">Valor</td><td style="padding:6px 0;text-align:right;"><strong>${escHtml(String(vars.value))}</strong></td></tr>
              <tr><td style="padding:6px 0;color:#64748b;">Vencimento</td><td style="padding:6px 0;text-align:right;"><strong>${escHtml(String(vars.dueDate))}</strong></td></tr>
              <tr><td style="padding:6px 0;color:#64748b;">Status</td><td style="padding:6px 0;text-align:right;">${escHtml(String(vars.status))}</td></tr>
            </table>
          </div>

          <div style="margin-top:16px;border:1px solid #e5e7eb;border-radius:12px;padding:16px;">
            <div style="font-size:15px;font-weight:700;margin-bottom:8px;color:#0b4c46;">Pagamento via PIX</div>
            ${
              pixQrSrc
                ? `<div style="text-align:center;margin:12px 0;">
                     <img src="${pixQrSrc}" alt="QR Code PIX" style="width:220px;height:220px;border-radius:12px;border:1px solid #e5e7eb;" />
                   </div>`
                : ""
            }
            ${
              pixCopyPaste
                ? `<div style="font-size:13px;color:#334155;margin-bottom:8px;">PIX <strong>copia e cola</strong> (copie o código abaixo):</div>
                   <div style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;padding:12px;border-radius:12px;background:#0b1220;color:#e2e8f0;border:1px solid #111827;">${escHtml(pixCopyPaste)}</div>`
                : ""
            }
            ${
              !pixCopyPaste && mpPaymentUrl
                ? `<div style="margin-top:10px;font-size:13px;color:#334155;">Link de pagamento: <a href="${escHtml(mpPaymentUrl)}" style="color:#0b4c46;text-decoration:underline;">${escHtml(mpPaymentUrl)}</a></div>`
                : ""
            }
            <div style="margin-top:12px;font-size:12px;color:#64748b;">
              Se preferir, você também pode acessar o sistema e ir em <strong>Financeiro</strong> para visualizar esta fatura.
            </div>
          </div>

          <div style="margin-top:16px;font-size:12px;color:#94a3b8;">
            <pre style="white-space:pre-wrap;font-family:inherit;margin:0;">${escHtml(baseText)}</pre>
          </div>
        </div>
      </div>
    `;

    const attachments = logoAttachment ? [logoAttachment] : undefined;
    await sendMail({ to, subject, text, html, attachments }, masterCompanyId);

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

