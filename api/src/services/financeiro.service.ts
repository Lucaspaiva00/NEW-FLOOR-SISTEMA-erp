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

  const chaveOrigem = `PROPOSTA:${proposta.propostaid}:1`;

  await tx.$queryRaw`SELECT "lancamentofinanceiroid" FROM "LancamentoFinanceiro" WHERE "chaveOrigem"=${chaveOrigem} AND "empresaId"=${empresaId} FOR UPDATE`;
  const existente = await tx.lancamentoFinanceiro.findUnique({
    where: { chaveOrigem },
    select: { status: true, valor: true, valorPago: true, clienteId: true },
  });

  if(Number(existente?.valorPago)>0 && (Math.round(Number(existente!.valor)*100)!==Math.round(valor*100)||existente!.clienteId!==proposta.clienteId))throw new Error("Uma proposta com recebimentos não pode ter seu valor ou cliente alterado. Estorne os recebimentos antes de ajustar.");
  return tx.lancamentoFinanceiro.upsert({
    where: { chaveOrigem },
    update: {
      descricao: `Proposta ${proposta.numero} - ${nomeCliente}`,
      documento: proposta.numero,
      valor: Number(existente?.valorPago)>0 ? existente!.valor : valor,
      status: existente?.status === "PAGO" ? "PAGO" : existente?.status === "CANCELADO" && !reativar ? "CANCELADO" : "ABERTO",
      clienteId: proposta.clienteId,
      categoriaFinanceiraId: categoria.categoriafinanceiraid,
      formaPagamento: proposta.formaPagamento,
      observacoes: proposta.condicoesPagamento
        ? `Condições comerciais: ${proposta.condicoesPagamento}`
        : null,
    },
    create: {
      empresaId,
      tipo: "ENTRADA",
      status: "ABERTO",
      origem: "PROPOSTA",
      descricao: `Proposta ${proposta.numero} - ${nomeCliente}`,
      documento: proposta.numero,
      valor,
      dataCompetencia: proposta.dataFaturamento || new Date(),
      dataVencimento: null,
      formaPagamento: proposta.formaPagamento,
      parcelaNumero: 1,
      totalParcelas: 1,
      observacoes: proposta.condicoesPagamento
        ? `Condições comerciais: ${proposta.condicoesPagamento}`
        : "Gerado automaticamente ao faturar a proposta. Defina o vencimento conforme a condição comercial.",
      chaveOrigem,
      propostaId: proposta.propostaid,
      clienteId: proposta.clienteId,
      categoriaFinanceiraId: categoria.categoriafinanceiraid,
    },
  });
  };
  return db ? sincronizar(db) : prisma.$transaction(sincronizar);
}

export async function cancelarLancamentoPropostaDesfaturada(propostaId: number, empresaId: number, db: Prisma.TransactionClient = prisma) {
  const recebida=await db.lancamentoFinanceiro.findFirst({where:{empresaId,propostaId,origem:"PROPOSTA",valorPago:{gt:0}}});
  if(recebida)throw new Error("Estorne os recebimentos antes de retirar o faturamento da proposta.");
  return db.lancamentoFinanceiro.updateMany({
    where: {
      empresaId,
      chaveOrigem: `PROPOSTA:${propostaId}:1`,
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
