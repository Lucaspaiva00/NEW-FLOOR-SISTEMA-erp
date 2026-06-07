import { Request, Response } from "express";
import prisma from "../prisma";

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;

    const cliente = await prisma.cliente.create({
      data: {
        tipo: body.tipo,
        nomeFantasia: body.nomeFantasia,
        razaoSocial: body.razaoSocial,
        cnpj: body.cnpj,
        cpf: body.cpf,
        inscricaoEstadual: body.inscricaoEstadual,
        responsavel: body.responsavel,
        telefone1: body.telefone1,
        telefone2: body.telefone2,
        telefone3: body.telefone3,
        telefone4: body.telefone4,

        email1: body.email1,
        email2: body.email2,
        email3: body.email3,
        email4: body.email4,
        site: body.site,
        cep: body.cep,
        endereco: body.endereco,
        numero: body.numero,
        complemento: body.complemento,
        bairro: body.bairro,
        cidade: body.cidade,
        estado: body.estado,
        pais: body.pais,
        latitude: body.latitude,
        longitude: body.longitude,
        observacoes: body.observacoes,
        origemLead: body.origemLead,
        tags: body.tags,
        statusCliente: body.statusCliente,
        limiteCredito: body.limiteCredito,
        descontoPadrao: body.descontoPadrao,
        dataNascimento: body.dataNascimento
          ? new Date(body.dataNascimento)
          : null
      }
    });

    res.status(201).json(cliente);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao cadastrar cliente"
    });
  }
};

export const read = async (_req: Request, res: Response): Promise<void> => {
  try {
    const clientes = await prisma.cliente.findMany({
      include: {
        propostas: true,
        agendas: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json(clientes);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao buscar clientes"
    });
  }
};

export const readOne = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const cliente = await prisma.cliente.findUnique({
      where: {
        clienteid: Number(id)
      },
      include: {
        propostas: {
          include: {
            itens: true
          }
        },
        agendas: true
      }
    });

    if (!cliente) {
      res.status(404).json({
        error: "Cliente não encontrado"
      });
      return;
    }

    res.status(200).json(cliente);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao buscar cliente"
    });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body;

    const cliente = await prisma.cliente.update({
      where: {
        clienteid: Number(id)
      },
      data: {
        tipo: body.tipo,
        nomeFantasia: body.nomeFantasia,
        razaoSocial: body.razaoSocial,
        cnpj: body.cnpj,
        cpf: body.cpf,
        inscricaoEstadual: body.inscricaoEstadual,
        responsavel: body.responsavel,
        telefone1: body.telefone1,
        telefone2: body.telefone2,
        telefone3: body.telefone3,
        telefone4: body.telefone4,

        email1: body.email1,
        email2: body.email2,
        email3: body.email3,
        email4: body.email4,
        site: body.site,
        cep: body.cep,
        endereco: body.endereco,
        numero: body.numero,
        complemento: body.complemento,
        bairro: body.bairro,
        cidade: body.cidade,
        estado: body.estado,
        pais: body.pais,
        latitude: body.latitude,
        longitude: body.longitude,
        observacoes: body.observacoes,
        origemLead: body.origemLead,
        tags: body.tags,
        statusCliente: body.statusCliente,
        limiteCredito: body.limiteCredito,
        descontoPadrao: body.descontoPadrao,
        dataNascimento: body.dataNascimento
          ? new Date(body.dataNascimento)
          : null
      }
    });

    res.status(200).json(cliente);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao atualizar cliente"
    });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.cliente.delete({
      where: {
        clienteid: Number(id)
      }
    });

    res.status(200).json({
      message: "Cliente removido"
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao remover cliente"
    });
  }
};
