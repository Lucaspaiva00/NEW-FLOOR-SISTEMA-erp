import prisma from "../prisma";

export async function garantirCategoriaReceitaPropostas(empresaId: number) {
  return prisma.categoriaFinanceira.upsert({
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

export async function sincronizarPropostaFaturada(propostaId: number, empresaId: number) {
  const proposta = await prisma.proposta.findFirst({
    where: { propostaid: propostaId, empresaId },
    include: { cliente: true },
  });

  if (!proposta || proposta.status !== "FATURADA") return null;

  const categoria = await garantirCategoriaReceitaPropostas(empresaId);
  const valor = Number(proposta.subtotal || 0) + Number(proposta.frete || 0);
  const nomeCliente =
    proposta.cliente.nomeFantasia ||
    proposta.cliente.razaoSocial ||
    proposta.cliente.responsavel ||
    `Cliente #${proposta.clienteId}`;

  const chaveOrigem = `PROPOSTA:${proposta.propostaid}:1`;
  const existente = await prisma.lancamentoFinanceiro.findUnique({
    where: { chaveOrigem },
    select: { status: true },
  });

  return prisma.lancamentoFinanceiro.upsert({
    where: { chaveOrigem },
    update: {
      descricao: `Proposta ${proposta.numero} - ${nomeCliente}`,
      documento: proposta.numero,
      valor,
      status: existente?.status === "PAGO" ? "PAGO" : "ABERTO",
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
      dataCompetencia: new Date(),
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
}

export async function cancelarLancamentoPropostaDesfaturada(propostaId: number) {
  return prisma.lancamentoFinanceiro.updateMany({
    where: {
      chaveOrigem: `PROPOSTA:${propostaId}:1`,
      origem: "PROPOSTA",
      status: "ABERTO",
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
