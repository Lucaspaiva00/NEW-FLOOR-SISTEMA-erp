/**
 * Cria (ou promove) o usuário SUPER_ADMIN da Paiva Tech — quem gerencia
 * todas as empresas (tenants) do sistema. Rode uma única vez, depois
 * da migração de tenant.
 *
 * Uso:
 *   SUPER_ADMIN_NOME="Lucas Paiva" \
 *   SUPER_ADMIN_EMAIL="lucas@paivatech.com.br" \
 *   SUPER_ADMIN_SENHA="senha-forte-aqui" \
 *   npx tsx scripts/criar-super-admin.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const nome = process.env.SUPER_ADMIN_NOME;
  const email = process.env.SUPER_ADMIN_EMAIL;
  const senha = process.env.SUPER_ADMIN_SENHA;

  if (!nome || !email || !senha) {
    throw new Error(
      "Defina SUPER_ADMIN_NOME, SUPER_ADMIN_EMAIL e SUPER_ADMIN_SENHA antes de rodar"
    );
  }

  const existente = await prisma.usuario.findUnique({ where: { email } });

  if (existente) {
    const atualizado = await prisma.usuario.update({
      where: { email },
      data: { role: "SUPER_ADMIN", empresaId: null },
    });
    console.log(`Usuário existente promovido a SUPER_ADMIN: ${atualizado.email}`);
    return;
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const usuario = await prisma.usuario.create({
    data: { nome, email, senha: senhaHash, role: "SUPER_ADMIN", empresaId: null },
  });

  console.log(`SUPER_ADMIN criado: ${usuario.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
