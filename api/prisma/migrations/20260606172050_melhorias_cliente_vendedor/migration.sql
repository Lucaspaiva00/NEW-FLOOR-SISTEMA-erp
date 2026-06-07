/*
  Warnings:

  - You are about to drop the column `email` on the `Cliente` table. All the data in the column will be lost.
  - You are about to drop the column `nome` on the `Cliente` table. All the data in the column will be lost.
  - You are about to drop the column `telefone` on the `Cliente` table. All the data in the column will be lost.
  - You are about to drop the column `telefoneSecundario` on the `Cliente` table. All the data in the column will be lost.
  - You are about to drop the column `whatsapp` on the `Cliente` table. All the data in the column will be lost.
  - You are about to drop the column `etapaAtual` on the `Proposta` table. All the data in the column will be lost.
  - You are about to drop the column `pdfUrl` on the `Proposta` table. All the data in the column will be lost.
  - You are about to drop the column `urlPublica` on the `Proposta` table. All the data in the column will be lost.
  - You are about to drop the column `vendedor` on the `Proposta` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Cliente" DROP COLUMN "email",
DROP COLUMN "nome",
DROP COLUMN "telefone",
DROP COLUMN "telefoneSecundario",
DROP COLUMN "whatsapp",
ADD COLUMN     "email1" TEXT,
ADD COLUMN     "email2" TEXT,
ADD COLUMN     "email3" TEXT,
ADD COLUMN     "email4" TEXT,
ADD COLUMN     "telefone1" TEXT,
ADD COLUMN     "telefone2" TEXT,
ADD COLUMN     "telefone3" TEXT,
ADD COLUMN     "telefone4" TEXT;

-- AlterTable
ALTER TABLE "public"."Proposta" DROP COLUMN "etapaAtual",
DROP COLUMN "pdfUrl",
DROP COLUMN "urlPublica",
DROP COLUMN "vendedor",
ADD COLUMN     "vendedorId" INTEGER;

-- CreateTable
CREATE TABLE "public"."Vendedor" (
    "vendedorid" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendedor_pkey" PRIMARY KEY ("vendedorid")
);

-- AddForeignKey
ALTER TABLE "public"."Proposta" ADD CONSTRAINT "Proposta_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "public"."Vendedor"("vendedorid") ON DELETE SET NULL ON UPDATE CASCADE;
