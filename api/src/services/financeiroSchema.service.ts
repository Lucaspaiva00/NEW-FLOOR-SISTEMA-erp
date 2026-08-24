import prisma from "../prisma";

async function exec(sql: string) {
  await prisma.$executeRawUnsafe(sql);
}

export async function garantirSchemaFinanceiro() {
  // Tipos usados apenas pelo módulo financeiro. Os blocos são idempotentes.
  await exec(`DO $$ BEGIN
    CREATE TYPE "TipoLancamentoFinanceiro" AS ENUM ('ENTRADA', 'SAIDA');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;`);

  await exec(`DO $$ BEGIN
    CREATE TYPE "StatusLancamentoFinanceiro" AS ENUM ('ABERTO', 'PAGO', 'CANCELADO');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;`);

  await exec(`DO $$ BEGIN
    CREATE TYPE "OrigemLancamentoFinanceiro" AS ENUM ('MANUAL', 'PROPOSTA');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;`);

  await exec(`DO $$ BEGIN
    CREATE TYPE "TipoContaFinanceira" AS ENUM ('BANCO', 'CAIXA', 'CARTEIRA');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;`);

  await exec(`CREATE TABLE IF NOT EXISTS "ContaFinanceira" (
    "contafinanceiraid" SERIAL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "tipo" "TipoContaFinanceira" NOT NULL DEFAULT 'BANCO',
    "banco" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "saldoInicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);

  await exec(`CREATE TABLE IF NOT EXISTS "CategoriaFinanceira" (
    "categoriafinanceiraid" SERIAL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "tipo" "TipoLancamentoFinanceiro" NOT NULL,
    "descricao" TEXT,
    "cor" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);

  await exec(`CREATE TABLE IF NOT EXISTS "LancamentoFinanceiro" (
    "lancamentofinanceiroid" SERIAL PRIMARY KEY,
    "tipo" "TipoLancamentoFinanceiro" NOT NULL,
    "status" "StatusLancamentoFinanceiro" NOT NULL DEFAULT 'ABERTO',
    "origem" "OrigemLancamentoFinanceiro" NOT NULL DEFAULT 'MANUAL',
    "descricao" TEXT NOT NULL,
    "documento" TEXT,
    "valor" DECIMAL(14,2) NOT NULL,
    "valorPago" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dataCompetencia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataVencimento" TIMESTAMP(3),
    "dataPagamento" TIMESTAMP(3),
    "formaPagamento" TEXT,
    "parcelaNumero" INTEGER NOT NULL DEFAULT 1,
    "totalParcelas" INTEGER NOT NULL DEFAULT 1,
    "observacoes" TEXT,
    "chaveOrigem" TEXT,
    "propostaId" INTEGER,
    "clienteId" INTEGER,
    "categoriaFinanceiraId" INTEGER,
    "contaFinanceiraId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);

  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "CategoriaFinanceira_nome_tipo_key"
    ON "CategoriaFinanceira"("nome", "tipo");`);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "LancamentoFinanceiro_chaveOrigem_key"
    ON "LancamentoFinanceiro"("chaveOrigem");`);
  await exec(`CREATE INDEX IF NOT EXISTS "LancamentoFinanceiro_tipo_idx"
    ON "LancamentoFinanceiro"("tipo");`);
  await exec(`CREATE INDEX IF NOT EXISTS "LancamentoFinanceiro_status_idx"
    ON "LancamentoFinanceiro"("status");`);
  await exec(`CREATE INDEX IF NOT EXISTS "LancamentoFinanceiro_dataVencimento_idx"
    ON "LancamentoFinanceiro"("dataVencimento");`);
  await exec(`CREATE INDEX IF NOT EXISTS "LancamentoFinanceiro_propostaId_idx"
    ON "LancamentoFinanceiro"("propostaId");`);
  await exec(`CREATE INDEX IF NOT EXISTS "LancamentoFinanceiro_clienteId_idx"
    ON "LancamentoFinanceiro"("clienteId");`);

  await exec(`DO $$ BEGIN
    ALTER TABLE "LancamentoFinanceiro"
      ADD CONSTRAINT "LancamentoFinanceiro_propostaId_fkey"
      FOREIGN KEY ("propostaId") REFERENCES "Proposta"("propostaid")
      ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;`);

  await exec(`DO $$ BEGIN
    ALTER TABLE "LancamentoFinanceiro"
      ADD CONSTRAINT "LancamentoFinanceiro_clienteId_fkey"
      FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteid")
      ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;`);

  await exec(`DO $$ BEGIN
    ALTER TABLE "LancamentoFinanceiro"
      ADD CONSTRAINT "LancamentoFinanceiro_categoriaFinanceiraId_fkey"
      FOREIGN KEY ("categoriaFinanceiraId") REFERENCES "CategoriaFinanceira"("categoriafinanceiraid")
      ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;`);

  await exec(`DO $$ BEGIN
    ALTER TABLE "LancamentoFinanceiro"
      ADD CONSTRAINT "LancamentoFinanceiro_contaFinanceiraId_fkey"
      FOREIGN KEY ("contaFinanceiraId") REFERENCES "ContaFinanceira"("contafinanceiraid")
      ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;`);
}
