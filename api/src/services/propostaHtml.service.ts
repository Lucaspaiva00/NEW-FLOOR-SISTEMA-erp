import { Prisma } from "@prisma/client";

interface DadosProposta {
    proposta: any;
    cliente: any;
    itens: any[];
    template: any;
}

function moeda(valor: any): string {
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function dataBR(data?: Date | string | null): string {
    if (!data) return "-";

    return new Date(data).toLocaleDateString("pt-BR");
}

export function gerarHtmlProposta({
    proposta,
    cliente,
    itens,
    template
}: DadosProposta): string {

    const corPrimaria =
        template?.corPrimaria ||
        "#111827";

    const corSecundaria =
        template?.corSecundaria ||
        "#f3f4f6";

    const subtotalCalculado = itens.reduce(
        (acc, item) =>
            acc + Number(item.subtotal || 0),
        0
    );

    const totalCalculado =
        subtotalCalculado
        - Number(proposta.desconto || 0)
        + Number(proposta.acrescimo || 0)
        + Number(proposta.frete || 0)
        + Number(proposta.impostos || 0);

    const tabelaItens =
        itens
            .map(
                (
                    item,
                    index
                ) => `
<tr>
<td>${index + 1}</td>

<td>
    ${item.servico?.nome ||
                    item.descricao ||
                    "-"
                    }
</td>

<td>
    ${item.unidade || "UN"}
</td>

<td>
    ${item.quantidade || 0}
</td>

<td>
    ${moeda(item.valorUnitario)}
</td>

<td>
    ${moeda(item.subtotal)}
</td>

</tr>
`
            )
            .join("");

    const detalhesTecnicos =
        itens
            .map(
                (
                    item,
                    index
                ) => `

<div class="item-tecnico">

<h3>
ITEM ${index + 1}
</h3>

<h4>
${item.servico?.nome ||
                    item.descricao ||
                    "Serviço"
                    }
</h4>

<p>

<strong>Quantidade:</strong>
${item.quantidade || 0}

<br>

<strong>Valor Unitário:</strong>
${moeda(item.valorUnitario)}

<br>

<strong>Valor Total:</strong>
${moeda(item.subtotal)}

</p>

${item.detalhes
                        ? `
<p>
${item.detalhes}
</p>
`
                        : item.servico?.descricao
                            ? `
<p>
${item.servico.descricao}
</p>
`
                            : ""
                    }

${item.observacoes
                        ? `
<p>
<strong>Observações:</strong>
${item.observacoes}
</p>
`
                        : item.servico?.observacoes
                            ? `
<p>
<strong>Observações:</strong>
${item.servico.observacoes}
</p>
`
                            : ""
                    }

</div>
`
            )
            .join("");

    return `
<!DOCTYPE html>

<html lang="pt-BR">

<head>

<meta charset="UTF-8">

<title>
Proposta ${proposta.numero}
</title>

<style>

*{
margin:0;
padding:0;
box-sizing:border-box;
}

body{
font-family:Arial,Helvetica,sans-serif;
font-size:12px;
color:#111;
background:white;
}

.page{
padding:30px;
}

.header{
display:flex;
justify-content:space-between;
align-items:flex-start;
border-bottom:4px solid ${corPrimaria};
padding-bottom:20px;
margin-bottom:25px;
}

.logo{
max-width:180px;
max-height:80px;
}

.empresa h1{
font-size:28px;
color:${corPrimaria};
margin-bottom:8px;
}

.empresa p{
margin:2px 0;
}

.proposta-box{
text-align:right;
}

.proposta-box h2{
font-size:24px;
color:${corPrimaria};
}

.section{
margin-top:25px;
}

.section-title{
background:${corPrimaria};
color:white;
padding:10px;
font-size:14px;
font-weight:bold;
margin-bottom:10px;
}

.card{
border:1px solid #ddd;
padding:15px;
}

.grid{
display:grid;
grid-template-columns:1fr 1fr;
gap:12px;
}

.campo{
margin-bottom:8px;
}

.campo strong{
display:block;
font-size:11px;
color:#666;
}

table{
width:100%;
border-collapse:collapse;
}

table thead{
background:${corSecundaria};
}

th{
padding:10px;
text-align:left;
font-size:12px;
}

td{
padding:10px;
border-bottom:1px solid #eee;
}

.item-tecnico{
margin-bottom:20px;
padding-bottom:15px;
border-bottom:1px dashed #ccc;
}

.item-tecnico h4{
margin-bottom:8px;
color:${corPrimaria};
}

.item-tecnico p{
line-height:1.5;
margin-bottom:8px;
}

.totais{
width:350px;
margin-left:auto;
margin-top:20px;
}

.total-row{
display:flex;
justify-content:space-between;
padding:8px 0;
border-bottom:1px solid #ddd;
}

.total-geral{
font-size:18px;
font-weight:bold;
color:${corPrimaria};
}

.assinaturas{
display:flex;
justify-content:space-between;
margin-top:60px;
gap:40px;
}

.assinatura{
flex:1;
text-align:center;
padding-top:10px;
border-top:1px solid #111;
}

.footer{
margin-top:50px;
padding-top:20px;
border-top:1px solid #ddd;
font-size:11px;
color:#666;
text-align:center;
}

</style>

</head>

<body>

<div class="page">

<div class="header">

<div class="empresa">

${template?.logo
            ? `
<img
src="${template.logo}"
class="logo"
/>
`
            : ""
        }

<h2>
NEW FLOOR PISOS E REVESTIMENTOS
</h2>

<p>
Proposta Técnica Comercial
</p>

</div>

<div class="proposta-box">

<h2>
${proposta.numero}
</h2>

<p>
Data:
${dataBR(proposta.createdAt)}
</p>

<p>
Validade:
${dataBR(proposta.dataValidade)}
</p>

</div>

</div>

<div class="section">

<div class="section-title">
Dados do Cliente
</div>

<div class="card grid">

<div class="campo">
<strong>Cliente</strong>
${cliente.nome || "-"}
</div>

<div class="campo">
<strong>Responsável</strong>
${cliente.responsavel || "-"}
</div>

<div class="campo">
<strong>Email</strong>
${cliente.email || "-"}
</div>

<div class="campo">
<strong>Telefone</strong>
${cliente.telefone || "-"}
</div>

<div class="campo">
<strong>Cidade</strong>
${cliente.cidade || "-"}
</div>

<div class="campo">
<strong>Estado</strong>
${cliente.estado || "-"}
</div>

</div>

</div>

<div class="section">

<div class="section-title">
Resumo
</div>

<div class="card">

<h3>
${proposta.titulo}
</h3>

<br>

<p>
${proposta.descricao || ""}
</p>

<br>

<p>
${proposta.escopo || ""}
</p>

</div>

</div>

<div class="section">

<div class="section-title">
Serviços
</div>

<table>

<thead>

<tr>
<th>#</th>
<th>Descrição</th>
<th>Unidade</th>
<th>Qtd</th>
<th>Valor Unit.</th>
<th>Total</th>
</tr>

</thead>

<tbody>

${tabelaItens}

</tbody>

</table>

<div class="totais">

<div class="total-row">
<span>Subtotal</span>
<strong>${moeda(subtotalCalculado)}</strong>
</div>

<div class="total-row">
<span>Desconto</span>
<strong>${moeda(proposta.desconto)}</strong>
</div>

<div class="total-row">
<span>Acréscimo</span>
<strong>${moeda(proposta.acrescimo)}</strong>
</div>

<div class="total-row">
<span>Frete</span>
<strong>${moeda(proposta.frete)}</strong>
</div>

<div class="total-row">
<span>Impostos</span>
<strong>${moeda(proposta.impostos)}</strong>
</div>

<div class="total-row total-geral">
<span>Total</span>
<strong>${moeda(totalCalculado)}</strong>
</div>

</div>

</div>

<div class="section">

<div class="section-title">
Detalhamento Técnico
</div>

<div class="card">

${detalhesTecnicos}

</div>

</div>

<div class="section">

<div class="section-title">
Condições Comerciais
</div>

<div class="card">

<p>
<strong>Forma de Pagamento:</strong>
${proposta.formaPagamento || "-"}
</p>

<br>

<p>
<strong>Condições:</strong>
${proposta.condicoesPagamento || "-"}
</p>

</div>

</div>

${template?.textoGarantia
            ? `
<div class="section">

<div class="section-title">
Garantias
</div>

<div class="card">

${template.textoGarantia}

</div>

</div>
`
            : ""
        }

<div class="section">

<div class="section-title">
Observações
</div>

<div class="card">

${proposta.observacoes ||
        template?.textoObservacao ||
        "-"}

</div>

</div>

<div class="assinaturas">

<div class="assinatura">
NEW FLOOR
</div>

<div class="assinatura">
${cliente.nome}
</div>

</div>

<div class="footer">

${template?.rodape ||
        "Documento gerado automaticamente pelo sistema."}

</div>

</div>

</body>

</html>
`;

}