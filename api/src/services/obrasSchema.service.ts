import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import prisma from '../prisma';

const migration='20261013010000_gestao_obras';
// Deploy autorizado para a empresa José/Construarty. As outras configurações
// são preservadas; não executa migrations históricas já garantidas no startup.
export async function garantirSchemaObras(db:any=prisma){
 const sql=fs.readFileSync(path.join(process.cwd(),'prisma','migrations',migration,'migration.sql'),'utf8');
 const checksum=createHash('sha256').update(sql).digest('hex');
 await db.$transaction(async(tx:any)=>{
  let aplicada=false;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261013, 130100)::text`;
  const rows=await tx.$queryRaw`SELECT checksum, finished_at FROM "_prisma_migrations" WHERE migration_name=${migration} AND rolled_back_at IS NULL`;
  if(rows.length){if(!rows[0].finished_at||rows[0].checksum!==checksum)throw Error('Migração de obras pendente ou divergente.');}
  else{
   aplicada=true;
   // Esta migração contém exclusivamente DDL estático, sem literais com ponto e vírgula.
   for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await tx.$executeRawUnsafe(statement);
   await tx.$executeRaw`INSERT INTO "_prisma_migrations" (id,checksum,finished_at,migration_name,logs,rolled_back_at,started_at,applied_steps_count) VALUES (${randomUUID()},${checksum},CURRENT_TIMESTAMP,${migration},NULL,NULL,CURRENT_TIMESTAMP,1)`;
  }
  // Não habilita por correspondência parcial, nome de login ou perfil genérico.
  if(aplicada)await tx.$executeRaw`UPDATE "Empresa" SET "configuracaoSistema"=jsonb_set(COALESCE("configuracaoSistema",'{}'::jsonb),'{modulos}',COALESCE("configuracaoSistema"->'modulos','{}'::jsonb)||'{"obras":true}'::jsonb),"updatedAt"=CURRENT_TIMESTAMP WHERE empresaid=5 AND slug='construarty' AND nome='Jose' AND ativo=true AND COALESCE("configuracaoSistema"->'modulos'->>'clientes','true')='true' AND COALESCE("configuracaoSistema"->'modulos'->>'financeiro','true')='true' AND COALESCE("configuracaoSistema"->'modulos'->>'obras','false')<>'true'`;
 },{timeout:60000});
}
