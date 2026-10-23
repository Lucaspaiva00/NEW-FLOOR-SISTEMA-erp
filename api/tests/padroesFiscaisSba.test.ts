import test from "node:test";
import assert from "node:assert/strict";
import { mesclarPadroesDpsSba } from "../src/services/parametrosDpsSba.service";

test("SBA: nota mantém seu valor sobre serviço e empresa",()=>{
  const padraoEmpresa={opSimpNac:"3",regEspTrib:"0",tribISSQN:"1",tpRetISSQN:"1",indTotTrib:"0",cLocPrestacao:"3509502"};
  const padraoServico={cTribNac:"010101",cNBS:"1.0101.00.00"};
  const nota={tribISSQN:"4",tpRetISSQN:"1",cTribNac:"070202",testeHomologacao:true};
  const result=mesclarPadroesDpsSba(padraoEmpresa,padraoServico,nota);
  assert.equal(result?.opSimpNac,"3");
  assert.equal(result?.indTotTrib,"0");
  assert.equal(result?.cTribNac,"070202");
  assert.equal(result?.tribISSQN,"4");
  assert.equal(result?.testeHomologacao,true);
  assert.equal(padraoEmpresa.tribISSQN,"1"); // originais imutáveis
});
test("SBA: serviço preenche classificação ausente na nota",()=>{
  const result=mesclarPadroesDpsSba({opSimpNac:"3"},{cTribNac:"010101"},{
    marcador:"TESTE",sbaServicoId:43
  });
  assert.equal(result?.cTribNac,"010101");
  assert.equal(result?.sbaServicoId,43);
});
test("SBA: configurações incompatíveis não podem passar silenciosamente",()=>{
  assert.throws(()=>mesclarPadroesDpsSba({tribISSQN:"4",tpRetISSQN:"2"},{},{}),/retenção/);
  assert.throws(()=>mesclarPadroesDpsSba({}, {cTribNac:"invalid"}, {}),/cTribNac/);
});
