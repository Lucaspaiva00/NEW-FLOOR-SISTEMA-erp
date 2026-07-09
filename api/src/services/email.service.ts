import nodemailer from "nodemailer";
import {
  templateEmailRecuperacaoSenha,
  textoEmailRecuperacaoSenha,
} from "../templates/emailLayout";

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

function usarSomenteTexto() {
  return process.env.EMAIL_SOMENTE_TEXTO === "true";
}

function normalizarAssunto(subject: string) {
  return subject
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

function remetente() {
  return process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER!.trim();
}

function portasSmtp() {
  return [465, 587];
}

function criarTransporter(port: number): nodemailer.Transporter {
  const secure = port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "email-ssl.com.br",
    port,
    secure,
    requireTLS: !secure,
    pool: false,
    auth: {
      user: process.env.SMTP_USER?.trim(),
      pass: process.env.SMTP_PASS,
    },
  } as nodemailer.TransportOptions);
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

  const from = remetente();
  const assunto = normalizarAssunto(subject);
  const somenteTexto = usarSomenteTexto();

  const base = { from, to, subject: assunto, attachments };
  const mensagens: nodemailer.SendMailOptions[] = [];

  if (html && !somenteTexto) {
    mensagens.push({ ...base, html });
  }

  if (text) {
    mensagens.push({ ...base, text, encoding: "7bit" });
  }

  if (!mensagens.length) {
    throw new Error("E-mail sem conteúdo");
  }

  let ultimoErro: unknown;

  for (const porta of portasSmtp()) {
    const transporter = criarTransporter(porta);

    for (const mail of mensagens) {
      try {
        await transporter.sendMail(mail);
        return;
      } catch (error) {
        ultimoErro = error;

        if (!isErroFilaSmtp(error)) {
          throw error;
        }

        console.warn(
          `Falha SMTP (porta ${porta}), tentando alternativa:`,
          error
        );
      }
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
    subject: "Recuperacao de senha - NEW FLOOR",
    text: textoEmailRecuperacaoSenha(codigo),
    html: templateEmailRecuperacaoSenha(codigo),
  });
}
