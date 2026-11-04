import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import prisma from '../src/prisma';
import {lerRetornoSefinSba,validarDestinoSba} from '../src/services/sefinTransmissaoSba.service';
import {transmitirHomologacaoSba,consultarHomologacaoSba,etapasSba} from '../src/controller/cttransmissaoSba';
const idDps='DPS'+'1'.repeat(42),chave='2'.repeat(50);
const xml=(id=idDps,amb='2')=>`<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS${chave}"><nNFSe>123</nNFSe><DPS><infDPS Id="${id}"><tpAmb>${amb}</tpAmb></infDPS></DPS></infNFSe></NFSe>`;
const sucesso=()=>({httpStatus:201,data:{chaveAcesso:chave,nfseXmlGZipB64:gzipSync(Buffer.from(xml())).toString('base64')}});
const nota=()=>({notafiscalid:7,empresaId:2,empresaFiscalId:5,tipo:'NFSE',status:'RASCUNHO',updatedAt:new Date(),propostaId:137,empresa:{slug:'sba'},empresaFiscal:{empresaId:2,ambiente:'HOMOLOGACAO',provedor:'PORTAL_NACIONAL_DIRETO',padraoNfse:'NACIONAL'},payloadExtra:{cLocPrestacao:'3537107'}} as any);

test('destino: jamais produção, New Floor, NF-e ou outro tenant',()=>{
 validarDestinoSba(nota());
 for(const change of [{empresaId:1},{tipo:'NFE'},{empresa:{slug:'new-floor'}},{ambienteEmissao:'PRODUCAO'}])assert.throws(()=>validarDestinoSba({...nota(),...change}));
});
test('retorno só autoriza XML nacional correspondente à DPS e homologação',()=>{
 const ok=lerRetornoSefinSba(sucesso(),idDps);assert.equal(ok.status,'AUTORIZADA');assert.equal(ok.chave,chave);
 for(const [id,amb]of [[idDps,'1'],['DPS'+'3'.repeat(42),'2']]){
  assert.throws(()=>lerRetornoSefinSba({httpStatus:201,data:{chaveAcesso:chave,nfseXmlGZipB64:gzipSync(Buffer.from(xml(id,amb))).toString('base64')}},idDps));
 }
 assert.equal(lerRetornoSefinSba({httpStatus:500,data:{erros:[{Codigo:'E'}]}},idDps).status,'PROCESSANDO');
 assert.equal(lerRetornoSefinSba({httpStatus:400,data:{erros:[{Codigo:'E0120',Descricao:'Rejeição sintética'}]}},idDps).status,'REJEITADA');
 assert.equal(lerRetornoSefinSba({httpStatus:201,data:{chaveAcesso:chave}},idDps).status,'PROCESSANDO');
});

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
   solicitar:async(_:any,method:string)=>{if(method==='POST')calls.post++;return sucesso();},
  });
  const req={empresaId:2,configuracaoSistema:{perfil:'SBA'},params:{id:'7'}};
  await rodar({notaDb,calls,req,resposta,conflitar:()=>{conflito=true;}});
 }finally{
  Object.assign(etapasSba,etapas);
  (prisma.notaFiscal as any).findFirst=old.find;(prisma.notaFiscal as any).updateMany=old.lock;(prisma.notaFiscal as any).update=old.update;(prisma.notaFiscal as any).count=old.count;(prisma.eventoNotaFiscal as any).create=old.evento;(prisma as any).$transaction=old.tx;
 }
}
test('fluxo: sucesso persiste XML e chave; duplo clique não faz segundo POST',async()=>ambiente(async({req,calls,notaDb,resposta})=>{
 const r=resposta();await transmitirHomologacaoSba(req,r);assert.equal(r.body.status,'AUTORIZADA');assert.equal(notaDb.chave,chave);assert.equal(calls.post,1);assert.equal(notaDb.ambienteEmissao,'HOMOLOGACAO');
 await transmitirHomologacaoSba(req,resposta());assert.equal(calls.post,1);
}));
test('timeout conserva PROCESSANDO e consulta 404 não permite reenvio',async()=>ambiente(async({req,calls,notaDb,resposta})=>{
 etapasSba.solicitar=async()=>{calls.post++;throw Error('timeout sintético');};
 const r=resposta();await transmitirHomologacaoSba(req,r);assert.equal(r.code,202);assert.equal(notaDb.status,'PROCESSANDO');
 etapasSba.solicitar=async()=>({httpStatus:404,data:{erros:[{Codigo:'nao_encontrada'}]}});
 const c=resposta();await consultarHomologacaoSba(req,c);assert.equal(c.body.status,'PROCESSANDO');assert.equal(notaDb.status,'PROCESSANDO');assert.equal(calls.post,1);
}));
test('pendência, XSD inválido e edição concorrente nunca transmitem',async()=>ambiente(async({req,calls,resposta,conflitar})=>{
 const prep=etapasSba.preparar;
 etapasSba.preparar=(()=>({pendencias:['Município da nota ausente']})) as any;
 let r=resposta();await transmitirHomologacaoSba(req,r);assert.equal(r.code,422);
 etapasSba.preparar=prep;etapasSba.validar=async()=>({valido:false,erro:'schema sintético'});
 r=resposta();await transmitirHomologacaoSba(req,r);assert.equal(r.code,422);
 etapasSba.validar=async()=>({valido:true});conflitar();r=resposta();await transmitirHomologacaoSba(req,r);assert.equal(r.code,409);assert.equal(calls.post,0);
}));
test('produção e outro perfil são recusados antes da transmissão',async()=>ambiente(async({req,calls,notaDb,resposta})=>{
 notaDb.empresaFiscal.ambiente='PRODUCAO';let r=resposta();await transmitirHomologacaoSba(req,r);assert.equal(r.code,422);
 req.empresaId=1;r=resposta();await transmitirHomologacaoSba(req,r);assert.equal(r.code,403);assert.equal(calls.post,0);
}));

test('falha de auditoria posterior não desfaz autorização persistida',async()=>ambiente(async({req,resposta,notaDb})=>{
 const criar=prisma.eventoNotaFiscal.create;let count=0;
 (prisma.eventoNotaFiscal as any).create=async()=>{if(++count>1)throw Error('falha de auditoria sintética');return {};};
 try{const r=resposta();await transmitirHomologacaoSba(req,r);assert.equal(notaDb.status,'AUTORIZADA');assert.equal(r.body.status,'AUTORIZADA');}finally{(prisma.eventoNotaFiscal as any).create=criar;}
}));
