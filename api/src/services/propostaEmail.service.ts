import { sendEmail } from "./email.service";
import { templateEmailProposta } from "../templates/emailLayout";

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
  await sendEmail({
    to: destinatario,
    subject: `Proposta Técnica Comercial Nº ${numeroProposta}`,
    html: templateEmailProposta({
      clienteNome,
      numeroProposta,
      linkDownload,
    }),
  });

  return "link";
}
