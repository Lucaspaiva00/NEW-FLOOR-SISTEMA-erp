import prisma from "../prisma";
export async function garantirSchemaConfiguracao() {
 await prisma.$executeRawUnsafe(`ALTER TABLE "Proposta" ADD COLUMN IF NOT EXISTS "valorLiquidoFinanceiro" DECIMAL(14,2);`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "NotaFiscal" ADD COLUMN IF NOT EXISTS "valorRetencoes" DECIMAL(14,2) NOT NULL DEFAULT 0;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "NotaFiscal" ADD COLUMN IF NOT EXISTS "planoRecebimento" JSONB;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "NotaFiscal" ADD COLUMN IF NOT EXISTS "padraoNfseEmissao" "PadraoNfse";`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "EmpresaFiscal" ADD COLUMN IF NOT EXISTS "regimeApuracaoSimples" INTEGER;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "NotaFiscal" ADD COLUMN IF NOT EXISTS "ambienteEmissao" "AmbienteFiscal";`);
 await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ArquivoFiscal" (
 "arquivofiscalid" SERIAL PRIMARY KEY, "empresaId" INTEGER NOT NULL REFERENCES "Empresa"("empresaid"),
 "titulo" TEXT NOT NULL, "numero" TEXT, "temXml" BOOLEAN NOT NULL DEFAULT false,
 "temPdf" BOOLEAN NOT NULL DEFAULT false, "arquivos" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);
 await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ArquivoFiscal_empresaId_createdAt_idx" ON "ArquivoFiscal"("empresaId", "createdAt");`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "formaPagamento" TEXT;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "condicoesPagamento" TEXT;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "prazoPagamentoDias" INTEGER;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "EmpresaFiscal" ADD COLUMN IF NOT EXISTS "cnaesSecundarios" TEXT;`);
 await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Fornecedor" (
 "fornecedorid" SERIAL PRIMARY KEY, "empresaId" INTEGER NOT NULL REFERENCES "Empresa"("empresaid"),
 "nome" TEXT NOT NULL, "cnpj" TEXT, "email" TEXT, "telefone" TEXT, "endereco" TEXT,
 "formaPagamento" TEXT, "condicoesPagamento" TEXT, "prazoPagamentoDias" INTEGER,
 "ativo" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);
 await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Fornecedor_empresaId_cnpj_key" ON "Fornecedor"("empresaId", "cnpj");`);
 await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Fornecedor_empresaId_idx" ON "Fornecedor"("empresaId");`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "Proposta" ADD COLUMN IF NOT EXISTS "planoRecebimento" JSONB;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "Proposta" ADD COLUMN IF NOT EXISTS "dataFaturamento" TIMESTAMP(3);`);
 await prisma.$executeRawUnsafe(`DO $$ BEGIN IF to_regclass('"LancamentoFinanceiro"') IS NOT NULL THEN UPDATE "Proposta" p SET "dataFaturamento" = l."dataCompetencia" FROM "LancamentoFinanceiro" l WHERE p."dataFaturamento" IS NULL AND p.status = 'FATURADA' AND l."propostaId" = p.propostaid AND l."empresaId" = p."empresaId" AND l."chaveOrigem" = 'PROPOSTA:' || p.propostaid || ':1'; END IF; END; $$;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "configuracaoSistema" JSONB;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "reformaTributaria" TEXT;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "Servico" ADD COLUMN IF NOT EXISTS "dadosMaterial" JSONB;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "Proposta" ADD COLUMN IF NOT EXISTS "contatoDestinatario" TEXT;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "Proposta" ADD COLUMN IF NOT EXISTS "emailDestinatario" TEXT;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "Proposta" ADD COLUMN IF NOT EXISTS "composicaoCustos" JSONB;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "Proposta" ADD COLUMN IF NOT EXISTS "prazoEntrega" TEXT;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "EmpresaFiscal" ADD COLUMN IF NOT EXISTS "certificadoCriptografado" TEXT;`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "EmpresaFiscal" ADD COLUMN IF NOT EXISTS "certificadoNome" TEXT;`);
 await prisma.$executeRawUnsafe(`UPDATE "Empresa" SET "configuracaoSistema" = '{"perfil":"SBA"}'::jsonb WHERE "configuracaoSistema" IS NULL AND (lower(trim(slug)) = 'sba' OR lower(trim(nome)) = 'sba');`);
 // Somente a empresa identificada por slug 'sba': restaura perfil exclusivo,
 // preservando todos os demais campos de configuracaoSistema do Luiz.
 await prisma.$executeRawUnsafe(`UPDATE "Empresa" SET "configuracaoSistema" = jsonb_set("configuracaoSistema", '{perfil}', '"SBA"'::jsonb, true) WHERE lower(trim(slug)) = 'sba' AND "configuracaoSistema" IS NOT NULL AND "configuracaoSistema"->>'perfil' IS DISTINCT FROM 'SBA';`);
 await prisma.$executeRawUnsafe(`ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "sequenciaCompras" INTEGER NOT NULL DEFAULT 0;`);
 await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Compra" (
 "compraid" SERIAL PRIMARY KEY,"empresaId" INTEGER NOT NULL REFERENCES "Empresa"("empresaid"),
 "fornecedorId" INTEGER NOT NULL REFERENCES "Fornecedor"("fornecedorid"),"numero" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'RASCUNHO',"dataCompra" TIMESTAMP(3) NOT NULL,"documento" TEXT,
 "itens" JSONB NOT NULL,"subtotal" DECIMAL(14,2) NOT NULL,"frete" DECIMAL(14,2) NOT NULL DEFAULT 0,
 "desconto" DECIMAL(14,2) NOT NULL DEFAULT 0,"total" DECIMAL(14,2) NOT NULL,"formaPagamento" TEXT,
 "condicoesPagamento" TEXT,"planoPagamento" JSONB,"observacoes" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);
 await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Compra_empresaId_numero_key" ON "Compra"("empresaId","numero");`);
 await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Compra_empresaId_dataCompra_idx" ON "Compra"("empresaId","dataCompra");`);
 await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Compra_fornecedorId_idx" ON "Compra"("fornecedorId");`);
}
