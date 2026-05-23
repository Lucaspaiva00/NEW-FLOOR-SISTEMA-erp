import { Request, Response } from "express";
import prisma from "../prisma";

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const template = await prisma.templateProposta.create({
      data: req.body
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
      data: req.body
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
