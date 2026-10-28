import test from "node:test";
import assert from "node:assert/strict";
import {validarPadroesNewFloor,notaComPadroesNewFloor,carregarPadroesNewFloor,combinarPadroesNewFloor} from "../src/services/newFloorFiscalPadroes.service";
import {dispensaIbsCbsSimples2026,problemasNfseNacionalNewFloor} from "../src/services/newFloorNfseNacional.service";
import {buildFocusPayload} from "../src/services/focusNfe.service";
test("padrões normalizam NBS e preservam zero sem aceitar parâmetros arbitrários",()=>{
 assert.deepEqual(validarPadroesNewFloor({codigo_nbs:"1.0107.40.00",percentual_total_tributos_estaduais:0,cnpj_prestador:"bloqueado"}),{codigo_nbs:"101074000",percentual_total_tributos_estaduais:0});
 assert.throws(()=>validarPadroesNewFloor({codigo_nbs:"123"}));
 assert.throws(()=>validarPadroesNewFloor({percentual_total_tributos_federais:101}));
 assert.throws(()=>validarPadroesNewFloor({ibs_cbs_situacao_tributaria:"000"}));
});
test("dispensa IBS/CBS exige competência 2026, ME/EPP e apuração integral pelo Simples",()=>{
 const p={data_competencia:"2026-10-28",codigo_opcao_simples_nacional:3,regime_tributario_simples_nacional:1};
 assert.equal(dispensaIbsCbsSimples2026(p),true);
 for(const v of [{data_competencia:"2027-01-01"},{data_competencia:""},{codigo_opcao_simples_nacional:1},{regime_tributario_simples_nacional:2}])assert.equal(dispensaIbsCbsSimples2026({...p,...v}),false);
});
test("Simples 2026 não exige CST inventado; se informado, o par continua validado",()=>{
 const nota:any={empresaId:1,tipo:"NFSE",dataEmissao:"2026-10-28T12:00:00Z",empresaFiscal:{padraoNfse:"NACIONAL",optanteSimplesNacional:true,regimeTributario:1,regimeApuracaoSimples:1},itens:[{descricao:"Serviço de teste"}],payloadExtra:{codigo_nbs:"1.0107.40.00",percentual_total_tributos_federais:13.45,percentual_total_tributos_estaduais:0,percentual_total_tributos_municipais:3.91}};
 const payload=buildFocusPayload(nota);assert.equal(payload.codigo_nbs,"101074000");assert.equal(payload.ibs_cbs_situacao_tributaria,undefined);
 assert.deepEqual(problemasNfseNacionalNewFloor(nota,payload),[]);
 assert.ok(problemasNfseNacionalNewFloor(nota,{...payload,ibs_cbs_situacao_tributaria:"0"}).some(x=>x.includes("IBS/CBS")));
 assert.ok(problemasNfseNacionalNewFloor(nota,{...payload,data_competencia:"2027-01-01"}).some(x=>x.includes("IBS/CBS")));
});
test("padrões isolados por tenant e emissora; valor explícito da nota prevalece",async(t)=>{
 await assert.rejects(carregarPadroesNewFloor(2,1),/exclusivos/);
 for(const empresaId of [2,5]){const nota={empresaId,tipo:"NFSE"};assert.equal(await notaComPadroesNewFloor(nota),nota);}
 const extra={percentual_total_tributos_federais:5};
 assert.deepEqual(combinarPadroesNewFloor({codigo_nbs:"101074000",percentual_total_tributos_federais:13.45},extra),{codigo_nbs:"101074000",percentual_total_tributos_federais:5});
 assert.deepEqual(extra,{percentual_total_tributos_federais:5});
});
