import { sendEmail } from "./email.service";
import { textoEmailProposta } from "../templates/emailLayout";

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
    subject: `Proposta ${numeroProposta} - NEW FLOOR`,
    text: textoEmailProposta(dados),
  });

  return "link";
}
