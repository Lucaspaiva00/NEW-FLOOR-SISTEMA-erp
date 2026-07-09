const CORES = {
  primaria: "#0f172a",
  muted: "#64748b",
  texto: "#334155",
  borda: "#e2e8f0",
  destaque: "#f8fafc",
};

function escapeHtml(valor: string) {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LOGO_PADRAO =
  "https://res.cloudinary.com/dfdinbti3/image/upload/v1783556030/logo-newfloor_b4hart.png";

export function logoUrlEmail() {
  return process.env.EMAIL_LOGO_URL || LOGO_PADRAO;
}

function layoutEmail({
  titulo,
  conteudo,
  rodapeExtra,
  comLogo = true,
}: {
  titulo: string;
  conteudo: string;
  rodapeExtra?: string;
  comLogo?: boolean;
}) {
  const header = comLogo
    ? `<tr><td align="center" style="background:${CORES.primaria};padding:24px;"><img src="${logoUrlEmail()}" alt="New Floor" width="180" style="display:block;max-width:180px;height:auto;border:0;"></td></tr>`
    : `<tr><td align="center" style="background:${CORES.primaria};padding:24px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">NEW FLOOR</td></tr>`;

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${escapeHtml(titulo)}</title></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;"><tr><td align="center"><table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#fff;border:1px solid ${CORES.borda};border-radius:16px;overflow:hidden;">${header}<tr><td style="padding:28px 32px;color:${CORES.texto};font-size:15px;line-height:1.6;">${conteudo}</td></tr><tr><td style="background:${CORES.destaque};padding:18px 32px;border-top:1px solid ${CORES.borda};color:${CORES.muted};font-size:12px;text-align:center;">${rodapeExtra || "NEW FLOOR Pisos e Revestimentos"}</td></tr></table></td></tr></table></body></html>`;
}

export function templateEmailProposta({
  clienteNome,
  numeroProposta,
  linkDownload,
}: {
  clienteNome: string;
  numeroProposta: string;
  linkDownload: string;
}) {
  const nome = escapeHtml(clienteNome);
  const numero = escapeHtml(numeroProposta);
  const link = escapeHtml(linkDownload);

  return layoutEmail({
    titulo: `Proposta Nº ${numeroProposta}`,
    conteudo: `
      <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:${CORES.primaria};">Proposta Técnica Comercial</p>
      <p style="margin:0 0 20px;color:${CORES.muted};">Olá, <strong>${nome}</strong></p>
      <p style="margin:0 0 12px;">Sua proposta comercial <strong>nº ${numero}</strong> está disponível.</p>
      <p style="margin:0 0 20px;"><a href="${link}" style="display:inline-block;background:${CORES.primaria};color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:10px;">Baixar PDF</a></p>
      <p style="margin:0 0 12px;color:${CORES.muted};font-size:13px;">Link: <a href="${link}">${link}</a></p>
      <p style="margin:0;">Atenciosamente,<br><strong>Equipe NEW FLOOR</strong></p>
    `,
  });
}

export function templateEmailPropostaMinimo({
  clienteNome,
  numeroProposta,
  linkDownload,
}: {
  clienteNome: string;
  numeroProposta: string;
  linkDownload: string;
}) {
  const nome = escapeHtml(clienteNome);
  const numero = escapeHtml(numeroProposta);
  const link = escapeHtml(linkDownload);

  return layoutEmail({
    titulo: `Proposta Nº ${numeroProposta}`,
    comLogo: false,
    conteudo: `
      <p style="margin:0 0 12px;">Olá, <strong>${nome}</strong>.</p>
      <p style="margin:0 0 12px;">Proposta nº <strong>${numero}</strong>.</p>
      <p style="margin:0 0 12px;"><a href="${link}">Baixar proposta em PDF</a></p>
      <p style="margin:0;">Equipe NEW FLOOR</p>
    `,
  });
}

export function textoEmailProposta({
  clienteNome,
  numeroProposta,
  linkDownload,
}: {
  clienteNome: string;
  numeroProposta: string;
  linkDownload: string;
}) {
  return [
    "NEW FLOOR - Proposta Técnica Comercial",
    "",
    `Olá, ${clienteNome}.`,
    "",
    `Sua proposta nº ${numeroProposta} está disponível.`,
    `Baixar PDF: ${linkDownload}`,
    "",
    "Equipe NEW FLOOR",
  ].join("\n");
}

export function templateEmailRecuperacaoSenha(codigo: string) {
  const codigoSeguro = escapeHtml(codigo);

  return layoutEmail({
    titulo: "Recuperação de senha",
    comLogo: false,
    conteudo: `
      <p style="margin:0 0 12px;font-size:20px;font-weight:700;color:${CORES.primaria};">Recuperação de senha</p>
      <p style="margin:0 0 16px;color:${CORES.muted};">Use o código abaixo para redefinir seu acesso.</p>
      <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px;color:${CORES.primaria};">${codigoSeguro}</p>
      <p style="margin:0;color:${CORES.muted};font-size:14px;">Expira em 15 minutos.</p>
    `,
    rodapeExtra: "Mensagem automática do NEW FLOOR ERP.",
  });
}

export function textoEmailRecuperacaoSenha(codigo: string) {
  return [
    "NEW FLOOR - Recuperação de senha",
    "",
    `Seu código: ${codigo}`,
    "",
    "Expira em 15 minutos.",
  ].join("\n");
}
