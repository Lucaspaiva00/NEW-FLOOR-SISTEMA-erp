import nodemailer from "nodemailer";
import { templateEmailRecuperacaoSenha } from "../templates/emailLayout";

const port = Number(process.env.SMTP_PORT || 465);
const secure = process.env.SMTP_SECURE === "true" || port === 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "email-ssl.com.br",
  port,
  secure,
  ...(port === 587 && { requireTLS: true }),
  auth: {
    user: process.env.SMTP_USER?.trim(),
    pass: process.env.SMTP_PASS,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: nodemailer.SendMailOptions["attachments"];
}

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: SendEmailOptions): Promise<void> {
  if (!process.env.SMTP_USER?.trim()) {
    throw new Error("SMTP_USER não configurado no .env");
  }

  const from = process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER.trim();

  await transporter.sendMail({
    from: `"NEW FLOOR" <${from}>`,
    to,
    subject,
    html,
    attachments,
  });
}

export async function enviarCodigoRecuperacaoSenha(
  email: string,
  codigo: string
): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Recuperação de senha - NEW FLOOR",
    html: templateEmailRecuperacaoSenha(codigo),
  });
}
