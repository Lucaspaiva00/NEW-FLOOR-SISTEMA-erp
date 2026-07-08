import path from "path";
import fsSync from "fs";

const CORES = {
  primaria: "#0f172a",
  secundaria: "#1e293b",
  fundo: "#f1f5f9",
  texto: "#334155",
  muted: "#64748b",
  borda: "#e2e8f0",
  destaque: "#f8fafc",
};

let logoBase64Cache: string | null = null;

export function logoSrcEmail(): string {
  if (logoBase64Cache) return logoBase64Cache;

  const caminho = path.join(
    process.cwd(),
    "public",
    "assets",
    "logo-newfloor.png",
  );

  const buffer = fsSync.readFileSync(caminho);
  logoBase64Cache = `data:image/png;base64,${buffer.toString("base64")}`;
  return logoBase64Cache;
}

function layoutEmail({
  titulo,
  conteudo,
  rodapeExtra,
}: {
  titulo: string;
  conteudo: string;
  rodapeExtra?: string;
}) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:${CORES.fundo};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CORES.fundo};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${CORES.borda};border-radius:20px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,0.08);">
          <tr>
            <td align="center" style="background:${CORES.primaria};padding:28px 24px;">
              <img src="${logoSrcEmail()}" alt="New Floor" width="200" style="display:block;max-width:200px;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 28px;color:${CORES.texto};font-size:15px;line-height:1.7;">
              ${conteudo}
            </td>
          </tr>
          <tr>
            <td style="background:${CORES.destaque};padding:22px 40px;border-top:1px solid ${CORES.borda};color:${CORES.muted};font-size:12px;line-height:1.6;text-align:center;">
              <strong style="color:${CORES.primaria};">NEW FLOOR</strong> Pisos e Revestimentos<br>
              ${rodapeExtra || "Este é um e-mail automático. Em caso de dúvidas, responda este contato."}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
  return layoutEmail({
    titulo: `Proposta Nº ${numeroProposta}`,
    conteudo: `
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:${CORES.primaria};">Proposta Técnica Comercial</p>
      <p style="margin:0 0 24px;color:${CORES.muted};">Olá, <strong style="color:${CORES.texto};">${clienteNome}</strong></p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;">
        <tr>
          <td style="background:${CORES.destaque};border:1px solid ${CORES.borda};border-radius:14px;padding:18px 20px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;color:${CORES.muted};text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Proposta comercial</p>
            <p style="margin:0 0 18px;font-size:28px;font-weight:700;color:${CORES.primaria};">Nº ${numeroProposta}</p>
            <a href="${linkDownload}" style="display:inline-block;background:${CORES.primaria};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 28px;border-radius:12px;">Baixar proposta em PDF</a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 16px;color:${CORES.muted};font-size:13px;">Se o botão não funcionar, copie e cole este link no navegador:<br><a href="${linkDownload}" style="color:${CORES.secundaria};word-break:break-all;">${linkDownload}</a></p>
      <p style="margin:0 0 16px;">Agradecemos a oportunidade e permanecemos à disposição para esclarecimentos, ajustes ou visita técnica.</p>
      <p style="margin:0;">Atenciosamente,<br><strong>Equipe NEW FLOOR</strong></p>
    `,
  });
}

export function templateEmailRecuperacaoSenha(codigo: string) {
  return layoutEmail({
    titulo: "Recuperação de senha",
    conteudo: `
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:${CORES.primaria};">Recuperação de senha</p>
      <p style="margin:0 0 24px;color:${CORES.muted};">Use o código abaixo para redefinir seu acesso ao sistema.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
        <tr>
          <td align="center" style="background:${CORES.destaque};border:1px dashed ${CORES.borda};border-radius:14px;padding:22px;">
            <p style="margin:0 0 10px;font-size:12px;color:${CORES.muted};text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Seu código</p>
            <p style="margin:0;font-size:34px;font-weight:700;letter-spacing:8px;color:${CORES.primaria};">${codigo}</p>
          </td>
        </tr>
      </table>
      <p style="margin:0;color:${CORES.muted};font-size:14px;">Este código expira em <strong style="color:${CORES.texto};">15 minutos</strong>. Se você não solicitou esta alteração, ignore este e-mail.</p>
    `,
    rodapeExtra: "Mensagem automática de segurança do NEW FLOOR ERP.",
  });
}
