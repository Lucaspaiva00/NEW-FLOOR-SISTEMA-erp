-- CreateTable
CREATE TABLE `Cliente` (
    `clienteid` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `empresa` VARCHAR(191) NULL,
    `cnpj` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `endereco` VARCHAR(191) NULL,
    `observacoes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`clienteid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Servico` (
    `servicoid` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `unidade` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`servicoid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Proposta` (
    `propostaid` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `status` ENUM('PENDENTE', 'APROVADA', 'EXECUTANDO', 'FATURADA', 'RECUSADA') NOT NULL DEFAULT 'PENDENTE',
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `desconto` DECIMAL(10, 2) NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `formaPagamento` VARCHAR(191) NULL,
    `observacoes` VARCHAR(191) NULL,
    `validade` DATETIME(3) NULL,
    `clienteId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Proposta_numero_key`(`numero`),
    PRIMARY KEY (`propostaid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemProposta` (
    `itempropostaid` INTEGER NOT NULL AUTO_INCREMENT,
    `descricao` VARCHAR(191) NOT NULL,
    `quantidade` DECIMAL(10, 2) NOT NULL,
    `valorUnitario` DECIMAL(10, 2) NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `propostaId` INTEGER NOT NULL,
    `servicoId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`itempropostaid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Proposta` ADD CONSTRAINT `Proposta_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Cliente`(`clienteid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemProposta` ADD CONSTRAINT `ItemProposta_propostaId_fkey` FOREIGN KEY (`propostaId`) REFERENCES `Proposta`(`propostaid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemProposta` ADD CONSTRAINT `ItemProposta_servicoId_fkey` FOREIGN KEY (`servicoId`) REFERENCES `Servico`(`servicoid`) ON DELETE SET NULL ON UPDATE CASCADE;
