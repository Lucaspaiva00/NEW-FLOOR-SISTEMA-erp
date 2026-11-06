import test from 'node:test';import assert from 'node:assert/strict';import {gzipSync} from 'node:zlib';
import {lerNotaRecebidaAdn} from '../src/services/recebidasAdnSba.service';
import {listarAcervo,situacaoFinanceira,conciliarAcervo,validarFiltros,automatizarRecebiveisAcervo} from '../src/services/acervoNacionalSba.service';
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

test('automação cria recebível líquido sem vencimento inventado nem baixa, e exige XML líquido confirmado',async()=>{
 const b=banco();b.tx.$queryRaw=async(q:any)=>String(q.text||q).includes('SELECT dados')?[{dados:{...nota,valorLiquido:90}}]:[];
 await conciliarAcervo(b.db,empresa,{confirmar:true,chave,acao:'ABERTO'},async()=>({httpStatus:200,data:[]}),true);
 assert.equal(b.criada().valor,90);assert.equal(b.criada().dataVencimento,null);assert.equal(b.criada().tipo,'ENTRADA');assert.equal(b.pagamento(),null);
 const c=banco();await assert.rejects(conciliarAcervo(c.db,empresa,{confirmar:true,chave,acao:'ABERTO'},async()=>({httpStatus:200,data:[]}),true),/líquido não confirmado/);assert.equal(c.criada(),null);
 const d=banco();d.tx.$queryRaw=async()=>[{dados:{...nota,direcao:'RECEBIDA',valorLiquido:90}}];await assert.rejects(conciliarAcervo(d.db,empresa,{confirmar:true,chave,acao:'ABERTO'},undefined,true),/restrita/);
});
test('automação não recria nem modifica conta já paga e respeita parcelas vinculadas a proposta',async()=>{
 const b=banco();b.tx.lancamentoFinanceiro.findMany=async()=>[{status:'PAGO',valor:90,valorPago:90}];await assert.rejects(conciliarAcervo(b.db,empresa,{confirmar:true,chave,acao:'ABERTO'},undefined,true),/já está conciliada/);assert.equal(b.criada(),null);
 const c=banco();c.tx.notaFiscal.findMany=async()=>[{propostaId:8}];await assert.rejects(conciliarAcervo(c.db,empresa,{confirmar:true,chave,acao:'ABERTO'},undefined,true),/preservar parcelas/);assert.equal(c.criada(),null);
});

test('sincronização automatiza emitidas em lotes limitados e preserva uma conta quitada na repetição',async()=>{
 const b=banco();let transacoes=0,marcadores=0;
 b.tx.$queryRaw=async(q:any)=>String(q.text||q).includes('SELECT dados')?[{dados:{...nota,valorLiquido:90}}]:[];
 const db:any={...b.tx,$transaction:async(fn:any)=>{transacoes++;return fn(b.tx);},$queryRaw:async()=>[{dados:{...nota,valorLiquido:90}}],$executeRaw:async(q:any)=>{assert.match(q.text,/automacaoFinanceira/);marcadores++;},lancamentoFinanceiro:{findMany:async()=>b.criada()?[{...b.criada(),status:'PAGO',valorPago:90}]:[]}};
 const r=await automatizarRecebiveisAcervo(db,empresa,async()=>({httpStatus:200,data:[]}));assert.equal(r.financeiroAutomatico.criadas,1);assert.equal(b.criada().tipo,'ENTRADA');assert.equal(b.pagamento(),null);
 const repetida=await automatizarRecebiveisAcervo(db,empresa);assert.equal(repetida.financeiroAutomatico.existentes,1);assert.equal(transacoes,1);assert.equal(marcadores,2);
 await assert.rejects(automatizarRecebiveisAcervo(db,{empresaId:1}),/apenas para a SBA/);
});

test('conta antiga com mesmo número sem chave fiscal exige vínculo em vez de duplicar receita',async()=>{const b=banco();b.tx.$queryRaw=async(q:any)=>String(q.text||q).includes('SELECT dados')?[{dados:{...nota,valorLiquido:90}}]:[];b.tx.lancamentoFinanceiro.findFirst=async()=>({status:'PAGO',documento:'24'});await assert.rejects(conciliarAcervo(b.db,empresa,{confirmar:true,chave,acao:'ABERTO'},async()=>({httpStatus:200,data:[]}),true),/evitar duplicidade/);assert.equal(b.criada(),null);});

import {situacaoEventosAdn} from '../src/services/situacaoEventosAdn.service';
test('confirmação do tomador preserva validade; cancelamento, rejeição e chave diferente bloqueiam automação',()=>{
 assert.equal(situacaoEventosAdn({httpStatus:200,data:[{TipoEvento:205204,ChaveAcesso:chave}]},chave),true);
 for(const tipo of [101101,105102,105104,305101,203206,999999])assert.equal(situacaoEventosAdn({httpStatus:200,data:[{TipoEvento:tipo,ChaveAcesso:chave}]},chave),false);
 assert.equal(situacaoEventosAdn({httpStatus:200,data:[{TipoEvento:205204,ChaveAcesso:'4'.repeat(50)}]},chave),false);
 assert.equal(situacaoEventosAdn({httpStatus:200,data:[{}]},chave),false);
 const xml=(codigo:string,key=chave)=>`<evento xmlns="http://www.sped.fazenda.gov.br/nfse"><infEvento><chNFSe>${key}</chNFSe><tpAmb>1</tpAmb><e${codigo}/></infEvento></evento>`;
 const encoded=(s:string)=>gzipSync(s).toString('base64');
 assert.equal(situacaoEventosAdn({httpStatus:200,data:[{ArquivoXml:encoded(xml('205204'))}]},chave),true);
 assert.equal(situacaoEventosAdn({httpStatus:200,data:{StatusProcessamento:'DOCUMENTOS_LOCALIZADOS',LoteDFe:[{ArquivoXml:encoded(xml('205204'))}]}},chave),true);
 assert.equal(situacaoEventosAdn({httpStatus:200,data:[{ArquivoXml:encoded(xml('101101'))}]},chave),false);
 assert.equal(situacaoEventosAdn({httpStatus:200,data:[{ArquivoXml:encoded(xml('205204','4'.repeat(50)))}]},chave),false);
});

test('ADN retorna a NFS-e original junto dos eventos: aceita a nota correta, mas não oculta cancelamento nem rejeição',()=>{
 const xml=(key=chave)=>`<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS${key}"><DPS><infDPS><tpAmb>1</tpAmb></infDPS></DPS></infNFSe></NFSe>`;
 const original={ArquivoXml:gzipSync(xml()).toString('base64')};
 assert.equal(situacaoEventosAdn({httpStatus:200,data:{StatusProcessamento:'DOCUMENTOS_LOCALIZADOS',LoteDFe:[original]}},chave),true);
 const cancelado={ArquivoXml:gzipSync(`<evento xmlns="http://www.sped.fazenda.gov.br/nfse"><infEvento><chNFSe>${chave}</chNFSe><tpAmb>1</tpAmb><e101101/></infEvento></evento>`).toString('base64')};
 assert.equal(situacaoEventosAdn({httpStatus:200,data:{StatusProcessamento:'DOCUMENTOS_LOCALIZADOS',LoteDFe:[original,cancelado]}},chave),false);
 assert.equal(situacaoEventosAdn({httpStatus:200,data:{StatusProcessamento:'REJEICAO',LoteDFe:[]}},chave),false);
 assert.equal(situacaoEventosAdn({httpStatus:200,data:{LoteDFe:[{ArquivoXml:gzipSync(xml('4'.repeat(50))).toString('base64')}]}},chave),false);
});

test('mesmo número em outro ano com chave fiscal própria não bloqueia uma nota diferente',async()=>{
 const b=banco();b.tx.$queryRaw=async(q:any)=>String(q.text||q).includes('SELECT dados')?[{dados:{...nota,valorLiquido:90}}]:[];
 b.tx.lancamentoFinanceiro.findFirst=async({where}:any)=>{if(where?.documento){assert.equal(where.notaFiscalId,null);assert.equal(where.propostaId,null);assert.equal(where.OR[1].NOT.OR[0].chaveOrigem.startsWith,'EMITIDA:');return null;}return b.criada();};
 await conciliarAcervo(b.db,empresa,{confirmar:true,chave,acao:'ABERTO'},async()=>({httpStatus:200,data:[]}),true);assert.equal(b.criada().valor,90);
});
