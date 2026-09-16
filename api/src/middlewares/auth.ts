import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface TokenPayload {
  id: number;
  empresaId: number | null;
  role: string;
}

export default (req: Request, res: Response, next: NextFunction): void => {
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

    next();
  } catch {
    res.status(401).json({
      error: "Token inválido"
    });
  }
};
