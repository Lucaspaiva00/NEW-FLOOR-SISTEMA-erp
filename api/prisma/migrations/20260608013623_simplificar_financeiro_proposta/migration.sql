/*
  Warnings:

  - You are about to drop the column `acrescimo` on the `ItemProposta` table. All the data in the column will be lost.
  - You are about to drop the column `desconto` on the `ItemProposta` table. All the data in the column will be lost.
  - You are about to drop the column `acrescimo` on the `Proposta` table. All the data in the column will be lost.
  - You are about to drop the column `desconto` on the `Proposta` table. All the data in the column will be lost.
  - You are about to drop the column `impostos` on the `Proposta` table. All the data in the column will be lost.
  - You are about to drop the column `percentualLucro` on the `Proposta` table. All the data in the column will be lost.
  - You are about to drop the column `total` on the `Proposta` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."ItemProposta" DROP COLUMN "acrescimo",
DROP COLUMN "desconto";

-- AlterTable
ALTER TABLE "public"."Proposta" DROP COLUMN "acrescimo",
DROP COLUMN "desconto",
DROP COLUMN "impostos",
DROP COLUMN "percentualLucro",
DROP COLUMN "total";
