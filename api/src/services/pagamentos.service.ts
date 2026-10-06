import prisma from '../prisma';

export function centavos(value: any): number {
 const n=Number(value);
 if(value===null || value==='' || !Number.isFinite(n) || n<0 || n>999999999999.99) throw new Error('Informe um valor válido.');
 return Math.round(n*100);
}
export function saldoConta(valor: any, pago: any) { return Math.max(0,centavos(valor)-centavos(pago))/100; }
export async function validarVinculos(tx: any, empresaId: number, b: any) {
 for(const [field,model,key] of [['clienteId','cliente','clienteid'],['categoriaFinanceiraId','categoriaFinanceira','categoriafinanceiraid'],['contaFinanceiraId','contaFinanceira','contafinanceiraid']]) {
  if(!b[field])continue;
  const id=Number(b[field]);
  const vinculo=Number.isInteger(id)&&id>0?await tx[model].findFirst({where:{[key]:id,empresaId}}):null;
  if(!vinculo || vinculo.ativo===false) throw new Error('Cliente, categoria ou conta não pertence a esta empresa.');
 }
 if(b.categoriaFinanceiraId && b.tipo){const cat=await tx.categoriaFinanceira.findFirst({where:{categoriafinanceiraid:Number(b.categoriaFinanceiraId),empresaId}});if(cat.tipo!==b.tipo)throw new Error('Escolha uma categoria correspondente a receber ou pagar.');}
}
export async function movimentarConta(id: number, empresaId: number, b: any, estornar=false) {
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "lancamentofinanceiroid" FROM "LancamentoFinanceiro" WHERE "lancamentofinanceiroid"=${id} AND "empresaId"=${empresaId} FOR UPDATE`;
  const atual=await tx.lancamentoFinanceiro.findFirst({where:{lancamentofinanceiroid:id,empresaId}});
  if(!atual)throw new Error('Conta não encontrada.');
  if(atual.status==='CANCELADO')throw new Error('Conta cancelada não pode receber pagamentos.');
  if(estornar){
   if(!String(b.motivo||'').trim())throw new Error('Informe o motivo do estorno.');
   const where:any={lancamentoId:id,empresaId,estornadoEm:null};
   if(b.pagamentoId)where.pagamentofinanceiroid=Number(b.pagamentoId);
   const result=await tx.pagamentoFinanceiro.updateMany({where,data:{estornadoEm:new Date(),motivoEstorno:String(b.motivo).trim()}});
   if(!result.count)throw new Error('Não há pagamento disponível para estornar.');
  }else{
   if(atual.status==='PAGO')throw new Error('Esta conta já está quitada.');
   const valor=centavos(b.valorPago);
   if(valor<=0 || valor>centavos(saldoConta(atual.valor,atual.valorPago)))throw new Error('O valor deve ser maior que zero e não ultrapassar o saldo restante.');
   if(!b.contaFinanceiraId)throw new Error('Escolha onde o dinheiro foi recebido ou pago.');
   await validarVinculos(tx,empresaId,b);
   const data=new Date(b.dataPagamento?.length===10?b.dataPagamento+'T12:00:00-03:00':b.dataPagamento);
   if(Number.isNaN(data.getTime()) || (b.dataPagamento?.length===10 && data.toISOString().slice(0,10)!==b.dataPagamento) || (b.dataPagamento?.length===10 ? b.dataPagamento > new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()) : data>new Date()))throw new Error('Informe uma data de pagamento válida, até hoje.');
   await tx.pagamentoFinanceiro.create({data:{empresaId,lancamentoId:id,valor:valor/100,dataPagamento:data,contaFinanceiraId:Number(b.contaFinanceiraId),formaPagamento:b.formaPagamento||null}});
  }
  const pagamentos=await tx.pagamentoFinanceiro.findMany({where:{empresaId,lancamentoId:id,estornadoEm:null},orderBy:{dataPagamento:'desc'}});
  const pago=pagamentos.reduce((sum,p)=>sum+centavos(p.valor),0);
  return tx.lancamentoFinanceiro.update({where:{lancamentofinanceiroid:id},data:{valorPago:pago/100,status:pago>=centavos(atual.valor)?'PAGO':'ABERTO',dataPagamento:pagamentos[0]?.dataPagamento||null},include:{pagamentos:true}});
 });
}
