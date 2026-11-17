-- Execute somente apos rollback-simplesolution-history.sql. Exclusoes limitadas aos IDs criados e registrados pela migracao.
BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(208775345);
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM "Empresa" e JOIN "EmpresaFiscal" f ON f."empresaId"=e.empresaid WHERE e.empresaid=2 AND e.slug='sba') THEN RAISE EXCEPTION 'Empresa invalida'; END IF; END $$;
DELETE FROM "Fornecedor" d USING sba_migration.cadastro_map m WHERE m."empresaId"=2 AND m.tabela='fornecedor_cad' AND m.estado='IMPORTADO' AND d."empresaId"=2 AND d.fornecedorid=m.destino_id;
DELETE FROM "Cliente" d USING sba_migration.cadastro_map m WHERE m."empresaId"=2 AND m.tabela='cliente_cad' AND m.estado='IMPORTADO' AND d."empresaId"=2 AND d.clienteid=m.destino_id;
DELETE FROM sba_migration.cadastro_map WHERE "empresaId"=2;
COMMIT;
