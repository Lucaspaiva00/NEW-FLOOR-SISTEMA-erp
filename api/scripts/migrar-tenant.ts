/**
 * Script de migração para multi-tenant.
 *
 * IMPORTANTE — ordem de execução (não pule etapas):
 *
 * 1) Rode a migration do Prisma com `empresaId` como coluna OPCIONAL
 *    (Int?) em todas as tabelas — não dá pra aplicar NOT NULL numa
 *    tabela que já tem linhas sem valor pra essa coluna.
 * 2) Rode este script (`npx tsx scripts/migrar-tenant.ts`). Ele cria
 *    a empresa "New Floor" e atribui todos os registros existentes
 *    a ela.
 * 3) Só depois disso, gere e aplique uma segunda migration alterando
 *    `empresaId` de Int? para Int (NOT NULL) em cada tabela.
 * 4) Crie a empresa SBA (via POST /empresas, autenticado como
 *    SUPER_ADMIN) e o usuário admin dela.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const empresaExistente = await prisma.empresa.findUnique({
    where: { slug: "new-floor" },
  });

  const empresa =
    empresaExistente ??
    (await prisma.empresa.create({
      data: {
        nome: "New Floor",
        slug: "new-floor",
      },
    }));

  console.log(`Empresa "New Floor" -> id ${empresa.empresaid}`);

  const tabelas: { nome: string; modelo: any }[] = [
    { nome: "cliente", modelo: prisma.cliente },
    { nome: "servico", modelo: prisma.servico },
    { nome: "proposta", modelo: prisma.proposta },
    { nome: "agenda", modelo: prisma.agenda },
    { nome: "templateProposta", modelo: prisma.templateProposta },
    { nome: "vendedor", modelo: prisma.vendedor },
    { nome: "empresaFiscal", modelo: prisma.empresaFiscal },
    { nome: "notaFiscal", modelo: prisma.notaFiscal },
    { nome: "contaFinanceira", modelo: prisma.contaFinanceira },
    { nome: "categoriaFinanceira", modelo: prisma.categoriaFinanceira },
    { nome: "lancamentoFinanceiro", modelo: prisma.lancamentoFinanceiro },
  ];

  for (const tabela of tabelas) {
    const resultado = await tabela.modelo.updateMany({
      where: { empresaId: null },
      data: { empresaId: empresa.empresaid },
    });
    console.log(`${tabela.nome}: ${resultado.count} registro(s) atribuído(s)`);
  }

  const usuariosSemEmpresa = await prisma.usuario.updateMany({
    where: { empresaId: null },
    data: { empresaId: empresa.empresaid, role: "ADMIN" },
  });
  console.log(
    `usuario: ${usuariosSemEmpresa.count} usuário(s) existente(s) vinculado(s) como ADMIN da New Floor`
  );

  console.log("\nMigração concluída. Confira os números acima antes de seguir para o passo 3.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
