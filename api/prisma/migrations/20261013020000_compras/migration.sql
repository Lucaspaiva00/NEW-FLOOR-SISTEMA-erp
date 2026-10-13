ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "sequenciaCompras" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS "Compra" (
 "compraid" SERIAL PRIMARY KEY,"empresaId" INTEGER NOT NULL REFERENCES "Empresa"("empresaid"),
 "fornecedorId" INTEGER NOT NULL REFERENCES "Fornecedor"("fornecedorid"),"numero" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'RASCUNHO',"dataCompra" TIMESTAMP(3) NOT NULL,"documento" TEXT,
 "itens" JSONB NOT NULL,"subtotal" DECIMAL(14,2) NOT NULL,"frete" DECIMAL(14,2) NOT NULL DEFAULT 0,
 "desconto" DECIMAL(14,2) NOT NULL DEFAULT 0,"total" DECIMAL(14,2) NOT NULL,"formaPagamento" TEXT,
 "condicoesPagamento" TEXT,"planoPagamento" JSONB,"observacoes" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Compra_empresaId_numero_key" ON "Compra"("empresaId","numero");
CREATE INDEX IF NOT EXISTS "Compra_empresaId_dataCompra_idx" ON "Compra"("empresaId","dataCompra");
CREATE INDEX IF NOT EXISTS "Compra_fornecedorId_idx" ON "Compra"("fornecedorId");
ALTER TYPE "OrigemLancamentoFinanceiro" ADD VALUE IF NOT EXISTS 'COMPRA';
ALTER TABLE "LancamentoFinanceiro" ADD COLUMN IF NOT EXISTS "compraId" INTEGER REFERENCES "Compra"("compraid") ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS "LancamentoFinanceiro_compraId_idx" ON "LancamentoFinanceiro"("compraId");
