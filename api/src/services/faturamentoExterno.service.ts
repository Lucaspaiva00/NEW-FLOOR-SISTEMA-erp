import { validarPlanoRecebimento } from "./planoRecebimento.service";

export interface FaturamentoExterno {
  formaPagamento: string;
  condicoesPagamento: string | null;
  planoRecebimento: ReturnType<typeof validarPlanoRecebimento> & {
    origemFaturamento: "EXTERNO";
    referenciaFiscalExterna: string | null;
    dataEmissaoExterna: string;
  };
  valorLiquido: number;
  dataFaturamento: Date;
}

function dataValida(data: unknown): data is string {
  return typeof data === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(data) &&
    !Number.isNaN(new Date(data).getTime()) &&
    new Date(data).toISOString().slice(0, 10) === data;
}

/**
 * Registra apenas o faturamento COMERCIAL e a cobrança de uma nota já
 * emitida FORA do ERP. Não gera documento, não consulta nem chama a Focus.
 * Usa o JSON já existente do plano de recebimento (sem migration).
 */
export function validarFaturamentoExterno(body: any, totalBruto: number): FaturamentoExterno {
  if (!body || body.origem !== "EXTERNA") {
    throw Error("Confirme que a nota fiscal já foi emitida fora do ERP.");
  }
  if (!Number.isFinite(totalBruto) || totalBruto <= 0) {
    throw Error("A proposta precisa ter valor positivo antes de ser faturada.");
  }
  const formaPagamento = String(body.formaPagamento || "").trim();
  if (!formaPagamento || formaPagamento.length > 100) {
    throw Error("Informe a forma de pagamento da cobrança.");
  }
  const condicoesPagamento = String(body.condicoesPagamento || "").trim();
  if (condicoesPagamento.length > 2000) {
    throw Error("As condições de pagamento devem ter até 2.000 caracteres.");
  }
  const referencia = String(body.referenciaFiscalExterna || "").trim();
  if (referencia.length > 120) {
    throw Error("A referência da nota fiscal deve ter até 120 caracteres.");
  }
  const dataEmissao = String(body.dataEmissaoExterna || "").trim();
  if (!dataValida(dataEmissao)) {
    throw Error("Informe a data válida de emissão da nota externa.");
  }
  // Permite retomar faturamentos antigos sem assumir datas fiscais fictícias.
  const retencoesInformadas = body.retencoes === "" || body.retencoes == null ? 0 : Number(body.retencoes);
  if (!Number.isFinite(retencoesInformadas) || retencoesInformadas < 0 || retencoesInformadas > totalBruto) {
    throw Error("As retenções não podem ser negativas nem exceder o valor da proposta.");
  }
  const valorLiquido = Math.round((totalBruto - retencoesInformadas) * 100) / 100;
  if (valorLiquido <= 0) {
    throw Error("O valor líquido a receber deve ser maior que zero. Revise as retenções.");
  }
  const plano = validarPlanoRecebimento(body.planoRecebimento);
  if (!plano) {
    throw Error("Defina a quantidade de parcelas e o primeiro vencimento para gerar contas a receber.");
  }
  if (Math.round(valorLiquido * 100) < plano.parcelas) {
    throw Error("O valor líquido não comporta o número de parcelas informado.");
  }
  return {
    formaPagamento,
    condicoesPagamento: condicoesPagamento || null,
    planoRecebimento: {
      ...plano,
      origemFaturamento: "EXTERNO",
      referenciaFiscalExterna: referencia || null,
      dataEmissaoExterna: dataEmissao,
    },
    valorLiquido,
    dataFaturamento: new Date(dataEmissao + "T12:00:00Z"),
  };
}
export function metadataFaturamentoExterno(plano: any) {
  if (plano && typeof plano === "object" && !Array.isArray(plano) &&
      plano.origemFaturamento === "EXTERNO") {
    return {
      origemFaturamento: "EXTERNO" as const,
      referenciaFiscalExterna: typeof plano.referenciaFiscalExterna === "string" ? plano.referenciaFiscalExterna : null,
      dataEmissaoExterna: typeof plano.dataEmissaoExterna === "string" ? plano.dataEmissaoExterna : null,
    };
  }
  return null;
}
