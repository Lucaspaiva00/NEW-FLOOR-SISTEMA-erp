import ExcelJS from "exceljs";
import { createHash } from "node:crypto";

const semAcentos = (v: any) => String(v ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
const valor = (cell: any): any => {
  const v = cell?.value;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ((v.formula || v.sharedFormula) && (v.result === undefined || v.result === null)) return v;
    if (Object.prototype.hasOwnProperty.call(v, "result")) return v.result ?? "";
    if (v.text != null) return v.text;
    if (Array.isArray(v.richText)) return v.richText.map((p: any) => p.text).join("");
  }
  return v ?? "";
};
const texto = (v: any) => String(v ?? "").trim().slice(0, 1200);
export const numeroPlanilha = (v: any): number => {
 if(typeof v==="number")return Number.isFinite(v)?v:NaN;
 if(typeof v!=="string")return NaN;
 const t=v.trim().replace(/R\$|\s|%/g,"");
 if(!t)return NaN;
 const normalized=t.includes(",")?t.replace(/\./g,"").replace(",","."):t;
 return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)?Number(normalized):NaN;
};
export function percentualPlanilha(cell:any):number {
 const v=valor(cell);
 if(v===""||v===null)return 0;
 const n=numeroPlanilha(v);
 if(!Number.isFinite(n))return NaN;
 const p=typeof v==="string"&&v.includes("%")?n:
  String(cell.numFmt||"").includes("%")?n*100:(n>0&&n<=1?n*100:n);
 return Math.round(p*10000)/10000;
}
export function validarXlsx(base64: unknown) {
  if (typeof base64 !== "string" || base64.length > 7_100_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw Error("Envie uma planilha XLSX de até 5 MB.");
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length < 100 || bytes.length > 5_000_000 || bytes.subarray(0, 2).toString("utf8") !== "PK") {
    throw Error("Arquivo XLSX inválido ou maior que 5 MB.");
  }
  return bytes;
}
async function abrirWorkbook(bytes: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as any);
  return workbook;
}
type Medicao = { numero: number; coluna: number; titulo: string; data?: string; prevista?: boolean };
type Linha = { linha: number; item: string; etapa: string; descricao: string; unidade: string; quantidade: number; valor: number; percentuais: Record<string, number>; valoresMedidos?: Record<string, number> };
export type AbaPlanilha = {
  indice: number; nome: string; reconhecida: boolean; cabecalho: number;
  itens: Linha[]; medicoes: Medicao[]; aviso?: string; somenteConsulta?: boolean;
  amostra?: {linha:number; celulas:{coluna:string; valor:string}[]}[];
};
function dataMedicao(cell: any): string | undefined {
  const v = valor(cell);
  if (v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v !== "string") return;
  const br = v.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = br ? br[3] + "-" + br[2] + "-" + br[1] : v.trim();
  const d = new Date(iso + "T00:00:00Z");
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso) return iso;
}

export async function detectarPlanilha(bytes: Buffer, mapeamentos: any = {}, permitirMapeamento = false): Promise<{ hash: string; abas: AbaPlanilha[]; avisos: string[]; valida: boolean }> {
  const workbook = await abrirWorkbook(bytes);
  if (workbook.worksheets.length > 20) throw Error("Limite de 20 abas por planilha.");
  const abas: AbaPlanilha[] = [], avisos: string[] = [], erros: string[] = [];
  for (let indice = 0; indice < workbook.worksheets.length; indice++) {
    const sheet = workbook.worksheets[indice];
    let escopoCivil = false;
    let cabecalho = 0, colItem = 0, colEtapa = 0, colDescricao = 0, colUnidade = 0, colQuantidade = 0, colValor = 0, precoUnitario = true;
    for (let r = 1; r <= Math.min(sheet.rowCount, 30); r++) {
      const cols = Math.min(sheet.columnCount, 512);
      let item = 0, etapa = 0, descricao = 0, unidade = 0, qtd = 0, preco = 0, unitario = true;
      for (let c = 1; c <= cols; c++) {
        const cell = sheet.getCell(r, c);
        if(cell.isMerged && cell.master.address !== cell.address)continue;
        const t = semAcentos(valor(cell));
        if (["ITEM", "CODIGO", "COD.", "REFERENCIA", "REF.", "ID"].includes(t)) item = c;
        if (["ETAPA", "FASE", "GRUPO", "ETAPA / SERVICO"].includes(t)) etapa = c;
        if (["DESCRICAO","DESCRICAO DO SERVICO","SERVICO","ATIVIDADE","DISCRIMINACAO","DESCRICAO DA ETAPA","DESCRICAO DOS SERVICOS","SERVICOS","SERVICO EXECUTADO","NOME DO SERVICO"].includes(t)) descricao = c;
        if (["UNI","UNIDADE","UN","UND"].includes(t)) unidade = c;
        if (["QUANTIDADE","QTD","QTDE","QTDE."].includes(t)) qtd = c;
        if (t.includes("VALOR UNITARIO") || t === "PRECO UNITARIO") { preco = c; unitario = true; }
        else if (["VALOR TOTAL", "VALOR VIGENTE DA ETAPA", "VALOR CONTRATADO", "VALOR DA ETAPA", "VALOR DO SERVICO", "TOTAL CONTRATADO", "TOTAL (R$)", "VALOR TOTAL (R$)", "VALOR DA ETAPA (R$)", "VALOR CONTRATADO (R$)"].includes(t) && !preco) { preco = c; unitario = false; }
      }
      if (descricao && (item || etapa) && preco) {
        cabecalho = r; colItem = item; colEtapa = etapa; colDescricao = descricao;
        colUnidade = unidade; colQuantidade = qtd; colValor = preco; precoUnitario = unitario;
        escopoCivil = semAcentos(valor(sheet.getCell(r, preco))) === "VALOR VIGENTE DA ETAPA" && semAcentos(valor(sheet.getCell(r, preco + 1))).startsWith("PAGO DA COMPOSICAO");
        break;
      }
    }
    // Modelos diferentes podem ser mapeados após a prévia, sem qualquer
    // alteração no arquivo original. Nunca adivinhar valores de outras colunas.
    const manual = mapeamentos && typeof mapeamentos === "object" ? mapeamentos[String(indice)] : null;
    const col = (v: any, aceitaZero = false): number => {
      const str = String(v ?? "").trim().toUpperCase();
      const n = /^[A-Z]{1,3}$/.test(str)
        ? [...str].reduce((t, c) => t * 26 + c.charCodeAt(0) - 64, 0)
        : Number(str);
      if (!Number.isSafeInteger(n) || n < (aceitaZero ? 0 : 1) || n > 512) throw Error("Mapeamento de coluna inválido na aba " + sheet.name);
      return n;
    };
    if (manual) {
      escopoCivil = false;
      const linha = Number(manual.cabecalho);
      if (!Number.isInteger(linha) || linha < 1 || linha > 200) throw Error("Linha de cabeçalho inválida na aba " + sheet.name);
      cabecalho = linha;
      colItem = col(manual.item, true);
      colEtapa = col(manual.etapa, true);
      colDescricao = col(manual.descricao);
      colUnidade = col(manual.unidade, true);
      colQuantidade = col(manual.quantidade, true);
      colValor = col(manual.valor);
      precoUnitario = manual.tipoValor !== "total";
      if (!colItem && !colEtapa) throw Error("Informe ITEM ou ETAPA na aba " + sheet.name);
    }
    const medicoes: Medicao[] = [];
    if (cabecalho) {
      for (let r = Math.max(1, cabecalho - 3); r <= cabecalho; r++) {
        for (let c = 1; c <= Math.min(sheet.columnCount, 512); c++) {
          const cell = sheet.getCell(r, c);
        if(cell.isMerged && cell.master.address !== cell.address)continue;
        const t = semAcentos(valor(cell));
          const match = t.match(/MEDICAO\s*(?:N[ºO°.]?\s*)?(\d{1,3})/) || t.match(/(\d{1,3})\s*[ªº°AO.]*\s*MEDICAO/);
          if (match) {
            const n = Number(match[1]);
            if (!medicoes.some(m => m.numero === n)) medicoes.push({ numero: n, coluna: c, titulo: texto(valor(cell)), data: r > 1 ? dataMedicao(sheet.getCell(r - 1, c)) : undefined, prevista: t.includes("PREVISAO") });
          }
        }
      }
    }
    if (manual) {
      medicoes.length = 0;
      const colunas = String(manual.colunasMedicoes || "").split(/[;, ]+/).map(s => s.trim()).filter(Boolean);
      if (!colunas.length || colunas.length > 100) throw Error("Informe de 1 a 100 colunas de medição na aba " + sheet.name);
      const linhaDatas = Number(manual.linhaDatas || 0);
      if (!Number.isInteger(linhaDatas) || linhaDatas < 0 || linhaDatas > 200) throw Error("Informe uma linha de datas válida.");
      const usadas = new Set<number>();
      colunas.forEach((c, index) => {
        const coluna = col(c);
        if (usadas.has(coluna) || coluna === colValor || coluna === colDescricao) throw Error("Colunas de medição repetidas ou incorretas na aba " + sheet.name);
        usadas.add(coluna);
        medicoes.push({ numero: index + 1, coluna, titulo: "MEDIÇÃO " + String(index + 1).padStart(2, "0"), data: linhaDatas ? dataMedicao(sheet.getCell(linhaDatas, coluna)) : undefined });
      });
    }
    medicoes.sort((a, b) => a.numero - b.numero);
    const acumulado = manual?.tipoPercentual === "acumulado";
    const somenteConsulta = escopoCivil || acumulado;
    const itens: Linha[] = [];
    if (cabecalho && medicoes.length) {
      for (let r = cabecalho + 1; r <= Math.min(sheet.rowCount, 3000); r++) {
        if (escopoCivil && /^TOTAL GERAL$/.test(semAcentos(valor(sheet.getCell(r, colItem))))) break;
        const descricao = texto(valor(sheet.getCell(r, colDescricao)));
        const etapa = colEtapa ? texto(valor(sheet.getCell(r, colEtapa))) : "";
        const item = colItem ? texto(valor(sheet.getCell(r, colItem))) : "";
        if (!descricao || (!item && !etapa)) continue;
        const valorBruto = valor(sheet.getCell(r, colValor));
        // Nunca converter preço ausente/inválido silenciosamente para R$ 0,00.
        const textoValor = String(valorBruto ?? "").trim().replace(/[R$\s]/g, "");
        const normalizado = textoValor.includes(",")
          ? textoValor.replace(/\./g, "").replace(",", ".") : textoValor;
        const preco = numeroPlanilha(valorBruto);
        if (!textoValor || !Number.isFinite(preco) || preco < 0) {
          erros.push(sheet.name + " linha " + r + ": valor contratual não numérico. Se houver fórmula, recalcule e salve o Excel antes de importar.");
          continue;
        }
        if (/^(TOTAL|SUBTOTAL|RESUMO|OBSERVACOES)/.test(semAcentos(descricao))) continue;
        const percentuais: Record<string, number> = {};
        const valoresMedidos: Record<string, number> = {};
        let anterior = 0;
        for (const m of medicoes) {
          const calculado = escopoCivil ? valor(sheet.getCell(r, m.coluna + 2)) : null;
          const valorMedido = escopoCivil && calculado !== null && typeof calculado === "object" &&
            percentualPlanilha(sheet.getCell(r, m.coluna)) === 0 ? 0 : calculado;
          if (escopoCivil && (typeof valorMedido !== "number" || !Number.isFinite(valorMedido) || valorMedido < 0)) {
            erros.push(sheet.name + " linha " + r + ": confira o valor medido em " + m.titulo + ".");
          }
          if (escopoCivil && typeof valorMedido === "number") valoresMedidos[String(m.numero)] = valorMedido;
          const celula = sheet.getCell(r, m.coluna);
          const informado = acumulado && valor(celula) === "" ? anterior : percentualPlanilha(celula);
          const n = escopoCivil ? (preco > 0 ? (valoresMedidos[String(m.numero)] || 0) / preco * 100 : 0) : acumulado ? informado - anterior : informado;
          anterior = informado;
          if(!Number.isFinite(n)||n<0||n>100){
            erros.push(sheet.name+" linha "+r+": percentual inválido na coluna "+sheet.getColumn(m.coluna).letter+". Recalcule fórmulas e confira o valor no Excel.");
          }
          percentuais[String(m.numero)] = Number.isFinite(n) ? n : 0;
        }
        if (escopoCivil && preco === 0 && Object.values(valoresMedidos).some(v => v > 0)) {
          avisos.push(sheet.name + " linha " + r + ": valor medido em etapa sem valor vigente.");
        }
        const quantidadeInformada = colQuantidade ? valor(sheet.getCell(r, colQuantidade)) : null;
        const quantidade = quantidadeInformada === null || quantidadeInformada === undefined || quantidadeInformada === ""
          ? 1 : numeroPlanilha(quantidadeInformada);
        if(!Number.isFinite(quantidade)||quantidade<0){erros.push(sheet.name+" linha "+r+": quantidade inválida.");continue;}
        itens.push({
          linha: r, item, etapa, descricao,
          unidade: colUnidade ? texto(valor(sheet.getCell(r, colUnidade))) : "",
          quantidade,
          valor: Math.round(preco * (precoUnitario ? quantidade : 1) * 100) / 100,
          percentuais, ...(escopoCivil ? { valoresMedidos } : {}),
        });
      }
    }
    for (const item of itens) {
      const soma = Object.values(item.percentuais).reduce((total, n) => total + n, 0);
      if (soma > 100.00001) (escopoCivil ? avisos : erros).push(sheet.name + " linha " + item.linha + ": medições ultrapassam 100% do valor da etapa.");
    }
    const reconhecida = Boolean(cabecalho && medicoes.length && itens.length);
    const aviso = reconhecida ? undefined : "Não foi reconhecida uma tabela de serviços com colunas de medição. Esta aba será preservada, sem edição automática.";
    if (aviso) avisos.push(sheet.name + ": " + aviso);
    const amostra: NonNullable<AbaPlanilha["amostra"]> = [];
    const inicioAmostra=cabecalho?Math.max(1,cabecalho-2):1;
    for(let r=inicioAmostra;r<=Math.min(sheet.rowCount,inicioAmostra+24);r++){
      const celulas:{coluna:string;valor:string}[]=[];
      for(let c=1;c<=Math.min(sheet.columnCount,180);c++){
        const cell=sheet.getCell(r,c), v=valor(cell);
        if(v!==""&&v!=null)celulas.push({coluna:sheet.getColumn(c).letter,valor:texto(typeof v==="object"&&cell.type===ExcelJS.ValueType.Formula?"Fórmula sem resultado salvo":v)});
      }
      if(celulas.length)amostra.push({linha:r,celulas});
    }
    abas.push({ indice, amostra, nome: sheet.name, reconhecida, cabecalho, itens, medicoes, ...(somenteConsulta ? { somenteConsulta } : {}), ...(aviso ? { aviso } : {}),
      ...(!manual && cabecalho ? { mapeamento: {cabecalho, item: colItem, etapa: colEtapa, descricao: colDescricao, unidade: colUnidade, quantidade: colQuantidade, valor: colValor, tipoValor: precoUnitario ? "unitario" : "total", colunasMedicoes: medicoes.map(m=>sheet.getColumn(m.coluna).letter).join(",")} } : {}),
    } as any);
  }
  if(erros.length){
    avisos.push(...erros);
    if(!permitirMapeamento)throw Error(erros.slice(0,5).join("\n"));
  }
  if (!abas.some(a => a.reconhecida) && !permitirMapeamento) throw Error("Nenhuma aba reconhecida. Ajuste o mapeamento das colunas na prévia antes de importar.");
  return { hash: createHash("sha256").update(bytes).digest("hex"), abas, avisos, valida: erros.length === 0 };
}
export function aplicarEdicoes(aba: AbaPlanilha, medicoes: Record<string, number>, numeroMedicao: number) {
  const med = aba.medicoes.find(m => m.numero === numeroMedicao);
  if (aba.somenteConsulta) throw Error("Esta aba usa fórmulas ou percentuais acumulados e está disponível para consulta.");
  if (!aba.reconhecida || !med) throw Error("Aba ou medição não encontrada na planilha importada.");
  const rows = new Set(aba.itens.map(i => i.linha));
  for (const [linha, porcentagem] of Object.entries(medicoes)) {
    const r = Number(linha), p = Number(porcentagem);
    if (!Number.isSafeInteger(r) || !rows.has(r) || !Number.isFinite(p) || p < 0 || p > 100) throw Error("Percentual inválido ou linha não reconhecida.");
  }
}
export function evolucaoAtual(linha: Linha, edicoes: Record<string, number>, aba: AbaPlanilha, medicao: number) {
  return Number(edicoes[aba.indice + ":" + linha.linha + ":" + medicao] ?? linha.percentuais[String(medicao)] ?? 0);
}
export async function gerarExcel(bytes: Buffer, abas: AbaPlanilha[], edicoes: Record<string, number>) {
  if (!Object.keys(edicoes).length) return bytes;
  const workbook = await abrirWorkbook(bytes);
  for (const [chave, percent] of Object.entries(edicoes)) {
    const [abaId, linha, numeroMedicao] = chave.split(":").map(Number);
    const aba = abas.find(a => a.indice === abaId && a.reconhecida);
    if (!aba) throw Error("Aba de medição inválida no registro.");
    const med = aba.medicoes.find(m => m.numero === numeroMedicao);
    if (!med || !aba.itens.some(i => i.linha === linha)) throw Error("Coluna ou linha inválida no registro.");
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw Error("Percentual inválido.");
    const sheet = workbook.worksheets[abaId];
    const cell = sheet.getCell(linha, med.coluna);
    if (cell.type === ExcelJS.ValueType.Formula) {
      if(Math.abs(percentualPlanilha(cell)-percent)<0.00001)continue;
      throw Error("A célula de progresso possui fórmula e não pode ser sobrescrita.");
    }
    const antigo=valor(cell);
    const fracionario=String(cell.numFmt||"").includes("%") ||
      !(typeof antigo==="string"&&antigo.includes("%")) &&
      (antigo==="" || numeroPlanilha(antigo)<=1);
    cell.value = fracionario ? percent / 100 : percent;
    if(typeof antigo==="string"&&antigo.includes("%")){cell.value=percent/100;cell.numFmt="0.00%";}
  }
  workbook.calcProperties.fullCalcOnLoad = true;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
