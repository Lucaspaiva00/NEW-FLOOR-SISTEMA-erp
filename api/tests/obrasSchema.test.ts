import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {garantirSchemaObras} from '../src/services/obrasSchema.service';
const checksum=createHash('sha256').update(fs.readFileSync('prisma/migrations/20261013010000_gestao_obras/migration.sql','utf8')).digest('hex');
test('bootstrap executa DDL e registra migração; ativação exige ID e slug do José',async()=>{
 const ddl:string[]=[],queries:string[]=[];
 await garantirSchemaObras({$transaction:async(fn:any)=>fn({$queryRaw:async(s:any)=>String(s).includes('_prisma_migrations')?[]:[], $executeRawUnsafe:async(s:string)=>ddl.push(s),$executeRaw:async(s:any)=>queries.push(String(s))})});
 assert.equal(ddl.filter(s=>s.includes('CREATE TABLE')).length,7);assert.ok(queries.some(s=>s.includes('INSERT INTO "_prisma_migrations"')));
 const activation=queries.find(s=>s.includes('UPDATE "Empresa"'))!;assert.match(activation,/empresaid=5 AND slug='construarty' AND nome='Jose'/);assert.match(activation,/jsonb_set/);
});
test('bootstrap repetido não reaplica migração e rejeita checksum divergente',async()=>{
 let writes=0;
 const mock=(sum:string)=>({$transaction:async(fn:any)=>fn({$queryRaw:async(s:any)=>String(s).includes('_prisma_migrations')?[{checksum:sum,finished_at:new Date()}]:[],$executeRawUnsafe:async()=>{writes++;},$executeRaw:async()=>0})});
 await garantirSchemaObras(mock(checksum));assert.equal(writes,0);await assert.rejects(()=>garantirSchemaObras(mock('divergente')),/divergente/);
});
