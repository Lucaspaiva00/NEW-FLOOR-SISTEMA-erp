import { Request, Response } from "express";
import prisma from "../prisma";

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;

    const agenda = await prisma.agenda.create({
      data: {
        titulo: body.titulo,
        descricao: body.descricao,
        tipo: body.tipo,
        prioridade: body.prioridade || "MEDIA",
        local: body.local,
        endereco: body.endereco,
        cidade: body.cidade,
        estado: body.estado,
        dataInicio: new Date(body.dataInicio),
        dataFim: body.dataFim ? new Date(body.dataFim) : null,
        concluido: body.concluido ?? false,
        status: body.status,
        cor: body.cor,
        observacoes: body.observacoes,
        clienteId: body.clienteId || null,
        propostaId: body.propostaId || null
      },
      include: {
        cliente: true,
        proposta: true
      }
    });

    res.status(201).json(agenda);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao criar agenda"
    });
  }
};

export const read = async (_req: Request, res: Response): Promise<void> => {
  try {
    const agendas = await prisma.agenda.findMany({
      include: {
        cliente: true,
        proposta: true
      },
      orderBy: {
        dataInicio: "asc"
      }
    });

    res.status(200).json(agendas);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao buscar agendas"
    });
  }
};

export const readOne = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const agenda = await prisma.agenda.findUnique({
      where: {
        agendaid: Number(id)
      },
      include: {
        cliente: true,
        proposta: {
          include: {
            itens: true
          }
        }
      }
    });

    if (!agenda) {
      res.status(404).json({
        error: "Agenda não encontrada"
      });
      return;
    }

    res.status(200).json(agenda);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao buscar agenda"
    });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body;

    const agendaAtual = await prisma.agenda.findUnique({
      where: {
        agendaid: Number(id)
      }
    });

    if (!agendaAtual) {
      res.status(404).json({
        error: "Agenda não encontrada"
      });
      return;
    }

    const agenda = await prisma.agenda.update({
      where: {
        agendaid: Number(id)
      },
      data: {
        titulo: body.titulo ?? agendaAtual.titulo,
        descricao: body.descricao ?? agendaAtual.descricao,
        tipo: body.tipo ?? agendaAtual.tipo,
        prioridade: body.prioridade ?? agendaAtual.prioridade,
        local: body.local ?? agendaAtual.local,
        endereco: body.endereco ?? agendaAtual.endereco,
        cidade: body.cidade ?? agendaAtual.cidade,
        estado: body.estado ?? agendaAtual.estado,
        dataInicio: body.dataInicio
          ? new Date(body.dataInicio)
          : agendaAtual.dataInicio,
        dataFim: body.dataFim
          ? new Date(body.dataFim)
          : agendaAtual.dataFim,
        concluido: body.concluido ?? agendaAtual.concluido,
        status: body.status ?? agendaAtual.status,
        cor: body.cor ?? agendaAtual.cor,
        observacoes: body.observacoes ?? agendaAtual.observacoes,
        clienteId: body.clienteId ?? agendaAtual.clienteId,
        propostaId: body.propostaId ?? agendaAtual.propostaId
      },
      include: {
        cliente: true,
        proposta: true
      }
    });

    res.status(200).json(agenda);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao atualizar agenda"
    });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.agenda.delete({
      where: {
        agendaid: Number(id)
      }
    });

    res.status(200).json({
      message: "Agenda removida"
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao remover agenda"
    });
  }
};

export const dashboard = async (_req: Request, res: Response): Promise<void> => {
  try {
    const hoje = new Date();

    const totalEventos = await prisma.agenda.count();

    const concluidos = await prisma.agenda.count({
      where: {
        concluido: true
      }
    });

    const pendentes = await prisma.agenda.count({
      where: {
        concluido: false
      }
    });

    const eventosHoje = await prisma.agenda.count({
      where: {
        dataInicio: {
          gte: new Date(hoje.setHours(0, 0, 0, 0)),
          lte: new Date(hoje.setHours(23, 59, 59, 999))
        }
      }
    });

    res.status(200).json({
      totalEventos,
      concluidos,
      pendentes,
      eventosHoje
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro dashboard agenda"
    });
  }
};
