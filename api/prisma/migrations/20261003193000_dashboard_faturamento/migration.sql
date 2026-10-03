ALTER TABLE "Proposta" ADD COLUMN IF NOT EXISTS "dataFaturamento" TIMESTAMP(3);
UPDATE "Proposta" p SET "dataFaturamento" = l."dataCompetencia"
FROM "LancamentoFinanceiro" l WHERE p."dataFaturamento" IS NULL AND p.status = 'FATURADA'
AND l."propostaId" = p.propostaid AND l."empresaId" = p."empresaId" AND l."chaveOrigem" = 'PROPOSTA:' || p.propostaid || ':1';
