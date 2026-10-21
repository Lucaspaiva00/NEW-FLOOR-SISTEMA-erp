import test from "node:test";
import assert from "node:assert/strict";
import { validarFaturamentoExterno, metadataFaturamentoExterno } from "../src/services/faturamentoExterno.service";

const body = () => ({
  origem: "EXTERNA",
  referenciaFiscalExterna: "NFSE-EXTERNA-123",
  dataEmissaoExterna: "2026-10-19",
  formaPagamento: "Boleto",
  condicoesPagamento: "30/60 dias",
  retencoes: 200,
  planoRecebimento: {
    parcelas: 2,
    primeiroVencimento: "2026-11-18",
    frequencia: "MENSAL",
    intervaloDias: 30,
  },
});

test("faturamento externo preserva fonte fiscal, valor liquido e parcelas sem criar nota", () => {
  const p = validarFaturamentoExterno(body(), 1000);
  assert.equal(p.valorLiquido, 800);
  assert.equal(p.planoRecebimento.parcelas, 2);
  assert.equal(p.planoRecebimento.origemFaturamento, "EXTERNO");
  assert.equal(p.planoRecebimento.referenciaFiscalExterna, "NFSE-EXTERNA-123");
  assert.equal(p.formaPagamento, "Boleto");
  assert.equal(p.dataFaturamento.toISOString().slice(0,10), "2026-10-19");
});

test("exige confirmação de emissão externa, dados de pagamento e vencimento", () => {
  assert.throws(() => validarFaturamentoExterno({...body(), origem:"ERP"}, 1000), /fora do ERP/);
  assert.throws(() => validarFaturamentoExterno({...body(), formaPagamento:""}, 1000), /forma de pagamento/);
  assert.throws(() => validarFaturamentoExterno({...body(), planoRecebimento:null}, 1000), /parcelas/);
});

test("não permite retenções inválidas, parcelamento incompatível nem datas falsas", () => {
  assert.throws(() => validarFaturamentoExterno({...body(), retencoes:1001}, 1000), /retenções/);
  assert.throws(() => validarFaturamentoExterno({...body(), dataEmissaoExterna:"2026-02-30"}, 1000), /data válida/);
  assert.throws(() => validarFaturamentoExterno({...body(), planoRecebimento:{...body().planoRecebimento, parcelas:121}},1000), /120 parcelas/);
  assert.throws(() => validarFaturamentoExterno(body(), 0), /valor positivo/);
});

test("somente propostas declaradas como externas recebem identificação", () => {
  const p=validarFaturamentoExterno(body(), 1200);
  assert.equal(metadataFaturamentoExterno(p.planoRecebimento)?.origemFaturamento, "EXTERNO");
  assert.equal(metadataFaturamentoExterno({ parcelas: 2 }), null);
  assert.equal(metadataFaturamentoExterno(null), null);
});
