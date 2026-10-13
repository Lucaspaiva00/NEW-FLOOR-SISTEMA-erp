import test from 'node:test';
import assert from 'node:assert/strict';
import {data,numero,valorMedicao,htmlSeguro} from '../src/services/obras.service';
import {resolverConfiguracao,validarConfiguracao} from '../src/services/configuracaoSistema.service';
import {acesso,aprovar,apontar} from '../src/controller/ctobra';
import prisma from '../src/prisma';

test('obras permanece desabilitado em empresas existentes e depende de financeiro',()=>{
 for(const perfil of ['PADRAO','SBA','PERSONALIZADO'])assert.equal(resolverConfiguracao({perfil}).modulos.obras,false);
 const c=resolverConfiguracao({perfil:'PERSONALIZADO',modulos:{obras:true,financeiro:false}});assert.throws(()=>validarConfiguracao(c),/obras/);
});
test('acesso exige empresa e habilitação explícita',()=>{
 for(const req of [{empresaId:7,configuracaoSistema:resolverConfiguracao({perfil:'SBA'})},{empresaId:null,configuracaoSistema:resolverConfiguracao({modulos:{obras:true}})}]){
  let code=0,next=false;acesso(req as any,{status:(n:number)=>{code=n;return {json:()=>{}}}} as any,()=>{next=true;});assert.equal(code,403);assert.equal(next,false);
 }
});
test('medição cobra apenas a evolução incremental e rejeita regressão',()=>{
 assert.equal(valorMedicao(20000,30,50),4000);assert.equal(valorMedicao(199.99,0,33.33),66.66);
 assert.throws(()=>valorMedicao(10000,50,40));assert.throws(()=>valorMedicao(10000,0,101));
});
test('datas e números inválidos não passam silenciosamente',()=>{assert.throws(()=>data('2026-02-30'));assert.throws(()=>numero(''));assert.throws(()=>numero(Infinity));assert.equal(data('2026-10-12').toISOString().slice(0,10),'2026-10-12');assert.equal(htmlSeguro('<script>'), '&lt;script&gt;');});
test('aprovação repetida não gera uma segunda cobrança e filtra empresa',async()=>{
 const original=prisma.$transaction;let creations=0,where:any;
 (prisma as any).$transaction=async(fn:any)=>fn({$queryRaw:async()=>[],medicaoObra:{findFirst:async(q:any)=>{where=q.where;return {id:12,status:'APROVADA',empresaId:7};}},lancamentoFinanceiro:{create:async()=>{creations++;}}});
 try{await aprovar({empresaId:7,params:{id:'12'}} as any,{json:()=>{},status:()=>{throw Error('Unexpected failure');}} as any);assert.deepEqual(where,{id:12,empresaId:7});assert.equal(creations,0);}finally{prisma.$transaction=original;}
});
test('apontamento impede sobrealocação entre obras e preserva fechamento',async()=>{
 const original=prisma.$transaction;let error='',writes=0;
 (prisma as any).$transaction=async(fn:any)=>fn({$queryRaw:async()=>[],obra:{findFirst:async()=>({id:9,etapas:[]})},colaboradorObra:{findFirst:async()=>({id:4,diaria:300})},apontamentoObra:{findMany:async()=>[{obraId:10,fracao:1}],upsert:async()=>{writes++;}}});
 try{await apontar({empresaId:7,body:{obraId:9,colaboradorId:4,data:'2026-10-12',fracao:1}} as any,{json:()=>{},status:()=>({json:(d:any)=>{error=d.error;}})} as any);assert.match(error,/exceder/);assert.equal(writes,0);}finally{prisma.$transaction=original;}
});
