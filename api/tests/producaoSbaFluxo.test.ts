import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import prisma from '../src/prisma';
import {transmitirProducaoSba,prepararProducaoSba,etapasSba} from '../src/controller/ctproducaoSba';
const idDps='DPS'+'1'.repeat(42),chave='2'.repeat(50);
const sucesso=()=>({httpStatus:201,data:{chaveAcesso:chave,nfseXmlGZipB64:gzipSync(Buffer.from(`<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS${chave}"><nNFSe>123</nNFSe><DPS><infDPS Id="${idDps}"><tpAmb>1</tpAmb></infDPS></DPS></infNFSe></NFSe>`)).toString('base64')}});
const nota=()=>({notafiscalid:8,empresaId:2,empresaFiscalId:5,tipo:'NFSE',status:'RASCUNHO',updatedAt:new Date(),propostaId:null,empresa:{slug:'sba'},empresaFiscal:{empresaId:2,ambiente:'PRODUCAO',provedor:'PORTAL_NACIONAL_DIRETO',padraoNfse:'NACIONAL',serieNfse:'42026'},valorServicos:1,valorTotal:1,destinatarioCnpj:'47051253000158',itens:[{descricao:'Teste de emissão',quantidade:1,valorUnitario:1}],payloadExtra:{sbaTesteProducao:true}} as any);
function resposta(){return {code:200,body:null,status(n:number){this.code=n;return this;},json(v:any){this.body=v;return this;}} as any;}
async function ambiente(rodar:(a:any)=>Promise<void>){
 const etapas={...etapasSba};const notaDb=nota();const calls={post:0,eventos:0};
 const old={find:prisma.notaFiscal.findFirst,lock:prisma.notaFiscal.updateMany,update:prisma.notaFiscal.update,count:prisma.notaFiscal.count,evento:prisma.eventoNotaFiscal.create,tx:prisma.$transaction};
 let conflito=false;
 try{
  (prisma.notaFiscal as any).findFirst=async()=>({...notaDb});
  (prisma.notaFiscal as any).count=async()=>0;
  (prisma.notaFiscal as any).updateMany=async({data}:any)=>{
   if(conflito||notaDb.status==='PROCESSANDO')return {count:0};Object.assign(notaDb,data);return {count:1};
  };
  (prisma.notaFiscal as any).update=async({data}:any)=>Object.assign(notaDb,data);
  (prisma.eventoNotaFiscal as any).create=async()=>{calls.eventos++;return {};};
  (prisma as any).$transaction=async(fn:any)=>fn({notaFiscal:prisma.notaFiscal,$executeRaw:async()=>1});
  Object.assign(etapasSba,{
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
  (prisma.notaFiscal as any).findFirst=old.find;(prisma.notaFiscal as any).updateMany=old.lock;(prisma.notaFiscal as any).update=old.update;(prisma.notaFiscal as any).count=old.count;(prisma.eventoNotaFiscal as any).create=old.evento;(prisma as any).$transaction=old.tx;
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
