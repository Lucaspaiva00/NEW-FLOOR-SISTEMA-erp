import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

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
    ) as { id: number };

    req.usuario = decoded;

    next();
  } catch {
    res.status(401).json({
      error: "Token inválido"
    });
  }
};
