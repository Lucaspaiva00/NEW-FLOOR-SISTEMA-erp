import test from "node:test";
import assert from "node:assert/strict";
import { conferirNotaFiscal } from "../src/services/fiscalValidacao.service";
import { buildFocusPayload } from "../src/services/focusNfe.service";

function notaBase(empresaId = 1) {
 return {
  empresaId, tipo: "NFSE", status: "RASCUNHO",
  empresaFiscal: {
   ativo: true, razaoSocial: "Empresa demonstrativa", cnpj: "11444777000161",
   ambiente: "HOMOLOGACAO", tokenHomologacao: "TOKEN_FICTICIO_TESTE", regimeTributario: 1,
   codigoMunicipioIbge: "3509502", padraoNfse: "MUNICIPAL", itemListaServicoPadrao: "1.01",
  },
  cliente: { inscricaoEstadual: "" },
  destinatarioNome: "Empresa cliente",
  destinatarioCnpj: "47051253000158", destinatarioCpf: null, destinatarioIe: "",
  destinatarioEmail: "cliente@example.org;copia@example.org",
  destinatarioCodigoMunicipio: "3509502",
  valorTotal: 100, valorServicos: 100, valorProdutos: 0,
  valorFrete: 0, valorSeguro: 0, valorOutrasDespesas: 0, valorDesconto: 0,
  itens: [{ descricao: "Serviço", quantidade: 1, valorUnitario: 100, valorBruto: 100, valorDesconto: 0 }]
 };
}

test("New Floor impede qualquer emissão sem IE no cadastro do cliente", () => {
 const nota = notaBase(1);
 const erros = conferirNotaFiscal(nota).erros;
 assert.ok(erros.some(e => e.includes("cadastre a inscrição estadual")));
 assert.ok(erros.some(e => e.includes("na nota antes de emitir")));
});

test("SBA e José não herdam exigências exclusivas da New Floor", () => {
 for(const empresaId of [2,5]){
  const erros=conferirNotaFiscal(notaBase(empresaId)).erros;
  assert.ok(!erros.some(e=>e.includes("New Floor")));
 }
});

test("New Floor exige que a IE da nota coincida com a do cliente", () => {
 const nota=notaBase(1);
 nota.cliente.inscricaoEstadual="123456789";
 nota.destinatarioIe="987654321";
 assert.ok(conferirNotaFiscal(nota).erros.some(e=>e.includes("corresponder ao cadastro")));
 nota.destinatarioIe="123456789";
 assert.ok(!conferirNotaFiscal(nota).erros.some(e=>e.includes("New Floor")));
});

test("Payload de NFS-e usa só email primário na Focus e preserva modelo SBA", () => {
 const nfe = notaBase(1);
 assert.equal(buildFocusPayload(nfe).tomador.email, "cliente@example.org");
 const sba=notaBase(2);
 assert.equal(buildFocusPayload(sba).tomador.email, "cliente@example.org;copia@example.org");
});
