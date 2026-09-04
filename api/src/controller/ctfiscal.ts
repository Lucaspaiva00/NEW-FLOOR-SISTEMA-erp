import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { TipoDocumentoFiscal } from "@prisma/client";
import prisma from "../prisma";
import {
  buildFocusPayload,
  cancelarNaFocus,
  consultarNaFocus,
  emitirNaFocus,
  emitirCartaCorrecaoNaFocus,
  parseFocusResult,
} from "../services/focusNfe.service";

function numberOr(value: any, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function intOr(value: any, fallback = 0): number {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullable(value: any): any {
  return value === "" || value === undefined ? null : value;
}

function parseJson(value: any): any {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    throw new Error("JSON adicional inválido.");
  }
}

function semTokens(empresa: any) {
  const { tokenHomologacao, tokenProducao, ...safe } = empresa;
  return {
    ...safe,
    temTokenHomologacao: Boolean(tokenHomologacao),
    temTokenProducao: Boolean(tokenProducao),
  };
}

function empresaData(body: any, existente?: any) {
  const tokenHomologacao = body.tokenHomologacao;
  const tokenProducao = body.tokenProducao;

  return {
    razaoSocial: body.razaoSocial,
    nomeFantasia: nullable(body.nomeFantasia),
    cnpj: String(body.cnpj || "").replace(/\D/g, ""),
    inscricaoEstadual: nullable(body.inscricaoEstadual),
    inscricaoMunicipal: nullable(body.inscricaoMunicipal),
    regimeTributario: intOr(body.regimeTributario, 1),
    cnae: nullable(body.cnae),
    cep: nullable(body.cep),
    endereco: nullable(body.endereco),
    numero: nullable(body.numero),
    complemento: nullable(body.complemento),
    bairro: nullable(body.bairro),
    cidade: nullable(body.cidade),
    estado: nullable(body.estado)?.toUpperCase(),
    codigoMunicipioIbge: nullable(body.codigoMunicipioIbge),
    telefone: nullable(body.telefone),
    email: nullable(body.email),
    ambiente: body.ambiente || "HOMOLOGACAO",
    provedor: body.provedor || "FOCUS_NFE",
    tokenHomologacao:
      tokenHomologacao === "" || tokenHomologacao === undefined
        ? existente?.tokenHomologacao ?? null
        : tokenHomologacao,
    tokenProducao:
      tokenProducao === "" || tokenProducao === undefined
        ? existente?.tokenProducao ?? null
        : tokenProducao,
    padraoNfse: body.padraoNfse || "MUNICIPAL",
    serieNfe: nullable(body.serieNfe),
    serieNfse: nullable(body.serieNfse),
    naturezaOperacaoNfe: nullable(body.naturezaOperacaoNfe),
    naturezaOperacaoNfse: nullable(body.naturezaOperacaoNfse) || "1",
    regimeEspecialTributacaoNfse: nullable(body.regimeEspecialTributacaoNfse),
    optanteSimplesNacional: body.optanteSimplesNacional !== false,
    incentivadorCultural: Boolean(body.incentivadorCultural),
    itemListaServicoPadrao: nullable(body.itemListaServicoPadrao),
    codigoTributarioMunicipal: nullable(body.codigoTributarioMunicipal),
    aliquotaIssPadrao:
      body.aliquotaIssPadrao === "" || body.aliquotaIssPadrao == null
        ? null
        : numberOr(body.aliquotaIssPadrao),
    cfopDentroEstado: nullable(body.cfopDentroEstado),
    cfopForaEstado: nullable(body.cfopForaEstado),
    ncmPadrao: nullable(body.ncmPadrao),
    unidadePadrao: nullable(body.unidadePadrao) || "UN",
    icmsOrigemPadrao:
      body.icmsOrigemPadrao === "" || body.icmsOrigemPadrao == null
        ? null
        : intOr(body.icmsOrigemPadrao),
    icmsSituacaoTributariaPadrao: nullable(body.icmsSituacaoTributariaPadrao),
    pisSituacaoTributariaPadrao: nullable(body.pisSituacaoTributariaPadrao),
    cofinsSituacaoTributariaPadrao: nullable(body.cofinsSituacaoTributariaPadrao),
    informacoesAdicionaisPadrao: nullable(body.informacoesAdicionaisPadrao),
    ativo: body.ativo !== false,
  };
}

function itemData(item: any) {
  const quantidade = numberOr(item.quantidade, 1);
  const valorUnitario = numberOr(item.valorUnitario, 0);
  const valorBruto =
    item.valorBruto === undefined || item.valorBruto === null || item.valorBruto === ""
      ? quantidade * valorUnitario
      : numberOr(item.valorBruto, 0);

  return {
    codigo: nullable(item.codigo),
    descricao: item.descricao,
    ncm: nullable(item.ncm),
    cest: nullable(item.cest),
    cfop: nullable(item.cfop),
    unidade: item.unidade || "UN",
    quantidade,
    valorUnitario,
    valorBruto,
    valorDesconto: numberOr(item.valorDesconto, 0),
    icmsOrigem:
      item.icmsOrigem === "" || item.icmsOrigem == null
        ? null
        : intOr(item.icmsOrigem),
    icmsSituacaoTributaria: nullable(item.icmsSituacaoTributaria),
    icmsModalidadeBaseCalculo:
      item.icmsModalidadeBaseCalculo === "" || item.icmsModalidadeBaseCalculo == null
        ? null
        : intOr(item.icmsModalidadeBaseCalculo),
    icmsBaseCalculo:
      item.icmsBaseCalculo === "" || item.icmsBaseCalculo == null
        ? null
        : numberOr(item.icmsBaseCalculo),
    icmsAliquota:
      item.icmsAliquota === "" || item.icmsAliquota == null
        ? null
        : numberOr(item.icmsAliquota),
    icmsValor:
      item.icmsValor === "" || item.icmsValor == null
        ? null
        : numberOr(item.icmsValor),
    pisSituacaoTributaria: nullable(item.pisSituacaoTributaria),
    pisBaseCalculo:
      item.pisBaseCalculo === "" || item.pisBaseCalculo == null
        ? null
        : numberOr(item.pisBaseCalculo),
    pisAliquota:
      item.pisAliquota === "" || item.pisAliquota == null
        ? null
        : numberOr(item.pisAliquota),
    pisValor:
      item.pisValor === "" || item.pisValor == null
        ? null
        : numberOr(item.pisValor),
    cofinsSituacaoTributaria: nullable(item.cofinsSituacaoTributaria),
    cofinsBaseCalculo:
      item.cofinsBaseCalculo === "" || item.cofinsBaseCalculo == null
        ? null
        : numberOr(item.cofinsBaseCalculo),
    cofinsAliquota:
      item.cofinsAliquota === "" || item.cofinsAliquota == null
        ? null
        : numberOr(item.cofinsAliquota),
    cofinsValor:
      item.cofinsValor === "" || item.cofinsValor == null
        ? null
        : numberOr(item.cofinsValor),
    informacoesAdicionais: nullable(item.informacoesAdicionais),
    payloadExtra: parseJson(item.payloadExtra),
  };
}

function totalItens(items: any[]) {
  return items.reduce(
    (sum, item) =>
      sum +
      numberOr(item.valorBruto, numberOr(item.quantidade, 1) * numberOr(item.valorUnitario, 0)) -
      numberOr(item.valorDesconto, 0),
    0,
  );
}

async function obterCliente(body: any) {
  const clienteId = intOr(body.clienteId);
  if (!clienteId) throw new Error("Selecione o cliente/tomador da nota.");
  const cliente = await prisma.cliente.findUnique({ where: { clienteid: clienteId } });
  if (!cliente) throw new Error("Cliente não encontrado.");
  return cliente;
}

function notaData(body: any, cliente: any, itens: any[]) {
  const tipo: TipoDocumentoFiscal = body.tipo === "NFSE" ? "NFSE" : "NFE";
  const valorItens = totalItens(itens);
  const valorProdutos =
    tipo === "NFE" ? numberOr(body.valorProdutos, valorItens) : numberOr(body.valorProdutos, 0);
  const valorServicos =
    tipo === "NFSE" ? numberOr(body.valorServicos, valorItens) : numberOr(body.valorServicos, 0);
  const valorFrete = numberOr(body.valorFrete, 0);
  const valorSeguro = numberOr(body.valorSeguro, 0);
  const valorDesconto = numberOr(body.valorDesconto, 0);
  const valorOutrasDespesas = numberOr(body.valorOutrasDespesas, 0);
  const totalBase = tipo === "NFE" ? valorProdutos : valorServicos;
  const valorTotal =
    body.valorTotal === undefined || body.valorTotal === null || body.valorTotal === ""
      ? totalBase + valorFrete + valorSeguro + valorOutrasDespesas - valorDesconto
      : numberOr(body.valorTotal, 0);

  return {
    tipo,
    empresaFiscalId: intOr(body.empresaFiscalId),
    clienteId: cliente.clienteid,
    propostaId: body.propostaId ? intOr(body.propostaId) : null,
    numero: nullable(body.numero),
    serie: nullable(body.serie),
    dataEmissao: body.dataEmissao ? new Date(body.dataEmissao) : new Date(),
    naturezaOperacao: nullable(body.naturezaOperacao),
    finalidadeEmissao: intOr(body.finalidadeEmissao, 1),
    consumidorFinal: intOr(body.consumidorFinal, 1),
    presencaComprador: intOr(body.presencaComprador, 9),
    modalidadeFrete: intOr(body.modalidadeFrete, 9),
    indicadorIeDestinatario: intOr(body.indicadorIeDestinatario, 9),
    destinatarioNome:
      body.destinatarioNome || cliente.razaoSocial || cliente.nomeFantasia || cliente.responsavel || `Cliente ${cliente.clienteid}`,
    destinatarioCnpj: nullable(body.destinatarioCnpj ?? cliente.cnpj),
    destinatarioCpf: nullable(body.destinatarioCpf ?? cliente.cpf),
    destinatarioIe: nullable(body.destinatarioIe ?? cliente.inscricaoEstadual),
    destinatarioIm: nullable(body.destinatarioIm),
    destinatarioEmail: nullable(body.destinatarioEmail ?? cliente.email1),
    destinatarioTelefone: nullable(body.destinatarioTelefone ?? cliente.telefone1),
    destinatarioCep: nullable(body.destinatarioCep ?? cliente.cep),
    destinatarioEndereco: nullable(body.destinatarioEndereco ?? cliente.endereco),
    destinatarioNumero: nullable(body.destinatarioNumero ?? cliente.numero),
    destinatarioComplemento: nullable(body.destinatarioComplemento ?? cliente.complemento),
    destinatarioBairro: nullable(body.destinatarioBairro ?? cliente.bairro),
    destinatarioCidade: nullable(body.destinatarioCidade ?? cliente.cidade),
    destinatarioEstado: nullable(body.destinatarioEstado ?? cliente.estado),
    destinatarioCodigoMunicipio: nullable(body.destinatarioCodigoMunicipio),
    destinatarioPais: nullable(body.destinatarioPais ?? cliente.pais) || "Brasil",
    valorProdutos,
    valorServicos,
    valorFrete,
    valorSeguro,
    valorDesconto,
    valorOutrasDespesas,
    valorTotal,
    itemListaServico: nullable(body.itemListaServico),
    codigoTributarioMunicipal: nullable(body.codigoTributarioMunicipal),
    cnaeServico: nullable(body.cnaeServico),
    aliquotaIss:
      body.aliquotaIss === "" || body.aliquotaIss == null ? null : numberOr(body.aliquotaIss),
    issRetido: Boolean(body.issRetido),
    codigoObra: nullable(body.codigoObra),
    art: nullable(body.art),
    informacoesAdicionais: nullable(body.informacoesAdicionais),
    payloadExtra: parseJson(body.payloadExtra),
  };
}

async function notaCompleta(id: number) {
  return prisma.notaFiscal.findUnique({
    where: { notafiscalid: id },
    include: {
      empresaFiscal: true,
      cliente: true,
      proposta: true,
      itens: { orderBy: { itemnotafiscalid: "asc" } },
      eventos: { orderBy: { createdAt: "desc" } },
    },
  });
}

async function registrarEvento(
  notaFiscalId: number,
  tipo: string,
  status: string | undefined,
  descricao: string | undefined,
  retorno?: any,
  protocolo?: string,
) {
  await prisma.eventoNotaFiscal.create({
    data: {
      notaFiscalId,
      tipo,
      status,
      descricao,
      retorno,
      protocolo,
    },
  });
}

async function aplicarRetorno(notaId: number, baseUrl: string, data: any) {
  const parsed = parseFocusResult(baseUrl, data);
  const now = new Date();

  return prisma.notaFiscal.update({
    where: { notafiscalid: notaId },
    data: {
      status: parsed.status as any,
      numero: parsed.numero ? String(parsed.numero) : undefined,
      serie: parsed.serie ? String(parsed.serie) : undefined,
      chave: parsed.chave ? String(parsed.chave) : undefined,
      protocolo: parsed.protocolo ? String(parsed.protocolo) : undefined,
      codigoVerificacao: parsed.codigoVerificacao
        ? String(parsed.codigoVerificacao)
        : undefined,
      caminhoXml: parsed.caminhoXml,
      caminhoPdf: parsed.caminhoPdf,
      mensagemRetorno: parsed.mensagem ? String(parsed.mensagem) : undefined,
      retornoProvedor: data,
      dataAutorizacao: parsed.status === "AUTORIZADA" ? now : undefined,
      dataCancelamento: parsed.status === "CANCELADA" ? now : undefined,
    },
  });
}

export const dashboard = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [total, rascunhos, processando, autorizadas, rejeitadas, canceladas, soma] =
      await Promise.all([
        prisma.notaFiscal.count(),
        prisma.notaFiscal.count({ where: { status: "RASCUNHO" } }),
        prisma.notaFiscal.count({ where: { status: "PROCESSANDO" } }),
        prisma.notaFiscal.count({ where: { status: "AUTORIZADA" } }),
        prisma.notaFiscal.count({ where: { status: { in: ["REJEITADA", "ERRO"] } } }),
        prisma.notaFiscal.count({ where: { status: "CANCELADA" } }),
        prisma.notaFiscal.aggregate({
          where: { status: "AUTORIZADA" },
          _sum: { valorTotal: true },
        }),
      ]);

    res.json({
      total,
      rascunhos,
      processando,
      autorizadas,
      rejeitadas,
      canceladas,
      valorAutorizado: Number(soma._sum.valorTotal || 0),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar dashboard fiscal." });
  }
};

export const listarEmpresas = async (_req: Request, res: Response): Promise<void> => {
  try {
    const empresas = await prisma.empresaFiscal.findMany({
      orderBy: [{ ativo: "desc" }, { razaoSocial: "asc" }],
    });
    res.json(empresas.map(semTokens));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar empresas fiscais." });
  }
};

export const criarEmpresa = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body.razaoSocial || !req.body.cnpj) {
      res.status(400).json({ error: "Razão social e CNPJ são obrigatórios." });
      return;
    }

    const empresa = await prisma.empresaFiscal.create({ data: empresaData(req.body) });
    res.status(201).json(semTokens(empresa));
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Erro ao cadastrar empresa fiscal." });
  }
};

export const atualizarEmpresa = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = intOr(req.params.id);
    const existente = await prisma.empresaFiscal.findUnique({
      where: { empresafiscalid: id },
    });
    if (!existente) {
      res.status(404).json({ error: "Empresa fiscal não encontrada." });
      return;
    }

    const empresa = await prisma.empresaFiscal.update({
      where: { empresafiscalid: id },
      data: empresaData(req.body, existente),
    });
    res.json(semTokens(empresa));
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Erro ao atualizar empresa fiscal." });
  }
};

export const removerEmpresa = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = intOr(req.params.id);
    const notas = await prisma.notaFiscal.count({ where: { empresaFiscalId: id } });
    if (notas > 0) {
      await prisma.empresaFiscal.update({
        where: { empresafiscalid: id },
        data: { ativo: false },
      });
      res.json({ message: "Empresa desativada porque já possui documentos fiscais." });
      return;
    }
    await prisma.empresaFiscal.delete({ where: { empresafiscalid: id } });
    res.json({ message: "Empresa fiscal removida." });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Erro ao remover empresa fiscal." });
  }
};

export const listarNotas = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const tipo = req.query.tipo ? String(req.query.tipo) : undefined;
    const busca = req.query.busca ? String(req.query.busca) : undefined;

    const notas = await prisma.notaFiscal.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(tipo ? { tipo: tipo as any } : {}),
        ...(busca
          ? {
              OR: [
                { referencia: { contains: busca, mode: "insensitive" } },
                { numero: { contains: busca, mode: "insensitive" } },
                { destinatarioNome: { contains: busca, mode: "insensitive" } },
                { chave: { contains: busca, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        empresaFiscal: { select: { empresafiscalid: true, razaoSocial: true, nomeFantasia: true, cnpj: true, ambiente: true } },
        cliente: { select: { clienteid: true, razaoSocial: true, nomeFantasia: true } },
        proposta: { select: { propostaid: true, numero: true, titulo: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    res.json(notas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar notas fiscais." });
  }
};

export const listarLogs = async (_req: Request, res: Response): Promise<void> => {
  try {
    const eventos = await prisma.eventoNotaFiscal.findMany({
      include: {
        notaFiscal: {
          select: { notafiscalid: true, referencia: true, numero: true, tipo: true, status: true, destinatarioNome: true, valorTotal: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    res.json(eventos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar logs fiscais." });
  }
};

export const buscarNota = async (req: Request, res: Response): Promise<void> => {
  try {
    const nota = await notaCompleta(intOr(req.params.id));
    if (!nota) {
      res.status(404).json({ error: "Nota fiscal não encontrada." });
      return;
    }
    res.json({ ...nota, empresaFiscal: semTokens(nota.empresaFiscal) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar nota fiscal." });
  }
};

export const importarProposta = async (req: Request, res: Response): Promise<void> => {
  try {
    const proposta = await prisma.proposta.findUnique({
      where: { propostaid: intOr(req.params.id) },
      include: {
        cliente: true,
        itens: {
          include: { servico: true },
          orderBy: [{ ordem: "asc" }, { itempropostaid: "asc" }],
        },
      },
    });

    if (!proposta) {
      res.status(404).json({ error: "Proposta não encontrada." });
      return;
    }

    const itens = proposta.itens.map((item) => ({
      codigo: item.codigo || item.servico?.codigo || `PROP${proposta.numero}`,
      descricao: item.descricao,
      unidade: item.unidade || item.servico?.unidade || "UN",
      quantidade: Number(item.quantidade),
      valorUnitario: Number(item.valorUnitario),
      valorBruto: Number(item.quantidade) * Number(item.valorUnitario),
      valorDesconto: Number(item.desconto || 0),
      informacoesAdicionais: item.detalhes || item.observacoes || undefined,
    }));

    res.json({
      propostaId: proposta.propostaid,
      numeroProposta: proposta.numero,
      tipoProposta: proposta.tipoProposta,
      cliente: proposta.cliente,
      itens,
      valorItens: totalItens(itens),
      frete: Number(proposta.frete || 0),
      observacoes:
        proposta.observacoes || proposta.descricao || proposta.escopo || undefined,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao importar proposta para o fiscal." });
  }
};

export const criarNota = async (req: Request, res: Response): Promise<void> => {
  try {
    const cliente = await obterCliente(req.body);
    const empresaFiscalId = intOr(req.body.empresaFiscalId);
    if (!empresaFiscalId) {
      res.status(400).json({ error: "Selecione a empresa emitente." });
      return;
    }
    const empresa = await prisma.empresaFiscal.findUnique({
      where: { empresafiscalid: empresaFiscalId },
    });
    if (!empresa) {
      res.status(404).json({ error: "Empresa emitente não encontrada." });
      return;
    }

    const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
    if (!itens.length) {
      res.status(400).json({ error: "Adicione pelo menos um item à nota." });
      return;
    }
    if (itens.some((item: any) => !item.descricao)) {
      res.status(400).json({ error: "Todos os itens precisam de descrição." });
      return;
    }

    const referencia = `NF${Date.now()}${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const data = notaData(req.body, cliente, itens);

    const nota = await prisma.notaFiscal.create({
      data: {
        referencia,
        ...data,
        itens: { create: itens.map(itemData) },
        eventos: {
          create: {
            tipo: "CRIACAO",
            status: "RASCUNHO",
            descricao: "Documento fiscal criado como rascunho.",
          },
        },
      },
      include: { itens: true },
    });

    res.status(201).json(nota);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Erro ao criar nota fiscal." });
  }
};

export const atualizarNota = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = intOr(req.params.id);
    const atual = await prisma.notaFiscal.findUnique({ where: { notafiscalid: id } });
    if (!atual) {
      res.status(404).json({ error: "Nota fiscal não encontrada." });
      return;
    }
    if (!["RASCUNHO", "ERRO", "REJEITADA"].includes(atual.status)) {
      res.status(400).json({ error: "Somente rascunhos ou notas com erro podem ser editados." });
      return;
    }

    const cliente = await obterCliente(req.body);
    const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
    if (!itens.length) {
      res.status(400).json({ error: "Adicione pelo menos um item à nota." });
      return;
    }
    const data = notaData(req.body, cliente, itens);

    await prisma.$transaction(async (tx) => {
      await tx.itemNotaFiscal.deleteMany({ where: { notaFiscalId: id } });
      await tx.notaFiscal.update({
        where: { notafiscalid: id },
        data: {
          ...data,
          status: "RASCUNHO",
          mensagemRetorno: null,
          itens: { create: itens.map(itemData) },
        },
      });
      await tx.eventoNotaFiscal.create({
        data: {
          notaFiscalId: id,
          tipo: "EDICAO",
          status: "RASCUNHO",
          descricao: "Rascunho fiscal atualizado.",
        },
      });
    });

    res.json(await notaCompleta(id));
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Erro ao atualizar nota fiscal." });
  }
};

export const removerNota = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = intOr(req.params.id);
    const atual = await prisma.notaFiscal.findUnique({ where: { notafiscalid: id } });
    if (!atual) {
      res.status(404).json({ error: "Nota fiscal não encontrada." });
      return;
    }
    if (!["RASCUNHO", "ERRO", "REJEITADA"].includes(atual.status)) {
      res.status(400).json({ error: "Este documento não pode ser excluído após o envio ao fisco." });
      return;
    }
    await prisma.notaFiscal.delete({ where: { notafiscalid: id } });
    res.json({ message: "Documento fiscal removido." });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Erro ao excluir nota fiscal." });
  }
};

export const visualizarPayload = async (req: Request, res: Response): Promise<void> => {
  try {
    const nota = await notaCompleta(intOr(req.params.id));
    if (!nota) {
      res.status(404).json({ error: "Nota fiscal não encontrada." });
      return;
    }
    res.json(buildFocusPayload(nota));
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Erro ao montar payload fiscal." });
  }
};

export const emitirNota = async (req: Request, res: Response): Promise<void> => {
  const id = intOr(req.params.id);
  try {
    const nota = await notaCompleta(id);
    if (!nota) {
      res.status(404).json({ error: "Nota fiscal não encontrada." });
      return;
    }
    if (!["RASCUNHO", "ERRO", "REJEITADA"].includes(nota.status)) {
      res.status(400).json({ error: "Documento já enviado ou finalizado." });
      return;
    }

    const result = await emitirNaFocus(nota);
    await prisma.notaFiscal.update({
      where: { notafiscalid: id },
      data: { payloadEnviado: result.payload, retornoProvedor: result.data },
    });
    const atualizada = await aplicarRetorno(id, result.baseUrl, result.data);
    await registrarEvento(
      id,
      "EMISSAO",
      atualizada.status,
      atualizada.mensagemRetorno || "Documento enviado ao provedor fiscal.",
      result.data,
      atualizada.protocolo || undefined,
    );

    res.json(await notaCompleta(id));
  } catch (error: any) {
    console.error(error);
    if (id) {
      await prisma.notaFiscal
        .update({
          where: { notafiscalid: id },
          data: {
            status: "ERRO",
            mensagemRetorno: error.message,
            retornoProvedor: error.responseData,
          },
        })
        .catch(() => undefined);
      await registrarEvento(
        id,
        "ERRO_EMISSAO",
        "ERRO",
        error.message,
        error.responseData,
      ).catch(() => undefined);
    }
    res.status(error.statusCode || 500).json({
      error: error.message || "Erro ao emitir documento fiscal.",
      detalhes: error.responseData,
    });
  }
};

export const consultarNota = async (req: Request, res: Response): Promise<void> => {
  const id = intOr(req.params.id);
  try {
    const nota = await notaCompleta(id);
    if (!nota) {
      res.status(404).json({ error: "Nota fiscal não encontrada." });
      return;
    }
    if (nota.status === "RASCUNHO") {
      res.status(400).json({ error: "O rascunho ainda não foi enviado ao provedor fiscal." });
      return;
    }

    const result = await consultarNaFocus(nota);
    const atualizada = await aplicarRetorno(id, result.baseUrl, result.data);
    await registrarEvento(
      id,
      "CONSULTA",
      atualizada.status,
      atualizada.mensagemRetorno || "Status consultado no provedor fiscal.",
      result.data,
      atualizada.protocolo || undefined,
    );

    res.json(await notaCompleta(id));
  } catch (error: any) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      error: error.message || "Erro ao consultar documento fiscal.",
      detalhes: error.responseData,
    });
  }
};

export const cancelarNota = async (req: Request, res: Response): Promise<void> => {
  const id = intOr(req.params.id);
  try {
    const justificativa = String(req.body.justificativa || "").trim();
    if (justificativa.length < 15 || justificativa.length > 255) {
      res.status(400).json({ error: "A justificativa deve ter entre 15 e 255 caracteres." });
      return;
    }

    const nota = await notaCompleta(id);
    if (!nota) {
      res.status(404).json({ error: "Nota fiscal não encontrada." });
      return;
    }
    if (nota.status !== "AUTORIZADA") {
      res.status(400).json({ error: "Somente documento autorizado pode ser cancelado." });
      return;
    }

    const result = await cancelarNaFocus(nota, justificativa);
    const statusProvedor = String(result.data?.status || result.data?.situacao || "").toLowerCase();
    let atualizada;

    // Erro de cancelamento não transforma uma nota autorizada em rejeitada.
    // Ela continua autorizada até que o provedor confirme o cancelamento.
    if (statusProvedor.includes("erro") && statusProvedor.includes("cancel")) {
      const parsed = parseFocusResult(result.baseUrl, result.data);
      atualizada = await prisma.notaFiscal.update({
        where: { notafiscalid: id },
        data: {
          status: "AUTORIZADA",
          retornoProvedor: result.data,
          mensagemRetorno: parsed.mensagem || "O cancelamento não foi autorizado pelo provedor fiscal.",
        },
      });
    } else {
      atualizada = await aplicarRetorno(id, result.baseUrl, result.data);
    }

    await registrarEvento(
      id,
      atualizada.status === "CANCELADA" ? "CANCELAMENTO" : "ERRO_CANCELAMENTO",
      atualizada.status,
      atualizada.status === "CANCELADA" ? justificativa : (atualizada.mensagemRetorno || justificativa),
      result.data,
      atualizada.protocolo || undefined,
    );

    res.json(await notaCompleta(id));
  } catch (error: any) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      error: error.message || "Erro ao cancelar documento fiscal.",
      detalhes: error.responseData,
    });
  }
};

export const cartaCorrecaoNota = async (req: Request, res: Response): Promise<void> => {
  const id = intOr(req.params.id);
  try {
    const correcao = String(req.body.correcao || "").trim();
    if (correcao.length < 15 || correcao.length > 1000) {
      res.status(400).json({ error: "A carta de correção deve ter entre 15 e 1000 caracteres." });
      return;
    }

    const nota = await notaCompleta(id);
    if (!nota) {
      res.status(404).json({ error: "Nota fiscal não encontrada." });
      return;
    }
    if (nota.tipo !== "NFE") {
      res.status(400).json({ error: "Carta de correção está disponível somente para NF-e." });
      return;
    }
    if (nota.status !== "AUTORIZADA") {
      res.status(400).json({ error: "Somente NF-e autorizada pode receber carta de correção." });
      return;
    }

    const result = await emitirCartaCorrecaoNaFocus(nota, correcao);
    await registrarEvento(
      id,
      "CARTA_CORRECAO",
      nota.status,
      correcao,
      result.data,
      result.data?.protocolo || result.data?.protocolo_evento,
    );

    res.json(await notaCompleta(id));
  } catch (error: any) {
    console.error(error);
    if (id) {
      await registrarEvento(
        id,
        "ERRO_CARTA_CORRECAO",
        "ERRO",
        error.message,
        error.responseData,
      ).catch(() => undefined);
    }
    res.status(error.statusCode || 500).json({
      error: error.message || "Erro ao emitir carta de correção.",
      detalhes: error.responseData,
    });
  }
};
