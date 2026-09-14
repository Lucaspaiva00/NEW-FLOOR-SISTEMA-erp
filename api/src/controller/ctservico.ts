import { Request, Response } from "express";
import prisma from "../prisma";

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    const empresaId = req.empresaId as number;

    const servico = await prisma.servico.create({
      data: {
        empresaId,
        codigo: body.codigo,
        nome: body.nome,
        categoria: body.categoria,
        descricao: body.descricao,
        descricaoInterna: body.descricaoInterna,
        custo: body.custo,
        margemLucro: body.margemLucro,
        unidade: body.unidade,
        tempoExecucao: body.tempoExecucao,
        garantia: body.garantia,
        observacoes: body.observacoes,
        ativo: body.ativo ?? true,
        destaque: body.destaque ?? false
      }
    });

    res.status(201).json(servico);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao cadastrar serviço"
    });
  }
};

export const read = async (req: Request, res: Response): Promise<void> => {
  try {
    const empresaId = req.empresaId as number;

    const servicos = await prisma.servico.findMany({
      where: { empresaId },
      include: {
        itens: {
          include: {
            proposta: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json(servicos);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao buscar serviços"
    });
  }
};

export const readOne = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const empresaId = req.empresaId as number;

    const servico = await prisma.servico.findFirst({
      where: {
        servicoid: Number(id),
        empresaId
      },
      include: {
        itens: {
          include: {
            proposta: true
          }
        }
      }
    });

    if (!servico) {
      res.status(404).json({
        error: "Serviço não encontrado"
      });
      return;
    }

    res.status(200).json(servico);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao buscar serviço"
    });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body;
    const empresaId = req.empresaId as number;

    const resultado = await prisma.servico.updateMany({
      where: {
        servicoid: Number(id),
        empresaId
      },
      data: {
        codigo: body.codigo,
        nome: body.nome,
        categoria: body.categoria,
        descricao: body.descricao,
        descricaoInterna: body.descricaoInterna,
        custo: body.custo,
        margemLucro: body.margemLucro,
        unidade: body.unidade,
        tempoExecucao: body.tempoExecucao,
        garantia: body.garantia,
        observacoes: body.observacoes,
        ativo: body.ativo,
        destaque: body.destaque
      }
    });

    if (resultado.count === 0) {
      res.status(404).json({
        error: "Serviço não encontrado"
      });
      return;
    }

    const servico = await prisma.servico.findFirst({
      where: { servicoid: Number(id), empresaId }
    });

    res.status(200).json(servico);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao atualizar serviço"
    });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const empresaId = req.empresaId as number;

    const resultado = await prisma.servico.deleteMany({
      where: {
        servicoid: Number(id),
        empresaId
      }
    });

    if (resultado.count === 0) {
      res.status(404).json({
        error: "Serviço não encontrado"
      });
      return;
    }

    res.status(200).json({
      message: "Serviço removido"
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao remover serviço"
    });
  }
};
