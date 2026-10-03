import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('Dashboard usa faturamento, separa anos e respeita o fuso brasileiro', () => {
 const source=fs.readFileSync('../web/js/dashboard.js','utf8').replace(/carregarDados\(\);\s*$/, '');
 const context=vm.createContext({localStorage:{getItem:()=>JSON.stringify({token:'teste'})},Intl,Date,console});
 vm.runInContext(source,context);vm.runInContext('anoSelecionado=2026;',context);
 const month=(p:any)=>vm.runInContext(`mesFaturamento(${JSON.stringify(p)})`,context);
 assert.equal(month({status:'FATURADA',createdAt:'2025-01-01',dataFaturamento:'2026-10-03T15:00:00Z'}),9);
 assert.equal(month({status:'FATURADA',dataFaturamento:'2025-10-03T15:00:00Z'}),null);
 assert.equal(month({status:'FATURADA',dataFaturamento:'2026-01-01T02:00:00Z'}),null);
 assert.equal(month({status:'FATURADA',dataFaturamento:'2026-02-01T02:00:00Z'}),0);
 assert.equal(month({status:'APROVADA',dataFaturamento:'2026-10-03T15:00:00Z'}),null);
 assert.equal(month({status:'FATURADA'}),null);
 assert.equal(vm.runInContext('valorProposta({subtotal:"2000.50",frete:"100.25"})',context),2100.75);
});
