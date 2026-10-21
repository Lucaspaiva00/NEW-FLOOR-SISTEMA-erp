import test from "node:test";
import assert from "node:assert/strict";
import { textoDescricaoNacional, problemasNfseNacionalNewFloor } from "../src/services/newFloorNfseNacional.service";
import { buildFocusPayload } from "../src/services/focusNfe.service";

const nota = (empresaId:number):any => ({
  empresaId, tipo:"NFSE",padraoNfseEmissao:"NACIONAL",
  empresaFiscal:{padraoNfse:"NACIONAL",codigoMunicipioIbge:"3509502",cnpj:"11444777000161",
    optanteSimplesNacional:true,regimeTributario:3},
  destinatarioCnpj:"47051253000158",
  destinatarioNome:"Empresa destinatária",
  destinatarioCep:"13920-000",
  destinatarioCodigoMunicipio:null,
  valorServicos:200,
  informacoesAdicionais:"<p><strong>Descrição de serviço</strong></p>",
  itemListaServico:"010101",
  payloadExtra:null
});
test("remove marcação HTML sem cortar texto fiscal",()=>{
 assert.equal(textoDescricaoNacional("<p>Teste &amp; exemplo</p><p>Outro</p>"),"Teste & exemplo\nOutro");
});
test("New Floor bloqueia município ausente, descrição grande e tributação sem parâmetros",()=>{
 const input=nota(1);
 input.informacoesAdicionais="<p>"+"A".repeat(2100)+"</p>";
 const p=buildFocusPayload(input);
 assert.equal(p.descricao_servico.length,2100);
 const errors=problemasNfseNacionalNewFloor(input,p);
 assert.ok(errors.some(x=>x.includes("município do tomador")));
 assert.ok(errors.some(x=>x.includes("2.000")));
 assert.ok(errors.some(x=>x.includes("grupo 'trib'")));
});
test("documentos da SBA e José mantêm fluxo anterior",()=>{
 for(const empresaId of [2,5]){
  const input=nota(empresaId);
  assert.deepEqual(problemasNfseNacionalNewFloor(input,buildFocusPayload(input)),[]);
 }
});
test("com município e dados tributários legítimos não apresenta os três erros identificados",()=>{
 const input=nota(1);
 input.destinatarioCodigoMunicipio="3509502";
 input.payloadExtra={situacao_tributaria_pis_cofins:"06",percentual_total_tributos_federais:3.5};
 const errors=problemasNfseNacionalNewFloor(input,buildFocusPayload(input));
 assert.deepEqual(errors,[]);
});
