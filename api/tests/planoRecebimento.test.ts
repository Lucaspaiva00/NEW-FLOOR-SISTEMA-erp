import test from 'node:test';
import assert from 'node:assert/strict';
import { parcelasRecebimento,validarPlanoRecebimento } from '../src/services/planoRecebimento.service';
import {sincronizarPropostaFaturada} from '../src/services/financeiro.service';
test('Plano mensal preserva o dia, centavos, ano bissexto e rejeita datas inválidas',()=>{
 const p={parcelas:3,primeiroVencimento:'2028-01-31',frequencia:'MENSAL'};
 const rows=parcelasRecebimento(100,p);assert.deepEqual(rows.map(r=>r.vencimento!.toISOString().slice(0,10)),['2028-01-31','2028-02-29','2028-03-31']);assert.deepEqual(rows.map(r=>r.valor),[33.33,33.33,33.34]);
 assert.equal(parcelasRecebimento(100,null)[0].vencimento,null);
 assert.throws(()=>validarPlanoRecebimento({...p,primeiroVencimento:'2026-02-30'}));assert.throws(()=>parcelasRecebimento(0.01,p));
});
test('Faturamento parcelado é idempotente, mantém recebimentos e cancela apenas parcelas excedentes sem recebimento',async()=>{
 let proposta:any={propostaid:8,status:'FATURADA',clienteId:4,cliente:{razaoSocial:'Cliente'},numero:'8',subtotal:100,frete:0,planoRecebimento:{parcelas:3,primeiroVencimento:'2026-10-10',frequencia:'MENSAL'}};
 const rows:any[]=[],db:any={
 $queryRaw:async()=>[],proposta:{findFirst:async({where}:any)=>where.empresaId===7?proposta:null},categoriaFinanceira:{upsert:async()=>({categoriafinanceiraid:1})},
 lancamentoFinanceiro:{findMany:async()=>rows,updateMany:async({where}:any)=>{for(const r of rows)if(!where.chaveOrigem.notIn.includes(r.chaveOrigem)&&r.valorPago===0)r.status='CANCELADO';},upsert:async({where,create,update}:any)=>{let r=rows.find(r=>r.chaveOrigem===where.chaveOrigem);if(r)Object.assign(r,update);else{r={...create,valorPago:0};rows.push(r);}return r;}}
 };
 await sincronizarPropostaFaturada(8,7,db);await sincronizarPropostaFaturada(8,7,db);assert.equal(rows.length,3);assert.equal(rows.reduce((s,r)=>s+Math.round(r.valor*100),0),10000);
 rows[0].valorPago=10;await sincronizarPropostaFaturada(8,7,db);assert.equal(rows[0].valorPago,10);
 proposta.planoRecebimento.parcelas=2;await assert.rejects(sincronizarPropostaFaturada(8,7,db),/Estorne/);
 rows[0].valorPago=0;await sincronizarPropostaFaturada(8,7,db);assert.equal(rows[2].status,'CANCELADO');assert.equal(rows[0].valor,50);
 assert.equal(await sincronizarPropostaFaturada(8,99,db),null);
});
