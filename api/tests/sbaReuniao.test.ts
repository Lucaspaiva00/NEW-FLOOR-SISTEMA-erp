import {validarArquivoFiscal,baixar} from '../src/controller/ctarquivoFiscal';
import {aplicarRetorno} from '../src/controller/ctfiscal';
import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/prisma';
import {apenasSba,dadosFornecedor,salvar} from '../src/controller/ctfornecedor';
import {create as criarMaterial} from '../src/controller/ctservico';
import {create as criarCliente} from '../src/controller/ctcliente';
import {validarPlanoRecebimento,parcelasRecebimento} from '../src/services/planoRecebimento.service';
import {gerarHtmlSba} from '../src/services/orcamentoSbaHtml.service';
import {calcularComposicao} from '../src/services/orcamentoSba.service';
import {resolverConfiguracao} from '../src/services/configuracaoSistema.service';
function response(){const r:any={statusCode:200,body:null,status(n:number){r.statusCode=n;return r;},json(body:any){r.body=body;return r;}};return r;}
test('SBA: 60 dias corridos calcula vencimento no servidor e imprime parcelas sem custos internos',()=>{
 const plano=validarPlanoRecebimento({parcelas:2,dataBase:'2026-10-12',prazoDias:60,primeiroVencimento:'2000-01-01',frequencia:'DIAS',intervaloDias:30});
 assert.equal(plano!.primeiroVencimento,'2026-12-11');assert.equal(parcelasRecebimento(100.01,plano)[1].vencimento!.toISOString().slice(0,10),'2027-01-10');
 assert.throws(()=>validarPlanoRecebimento({...plano,dataBase:'2026-02-30'}));assert.throws(()=>validarPlanoRecebimento({...plano,prazoDias:-1}));
 const html=gerarHtmlSba({numero:9,subtotal:100.01,planoRecebimento:plano,formaPagamento:'Transferência',condicoesPagamento:'Após entrega',escopo:'',composicaoCustos:{segredo:'CUSTO-INTERNO'}},{razaoSocial:'Cliente'},[]);
 for(const text of ['60 dias corridos','11/12/2026','10/01/2027','50,00','50,01','Transferência'])assert.ok(html.includes(text));assert.ok(!html.includes('CUSTO-INTERNO'));
});
test('SBA: fornecedores valida dados, bloqueia outros perfis e limita edição ao tenant',async()=>{
 assert.throws(()=>dadosFornecedor({nome:'Fornecedor',prazoPagamentoDias:-1}));assert.throws(()=>dadosFornecedor({nome:'Fornecedor',cnpj:'123'}));
 for(const perfil of ['PADRAO','PERSONALIZADO']){const res=response();let next=false;apenasSba({empresaId:7,configuracaoSistema:resolverConfiguracao({perfil})} as any,res,()=>{next=true;});assert.equal(res.statusCode,403);assert.equal(next,false);}
 const original=prisma.fornecedor.updateMany;(prisma.fornecedor as any).updateMany=async({where}:any)=>{assert.deepEqual(where,{fornecedorid:9,empresaId:7});return {count:0};};
 try{const res=response();await salvar({empresaId:7,params:{id:'9'},body:{nome:'Fornecedor'}} as any,res);assert.equal(res.statusCode,404);}finally{prisma.fornecedor.updateMany=original;}
});
test('SBA: código sequencial considera existentes; José conserva código manual',async()=>{
 const original=prisma.$transaction;let lock=0,last:any;
 (prisma as any).$transaction=async(fn:any)=>fn({$queryRaw:async()=>{lock++;return [];},servico:{findMany:async({where}:any)=>{assert.equal(where.empresaId,7);return [{codigo:'MAT-000003'},{codigo:'CUSTOM'}];},create:async({data}:any)=>{last=data;return {servicoid:9,...data};}}});
 try{let res=response();await criarMaterial({empresaId:7,configuracaoSistema:resolverConfiguracao({perfil:'SBA'}),body:{nome:'Chapa',custo:100,dadosMaterial:{custo:100}}} as any,res);assert.equal(res.statusCode,201);assert.equal(last.codigo,'MAT-000004');assert.equal(last.dadosMaterial.codigo,'MAT-000004');assert.equal(lock,1);
 res=response();await criarMaterial({empresaId:7,configuracaoSistema:resolverConfiguracao({perfil:'PERSONALIZADO',composicaoCustos:true}),body:{nome:'Chapa',codigo:'JOSE-001',dadosMaterial:{custo:100}}} as any,res);assert.equal(last.codigo,'JOSE-001');assert.equal(lock,1);
 }finally{prisma.$transaction=original;}
});
test('SBA: condições do cliente são exclusivas e os valores da reunião estão corretos',async()=>{
 const original=prisma.cliente.create;let data:any;(prisma.cliente as any).create=async(args:any)=>{data=args.data;return data;};
 try{for(const perfil of ['SBA','PADRAO','PERSONALIZADO']){const res=response();await criarCliente({empresaId:7,configuracaoSistema:resolverConfiguracao({perfil}),body:{razaoSocial:'Cliente',formaPagamento:'Boleto',condicoesPagamento:'Após entrega',prazoPagamentoDias:60}} as any,res);assert.equal(res.statusCode,201);assert.equal(data.prazoPagamentoDias,perfil==='SBA'?60:undefined);}}finally{prisma.cliente.create=original;}
 const c=calcularComposicao({materiais:[{servicoId:8,quantidade:20,custoUnitario:100}],maoObra:[{dias:2,pessoas:2,horasDia:8,valorHora:37.5}],margem:.6,imposto:.18});assert.equal(c.custoTotal,3200);assert.equal(c.preco,8000);assert.equal(c.valorImposto,1440);assert.equal(c.lucro,3360);assert.equal(c.materiais[0].servicoId,8);
});

test('SBA: arquivos externos validam formato e download é restrito à empresa',async()=>{
 assert.throws(()=>validarArquivoFiscal({base64:Buffer.from('falso').toString('base64')},'pdf'));
 assert.throws(()=>validarArquivoFiscal({base64:Buffer.from('<!DOCTYPE xml>').toString('base64')},'xml'));
 assert.ok(validarArquivoFiscal({nome:'nota.pdf',base64:Buffer.from('%PDF-1.4 test').toString('base64')},'pdf'));
 const original=prisma.arquivoFiscal.findFirst;(prisma.arquivoFiscal as any).findFirst=async({where}:any)=>{assert.deepEqual(where,{arquivofiscalid:2,empresaId:7});return null;};
 try{const res=response();await baixar({empresaId:7,params:{id:'2',tipo:'xml'}} as any,res);assert.equal(res.statusCode,404);}finally{prisma.arquivoFiscal.findFirst=original;}
});
test('SBA: nota autorizada gera parcelas uma vez, com data de faturamento e proteção de tenant',async()=>{
 const originals={nota:prisma.notaFiscal.update,empresa:prisma.empresa.findUnique,transaction:prisma.$transaction};
 let proposta:any={propostaid:8,empresaId:7,status:'APROVADA',clienteId:4,cliente:{razaoSocial:'Cliente'},numero:'8',subtotal:100,frete:0,planoRecebimento:{parcelas:2,primeiroVencimento:'2026-12-11',frequencia:'DIAS',intervaloDias:30}};const rows:any[]=[];
 const tx:any={$queryRaw:async()=>[],proposta:{findFirst:async({where}:any)=>{assert.equal(where.empresaId,7);return {...proposta};},update:async({data}:any)=>{proposta={...proposta,...data};return proposta;}},categoriaFinanceira:{upsert:async()=>({categoriafinanceiraid:1})},lancamentoFinanceiro:{findMany:async()=>rows,updateMany:async()=>({count:0}),upsert:async({where,create,update}:any)=>{let row=rows.find(r=>r.chaveOrigem===where.chaveOrigem);if(row)Object.assign(row,update);else {row={...create,valorPago:0};rows.push(row);}return row;}}};
 (prisma.notaFiscal as any).update=async()=>({notafiscalid:1,empresaId:7,propostaId:8});(prisma.empresa as any).findUnique=async()=>({configuracaoSistema:{perfil:'SBA'}});(prisma as any).$transaction=async(fn:any)=>fn(tx);
 try{await aplicarRetorno(1,'https://example.test',{status:'autorizado'});await aplicarRetorno(1,'https://example.test',{status:'autorizado'});assert.equal(proposta.status,'FATURADA');assert.ok(proposta.dataFaturamento);assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.valor),[50,50]);assert.ok(rows.every(r=>r.empresaId===7));}finally{prisma.notaFiscal.update=originals.nota;prisma.empresa.findUnique=originals.empresa;prisma.$transaction=originals.transaction;}
});
