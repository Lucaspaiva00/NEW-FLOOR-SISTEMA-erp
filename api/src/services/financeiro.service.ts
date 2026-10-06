import { parcelasRecebimento } from "./planoRecebimento.service";
import { Prisma } from "@prisma/client";
import prisma from "../prisma";

export async function garantirCategoriaReceitaPropostas(empresaId: number, db: Prisma.TransactionClient = prisma) {
  return db.categoriaFinanceira.upsert({
    where: {
      empresaId_nome_tipo: {
        empresaId,
        nome: "Receita de propostas",
        tipo: "ENTRADA",
      },
    },
    update: { ativo: true },
    create: {
      empresaId,
      nome: "Receita de propostas",
      tipo: "ENTRADA",
      descricao: "Receitas geradas automaticamente quando uma proposta é faturada.",
      cor: "#198754",
    },
  });
}

export async function garantirCategoriasPadrao(empresaId: number) {
  const padroes = [
    ["Receita de propostas", "ENTRADA", "Receitas originadas de propostas faturadas", "#198754"],
    ["Outras receitas", "ENTRADA", "Receitas avulsas", "#0d6efd"],
    ["Fornecedores", "SAIDA", "Pagamentos de fornecedores", "#dc3545"],
    ["Materiais", "SAIDA", "Compra de materiais e insumos", "#fd7e14"],
    ["Fretes", "SAIDA", "Fretes e transportes", "#6f42c1"],
    ["Mão de obra", "SAIDA", "Custos de mão de obra", "#d63384"],
    ["Impostos e taxas", "SAIDA", "Tributos, tarifas e taxas", "#6c757d"],
    ["Despesas operacionais", "SAIDA", "Despesas gerais da operação", "#ffc107"],
  ] as const;

  for (const [nome, tipo, descricao, cor] of padroes) {
    await prisma.categoriaFinanceira.upsert({
      where: { empresaId_nome_tipo: { empresaId, nome, tipo } },
      update: {},
      create: { empresaId, nome, tipo, descricao, cor },
    });
  }
}

export async function sincronizarPropostaFaturada(propostaId: number, empresaId: number, db?: Prisma.TransactionClient, reativar = false) {
  const sincronizar = async (tx: Prisma.TransactionClient)=>{
  await tx.$queryRaw`SELECT "propostaid" FROM "Proposta" WHERE "propostaid"=${propostaId} AND "empresaId"=${empresaId} FOR UPDATE`;
  const proposta = await tx.proposta.findFirst({
    where: { propostaid: propostaId, empresaId },
    include: { cliente: true },
  });

  if (!proposta || proposta.status !== "FATURADA") return null;

  const categoria = await garantirCategoriaReceitaPropostas(empresaId, tx);
  const valor = Number(proposta.subtotal || 0) + Number(proposta.frete || 0);
  const nomeCliente =
    proposta.cliente.nomeFantasia ||
    proposta.cliente.razaoSocial ||
    proposta.cliente.responsavel ||
    `Cliente #${proposta.clienteId}`;

  const parcelas=parcelasRecebimento(valor,proposta.planoRecebimento);
  await tx.$queryRaw`SELECT "lancamentofinanceiroid" FROM "LancamentoFinanceiro" WHERE "propostaId"=${propostaId} AND "empresaId"=${empresaId} FOR UPDATE`;
  const existentes=await tx.lancamentoFinanceiro.findMany({where:{empresaId,propostaId,origem:"PROPOSTA"}});
  const chaves=parcelas.map(p=>`PROPOSTA:${propostaId}:${p.numero}`);
  const temRecebimento=existentes.some(l=>Number(l.valorPago)>0);
  if(temRecebimento){
    const ativos=existentes.filter(l=>l.status!=="CANCELADO");
    if(ativos.length!==parcelas.length||parcelas.some(p=>{
      const l=ativos.find(l=>l.chaveOrigem===`PROPOSTA:${propostaId}:${p.numero}`);
      return !l||Math.round(Number(l.valor)*100)!==Math.round(p.valor*100)||l.clienteId!==proposta.clienteId||(proposta.planoRecebimento&&l.dataVencimento?.toISOString().slice(0,10)!==p.vencimento?.toISOString().slice(0,10));
    }))throw new Error("Estorne os recebimentos antes de alterar valores, cliente ou parcelamento da proposta.");
  }
  await tx.lancamentoFinanceiro.updateMany({where:{empresaId,propostaId,origem:"PROPOSTA",chaveOrigem:{notIn:chaves},valorPago:0,status:"ABERTO"},data:{status:"CANCELADO"}});
  const resultados=[];
  for(const parcela of parcelas){
    const chaveOrigem=`PROPOSTA:${propostaId}:${parcela.numero}`,existente=existentes.find(l=>l.chaveOrigem===chaveOrigem);
    const dados={descricao:`Proposta ${proposta.numero} - ${nomeCliente}${parcelas.length>1?` (${parcela.numero}/${parcelas.length})`:""}`,documento:proposta.numero,valor:parcela.valor,clienteId:proposta.clienteId,categoriaFinanceiraId:categoria.categoriafinanceiraid,formaPagamento:proposta.formaPagamento,parcelaNumero:parcela.numero,totalParcelas:parcelas.length,observacoes:proposta.condicoesPagamento?`Condições comerciais: ${proposta.condicoesPagamento}`:"Gerado ao faturar a proposta.",...(proposta.planoRecebimento?{dataVencimento:parcela.vencimento}:{})};
    resultados.push(await tx.lancamentoFinanceiro.upsert({where:{chaveOrigem},update:{...dados,status:existente?.status==="PAGO"?"PAGO":existente?.status==="CANCELADO"&&!reativar?"CANCELADO":"ABERTO"},create:{...dados,empresaId,tipo:"ENTRADA",status:"ABERTO",origem:"PROPOSTA",dataCompetencia:proposta.dataFaturamento||new Date(),dataVencimento:parcela.vencimento,chaveOrigem,propostaId}}));
  }
  return resultados[0];
  };
  return db ? sincronizar(db) : prisma.$transaction(sincronizar);
}

export async function cancelarLancamentoPropostaDesfaturada(propostaId: number, empresaId: number, db: Prisma.TransactionClient = prisma) {
  const recebida=await db.lancamentoFinanceiro.findFirst({where:{empresaId,propostaId,origem:"PROPOSTA",valorPago:{gt:0}}});
  if(recebida)throw new Error("Estorne os recebimentos antes de retirar o faturamento da proposta.");
  return db.lancamentoFinanceiro.updateMany({
    where: {
      empresaId,
      propostaId,
      origem: "PROPOSTA",
      status: "ABERTO",
      valorPago: 0,
    },
    data: { status: "CANCELADO" },
  });
}

export async function sincronizarTodasPropostasFaturadas(empresaId: number) {
  await garantirCategoriasPadrao(empresaId);
  const propostas = await prisma.proposta.findMany({
    where: { status: "FATURADA", empresaId },
    select: { propostaid: true },
  });

  let criadosOuAtualizados = 0;
  for (const proposta of propostas) {
    await sincronizarPropostaFaturada(proposta.propostaid, empresaId);
    criadosOuAtualizados += 1;
  }

  return criadosOuAtualizados;
}
