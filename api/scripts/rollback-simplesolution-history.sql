BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(208775345);
DO $$ BEGIN IF (SELECT slug FROM "Empresa" WHERE empresaid=2) <> 'sba' THEN RAISE EXCEPTION 'Empresa invalida'; END IF; END $$;
DELETE FROM "ArquivoFiscal" d USING sba_migration.origem m WHERE m."empresaId"=2 AND m.destino_tabela='ArquivoFiscal' AND m.estado='ARQUIVADO' AND d."empresaId"=2 AND d.arquivofiscalid=m.destino_id;
DELETE FROM "Proposta" d USING sba_migration.origem m WHERE m."empresaId"=2 AND m.tabela='orcamento_cad' AND m.estado='IMPORTADO' AND d."empresaId"=2 AND d.propostaid=m.destino_id;
DELETE FROM "Servico" d USING sba_migration.origem m WHERE m."empresaId"=2 AND m.tabela='produto_cad' AND m.estado='IMPORTADO' AND d."empresaId"=2 AND d.servicoid=m.destino_id;
UPDATE sba_migration.origem SET estado='REVERTIDO',destino_id=NULL,destino_tabela=NULL WHERE "empresaId"=2;
COMMIT;
