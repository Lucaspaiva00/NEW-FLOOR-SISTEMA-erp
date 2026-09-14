/*
  Warnings:

  - Made the column `empresaId` on table `Agenda` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `CategoriaFinanceira` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `Cliente` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `ContaFinanceira` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `EmpresaFiscal` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `LancamentoFinanceiro` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `NotaFiscal` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `Proposta` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `Servico` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `TemplateProposta` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `Vendedor` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."Agenda" DROP CONSTRAINT "Agenda_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CategoriaFinanceira" DROP CONSTRAINT "CategoriaFinanceira_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Cliente" DROP CONSTRAINT "Cliente_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ContaFinanceira" DROP CONSTRAINT "ContaFinanceira_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EmpresaFiscal" DROP CONSTRAINT "EmpresaFiscal_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LancamentoFinanceiro" DROP CONSTRAINT "LancamentoFinanceiro_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."NotaFiscal" DROP CONSTRAINT "NotaFiscal_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Proposta" DROP CONSTRAINT "Proposta_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Servico" DROP CONSTRAINT "Servico_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TemplateProposta" DROP CONSTRAINT "TemplateProposta_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Vendedor" DROP CONSTRAINT "Vendedor_empresaId_fkey";

-- AlterTable
ALTER TABLE "public"."Agenda" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."CategoriaFinanceira" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Cliente" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."ContaFinanceira" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."EmpresaFiscal" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."LancamentoFinanceiro" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."NotaFiscal" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Proposta" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Servico" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."TemplateProposta" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Vendedor" ALTER COLUMN "empresaId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Cliente" ADD CONSTRAINT "Cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Servico" ADD CONSTRAINT "Servico_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Proposta" ADD CONSTRAINT "Proposta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Agenda" ADD CONSTRAINT "Agenda_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TemplateProposta" ADD CONSTRAINT "TemplateProposta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vendedor" ADD CONSTRAINT "Vendedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpresaFiscal" ADD CONSTRAINT "EmpresaFiscal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotaFiscal" ADD CONSTRAINT "NotaFiscal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContaFinanceira" ADD CONSTRAINT "ContaFinanceira_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CategoriaFinanceira" ADD CONSTRAINT "CategoriaFinanceira_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("empresaid") ON DELETE RESTRICT ON UPDATE CASCADE;
