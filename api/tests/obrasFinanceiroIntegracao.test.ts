import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/prisma';
import {fecharDiarias,aprovarMedicao,cancelarMedicao} from '../src/services/obrasOperacao.service';
import {movimentarConta} from '../src/services/pagamentos.service';
import {consolidarObra} from '../src/services/obrasRelatorio.service';
import {despesa} from '../src/controller/ctobra';

test('diárias e medições integram contas, pagamentos parciais e saldos da obra sem duplicar cobrança',async()=>{
 const empresaId=5,obraId=9,financeiro:any[]=[],pagamentos:any[]=[],hist:any[]=[];
 const obra={id:obraId,empresaId,clienteId:3,nome:'Obra de validação',valorContrato:20000,etapas:[{id:1,nome:'Etapa',valor:20000}]};
 const a:any[]=[{id:1,empresaId,obraId,colaboradorId:2,diaria:100,fracao:1,data:new Date('2026-01-10T00:00:00Z'),lancamentoId:null,colaborador:{nome:'Colaborador'} ,obra},
 {id:2,empresaId,obraId,colaboradorId:2,diaria:100,fracao:0.5,data:new Date('2026-01-11T00:00:00Z'),lancamentoId:null,colaborador:{nome:'Colaborador'},obra}];
 const med:any={id:7,empresaId,obraId,obra,status:'RASCUNHO',valor:4000,fim:new Date('2026-01-11T00:00:00Z'),vencimento:new Date('2026-01-20T00:00:00Z'),itens:[{etapaId:1,atual:20}],lancamentoId:null};
 const db:any={$queryRaw:async()=>[],obra:{findFirst:async({where}:any)=>{assert.equal(where.empresaId,empresaId);return obra;}},
 empresa:{findUnique:async()=>({nome:'ConstruArty'})},cliente:{findFirst:async()=>({razaoSocial:'Cliente de teste'})},
 historicoObra:{create:async(q:any)=>hist.push(q.data)},despesaObra:{findMany:async()=>[]},
 apontamentoObra:{findMany:async({where}:any)=>{assert.equal(where.empresaId,empresaId);assert.equal(where.obraId,obraId);return a.filter(r=>where.lancamentoId===null?!r.lancamentoId:true);},updateMany:async({where,data}:any)=>{for(const r of a)if(where.id.in.includes(r.id))Object.assign(r,data);return {count:where.id.in.length};}},
 medicaoObra:{findFirst:async({where}:any)=>{assert.equal(where.empresaId,empresaId);return where.id?.gt?null:med;},update:async({data}:any)=>Object.assign(med,data),findMany:async({where}:any)=>where.status&&where.status!==med.status?[]:[med]},
 contaFinanceira:{findFirst:async({where}:any)=>{assert.equal(where.empresaId,empresaId);return {contafinanceiraid:1,ativo:true};}},
 lancamentoFinanceiro:{create:async({data}:any)=>{const l={...data,lancamentofinanceiroid:financeiro.length+1,status:'ABERTO',valorPago:0};financeiro.push(l);return l;},
 findFirst:async({where}:any)=>financeiro.find(l=>l.lancamentofinanceiroid===where.lancamentofinanceiroid&&l.empresaId===where.empresaId),
 update:async({where,data}:any)=>Object.assign(financeiro.find(l=>l.lancamentofinanceiroid===where.lancamentofinanceiroid),data),
 findMany:async({where}:any)=>financeiro.filter(l=>l.empresaId===where.empresaId&&where.lancamentofinanceiroid.in.includes(l.lancamentofinanceiroid)).map(l=>({...l,pagamentos:pagamentos.filter(p=>p.lancamentoId===l.lancamentofinanceiroid)}))},
 pagamentoFinanceiro:{create:async({data}:any)=>{const p={...data,pagamentofinanceiroid:pagamentos.length+1,estornadoEm:null};pagamentos.push(p);return p;},findMany:async({where}:any)=>pagamentos.filter(p=>p.empresaId===where.empresaId&&p.lancamentoId===where.lancamentoId&&!p.estornadoEm),
 count:async({where}:any)=>pagamentos.filter(p=>p.empresaId===where.empresaId&&p.lancamentoId===where.lancamentoId&&!p.estornadoEm).length,
 updateMany:async({where,data}:any)=>{let count=0;for(const p of pagamentos)if(p.empresaId===where.empresaId&&p.lancamentoId===where.lancamentoId&&!p.estornadoEm){Object.assign(p,data);count++;}return {count};}}};
 db.$transaction=async(fn:any)=>fn(db);
 const pedido={obraId,inicio:'2026-01-10',fim:'2026-01-11',vencimento:'2026-01-20'};
 assert.equal((await fecharDiarias(db,empresaId,pedido)).total,150);assert.equal(financeiro[0].tipo,'SAIDA');assert.ok(a.every(r=>r.lancamentoId===1));
 await assert.rejects(()=>fecharDiarias(db,empresaId,pedido),/Nenhum apontamento/);assert.equal(financeiro.length,1);
 const aprovada=await aprovarMedicao(db,empresaId,7);assert.equal(aprovada.lancamentoId,2);assert.equal(financeiro[1].tipo,'ENTRADA');assert.equal(financeiro[1].clienteId,3);
 await aprovarMedicao(db,empresaId,7);assert.equal(financeiro.length,2);
 await movimentarConta(1,empresaId,{valorPago:50,dataPagamento:'2026-01-15',contaFinanceiraId:1},false,db);
 await movimentarConta(2,empresaId,{valorPago:1000,dataPagamento:'2026-01-15',contaFinanceiraId:1},false,db);
 const resumo=(await consolidarObra(db,empresaId,obraId)).resumo;
 assert.equal(resumo.custoTotal,150);assert.equal(resumo.pago,50);assert.equal(resumo.aPagar,100);assert.equal(resumo.recebido,1000);assert.equal(resumo.aReceber,3000);assert.equal(resumo.saldoContrato,16000);
 await assert.rejects(()=>cancelarMedicao(db,empresaId,7,'Revisão'),/Estorne/);
 await movimentarConta(2,empresaId,{motivo:'Estorno da validação'},true,db);await cancelarMedicao(db,empresaId,7,'Revisão');
 assert.equal(financeiro[1].status,'CANCELADO');const depois=(await consolidarObra(db,empresaId,obraId)).resumo;assert.equal(depois.aReceber,0);assert.equal(depois.recebido,0);assert.equal(depois.aPagar,100);
});

test('registrar despesa da obra gera conta a pagar com o mesmo valor e vínculo',async()=>{
 const original=prisma.$transaction,gravados:any[]=[];let resultado:any,status=200;
 const tx:any={obra:{findFirst:async(q:any)=>{assert.deepEqual(q.where,{id:9,empresaId:5});return {id:9};}},lancamentoFinanceiro:{create:async(q:any)=>{gravados.push(q.data);return {lancamentofinanceiroid:8};}},despesaObra:{create:async(q:any)=>{gravados.push(q.data);return {id:3,...q.data};}}};
 (prisma as any).$transaction=async(fn:any)=>fn(tx);
 const res:any={status(n:number){status=n;return this;},json(d:any){resultado=d;return this;}};
 try{await despesa({empresaId:5,body:{obraId:9,data:'2026-01-10',categoria:'Material',descricao:'Materiais da obra',valor:250}} as any,res);
 assert.equal(status,201);assert.equal(gravados[0].tipo,'SAIDA');assert.equal(gravados[0].origem,'OBRA');assert.equal(gravados[0].valor,250);assert.equal(resultado.lancamentoId,8);assert.equal(resultado.empresaId,5);assert.equal(resultado.obraId,9);
 }finally{prisma.$transaction=original;}
});
