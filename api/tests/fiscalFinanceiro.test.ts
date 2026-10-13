import test from 'node:test';
import assert from 'node:assert/strict';
import {sincronizarFinanceiroNota,valoresNotaFinanceiro} from '../src/services/fiscalFinanceiro.service';
const nota=()=>({notafiscalid:5,empresaId:7,status:'AUTORIZADA',ambienteEmissao:'PRODUCAO',valorTotal:100.01,valorRetencoes:10,clienteId:2,numero:'123',destinatarioNome:'Cliente',planoRecebimento:{parcelas:3,primeiroVencimento:'2026-11-10',frequencia:'MENSAL'}});
function fake(){const rows:any[]=[],db:any={$queryRaw:async()=>[],categoriaFinanceira:{upsert:async()=>({categoriafinanceiraid:1})},lancamentoFinanceiro:{findMany:async({where}:any)=>{assert.equal(where.empresaId,7);return rows;},updateMany:async({where,data}:any)=>{assert.equal(where.empresaId,7);rows.forEach(r=>Object.assign(r,data));return {count:rows.length};},upsert:async({where,create,update}:any)=>{const row=rows.find(r=>r.chaveOrigem===where.chaveOrigem);if(row){Object.assign(row,update);return row;}const r={...create,valorPago:0};rows.push(r);return r;}}};return {db,rows};}
test('Retenções reduzem o líquido por centavos e rejeitam valores acima do bruto',()=>{assert.deepEqual(valoresNotaFinanceiro(100.01,10),{bruto:100.01,retencoes:10,liquido:90.01});assert.throws(()=>valoresNotaFinanceiro(100,101));assert.throws(()=>valoresNotaFinanceiro(100,-1));});
test('Nota avulsa gera parcelas líquidas sem duplicar recebimentos em consultas repetidas',async()=>{
 const {db,rows}=fake();await sincronizarFinanceiroNota(nota(),db);assert.equal(rows.length,3);assert.equal(rows.reduce((s,r)=>s+Math.round(r.valor*100),0),9001);assert.deepEqual(rows.map(r=>r.valor),[30,30,30.01]);rows[0].valorPago=10;await sincronizarFinanceiroNota(nota(),db);assert.equal(rows.length,3);assert.equal(rows[0].valorPago,10);assert.ok(rows.every(r=>r.origem==='NOTA_FISCAL'&&r.notaFiscalId===5&&r.empresaId===7));
});
test('Cancelamento cancela cobrança e conserva dinheiro recebido; homologação não cria cobrança',async()=>{
 const {db,rows}=fake();await sincronizarFinanceiroNota(nota(),db);rows[0].valorPago=20;await sincronizarFinanceiroNota({...nota(),status:'CANCELADA'},db);assert.ok(rows.every(r=>r.status==='CANCELADO'));assert.equal(rows[0].valorPago,20);const outra=fake();await sincronizarFinanceiroNota({...nota(),ambienteEmissao:'HOMOLOGACAO'},outra.db);assert.equal(outra.rows.length,0);
});
test('Cancelamento da última nota vinculada desfatura a proposta sem excluir seu histórico financeiro',async()=>{
 const {db,rows}=fake();rows.push({origem:'PROPOSTA',valorPago:25,status:'ABERTO'});let atualizada:any;
 db.proposta={findFirst:async({where}:any)=>{assert.equal(where.empresaId,7);return {propostaid:9};},update:async({data}:any)=>{atualizada=data;return data;}};db.notaFiscal={findMany:async({where}:any)=>{assert.deepEqual(where,{empresaId:7,propostaId:9,status:'AUTORIZADA'});return [];}};
 await sincronizarFinanceiroNota({...nota(),propostaId:9,status:'CANCELADA'},db);assert.equal(atualizada.status,'APROVADA');assert.equal(atualizada.dataFaturamento,null);assert.equal(rows[0].status,'CANCELADO');assert.equal(rows[0].valorPago,25);
});
