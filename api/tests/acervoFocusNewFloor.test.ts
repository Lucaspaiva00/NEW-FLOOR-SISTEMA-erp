import test from 'node:test';import assert from 'node:assert/strict';
import {lerFocusProducao,sincronizarRecebidasFocus,conferirSituacaoFocus} from '../src/services/acervoFocusNewFloor.service';
const e={empresaId:1,empresafiscalid:1,cnpj:'46429017000160',provedor:'FOCUS_NFE',tokenProducao:'ficticio',razaoSocial:'New Floor'},chave='3'.repeat(50);
const xml=`<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS${chave}"><nNFSe>123</nNFSe><emit><CNPJ>11111111000111</CNPJ><xNome>Fornecedor</xNome></emit><DPS><infDPS><tpAmb>1</tpAmb><dhEmi>2026-11-01T12:00:00Z</dhEmi><toma><CNPJ>${e.cnpj}</CNPJ></toma><vServ>100</vServ><vLiq>95</vLiq></infDPS></DPS></infNFSe></NFSe>`;
test('Focus usa somente GET de produção e token existente, sem certificado nem parâmetros para outro CNPJ',async()=>{
 let chamadas=0;const fetcher:any=async(url:string,opts:any)=>{chamadas++;assert.equal(url,'https://api.focusnfe.com.br/v2/nfsens_recebidas?cnpj='+e.cnpj);assert.equal(opts.method,'GET');assert.match(opts.headers.Authorization,/^Basic /);assert.equal(opts.pfx,undefined);return new Response('[]',{status:200,headers:{'X-Max-Version':'7'}});};
 const r=await lerFocusProducao(e,'/v2/nfsens_recebidas?cnpj='+e.cnpj,false,fetcher);assert.equal(r.maxVersao,7);await assert.rejects(lerFocusProducao(e,'/v2/nfsens_recebidas?cnpj=99999999000199',false,fetcher),/restrita/);assert.equal(chamadas,1);
 await assert.rejects(lerFocusProducao({...e,empresaId:2},'/v2/nfsens_recebidas?cnpj='+e.cnpj,false,fetcher),/token/);
});
test('Focus salva XML e dados recebidos com cursor por tenant, preservando o acervo em falhas',async()=>{
 const writes:any[]=[],paths:string[]=[];const tx:any={$executeRaw:async(q:any)=>{writes.push(q);return 1;}};const db:any={...tx,$queryRaw:async()=>[{versao:0}],$transaction:async(fn:any)=>fn(tx),notaFiscal:{findMany:async()=>[]}};
 const ler:any=async(_e:any,p:string,isXml:boolean)=>{paths.push(p);return {data:isXml?xml:[{chave_nfse:chave,versao:1,status:'autorizado'}]};};
 await sincronizarRecebidasFocus(db,e,ler);assert.ok(paths.some(p=>p.endsWith('.xml')));assert.ok(writes.some(q=>q.text?.includes('"xmlCompactado"')));assert.ok(writes.some(q=>q.text?.includes('GREATEST')));assert.ok(writes.filter(q=>q.text).every(q=>q.values.includes(1)));
 const r=await sincronizarRecebidasFocus(db,e,async()=>{throw Error('Produto de recebidas não habilitado');});assert.equal(r.falhaRecebidas,true);assert.match(r.aviso,/não habilitado/);
});
test('Focus não marca recebida cancelada como válida para criar cobrança',async()=>{
 assert.equal(await conferirSituacaoFocus({},e,{chave,direcao:'RECEBIDA'},async()=>({data:{status:'cancelado'},maxVersao:0})),false);
 assert.equal(await conferirSituacaoFocus({},e,{chave,direcao:'RECEBIDA'},async()=>({data:{status:'autorizado',chave_nfse:chave},maxVersao:0})),true);
});

test('emitida autorizada sem chave no campo é identificada pelo XML Focus e salva sem reemitir',async()=>{
 const writes:any[]=[];const db:any={$executeRaw:async(q:any)=>{writes.push(q);},$queryRaw:async()=>[{versao:0}],notaFiscal:{findMany:async()=>[{notafiscalid:10,empresaId:1,empresaFiscalId:1,status:'AUTORIZADA',ambienteEmissao:'PRODUCAO',chave:null,caminhoXml:'/arquivos/NFS'+chave+'-nfse.xml',numero:'38',destinatarioNome:'Cliente',valorTotal:1,valorRetencoes:0,dataEmissao:new Date('2026-10-29T12:00:00Z')}]}};
 await sincronizarRecebidasFocus(db,e,async()=>({data:[],maxVersao:0}));const registro=writes.find(q=>q.text?.includes('DocumentoRecebidoSba'));assert.ok(registro);const dados=JSON.parse(registro.values.find((v:any)=>typeof v==='string'&&v.startsWith('{')));assert.equal(dados.chave,chave);assert.equal(dados.notaFiscalId,10);assert.equal(dados.numero,'38');assert.equal(dados.direcao,'EMITIDA');
});
