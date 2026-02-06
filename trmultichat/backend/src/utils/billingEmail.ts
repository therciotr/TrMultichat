import { pgQuery } from "./pgClient";
import { getSettingValue, setSettingValue } from "./settingsStore";
import { sendMail } from "./mailer";
import { createSubscriptionPreference } from "../services/mercadoPagoService";
import { getCompanyAccessToken } from "../services/mercadoPagoService";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";

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
  const raw = String(isoLike || "").trim();
  const s = raw.slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  // Fallback: try to parse any date-like string (e.g. "Fri Feb 06 2026 ...")
  try {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = String(d.getFullYear());
      return `${dd}/${mm}/${yyyy}`;
    }
  } catch {}
  return s || raw;
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

function chunkEvery(s: string, size = 48): string[] {
  const str = String(s || "");
  if (!str) return [];
  const out: string[] = [];
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
  return out;
}

function safeDataUrlFromFile(absPath: string, mime = "image/png"): string {
  try {
    const buf = fs.readFileSync(absPath);
    // Avoid extremely large HTML in case of unexpected images
    if (!buf || buf.length < 32 || buf.length > 450_000) return "";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

function paidMethodPt(raw: any) {
  const s = String(raw || "").trim().toLowerCase();
  const map: Record<string, string> = {
    dinheiro: "Dinheiro",
    cash: "Dinheiro",
    pix: "PIX",
    mercadopago: "Mercado Pago",
    mercado_pago: "Mercado Pago",
    card: "Cartão",
    cartao: "Cartão",
    boleto: "Boleto",
    transferencia: "Transferência",
    transfer: "Transferência",
  };
  return map[s] || (s ? s : "-");
}

function interpolate(tpl: string, vars: Record<string, any>) {
  return String(tpl || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
    const v = vars[String(k)] ?? "";
    return String(v);
  });
}

export async function sendPaymentConfirmationEmailForInvoice(opts: {
  masterCompanyId: number;
  invoiceId: number;
  toEmail?: string | null;
  force?: boolean;
}): Promise<{ ok: true; skipped?: boolean; reason?: string } | { ok: false; message: string }> {
  const { masterCompanyId, invoiceId } = opts;
  try {
    await ensureInvoiceEmailLogsSchema();
    const rows = await pgQuery<any>(
      `
        SELECT
          i.id, i.detail, i.status, i.value, i."dueDate", i."companyId",
          i."paidAt", i."paidMethod", i."paidNote",
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

    const statusRaw = String(inv.status || "").toLowerCase();
    if (statusRaw !== "paid") {
      return { ok: false, message: "invoice is not paid" };
    }

    const to = String(opts.toEmail || inv.companyEmail || "").trim();
    if (!to) return { ok: false, message: "company has no email" };

    if (!opts.force) {
      const sent = await alreadySentRecently(Number(inv.id), to, "payment_confirmation", 72);
      if (sent) return { ok: true, skipped: true, reason: "already sent recently" };
    }

    const paidAtIso = inv.paidAt ? String(inv.paidAt) : "";
    const paidAtDate = paidAtIso ? formatDateBR(paidAtIso) : "-";
    const method = paidMethodPt(inv.paidMethod);
    const note = inv.paidNote ? String(inv.paidNote) : "";

    const logoAttachment = await getMasterLogoAttachment(masterCompanyId);
    const logoDataUrl = logoAttachment?.path ? safeDataUrlFromFile(logoAttachment.path, "image/png") : "";

    const subject = `Pagamento confirmado - Fatura #${Number(inv.id)}`;
    const html = `
      <!doctype html>
      <html>
        <body style="margin:0;padding:0;background:#f3f6fb;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f6fb;padding:24px 0;">
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
                  <tr>
                    <td style="padding:18px 22px;background:#2a7b77;">
                      ${
                        logoAttachment
                          ? `<img src="${logoDataUrl || `cid:${logoAttachment.cid}`}" alt="TR Multichat" style="height:54px;max-width:100%;display:block;" />`
                          : `<div style="font-family:Arial,Helvetica,sans-serif;font-size:34px;font-weight:800;color:#ffffff;line-height:1;">Multichat</div>`
                      }
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 22px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;color:#0f172a;margin:0 0 6px 0;">
                        Olá, ${escHtml(String(inv.companyName || "").toUpperCase())},
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#334155;margin:0 0 14px 0;">
                        Confirmamos o recebimento do pagamento da fatura abaixo.
                      </div>

                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;">
                        <tr><td style="padding:14px 14px 0 14px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;">
                            <tr><td style="padding:6px 0;color:#111827;"><strong>Fatura:</strong></td><td align="left" style="padding:6px 0;">&nbsp;#${escHtml(String(inv.id))}</td></tr>
                            <tr><td style="padding:6px 0;color:#111827;"><strong>Descrição:</strong></td><td align="left" style="padding:6px 0;">&nbsp;${escHtml(String(inv.detail || "-"))}</td></tr>
                            <tr><td style="padding:6px 0;color:#111827;"><strong>Valor:</strong></td><td align="left" style="padding:6px 0;">&nbsp;${escHtml(formatBRL(inv.value))}</td></tr>
                            <tr><td style="padding:6px 0;color:#111827;"><strong>Vencimento:</strong></td><td align="left" style="padding:6px 0;">&nbsp;${escHtml(formatDateBR(inv.dueDate))}</td></tr>
                            <tr><td style="padding:6px 0;color:#111827;"><strong>Status:</strong></td><td align="left" style="padding:6px 0;">&nbsp;<span style="color:#15803d;font-weight:800;">Pago</span></td></tr>
                            <tr><td style="padding:6px 0;color:#111827;"><strong>Pago em:</strong></td><td align="left" style="padding:6px 0;">&nbsp;${escHtml(paidAtDate)}</td></tr>
                            <tr><td style="padding:6px 0;color:#111827;"><strong>Método:</strong></td><td align="left" style="padding:6px 0;">&nbsp;${escHtml(method)}</td></tr>
                            ${note ? `<tr><td style="padding:6px 0;color:#111827;"><strong>Obs.:</strong></td><td align="left" style="padding:6px 0;">&nbsp;${escHtml(note)}</td></tr>` : ""}
                          </table>
                        </td></tr>
                        <tr><td style="height:14px;"></td></tr>
                      </table>

                      <div style="height:12px;"></div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#334155;">
                        Obrigado por utilizar o TR Multichat.
                      </div>
                      <div style="height:8px;"></div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#0f172a;">
                        Equipe TR Multichat
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 22px;border-top:1px solid #e5e7eb;background:#f8fafc;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8;text-align:center;">
                        © 2026 TR Tecnologias - Todos os direitos reservados
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const attachments = [...(logoAttachment ? [logoAttachment] : [])];
    await sendMail(
      { to, subject, html, attachments: attachments.length ? attachments : undefined },
      masterCompanyId
    );

    await pgQuery(
      'INSERT INTO "InvoiceEmailLogs" ("invoiceId","companyId","toEmail",kind,subject,"createdAt") VALUES ($1,$2,$3,$4,$5,now())',
      [Number(inv.id), Number(inv.companyId), to, "payment_confirmation", subject]
    );

    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message || "send payment confirmation failed" };
  }
}

async function ensureInvoicePaymentColumns() {
  // Cache payment data on invoices so we don't create multiple MP payments for the same invoice
  await pgQuery('ALTER TABLE "Invoices" ADD COLUMN IF NOT EXISTS "pixCopyPaste" text');
  await pgQuery('ALTER TABLE "Invoices" ADD COLUMN IF NOT EXISTS "pixQrCodeBase64" text');
  await pgQuery('ALTER TABLE "Invoices" ADD COLUMN IF NOT EXISTS "mpPaymentId" text');
  await pgQuery('ALTER TABLE "Invoices" ADD COLUMN IF NOT EXISTS "mpPaymentUrl" text');
}

async function getMasterLogoAttachment(masterCompanyId: number): Promise<{ cid: string; filename: string; path: string; contentType?: string; contentDisposition?: "inline" | "attachment"; publicUrl?: string } | null> {
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
    const base = String(process.env.BACKEND_URL || "https://api.trmultichat.com.br").replace(/\/+$/, "");
    const publicUrl = `${base}${String(logoUrl || "")}`;
    return {
      cid: "trlogo",
      filename: path.basename(abs) || "logo.png",
      path: abs,
      contentType: "image/png",
      contentDisposition: "inline",
      publicUrl
    };
  } catch {
    return null;
  }
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function getPixQrAttachment(opts: {
  invoiceId: number;
  pixCopyPaste: string;
  pixQrCodeBase64?: string;
}): Promise<{ cid: string; filename: string; path: string; contentType?: string; contentDisposition?: "inline" | "attachment"; publicUrl?: string } | null> {
  try {
    const invoiceId = Number(opts.invoiceId || 0);
    if (!invoiceId) return null;

    const outDir = path.join(process.cwd(), "public", "uploads", "billing-email");
    ensureDir(outDir);
    const fileName = `pix-qrcode-${invoiceId}.png`;
    const outPath = path.join(outDir, fileName);
    const base = String(process.env.BACKEND_URL || "https://api.trmultichat.com.br").replace(/\/+$/, "");
    const publicUrl = `${base}/uploads/billing-email/${fileName}`;

    const base64 = String(opts.pixQrCodeBase64 || "").trim();
    if (base64) {
      const cleaned = base64.startsWith("data:")
        ? base64.replace(/^data:image\/\w+;base64,/, "")
        : base64;
      const buf = Buffer.from(cleaned, "base64");
      if (buf.length > 32) {
        fs.writeFileSync(outPath, buf);
        return {
          cid: "pixqr",
          filename: fileName,
          path: outPath,
          contentType: "image/png",
          contentDisposition: "inline",
          publicUrl
        };
      }
    }

    const pix = String(opts.pixCopyPaste || "").trim();
    if (!pix) return null;

    await QRCode.toFile(outPath, pix, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 512,
      type: "png",
    });

    return {
      cid: "pixqr",
      filename: fileName,
      path: outPath,
      contentType: "image/png",
      contentDisposition: "inline",
      publicUrl
    };
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

async function alreadySentRecently(
  invoiceId: number,
  toEmail: string,
  kind: "billing" | "payment_confirmation" = "billing",
  hours = 20
): Promise<boolean> {
  try {
    await ensureInvoiceEmailLogsSchema();
    const rows = await pgQuery<{ c: number }>(
      `
        SELECT COUNT(*)::int as c
        FROM "InvoiceEmailLogs"
        WHERE "invoiceId" = $1
          AND lower("toEmail") = lower($2)
          AND kind = $3
          AND "createdAt" >= (now() - ($4::text || ' hours')::interval)
      `,
      [invoiceId, toEmail, kind, String(hours)]
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
      const sent = await alreadySentRecently(Number(inv.id), to, "billing", 20);
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

    const pixQrAttachment = await getPixQrAttachment({
      invoiceId: Number(inv.id || invoiceId || 0),
      pixCopyPaste,
      pixQrCodeBase64: pixQrCodeBase64 || undefined,
    });
    const pixQrSrc = pixQrAttachment ? `cid:${pixQrAttachment.cid}` : "";

    const varsPay = {
      ...vars,
      pixCopyPaste,
      paymentUrl: mpPaymentUrl,
    };

    const subject = interpolate(cfg.subjectTemplate, varsPay);
    const baseText = interpolate(cfg.bodyTemplate, varsPay);
    const pixLines = pixCopyPaste ? chunkEvery(pixCopyPaste, 48) : [];
    const pixTextBlock = pixLines.length ? pixLines.join("\n") : "";
    const text = [
      baseText,
      "",
      "Pagamento via PIX",
      pixQrAttachment ? "QR Code do PIX: (imagem em anexo)" : "",
      pixCopyPaste ? "PIX copia e cola:" : "",
      pixTextBlock,
      !pixCopyPaste && mpPaymentUrl ? `Link de pagamento: ${mpPaymentUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const logoAttachment = await getMasterLogoAttachment(masterCompanyId);
    // IMPORTANT: don't duplicate the same file twice.
    // Some webmails may drop the CID-part when duplicates exist, causing inline images not to render.
    const attachments = [
      ...(logoAttachment ? [logoAttachment] : []),
      ...(pixQrAttachment ? [pixQrAttachment] : []),
    ];
    const qrPublicUrl = pixQrAttachment?.publicUrl || "";
    const logoPublicUrl = logoAttachment?.publicUrl || "";
    const logoDataUrl = logoAttachment?.path ? safeDataUrlFromFile(logoAttachment.path, "image/png") : "";
    const statusColor = String(vars.status || "").toLowerCase() === "aberto" ? "#d97706" : "#0f172a";
    const pixHtmlLines = pixLines.length ? pixLines.map((l) => escHtml(l)).join("<br/>") : "";
    const html = `
      <!doctype html>
      <html>
        <body style="margin:0;padding:0;background:#f3f6fb;">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
            Cobrança TR Multichat · Fatura #${escHtml(String(vars.invoiceId))}
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f6fb;padding:24px 0;">
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
                  <tr>
                    <td style="padding:18px 22px;background:#2a7b77;">
                      ${
                        logoAttachment
                          ? `<img src="${logoDataUrl || `cid:${logoAttachment.cid}`}" alt="TR Multichat" style="height:54px;max-width:100%;display:block;" />`
                          : `<div style="font-family:Arial,Helvetica,sans-serif;font-size:34px;font-weight:800;color:#ffffff;line-height:1;">Multichat</div>`
                      }
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:18px 22px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;color:#0f172a;margin:0 0 6px 0;">
                        Olá, ${escHtml(String(vars.companyName || "").toUpperCase())},
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#334155;margin:0 0 14px 0;">
                        Segue a cobrança referente ao serviço contratado.
                      </div>

                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;">
                        <tr><td style="padding:14px 14px 0 14px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;">
                            <tr><td style="padding:6px 0;color:#111827;"><strong>Fatura:</strong></td><td align="left" style="padding:6px 0;">&nbsp;#${escHtml(String(vars.invoiceId))}</td></tr>
                            <tr><td style="padding:6px 0;color:#111827;"><strong>Descrição:</strong></td><td align="left" style="padding:6px 0;">&nbsp;${escHtml(String(vars.detail))}</td></tr>
                            <tr><td style="padding:6px 0;color:#111827;"><strong>Valor:</strong></td><td align="left" style="padding:6px 0;">&nbsp;${escHtml(String(vars.value))}</td></tr>
                            <tr><td style="padding:6px 0;color:#111827;"><strong>Vencimento:</strong></td><td align="left" style="padding:6px 0;">&nbsp;${escHtml(String(vars.dueDate))}</td></tr>
                            <tr><td style="padding:6px 0;color:#111827;"><strong>Status:</strong></td><td align="left" style="padding:6px 0;">&nbsp;<span style="color:${statusColor};font-weight:700;">${escHtml(String(vars.status))}</span></td></tr>
                          </table>
                        </td></tr>
                        <tr><td style="height:14px;"></td></tr>
                      </table>

                      <div style="height:14px;"></div>

                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#334155;margin:0 0 10px 0;">
                        Para realizar o pagamento, utilize a opção abaixo:
                      </div>

                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;overflow:hidden;">
                        <tr>
                          <td style="padding:0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td style="padding:12px 14px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;color:#0f172a;">
                                  Pagamento via PIX
                                </td>
                                <td style="padding:12px 14px;background:#f3f4f6;"></td>
                              </tr>
                              <tr>
                                <td style="padding:12px 14px;vertical-align:top;">
                                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;color:#0f172a;margin:0 0 6px 0;">
                                    PIX Copia e Cola:
                                  </div>
                                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111827;line-height:1.5;">
                                    ${pixHtmlLines}
                                  </div>
                                </td>
                                <td style="padding:12px 14px;vertical-align:top;" align="right">
                                  ${
                                    pixQrSrc
                                      ? `<img src="${pixQrSrc}" alt="QR Code PIX" style="width:190px;height:190px;border:1px solid #e5e7eb;border-radius:8px;display:block;background:#fff;" />`
                                      : ""
                                  }
                                  ${
                                    qrPublicUrl
                                      ? `<div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8;text-align:right;">
                                           <a href="${escHtml(qrPublicUrl)}" style="color:#0b4c46;text-decoration:underline;">Abrir QR Code</a>
                                         </div>`
                                      : ""
                                  }
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <div style="height:12px;"></div>

                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#334155;">
                        Caso já tenha realizado o pagamento, desconsidere esta mensagem.
                      </div>

                      <div style="height:8px;"></div>

                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#0f172a;">
                        Equipe TR Multichat
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:14px 22px;border-top:1px solid #e5e7eb;background:#f8fafc;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8;text-align:center;">
                        © 2026 TR Tecnologias - Todos os direitos reservados
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    await sendMail(
      // NOTE: Roundcube may prefer text/plain even when HTML exists.
      // Send HTML-only for billing emails to ensure consistent rendering.
      { to, subject, html, attachments: attachments.length ? attachments : undefined },
      masterCompanyId
    );

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

