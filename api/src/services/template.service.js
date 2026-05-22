function moeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function dataBR(data) {
    if (!data) return "-";

    return new Date(data).toLocaleDateString("pt-BR");
}

function texto(valor) {
    return valor || "";
}

exports.montarHtmlProposta = (proposta, template) => {
    const corPrimaria = template?.corPrimaria || "#111827";
    const corSecundaria = template?.corSecundaria || "#e5e7eb";

    const itens = proposta.itens.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>
                <strong>${item.descricao || "-"}</strong>
                <br>
                <span>${item.detalhes || ""}</span>
            </td>
            <td>${item.unidade || "UN"}</td>
            <td>${Number(item.quantidade || 0)}</td>
            <td>${moeda(item.valorUnitario)}</td>
            <td>${moeda(item.subtotal)}</td>
        </tr>
    `).join("");

    return `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <style>
                * {
                    box-sizing: border-box;
                }

                body {
                    font-family: Arial, Helvetica, sans-serif;
                    color: #111827;
                    margin: 0;
                    padding: 0;
                    background: #fff;
                }

                .page {
                    padding: 42px;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 4px solid ${corPrimaria};
                    padding-bottom: 24px;
                    margin-bottom: 32px;
                }

                .brand h1 {
                    margin: 0;
                    color: ${corPrimaria};
                    font-size: 30px;
                }

                .brand p {
                    margin: 6px 0 0;
                    color: #6b7280;
                    font-size: 13px;
                }

                .proposal-info {
                    text-align: right;
                }

                .proposal-info strong {
                    font-size: 20px;
                    color: ${corPrimaria};
                }

                .section {
                    margin-bottom: 28px;
                }

                .section-title {
                    background: ${corPrimaria};
                    color: white;
                    padding: 12px 16px;
                    font-size: 15px;
                    font-weight: bold;
                    border-radius: 8px;
                    margin-bottom: 14px;
                }

                .box {
                    border: 1px solid ${corSecundaria};
                    border-radius: 10px;
                    padding: 18px;
                    background: #f9fafb;
                }

                .grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                }

                .field small {
                    display: block;
                    color: #6b7280;
                    margin-bottom: 4px;
                }

                .field strong {
                    color: #111827;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }

                th {
                    background: #f3f4f6;
                    padding: 12px;
                    font-size: 12px;
                    text-align: left;
                    border-bottom: 1px solid #e5e7eb;
                }

                td {
                    padding: 12px;
                    font-size: 12px;
                    border-bottom: 1px solid #e5e7eb;
                    vertical-align: top;
                }

                td span {
                    color: #6b7280;
                    font-size: 11px;
                }

                .totals {
                    margin-left: auto;
                    width: 320px;
                    margin-top: 22px;
                }

                .totals div {
                    display: flex;
                    justify-content: space-between;
                    padding: 9px 0;
                    border-bottom: 1px solid #e5e7eb;
                }

                .totals .total {
                    font-size: 20px;
                    font-weight: bold;
                    color: ${corPrimaria};
                }

                .footer {
                    margin-top: 42px;
                    padding-top: 24px;
                    border-top: 1px solid #e5e7eb;
                    font-size: 12px;
                    color: #6b7280;
                }

                .signature {
                    margin-top: 50px;
                    display: flex;
                    justify-content: space-between;
                    gap: 40px;
                }

                .signature div {
                    flex: 1;
                    text-align: center;
                    border-top: 1px solid #111827;
                    padding-top: 10px;
                    font-size: 12px;
                }
            </style>
        </head>

        <body>
            <div class="page">

                <div class="header">
                    <div class="brand">
                        <h1>${template?.cabecalho || "NEW FLOOR"}</h1>
                        <p>${template?.textoApresentacao || "Proposta comercial personalizada"}</p>
                    </div>

                    <div class="proposal-info">
                        <strong>${proposta.numero}</strong>
                        <p>Data: ${dataBR(proposta.createdAt)}</p>
                        <p>Validade: ${dataBR(proposta.dataValidade)}</p>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Dados do Cliente</div>

                    <div class="box grid">
                        <div class="field">
                            <small>Cliente</small>
                            <strong>${proposta.cliente?.nome || "-"}</strong>
                        </div>

                        <div class="field">
                            <small>Nome fantasia</small>
                            <strong>${proposta.cliente?.nomeFantasia || "-"}</strong>
                        </div>

                        <div class="field">
                            <small>CNPJ / CPF</small>
                            <strong>${proposta.cliente?.cnpj || proposta.cliente?.cpf || "-"}</strong>
                        </div>

                        <div class="field">
                            <small>Contato</small>
                            <strong>${proposta.cliente?.telefone || proposta.cliente?.whatsapp || "-"}</strong>
                        </div>

                        <div class="field">
                            <small>Email</small>
                            <strong>${proposta.cliente?.email || "-"}</strong>
                        </div>

                        <div class="field">
                            <small>Cidade</small>
                            <strong>${proposta.cliente?.cidade || "-"} / ${proposta.cliente?.estado || "-"}</strong>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Resumo da Proposta</div>

                    <div class="box">
                        <h2>${proposta.titulo}</h2>
                        <p>${texto(proposta.descricao)}</p>
                        <p>${texto(proposta.escopo)}</p>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Itens da Proposta</div>

                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Descrição</th>
                                <th>Un.</th>
                                <th>Qtd.</th>
                                <th>Valor Unit.</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${itens}
                        </tbody>
                    </table>

                    <div class="totals">
                        <div>
                            <span>Subtotal</span>
                            <strong>${moeda(proposta.subtotal)}</strong>
                        </div>

                        <div>
                            <span>Desconto</span>
                            <strong>${moeda(proposta.desconto)}</strong>
                        </div>

                        <div>
                            <span>Acréscimo</span>
                            <strong>${moeda(proposta.acrescimo)}</strong>
                        </div>

                        <div>
                            <span>Frete</span>
                            <strong>${moeda(proposta.frete)}</strong>
                        </div>

                        <div>
                            <span>Impostos</span>
                            <strong>${moeda(proposta.impostos)}</strong>
                        </div>

                        <div class="total">
                            <span>Total</span>
                            <strong>${moeda(proposta.total)}</strong>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Condições Comerciais</div>

                    <div class="box">
                        <p><strong>Forma de pagamento:</strong> ${proposta.formaPagamento || "-"}</p>
                        <p><strong>Condições:</strong> ${proposta.condicoesPagamento || template?.textoPagamento || "-"}</p>
                        <p><strong>Garantia:</strong> ${template?.textoGarantia || "-"}</p>
                        <p><strong>Observações:</strong> ${proposta.observacoes || template?.textoObservacao || "-"}</p>
                    </div>
                </div>

                ${template?.exibirAssinatura
            ? `
                        <div class="signature">
                            <div>NEW FLOOR</div>
                            <div>${proposta.cliente?.nome || "Cliente"}</div>
                        </div>
                        `
            : ""
        }

                <div class="footer">
                    ${template?.rodape || "Documento gerado automaticamente pelo sistema NEW FLOOR ERP."}
                </div>

            </div>
        </body>
        </html>
    `;
};