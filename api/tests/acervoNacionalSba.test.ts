import test from 'node:test';import assert from 'node:assert/strict';import {gzipSync} from 'node:zlib';
import {lerNotaRecebidaAdn} from '../src/services/recebidasAdnSba.service';
import {listarAcervo,situacaoFinanceira,conciliarAcervo,validarFiltros} from '../src/services/acervoNacionalSba.service';
const chave='3'.repeat(50),cnpj='08775345000129',empresa={empresaId:2,empresafiscalid:2,cnpj};
const nota={chave,versao:1,direcao:'EMITIDA',situacao:'recebida',numero:'24',valor:100,dataEmissao:'2026-03-01T12:00:00Z',tomador:'Cliente',cnpjTomador:'47051253000158'};
test('acervo reconhece emitidas e recebidas e não infere pagamento pela idade',()=>{
 const xml=(emit:string,toma:string)=>`<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS${chave}"><nNFSe>24</nNFSe><emit><CNPJ>${emit}</CNPJ><xNome>SBA</xNome></emit><DPS><infDPS><tpAmb>1</tpAmb><dhEmi>2026-03-01T12:00:00Z</dhEmi><toma><CNPJ>${toma}</CNPJ><xNome>Cliente</xNome></toma><vServ>100</vServ></infDPS></DPS></infNFSe></NFSe>`;
 const item=(e:string,t:string)=>({NSU:1,TipoDocumento:'NFSE',ChaveAcesso:chave,ArquivoXml:gzipSync(xml(e,t)).toString('base64')});
 assert.equal(lerNotaRecebidaAdn(item(cnpj,'47051253000158'),cnpj,true)?.direcao,'EMITIDA');assert.equal(lerNotaRecebidaAdn(item('47051253000158',cnpj),cnpj,true)?.direcao,'RECEBIDA');assert.equal(lerNotaRecebidaAdn(item('47051253000158','99999999000199'),cnpj,true),null);
 assert.equal(situacaoFinanceira([]),'NAO_CONCILIADA');assert.equal(situacaoFinanceira([{status:'PAGO',valorPago:100}]),'PAGO');assert.equal(situacaoFinanceira([{status:'PAGO'},{status:'ABERTO'}]),'ABERTO');assert.equal(situacaoFinanceira([{status:'ABERTO',valorPago:20}]),'PARCIAL');
});
test('paginação e filtros consultam acervo persistido com baixa financeira antes de paginar',async()=>{
 const registros=Array.from({length:31},(_,i)=>({dados:{...nota,chave:String(i).padStart(50,'0'),numero:String(i)}}));
 const db:any={$queryRaw:async(q:any)=>{assert.match(q.text,/"empresaId"/);return registros;},notaFiscal:{findMany:async()=>[]},lancamentoFinanceiro:{findMany:async()=>[{lancamentofinanceiroid:1,chaveOrigem:'EMITIDA:2:NFSE_NACIONAL:'+registros[0].dados.chave,tipo:'ENTRADA',status:'PAGO',valor:100,valorPago:100}]}};
 const r=await listarAcervo(db,empresa,{pagina:2});assert.equal(r.total,31);assert.equal(r.documentos.length,6);assert.equal(r.paginas,2);
 const pagos=await listarAcervo(db,empresa,{situacao:'PAGO'});assert.equal(pagos.total,1);assert.equal(pagos.documentos[0].situacaoFinanceira,'PAGO');assert.equal(registros.length,31);
 assert.throws(()=>validarFiltros({pagina:-1}));assert.throws(()=>validarFiltros({direcao:'OUTRO'}));
});
function banco(){let criada:any=null,pagamento:any=null;const tx:any={$queryRaw:async(q:any)=>String(q.text||q).includes('DocumentoRecebidoSba')?[{dados:{...nota}}]:[],notaFiscal:{findMany:async()=>[]},categoriaFinanceira:{upsert:async()=>({categoriafinanceiraid:3})},lancamentoFinanceiro:{findMany:async()=>[],create:async({data}:any)=>{criada={...data,lancamentofinanceiroid:10,valorPago:0};return criada;},findFirst:async()=>criada,update:async({data}:any)=>({...criada,...data})},contaFinanceira:{findFirst:async({where}:any)=>where.empresaId===2&&where.contafinanceiraid===4?{ativo:true}:null},pagamentoFinanceiro:{create:async({data}:any)=>{pagamento=data;},findMany:async()=>pagamento?[pagamento]:[]}};return {tx,db:{$transaction:async(fn:any)=>fn(tx)},criada:()=>criada,pagamento:()=>pagamento};}
test('quitada emitida cria entrada e baixa histórica com data informada; aberta não cria pagamento',async()=>{
 const b=banco();await conciliarAcervo(b.db,empresa,{confirmar:true,chave,acao:'PAGO',vencimento:'2026-03-15',dataPagamento:'2026-03-14',contaFinanceiraId:4},async()=>({httpStatus:200,data:[]}));assert.equal(b.criada().tipo,'ENTRADA');assert.equal(b.pagamento().valor,100);assert.equal(b.pagamento().dataPagamento.toISOString().slice(0,10),'2026-03-14');
 const c=banco();await conciliarAcervo(c.db,empresa,{confirmar:true,chave,acao:'ABERTO',vencimento:'2026-03-15'},async()=>({httpStatus:200,data:[]}));assert.equal(c.criada().status,'ABERTO');assert.equal(c.pagamento(),null);
});
test('cancelamento, duplicidade e documento de outro tenant bloqueiam criação',async()=>{
 const b=banco(),body={confirmar:true,chave,acao:'ABERTO',vencimento:'2026-03-15'};
 await assert.rejects(conciliarAcervo(b.db,empresa,body,async()=>({httpStatus:200,data:[{TipoEvento:'CANCELAMENTO'}]})),/situação atual/);assert.equal(b.criada(),null);
 b.tx.lancamentoFinanceiro.findMany=async()=>[{status:'PAGO'}];await assert.rejects(conciliarAcervo(b.db,empresa,body),/já está conciliada/);
 b.tx.$queryRaw=async()=>[];await assert.rejects(conciliarAcervo(b.db,empresa,body),/não encontrada/);
});
test('vincular preserva baixa anterior e rejeita conta fora do tenant ou valor incompatível',async()=>{
 const b=banco(),body={confirmar:true,chave,acao:'VINCULAR',lancamentoId:8};let salvo=false;
 b.tx.lancamentoFinanceiro.findFirst=async()=>null;await assert.rejects(conciliarAcervo(b.db,empresa,body),/mesmo valor/);
 b.tx.lancamentoFinanceiro.findFirst=async({where}:any)=>{assert.equal(where.empresaId,2);assert.equal(where.tipo,'ENTRADA');return {status:'PAGO',valor:100};};
 b.tx.$queryRaw=async(q:any)=>String(q.text||q).includes('SELECT dados')?[{dados:{...nota}}]:[];b.tx.$executeRaw=async()=>{salvo=true;};await conciliarAcervo(b.db,empresa,body);assert.equal(salvo,true);assert.equal(b.criada(),null);assert.equal(b.pagamento(),null);
});
