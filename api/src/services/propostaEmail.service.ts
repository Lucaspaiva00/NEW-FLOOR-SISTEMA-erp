import fs from "fs";
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
}

async function enviarComLink(dados: {
  destinatario: string;
  clienteNome: string;
  numeroProposta: string;
  linkDownload: string;
  assunto: string;
}) {
  await sendEmail({
    to: dados.destinatario,
    subject: dados.assunto,
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
}: EmailProposta): Promise<"anexo" | "link"> {
  const dados = {
    destinatario,
    clienteNome,
    numeroProposta,
    linkDownload,
    assunto,
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
