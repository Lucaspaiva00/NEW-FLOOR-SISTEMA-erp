import test from 'node:test';
import assert from 'node:assert/strict';
import {cancelarMedicao,editarObra,salvarPlanejamento,filtrosConsulta,editarMedicao} from '../src/services/obrasOperacao.service';
import {extrairPlanilha,assinarPrevia,importar} from '../src/services/obrasImportacao.service';
import {relatorioHtml} from '../src/services/obrasRelatorio.service';
const lock={$queryRaw:async()=>[]};
test('cancelamento preserva recebimentos e bloqueia evolução dependente',async()=>{
 let updated=false;const m={id:8,empresaId:5,obraId:2,status:'APROVADA',lancamentoId:12};
 const db={...lock,medicaoObra:{findFirst:async(q:any)=>q.where.id===8?m:null,update:async()=>{updated=true;}},lancamentoFinanceiro:{findFirst:async()=>({valorPago:100}),update:async()=>{updated=true;}},pagamentoFinanceiro:{count:async()=>1}};
 await assert.rejects(()=>cancelarMedicao(db,5,8,'Teste'),/Estorne/);assert.equal(updated,false);
 const dep={...db,medicaoObra:{...db.medicaoObra,findFirst:async(q:any)=>q.where.id===8?m:{id:9}}};await assert.rejects(()=>cancelarMedicao(dep,5,8,'Teste'),/posteriores/);
});
test('cancelamento sem recebimento cancela cobrança e registra histórico',async()=>{
 const changes:any[]=[];const db={...lock,medicaoObra:{findFirst:async(q:any)=>q.where.id===8?{id:8,empresaId:5,obraId:2,status:'APROVADA',lancamentoId:12}:null,update:async(q:any)=>{changes.push(q.data);return q.data;}},lancamentoFinanceiro:{findFirst:async()=>({valorPago:0}),update:async(q:any)=>changes.push(q.data)},pagamentoFinanceiro:{count:async()=>0},historicoObra:{create:async(q:any)=>changes.push(q.data)}};
 await cancelarMedicao(db,5,8,'Medição corrigida',20);assert.equal(changes[0].status,'CANCELADO');assert.equal(changes[1].status,'CANCELADA');assert.equal(changes[2].acao,'CANCELAR_MEDICAO');
});
test('contrato com etapa medida não pode reescrever seu valor histórico',async()=>{
 let write=false;const etapa={id:1,nome:'Fundação',valor:20000},o={id:2,clienteId:10,propostaId:null,etapas:[etapa]};
 const db={...lock,obra:{findFirst:async(q:any)=>{assert.equal(q.where.empresaId,5);return o;}},cliente:{findFirst:async()=>({clienteid:10})},medicaoObra:{findMany:async()=>[{itens:[]}]},itemMedicaoObra:{count:async()=>1},etapaObra:{update:async()=>{write=true;}}};
 await assert.rejects(()=>editarObra(db,5,2,{clienteId:10,nome:'Obra',endereco:'Rua',responsavel:'José',inicio:'2026-10-01',valorContrato:30000,etapas:[{...etapa,valor:30000}]}),/histórico/);assert.equal(write,false);
});
test('planejamento separado rejeita sobrealocação entre obras',async()=>{
 let writes=0;const db={...lock,obra:{findFirst:async()=>({id:2,etapas:[]})},colaboradorObra:{findFirst:async()=>({id:3})},planejamentoObra:{findMany:async()=>[{obraId:4,fracao:0.75}],upsert:async()=>{writes++;}}};
 await assert.rejects(()=>salvarPlanejamento(db,5,{obraId:2,colaboradorId:3,data:'2026-10-13',fracao:0.5}),/excede/);assert.equal(writes,0);
});
test('consulta valida limites e período antes de acessar dados',()=>{assert.throws(()=>filtrosConsulta({pagina:'0'}));assert.throws(()=>filtrosConsulta({tamanho:101}));assert.throws(()=>filtrosConsulta({inicio:'2026-10-15',fim:'2026-10-01'}));assert.equal(filtrosConsulta({}).tamanho,15);});
test('uma medição aprovada não pode ser corrigida em lugar de cancelada',async()=>{await assert.rejects(()=>editarMedicao({...lock,medicaoObra:{findFirst:async()=>({status:'APROVADA'})}},5,8,{}),/rascunho/);});
const sheet=(name:string,values:any[][])=>({name,rowCount:values.length,columnCount:Math.max(...values.map(r=>r.length)),getCell:(r:number,c:number)=>({value:values[r-1]?.[c-1]??null,address:String.fromCharCode(64+c)+r})});
test('importação conserva datas virando o ano, faltas e combustível sem data vira aviso',()=>{
 const w={worksheets:[sheet('Controle Quinzenal',[['Funcionário','Função','Diária','31/12','01/01'],[],['ANTONIO','Pedreiro',350,'P','F']]),sheet('CRONOGRAMA',[['DATA','Obra A'],[new Date('2026-12-31'),'Tonho, José']]),sheet('GASOLINA',[['DATA','VALOR','FUNCIONARIO'],[new Date('2026-12-31'),100,'Tonho'],[null,250,'José']])]};
 const p=extrairPlanilha(w,2026);assert.equal(p.colaboradores.length,1);assert.equal(p.presencas[1].data,'2027-01-01');assert.equal(p.presencas[1].fracao,0);assert.equal(p.planejamento.length,2);assert.equal(p.despesas.length,1);assert.equal(p.avisos.length,1);
});
test('prévia assinada não pode ser usada em outra empresa',async()=>{const p={hash:'abc',colaboradores:[],presencas:[],planejamento:[],despesas:[]};await assert.rejects(()=>importar({},6,p,{ano:2026,assinatura:assinarPrevia(5,'abc',2026)}),/prévia/);});
test('reimportação das mesmas linhas não grava novamente',async()=>{
 let writes=0;const p={hash:'abc',colaboradores:[{nome:'ANTONIO',origem:'A3'}],presencas:[],planejamento:[],despesas:[]};const db={...lock,importacaoObra:{findUnique:async()=>({id:1}),create:async()=>{writes++;}}};
 const r=await importar(db,5,p,{ano:2026,assinatura:assinarPrevia(5,'abc',2026),importarColaboradores:true});assert.equal(r.jaImportados,1);assert.equal(writes,0);
});
test('relatório separa execução e caixa e escapa texto do cliente',()=>{
 const html=relatorioHtml({obra:{id:2,nome:'<script>',endereco:'Rua',responsavel:'José',status:'EM_ANDAMENTO',valorContrato:20000},empresa:{nome:'Construtora'},cliente:{razaoSocial:'Cliente'},etapas:[],apontamentos:[],despesas:[],medicoes:[],resumo:{medidoAcumulado:5000,percentual:25,custoTotal:350,recebido:1500,pago:100,saldoContrato:15000,aReceber:3500,aPagar:250}});assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('1.500,00'));assert.ok(html.includes('5.000,00'));assert.ok(html.includes('execução não equivale a recebimento'));
});
