-- CreateEnum
CREATE TYPE "TipoProposta" AS ENUM ('SERVICOS', 'SISTEMA');

-- AlterTable
ALTER TABLE "Proposta" ADD COLUMN "tipoProposta" "TipoProposta" NOT NULL DEFAULT 'SERVICOS';

-- AlterTable
ALTER TABLE "TemplateProposta" ADD COLUMN "textoObservacaoServicos" TEXT;
ALTER TABLE "TemplateProposta" ADD COLUMN "textoObservacaoSistema" TEXT;
