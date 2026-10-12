ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "formaPagamento" TEXT;
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "condicoesPagamento" TEXT;
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "prazoPagamentoDias" INTEGER;
ALTER TABLE "EmpresaFiscal" ADD COLUMN IF NOT EXISTS "cnaesSecundarios" TEXT;
CREATE TABLE IF NOT EXISTS "Fornecedor" (
 "fornecedorid" SERIAL PRIMARY KEY, "empresaId" INTEGER NOT NULL REFERENCES "Empresa"("empresaid"),
 "nome" TEXT NOT NULL, "cnpj" TEXT, "email" TEXT, "telefone" TEXT, "endereco" TEXT,
 "formaPagamento" TEXT, "condicoesPagamento" TEXT, "prazoPagamentoDias" INTEGER,
 "ativo" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Fornecedor_empresaId_cnpj_key" ON "Fornecedor"("empresaId", "cnpj");
CREATE INDEX IF NOT EXISTS "Fornecedor_empresaId_idx" ON "Fornecedor"("empresaId");
CREATE TABLE IF NOT EXISTS "ArquivoFiscal" (
 "arquivofiscalid" SERIAL PRIMARY KEY, "empresaId" INTEGER NOT NULL REFERENCES "Empresa"("empresaid"),
 "titulo" TEXT NOT NULL, "numero" TEXT, "temXml" BOOLEAN NOT NULL DEFAULT false,
 "temPdf" BOOLEAN NOT NULL DEFAULT false, "arquivos" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ArquivoFiscal_empresaId_createdAt_idx" ON "ArquivoFiscal"("empresaId", "createdAt");
