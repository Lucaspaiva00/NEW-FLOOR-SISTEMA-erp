import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../prisma";

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nome, email, senha } = req.body;

    const usuarioExiste = await prisma.usuario.findUnique({
      where: {
        email
      }
    });

    if (usuarioExiste) {
      res.status(400).json({
        error: "E-mail já cadastrado"
      });
      return;
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHash
      }
    });

    res.status(201).json(usuario);
  } catch (error) {
    res.status(500).json(error);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, senha } = req.body;

    const usuario = await prisma.usuario.findUnique({
      where: {
        email
      }
    });

    if (!usuario) {
      res.status(400).json({
        error: "Usuário não encontrado"
      });
      return;
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      res.status(400).json({
        error: "Senha inválida"
      });
      return;
    }

    const token = jwt.sign(
      {
        id: usuario.usuarioid
      },
      process.env.JWT_SECRET as string,
      {
        expiresIn: "7d"
      }
    );

    res.json({
      usuario,
      token
    });
  } catch (error) {
    res.status(500).json(error);
  }
};
