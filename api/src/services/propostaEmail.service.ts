import type {ContaEmailUsuario} from "./emailUsuario.service";
import fs from "fs";
import type { IdentidadeEmail } from "../templates/emailLayout";
import { sendEmail } from "./email.service";
import {
  templateEmailProposta,
  templateEmailPropostaComAnexo,
  textoEmailProposta,
  textoEmailPropostaComAnexo,
} from "../templates/emailLayout";

interface EmailProposta {
  destinatario: string;
  clienteNome: string;
  numeroProposta: string;
  linkDownload: string;
  caminhoPdf: string;
  nomeArquivoPdf: string;
  assunto: string;
  identidade?: IdentidadeEmail;
  contaUsuario?: ContaEmailUsuario;
}

async function enviarComLink(dados: {
  destinatario: string;
  clienteNome: string;
  numeroProposta: string;
  linkDownload: string;
  assunto: string;
  identidade?: IdentidadeEmail;
  contaUsuario?: ContaEmailUsuario;
}) {
  await sendEmail({
    to: dados.destinatario,
    subject: dados.assunto,
    contaUsuario: dados.contaUsuario,
    copiarAtendimento: dados.identidade ? false : undefined,
    text: textoEmailProposta(dados),
    html: templateEmailProposta(dados),
  });
}

export async function enviarPropostaPorEmail({
  destinatario,
  clienteNome,
  numeroProposta,
  linkDownload,
  caminhoPdf,
  nomeArquivoPdf,
  assunto,
  identidade,
  contaUsuario,
}: EmailProposta): Promise<"anexo" | "link"> {
  if (identidade?.nome === "SBA" && !contaUsuario) {
    throw Object.assign(new Error("Conecte seu e-mail de envio. A SBA não utiliza o remetente de outra empresa."), {statusCode:422});
  }
  const dados = {
    destinatario,
    clienteNome,
    numeroProposta,
    linkDownload,
    assunto,
    identidade,
    contaUsuario,
  };
  const pdfBuffer = fs.readFileSync(caminhoPdf);
  const anexo = {
    filename: nomeArquivoPdf,
    content: pdfBuffer,
    contentType: "application/pdf",
  };

  try {
    await sendEmail({
      to: destinatario,
      subject: assunto,
      contaUsuario,
      copiarAtendimento: identidade ? false : undefined,
      html: templateEmailPropostaComAnexo(dados),
      attachments: [anexo],
    });

    return "anexo";
  } catch (erroTemplateAnexo) {
    console.warn("Falha template+anexo, tentando texto+anexo:", erroTemplateAnexo);

    try {
      await sendEmail({
        to: destinatario,
        subject: assunto,
        contaUsuario,
        copiarAtendimento: identidade ? false : undefined,
        text: textoEmailPropostaComAnexo(dados),
        attachments: [anexo],
      });

      return "anexo";
    } catch (erroTextoAnexo) {
      console.warn("Falha com anexo, enviando por link:", erroTextoAnexo);

      await enviarComLink(dados);
      return "link";
    }
  }
}
