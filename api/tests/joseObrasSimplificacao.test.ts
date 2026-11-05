import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {detectarPlanilha, gerarExcel} from '../src/services/planilhasMedicaoJose.service';
import {apontarPeriodoJose} from '../src/services/maoObraJose.service';
async function modelo(){
 const w=new ExcelJS.Workbook(),s=w.addWorksheet('Evolução');
 s.addRow(['Item','Atividade','Qtde','Valor unitário','1ª Medição','Medição nº 2','Medição 3']);
 s.addRow(['1','Alvenaria','1.234,50','R$ 2,00','25,5%',{formula:'10+10',result:20},0.125]);
 s.getCell('G2').numFmt='0.00%';
 return {w,s};
}
test('evolução importa valores, quantidade brasileira, percentual textual e resultado de fórmula',async()=>{
 const {w}=await modelo(),bytes=Buffer.from(await w.xlsx.writeBuffer()),p=await detectarPlanilha(bytes);
 const a=p.abas[0],i=a.itens[0];assert.equal(p.valida,true);
 assert.equal(i.quantidade,1234.5);assert.equal(i.valor,2469);
 assert.deepEqual(i.percentuais,{'1':25.5,'2':20,'3':12.5});
 assert.ok(a.amostra?.some(r=>r.celulas.some(c=>c.valor==='Alvenaria')));
 const out=await gerarExcel(bytes,p.abas,{'0:2:1':30,'0:2:3':15});
 const read=new ExcelJS.Workbook();await read.xlsx.load(out as any);
 assert.equal(read.worksheets[0].getCell('E2').value,0.3);
 assert.equal(read.worksheets[0].getCell('G2').value,0.15);
 assert.equal((read.worksheets[0].getCell('F2').value as any).result,20);
});
test('fórmula sem resultado salvo bloqueia importação em vez de virar progresso zero',async()=>{
 const {w,s}=await modelo();s.getCell('F2').value={formula:'10+10'};
 const bytes=Buffer.from(await w.xlsx.writeBuffer()),p=await detectarPlanilha(bytes,{},true);
 assert.equal(p.valida,false);assert.ok(p.avisos.some(a=>a.includes('percentual inválido')));
 await assert.rejects(()=>detectarPlanilha(bytes),/percentual inválido/);
});
test('exportação preserva escala de coluna com percentuais numéricos inteiros',async()=>{
 const {w,s}=await modelo();s.getCell('E2').value=25;
 const bytes=Buffer.from(await w.xlsx.writeBuffer()),p=await detectarPlanilha(bytes);
 const out=await gerarExcel(bytes,p.abas,{'0:2:1':35}),read=new ExcelJS.Workbook();
 await read.xlsx.load(out as any);assert.equal(read.worksheets[0].getCell('E2').value,35);
});
function banco(existentes:any[]=[]){
 const writes:any[]=[];
 const db:any={$queryRaw:async()=>[],obra:{findFirst:async(q:any)=>{assert.equal(q.where.empresaId,5);return {id:2};}},
 colaboradorObra:{findFirst:async(q:any)=>({id:q.where.id,diaria:100,ativo:true})},
 apontamentoObra:{findMany:async(q:any)=>[...existentes,...writes].filter(r=>r.colaboradorId===q.where.colaboradorId&&+r.data===+q.where.data),
 upsert:async(q:any)=>{writes.push(q.create);return q.create;}},
 historicoObra:{create:async()=>({})}};
 return {db,writes};
}
const pedido={obraId:2,inicio:'2026-11-05',fim:'2026-11-09',fracao:0.5,colaboradorIds:[3,4],somenteUteis:true};
test('equipe por período registra só dias úteis e calcula custo sem criar pagamentos',async()=>{
 const {db,writes}=banco();const r=await apontarPeriodoJose(db,5,pedido,8);
 assert.equal(r.registros,6);assert.equal(r.total,300);assert.equal(writes.length,6);
 assert.deepEqual([...new Set(writes.map(r=>r.data.toISOString().slice(0,10)))],['2026-11-05','2026-11-06','2026-11-09']);
});
test('novo lançamento não sobrescreve apontamento existente e rejeita excesso entre obras antes de gravar',async()=>{
 for(const obraId of [2,9]){
 const {db,writes}=banco([{obraId,colaboradorId:4,data:new Date('2026-11-06T00:00:00Z'),fracao:1,lancamentoId:10}]);
 await assert.rejects(()=>apontarPeriodoJose(db,5,pedido),/Já existe|exceder/);assert.equal(writes.length,0);
 }
});
test('lote restrito ao José e datas ou pessoas inválidas são recusadas',async()=>{
 const {db,writes}=banco();
 await assert.rejects(()=>apontarPeriodoJose(db,2,pedido),/José/);
 await assert.rejects(()=>apontarPeriodoJose(db,5,{...pedido,fim:'2027-01-01'}),/31 dias/);
 await assert.rejects(()=>apontarPeriodoJose(db,5,{...pedido,colaboradorIds:[3,3]}),/repetidos/);
 assert.equal(writes.length,0);
});

test('cabeçalhos mesclados usam a coluna inicial e mantêm os dados das linhas',async()=>{
 const w=new ExcelJS.Workbook(),s=w.addWorksheet('Mesclada');
 s.mergeCells('B1:D1');s.getCell('A1').value='ITEM';s.getCell('B1').value='DESCRIÇÃO';
 s.getCell('E1').value='VALOR TOTAL';s.mergeCells('F1:H1');s.getCell('F1').value='MEDIÇÃO 1';
 s.getCell('A2').value='1';s.getCell('B2').value='Fundação';s.getCell('E2').value=1200;s.getCell('F2').value='10%';
 const p=await detectarPlanilha(Buffer.from(await w.xlsx.writeBuffer()));
 assert.equal(p.abas[0].itens[0].descricao,'Fundação');assert.equal(p.abas[0].itens[0].valor,1200);
 assert.equal(p.abas[0].itens[0].percentuais['1'],10);
});
