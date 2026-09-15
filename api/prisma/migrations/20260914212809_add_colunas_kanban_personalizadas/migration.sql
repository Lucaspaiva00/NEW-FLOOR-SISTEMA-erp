-- DropIndex
DROP INDEX "public"."CategoriaFinanceira_nome_tipo_key";

-- AlterTable
ALTER TABLE "public"."Proposta" ADD COLUMN     "colunaKanbanId" INTEGER;

-- CreateTable
CREATE TABLE "public"."ColunaKanban" (
    "colunakanbanid" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ColunaKanban_pkey" PRIMARY KEY ("colunakanbanid")
);

-- CreateIndex
CREATE INDEX "ColunaKanban_empresaId_idx" ON "public"."ColunaKanban"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "ColunaKanban_empresaId_nome_key" ON "public"."ColunaKanban"("empresaId", "nome");

-- CreateIndex
CREATE INDEX "Proposta_colunaKanbanId_idx" ON "public"."Proposta"("colunaKanbanId");

-- AddForeignKey
ALTER TABLE "public"."Proposta" ADD CONSTRAINT "Proposta_colunaKanbanId_fkey" FOREIGN KEY ("colunaKanbanId") REFERENCES "public"."ColunaKanban"("colunakanbanid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ColunaKanban" ADD CONSTRAINT "ColunaKanban_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE RESTRICT ON UPDATE CASCADE;

