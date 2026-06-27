import fs from "fs";
import path from "path";

interface DadosProposta {
  proposta: any;
  cliente: any;
  itens: any[];
  template: any;
}

function caminhoAssetPublico(...partes: string[]): string {
  const candidatos = [
    path.join(__dirname, "..", "..", "public", ...partes),
    path.join(__dirname, "..", "public", ...partes),
    path.join(process.cwd(), "public", ...partes),
  ];

  for (const candidato of candidatos) {
    if (fs.existsSync(candidato)) {
      return candidato;
    }
  }

  return candidatos[0];
}

const LOGO_PADRAO = caminhoAssetPublico("assets", "logo-newfloor.png");

function nomeCliente(cliente?: any): string {
  if (!cliente) {
    return "Cliente";
  }

  const nome =
    cliente.nomeFantasia ||
    cliente.razaoSocial ||
    cliente.nome ||
    cliente.responsavel;

  if (!nome || nome === "undefined") {
    return "Cliente";
  }

  return String(nome);
}

function tituloObservacaoPorTipo(proposta?: any): string {
  return proposta?.tipoProposta === "SISTEMA"
    ? "Observações Sistema"
    : "Observações Serviços";
}

function resolverTextoObservacao(proposta?: any, template?: any): string | null {
  if (proposta?.observacoes) {
    return proposta.observacoes;
  }

  if (!template) {
    return null;
  }

  if (proposta?.tipoProposta === "SISTEMA") {
    return (
      template.textoObservacaoSistema ||
      template.textoObservacao ||
      null
    );
  }

  return (
    template.textoObservacaoServicos ||
    template.textoObservacao ||
    null
  );
}

function logoParaDataUri(caminho: string): string | null {
  try {
    if (!fs.existsSync(caminho)) {
      return null;
    }

    const buffer = fs.readFileSync(caminho);

    const ext = path.extname(caminho).slice(1).toLowerCase();

    const mime = ext === "jpg" ? "jpeg" : ext;

    return `data:image/${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

async function imagemUrlParaDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    const contentType = response.headers.get("content-type") || "image/jpeg";

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

async function resolverImagemSrc(
  logo?: string | null,
  fallbackCaminho?: string,
): Promise<string | null> {
  if (logo) {
    if (logo.startsWith("data:")) {
      return logo;
    }

    if (logo.startsWith("http://") || logo.startsWith("https://")) {
      const embutida = await imagemUrlParaDataUri(logo);

      if (embutida) {
        return embutida;
      }

      return logo;
    }

    const caminhoCustom = path.isAbsolute(logo)
      ? logo
      : path.join(process.cwd(), logo.replace(/^\//, ""));

    return logoParaDataUri(caminhoCustom);
  }

  if (fallbackCaminho) {
    return logoParaDataUri(fallbackCaminho);
  }

  return null;
}

function moeda(valor: any): string {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dataBR(data?: Date | string | null): string {
  if (!data) return "-";

  return new Date(data).toLocaleDateString("pt-BR");
}

function escHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function descricaoComercialVazia(descricao?: string | null): boolean {
  if (!descricao) {
    return true;
  }

  const texto = descricao.trim();

  if (!texto) {
    return true;
  }

  const semTags = texto
    .replace(/<span class="ql-ui"[^>]*><\/span>/gi, "")
    .replace(/<p><br><\/p>/gi, "")
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();

  return !semTags;
}

function normalizarHtmlEditor(html: string): string {
  return html
    .replace(/<span class="ql-ui"[^>]*><\/span>/gi, "")
    .replace(/<span class="ql-cursor[^"]*"[^>]*><\/span>/gi, "")
    .replace(/\scontenteditable="false"/gi, "")
    .replace(/\scontenteditable="true"/gi, "");
}

function formatarDescricaoComercial(descricao?: string | null): string {
  if (!descricao) {
    return "";
  }

  const texto = normalizarHtmlEditor(descricao.trim());

  if (!texto || descricaoComercialVazia(texto)) {
    return "";
  }

  if (/<[a-z][\s\S]*>/i.test(texto)) {
    return texto;
  }

  return escHtml(texto).replace(/\n/g, "<br>");
}

function resolverDescricaoComercialItem(item: any): string {
  const detalhes = item.detalhes?.trim();

  if (detalhes && !descricaoComercialVazia(detalhes)) {
    return detalhes;
  }

  const descricaoItem = item.descricao?.trim() || "";
  const descricaoServico = item.servico?.descricao?.trim() || "";
  const itemTemHtml = /<[a-z][\s\S]*>/i.test(descricaoItem);
  const servicoTemHtml = /<[a-z][\s\S]*>/i.test(descricaoServico);

  if (itemTemHtml && !descricaoComercialVazia(descricaoItem)) {
    return descricaoItem;
  }

  if (servicoTemHtml && !descricaoComercialVazia(descricaoServico)) {
    return descricaoServico;
  }

  if (!descricaoComercialVazia(descricaoItem)) {
    return descricaoItem;
  }

  return descricaoServico;
}

function tituloItemProposta(item: any): string {
  if (item.servico?.nome) {
    return escHtml(String(item.servico.nome));
  }

  const descricao = String(item.descricao || "").trim();

  if (!descricao) {
    return "Serviço";
  }

  if (/<[a-z][\s\S]*>/i.test(descricao)) {
    const texto = descricao
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return escHtml(texto || "Serviço");
  }

  return escHtml(descricao);
}

function contatosCliente(
  cliente: any,
  tipo: "email" | "telefone",
): Array<{ nome?: string | null; valor?: string | null }> {
  const slots = [1, 2, 3, 4].map((n) => ({
    nome: cliente?.[`nome${tipo === "email" ? "Email" : "Telefone"}${n}`],
    valor: cliente?.[`${tipo}${n}`],
  }));

  return slots;
}

function formatarContatosComNomeHtml(
  contatos: Array<{ nome?: string | null; valor?: string | null }>,
): string {
  const itens = contatos
    .map(({ nome, valor }) => {
      const textoValor = String(valor || "").trim();
      const textoNome = String(nome || "").trim();

      if (!textoValor) {
        return null;
      }

      if (textoNome) {
        return `<div class="contato-item"><span class="contato-nome">${escHtml(textoNome)}</span><span class="contato-valor">${escHtml(textoValor)}</span></div>`;
      }

      return `<div class="contato-item"><span class="contato-valor">${escHtml(textoValor)}</span></div>`;
    })
    .filter(Boolean) as string[];

  if (!itens.length) {
    return "-";
  }

  return itens.join("");
}

export async function gerarHtmlProposta({
  proposta,
  cliente,
  itens,
  template,
}: DadosProposta): Promise<string> {
  const corPrimaria = template?.corPrimaria || "#111827";

  const corSecundaria = template?.corSecundaria || "#f3f4f6";

  const exibirLogo = template?.exibirLogo !== false;

  const [logoSrc, clienteLogoSrc] = await Promise.all([
    exibirLogo
      ? resolverImagemSrc(template?.logo, LOGO_PADRAO)
      : Promise.resolve(null),

    cliente?.logo ? resolverImagemSrc(cliente.logo) : Promise.resolve(null),
  ]);

  const subtotalCalculado = itens.reduce(
    (acc, item) => acc + Number(item.subtotal || 0),
    0,
  );

  const totalCalculado =
    subtotalCalculado -
    Number(proposta.desconto || 0) +
    Number(proposta.acrescimo || 0) +
    Number(proposta.frete || 0) +
    Number(proposta.impostos || 0);

  const tabelaItens = itens
    .map(
      (item, index) => `
<tr>
<td>${index + 1}</td>

<td>
    ${item.servico?.nome || item.descricao || "-"}
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
`,
    )
    .join("");

  const detalhesTecnicos = itens
    .map((item, index) => {
      const descricaoComercial = resolverDescricaoComercialItem(item);
      const descricaoComercialHtml = descricaoComercial
        ? `<div class="descricao-comercial">${formatarDescricaoComercial(descricaoComercial)}</div>`
        : "";

      return `

<div class="item-tecnico">

<h3>
ITEM ${index + 1}
</h3>

<h4>
${tituloItemProposta(item)}
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

${descricaoComercialHtml}

${
  item.observacoes
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
`;
    })
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
object-fit:contain;
}

.cliente-card{
display:flex;
gap:20px;
align-items:flex-start;
}

.logo-cliente{
max-width:140px;
max-height:90px;
object-fit:contain;
flex-shrink:0;
}

.cliente-dados{
flex:1;
}

.empresa{
display:flex;
align-items:center;
gap:16px;
}

.empresa-text h2{
font-size:22px;
color:${corPrimaria};
margin-bottom:4px;
}

.empresa-text p{
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

.contato-item{
margin-bottom:8px;
}

.contato-item:last-child{
margin-bottom:0;
}

.contato-nome{
display:block;
font-weight:bold;
color:#111;
margin-bottom:2px;
}

.contato-valor{
display:block;
color:#444;
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
    text-align: justify;
}

.descricao-comercial{
    line-height:1.6;
    margin-bottom:8px;
    text-align:justify;
    font-size:12px;
}

.descricao-comercial p{
    margin:0 0 8px 0;
}

.descricao-comercial p:last-child{
    margin-bottom:0;
}

.descricao-comercial ul,
.descricao-comercial ol{
    margin:8px 0 8px 1.5em;
    padding:0;
}

.descricao-comercial ol{
    list-style:none;
}

.descricao-comercial ul{
    list-style:disc;
    padding-left:1.5em;
}

.descricao-comercial ul li,
.descricao-comercial ol li{
    margin-bottom:4px;
    padding-left:0.2em;
    display:list-item;
}

.descricao-comercial ol li[data-list="bullet"]{
    list-style-type:disc;
}

.descricao-comercial ol li[data-list="ordered"]{
    list-style-type:decimal;
}

.descricao-comercial strong,
.descricao-comercial b{
    font-weight:bold;
}

.descricao-comercial em,
.descricao-comercial i{
    font-style:italic;
}

.descricao-comercial u{
    text-decoration:underline;
}

.descricao-comercial h1,
.descricao-comercial h2,
.descricao-comercial h3{
    margin:10px 0 6px;
    color:${corPrimaria};
    font-weight:bold;
}

.descricao-comercial h1{
    font-size:18px;
}

.descricao-comercial h2{
    font-size:16px;
}

.descricao-comercial h3{
    font-size:14px;
}

.descricao-comercial .ql-align-center{
    text-align:center;
}

.descricao-comercial .ql-align-right{
    text-align:right;
}

.descricao-comercial .ql-align-justify{
    text-align:justify;
}

.descricao-comercial .ql-indent-1{
    padding-left:3em;
}

.descricao-comercial .ql-indent-2{
    padding-left:6em;
}

.descricao-comercial .ql-indent-3{
    padding-left:9em;
}

.descricao-comercial blockquote{
    border-left:4px solid #ccc;
    margin:8px 0;
    padding-left:12px;
    color:#555;
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

${
  logoSrc
    ? `
<img
src="${logoSrc}"
class="logo"
alt="NEW FLOOR"
/>
`
    : ""
}

<div class="empresa-text">

<h2>
${template?.cabecalho || "NEW FLOOR PISOS E REVESTIMENTOS"}
</h2>

<p>
${template?.textoApresentacao
  ? `<p>${template.textoApresentacao}</p>`
  : ""}
</p>

<p>
Proposta Técnica Comercial
</p>

</div>

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

<div class="card cliente-card">

${
  clienteLogoSrc
    ? `
<img
src="${clienteLogoSrc}"
class="logo-cliente"
alt="Logo do cliente"
/>
`
    : ""
}

<div class="cliente-dados grid">

<div class="campo">
<strong>Cliente</strong>
${nomeCliente(cliente)}
</div>

<div class="campo">
<strong>Responsável</strong>
${cliente.responsavel || "-"}
</div>

<div class="campo">
<strong>E-mail</strong>
<br/>
${formatarContatosComNomeHtml(contatosCliente(cliente, "email"))}
</div>

<div class="campo">
<strong>Telefones</strong>
<br/>
${formatarContatosComNomeHtml(contatosCliente(cliente, "telefone"))}
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

<div class="descricao-comercial">
${formatarDescricaoComercial(proposta.descricao)}
</div>

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

${
  template?.textoGarantia
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
${tituloObservacaoPorTipo(proposta)}
</div>

<div class="card">

<div class="descricao-comercial">
${formatarDescricaoComercial(resolverTextoObservacao(proposta, template)) || "-"}
</div>

</div>

</div>

<div class="assinaturas">

<div class="assinatura">
NEW FLOOR
</div>

<div class="assinatura">
${nomeCliente(cliente)}
</div>

</div>

<div class="footer">

${template?.rodape || "Documento gerado automaticamente pelo sistema."}

</div>

</div>

</body>

</html>
`;
}
