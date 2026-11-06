ALTER TABLE "DocumentoRecebidoSba" ADD COLUMN IF NOT EXISTS "xmlCompactado" TEXT;
ALTER TABLE "SincronizacaoRecebidasSba" ADD COLUMN IF NOT EXISTS "versaoAcervo" INTEGER NOT NULL DEFAULT 0;
UPDATE "SincronizacaoRecebidasSba" SET nsu=0,"proximaConsulta"=NULL,"versaoAcervo"=1 WHERE "versaoAcervo"=0;