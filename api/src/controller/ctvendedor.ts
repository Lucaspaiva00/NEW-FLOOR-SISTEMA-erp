import { Request, Response } from "express";
import prisma from "../prisma";

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    const empresaId = req.empresaId as number;

    const vendedor = await prisma.vendedor.create({
      data: {
        empresaId,
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

export const read = async (req: Request, res: Response): Promise<void> => {
  try {
    const empresaId = req.empresaId as number;

    const vendedores = await prisma.vendedor.findMany({
      where: { empresaId },
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
    const empresaId = req.empresaId as number;

    const vendedor = await prisma.vendedor.findFirst({
      where: {
        vendedorid: Number(id),
        empresaId
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
    const empresaId = req.empresaId as number;

    const resultado = await prisma.vendedor.updateMany({
      where: {
        vendedorid: Number(id),
        empresaId
      },
      data: {
        nome: body.nome,
        email: body.email,
        telefone: body.telefone,
        ativo: body.ativo
      }
    });

    if (resultado.count === 0) {
      res.status(404).json({
        error: "Vendedor não encontrado"
      });
      return;
    }

    const vendedor = await prisma.vendedor.findFirst({
      where: { vendedorid: Number(id), empresaId }
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
    const empresaId = req.empresaId as number;

    const resultado = await prisma.vendedor.deleteMany({
      where: {
        vendedorid: Number(id),
        empresaId
      }
    });

    if (resultado.count === 0) {
      res.status(404).json({
        error: "Vendedor não encontrado"
      });
      return;
    }

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
