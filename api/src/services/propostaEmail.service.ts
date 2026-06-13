import nodemailer from "nodemailer";

interface EmailProposta {
    destinatario: string;
    clienteNome: string;
    numeroProposta: string;
    nomeArquivo: string;
    caminhoPdf: string;
}

const transporter = nodemailer.createTransport({

    host: process.env.SMTP_HOST,

    port: Number(
        process.env.SMTP_PORT
    ),

    secure: false,

    auth: {

        user:
            process.env.SMTP_USER,

        pass:
            process.env.SMTP_PASS

    }

});

export async function enviarPropostaPorEmail({
    destinatario,
    clienteNome,
    numeroProposta,
    nomeArquivo,
    caminhoPdf
}: EmailProposta): Promise<void> {

    await transporter.sendMail({

        from:
            process.env.SMTP_FROM,

        to:
            destinatario,

        subject:
            `Proposta Técnica Comercial Nº ${numeroProposta}`,

        html: `
        <div style="
            font-family:Arial;
            font-size:14px;
            color:#333;
        ">

            <h2>
                NEW FLOOR
            </h2>

            <p>
                Olá
                <strong>
                    ${clienteNome}
                </strong>,
            </p>

            <p>
                Segue em anexo a proposta comercial
                nº
                <strong>
                    ${numeroProposta}
                </strong>.
            </p>

            <p>
                Permanecemos à disposição para quaisquer esclarecimentos.
            </p>

            <br>

            <p>
                Atenciosamente,
                <br>
                Equipe NEW FLOOR
            </p>

        </div>
        `,

        attachments: [
            {
                filename:
                    nomeArquivo,

                path:
                    caminhoPdf
            }
        ]

    });

}