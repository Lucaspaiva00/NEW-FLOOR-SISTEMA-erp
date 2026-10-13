ALTER TABLE "NotaFiscal" ADD COLUMN IF NOT EXISTS "ambienteEmissao" "AmbienteFiscal";
ALTER TABLE "EmpresaFiscal" ADD COLUMN IF NOT EXISTS "regimeApuracaoSimples" INTEGER;
ALTER TABLE "NotaFiscal" ADD COLUMN IF NOT EXISTS "padraoNfseEmissao" "PadraoNfse";
