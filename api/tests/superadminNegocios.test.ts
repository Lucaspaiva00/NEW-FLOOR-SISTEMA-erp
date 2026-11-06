import test from 'node:test';import assert from 'node:assert/strict';import {filtrosNegocios,consolidarNegocios,obterNegocios,baseDetalheNegocios,detalhesNegocios} from '../src/services/superadminNegocios.service';import {somenteSuperAdmin} from '../src/controller/ctsuperadmin';
test('datas seguem dias de São Paulo, fim é exclusivo e filtros inválidos são rejeitados',()=>{
 const f=filtrosNegocios({empresaId:'2',inicio:'2026-11-01',fim:'2026-11-06'});assert.equal(f.inicio?.toISOString(),'2026-11-01T03:00:00.000Z');assert.equal(f.fim?.toISOString(),'2026-11-07T03:00:00.000Z');
 for(const q of [{empresaId:'0'},{empresaId:'2 OR 1=1'},{inicio:'2026-02-30',fim:'2026-03-01'},{inicio:'2026-11-06',fim:'2026-11-01'},{inicio:'2026-01-01'},{pagina:0}])assert.throws(()=>filtrosNegocios(q));
 assert.equal(filtrosNegocios({}).inicio,null);
});
test('consolidação separa cadastros, faturamento, caixa e lucro desconhecido sem somar recebimento ao faturamento',()=>{
 const r=consolidarNegocios([{empresaid:1,nome:'A',ativo:true},{empresaid:2,nome:'B',ativo:true}], [{empresaId:1,clientes:2,contatosEmail:15,telefones:3},{empresaId:2,clientes:5,contatosEmail:100,telefones:20}], [{empresaId:1,orcamentos:4,valorOrcamentos:'1000',faturadas:2,valorFaturado:'500.50',faturadasComCustos:1,semCustos:1,lucroEstimado:'-10.25'},{empresaId:2,orcamentos:8,faturadas:1,valorFaturado:'100',semCustos:1,lucroEstimado:null}], [{empresaId:1,aReceber:'200',aPagar:'50'}],[{empresaId:1,recebido:'300.25',pago:'125.10'}]);
 assert.equal(r.total.clientes,7);assert.equal(r.total.contatosEmail,115);assert.equal(r.total.valorFaturado,600.5);assert.equal(r.total.recebido,300.25);assert.equal(r.total.saldoCaixa,175.15);assert.equal(r.total.lucroEstimado,-10.25);assert.equal(r.total.semCustos,2);assert.equal(r.empresas[1].lucroEstimado,null);
 assert.equal(consolidarNegocios([{empresaid:2}],[],[],[],[]).total.lucroEstimado,null);
});
test('resumo e detalhes usam os mesmos filtros e consultas de leitura; baixas estornadas e canceladas ficam fora',async()=>{
 const queries:any[]=[];const db={empresa:{findMany:async()=>[{empresaid:1,nome:'A'},{empresaid:2,nome:'SBA'}]},$queryRaw:async(q:any)=>{queries.push(q);if(q.text.includes('AS clientes'))return [{empresaId:2,clientes:3,contatosEmail:20}];return [];}};
 const f=filtrosNegocios({empresaId:'2',inicio:'2026-11-01',fim:'2026-11-06'}),r=await obterNegocios(db,f);assert.equal(r.empresas.length,1);assert.equal(r.empresas[0].empresaId,2);assert.equal(r.total.clientes,3);assert.equal(r.empresasDisponiveis.length,2);
 const financeiro=queries.find(q=>q.text.includes('WITH movimentos'));assert.match(financeiro.text,/"estornadoEm" IS NULL/);assert.match(financeiro.text,/NOT EXISTS/);assert.match(financeiro.text,/status<>'CANCELADO'/);assert.ok(financeiro.values.includes(2));assert.ok(financeiro.values.some((v:any)=>v===f.inicio));
 assert.match(queries[0].text,/jsonb_array_elements/);assert.match(queries[0].text,/GROUP BY.*x.tipo,x.valor/s);
 for(const tipo of ['clientes','contatos','orcamentos','aprovadas','faturadas','lucro','recebido','pago','areceber']){const q=baseDetalheNegocios(tipo,f);assert.ok(q.values.includes(2));assert.doesNotMatch(q.text,/UPDATE |DELETE |INSERT |certificado|senha/i);}
 assert.throws(()=>baseDetalheNegocios('qualquer',f));
 const calls:any[]=[];const d=await detalhesNegocios({$queryRaw:async(q:any)=>{calls.push(q);return q.text.includes('COUNT(*)')?[{total:75}]:[{id:'1',empresaId:2,titulo:'Orçamento',valor:'125.50'}];}},'faturadas',{...f,pagina:2});assert.equal(d.linhas[0].valor,125.5);assert.equal(d.paginas,2);assert.ok(calls[0].values.includes(50));
});
test('administrador de cliente não passa pelo acesso exclusivo do superadmin',async()=>{
 let status=0,next=false;const res={status(n:number){status=n;return this;},json(){}};await somenteSuperAdmin({usuario:{role:'ADMIN',id:1}} as any,res as any,()=>{next=true;});assert.equal(status,403);assert.equal(next,false);
});
