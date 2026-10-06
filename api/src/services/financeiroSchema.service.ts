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
    "empresaId" INTEGER NOT NULL,
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
    "empresaId" INTEGER NOT NULL,
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
    "empresaId" INTEGER NOT NULL,
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

  for (const table of ["ContaFinanceira", "CategoriaFinanceira", "LancamentoFinanceiro"]) {
    await exec(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "empresaId" INTEGER;`);
  }
  // Não atribuir dados antigos sem empresa a um cliente arbitrário.
  await exec(`UPDATE "LancamentoFinanceiro" l SET "empresaId"=p."empresaId" FROM "Proposta" p WHERE l."empresaId" IS NULL AND l."propostaId"=p.propostaid;`);
  await exec(`DROP INDEX IF EXISTS "CategoriaFinanceira_nome_tipo_key";`);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "CategoriaFinanceira_empresaId_nome_tipo_key" ON "CategoriaFinanceira"("empresaId", "nome", "tipo");`);
  await exec(`ALTER TABLE "LancamentoFinanceiro" ADD COLUMN IF NOT EXISTS "favorecido" TEXT;`);
  await exec(`CREATE TABLE IF NOT EXISTS "PagamentoFinanceiro" (
    "pagamentofinanceiroid" SERIAL PRIMARY KEY, "empresaId" INTEGER NOT NULL,
    "lancamentoId" INTEGER NOT NULL REFERENCES "LancamentoFinanceiro"("lancamentofinanceiroid") ON DELETE RESTRICT,
    "valor" DECIMAL(14,2) NOT NULL, "dataPagamento" TIMESTAMP(3) NOT NULL,
    "contaFinanceiraId" INTEGER, "formaPagamento" TEXT,
    "estornadoEm" TIMESTAMP(3), "motivoEstorno" TEXT, "chaveMigracao" TEXT UNIQUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
  await exec(`CREATE INDEX IF NOT EXISTS "PagamentoFinanceiro_empresaId_dataPagamento_idx" ON "PagamentoFinanceiro"("empresaId","dataPagamento");`);
  await exec(`CREATE INDEX IF NOT EXISTS "PagamentoFinanceiro_lancamentoId_idx" ON "PagamentoFinanceiro"("lancamentoId");`);
  // Migrar a baixa anterior uma única vez, conservando valor e data conhecidos.
  await exec(`INSERT INTO "PagamentoFinanceiro" ("empresaId","lancamentoId","valor","dataPagamento","contaFinanceiraId","formaPagamento","chaveMigracao")
    SELECT "empresaId","lancamentofinanceiroid","valorPago",COALESCE("dataPagamento","updatedAt"),"contaFinanceiraId","formaPagamento",'LEGADO:'||"lancamentofinanceiroid"
    FROM "LancamentoFinanceiro" WHERE "empresaId" IS NOT NULL AND status='PAGO' AND "valorPago">0
    AND NOT EXISTS (SELECT 1 FROM "PagamentoFinanceiro" p WHERE p."lancamentoId"="LancamentoFinanceiro"."lancamentofinanceiroid")
    ON CONFLICT ("chaveMigracao") DO NOTHING;`);
  await exec(`UPDATE "LancamentoFinanceiro" SET status='ABERTO' WHERE status='PAGO' AND "valorPago"<valor;`);
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
