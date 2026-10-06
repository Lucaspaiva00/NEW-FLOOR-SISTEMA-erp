import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/prisma';
import { centavos, saldoConta, movimentarConta, validarVinculos } from '../src/services/pagamentos.service';
import { dashboard, fluxo } from '../src/controller/ctfinanceiro';

test('Valores financeiros rejeitam inválidos e calculam centavos e saldo restante',()=>{
 assert.equal(centavos('1000.25'),100025);assert.equal(saldoConta(1000,400),600);
 for(const value of [null,'',NaN,Infinity,-1])assert.throws(()=>centavos(value));
});
test('Pagamentos parciais, quitação, estorno individual e isolamento entre empresas',async()=>{
 const db:any={conta:{lancamentofinanceiroid:1,empresaId:7,status:'ABERTO',valor:1000,valorPago:0},pagamentos:[]};
 const client:any=prisma,original=client.$transaction;
 const tx:any={
  $queryRaw:async()=>[],
  contaFinanceira:{findFirst:async({where}:any)=>where.empresaId===7&&where.contafinanceiraid===9?{ativo:true}:null},
  lancamentoFinanceiro:{findFirst:async({where}:any)=>where.empresaId===db.conta.empresaId?db.conta:null,update:async({data}:any)=>Object.assign(db.conta,data)},
  pagamentoFinanceiro:{
   create:async({data}:any)=>{const p={...data,pagamentofinanceiroid:db.pagamentos.length+1,estornadoEm:null};db.pagamentos.push(p);return p;},
   findMany:async()=>db.pagamentos.filter((p:any)=>!p.estornadoEm),
   updateMany:async({where,data}:any)=>{let count=0;for(const p of db.pagamentos)if(!p.estornadoEm&&(!where.pagamentofinanceiroid||p.pagamentofinanceiroid===where.pagamentofinanceiroid)){Object.assign(p,data);count++;}return {count};}
  }
 };
 client.$transaction=async(fn:any)=>{const snapshot=structuredClone(db);try{return await fn(tx);}catch(e){Object.assign(db,snapshot);throw e;}};
 try{
  const b={valorPago:400,contaFinanceiraId:9,dataPagamento:'2026-01-01'};
  await movimentarConta(1,7,b);assert.equal(db.conta.status,'ABERTO');assert.equal(db.conta.valorPago,400);
  await assert.rejects(()=>movimentarConta(1,7,{...b,valorPago:601}),/saldo restante/);
  await assert.rejects(()=>movimentarConta(1,8,b),/não encontrada/);
  await assert.rejects(()=>movimentarConta(1,7,{...b,contaFinanceiraId:99}),/empresa/);
  await movimentarConta(1,7,{...b,valorPago:600});assert.equal(db.conta.status,'PAGO');assert.equal(db.pagamentos.length,2);
  await assert.rejects(()=>movimentarConta(1,7,b),/quitada/);
  await assert.rejects(()=>movimentarConta(1,7,{},true),/motivo/);
  await movimentarConta(1,7,{motivo:'Pagamento lançado em duplicidade',pagamentoId:1},true);
  assert.equal(db.conta.valorPago,600);assert.equal(db.conta.status,'ABERTO');assert.equal(db.pagamentos.length,2);assert(db.pagamentos[0].estornadoEm);
  await movimentarConta(1,7,{...b,valorPago:400});assert.equal(db.conta.status,'PAGO');assert.equal(db.pagamentos.length,3);
  await movimentarConta(1,7,{motivo:'Revisão'},true);assert.equal(db.conta.valorPago,0);assert.equal(db.conta.status,'ABERTO');
  db.conta.status='CANCELADO';await assert.rejects(()=>movimentarConta(1,7,b),/cancelada/);
 }finally{client.$transaction=original;}
});
test('Dashboard e fluxo contam recebimentos parciais, saldo inicial negativo e pendência por vencimento',async()=>{
 const client:any=prisma, originals=[client.lancamentoFinanceiro.findMany,client.contaFinanceira.findMany,client.pagamentoFinanceiro.findMany];
 const date=new Date();
 client.lancamentoFinanceiro.findMany=async()=>[{tipo:'ENTRADA',valor:1000,valorPago:400,status:'ABERTO',dataVencimento:date,cliente:null}];
 client.contaFinanceira.findMany=async()=>[{saldoInicial:-100}];
 client.pagamentoFinanceiro.findMany=async()=>[{valor:400,dataPagamento:date,estornadoEm:null,lancamento:{tipo:'ENTRADA'}}];
 let response:any;const res:any={json:(v:any)=>response=v,status:()=>res};
 try{await dashboard({empresaId:7,query:{ano:String(date.getFullYear())}} as any,res);assert.equal(response.saldoDisponivel,300);assert.equal(response.contasReceber,600);assert.equal(response.recebidoPorMes.reduce((a:number,b:number)=>a+b,0),400);assert.equal(response.saldoProjetado,900);
 await fluxo({empresaId:7,query:{meses:12}} as any,res);const mes=response.at(-1);assert.equal(mes.entradas,400);assert.equal(mes.previstoReceber,600);
 await fluxo({empresaId:7,query:{meses:1}} as any,res);assert.equal(response.length,1);assert.equal(response[0].entradas,400);
 await fluxo({empresaId:7,query:{inicio:'2020-01-15',fim:'2020-02-05'}} as any,res);assert.equal(response.length,2);assert.equal(response.reduce((sum:number,x:any)=>sum+x.entradas+x.previstoReceber,0),0);
 await fluxo({empresaId:7,query:{inicio:'2026-02-30',fim:'2026-03-01'}} as any,res);assert(response.error);
 await fluxo({empresaId:7,query:{inicio:'2026-03-02',fim:'2026-03-01'}} as any,res);assert(response.error);

 }finally{[client.lancamentoFinanceiro.findMany,client.contaFinanceira.findMany,client.pagamentoFinanceiro.findMany]=originals;}
});
test('Parcelamento conserva centavos e reverte a criação inteira quando uma parcela falha',async()=>{
 const client:any=prisma,original=client.$transaction;
 const {criar}=await import('../src/controller/ctfinanceiro');
 let rows:any[]=[],fail=false;
 client.$transaction=async(fn:any)=>{const before=structuredClone(rows);try{return await fn({lancamentoFinanceiro:{create:async({data}:any)=>{if(fail&&rows.length===2)throw new Error('Falha de gravação');rows.push(data);return data;}}});}catch(e){rows=before;throw e;}};
 let code=0,body:any;const res:any={status:(c:number)=>{code=c;return res;},json:(v:any)=>body=v};
 const req:any={empresaId:7,body:{tipo:'SAIDA',descricao:'Compra',valor:0.10,totalParcelas:6,intervaloDias:30,dataVencimento:'2026-01-15'}};
 try{await criar(req,res);assert.equal(code,201);assert.equal(rows.length,6);assert.equal(rows.reduce((sum,r)=>sum+centavos(r.valor),0),10);assert(rows.every(r=>Number(r.valor)>0));
 rows=[];req.body={...req.body,valor:100,totalParcelas:3,frequenciaParcelas:'MENSAL',dataVencimento:'2028-01-31'};await criar(req,res);assert.equal(code,201);assert.deepEqual(rows.map(r=>r.dataVencimento.toISOString().slice(0,10)),['2028-01-31','2028-02-29','2028-03-31']);
 rows=[];req.body.dataVencimento='2026-01-31';await criar(req,res);assert.deepEqual(rows.map(r=>r.dataVencimento.toISOString().slice(0,10)),['2026-01-31','2026-02-28','2026-03-31']);
 rows=[];req.body.totalParcelas=6;
 rows=[];fail=true;const savedLog=console.error;console.error=()=>{};try{await criar(req,res);}finally{console.error=savedLog;}assert.equal(code,400);assert.equal(rows.length,0);
 }finally{client.$transaction=original;}
});

test('Proposta gera uma única conta por origem, preserva recebimentos e protege o desfaturamento',async()=>{
 const {sincronizarPropostaFaturada,cancelarLancamentoPropostaDesfaturada}=await import('../src/services/financeiro.service');
 let proposta:any={propostaid:42,empresaId:7,status:'FATURADA',numero:'42',subtotal:1000,frete:50,clienteId:9,cliente:{razaoSocial:'Cliente'},formaPagamento:'PIX',condicoesPagamento:'À vista'};
 let conta:any=null;let filtro:any;
 const db:any={
  $queryRaw:async()=>[],
  proposta:{findFirst:async({where}:any)=>where.empresaId===7?proposta:null},
  categoriaFinanceira:{upsert:async()=>({categoriafinanceiraid:3})},
  lancamentoFinanceiro:{findUnique:async()=>conta,upsert:async({create,update}:any)=>conta=conta?{...conta,...update}:{...create,valorPago:0},findFirst:async()=>conta?.valorPago>0?conta:null,updateMany:async({where}:any)=>{filtro=where;return {count:1};}}
 };
 await sincronizarPropostaFaturada(42,7,db);assert.equal(conta.valor,1050);assert.equal(conta.empresaId,7);assert.equal(conta.formaPagamento,'PIX');assert.equal(conta.chaveOrigem,'PROPOSTA:42:1');
 await sincronizarPropostaFaturada(42,7,db);assert.equal(conta.chaveOrigem,'PROPOSTA:42:1');
 conta.valorPago=400;await sincronizarPropostaFaturada(42,7,db);assert.equal(conta.valorPago,400);assert.equal(conta.status,'ABERTO');
 proposta.subtotal=2000;await assert.rejects(sincronizarPropostaFaturada(42,7,db),/recebimentos/);
 await assert.rejects(cancelarLancamentoPropostaDesfaturada(42,7,db),/Estorne/);
 assert.equal(await sincronizarPropostaFaturada(42,8,db),null);
 conta.valorPago=0;await cancelarLancamentoPropostaDesfaturada(42,7,db);assert.equal(filtro.empresaId,7);assert.equal(filtro.valorPago,0);
});
