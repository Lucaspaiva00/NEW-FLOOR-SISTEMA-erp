interface DadosWhatsapp {
    clienteNome: string;
    telefone: string;
    numeroProposta: string;
    linkPdf: string;
}

export function gerarLinkWhatsapp({
    clienteNome,
    telefone,
    numeroProposta,
    linkPdf
}: DadosWhatsapp): string {

    const telefoneLimpo =
        telefone.replace(/\D/g, "");

    const mensagem = `
Olá ${clienteNome}, tudo bem?

Segue a proposta comercial Nº ${numeroProposta}.

Visualização:
${linkPdf}

Qualquer dúvida fico à disposição.

Atenciosamente,
Equipe NEW FLOOR PISOS E REVESTIMENTOS
`;

    return `https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(
        mensagem
    )}`;
}