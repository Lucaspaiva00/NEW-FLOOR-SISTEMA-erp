import { sendEmail } from "./email.service";
import {
  templateEmailProposta,
  templateEmailPropostaMinimo,
  textoEmailProposta,
} from "../templates/emailLayout";

interface EmailProposta {
  destinatario: string;
  clienteNome: string;
  numeroProposta: string;
  linkDownload: string;
}

export async function enviarPropostaPorEmail({
  destinatario,
  clienteNome,
  numeroProposta,
  linkDownload,
}: EmailProposta): Promise<"link"> {
  const dados = { clienteNome, numeroProposta, linkDownload };

  await sendEmail({
    to: destinatario,
    subject: `Proposta Comercial Nº ${numeroProposta} - NEW FLOOR`,
    text: textoEmailProposta(dados),
    html: templateEmailProposta(dados),
  }).catch(async (error) => {
    console.warn("Tentando e-mail mínimo da proposta:", error);

    await sendEmail({
      to: destinatario,
      subject: `Proposta Nº ${numeroProposta} - NEW FLOOR`,
      text: textoEmailProposta(dados),
      html: templateEmailPropostaMinimo(dados),
    });
  });

  return "link";
}
