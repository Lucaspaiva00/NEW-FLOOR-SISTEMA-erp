import fs from "fs";
import path from "path";
import {
  formatarTextoObservacoes,
  normalizarConteudoObservacao,
} from "../utils/formatarObservacoes";

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

function resolverTextoObservacao(
  proposta?: any,
  template?: any,
): string | null {
  if (proposta?.tipoProposta === "SISTEMA") {
    return (
      proposta.observacoesSistema ||
      proposta.observacoes ||
      template?.textoObservacaoSistema ||
      template?.textoObservacao ||
      null
    );
  }

  return (
    proposta?.observacoesServicos ||
    proposta?.observacoes ||
    template?.textoObservacaoServicos ||
    template?.textoObservacao ||
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

function removerParagrafosVazios(html: string): string {
  return html.replace(/<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, "");
}

function paragrafoSoTitulo(html: string): boolean {
  const inner = html
    .replace(/^<p[^>]*>/i, "")
    .replace(/<\/p>$/i, "")
    .trim();

  return /^<(strong|b)\b[\s\S]*<\/(strong|b)>\s*$/i.test(inner);
}

function paragrafoTituloComTraco(html: string): boolean {
  const inner = html
    .replace(/^<p[^>]*>/i, "")
    .replace(/<\/p>$/i, "")
    .trim();

  return /^<(strong|b)\b[\s\S]*<\/(strong|b)>\s*-\s+/i.test(inner);
}

function paragrafoTituloServico(html: string): boolean {
  const inner = html
    .replace(/^<p[^>]*>/i, "")
    .replace(/<\/p>$/i, "")
    .trim();

  if (!/^<(strong|b)\b/i.test(inner)) {
    return false;
  }

  const texto = inner
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return linhaPareceTituloServico(texto);
}

function linhaPareceTituloServico(texto: string): boolean {
  const t = texto.trim();

  if (!t || t.length > 220) {
    return false;
  }

  return (
    /\bm²\b|\bm2\b|\(\s*[\d.,]+\s*m\s*\)/i.test(t) ||
    /\(\s*\d+[\d.,]*\s*(?:dias?|etapas?)\s*\)/i.test(t)
  );
}

function ehHtmlObservacoesEstruturado(html: string): boolean {
  return /<h3[\s>]/i.test(html);
}

function aplicarClasseEstiloParagrafo(
  html: string,
  classe: string,
  estilo: string,
): string {
  const match = html.match(/^<p(\s[^>]*)?>/i);

  if (!match) {
    return html;
  }

  let attrs = match[1] || "";

  if (/class=/i.test(attrs)) {
    attrs = attrs.replace(
      /class=(["'])([\s\S]*?)\1/i,
      (_, aspas, classes) => `class=${aspas}${classes} ${classe}${aspas}`,
    );
  } else {
    attrs = ` class="${classe}"${attrs}`;
  }

  if (/style=/i.test(attrs)) {
    attrs = attrs.replace(
      /style=(["'])([\s\S]*?)\1/i,
      (_, aspas, valor) => `style=${aspas}${valor};${estilo}${aspas}`,
    );
  } else {
    attrs = ` style="${estilo}"${attrs}`;
  }

  return `<p${attrs}>` + html.slice(match[0].length);
}

const ESTILO_PARAGRAFO_TEXTO = "margin:0;padding:0;line-height:1.35;display:block;";
const ESTILO_PARAGRAFO_TITULO =
  "margin:0;padding:8px 0;line-height:1.35;display:block;";
const ESTILO_PARAGRAFO_TITULO_INLINE =
  "margin:0;padding:8px 0;line-height:1.35;display:block;";
const ESTILO_HEADING_DESCRICAO =
  "margin:0;padding:8px 0;line-height:1.35;display:block;";

function expandirParagrafosDescricaoComercial(html: string): string {
  let resultado = html.replace(
    /<p([^>]*)>([\s\S]*?)<\/p>/gi,
    (full, attrs, inner) => {
      const trimmed = inner.trim();

      if (!trimmed) {
        return full;
      }

      const expandido: string[] = [];

      const tituloCorpo = trimmed.match(
        /^(<(?:strong|b)\b[^>]*>[\s\S]*?<\/(?:strong|b)>)(\s*(?:<br\s*\/?>\s*)+)([\s\S]+)$/i,
      );

      const blocosIniciais =
        tituloCorpo && tituloCorpo[3]?.trim()
          ? [tituloCorpo[1], tituloCorpo[3]]
          : [trimmed];

      for (const bloco of blocosIniciais) {
        const porQuebraDupla = bloco
          .split(/(?:<br\s*\/?>\s*){2,}/i)
          .map((parte: string) => parte.trim())
          .filter(Boolean);

        if (porQuebraDupla.length > 1) {
          expandido.push(...porQuebraDupla);
          continue;
        }

        const porTitulo = bloco
          .split(/(?=<(?:strong|b)\b)/i)
          .map((parte: string) => parte.trim())
          .filter(Boolean);

        if (
          porTitulo.length > 1 &&
          /\bm²\b|\bm2\b|\(\s*[\d.,]+\s*m/i.test(bloco)
        ) {
          expandido.push(...porTitulo);
          continue;
        }

        expandido.push(bloco);
      }

      if (expandido.length <= 1) {
        return full;
      }

      return expandido.map((parte) => `<p${attrs}>${parte}</p>`).join("");
    },
  );

  resultado = resultado.replace(
    /<(h[1-6])(\s[^>]*)?>/gi,
    (match, tag, rest = "") => {
      if (/style=/i.test(rest)) {
        return `<${tag}${rest.replace(
          /style=(["'])([\s\S]*?)\1/i,
          (_: string, aspas: string, valor: string) =>
            `style=${aspas}${valor};${ESTILO_HEADING_DESCRICAO}${aspas}`,
        )}>`;
      }

      return `<${tag} style="${ESTILO_HEADING_DESCRICAO}"${rest}>`;
    },
  );

  return resultado;
}

function marcarTitulosServicoHtml(html: string): string {
  return html.replace(/<p[^>]*>[\s\S]*?<\/p>/gi, (paragrafo) => {
    const inner = paragrafo
      .replace(/^<p[^>]*>/i, "")
      .replace(/<\/p>$/i, "")
      .trim();

    if (!inner) {
      return "";
    }

    const texto = inner
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!texto) {
      return "";
    }

    const ehTituloInline = paragrafoTituloComTraco(paragrafo);
    const ehTitulo =
      paragrafoSoTitulo(paragrafo) ||
      ehTituloInline ||
      paragrafoTituloServico(paragrafo) ||
      linhaPareceTituloServico(texto);

    if (ehTituloInline) {
      return aplicarClasseEstiloParagrafo(
        paragrafo,
        "paragrafo-titulo-inline",
        ESTILO_PARAGRAFO_TITULO_INLINE,
      );
    }

    if (ehTitulo) {
      return aplicarClasseEstiloParagrafo(
        paragrafo,
        "paragrafo-titulo",
        ESTILO_PARAGRAFO_TITULO,
      );
    }

    return aplicarClasseEstiloParagrafo(
      paragrafo,
      "paragrafo-texto",
      ESTILO_PARAGRAFO_TEXTO,
    );
  });
}

function compactarParagrafosTextoDescricao(html: string): string {
  const tokenRegex =
    /<(h[1-6][^>]*>[\s\S]*?<\/h[1-6]>|<ul[\s\S]*?<\/ul>|<ol[\s\S]*?<\/ol>|<p[^>]*>[\s\S]*?<\/p>)/gi;

  const tokens = html.match(tokenRegex);

  if (!tokens?.length) {
    return html;
  }

  const merged: string[] = [];
  const buffer: string[] = [];

  const flushBuffer = () => {
    if (!buffer.length) {
      return;
    }

    merged.push(
      aplicarClasseEstiloParagrafo(
        `<p>${buffer.join("<br>")}</p>`,
        "paragrafo-texto",
        ESTILO_PARAGRAFO_TEXTO,
      ),
    );
    buffer.length = 0;
  };

  for (const token of tokens) {
    if (
      /^<h[1-6]/i.test(token) ||
      /^<ul/i.test(token) ||
      /^<ol/i.test(token) ||
      /paragrafo-titulo/i.test(token)
    ) {
      flushBuffer();
      merged.push(token);
      continue;
    }

    if (!/^<p/i.test(token)) {
      continue;
    }

    const inner = token.replace(/^<p[^>]*>/i, "").replace(/<\/p>$/i, "");
    buffer.push(inner);
  }

  flushBuffer();

  return merged.join("");
}

function normalizarHtmlObservacoesPdf(html: string): string {
  let resultado = removerParagrafosVazios(normalizarHtmlEditor(html));

  resultado = resultado.replace(
    /<(h[1-6])(\s[^>]*)?>/gi,
    (_match, tag: string, rest = "") => {
      if (/style=/i.test(rest)) {
        return `<${tag}${rest.replace(
          /style=(["'])([\s\S]*?)\1/i,
          (_: string, aspas: string, valor: string) =>
            `style=${aspas}${valor};${ESTILO_HEADING_DESCRICAO}${aspas}`,
        )}>`;
      }

      return `<${tag} style="${ESTILO_HEADING_DESCRICAO}"${rest}>`;
    },
  );

  resultado = resultado.replace(/<p[^>]*>[\s\S]*?<\/p>/gi, (paragrafo) =>
    aplicarClasseEstiloParagrafo(
      paragrafo,
      "paragrafo-texto",
      ESTILO_PARAGRAFO_TEXTO,
    ),
  );

  return resultado;
}

function normalizarHtmlDescricaoServicoPdf(html: string): string {
  const limpo = removerParagrafosVazios(normalizarHtmlEditor(html));
  const expandido = expandirParagrafosDescricaoComercial(limpo);
  const marcado = marcarTitulosServicoHtml(expandido);

  return compactarParagrafosTextoDescricao(marcado);
}

function compactarHtmlDescricaoComercial(html: string): string {
  if (ehHtmlObservacoesEstruturado(html)) {
    return normalizarHtmlObservacoesPdf(html);
  }

  return normalizarHtmlDescricaoServicoPdf(html);
}

function formatarDescricaoComercial(descricao?: string | null): string {
  if (!descricao) {
    return "";
  }

  const texto = normalizarHtmlEditor(descricao.trim());

  if (!texto || descricaoComercialVazia(texto)) {
    return "";
  }

  const formatado = /<[a-z][\s\S]*>/i.test(texto)
    ? texto
    : formatarTextoObservacoes(texto);

  return compactarHtmlDescricaoComercial(formatado);
}

function formatarObservacoesItem(item: any): string {
  const bruto =
    item.observacoes?.trim() || item.servico?.observacoes?.trim() || "";

  if (!bruto) {
    return "";
  }

  const html = formatarDescricaoComercial(normalizarConteudoObservacao(bruto));

  if (!html) {
    return "";
  }

  return `
<p>
<strong>Observações:</strong>
</p>
<div class="descricao-comercial">
${html}
</div>
`;
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

function valorBrutoItem(item: any): number {
  return Number(item.quantidade || 0) * Number(item.valorUnitario || 0);
}

function resolverDescontoItem(item: any): number {
  const armazenado = Number(item.desconto || 0);

  if (armazenado > 0) {
    return armazenado;
  }

  const bruto = valorBrutoItem(item);
  const subtotal = Number(item.subtotal || 0);
  const acrescimo = Number(item.acrescimo || 0);
  const inferido = bruto - subtotal + acrescimo;

  return inferido > 0.005 ? Number(inferido.toFixed(2)) : 0;
}

function resolverAcrescimoItem(item: any): number {
  const armazenado = Number(item.acrescimo || 0);

  if (armazenado > 0) {
    return armazenado;
  }

  const bruto = valorBrutoItem(item);
  const subtotal = Number(item.subtotal || 0);
  const desconto = resolverDescontoItem(item);
  const inferido = subtotal - bruto + desconto;

  return inferido > 0.005 ? Number(inferido.toFixed(2)) : 0;
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

  const subtotalBruto = itens.reduce(
    (acc, item) => acc + valorBrutoItem(item),
    0,
  );

  const descontoTotal = itens.reduce(
    (acc, item) => acc + resolverDescontoItem(item),
    0,
  );

  const acrescimoTotal = itens.reduce(
    (acc, item) => acc + resolverAcrescimoItem(item),
    0,
  );

  const subtotalCalculado = itens.reduce(
    (acc, item) => acc + Number(item.subtotal || 0),
    0,
  );

  const totalCalculado = subtotalCalculado + Number(proposta.frete || 0);

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
    ${moeda(resolverDescontoItem(item))}
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

${
  resolverDescontoItem(item) > 0
    ? `
<strong>Desconto:</strong>
${moeda(resolverDescontoItem(item))}

<br>
`
    : ""
}

<strong>Valor Total:</strong>
${moeda(item.subtotal)}

</p>

${descricaoComercialHtml}

${formatarObservacoesItem(item)}

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

h4{
margin-top:8px;
margin-bottom:8px;
color:${corPrimaria};
}

.item-tecnico > p{
    line-height:1.5;
    margin-bottom:8px;
    text-align: justify;
}

.descricao-comercial{
    line-height:1.35;
    margin-bottom:8px;
    text-align:justify;
    font-size:12px;
}

.descricao-comercial p{
    margin:0;
    line-height:1.35;
}

.descricao-comercial p.paragrafo-texto{
    margin:0;
    line-height:1.35;
}

.descricao-comercial p.paragrafo-titulo{
    margin:0;
    padding:8px 0;
    line-height:1.35;
    display:block;
}

.descricao-comercial p.paragrafo-titulo-inline{
    margin:0;
    padding:8px 0;
    line-height:1.35;
    display:block;
}

.descricao-comercial p.paragrafo-texto + p.paragrafo-texto{
    margin-top:0;
}

.descricao-comercial p.paragrafo-texto:last-child{
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
    margin-bottom:2px;
    padding-left:0.2em;
    display:list-item;
    line-height:1.35;
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
    margin:0;
    padding:8px 0;
    display:block;
    color:${corPrimaria};
    font-weight:bold;
}

.descricao-comercial p + h3,
.descricao-comercial br + h3{
    padding-top:8px;
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
${template?.textoApresentacao ? `<p>${template.textoApresentacao}</p>` : ""}
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
<th>Desconto</th>
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
<strong>${moeda(subtotalBruto)}</strong>
</div>

${
  descontoTotal > 0
    ? `
<div class="total-row">
<span>Desconto</span>
<strong>- ${moeda(descontoTotal)}</strong>
</div>
`
    : ""
}

${
  acrescimoTotal > 0
    ? `
<div class="total-row">
<span>Acréscimo</span>
<strong>${moeda(acrescimoTotal)}</strong>
</div>
`
    : ""
}

<div class="total-row">
<span>Total itens</span>
<strong>${moeda(subtotalCalculado)}</strong>
</div>

<div class="total-row">
<span>Frete</span>
<strong>${moeda(proposta.frete)}</strong>
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
