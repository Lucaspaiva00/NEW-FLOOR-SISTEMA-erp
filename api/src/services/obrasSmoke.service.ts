import assert from 'node:assert/strict';
import prisma from '../prisma';
import {data} from './obras.service';
import {apontarDia,fecharDiarias,salvarPlanejamento,editarMedicao,aprovarMedicao,cancelarMedicao,editarObra} from './obrasOperacao.service';
import {consolidarObra,emitirPdf,relatorioHtml} from './obrasRelatorio.service';
import {movimentarConta} from './pagamentos.service';
// Exercício de integração em produção autorizado pelo usuário. Todos os dados
// de teste ficam na mesma transação e são revertidos, inclusive pagamentos.
export async function testarFluxoObras(){
 const empresa=await prisma.empresa.findFirst({where:{empresaid:5,slug:'construarty',nome:'Jose'}});if(!empresa)return;
 const chave='qa:obras-operacao-v2';
 if(await prisma.importacaoObra.findUnique({where:{chave}})){console.log('QA OBRAS: fluxo completo já validado nesta versão.');return;}
 const sucesso=new Error('QA_OBRAS_ROLLBACK');let verificou=false;
 try{await prisma.$transaction(async db=>{
  const empresaId=empresa.empresaid,cliente=await db.cliente.create({data:{empresaId,razaoSocial:'VALIDACAO TRANSACIONAL OBRAS'}}),c=await db.colaboradorObra.create({data:{empresaId,nome:'VALIDACAO TRANSACIONAL COLABORADOR',funcao:'Teste',diaria:350}}),conta=await db.contaFinanceira.create({data:{empresaId,nome:'VALIDACAO TRANSACIONAL CAIXA',tipo:'CAIXA'}});
  const o=await db.obra.create({data:{empresaId,clienteId:cliente.clienteid,nome:'VALIDACAO TRANSACIONAL OBRA',endereco:'Teste temporário',responsavel:'Teste',inicio:data('2026-01-01'),valorContrato:20000,etapas:{create:[{nome:'Etapa teste',valor:20000}]}},include:{etapas:true}});
  await salvarPlanejamento(db,empresaId,{obraId:o.id,colaboradorId:c.id,data:'2026-01-10',fracao:1});
  const a=await apontarDia(db,empresaId,{obraId:o.id,colaboradorId:c.id,data:'2026-01-10',fracao:1});assert.equal(Number(a.diaria),350);
  const f=await fecharDiarias(db,empresaId,{obraId:o.id,inicio:'2026-01-10',fim:'2026-01-10',vencimento:'2026-01-11'});assert.equal(f.total,350);
  await assert.rejects(()=>apontarDia(db,empresaId,{obraId:o.id,colaboradorId:c.id,data:'2026-01-10',fracao:0.5}),/fechado/);
  const diaria=await db.apontamentoObra.findUnique({where:{id:a.id}}),adaptador={$transaction:(fn:any)=>fn(db)};
  await movimentarConta(diaria!.lancamentoId!,empresaId,{valorPago:100,dataPagamento:'2026-01-11',contaFinanceiraId:conta.contafinanceiraid},false,adaptador);
  const m=await db.medicaoObra.create({data:{empresaId,obraId:o.id,inicio:data('2026-01-01'),fim:data('2026-01-10'),vencimento:data('2026-01-11'),observacoes:'Teste',fotos:[],valor:4000,itens:{create:[{etapaId:o.etapas[0].id,anterior:0,atual:20,valor:4000}]}}});
  const corrigida=await editarMedicao(db,empresaId,m.id,{inicio:'2026-01-01',fim:'2026-01-10',vencimento:'2026-01-11',fotos:[],itens:[{etapaId:o.etapas[0].id,atual:25}]});assert.equal(Number(corrigida.valor),5000);
  const aprovada=await aprovarMedicao(db,empresaId,m.id);assert.equal((await aprovarMedicao(db,empresaId,m.id)).lancamentoId,aprovada.lancamentoId);
  await movimentarConta(aprovada.lancamentoId!,empresaId,{valorPago:1500,dataPagamento:'2026-01-11',contaFinanceiraId:conta.contafinanceiraid},false,adaptador);
  await assert.rejects(()=>cancelarMedicao(db,empresaId,m.id,'Teste'),/Estorne/);
  const relatorio=await consolidarObra(db,empresaId,o.id);assert.equal(relatorio.resumo.custoTotal,350);assert.equal(relatorio.resumo.pago,100);assert.equal(relatorio.resumo.recebido,1500);assert.equal(relatorio.resumo.aReceber,3500);assert.equal(relatorio.resumo.saldoContrato,15000);
  const pdf=await emitirPdf(relatorioHtml(relatorio));assert.equal(pdf.subarray(0,4).toString(),'%PDF');assert.ok(pdf.length>1000);
  await assert.rejects(()=>editarObra(db,empresaId,o.id,{...o,inicio:'2026-01-01',etapas:[{...o.etapas[0],valor:30000}],valorContrato:30000}),/histórico/);
  await movimentarConta(aprovada.lancamentoId!,empresaId,{motivo:'Estorno do teste'},true,adaptador);await cancelarMedicao(db,empresaId,m.id,'Cancelamento do teste');
  verificou=true;throw sucesso;
 },{timeout:120000});}catch(e){if(e!==sucesso)throw e;}
 if(!verificou)throw Error('Fluxo de obras não validado.');
 await prisma.importacaoObra.upsert({where:{chave},create:{empresaId:empresa.empresaid,chave,dados:{validadoEm:new Date().toISOString(),dadosDeTesteRevertidos:true}},update:{}});
 console.log('QA OBRAS OK: planejamento, diária, fechamento, pagamento parcial, medição corrigida, cobrança única, PDF e cancelamento; dados de teste revertidos.');
}
