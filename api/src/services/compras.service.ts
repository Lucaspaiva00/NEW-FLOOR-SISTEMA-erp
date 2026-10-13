import {Prisma} from '@prisma/client';
import prisma from '../prisma';
import {centavos} from './pagamentos.service';
import {validarPlanoRecebimento,parcelasRecebimento} from './planoRecebimento.service';
export function prepararCompra(body:any){
 if(!Array.isArray(body.itens)||!body.itens.length||body.itens.length>200)throw Error('Informe de 1 a 200 itens na compra.');
 const itens=body.itens.map((i:any)=>{
  const descricao=String(i.descricao||'').trim().slice(0,1000),quantidade=Number(i.quantidade),custoUnitario=Number(i.custoUnitario);
  if(!descricao||!Number.isFinite(quantidade)||quantidade<=0||quantidade>1e9||!Number.isFinite(custoUnitario)||custoUnitario<0||custoUnitario>1e9)throw Error('Informe descrição, quantidade positiva e custo válido em cada item.');
  const servicoId=i.servicoId==null||i.servicoId===''?null:Number(i.servicoId);if(servicoId!==null&&(!Number.isInteger(servicoId)||servicoId<=0))throw Error('Material inválido.');
  return {descricao,quantidade,custoUnitario,unidade:String(i.unidade||'UN').slice(0,30),servicoId,total:centavos(quantidade*custoUnitario)/100};
 });
 const subtotal=centavos(itens.reduce((s:any,i:any)=>s+i.total,0)),frete=centavos(body.frete??0),desconto=centavos(body.desconto??0);
 if(desconto>subtotal+frete)throw Error('O desconto não pode ultrapassar o valor da compra.');
 const total=centavos((subtotal+frete-desconto)/100)/100;
 const data=String(body.dataCompra||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||Number.isNaN(new Date(data).getTime())||new Date(data).toISOString().slice(0,10)!==data)throw Error('Informe uma data de compra válida.');
 const fornecedorId=Number(body.fornecedorId);if(!Number.isInteger(fornecedorId)||fornecedorId<=0)throw Error('Selecione o fornecedor.');
 const texto=(k:string)=>String(body[k]||'').trim().slice(0,3000)||null;
 return {fornecedorId,dataCompra:new Date(data+'T15:00:00Z'),documento:texto('documento'),itens,subtotal:subtotal/100,frete:frete/100,desconto:desconto/100,total,formaPagamento:texto('formaPagamento'),condicoesPagamento:texto('condicoesPagamento'),observacoes:texto('observacoes'),planoPagamento:validarPlanoRecebimento(body.planoPagamento)};
}
async function validarReferencias(tx:Prisma.TransactionClient,empresaId:number,data:ReturnType<typeof prepararCompra>){
 const fornecedor=await tx.fornecedor.findFirst({where:{fornecedorid:data.fornecedorId,empresaId,ativo:true}});if(!fornecedor)throw Error('Selecione um fornecedor ativo desta empresa.');
 const ids=[...new Set(data.itens.map((i:any)=>i.servicoId).filter(Boolean))] as number[];
 if(ids.length){const materiais=await tx.servico.findMany({where:{empresaId,servicoid:{in:ids}},select:{servicoid:true}});if(materiais.length!==ids.length)throw Error('Um material selecionado não pertence a esta empresa.');}
 return fornecedor;
}
export async function gerarContasCompra(compra:any,empresaId:number,tx:Prisma.TransactionClient){
 if(compra.empresaId!==empresaId)throw Error('Compra não pertence a esta empresa.');
 if(compra.status!=='CONFIRMADA')return;
 if(!compra.planoPagamento||Number(compra.total)<=0)throw Error('Para confirmar, informe valor positivo e parcelas com vencimento.');
 const fornecedor=await tx.fornecedor.findFirst({where:{fornecedorid:compra.fornecedorId,empresaId}});if(!fornecedor)throw Error('Fornecedor não encontrado nesta empresa.');
 await tx.$queryRaw`SELECT lancamentofinanceiroid FROM "LancamentoFinanceiro" WHERE "compraId"=${compra.compraid} AND "empresaId"=${empresaId} FOR UPDATE`;
 const existentes=await tx.lancamentoFinanceiro.findMany({where:{empresaId,compraId:compra.compraid,origem:'COMPRA'}});
 const parcelas=parcelasRecebimento(Number(compra.total),compra.planoPagamento),chaves=parcelas.map(p=>`COMPRA:${compra.compraid}:${p.numero}`);
 const categoria=await tx.categoriaFinanceira.upsert({where:{empresaId_nome_tipo:{empresaId,nome:'Fornecedores',tipo:'SAIDA'}},update:{ativo:true},create:{empresaId,nome:'Fornecedores',tipo:'SAIDA'}});
 await tx.lancamentoFinanceiro.updateMany({where:{empresaId,compraId:compra.compraid,origem:'COMPRA',chaveOrigem:{notIn:chaves},valorPago:0},data:{status:'CANCELADO'}});
 for(const p of parcelas){const chaveOrigem=`COMPRA:${compra.compraid}:${p.numero}`,atual=existentes.find(l=>l.chaveOrigem===chaveOrigem);
  const dados={descricao:`Compra ${compra.numero} - ${fornecedor.nome} (${p.numero}/${p.quantidade})`,favorecido:fornecedor.nome,documento:compra.documento||compra.numero,valor:p.valor,parcelaNumero:p.numero,totalParcelas:p.quantidade,dataVencimento:p.vencimento,dataCompetencia:compra.dataCompra,formaPagamento:compra.formaPagamento,categoriaFinanceiraId:categoria.categoriafinanceiraid,observacoes:compra.condicoesPagamento||'Gerado ao confirmar a compra.',status:atual&&Number(atual.valorPago)>=p.valor?'PAGO' as const:'ABERTO' as const};
  await tx.lancamentoFinanceiro.upsert({where:{chaveOrigem},update:dados,create:{...dados,empresaId,compraId:compra.compraid,tipo:'SAIDA',origem:'COMPRA',chaveOrigem}});
 }
}
export async function salvarCompra(empresaId:number,body:any,id?:number){
 const data=prepararCompra(body);
 return prisma.$transaction(async tx=>{
  let atual:any;
  if(id){await tx.$queryRaw`SELECT compraid FROM "Compra" WHERE compraid=${id} AND "empresaId"=${empresaId} FOR UPDATE`;atual=await tx.compra.findFirst({where:{compraid:id,empresaId}});if(!atual)throw Error('Compra não encontrada nesta empresa.');if(atual.status==='CANCELADA')throw Error('Uma compra cancelada não pode ser editada.');}
  await validarReferencias(tx,empresaId,data);
  const status=atual?.status==='CONFIRMADA'||body.confirmar===true?'CONFIRMADA':'RASCUNHO';
  if(status==='CONFIRMADA'&&(!data.planoPagamento||data.total<=0))throw Error('Para confirmar, informe valor positivo e parcelas com vencimento.');
  if(atual){
   await tx.$queryRaw`SELECT lancamentofinanceiroid FROM "LancamentoFinanceiro" WHERE "compraId"=${id!} AND "empresaId"=${empresaId} FOR UPDATE`;
   const pagamentos=await tx.lancamentoFinanceiro.findFirst({where:{empresaId,compraId:id,valorPago:{gt:0}}});
   if(pagamentos&&(Number(atual.fornecedorId)!==data.fornecedorId||centavos(atual.total)!==centavos(data.total)||JSON.stringify(validarPlanoRecebimento(atual.planoPagamento))!==JSON.stringify(data.planoPagamento)||atual.dataCompra.toISOString().slice(0,10)!==data.dataCompra.toISOString().slice(0,10)))throw Error('Estorne os pagamentos antes de alterar fornecedor, valor, data ou parcelamento da compra.');
  }
  const registro={...data,planoPagamento:data.planoPagamento||Prisma.DbNull,status};
  let compra;
  if(atual)compra=await tx.compra.update({where:{compraid:id},data:registro});
  else{const empresa=await tx.empresa.update({where:{empresaid:empresaId},data:{sequenciaCompras:{increment:1}},select:{sequenciaCompras:true}});compra=await tx.compra.create({data:{...registro,empresaId,numero:'CP-'+String(empresa.sequenciaCompras).padStart(6,'0')}});}
  await gerarContasCompra(compra,empresaId,tx);return compra;
 });
}
export async function confirmarCompra(empresaId:number,id:number){return prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT compraid FROM "Compra" WHERE compraid=${id} AND "empresaId"=${empresaId} FOR UPDATE`;
 const atual=await tx.compra.findFirst({where:{compraid:id,empresaId}});if(!atual)throw Error('Compra não encontrada nesta empresa.');if(atual.status==='CANCELADA')throw Error('Compra cancelada não pode ser confirmada.');
 const fornecedor=await tx.fornecedor.findFirst({where:{fornecedorid:atual.fornecedorId,empresaId,ativo:true}});if(!fornecedor)throw Error('O fornecedor está inativo ou não pertence a esta empresa.');
 const compra=atual.status==='CONFIRMADA'?atual:await tx.compra.update({where:{compraid:id},data:{status:'CONFIRMADA'}});await gerarContasCompra(compra,empresaId,tx);return compra;
});}
export async function cancelarCompra(empresaId:number,id:number){return prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT compraid FROM "Compra" WHERE compraid=${id} AND "empresaId"=${empresaId} FOR UPDATE`;
 const compra=await tx.compra.findFirst({where:{compraid:id,empresaId}});if(!compra)throw Error('Compra não encontrada nesta empresa.');
 await tx.$queryRaw`SELECT lancamentofinanceiroid FROM "LancamentoFinanceiro" WHERE "compraId"=${id} AND "empresaId"=${empresaId} FOR UPDATE`;
 await tx.lancamentoFinanceiro.updateMany({where:{empresaId,compraId:id,origem:'COMPRA'},data:{status:'CANCELADO'}});
 return tx.compra.update({where:{compraid:id},data:{status:'CANCELADA'}});
});}
