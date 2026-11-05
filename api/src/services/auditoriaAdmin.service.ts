import prisma from '../prisma';
export const AUDITORIA_DDL=`CREATE TABLE IF NOT EXISTS "AuditoriaSistema" (
 "id" BIGSERIAL PRIMARY KEY, "empresaId" INTEGER, "usuarioId" INTEGER,
 "usuarioNome" TEXT, "papel" TEXT, "acao" TEXT NOT NULL, "modulo" TEXT NOT NULL,
 "rota" TEXT NOT NULL, "metodo" TEXT NOT NULL, "status" INTEGER NOT NULL,
 "duracaoMs" INTEGER NOT NULL DEFAULT 0, "alvoId" TEXT, "detalhes" JSONB,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
export async function garantirAuditoria(){
 await prisma.$executeRawUnsafe(AUDITORIA_DDL);
 await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AuditoriaSistema_empresa_data" ON "AuditoriaSistema"("empresaId","createdAt" DESC)');
 await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AuditoriaSistema_data" ON "AuditoriaSistema"("createdAt" DESC)');
}
export type EventoAuditoria={empresaId?:number|null;usuarioId?:number|null;usuarioNome?:string|null;papel?:string;acao:string;modulo:string;rota:string;metodo:string;status:number;duracaoMs?:number;alvoId?:string|null;detalhes?:any};
export async function registrarAuditoria(e:EventoAuditoria,db:any=prisma){
 // O evento nunca recebe o corpo, headers, token, senha, certificado ou payload fiscal.
 await db.$executeRawUnsafe(`INSERT INTO "AuditoriaSistema" ("empresaId","usuarioId","usuarioNome","papel","acao","modulo","rota","metodo","status","duracaoMs","alvoId","detalhes") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
 e.empresaId||null,e.usuarioId||null,e.usuarioNome?.slice(0,200)||null,e.papel||null,e.acao.slice(0,100),e.modulo.slice(0,80),e.rota.slice(0,300),e.metodo,e.status,Math.max(0,Math.round(e.duracaoMs||0)),e.alvoId?.slice(0,50)||null,e.detalhes?JSON.stringify(e.detalhes):null);
}
