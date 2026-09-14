import { Request, Response, NextFunction } from "express";

/**
 * Deve ser usado sempre DEPOIS do middleware `auth`.
 * Restringe a rota a determinados papéis (role) de usuário.
 */
export default (rolesPermitidos: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.usuario?.role;

    if (!role || !rolesPermitidos.includes(role)) {
      res.status(403).json({
        error: "Você não tem permissão para acessar este recurso"
      });
      return;
    }

    next();
  };
};
