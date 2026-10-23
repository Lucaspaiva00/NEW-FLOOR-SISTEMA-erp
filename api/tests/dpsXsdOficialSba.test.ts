import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {resolve} from "node:path";
import {estadoXsdOficialSba,validarDpsOficialSba} from "../src/services/validacaoXsdSba.service";

test("compilação do XSD oficial e suas inclusões funciona no validador",context=>{
  if(!estadoXsdOficialSba().disponivel){
    context.skip("Sem pacote oficial: emissão e validação permanecem bloqueadas");return;
  }
  const processo=spawnSync(process.execPath,[resolve(process.cwd(),"scripts","validar-dps-xsd.mjs"),"--schema-check"],{
    input:"",encoding:"utf8",timeout:15000,maxBuffer:12000
  });
  assert.equal(processo.status,0,"Processo XSD precisa terminar corretamente");
  const dados=JSON.parse(processo.stdout);
  assert.equal(dados.schemaCompilado,true,dados.erro||"XSD não foi compilado");
  assert.equal(dados.versao,"PRODREST-v1.01-20261020");
});
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
