import nodemailer from "nodemailer";
import { getCompanyMailSettings } from "./settingsMail";
import { getLegacyModel } from "./legacyModel";

type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

type MailOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

function buildFromEnv(): MailConfig | null {
  const host = process.env.MAIL_HOST;
  const port = process.env.MAIL_PORT ? Number(process.env.MAIL_PORT) : 587;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  const from = process.env.MAIL_FROM || user;

  const nodeEnv = String(process.env.NODE_ENV || "").toLowerCase();

  if (!host || !from) {
    const msg =
      "[mailer] MAIL_HOST/MAIL_FROM not configured; skipping email send.";
    // eslint-disable-next-line no-console
    console.warn(msg);
    if (nodeEnv === "production") {
      throw new Error(msg);
    }
    return null;
  }

  const secureEnv = String(process.env.MAIL_SECURE || "").toLowerCase();
  const secure = secureEnv === "true" || (!secureEnv && port === 465);

  // eslint-disable-next-line no-console
  console.info("[mailer] Using GLOBAL SMTP", {
    host,
    port,
    secure,
    user: user ? "***" : undefined,
    from
  });

  return {
    host,
    port,
    secure,
    user: user || undefined,
    pass: pass || undefined,
    from
  };
}

export async function resolveMailConfig(
  companyId?: number
): Promise<MailConfig> {
  if (companyId) {
    const s = await getCompanyMailSettings(companyId);
    if (s.mail_host && s.mail_from) {
      const port = s.mail_port ?? 587;
      const secure =
        typeof s.mail_secure === "boolean"
          ? s.mail_secure
          : (process.env.MAIL_SECURE || "").toLowerCase() === "true" ||
            (!process.env.MAIL_SECURE && port === 465);

      const Setting = getLegacyModel("Setting");
      let pass: string | undefined;
      if (Setting && typeof Setting.findOne === "function") {
        const found = await Setting.findOne({
          where: { companyId, key: "mail_pass" }
        });
        const plain = found?.get ? found.get({ plain: true }) : found;
        pass = plain?.value || undefined;
      }

      // eslint-disable-next-line no-console
      console.info("[mailer] Using COMPANY SMTP", {
        companyId,
        host: s.mail_host,
        port,
        secure,
        user: s.mail_user ? "***" : undefined,
        from: s.mail_from
      });

      return {
        host: s.mail_host,
        port,
        secure,
        user: s.mail_user || undefined,
        pass,
        from: s.mail_from
      };
    }
  }

  const globalCfg = buildFromEnv();
  if (globalCfg) return globalCfg;

  throw new Error("No valid SMTP configuration (company or global)");
}

export async function sendMail(
  options: MailOptions,
  companyId?: number
): Promise<void> {
  const cfg = await resolveMailConfig(companyId);
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined
  });

  try {
    await transporter.sendMail({
      from: cfg.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    });
    // eslint-disable-next-line no-console
    console.info("[mailer] E-mail enviado com sucesso", {
      to: options.to,
      subject: options.subject,
      companyId
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn("[mailer] sendMail failed:", e?.message || e);
    throw e;
  }
}

export async function sendPasswordResetMail(
  to: string,
  link: string,
  companyId?: number
): Promise<void> {
  const subject = "Redefinição de senha - TrMultichat";
  const text = [
    "Você solicitou a redefinição da sua senha no TrMultichat.",
    "",
    "Se foi você, acesse o link abaixo em até 30 minutos:",
    link,
    "",
    "Se você não fez essa solicitação, ignore este e-mail."
  ].join("\n");

  const html = `
    <p>Você solicitou a redefinição da sua senha no <strong>TrMultichat</strong>.</p>
    <p>Se foi você, clique no botão abaixo (ou copie o link) em até <strong>30 minutos</strong>:</p>
    <p>
      <a href="${link}" style="display:inline-block;padding:10px 18px;background:#0b9488;color:#fff;text-decoration:none;border-radius:4px;">
        Redefinir senha
      </a>
    </p>
    <p style="font-size:12px;color:#666;word-break:break-all;">Ou copie e cole este link no navegador:<br>${link}</p>
    <p style="font-size:12px;color:#666;">Se você não fez essa solicitação, apenas ignore este e-mail.</p>
  `;

  await sendMail({ to, subject, text, html }, companyId);
}
