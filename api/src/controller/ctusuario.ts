import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../prisma";
import nodemailer from "nodemailer";

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nome, email, senha } = req.body;

    const usuarioExiste = await prisma.usuario.findUnique({
      where: {
        email,
      },
    });

    if (usuarioExiste) {
      res.status(400).json({
        error: "E-mail já cadastrado",
      });
      return;
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHash,
      },
    });

    res.status(201).json(usuario);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao cadastrar usuário",
      message: (error as Error).message,
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, senha } = req.body;

    const usuario = await prisma.usuario.findUnique({
      where: {
        email,
      },
    });

    if (!usuario) {
      res.status(400).json({
        error: "Usuário não encontrado",
      });
      return;
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      res.status(400).json({
        error: "Senha inválida",
      });
      return;
    }

    const token = jwt.sign(
      {
        id: usuario.usuarioid,
      },
      process.env.JWT_SECRET as string,
      {
        expiresIn: "7d",
      },
    );

    res.json({
      usuario,
      token,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao fazer login",
      message: (error as Error).message,
    });
  }
};

export const solicitarRecuperacao = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;

    const usuario = await prisma.usuario.findUnique({
      where: {
        email
      }
    });

    if (!usuario) {
      res.status(404).json({
        error: "Usuário não encontrado"
      });
      return;
    }

    const codigo = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    await prisma.usuario.update({
      where: {
        usuarioid: usuario.usuarioid
      },
      data: {
        codigoRecuperacao: codigo,
        codigoExpiraEm: new Date(
          Date.now() + 15 * 60 * 1000
        )
      }
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Recuperação de senha - NEW FLOOR",
      html: `
        <div style="font-family: Arial">
          <h2>Recuperação de Senha</h2>

          <p>Seu código para redefinição é:</p>

          <h1 style="letter-spacing: 5px;">
            ${codigo}
          </h1>

          <p>
            Este código expira em 15 minutos.
          </p>
        </div>
      `
    });

    res.status(200).json({
      message: "Código enviado com sucesso"
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Erro ao enviar código"
    });
  }
};

export const redefinirSenha = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      email,
      codigo,
      senha
    } = req.body;

    const usuario = await prisma.usuario.findUnique({
      where: {
        email
      }
    });

    if (!usuario) {
      res.status(404).json({
        error: "Usuário não encontrado"
      });
      return;
    }

    if (
      !usuario.codigoRecuperacao ||
      usuario.codigoRecuperacao !== codigo
    ) {
      res.status(400).json({
        error: "Código inválido"
      });
      return;
    }

    if (
      !usuario.codigoExpiraEm ||
      new Date(usuario.codigoExpiraEm) < new Date()
    ) {
      res.status(400).json({
        error: "Código expirado"
      });
      return;
    }

    const senhaHash = await bcrypt.hash(
      senha,
      10
    );

    await prisma.usuario.update({
      where: {
        usuarioid: usuario.usuarioid
      },
      data: {
        senha: senhaHash,
        codigoRecuperacao: null,
        codigoExpiraEm: null
      }
    });

    res.status(200).json({
      message: "Senha alterada com sucesso"
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Erro ao redefinir senha"
    });
  }
};