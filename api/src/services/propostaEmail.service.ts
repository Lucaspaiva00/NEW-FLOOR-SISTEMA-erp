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
}

function nomeAnexoSeguro(numeroProposta: string) {
  return `Proposta-${numeroProposta}.pdf`;
}

async function enviarComLink(dados: {
  destinatario: string;
  clienteNome: string;
  numeroProposta: string;
  linkDownload: string;
}) {
  await sendEmail({
    to: dados.destinatario,
    subject: `Proposta ${dados.numeroProposta} - NEW FLOOR`,
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
}: EmailProposta): Promise<"anexo" | "link"> {
  const dados = { destinatario, clienteNome, numeroProposta, linkDownload };
  const assunto = `Proposta ${numeroProposta} - NEW FLOOR`;
  const pdfBuffer = fs.readFileSync(caminhoPdf);
  const anexo = {
    filename: nomeAnexoSeguro(numeroProposta),
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
