import test from "node:test";
import assert from "node:assert/strict";
import { gerarHtmlProposta, usarModeloPdfSba } from "../src/services/propostaHtml.service";

test("o modelo SBA fica isolado da New Floor e dos demais perfis", () => {
  assert.equal(usarModeloPdfSba({ slug: "sba", nome: "SBA", configuracaoSistema: null }), true);
  assert.equal(usarModeloPdfSba({ slug: "outra", nome: "SERRALHERIA SBA INDUSTRIA E COMERCIO LTDA", configuracaoSistema: {perfil:"PADRAO"} }), true);
  assert.equal(usarModeloPdfSba({ slug: "outra", nome: "Empresa de teste", configuracaoSistema: {perfil:"SBA"} }), true);
  assert.equal(usarModeloPdfSba({ slug: "new-floor", nome: "NEW FLOOR", configuracaoSistema: {perfil:"PADRAO"} }), false);
  assert.equal(usarModeloPdfSba({ slug: "jose", nome: "José", configuracaoSistema: {perfil:"PERSONALIZADO"} }), false);
  assert.equal(usarModeloPdfSba(null), false);
});

test("orçamento SBA mantém cabeçalho, numeração, observações e tabela exclusiva", async () => {
  const html = await gerarHtmlProposta({
    proposta: {
      empresa: {slug:"sba", nome:"SBA", configuracaoSistema:null},
      numero:"3706",
      subtotal:4250,
      createdAt:"2026-09-30T11:07:14.000Z",
      escopo:"NAO INCLUI - ART E QUAISQUER OUTRAS PECAS E SERVICOS QUE NAO ESTEJAM RELACIONADOS NESTE ORCAMENTO.\nPRAZO DE ENTREGA - A COMBINAR\nIPI ISENTO",
      condicoesPagamento:"PADRÃO CLIENTE",
    },
    cliente: {razaoSocial:"INCOTEC AMÉRICA DO SUL", clienteid:49},
    itens: [{descricao:"SERVICO/MATERIAIS",quantidade:1,unidade:"UN",valorUnitario:4250,subtotal:4250,desconto:0}],
    template: {},
  });
  assert.match(html,/SERRALHERIA SBA INDUSTRIA E COMERCIO LTDA/);
  assert.match(html,/NRO ORÇAMENTO 0003706/);
  assert.match(html,/INCOTEC AMÉRICA DO SUL/);
  assert.match(html,/IPI ISENTO/);
  assert.match(html,/SERVICO\/MATERIAIS/);
  assert.doesNotMatch(html,/NEW FLOOR PISOS E REVESTIMENTOS/);
});
