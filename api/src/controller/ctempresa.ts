import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../prisma";

/**
 * Provisiona uma nova empresa (tenant) e já cria o primeiro
 * usuário ADMIN dela. Uso restrito a SUPER_ADMIN (equipe Paiva Tech),
 * aplicado na rota via middleware requireRole.
 */
export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      nome,
      slug,
      logo,
      corPrimaria,
      corSecundaria,
      emailContato,
      telefoneContato,
      adminNome,
      adminEmail,
      adminSenha,
    } = req.body;

    const slugExiste = await prisma.empresa.findUnique({ where: { slug } });

    if (slugExiste) {
      res.status(400).json({ error: "Já existe uma empresa com esse slug" });
      return;
    }

    const emailExiste = await prisma.usuario.findUnique({
      where: { email: adminEmail },
    });

    if (emailExiste) {
      res.status(400).json({ error: "E-mail de administrador já cadastrado" });
      return;
    }

    const senhaHash = await bcrypt.hash(adminSenha, 10);

    const empresa = await prisma.empresa.create({
      data: {
        nome,
        slug,
        logo,
        corPrimaria,
        corSecundaria,
        emailContato,
        telefoneContato,
        usuarios: {
          create: {
            nome: adminNome,
            email: adminEmail,
            senha: senhaHash,
            role: "ADMIN",
          },
        },
      },
      include: { usuarios: true },
    });

    res.status(201).json(empresa);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao criar empresa",
      message: (error as Error).message,
    });
  }
};

export const read = async (_req: Request, res: Response): Promise<void> => {
  try {
    const empresas = await prisma.empresa.findMany({
      orderBy: { nome: "asc" },
    });

    res.json(empresas);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao listar empresas" });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { nome, logo, corPrimaria, corSecundaria, emailContato, telefoneContato, ativo } = req.body;

    const empresa = await prisma.empresa.update({
      where: { empresaid: Number(id) },
      data: { nome, logo, corPrimaria, corSecundaria, emailContato, telefoneContato, ativo },
    });

    res.json(empresa);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao atualizar empresa" });
  }
};

/**
 * Retorna os dados da própria empresa do usuário logado — usado
 * pelo frontend pra carregar logo/cores em toda tela (branding),
 * e pela tela de "Perfil da empresa".
 */
export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    const empresaId = req.empresaId;

    if (!empresaId) {
      res.status(404).json({ error: "Nenhuma empresa associada a este usuário" });
      return;
    }

    const empresa = await prisma.empresa.findUnique({
      where: { empresaid: empresaId },
      select: {
        empresaid: true,
        nome: true,
        slug: true,
        logo: true,
        corPrimaria: true,
        corSecundaria: true,
        emailContato: true,
        telefoneContato: true,
      },
    });

    if (!empresa) {
      res.status(404).json({ error: "Empresa não encontrada" });
      return;
    }

    res.json(empresa);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao buscar dados da empresa" });
  }
};

/**
 * Atualiza a própria empresa (logo, cores, contato). Restrito a
 * ADMIN na rota — cada empresa só edita a si mesma via req.empresaId,
 * nunca via :id da URL.
 */
export const updateMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const empresaId = req.empresaId;

    if (!empresaId) {
      res.status(404).json({ error: "Nenhuma empresa associada a este usuário" });
      return;
    }

    const { nome, logo, corPrimaria, corSecundaria, emailContato, telefoneContato } = req.body;

    const empresa = await prisma.empresa.update({
      where: { empresaid: empresaId },
      data: { nome, logo, corPrimaria, corSecundaria, emailContato, telefoneContato },
      select: {
        empresaid: true,
        nome: true,
        slug: true,
        logo: true,
        corPrimaria: true,
        corSecundaria: true,
        emailContato: true,
        telefoneContato: true,
      },
    });

    res.json(empresa);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao atualizar dados da empresa" });
  }
};
