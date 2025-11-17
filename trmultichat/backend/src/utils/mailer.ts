import nodemailer from "nodemailer";

type MailOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

function buildTransport() {
  const host = process.env.MAIL_HOST;
  const port = process.env.MAIL_PORT ? Number(process.env.MAIL_PORT) : 587;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  const from = process.env.MAIL_FROM || user;

  if (!host || !from) {
    // eslint-disable-next-line no-console
    console.warn("[mailer] MAIL_HOST/MAIL_FROM not configured; skipping email send.");
    return null;
  }

  const secure = port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined
  });

  return { transporter, from };
}

export async function sendMail(options: MailOptions): Promise<void> {
  const transport = buildTransport();
  if (!transport) return;

  const { transporter, from } = transport;
  try {
    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn("[mailer] sendMail failed:", e?.message || e);
  }
}

export async function sendPasswordResetMail(to: string, link: string): Promise<void> {
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

  await sendMail({ to, subject, text, html });
}


