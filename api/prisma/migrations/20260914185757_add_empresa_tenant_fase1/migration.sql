/*
  Warnings:

  - A unique constraint covering the columns `[empresaId,nome,tipo]` on the table `CategoriaFinanceira` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[empresaId,cnpj]` on the table `Cliente` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[empresaId,cpf]` on the table `Cliente` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[empresaId,cnpj]` on the table `EmpresaFiscal` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[empresaId,referencia]` on the table `NotaFiscal` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[empresaId,numero]` on the table `Proposta` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[empresaId,codigo]` on the table `Servico` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."RoleUsuario" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VENDEDOR', 'FINANCEIRO', 'PADRAO');

-- DropIndex
DROP INDEX "public"."CategoriaFinanceira_nome_tipo_key";

-- DropIndex
DROP INDEX "public"."Cliente_cnpj_key";

-- DropIndex
DROP INDEX "public"."Cliente_cpf_key";

-- DropIndex
DROP INDEX "public"."EmpresaFiscal_cnpj_key";

-- DropIndex
DROP INDEX "public"."NotaFiscal_referencia_key";

-- DropIndex
DROP INDEX "public"."Proposta_numero_key";

-- DropIndex
DROP INDEX "public"."Servico_codigo_key";

-- AlterTable
ALTER TABLE "public"."Agenda" ADD COLUMN     "empresaId" INTEGER;

-- AlterTable
ALTER TABLE "public"."CategoriaFinanceira" ADD COLUMN     "empresaId" INTEGER;

-- AlterTable
ALTER TABLE "public"."Cliente" ADD COLUMN     "empresaId" INTEGER;

-- AlterTable
ALTER TABLE "public"."ContaFinanceira" ADD COLUMN     "empresaId" INTEGER;

-- AlterTable
ALTER TABLE "public"."EmpresaFiscal" ADD COLUMN     "empresaId" INTEGER;

-- AlterTable
ALTER TABLE "public"."LancamentoFinanceiro" ADD COLUMN     "empresaId" INTEGER;

-- AlterTable
ALTER TABLE "public"."NotaFiscal" ADD COLUMN     "empresaId" INTEGER;

-- AlterTable
ALTER TABLE "public"."Proposta" ADD COLUMN     "empresaId" INTEGER;

-- AlterTable
ALTER TABLE "public"."Servico" ADD COLUMN     "empresaId" INTEGER;

-- AlterTable
ALTER TABLE "public"."TemplateProposta" ADD COLUMN     "empresaId" INTEGER;

-- AlterTable
ALTER TABLE "public"."Usuario" ADD COLUMN     "empresaId" INTEGER,
ADD COLUMN     "role" "public"."RoleUsuario" NOT NULL DEFAULT 'PADRAO';

-- AlterTable
ALTER TABLE "public"."Vendedor" ADD COLUMN     "empresaId" INTEGER;

-- CreateTable
CREATE TABLE "public"."Empresa" (
    "empresaid" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "corPrimaria" TEXT,
    "corSecundaria" TEXT,
    "emailContato" TEXT,
    "telefoneContato" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("empresaid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_slug_key" ON "public"."Empresa"("slug");

-- CreateIndex
CREATE INDEX "Agenda_empresaId_idx" ON "public"."Agenda"("empresaId");

-- CreateIndex
CREATE INDEX "CategoriaFinanceira_empresaId_idx" ON "public"."CategoriaFinanceira"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaFinanceira_empresaId_nome_tipo_key" ON "public"."CategoriaFinanceira"("empresaId", "nome", "tipo");

-- CreateIndex
CREATE INDEX "Cliente_empresaId_idx" ON "public"."Cliente"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_empresaId_cnpj_key" ON "public"."Cliente"("empresaId", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_empresaId_cpf_key" ON "public"."Cliente"("empresaId", "cpf");

-- CreateIndex
CREATE INDEX "ContaFinanceira_empresaId_idx" ON "public"."ContaFinanceira"("empresaId");

-- CreateIndex
CREATE INDEX "EmpresaFiscal_empresaId_idx" ON "public"."EmpresaFiscal"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresaFiscal_empresaId_cnpj_key" ON "public"."EmpresaFiscal"("empresaId", "cnpj");

-- CreateIndex
CREATE INDEX "LancamentoFinanceiro_empresaId_idx" ON "public"."LancamentoFinanceiro"("empresaId");

-- CreateIndex
CREATE INDEX "NotaFiscal_empresaId_idx" ON "public"."NotaFiscal"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_empresaId_referencia_key" ON "public"."NotaFiscal"("empresaId", "referencia");

-- CreateIndex
CREATE INDEX "Proposta_empresaId_idx" ON "public"."Proposta"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Proposta_empresaId_numero_key" ON "public"."Proposta"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "Servico_empresaId_idx" ON "public"."Servico"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Servico_empresaId_codigo_key" ON "public"."Servico"("empresaId", "codigo");

-- CreateIndex
CREATE INDEX "TemplateProposta_empresaId_idx" ON "public"."TemplateProposta"("empresaId");

-- CreateIndex
CREATE INDEX "Usuario_empresaId_idx" ON "public"."Usuario"("empresaId");

-- CreateIndex
CREATE INDEX "Vendedor_empresaId_idx" ON "public"."Vendedor"("empresaId");

-- AddForeignKey
ALTER TABLE "public"."Cliente" ADD CONSTRAINT "Cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Servico" ADD CONSTRAINT "Servico_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Proposta" ADD CONSTRAINT "Proposta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Agenda" ADD CONSTRAINT "Agenda_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TemplateProposta" ADD CONSTRAINT "TemplateProposta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vendedor" ADD CONSTRAINT "Vendedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpresaFiscal" ADD CONSTRAINT "EmpresaFiscal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotaFiscal" ADD CONSTRAINT "NotaFiscal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContaFinanceira" ADD CONSTRAINT "ContaFinanceira_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CategoriaFinanceira" ADD CONSTRAINT "CategoriaFinanceira_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE SET NULL ON UPDATE CASCADE;
