import { Request, Response } from "express";
import prisma from "../prisma";

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    const empresaId = req.empresaId as number;

    const cliente = await prisma.cliente.create({
      data: {
        empresaId,
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
        nomeTelefone1: body.nomeTelefone1,
        nomeTelefone2: body.nomeTelefone2,
        nomeTelefone3: body.nomeTelefone3,
        nomeTelefone4: body.nomeTelefone4,

        email1: body.email1,
        email2: body.email2,
        email3: body.email3,
        email4: body.email4,
        nomeEmail1: body.nomeEmail1,
        nomeEmail2: body.nomeEmail2,
        nomeEmail3: body.nomeEmail3,
        nomeEmail4: body.nomeEmail4,
        site: body.site,
        cep: body.cep,
        endereco: body.endereco,
        numero: body.numero,
        complemento: body.complemento,
        bairro: body.bairro,
        cidade: body.cidade,
        estado: body.estado,
        pais: body.pais,
        observacoes: body.observacoes,
        origemLead: body.origemLead,
        tags: body.tags,
        statusCliente: body.statusCliente,
        limiteCredito: body.limiteCredito,
        descontoPadrao: body.descontoPadrao,
        logo: body.logo,
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

export const read = async (req: Request, res: Response): Promise<void> => {
  try {
    const empresaId = req.empresaId as number;

    const clientes = await prisma.cliente.findMany({
      where: { empresaId },
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
    const empresaId = req.empresaId as number;

    const cliente = await prisma.cliente.findFirst({
      where: {
        clienteid: Number(id),
        empresaId
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
    const empresaId = req.empresaId as number;

    // updateMany com filtro composto (id + empresaId) evita que um
    // usuário da empresa A edite um registro da empresa B só
    // manipulando o :id na URL.
    const resultado = await prisma.cliente.updateMany({
      where: {
        clienteid: Number(id),
        empresaId
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
        nomeTelefone1: body.nomeTelefone1,
        nomeTelefone2: body.nomeTelefone2,
        nomeTelefone3: body.nomeTelefone3,
        nomeTelefone4: body.nomeTelefone4,

        email1: body.email1,
        email2: body.email2,
        email3: body.email3,
        email4: body.email4,
        nomeEmail1: body.nomeEmail1,
        nomeEmail2: body.nomeEmail2,
        nomeEmail3: body.nomeEmail3,
        nomeEmail4: body.nomeEmail4,
        site: body.site,
        cep: body.cep,
        endereco: body.endereco,
        numero: body.numero,
        complemento: body.complemento,
        bairro: body.bairro,
        cidade: body.cidade,
        estado: body.estado,
        pais: body.pais,
        observacoes: body.observacoes,
        origemLead: body.origemLead,
        tags: body.tags,
        statusCliente: body.statusCliente,
        limiteCredito: body.limiteCredito,
        descontoPadrao: body.descontoPadrao,
        logo: body.logo,
        dataNascimento: body.dataNascimento
          ? new Date(body.dataNascimento)
          : null
      }
    });

    if (resultado.count === 0) {
      res.status(404).json({
        error: "Cliente não encontrado"
      });
      return;
    }

    const cliente = await prisma.cliente.findFirst({
      where: { clienteid: Number(id), empresaId }
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
    const empresaId = req.empresaId as number;

    const resultado = await prisma.cliente.deleteMany({
      where: {
        clienteid: Number(id),
        empresaId
      }
    });

    if (resultado.count === 0) {
      res.status(404).json({
        error: "Cliente não encontrado"
      });
      return;
    }

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
