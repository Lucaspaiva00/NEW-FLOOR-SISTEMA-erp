import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import prisma from '../src/prisma';
import {transmitirProducaoSba,prepararProducaoSba,etapasSba,consultarProducaoSba} from '../src/controller/ctproducaoSba';
const idDps='DPS'+'1'.repeat(42),chave='2'.repeat(50);
const sucesso=()=>({httpStatus:201,data:{chaveAcesso:chave,nfseXmlGZipB64:gzipSync(Buffer.from(`<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS${chave}"><nNFSe>123</nNFSe><DPS><infDPS Id="${idDps}"><tpAmb>1</tpAmb></infDPS></DPS></infNFSe></NFSe>`)).toString('base64')}});
const nota=()=>({notafiscalid:8,empresaId:2,empresaFiscalId:5,tipo:'NFSE',status:'RASCUNHO',updatedAt:new Date(),propostaId:null,empresa:{slug:'sba'},empresaFiscal:{empresaId:2,ambiente:'PRODUCAO',provedor:'PORTAL_NACIONAL_DIRETO',padraoNfse:'NACIONAL',serieNfse:'42026'},valorServicos:1,valorTotal:1,destinatarioCnpj:'47051253000158',itens:[{descricao:'Teste de emissão',quantidade:1,valorUnitario:1}],payloadExtra:{sbaTesteProducao:true}} as any);
function resposta(){return {code:200,body:null,status(n:number){this.code=n;return this;},json(v:any){this.body=v;return this;}} as any;}
async function ambiente(rodar:(a:any)=>Promise<void>){
 const etapas={...etapasSba};const notaDb=nota();const calls={post:0,eventos:0,financeiro:0};
 const old={find:prisma.notaFiscal.findFirst,lock:prisma.notaFiscal.updateMany,update:prisma.notaFiscal.update,count:prisma.notaFiscal.count,evento:prisma.eventoNotaFiscal.create,tx:prisma.$transaction,proposta:prisma.proposta.findFirst};
 let conflito=false;
 try{
  (prisma.notaFiscal as any).findFirst=async()=>({...notaDb});
  (prisma.notaFiscal as any).count=async()=>0;
  (prisma.notaFiscal as any).updateMany=async({data}:any)=>{
   if(conflito||notaDb.status==='PROCESSANDO')return {count:0};Object.assign(notaDb,data);return {count:1};
  };
  (prisma.notaFiscal as any).update=async({data}:any)=>Object.assign(notaDb,data);
  (prisma.eventoNotaFiscal as any).create=async()=>{calls.eventos++;return {};};
  (prisma.proposta as any).findFirst=async()=>notaDb.proposta;
  (prisma as any).$transaction=async(fn:any)=>fn({notaFiscal:prisma.notaFiscal,proposta:prisma.proposta,$executeRaw:async()=>1,$queryRaw:async()=>[]});
  Object.assign(etapasSba,{
   financeiro:async()=>{calls.financeiro++;},
   padroes:async(_:any,n:any)=>n,
   preparar:()=>({id:idDps,xml:'xml-sintetico',pendencias:[]}),
   assinar:()=>({xmlAssinado:`<DPS xmlns="http://www.sped.fazenda.gov.br/nfse"><infDPS Id="${idDps}"></infDPS><Signature></Signature></DPS>`}),
   validar:async()=>({valido:true}),certificado:async()=>true,
   solicitar:async(_:any,method:string)=>{if(method==='POST'){calls.post++;return sucesso();}return {httpStatus:404,data:{}};},
  });
  const req={empresaId:2,configuracaoSistema:{perfil:'SBA'},params:{id:'8'},body:{confirmacao:'EMITIR_NOTA_REAL_R1'}};
  await rodar({notaDb,calls,req,resposta,conflitar:()=>{conflito=true;}});
 }finally{
  Object.assign(etapasSba,etapas);
  (prisma.notaFiscal as any).findFirst=old.find;(prisma.notaFiscal as any).updateMany=old.lock;(prisma.notaFiscal as any).update=old.update;(prisma.notaFiscal as any).count=old.count;(prisma.eventoNotaFiscal as any).create=old.evento;(prisma as any).$transaction=old.tx;(prisma.proposta as any).findFirst=old.proposta;
 }
}

test('preparação de produção só consulta e ausência de confirmação nunca transmite',async()=>ambiente(async({req,calls,resposta})=>{
 const p=resposta();await prepararProducaoSba(req,p);assert.equal(p.body.notaTransmitida,false);assert.equal(p.body.identificacaoDisponivel,true);assert.equal(calls.post,0);
 delete req.body.confirmacao;const r=resposta();await transmitirProducaoSba(req,r);assert.equal(r.code,422);assert.equal(calls.post,0);
}));
test('produção aprovada faz um POST, persiste ambiente 1 e bloqueia duplo clique',async()=>ambiente(async({req,calls,notaDb,resposta})=>{
 const r=resposta();await transmitirProducaoSba(req,r);assert.equal(r.body.status,'AUTORIZADA');assert.equal(notaDb.ambienteEmissao,'PRODUCAO');assert.equal(calls.post,1);
 await transmitirProducaoSba(req,resposta());assert.equal(calls.post,1);
}));
test('produção sem certeza de DPS disponível nunca transmite',async()=>ambiente(async({req,calls,resposta})=>{
 etapasSba.solicitar=async()=>({httpStatus:403,data:{}});
 const r=resposta();await transmitirProducaoSba(req,r);assert.equal(r.code,409);assert.equal(calls.post,0);
}));

function configurarNormal(a:any){
 const {notaDb,req}=a;delete notaDb.payloadExtra.sbaTesteProducao;
 notaDb.clienteId=10;notaDb.propostaId=137;notaDb.proposta={propostaid:137,empresaId:2,clienteId:10,subtotal:4500.50,frete:0,status:'APROVADA'};
 notaDb.valorTotal=notaDb.valorServicos=4500.50;notaDb.empresa.configuracaoSistema={perfil:'SBA',modulos:{financeiro:true}};
 req.body={confirmacao:'EMITIR_NOTA_REAL',valorConfirmado:4500.50,versaoConfirmada:notaDb.updatedAt.toISOString()};
}
test('proposta normal: confirmação, autorização, sincronização e duplo clique sem novo POST',async()=>ambiente(async a=>{
 configurarNormal(a);const {req,calls,resposta,notaDb}=a;
 const r=resposta();await transmitirProducaoSba(req,r);assert.equal(r.body.status,'AUTORIZADA');assert.equal(r.body.pendenciaFinanceira,false);assert.equal(calls.post,1);assert.equal(calls.financeiro,1);
 await transmitirProducaoSba(req,resposta());assert.equal(calls.post,1);assert.equal(notaDb.ambienteEmissao,'PRODUCAO');
}));
test('confirmação com valor/versão desatualizados não transmite',async()=>ambiente(async a=>{
 configurarNormal(a);a.req.body.valorConfirmado=1;const r=a.resposta();await transmitirProducaoSba(a.req,r);assert.equal(r.code,409);assert.equal(a.calls.post,0);
 a.req.body.valorConfirmado=4500.50;a.req.body.versaoConfirmada='antiga';const v=a.resposta();await transmitirProducaoSba(a.req,v);assert.equal(v.code,409);assert.equal(a.calls.post,0);
}));
test('duplicidade de proposta ou proposta alterada bloqueia antes do POST',async()=>ambiente(async a=>{
 configurarNormal(a);(prisma.notaFiscal as any).count=async()=>1;const r=a.resposta();await transmitirProducaoSba(a.req,r);assert.equal(r.code,409);assert.equal(a.calls.post,0);
 (prisma.notaFiscal as any).count=async()=>0;(prisma.proposta as any).findFirst=async()=>({...a.notaDb.proposta,subtotal:1});const s=a.resposta();await transmitirProducaoSba(a.req,s);assert.equal(s.code,409);assert.equal(a.calls.post,0);
}));
test('falha financeira mantém autorização e consulta reconcilia sem reemitir',async()=>ambiente(async a=>{
 configurarNormal(a);etapasSba.financeiro=async()=>{throw Error('Falha de laboratório');};
 const r=a.resposta();await transmitirProducaoSba(a.req,r);assert.equal(r.body.status,'AUTORIZADA');assert.equal(r.body.pendenciaFinanceira,true);assert.equal(a.notaDb.status,'AUTORIZADA');
 etapasSba.financeiro=async()=>{a.calls.financeiro++;};etapasSba.solicitar=async()=>sucesso();const s=a.resposta();await consultarProducaoSba(a.req,s);assert.equal(s.body.pendenciaFinanceira,false);assert.equal(a.calls.post,1);assert.equal(a.calls.financeiro,1);
}));
test('timeout após envio mantém PROCESSANDO e bloqueia reenvio',async()=>ambiente(async a=>{
 configurarNormal(a);etapasSba.solicitar=async(_:any,m:string)=>{if(m==='POST'){a.calls.post++;throw Error('Timeout de laboratório');}return {httpStatus:404,data:{}};};
 const r=a.resposta();await transmitirProducaoSba(a.req,r);assert.equal(r.code,202);assert.equal(a.notaDb.status,'PROCESSANDO');await transmitirProducaoSba(a.req,a.resposta());assert.equal(a.calls.post,1);assert.equal(a.calls.financeiro,0);
}));
