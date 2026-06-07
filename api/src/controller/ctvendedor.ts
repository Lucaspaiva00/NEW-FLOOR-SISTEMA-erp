import { Request, Response } from "express";
import prisma from "../prisma";

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;

    const vendedor = await prisma.vendedor.create({
      data: {
        nome: body.nome,
        email: body.email,
        telefone: body.telefone,
        ativo: body.ativo ?? true
      }
    });

    res.status(201).json(vendedor);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao cadastrar vendedor"
    });
  }
};

export const read = async (_req: Request, res: Response): Promise<void> => {
  try {
    const vendedores = await prisma.vendedor.findMany({
      include: {
        propostas: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json(vendedores);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao buscar vendedores"
    });
  }
};

export const readOne = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const vendedor = await prisma.vendedor.findUnique({
      where: {
        vendedorid: Number(id)
      },
      include: {
        propostas: true
      }
    });

    if (!vendedor) {
      res.status(404).json({
        error: "Vendedor não encontrado"
      });
      return;
    }

    res.status(200).json(vendedor);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao buscar vendedor"
    });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body;

    const vendedor = await prisma.vendedor.update({
      where: {
        vendedorid: Number(id)
      },
      data: {
        nome: body.nome,
        email: body.email,
        telefone: body.telefone,
        ativo: body.ativo
      }
    });

    res.status(200).json(vendedor);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao atualizar vendedor"
    });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.vendedor.delete({
      where: {
        vendedorid: Number(id)
      }
    });

    res.status(200).json({
      message: "Vendedor removido"
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao remover vendedor"
    });
  }
};