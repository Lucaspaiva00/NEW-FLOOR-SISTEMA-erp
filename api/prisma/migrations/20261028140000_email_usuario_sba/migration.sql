CREATE TABLE IF NOT EXISTS "EmailUsuario" (
 "usuarioId" INTEGER PRIMARY KEY REFERENCES "Usuario"("usuarioid") ON DELETE CASCADE,
 "empresaId" INTEGER NOT NULL REFERENCES "Empresa"("empresaid") ON DELETE CASCADE,
 "configuracaoCriptografada" TEXT NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "EmailUsuario_empresaId_idx" ON "EmailUsuario"("empresaId");
