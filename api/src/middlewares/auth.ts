import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface TokenPayload {
  id: number;
  empresaId: number | null;
  role: string;
}

export default (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      error: "Token não informado"
    });
    return;
  }

  const token = authHeader.split(" ")[1];

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
