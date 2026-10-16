import { Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { detectarPlanilha, validarXlsx, aplicarEdicoes, evolucaoAtual, gerarExcel, AbaPlanilha } from "../services/planilhasMedicaoJose.service";

const handle = (fn: (req: Request, res: Response) => Promise<void>) =>
  async (req: Request, res: Response) => {
    try { await fn(req, res); } catch (error: any) {
      console.error("Planilhas de medição José:", error?.message || error);
      res.status(error?.code === "P2002" ? 409 : 400).json({ error: error?.message || "Não foi possível processar a planilha." });
    }
  };
export async function somenteJose(req: Request, res: Response, next: NextFunction) {
  if (req.empresaId !== 5 || req.configuracaoSistema?.modulos.obras !== true) {
    res.status(403).json({ error: "Planilhas de medição disponíveis somente para José/Construarty." }); return;
  }
  const empresa = await prisma.empresa.findFirst({ where: { empresaid: 5, slug: "construarty", ativo: true }, select: { empresaid: true } });
  if (!empresa) { res.status(403).json({ error: "Empresa não autorizada." }); return; }
  next();
}
let tabelasProntas: Promise<void> | undefined;
function prepararTabela() {
  if (!tabelasProntas) tabelasProntas = (async () => {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS "PlanilhaMedicaoJose" (' +
      '"id" SERIAL PRIMARY KEY, "empresaId" INTEGER NOT NULL REFERENCES "Empresa"("empresaid"),' +
      '"obraId" INTEGER NOT NULL REFERENCES "Obra"("id"), "nome" TEXT NOT NULL,' +
      '"arquivoNome" TEXT NOT NULL, "hash" TEXT NOT NULL, "conteudo" BYTEA NOT NULL,' +
      '"abas" JSONB NOT NULL, "edicoes" JSONB NOT NULL DEFAULT \'{}\'::jsonb,' +
      '"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,' +
      '"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)'
    );
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "PlanilhaMedicaoJose_obra_hash" ON "PlanilhaMedicaoJose"("empresaId", "obraId", "hash")'
    );
  })().catch(error => { tabelasProntas = undefined; throw error; });
  return tabelasProntas;
}
async function obraAutorizada(obraId: number) {
  if (!Number.isSafeInteger(obraId) || obraId < 1 ||
    !await prisma.obra.findFirst({ where: { id: obraId, empresaId: 5 }, select: { id: true } })) {
    throw Error("Selecione uma obra de José/Construarty antes de importar.");
  }
}
function id(v: unknown) {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 1) throw Error("Identificador inválido.");
  return n;
}
async function obter(identificador: number): Promise<any> {
  await prepararTabela();
  const rows: any[] = await prisma.$queryRawUnsafe(
    'SELECT "id", "empresaId", "obraId", "nome", "arquivoNome", "hash", "conteudo", "abas", "edicoes" ' +
    'FROM "PlanilhaMedicaoJose" WHERE "id" = $1 AND "empresaId" = 5 LIMIT 1', identificador
  );
  if (!rows.length) throw Error("Planilha não encontrada na empresa José.");
  return rows[0];
}
export const previa = handle(async (req, res) => {
  const bytes = validarXlsx(req.body?.arquivo);
  res.json(await detectarPlanilha(bytes, req.body?.mapeamentos));
});
export const importar = handle(async (req, res) => {
  const obraId = id(req.body?.obraId);
  await obraAutorizada(obraId);
  const bytes = validarXlsx(req.body?.arquivo);
  const parsed = await detectarPlanilha(bytes, req.body?.mapeamentos);
  if (req.body?.hash !== parsed.hash) throw Error("Arquivo diferente da prévia. Revise a planilha antes de salvar.");
  const nome = String(req.body?.nome || "").trim().slice(0, 180);
  const arquivoNome = String(req.body?.arquivoNome || "").replace(/[^\p{L}\p{N}._\- ()]/gu, "_").slice(0, 220);
  if (!nome || !arquivoNome.toLowerCase().endsWith(".xlsx")) throw Error("Informe nome e arquivo XLSX.");
  await prepararTabela();
  const registros: any[] = await prisma.$queryRawUnsafe(
    'INSERT INTO "PlanilhaMedicaoJose" ("empresaId", "obraId", "nome", "arquivoNome", "hash", "conteudo", "abas") ' +
    'VALUES (5, $1, $2, $3, $4, $5, $6::jsonb) ' +
    'ON CONFLICT ("empresaId", "obraId", "hash") DO NOTHING RETURNING "id"',
    obraId, nome, arquivoNome, parsed.hash, bytes, JSON.stringify(parsed.abas)
  );
  if (!registros.length) { res.status(409).json({ error: "Esta planilha já foi importada para a obra. Abra o registro existente." }); return; }
  res.status(201).json({ id: registros[0].id, nome, abas: parsed.abas.map(a => ({ nome: a.nome, reconhecida: a.reconhecida, itens: a.itens.length, medicoes: a.medicoes.length })), avisos: parsed.avisos });
});
export const listar = handle(async (req, res) => {
  const obraId = id(req.query.obraId);
  await obraAutorizada(obraId);
  await prepararTabela();
  const rows = await prisma.$queryRawUnsafe(
    'SELECT "id", "obraId", "nome", "arquivoNome", "hash", "createdAt", "updatedAt" ' +
    'FROM "PlanilhaMedicaoJose" WHERE "empresaId" = 5 AND "obraId" = $1 ORDER BY "id" DESC LIMIT 100', obraId
  );
  res.json(rows);
});
export const detalhe = handle(async (req, res) => {
  const row = await obter(id(req.params.id));
  res.json({ id: row.id, obraId: row.obraId, nome: row.nome, arquivoNome: row.arquivoNome, abas: row.abas, edicoes: row.edicoes });
});
export const salvarMedicao = handle(async (req, res) => {
  const identificador = id(req.params.id);
  const abaId = Number(req.body?.aba), numeroMedicao = Number(req.body?.numeroMedicao);
  const entradas = req.body?.itens;
  if (!Number.isSafeInteger(abaId) || !Number.isSafeInteger(numeroMedicao) || !Array.isArray(entradas) || entradas.length > 3000) throw Error("Informe aba, medição e linhas válidas.");
  const progresso: Record<string, number> = {};
  for (const r of entradas) {
    const linha = Number(r?.linha), pct = Number(r?.percentual);
    if (!Number.isSafeInteger(linha) || progresso[String(linha)] !== undefined || !Number.isFinite(pct) || pct < 0 || pct > 100) throw Error("Linha ou percentual de medição inválido.");
    progresso[String(linha)] = Math.round(pct * 10000) / 10000;
  }
  await prepararTabela();
  const resultado = await prisma.$transaction(async (db: any) => {
    const rows: any[] = await db.$queryRawUnsafe(
      'SELECT "id", "abas", "edicoes" FROM "PlanilhaMedicaoJose" ' +
      'WHERE "id" = $1 AND "empresaId" = 5 FOR UPDATE', identificador
    );
    if (!rows.length) throw Error("Planilha não encontrada.");
    const abas = rows[0].abas as AbaPlanilha[];
    const aba = abas.find(a => a.indice === abaId);
    if (!aba) throw Error("Aba não reconhecida.");
    aplicarEdicoes(aba, progresso, numeroMedicao);
    const edicoes: Record<string, number> = { ...(rows[0].edicoes || {}) };
    for (const [linha, pct] of Object.entries(progresso)) edicoes[abaId + ":" + linha + ":" + numeroMedicao] = pct;
    for (const item of aba.itens) {
      const soma = aba.medicoes.reduce((sum, m) => sum + evolucaoAtual(item, edicoes, aba, m.numero), 0);
      if (soma > 100.00001) throw Error("O serviço \"" + item.descricao.slice(0, 70) + "\" ultrapassa 100% acumulados.");
    }
    await db.$executeRawUnsafe(
      'UPDATE "PlanilhaMedicaoJose" SET "edicoes" = $1::jsonb, "updatedAt" = CURRENT_TIMESTAMP ' +
      'WHERE "id" = $2 AND "empresaId" = 5', JSON.stringify(edicoes), identificador
    );
    return { atualizado: Object.keys(progresso).length, edicoes };
  }, { timeout: 30000 });
  res.json(resultado);
});
export const excel = handle(async (req, res) => {
  const row = await obter(id(req.params.id));
  const bytes = await gerarExcel(Buffer.from(row.conteudo), row.abas as AbaPlanilha[], row.edicoes as Record<string, number>);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="medicao-engenharia-' + row.id + '.xlsx"');
  res.setHeader("Cache-Control", "private, no-store");
  res.send(bytes);
});
