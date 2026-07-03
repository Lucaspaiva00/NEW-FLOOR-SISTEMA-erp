-- AlterTable
ALTER TABLE "Proposta" ADD COLUMN "observacoesServicos" TEXT;
ALTER TABLE "Proposta" ADD COLUMN "observacoesSistema" TEXT;

-- Migrate existing data
UPDATE "Proposta"
SET "observacoesServicos" = "observacoes"
WHERE "observacoes" IS NOT NULL
  AND "tipoProposta" = 'SERVICOS';

UPDATE "Proposta"
SET "observacoesSistema" = "observacoes"
WHERE "observacoes" IS NOT NULL
  AND "tipoProposta" = 'SISTEMA';
