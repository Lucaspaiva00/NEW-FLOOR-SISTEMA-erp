-- AlterTable
ALTER TABLE `proposta` ADD COLUMN `templatePropostaTemplateid` INTEGER NULL;

-- CreateTable
CREATE TABLE `TemplateProposta` (
    `templateid` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `logo` VARCHAR(191) NULL,
    `corPrimaria` VARCHAR(191) NULL,
    `corSecundaria` VARCHAR(191) NULL,
    `cabecalho` TEXT NULL,
    `rodape` TEXT NULL,
    `textoApresentacao` TEXT NULL,
    `textoGarantia` TEXT NULL,
    `textoPagamento` TEXT NULL,
    `textoObservacao` TEXT NULL,
    `exibirLogo` BOOLEAN NOT NULL DEFAULT true,
    `exibirEndereco` BOOLEAN NOT NULL DEFAULT true,
    `exibirTelefone` BOOLEAN NOT NULL DEFAULT true,
    `exibirEmail` BOOLEAN NOT NULL DEFAULT true,
    `exibirAssinatura` BOOLEAN NOT NULL DEFAULT true,
    `htmlPersonalizado` LONGTEXT NULL,
    `cssPersonalizado` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`templateid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Proposta` ADD CONSTRAINT `Proposta_templatePropostaTemplateid_fkey` FOREIGN KEY (`templatePropostaTemplateid`) REFERENCES `TemplateProposta`(`templateid`) ON DELETE SET NULL ON UPDATE CASCADE;
