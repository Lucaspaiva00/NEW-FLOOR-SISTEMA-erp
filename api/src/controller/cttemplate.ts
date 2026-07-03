import { Request, Response } from "express";
import prisma from "../prisma";

function booleanOu(valor: unknown, padrao: boolean): boolean {
  return typeof valor === "boolean" ? valor : padrao;
}

function montarDadosTemplate(body: Record<string, unknown>) {
  return {
    nome: body.nome as string,
    descricao: (body.descricao as string) || null,
    ativo: booleanOu(body.ativo, true),
    logo: (body.logo as string) || null,
    corPrimaria: (body.corPrimaria as string) || null,
    corSecundaria: (body.corSecundaria as string) || null,
    cabecalho: (body.cabecalho as string) || null,
    rodape: (body.rodape as string) || null,
    textoApresentacao: (body.textoApresentacao as string) || null,
    textoGarantia: (body.textoGarantia as string) || null,
    textoPagamento: (body.textoPagamento as string) || null,
    textoObservacao: (body.textoObservacao as string) || null,
    textoObservacaoServicos: (body.textoObservacaoServicos as string) || null,
    textoObservacaoSistema: (body.textoObservacaoSistema as string) || null,
    exibirLogo: booleanOu(body.exibirLogo, true),
    exibirEndereco: booleanOu(body.exibirEndereco, true),
    exibirTelefone: booleanOu(body.exibirTelefone, true),
    exibirEmail: booleanOu(body.exibirEmail, true),
    exibirAssinatura: booleanOu(body.exibirAssinatura, true),
    htmlPersonalizado: (body.htmlPersonalizado as string) || null,
    cssPersonalizado: (body.cssPersonalizado as string) || null,
  };
}

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const template = await prisma.templateProposta.create({
      data: montarDadosTemplate(req.body),
    });

    res.status(201).json(template);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao criar template" });
  }
};

export const read = async (_req: Request, res: Response): Promise<void> => {
  try {
    const templates = await prisma.templateProposta.findMany({
      orderBy: { createdAt: "desc" }
    });

    res.json(templates);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao buscar templates" });
  }
};

export const readOne = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const template = await prisma.templateProposta.findUnique({
      where: { templateid: Number(id) }
    });

    if (!template) {
      res.status(404).json({ error: "Template não encontrado" });
      return;
    }

    res.json(template);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao buscar template" });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const template = await prisma.templateProposta.update({
      where: { templateid: Number(id) },
      data: montarDadosTemplate(req.body),
    });

    res.json(template);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao atualizar template" });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.templateProposta.delete({
      where: { templateid: Number(id) }
    });

    res.json({ message: "Template removido" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao remover template" });
  }
};
