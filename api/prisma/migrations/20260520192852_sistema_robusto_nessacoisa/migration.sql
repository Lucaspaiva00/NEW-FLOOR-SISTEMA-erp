/*
  Warnings:

  - You are about to drop the column `empresa` on the `cliente` table. All the data in the column will be lost.
  - You are about to drop the column `validade` on the `proposta` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cnpj]` on the table `Cliente` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cpf]` on the table `Cliente` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[codigo]` on the table `Servico` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `cliente` DROP COLUMN `empresa`,
    ADD COLUMN `bairro` VARCHAR(191) NULL,
    ADD COLUMN `cep` VARCHAR(191) NULL,
    ADD COLUMN `cidade` VARCHAR(191) NULL,
    ADD COLUMN `complemento` VARCHAR(191) NULL,
    ADD COLUMN `cpf` VARCHAR(191) NULL,
    ADD COLUMN `dataNascimento` DATETIME(3) NULL,
    ADD COLUMN `descontoPadrao` DECIMAL(10, 2) NULL,
    ADD COLUMN `estado` VARCHAR(191) NULL,
    ADD COLUMN `inscricaoEstadual` VARCHAR(191) NULL,
    ADD COLUMN `latitude` VARCHAR(191) NULL,
    ADD COLUMN `limiteCredito` DECIMAL(10, 2) NULL,
    ADD COLUMN `longitude` VARCHAR(191) NULL,
    ADD COLUMN `nomeFantasia` VARCHAR(191) NULL,
    ADD COLUMN `numero` VARCHAR(191) NULL,
    ADD COLUMN `origemLead` VARCHAR(191) NULL,
    ADD COLUMN `pais` VARCHAR(191) NULL DEFAULT 'Brasil',
    ADD COLUMN `razaoSocial` VARCHAR(191) NULL,
    ADD COLUMN `responsavel` VARCHAR(191) NULL,
    ADD COLUMN `site` VARCHAR(191) NULL,
    ADD COLUMN `statusCliente` VARCHAR(191) NULL,
    ADD COLUMN `tags` VARCHAR(191) NULL,
    ADD COLUMN `telefoneSecundario` VARCHAR(191) NULL,
    ADD COLUMN `tipo` ENUM('PESSOA_FISICA', 'PESSOA_JURIDICA') NOT NULL DEFAULT 'PESSOA_JURIDICA',
    ADD COLUMN `whatsapp` VARCHAR(191) NULL,
    MODIFY `observacoes` TEXT NULL;

-- AlterTable
ALTER TABLE `itemproposta` ADD COLUMN `acrescimo` DECIMAL(10, 2) NULL,
    ADD COLUMN `codigo` VARCHAR(191) NULL,
    ADD COLUMN `desconto` DECIMAL(10, 2) NULL,
    ADD COLUMN `detalhes` TEXT NULL,
    ADD COLUMN `observacoes` TEXT NULL,
    ADD COLUMN `ordem` INTEGER NULL,
    ADD COLUMN `unidade` VARCHAR(191) NULL,
    MODIFY `descricao` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `proposta` DROP COLUMN `validade`,
    ADD COLUMN `acrescimo` DECIMAL(10, 2) NULL,
    ADD COLUMN `aprovadoCliente` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `assinaturaCliente` VARCHAR(191) NULL,
    ADD COLUMN `condicoesPagamento` TEXT NULL,
    ADD COLUMN `dataAprovacao` DATETIME(3) NULL,
    ADD COLUMN `dataRecusa` DATETIME(3) NULL,
    ADD COLUMN `dataValidade` DATETIME(3) NULL,
    ADD COLUMN `enviadoEmail` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `enviadoWhatsapp` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `escopo` TEXT NULL,
    ADD COLUMN `etapaAtual` VARCHAR(191) NULL,
    ADD COLUMN `frete` DECIMAL(10, 2) NULL,
    ADD COLUMN `impostos` DECIMAL(10, 2) NULL,
    ADD COLUMN `motivoRecusa` TEXT NULL,
    ADD COLUMN `observacoesInternas` TEXT NULL,
    ADD COLUMN `origem` VARCHAR(191) NULL,
    ADD COLUMN `pdfUrl` VARCHAR(191) NULL,
    ADD COLUMN `percentualLucro` DECIMAL(10, 2) NULL,
    ADD COLUMN `prioridade` VARCHAR(191) NULL,
    ADD COLUMN `responsavel` VARCHAR(191) NULL,
    ADD COLUMN `subtitulo` VARCHAR(191) NULL,
    ADD COLUMN `urlPublica` VARCHAR(191) NULL,
    ADD COLUMN `validadeDias` INTEGER NULL,
    ADD COLUMN `vendedor` VARCHAR(191) NULL,
    ADD COLUMN `visualizada` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `descricao` TEXT NULL,
    MODIFY `status` ENUM('RASCUNHO', 'PENDENTE', 'APROVADA', 'EXECUTANDO', 'FATURADA', 'RECUSADA', 'CANCELADA') NOT NULL DEFAULT 'RASCUNHO',
    MODIFY `observacoes` TEXT NULL;

-- AlterTable
ALTER TABLE `servico` ADD COLUMN `ativo` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `categoria` VARCHAR(191) NULL,
    ADD COLUMN `codigo` VARCHAR(191) NULL,
    ADD COLUMN `custo` DECIMAL(10, 2) NULL,
    ADD COLUMN `descricaoInterna` TEXT NULL,
    ADD COLUMN `destaque` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `garantia` VARCHAR(191) NULL,
    ADD COLUMN `imagem` VARCHAR(191) NULL,
    ADD COLUMN `margemLucro` DECIMAL(10, 2) NULL,
    ADD COLUMN `observacoes` TEXT NULL,
    ADD COLUMN `tempoExecucao` VARCHAR(191) NULL,
    MODIFY `descricao` TEXT NULL;

-- AlterTable
ALTER TABLE `usuario` ADD COLUMN `ativo` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `cargo` VARCHAR(191) NULL,
    ADD COLUMN `foto` VARCHAR(191) NULL,
    ADD COLUMN `telefone` VARCHAR(191) NULL,
    ADD COLUMN `ultimoLogin` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `Agenda` (
    `agendaid` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `tipo` ENUM('VISITA', 'OBRA', 'REUNIAO', 'EVENTO', 'ENTREGA') NOT NULL,
    `prioridade` ENUM('BAIXA', 'MEDIA', 'ALTA') NOT NULL DEFAULT 'MEDIA',
    `local` VARCHAR(191) NULL,
    `endereco` VARCHAR(191) NULL,
    `cidade` VARCHAR(191) NULL,
    `estado` VARCHAR(191) NULL,
    `dataInicio` DATETIME(3) NOT NULL,
    `dataFim` DATETIME(3) NULL,
    `concluido` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NULL,
    `cor` VARCHAR(191) NULL,
    `observacoes` TEXT NULL,
    `clienteId` INTEGER NULL,
    `propostaId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`agendaid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Cliente_cnpj_key` ON `Cliente`(`cnpj`);

-- CreateIndex
CREATE UNIQUE INDEX `Cliente_cpf_key` ON `Cliente`(`cpf`);

-- CreateIndex
CREATE UNIQUE INDEX `Servico_codigo_key` ON `Servico`(`codigo`);

-- AddForeignKey
ALTER TABLE `Agenda` ADD CONSTRAINT `Agenda_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Cliente`(`clienteid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Agenda` ADD CONSTRAINT `Agenda_propostaId_fkey` FOREIGN KEY (`propostaId`) REFERENCES `Proposta`(`propostaid`) ON DELETE SET NULL ON UPDATE CASCADE;
