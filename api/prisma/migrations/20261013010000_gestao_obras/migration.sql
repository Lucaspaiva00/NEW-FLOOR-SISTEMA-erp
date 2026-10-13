-- AlterEnum
ALTER TYPE "public"."OrigemLancamentoFinanceiro" ADD VALUE 'OBRA';

-- CreateTable
CREATE TABLE "public"."Obra" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "propostaId" INTEGER,
    "endereco" TEXT NOT NULL,
    "responsavel" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "prazo" TIMESTAMP(3),
    "valorContrato" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',

    CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ColaboradorObra" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "diaria" DECIMAL(14,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ColaboradorObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApontamentoObra" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "obraId" INTEGER NOT NULL,
    "colaboradorId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "fracao" DECIMAL(5,2) NOT NULL,
    "diaria" DECIMAL(14,2) NOT NULL,
    "observacoes" TEXT NOT NULL,
    "lancamentoId" INTEGER,

    CONSTRAINT "ApontamentoObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EtapaObra" (
    "id" SERIAL NOT NULL,
    "obraId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "EtapaObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MedicaoObra" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "obraId" INTEGER NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "vencimento" DATE NOT NULL,
    "observacoes" TEXT NOT NULL,
    "fotos" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "valor" DECIMAL(14,2) NOT NULL,
    "lancamentoId" INTEGER,

    CONSTRAINT "MedicaoObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ItemMedicaoObra" (
    "id" SERIAL NOT NULL,
    "medicaoId" INTEGER NOT NULL,
    "etapaId" INTEGER NOT NULL,
    "anterior" DECIMAL(5,2) NOT NULL,
    "atual" DECIMAL(5,2) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ItemMedicaoObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DespesaObra" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "obraId" INTEGER NOT NULL,
    "colaboradorId" INTEGER,
    "categoria" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "lancamentoId" INTEGER NOT NULL,

    CONSTRAINT "DespesaObra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Obra_empresaId_idx" ON "public"."Obra"("empresaId");

-- CreateIndex
CREATE INDEX "ColaboradorObra_empresaId_idx" ON "public"."ColaboradorObra"("empresaId");

-- CreateIndex
CREATE INDEX "ApontamentoObra_empresaId_data_idx" ON "public"."ApontamentoObra"("empresaId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "ApontamentoObra_empresaId_colaboradorId_data_obraId_key" ON "public"."ApontamentoObra"("empresaId", "colaboradorId", "data", "obraId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicaoObra_lancamentoId_key" ON "public"."MedicaoObra"("lancamentoId");

-- CreateIndex
CREATE INDEX "MedicaoObra_empresaId_obraId_idx" ON "public"."MedicaoObra"("empresaId", "obraId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemMedicaoObra_medicaoId_etapaId_key" ON "public"."ItemMedicaoObra"("medicaoId", "etapaId");

-- CreateIndex
CREATE UNIQUE INDEX "DespesaObra_lancamentoId_key" ON "public"."DespesaObra"("lancamentoId");

-- CreateIndex
CREATE INDEX "DespesaObra_empresaId_obraId_idx" ON "public"."DespesaObra"("empresaId", "obraId");

-- AddForeignKey
ALTER TABLE "public"."ApontamentoObra" ADD CONSTRAINT "ApontamentoObra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "public"."Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApontamentoObra" ADD CONSTRAINT "ApontamentoObra_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "public"."ColaboradorObra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EtapaObra" ADD CONSTRAINT "EtapaObra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "public"."Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MedicaoObra" ADD CONSTRAINT "MedicaoObra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "public"."Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ItemMedicaoObra" ADD CONSTRAINT "ItemMedicaoObra_medicaoId_fkey" FOREIGN KEY ("medicaoId") REFERENCES "public"."MedicaoObra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ItemMedicaoObra" ADD CONSTRAINT "ItemMedicaoObra_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "public"."EtapaObra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DespesaObra" ADD CONSTRAINT "DespesaObra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "public"."Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
