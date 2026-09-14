declare namespace Express {
  interface Request {
    usuario?: { id: number; empresaId: number | null; role: string };
    empresaId?: number | null;
  }
}
