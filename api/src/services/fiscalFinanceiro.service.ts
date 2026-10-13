import {Prisma} from '@prisma/client';
import prisma from '../prisma';
import {centavos} from './pagamentos.service';
import {parcelasRecebimento,validarPlanoRecebimento} from './planoRecebimento.service';
import {sincronizarPropostaFaturada} from './financeiro.service';
export function valoresNotaFinanceiro(total:any,retencoes:any){
 const bruto=centavos(total),retido=centavos(retencoes??0);if(retido>bruto)throw Object.assign(Error('As retenções não podem ultrapassar o valor bruto da nota.'),{statusCode:400});return {bruto:bruto/100,retencoes:retido/100,liquido:(bruto-retido)/100};
}
export async function sincronizarFinanceiroNota(nota:any,db:Prisma.TransactionClient=prisma){
 if((nota.ambienteEmissao||nota.empresaFiscal?.ambiente)!=='PRODUCAO'||!['AUTORIZADA','CANCELADA'].includes(nota.status))return;
 const empresaId=nota.empresaId;
 if(nota.propostaId){
  await db.$queryRaw`SELECT propostaid FROM "Proposta" WHERE propostaid=${nota.propostaId} AND "empresaId"=${empresaId} FOR UPDATE`;
  const proposta=await db.proposta.findFirst({where:{propostaid:nota.propostaId,empresaId}});if(!proposta)throw Error('Proposta da nota não encontrada nesta empresa.');
  const notas=await db.notaFiscal.findMany({where:{empresaId,propostaId:nota.propostaId,status:'AUTORIZADA'},include:{empresaFiscal:{select:{ambiente:true}}}});
  const autorizadas=notas.filter(n=>(n.ambienteEmissao||n.empresaFiscal.ambiente)==='PRODUCAO');
  if(!autorizadas.length){
   await db.lancamentoFinanceiro.updateMany({where:{empresaId,propostaId:nota.propostaId,origem:'PROPOSTA'},data:{status:'CANCELADO'}});
   await db.proposta.update({where:{propostaid:proposta.propostaid},data:{status:'APROVADA',dataFaturamento:null,valorLiquidoFinanceiro:null}});return;
  }
  if(autorizadas.length>1)throw Error("Há mais de uma nota autorizada para esta proposta. Confira o faturamento antes de ajustar a cobrança.");
  const retencoes=autorizadas.reduce((s,n)=>s+centavos(n.valorRetencoes),0);
  const bruto=centavos(Number(proposta.subtotal)+Number(proposta.frete||0));if(retencoes>bruto)throw Error('As retenções acumuladas superam o valor da proposta.');
  const liquido=(bruto-retencoes)/100;
  await db.proposta.update({where:{propostaid:proposta.propostaid},data:{status:'FATURADA',colunaKanbanId:null,dataFaturamento:proposta.dataFaturamento||nota.dataAutorizacao||new Date(),valorLiquidoFinanceiro:liquido}});
  if(!liquido){await db.lancamentoFinanceiro.updateMany({where:{empresaId,propostaId:proposta.propostaid,origem:'PROPOSTA'},data:{status:'CANCELADO'}});return;}
  await sincronizarPropostaFaturada(proposta.propostaid,empresaId,db,proposta.status!=='FATURADA');return;
 }
 await db.$queryRaw`SELECT notafiscalid FROM "NotaFiscal" WHERE notafiscalid=${nota.notafiscalid} AND "empresaId"=${empresaId} FOR UPDATE`;
 const where={empresaId,notaFiscalId:nota.notafiscalid,origem:'NOTA_FISCAL' as const};
 if(nota.status==='CANCELADA'){await db.lancamentoFinanceiro.updateMany({where,data:{status:'CANCELADO'}});return;}
 const valores=valoresNotaFinanceiro(nota.valorTotal,nota.valorRetencoes);
 if(!valores.liquido){await db.lancamentoFinanceiro.updateMany({where,data:{status:'CANCELADO'}});return;}
 const plano=validarPlanoRecebimento(nota.planoRecebimento),parcelas=parcelasRecebimento(valores.liquido,plano);
 const categoria=await db.categoriaFinanceira.upsert({where:{empresaId_nome_tipo:{empresaId,nome:'Receita de notas fiscais',tipo:'ENTRADA'}},update:{},create:{empresaId,nome:'Receita de notas fiscais',tipo:'ENTRADA'}});
 const existentes=await db.lancamentoFinanceiro.findMany({where});
 for(const p of parcelas){const chaveOrigem=`NOTA:${nota.notafiscalid}:${p.numero}`,existente=existentes.find(l=>l.chaveOrigem===chaveOrigem),dados={descricao:`Nota ${nota.numero||nota.referencia} - ${nota.destinatarioNome}`,documento:nota.numero||nota.referencia,valor:p.valor,clienteId:nota.clienteId,parcelaNumero:p.numero,totalParcelas:p.quantidade,dataVencimento:p.vencimento,categoriaFinanceiraId:categoria.categoriafinanceiraid,observacoes:`Bruto: R$ ${valores.bruto.toFixed(2)}; retenções: R$ ${valores.retencoes.toFixed(2)}; líquido: R$ ${valores.liquido.toFixed(2)}.`,status:existente&&Number(existente.valorPago)>=p.valor?'PAGO' as const:'ABERTO' as const};await db.lancamentoFinanceiro.upsert({where:{chaveOrigem},update:dados,create:{...dados,empresaId,notaFiscalId:nota.notafiscalid,tipo:'ENTRADA',origem:'NOTA_FISCAL',chaveOrigem,dataCompetencia:nota.dataAutorizacao||nota.dataEmissao||new Date()}});}
}
