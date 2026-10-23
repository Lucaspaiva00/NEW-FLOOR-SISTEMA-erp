import test from "node:test";
import assert from "node:assert/strict";
import {estadoXsdOficialSba,validarDpsOficialSba} from "../src/services/validacaoXsdSba.service";

test("pacote oficial da DPS bloqueia XML estruturalmente incompleto",async context=>{
  if(!estadoXsdOficialSba().disponivel){
    context.skip("gov.br indisponível no build: validação continua bloqueada em produção");
    return;
  }
  const xml='<?xml version="1.0" encoding="UTF-8"?>'+
    '<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">'+
    '<infDPS Id="DPS3509502212345678000190009000000000000743"/></DPS>';
  const resultado=await validarDpsOficialSba(xml);
  assert.equal(resultado.valido,false,
    "XML incompleto nunca pode ser reconhecido como válido no XSD oficial");
  assert.match(resultado.erro||"",/XML|element|Elemento|attribute|schema|XSD|validation|falha|Erro|type/i);
});
test("não aceita XML arbitrário como documento fiscal",async()=>{
  const resultado=await validarDpsOficialSba('<notafalsa/>');
  assert.equal(resultado.valido,false);
});
