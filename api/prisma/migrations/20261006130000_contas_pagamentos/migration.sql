ALTER TABLE "ContaFinanceira" ADD COLUMN IF NOT EXISTS "empresaId" INTEGER;

ALTER TABLE "CategoriaFinanceira" ADD COLUMN IF NOT EXISTS "empresaId" INTEGER;

ALTER TABLE "LancamentoFinanceiro" ADD COLUMN IF NOT EXISTS "empresaId" INTEGER;

UPDATE "LancamentoFinanceiro" l SET "empresaId"=p."empresaId" FROM "Proposta" p WHERE l."empresaId" IS NULL AND l."propostaId"=p.propostaid;

DROP INDEX IF EXISTS "CategoriaFinanceira_nome_tipo_key";

CREATE UNIQUE INDEX IF NOT EXISTS "CategoriaFinanceira_empresaId_nome_tipo_key" ON "CategoriaFinanceira"("empresaId", "nome", "tipo");

ALTER TABLE "LancamentoFinanceiro" ADD COLUMN IF NOT EXISTS "favorecido" TEXT;

CREATE TABLE IF NOT EXISTS "PagamentoFinanceiro" (
    "pagamentofinanceiroid" SERIAL PRIMARY KEY, "empresaId" INTEGER NOT NULL,
    "lancamentoId" INTEGER NOT NULL REFERENCES "LancamentoFinanceiro"("lancamentofinanceiroid") ON DELETE RESTRICT,
    "valor" DECIMAL(14,2) NOT NULL, "dataPagamento" TIMESTAMP(3) NOT NULL,
    "contaFinanceiraId" INTEGER, "formaPagamento" TEXT,
    "estornadoEm" TIMESTAMP(3), "motivoEstorno" TEXT, "chaveMigracao" TEXT UNIQUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE INDEX IF NOT EXISTS "PagamentoFinanceiro_empresaId_dataPagamento_idx" ON "PagamentoFinanceiro"("empresaId","dataPagamento");

CREATE INDEX IF NOT EXISTS "PagamentoFinanceiro_lancamentoId_idx" ON "PagamentoFinanceiro"("lancamentoId");

INSERT INTO "PagamentoFinanceiro" ("empresaId","lancamentoId","valor","dataPagamento","contaFinanceiraId","formaPagamento","chaveMigracao")
    SELECT "empresaId","lancamentofinanceiroid","valorPago",COALESCE("dataPagamento","updatedAt"),"contaFinanceiraId","formaPagamento",'LEGADO:'||"lancamentofinanceiroid"
    FROM "LancamentoFinanceiro" WHERE "empresaId" IS NOT NULL AND status='PAGO' AND "valorPago">0
    AND NOT EXISTS (SELECT 1 FROM "PagamentoFinanceiro" p WHERE p."lancamentoId"="LancamentoFinanceiro"."lancamentofinanceiroid")
    ON CONFLICT ("chaveMigracao") DO NOTHING;

UPDATE "LancamentoFinanceiro" SET status='ABERTO' WHERE status='PAGO' AND "valorPago"<valor;