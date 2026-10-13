-- AlterTable
ALTER TABLE "public"."MedicaoObra" ADD COLUMN     "canceladoEm" TIMESTAMP(3),
ADD COLUMN     "motivoCancelamento" TEXT;

-- AlterTable
ALTER TABLE "public"."DespesaObra" ADD COLUMN     "canceladoEm" TIMESTAMP(3),
ADD COLUMN     "motivoCancelamento" TEXT;

-- CreateTable
CREATE TABLE "public"."PlanejamentoObra" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "obraId" INTEGER NOT NULL,
    "colaboradorId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "fracao" DECIMAL(5,2) NOT NULL,
    "observacoes" TEXT NOT NULL,

    CONSTRAINT "PlanejamentoObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HistoricoObra" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "obraId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "acao" TEXT NOT NULL,
    "antes" JSONB NOT NULL,
    "depois" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportacaoObra" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportacaoObra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanejamentoObra_empresaId_obraId_data_idx" ON "public"."PlanejamentoObra"("empresaId", "obraId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "PlanejamentoObra_empresaId_colaboradorId_data_obraId_key" ON "public"."PlanejamentoObra"("empresaId", "colaboradorId", "data", "obraId");

-- CreateIndex
CREATE INDEX "HistoricoObra_empresaId_obraId_createdAt_idx" ON "public"."HistoricoObra"("empresaId", "obraId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportacaoObra_chave_key" ON "public"."ImportacaoObra"("chave");

-- CreateIndex
CREATE INDEX "ImportacaoObra_empresaId_idx" ON "public"."ImportacaoObra"("empresaId");
