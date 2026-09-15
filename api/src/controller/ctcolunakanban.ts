import { Request, Response } from "express";
import prisma from "../prisma";

export const read = async (req: Request, res: Response): Promise<void> => {
  try {
    const empresaId = req.empresaId as number;

    const colunas = await prisma.colunaKanban.findMany({
      where: { empresaId },
      orderBy: { ordem: "asc" },
    });

    res.status(200).json(colunas);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao buscar colunas" });
  }
};

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const empresaId = req.empresaId as number;
    const nome = String(req.body.nome || "").trim();

    if (!nome) {
      res.status(400).json({ error: "Informe o nome da coluna" });
      return;
    }

    const ultima = await prisma.colunaKanban.findFirst({
      where: { empresaId },
      orderBy: { ordem: "desc" },
    });

    const coluna = await prisma.colunaKanban.create({
      data: {
        empresaId,
        nome,
        cor: req.body.cor || null,
        ordem: (ultima?.ordem ?? -1) + 1,
      },
    });

    res.status(201).json(coluna);
  } catch (error: any) {
    console.log(error);
    res.status(500).json({
      error: error?.code === "P2002" ? "Já existe uma coluna com esse nome" : "Erro ao criar coluna",
    });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const empresaId = req.empresaId as number;

    const resultado = await prisma.colunaKanban.updateMany({
      where: { colunakanbanid: Number(id), empresaId },
      data: {
        nome: req.body.nome,
        cor: req.body.cor,
        ordem: req.body.ordem !== undefined ? Number(req.body.ordem) : undefined,
      },
    });

    if (resultado.count === 0) {
      res.status(404).json({ error: "Coluna não encontrada" });
      return;
    }

    const coluna = await prisma.colunaKanban.findFirst({ where: { colunakanbanid: Number(id), empresaId } });
    res.status(200).json(coluna);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao atualizar coluna" });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const empresaId = req.empresaId as number;

    // As propostas que estavam nessa coluna voltam a aparecer pela
    // coluna do status real delas (onDelete: SetNull no schema cuida disso).
    const resultado = await prisma.colunaKanban.deleteMany({
      where: { colunakanbanid: Number(id), empresaId },
    });

    if (resultado.count === 0) {
      res.status(404).json({ error: "Coluna não encontrada" });
      return;
    }

    res.status(200).json({ message: "Coluna removida" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao remover coluna" });
  }
};
