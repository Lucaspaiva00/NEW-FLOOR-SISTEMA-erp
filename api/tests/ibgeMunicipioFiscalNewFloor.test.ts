import test from "node:test";
import assert from "node:assert/strict";
import { codigoMunicipioIBGE, notaComMunicipioIBGE } from "../src/services/ibgeMunicipioFiscal.service";

test("Campinas/SP usa código 3509502 confirmado no IBGE sem rede", async ()=>{
  assert.equal(await codigoMunicipioIBGE("Campinas","SP"),"3509502");
  assert.equal(await codigoMunicipioIBGE("CAMPINAS","sp"),"3509502");
});
test("New Floor recebe município IBGE no payload virtual; não altera registro original",async()=>{
  const original:any={empresaId:1,tipo:"NFSE",empresaFiscal:{padraoNfse:"NACIONAL"},
    destinatarioCidade:"Campinas",destinatarioEstado:"SP",destinatarioCodigoMunicipio:null};
  const resolvida=await notaComMunicipioIBGE(original);
  assert.equal(resolvida.destinatarioCodigoMunicipio,"3509502");
  assert.equal(original.destinatarioCodigoMunicipio,null);
});
test("SBA e José não sofrem normalizações municipais",async()=>{
  for(const empresaId of [2,5]){
    const nota:any={empresaId,tipo:"NFSE",empresaFiscal:{padraoNfse:"NACIONAL"},
      destinatarioCidade:"Campinas",destinatarioEstado:"SP",destinatarioCodigoMunicipio:null};
    assert.equal(await notaComMunicipioIBGE(nota),nota);
  }
});
test("não substitui código IBGE já informado",async()=>{
  const nota:any={empresaId:1,tipo:"NFSE",empresaFiscal:{padraoNfse:"NACIONAL"},
    destinatarioCidade:"Campinas",destinatarioEstado:"SP",destinatarioCodigoMunicipio:"3509502"};
  assert.equal(await notaComMunicipioIBGE(nota),nota);
});
