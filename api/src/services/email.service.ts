import nodemailer from "nodemailer";
import {
  templateEmailRecuperacaoSenha,
  textoEmailRecuperacaoSenha,
} from "../templates/emailLayout";

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
  html?: string;
  text?: string;
  attachments?: nodemailer.SendMailOptions["attachments"];
}

function isErroFilaSmtp(error: unknown) {
  const err = error as {
    code?: string;
    responseCode?: number;
    response?: string;
  };

  return (
    err?.code === "EMESSAGE" ||
    err?.responseCode === 451 ||
    String(err?.response || "").includes("queue file write error")
  );
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
}: SendEmailOptions): Promise<void> {
  if (!process.env.SMTP_USER?.trim()) {
    throw new Error("SMTP_USER não configurado no .env");
  }

  const from = process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER.trim();
  const tentativas: nodemailer.SendMailOptions[] = [];

  if (html) {
    tentativas.push({
      from: `"NEW FLOOR" <${from}>`,
      to,
      subject,
      html,
      attachments,
    });
  }

  if (text) {
    tentativas.push({
      from: `"NEW FLOOR" <${from}>`,
      to,
      subject,
      text,
    });
  }

  if (!tentativas.length) {
    throw new Error("E-mail sem conteúdo");
  }

  let ultimoErro: unknown;

  for (const mail of tentativas) {
    try {
      await transporter.sendMail(mail);
      return;
    } catch (error) {
      ultimoErro = error;

      if (!isErroFilaSmtp(error)) {
        throw error;
      }

      console.warn("Falha SMTP, tentando formato mais leve:", error);
    }
  }

  throw ultimoErro;
}

export async function enviarCodigoRecuperacaoSenha(
  email: string,
  codigo: string
): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Recuperação de senha - NEW FLOOR",
    text: textoEmailRecuperacaoSenha(codigo),
    html: templateEmailRecuperacaoSenha(codigo),
  });
}
