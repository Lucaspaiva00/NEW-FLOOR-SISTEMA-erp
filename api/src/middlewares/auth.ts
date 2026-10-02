import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import prisma from "../prisma";
import { resolverConfiguracao } from "../services/configuracaoSistema.service";

interface TokenPayload {
  id: number;
  empresaId: number | null;
  role: string;
}

export default async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  // Aceita o token também via query string (?token=...) — só usado pra
  // downloads diretos (ex: PDF), onde o navegador navega de verdade pra
  // URL (em vez de um fetch com header), e por isso precisa carregar o
  // token na própria URL pra manter a autenticação.
  const token = authHeader
    ? authHeader.split(" ")[1]
    : typeof req.query.token === "string"
      ? req.query.token
      : null;

  if (!token) {
    res.status(401).json({
      error: "Token não informado"
    });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as TokenPayload;

    req.usuario = decoded;

    // SUPER_ADMIN (equipe Paiva Tech) não tem empresaId fixo e pode
    // opcionalmente selecionar o tenant via header, por exemplo pra suporte.
    if (decoded.role === "SUPER_ADMIN") {
      const empresaHeader = req.headers["x-empresa-id"];
      req.empresaId = empresaHeader ? Number(empresaHeader) : null;
    } else {
      if (!decoded.empresaId) {
        res.status(403).json({
          error: "Usuário sem empresa vinculada"
        });
        return;
      }
      req.empresaId = decoded.empresaId;
    }

    if (req.empresaId) {
      let empresa;
      try { empresa = await prisma.empresa.findUnique({where:{empresaid:req.empresaId},select:{configuracaoSistema:true}}); }
      catch { res.status(503).json({error:"Não foi possível carregar o perfil da empresa."}); return; }
      if (!empresa) { res.status(403).json({error:"Empresa não encontrada"}); return; }
      req.configuracaoSistema = resolverConfiguracao(empresa.configuracaoSistema);
      const rota = req.path.split("/")[1];
      const modulo = rota === "colunas-kanban" || rota === "observacoes" ? "propostas" : rota;
      if(req.configuracaoSistema.modulos[modulo] === false) { res.status(403).json({error:"Módulo desabilitado para esta empresa"}); return; }
    }
    next();
  } catch {
    res.status(401).json({
      error: "Token inválido"
    });
  }
};
