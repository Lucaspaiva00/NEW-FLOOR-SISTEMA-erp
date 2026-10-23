import test from "node:test";
import assert from "node:assert/strict";
import {validarParametrosRascunhoSba} from "../src/services/parametrosDpsSba.service";

test("SBA permite rascunho incompleto sem presumir tributação",()=>{
  const extra={testeHomologacao:true,marcador:"SBA_TESTE",cLocPrestacao:"3537107"};
  const resultado=validarParametrosRascunhoSba(extra);
  assert.equal(resultado?.cLocPrestacao,"3537107");
  assert.equal(resultado?.opSimpNac,undefined);
  assert.equal(resultado?.marcador,"SBA_TESTE");
  assert.equal(extra.opSimpNac,undefined);
});
test("SBA aceita códigos conferidos preservando metadados de teste",()=>{
  const resultado=validarParametrosRascunhoSba({
    testeHomologacao:true,cTribNac:"010101",opSimpNac:"3",
    regEspTrib:"0",tribISSQN:"1",tpRetISSQN:"1",indTotTrib:"0",
    cLocPrestacao:"3537107",cNBS:"1.0701.10.00"
  });
  assert.equal(resultado?.indTotTrib,"0");
  assert.equal(resultado?.regEspTrib,"0");
  assert.equal(resultado?.testeHomologacao,true);
});
test("SBA impede campos inválidos sem impedir salvar rascunhos incompletos",()=>{
  assert.throws(()=>validarParametrosRascunhoSba({cTribNac:"12345"}),/cTribNac/);
  assert.throws(()=>validarParametrosRascunhoSba({opSimpNac:"7"}),/opSimpNac/);
  assert.throws(()=>validarParametrosRascunhoSba({tribISSQN:"4",tpRetISSQN:"2"}),/retenção/);
  assert.throws(()=>validarParametrosRascunhoSba({opSimpNac:"2",regEspTrib:"4"}),/MEI/);
  assert.throws(()=>validarParametrosRascunhoSba([]),/objeto JSON/);
});
