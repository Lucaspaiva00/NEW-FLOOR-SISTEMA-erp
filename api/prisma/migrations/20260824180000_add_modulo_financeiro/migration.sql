CREATE TYPE "TipoLancamentoFinanceiro" AS ENUM ('ENTRADA', 'SAIDA');
CREATE TYPE "StatusLancamentoFinanceiro" AS ENUM ('ABERTO', 'PAGO', 'CANCELADO');
CREATE TYPE "OrigemLancamentoFinanceiro" AS ENUM ('MANUAL', 'PROPOSTA');
CREATE TYPE "TipoContaFinanceira" AS ENUM ('BANCO', 'CAIXA', 'CARTEIRA');

CREATE TABLE "ContaFinanceira" (
  "contafinanceiraid" SERIAL NOT NULL,
  "nome" TEXT NOT NULL,
  "tipo" "TipoContaFinanceira" NOT NULL DEFAULT 'BANCO',
  "banco" TEXT,
  "agencia" TEXT,
  "conta" TEXT,
  "saldoInicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContaFinanceira_pkey" PRIMARY KEY ("contafinanceiraid")
);

CREATE TABLE "CategoriaFinanceira" (
  "categoriafinanceiraid" SERIAL NOT NULL,
  "nome" TEXT NOT NULL,
  "tipo" "TipoLancamentoFinanceiro" NOT NULL,
  "descricao" TEXT,
  "cor" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CategoriaFinanceira_pkey" PRIMARY KEY ("categoriafinanceiraid")
);

CREATE TABLE "LancamentoFinanceiro" (
  "lancamentofinanceiroid" SERIAL NOT NULL,
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LancamentoFinanceiro_pkey" PRIMARY KEY ("lancamentofinanceiroid")
);

CREATE UNIQUE INDEX "CategoriaFinanceira_nome_tipo_key" ON "CategoriaFinanceira"("nome", "tipo");
CREATE UNIQUE INDEX "LancamentoFinanceiro_chaveOrigem_key" ON "LancamentoFinanceiro"("chaveOrigem");
CREATE INDEX "LancamentoFinanceiro_tipo_idx" ON "LancamentoFinanceiro"("tipo");
CREATE INDEX "LancamentoFinanceiro_status_idx" ON "LancamentoFinanceiro"("status");
CREATE INDEX "LancamentoFinanceiro_dataVencimento_idx" ON "LancamentoFinanceiro"("dataVencimento");
CREATE INDEX "LancamentoFinanceiro_propostaId_idx" ON "LancamentoFinanceiro"("propostaId");
CREATE INDEX "LancamentoFinanceiro_clienteId_idx" ON "LancamentoFinanceiro"("clienteId");

ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "Proposta"("propostaid") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteid") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_categoriaFinanceiraId_fkey" FOREIGN KEY ("categoriaFinanceiraId") REFERENCES "CategoriaFinanceira"("categoriafinanceiraid") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "ContaFinanceira"("contafinanceiraid") ON DELETE SET NULL ON UPDATE CASCADE;
