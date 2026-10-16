import ExcelJS from "exceljs";
import { createHash } from "node:crypto";

const semAcentos = (v: any) => String(v ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
const valor = (cell: any): any => {
  const v = cell?.value;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if (Object.prototype.hasOwnProperty.call(v, "result")) return v.result ?? "";
    if (v.text != null) return v.text;
    if (Array.isArray(v.richText)) return v.richText.map((p: any) => p.text).join("");
  }
  return v ?? "";
};
const texto = (v: any) => String(v ?? "").trim().slice(0, 1200);
const numero = (v: any) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
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
type Medicao = { numero: number; coluna: number; titulo: string };
type Linha = { linha: number; item: string; etapa: string; descricao: string; unidade: string; quantidade: number; valor: number; percentuais: Record<string, number> };
export type AbaPlanilha = {
  indice: number; nome: string; reconhecida: boolean; cabecalho: number;
  itens: Linha[]; medicoes: Medicao[]; aviso?: string;
};
export async function detectarPlanilha(bytes: Buffer, mapeamentos: any = {}, permitirMapeamento = false): Promise<{ hash: string; abas: AbaPlanilha[]; avisos: string[] }> {
  const workbook = await abrirWorkbook(bytes);
  if (workbook.worksheets.length > 20) throw Error("Limite de 20 abas por planilha.");
  const abas: AbaPlanilha[] = [], avisos: string[] = [];
  for (let indice = 0; indice < workbook.worksheets.length; indice++) {
    const sheet = workbook.worksheets[indice];
    let cabecalho = 0, colItem = 0, colEtapa = 0, colDescricao = 0, colUnidade = 0, colQuantidade = 0, colValor = 0;
    for (let r = 1; r <= Math.min(sheet.rowCount, 30); r++) {
      const cols = Math.min(sheet.columnCount, 180);
      let item = 0, etapa = 0, descricao = 0, unidade = 0, qtd = 0, preco = 0;
      for (let c = 1; c <= cols; c++) {
        const t = semAcentos(valor(sheet.getCell(r, c)));
        if (t === "ITEM" || t === "CODIGO") item = c;
        if (t === "ETAPA" || t === "FASE") etapa = c;
        if (t === "DESCRICAO" || t === "DESCRICAO DO SERVICO" || t === "SERVICO") descricao = c;
        if (t === "UNI" || t === "UNIDADE") unidade = c;
        if (t === "QUANTIDADE" || t === "QTD") qtd = c;
        if (t.includes("VALOR UNITARIO") || t === "PRECO UNITARIO" || t === "VALOR TOTAL") preco = c;
      }
      if (descricao && (item || etapa) && preco) {
        cabecalho = r; colItem = item; colEtapa = etapa; colDescricao = descricao;
        colUnidade = unidade; colQuantidade = qtd; colValor = preco;
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
      if (!Number.isSafeInteger(n) || n < (aceitaZero ? 0 : 1) || n > 180) throw Error("Mapeamento de coluna inválido na aba " + sheet.name);
      return n;
    };
    if (manual) {
      const linha = Number(manual.cabecalho);
      if (!Number.isInteger(linha) || linha < 1 || linha > 200) throw Error("Linha de cabeçalho inválida na aba " + sheet.name);
      cabecalho = linha;
      colItem = col(manual.item, true);
      colEtapa = col(manual.etapa, true);
      colDescricao = col(manual.descricao);
      colUnidade = col(manual.unidade, true);
      colQuantidade = col(manual.quantidade, true);
      colValor = col(manual.valor);
      if (!colItem && !colEtapa) throw Error("Informe ITEM ou ETAPA na aba " + sheet.name);
    }
    const medicoes: Medicao[] = [];
    if (cabecalho) {
      for (let r = Math.max(1, cabecalho - 3); r <= cabecalho; r++) {
        for (let c = 1; c <= Math.min(sheet.columnCount, 180); c++) {
          const t = semAcentos(valor(sheet.getCell(r, c)));
          const match = t.match(/MEDICAO\s*(\d{1,3})/);
          if (match) {
            const n = Number(match[1]);
            if (!medicoes.some(m => m.numero === n)) medicoes.push({ numero: n, coluna: c, titulo: texto(valor(sheet.getCell(r, c))) });
          }
        }
      }
    }
    if (manual) {
      medicoes.length = 0;
      const colunas = String(manual.colunasMedicoes || "").split(/[;, ]+/).map(s => s.trim()).filter(Boolean);
      if (!colunas.length || colunas.length > 40) throw Error("Informe de 1 a 40 colunas de medição na aba " + sheet.name);
      const usadas = new Set<number>();
      colunas.forEach((c, index) => {
        const coluna = col(c);
        if (usadas.has(coluna) || coluna === colValor || coluna === colDescricao) throw Error("Colunas de medição repetidas ou incorretas na aba " + sheet.name);
        usadas.add(coluna);
        medicoes.push({ numero: index + 1, coluna, titulo: "MEDIÇÃO " + String(index + 1).padStart(2, "0") });
      });
    }
    medicoes.sort((a, b) => a.numero - b.numero);
    const itens: Linha[] = [];
    if (cabecalho && medicoes.length) {
      for (let r = cabecalho + 1; r <= Math.min(sheet.rowCount, 3000); r++) {
        const descricao = texto(valor(sheet.getCell(r, colDescricao)));
        const etapa = colEtapa ? texto(valor(sheet.getCell(r, colEtapa))) : "";
        const item = colItem ? texto(valor(sheet.getCell(r, colItem))) : "";
        const preco = numero(valor(sheet.getCell(r, colValor)));
        if (!descricao || !item && !etapa || !Number.isFinite(preco)) continue;
        if (/^(TOTAL|SUBTOTAL|RESUMO|OBSERVACOES)/.test(semAcentos(descricao))) continue;
        const percentuais: Record<string, number> = {};
        for (const m of medicoes) {
          const n = numero(valor(sheet.getCell(r, m.coluna)));
          percentuais[String(m.numero)] = Math.round((n <= 1 ? n * 100 : n) * 10000) / 10000;
        }
        itens.push({
          linha: r, item, etapa, descricao,
          unidade: colUnidade ? texto(valor(sheet.getCell(r, colUnidade))) : "",
          quantidade: colQuantidade ? numero(valor(sheet.getCell(r, colQuantidade))) : 1,
          valor: Math.round(preco * 100) / 100,
          percentuais,
        });
      }
    }
    const reconhecida = Boolean(cabecalho && medicoes.length && itens.length);
    const aviso = reconhecida ? undefined : "Não foi reconhecida uma tabela de serviços com colunas de medição. Esta aba será preservada, sem edição automática.";
    if (aviso) avisos.push(sheet.name + ": " + aviso);
    abas.push({ indice, nome: sheet.name, reconhecida, cabecalho, itens, medicoes, ...(aviso ? { aviso } : {}),
      ...(!manual && cabecalho ? { mapeamento: {cabecalho, item: colItem, etapa: colEtapa, descricao: colDescricao, unidade: colUnidade, quantidade: colQuantidade, valor: colValor, colunasMedicoes: medicoes.map(m=>sheet.getColumn(m.coluna).letter).join(",")} } : {}),
    } as any);
  }
  if (!abas.some(a => a.reconhecida) && !permitirMapeamento) throw Error("Nenhuma aba reconhecida. Ajuste o mapeamento das colunas na prévia antes de importar.");
  return { hash: createHash("sha256").update(bytes).digest("hex"), abas, avisos };
}
export function aplicarEdicoes(aba: AbaPlanilha, medicoes: Record<string, number>, numeroMedicao: number) {
  const med = aba.medicoes.find(m => m.numero === numeroMedicao);
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
    if (cell.type === ExcelJS.ValueType.Formula) throw Error("A célula de progresso possui fórmula e não pode ser sobrescrita.");
    cell.value = percent / 100;
  }
  workbook.calcProperties.fullCalcOnLoad = true;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
