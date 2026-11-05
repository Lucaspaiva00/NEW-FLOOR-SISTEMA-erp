import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import prisma from '../src/prisma';
import {montarCancelamentoSba,validarMotivoCancelamentoSba,lerCancelamentoSba} from '../src/services/cancelamentoSba.service';
import {cancelarProducaoSba,consultarCancelamentoSba,etapasCancelamentoSba} from '../src/controller/ctcancelamentoSba';
const chave='2'.repeat(50),idDps='DPS'+'1'.repeat(42),cnpj='08775345000129';
const pack=(xml:string)=>gzipSync(Buffer.from(xml)).toString('base64');
function retorno(ch=chave,amb='1',author=cnpj){return {httpStatus:201,data:{eventoXmlGZipB64:pack(`<evento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infEvento Id="EVT${ch}101101001"><verAplic>SefinNacional</verAplic><ambGer>2</ambGer><nSeqEvento>1</nSeqEvento><dhProc>2026-11-05T10:00:00-03:00</dhProc><nDFSe>1</nDFSe><pedRegEvento versao="1.01"><infPedReg Id="PRE${ch}101101"><tpAmb>${amb}</tpAmb><CNPJAutor>${author}</CNPJAutor><chNFSe>${ch}</chNFSe><e101101><xDesc>Cancelamento de NFS-e</xDesc></e101101></infPedReg></pedRegEvento></infEvento><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"/></evento>`)}};}
function nota(){return {notafiscalid:11,empresaId:2,empresaFiscalId:5,clienteId:10,empresa:{slug:'sba'},tipo:'NFSE',status:'AUTORIZADA',numero:'25',chave,updatedAt:new Date('2026-11-05T12:00:00Z'),ambienteEmissao:'PRODUCAO',empresaFiscal:{empresaId:2,provedor:'PORTAL_NACIONAL_DIRETO',padraoNfse:'NACIONAL',ambiente:'PRODUCAO',serieNfse:'42026',cnpj},payloadExtra:{},payloadEnviado:{provedor:'SEFIN_NACIONAL_DIRETO_PRODUCAO',idDps},retornoProvedor:{chaveAcesso:chave,nfseXmlGZipB64:pack(`<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS${chave}"><nNFSe>25</nNFSe><DPS><infDPS Id="${idDps}"><tpAmb>1</tpAmb></infDPS></DPS></infNFSe></NFSe>`)}} as any;}
function res(){return {code:200,body:null,status(n:number){this.code=n;return this;},json(d:any){this.body=d;return this;}} as any;}
async function ambiente(fn:(a:any)=>Promise<void>){
 const n=nota(),eventos:any[]=[],calls={post:0,financeiro:0};const saved={...etapasCancelamentoSba};
 const old={find:prisma.notaFiscal.findFirst,update:prisma.notaFiscal.update,efind:prisma.eventoNotaFiscal.findFirst,ecreate:prisma.eventoNotaFiscal.create,eupdate:prisma.eventoNotaFiscal.update,eupdates:prisma.eventoNotaFiscal.updateMany,tx:prisma.$transaction};
 try{
  (prisma.notaFiscal as any).findFirst=async()=>({...n});(prisma.notaFiscal as any).update=async({data}:any)=>Object.assign(n,data);
  (prisma.eventoNotaFiscal as any).findFirst=async({where}:any)=>[...eventos].reverse().find(e=>Object.entries(where).every(([k,v])=>e[k]===v))||null;
  (prisma.eventoNotaFiscal as any).create=async({data}:any)=>{const e={...data,eventonotafiscalid:eventos.length+1};eventos.push(e);return e;};
  (prisma.eventoNotaFiscal as any).update=async({where,data}:any)=>Object.assign(eventos.find(e=>e.eventonotafiscalid===where.eventonotafiscalid),data);
  (prisma.eventoNotaFiscal as any).updateMany=async({where,data}:any)=>{eventos.filter(e=>Object.entries(where).every(([k,v])=>e[k]===v)).forEach(e=>Object.assign(e,data));return {count:1};};
  (prisma as any).$transaction=async(fn:any)=>fn({notaFiscal:prisma.notaFiscal,eventoNotaFiscal:prisma.eventoNotaFiscal,$queryRaw:async()=>[]});
  Object.assign(etapasCancelamentoSba,{assinar:(x:string)=>({xmlAssinado:x.replace('</pedRegEvento>','<Signature/></pedRegEvento>')}),validar:async()=>({valido:true}),certificado:async()=>true,solicitar:async(_:any,m:string)=>{if(m==='GET')return {httpStatus:404,data:{}};calls.post++;return retorno();},financeiro:async()=>{calls.financeiro++;}});
  const req={empresaId:2,usuario:{id:9},configuracaoSistema:{perfil:'SBA'},params:{id:'11'},body:{confirmacao:'CANCELAR_NFSE_REAL',chaveConfirmada:chave,versaoConfirmada:n.updatedAt.toISOString(),codigoMotivo:'9',justificativa:'Cancelamento de teste autorizado pelo responsável.'}};
  await fn({n,req,eventos,calls});
 }finally{Object.assign(etapasCancelamentoSba,saved);(prisma.notaFiscal as any).findFirst=old.find;(prisma.notaFiscal as any).update=old.update;(prisma.eventoNotaFiscal as any).findFirst=old.efind;(prisma.eventoNotaFiscal as any).create=old.ecreate;(prisma.eventoNotaFiscal as any).update=old.eupdate;(prisma.eventoNotaFiscal as any).updateMany=old.eupdates;(prisma as any).$transaction=old.tx;}
}
test('pedido usa PRE+chave+101101 sem sequencial antigo, fuso e justificativa escapada',()=>{
 const d=montarCancelamentoSba(nota(),'1','Erro na emissão <revisar> & corrigir',new Date('2026-11-05T13:00:00Z'));assert.equal(d.id,'PRE'+chave+'101101');assert.match(d.xml,/<dhEvento>2026-11-05T10:00:00-03:00/);assert.match(d.xml,/&lt;revisar&gt; &amp;/);assert.ok(!d.xml.includes('nPedRegEvento'));
 for(const [c,x]of [['0','justificativa suficientemente longa'],['9','curta'],['9','a'.repeat(256)]])assert.throws(()=>validarMotivoCancelamentoSba(c,x));
});
test('cancelamento só é confirmado por evento da mesma chave, autor, ambiente e tipo',()=>{
 assert.equal(lerCancelamentoSba(retorno(),chave,cnpj).estado,'CONFIRMADO');
 for(const r of [retorno('3'.repeat(50)),retorno(chave,'2'),retorno(chave,'1','12345678000195')])assert.throws(()=>lerCancelamentoSba(r,chave,cnpj));
 assert.equal(lerCancelamentoSba({httpStatus:200,data:{}},chave,cnpj).estado,'PENDENTE');assert.equal(lerCancelamentoSba({httpStatus:500,data:{erro:[{Codigo:'E'}]}},chave,cnpj).estado,'PENDENTE');
});
test('cancela uma vez, preserva XML original e reconcilia o financeiro após confirmação',async()=>ambiente(async a=>{
 const original=JSON.stringify(a.n.retornoProvedor);const r=res();await cancelarProducaoSba(a.req,r);assert.equal(r.body.status,'CANCELADA');assert.equal(a.n.status,'CANCELADA');assert.equal(a.calls.post,1);assert.equal(a.calls.financeiro,1);assert.equal(JSON.stringify(a.n.retornoProvedor),original);assert.equal(a.eventos[0].status,'CONFIRMADO');await cancelarProducaoSba(a.req,res());assert.equal(a.calls.post,1);
}));
test('teste de R$1 cancelado não cria nem altera cobranças',async()=>ambiente(async a=>{a.n.payloadExtra={sbaTesteProducao:true};await cancelarProducaoSba(a.req,res());assert.equal(a.n.status,'CANCELADA');assert.equal(a.calls.financeiro,0);}));
test('timeout e duplo clique não reenviam; consulta recupera confirmação',async()=>ambiente(async a=>{
 etapasCancelamentoSba.solicitar=async(_:any,m:string)=>{if(m==='GET')return {httpStatus:404,data:{}};a.calls.post++;throw Error('Timeout de laboratório');};const r=res();await cancelarProducaoSba(a.req,r);assert.equal(r.code,202);assert.equal(a.n.status,'AUTORIZADA');assert.equal(a.eventos[0].status,'PENDENTE');await cancelarProducaoSba(a.req,res());assert.equal(a.calls.post,1);assert.equal(a.calls.financeiro,0);
 etapasCancelamentoSba.solicitar=async()=>retorno();const q=res();await consultarCancelamentoSba(a.req,q);assert.equal(q.body.status,'CANCELADA');assert.equal(a.eventos[0].status,'CONFIRMADO');assert.equal(a.calls.post,1);
}));
test('rejeição do Portal não cancela a nota nem o financeiro',async()=>ambiente(async a=>{
 etapasCancelamentoSba.solicitar=async(_:any,m:string)=>m==='GET'?{httpStatus:404,data:{}}:{httpStatus:422,data:{erro:[{Codigo:'E',Descricao:'Prazo de cancelamento excedido'}]}};
 const r=res();await cancelarProducaoSba(a.req,r);assert.equal(r.code,422);assert.equal(a.n.status,'AUTORIZADA');assert.equal(a.eventos[0].status,'REJEITADO');assert.equal(a.calls.financeiro,0);
}));
test('falha financeira preserva cancelamento fiscal e consulta tenta reconciliar',async()=>ambiente(async a=>{
 etapasCancelamentoSba.financeiro=async()=>{throw Error('Banco indisponível');};const r=res();await cancelarProducaoSba(a.req,r);assert.equal(a.n.status,'CANCELADA');assert.equal(r.body.pendenciaFinanceira,true);
 etapasCancelamentoSba.financeiro=async()=>{a.calls.financeiro++;};etapasCancelamentoSba.solicitar=async()=>retorno();const q=res();await consultarCancelamentoSba(a.req,q);assert.equal(q.body.pendenciaFinanceira,false);assert.equal(a.calls.financeiro,1);
}));
test('outra empresa, falta de confirmação, versão alterada e XSD inválido bloqueiam envio',async()=>ambiente(async a=>{
 a.req.empresaId=1;const cross=res();await cancelarProducaoSba(a.req,cross);assert.equal(cross.code,403);a.req.empresaId=2;
 a.req.body.confirmacao='';await cancelarProducaoSba(a.req,res());a.req.body.confirmacao='CANCELAR_NFSE_REAL';a.req.body.versaoConfirmada='antiga';await cancelarProducaoSba(a.req,res());a.req.body.versaoConfirmada=a.n.updatedAt.toISOString();etapasCancelamentoSba.validar=async()=>({valido:false,erro:'XSD laboratório'});const r=res();await cancelarProducaoSba(a.req,r);assert.equal(r.code,422);assert.equal(a.calls.post,0);assert.equal(a.eventos.length,0);
}));
