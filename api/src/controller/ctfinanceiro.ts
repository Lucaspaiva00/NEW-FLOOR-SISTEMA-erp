import { Request, Response } from "express";
import prisma from "../prisma";
import {
  garantirCategoriasPadrao,
  sincronizarPropostaFaturada,
  sincronizarTodasPropostasFaturadas,
} from "../services/financeiro.service";

function idParam(value: string | string[] | undefined) {
  return Number(Array.isArray(value) ? value[0] : value);
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inicioDia(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function inicioMes(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function fimMes(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function nomeCliente(cliente: any) {
  return cliente?.nomeFantasia || cliente?.razaoSocial || cliente?.responsavel || null;
}

export const dashboard = async (_req: Request, res: Response): Promise<void> => {
  try {
    await garantirCategoriasPadrao();

    const hoje = inicioDia();
    const mesInicio = inicioMes();
    const mesFim = fimMes();

    const [abertosEntrada, abertosSaida, pagosMesEntrada, pagosMesSaida, vencidos, contas, ultimos] = await Promise.all([
      prisma.lancamentoFinanceiro.aggregate({
        where: { tipo: "ENTRADA", status: "ABERTO" },
        _sum: { valor: true },
      }),
      prisma.lancamentoFinanceiro.aggregate({
        where: { tipo: "SAIDA", status: "ABERTO" },
        _sum: { valor: true },
      }),
      prisma.lancamentoFinanceiro.aggregate({
        where: {
          tipo: "ENTRADA",
          status: "PAGO",
          dataPagamento: { gte: mesInicio, lt: mesFim },
        },
        _sum: { valorPago: true },
      }),
      prisma.lancamentoFinanceiro.aggregate({
        where: {
          tipo: "SAIDA",
          status: "PAGO",
          dataPagamento: { gte: mesInicio, lt: mesFim },
        },
        _sum: { valorPago: true },
      }),
      prisma.lancamentoFinanceiro.aggregate({
        where: {
          status: "ABERTO",
          dataVencimento: { lt: hoje },
        },
        _sum: { valor: true },
        _count: true,
      }),
      prisma.contaFinanceira.findMany({ where: { ativo: true } }),
      prisma.lancamentoFinanceiro.findMany({
        where: { status: { not: "CANCELADO" } },
        include: { cliente: true, categoria: true, conta: true, proposta: true },
        orderBy: [{ dataVencimento: "asc" }, { createdAt: "desc" }],
        take: 8,
      }),
    ]);

    const movimentosPagos = await prisma.lancamentoFinanceiro.findMany({
      where: { status: "PAGO" },
      select: { tipo: true, valorPago: true, contaFinanceiraId: true },
    });

    let saldoDisponivel = contas.reduce((total, conta) => total + Number(conta.saldoInicial || 0), 0);
    for (const mov of movimentosPagos) {
      saldoDisponivel += mov.tipo === "ENTRADA" ? Number(mov.valorPago || 0) : -Number(mov.valorPago || 0);
    }

    const receber = Number(abertosEntrada._sum.valor || 0);
    const pagar = Number(abertosSaida._sum.valor || 0);
    const recebidoMes = Number(pagosMesEntrada._sum.valorPago || 0);
    const pagoMes = Number(pagosMesSaida._sum.valorPago || 0);

    res.json({
      saldoDisponivel,
      contasReceber: receber,
      contasPagar: pagar,
      saldoProjetado: saldoDisponivel + receber - pagar,
      recebidoMes,
      pagoMes,
      resultadoMes: recebidoMes - pagoMes,
      vencidosValor: Number(vencidos._sum.valor || 0),
      vencidosQuantidade: vencidos._count || 0,
      ultimos: ultimos.map((item) => ({
        ...item,
        clienteNome: nomeCliente(item.cliente),
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar dashboard financeiro" });
  }
};

export const fluxo = async (req: Request, res: Response): Promise<void> => {
  try {
    const meses = Math.min(Math.max(Number(req.query.meses || 6), 3), 12);
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);

    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where: {
        status: { not: "CANCELADO" },
        OR: [
          { dataPagamento: { gte: inicio, lt: fim } },
          { dataCompetencia: { gte: inicio, lt: fim } },
        ],
      },
      select: { tipo: true, status: true, valor: true, valorPago: true, dataPagamento: true, dataCompetencia: true },
    });

    const mapa = new Map<string, { mes: string; entradas: number; saidas: number }>();
    for (let i = 0; i < meses; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      mapa.set(key, {
        mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        entradas: 0,
        saidas: 0,
      });
    }

    for (const lanc of lancamentos) {
      const data = lanc.dataPagamento || lanc.dataCompetencia;
      const key = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
      const alvo = mapa.get(key);
      if (!alvo) continue;
      const valor = lanc.status === "PAGO" ? Number(lanc.valorPago || lanc.valor) : Number(lanc.valor);
      if (lanc.tipo === "ENTRADA") alvo.entradas += valor;
      else alvo.saidas += valor;
    }

    res.json([...mapa.values()]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao gerar fluxo de caixa" });
  }
};

export const listar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tipo, status, busca, vencimento } = req.query;
    const hoje = inicioDia();
    const where: any = {};

    if (tipo === "ENTRADA" || tipo === "SAIDA") where.tipo = tipo;
    if (status === "ABERTO" || status === "PAGO" || status === "CANCELADO") where.status = status;
    if (vencimento === "VENCIDO") where.dataVencimento = { lt: hoje };
    if (vencimento === "HOJE") {
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      where.dataVencimento = { gte: hoje, lt: amanha };
    }
    if (busca) {
      where.OR = [
        { descricao: { contains: String(busca), mode: "insensitive" } },
        { documento: { contains: String(busca), mode: "insensitive" } },
        { cliente: { nomeFantasia: { contains: String(busca), mode: "insensitive" } } },
        { cliente: { razaoSocial: { contains: String(busca), mode: "insensitive" } } },
      ];
    }

    const dados = await prisma.lancamentoFinanceiro.findMany({
      where,
      include: { cliente: true, categoria: true, conta: true, proposta: true },
      orderBy: [{ status: "asc" }, { dataVencimento: "asc" }, { createdAt: "desc" }],
    });

    res.json(dados.map((item) => ({ ...item, clienteNome: nomeCliente(item.cliente) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar lançamentos financeiros" });
  }
};

export const buscar = async (req: Request, res: Response): Promise<void> => {
  try {
    const dado = await prisma.lancamentoFinanceiro.findUnique({
      where: { lancamentofinanceiroid: idParam(req.params.id) },
      include: { cliente: true, categoria: true, conta: true, proposta: true },
    });
    if (!dado) {
      res.status(404).json({ error: "Lançamento não encontrado" });
      return;
    }
    res.json(dado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar lançamento" });
  }
};

export const criar = async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body;
    const tipo = b.tipo === "SAIDA" ? "SAIDA" : "ENTRADA";
    const valor = Number(b.valor || 0);
    if (!b.descricao?.trim() || valor <= 0) {
      res.status(400).json({ error: "Informe descrição e valor maior que zero." });
      return;
    }

    const totalParcelas = Math.min(Math.max(Number(b.totalParcelas || 1), 1), 120);
    const intervaloDias = Math.max(Number(b.intervaloDias || 30), 1);
    const primeiraData = parseDate(b.dataVencimento);
    const criados = [];

    for (let i = 1; i <= totalParcelas; i++) {
      let vencimento = primeiraData ? new Date(primeiraData) : null;
      if (vencimento && i > 1) vencimento.setDate(vencimento.getDate() + intervaloDias * (i - 1));
      const valorParcela = Math.round((valor / totalParcelas) * 100) / 100;
      const ajusteUltima = i === totalParcelas ? Math.round((valor - valorParcela * (totalParcelas - 1)) * 100) / 100 : valorParcela;

      criados.push(await prisma.lancamentoFinanceiro.create({
        data: {
          tipo,
          status: "ABERTO",
          origem: "MANUAL",
          descricao: totalParcelas > 1 ? `${b.descricao.trim()} (${i}/${totalParcelas})` : b.descricao.trim(),
          documento: b.documento || null,
          valor: ajusteUltima,
          dataCompetencia: parseDate(b.dataCompetencia) || new Date(),
          dataVencimento: vencimento,
          formaPagamento: b.formaPagamento || null,
          parcelaNumero: i,
          totalParcelas,
          observacoes: b.observacoes || null,
          clienteId: b.clienteId ? Number(b.clienteId) : null,
          categoriaFinanceiraId: b.categoriaFinanceiraId ? Number(b.categoriaFinanceiraId) : null,
          contaFinanceiraId: b.contaFinanceiraId ? Number(b.contaFinanceiraId) : null,
        },
      }));
    }

    res.status(201).json(criados);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar lançamento financeiro" });
  }
};

export const atualizar = async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body;
    const id = idParam(req.params.id);
    const atual = await prisma.lancamentoFinanceiro.findUnique({ where: { lancamentofinanceiroid: id } });
    if (!atual) {
      res.status(404).json({ error: "Lançamento não encontrado" });
      return;
    }
    if (atual.status === "CANCELADO") {
      res.status(400).json({ error: "Lançamento cancelado não pode ser alterado." });
      return;
    }

    const dado = await prisma.lancamentoFinanceiro.update({
      where: { lancamentofinanceiroid: id },
      data: {
        tipo: b.tipo === "SAIDA" ? "SAIDA" : b.tipo === "ENTRADA" ? "ENTRADA" : atual.tipo,
        descricao: b.descricao ?? atual.descricao,
        documento: b.documento !== undefined ? b.documento || null : atual.documento,
        valor: b.valor !== undefined ? Number(b.valor) : atual.valor,
        dataCompetencia: b.dataCompetencia !== undefined ? parseDate(b.dataCompetencia) || atual.dataCompetencia : atual.dataCompetencia,
        dataVencimento: b.dataVencimento !== undefined ? parseDate(b.dataVencimento) : atual.dataVencimento,
        formaPagamento: b.formaPagamento !== undefined ? b.formaPagamento || null : atual.formaPagamento,
        observacoes: b.observacoes !== undefined ? b.observacoes || null : atual.observacoes,
        clienteId: b.clienteId !== undefined ? (b.clienteId ? Number(b.clienteId) : null) : atual.clienteId,
        categoriaFinanceiraId: b.categoriaFinanceiraId !== undefined ? (b.categoriaFinanceiraId ? Number(b.categoriaFinanceiraId) : null) : atual.categoriaFinanceiraId,
        contaFinanceiraId: b.contaFinanceiraId !== undefined ? (b.contaFinanceiraId ? Number(b.contaFinanceiraId) : null) : atual.contaFinanceiraId,
      },
    });
    res.json(dado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar lançamento" });
  }
};

export const baixar = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = idParam(req.params.id);
    const atual = await prisma.lancamentoFinanceiro.findUnique({ where: { lancamentofinanceiroid: id } });
    if (!atual) {
      res.status(404).json({ error: "Lançamento não encontrado" });
      return;
    }
    const valorPago = Number(req.body.valorPago || atual.valor);
    const dado = await prisma.lancamentoFinanceiro.update({
      where: { lancamentofinanceiroid: id },
      data: {
        status: "PAGO",
        valorPago,
        dataPagamento: parseDate(req.body.dataPagamento) || new Date(),
        contaFinanceiraId: req.body.contaFinanceiraId ? Number(req.body.contaFinanceiraId) : atual.contaFinanceiraId,
        formaPagamento: req.body.formaPagamento || atual.formaPagamento,
      },
    });
    res.json(dado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao baixar lançamento" });
  }
};

export const reabrir = async (req: Request, res: Response): Promise<void> => {
  try {
    const dado = await prisma.lancamentoFinanceiro.update({
      where: { lancamentofinanceiroid: idParam(req.params.id) },
      data: { status: "ABERTO", valorPago: 0, dataPagamento: null },
    });
    res.json(dado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao reabrir lançamento" });
  }
};

export const cancelar = async (req: Request, res: Response): Promise<void> => {
  try {
    const dado = await prisma.lancamentoFinanceiro.update({
      where: { lancamentofinanceiroid: idParam(req.params.id) },
      data: { status: "CANCELADO" },
    });
    res.json(dado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao cancelar lançamento" });
  }
};

export const excluir = async (req: Request, res: Response): Promise<void> => {
  try {
    const atual = await prisma.lancamentoFinanceiro.findUnique({ where: { lancamentofinanceiroid: idParam(req.params.id) } });
    if (!atual) {
      res.status(404).json({ error: "Lançamento não encontrado" });
      return;
    }
    if (atual.origem === "PROPOSTA") {
      res.status(400).json({ error: "Lançamentos originados de proposta não são excluídos. Cancele o lançamento se necessário." });
      return;
    }
    await prisma.lancamentoFinanceiro.delete({ where: { lancamentofinanceiroid: atual.lancamentofinanceiroid } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao excluir lançamento" });
  }
};

export const categorias = async (_req: Request, res: Response): Promise<void> => {
  try {
    await garantirCategoriasPadrao();
    res.json(await prisma.categoriaFinanceira.findMany({ orderBy: [{ tipo: "asc" }, { nome: "asc" }] }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar categorias" });
  }
};

export const criarCategoria = async (req: Request, res: Response): Promise<void> => {
  try {
    const tipo = req.body.tipo === "SAIDA" ? "SAIDA" : "ENTRADA";
    const nome = String(req.body.nome || "").trim();
    if (!nome) {
      res.status(400).json({ error: "Informe o nome da categoria." });
      return;
    }
    const dado = await prisma.categoriaFinanceira.create({
      data: { nome, tipo, descricao: req.body.descricao || null, cor: req.body.cor || null },
    });
    res.status(201).json(dado);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error?.code === "P2002" ? "Esta categoria já existe." : "Erro ao criar categoria" });
  }
};

export const contas = async (_req: Request, res: Response): Promise<void> => {
  try {
    const dados = await prisma.contaFinanceira.findMany({ orderBy: [{ ativo: "desc" }, { nome: "asc" }] });
    const pagos = await prisma.lancamentoFinanceiro.groupBy({
      by: ["contaFinanceiraId", "tipo"],
      where: { status: "PAGO", contaFinanceiraId: { not: null } },
      _sum: { valorPago: true },
    });
    res.json(dados.map((conta) => {
      let saldo = Number(conta.saldoInicial || 0);
      for (const p of pagos) {
        if (p.contaFinanceiraId !== conta.contafinanceiraid) continue;
        saldo += p.tipo === "ENTRADA" ? Number(p._sum.valorPago || 0) : -Number(p._sum.valorPago || 0);
      }
      return { ...conta, saldoAtual: saldo };
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar contas" });
  }
};

export const criarConta = async (req: Request, res: Response): Promise<void> => {
  try {
    const nome = String(req.body.nome || "").trim();
    if (!nome) {
      res.status(400).json({ error: "Informe o nome da conta." });
      return;
    }
    const tipos = ["BANCO", "CAIXA", "CARTEIRA"];
    const tipo = tipos.includes(req.body.tipo) ? req.body.tipo : "BANCO";
    const dado = await prisma.contaFinanceira.create({
      data: {
        nome,
        tipo,
        banco: req.body.banco || null,
        agencia: req.body.agencia || null,
        conta: req.body.conta || null,
        saldoInicial: Number(req.body.saldoInicial || 0),
      },
    });
    res.status(201).json(dado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar conta financeira" });
  }
};

export const sincronizarFaturadas = async (_req: Request, res: Response): Promise<void> => {
  try {
    const quantidade = await sincronizarTodasPropostasFaturadas();
    res.json({ success: true, quantidade });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao sincronizar propostas faturadas" });
  }
};

export const importarProposta = async (req: Request, res: Response): Promise<void> => {
  try {
    const propostaId = idParam(req.params.id);
    const proposta = await prisma.proposta.findUnique({
      where: { propostaid: propostaId },
      include: { cliente: true },
    });
    if (!proposta) {
      res.status(404).json({ error: "Proposta não encontrada" });
      return;
    }
    if (proposta.status !== "FATURADA") {
      res.status(400).json({ error: "A entrada financeira só é gerada quando a proposta estiver FATURADA." });
      return;
    }
    const lancamento = await sincronizarPropostaFaturada(propostaId);
    res.json(lancamento);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao importar proposta para o financeiro" });
  }
};
