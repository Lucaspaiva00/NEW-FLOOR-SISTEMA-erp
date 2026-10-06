import prisma from "../prisma";
export async function garantirSchemaConfiguracao() {
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
}
