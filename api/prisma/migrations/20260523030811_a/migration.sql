-- CreateEnum
CREATE TYPE "StatusProposta" AS ENUM ('RASCUNHO', 'PENDENTE', 'APROVADA', 'EXECUTANDO', 'FATURADA', 'RECUSADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoAgenda" AS ENUM ('VISITA', 'OBRA', 'REUNIAO', 'EVENTO', 'ENTREGA');

-- CreateEnum
CREATE TYPE "PrioridadeAgenda" AS ENUM ('BAIXA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('PESSOA_FISICA', 'PESSOA_JURIDICA');

-- CreateTable
CREATE TABLE "Cliente" (
    "clienteid" SERIAL NOT NULL,
    "tipo" "TipoCliente" NOT NULL DEFAULT 'PESSOA_JURIDICA',
    "nome" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "razaoSocial" TEXT,
    "cnpj" TEXT,
    "cpf" TEXT,
    "inscricaoEstadual" TEXT,
    "responsavel" TEXT,
    "telefone" TEXT,
    "telefoneSecundario" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "site" TEXT,
    "cep" TEXT,
    "endereco" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "pais" TEXT DEFAULT 'Brasil',
    "latitude" TEXT,
    "longitude" TEXT,
    "observacoes" TEXT,
    "origemLead" TEXT,
    "tags" TEXT,
    "statusCliente" TEXT,
    "limiteCredito" DECIMAL(10,2),
    "descontoPadrao" DECIMAL(10,2),
    "dataNascimento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("clienteid")
);

-- CreateTable
CREATE TABLE "Servico" (
    "servicoid" SERIAL NOT NULL,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "descricao" TEXT,
    "descricaoInterna" TEXT,
    "valor" DECIMAL(10,2) NOT NULL,
    "custo" DECIMAL(10,2),
    "margemLucro" DECIMAL(10,2),
    "unidade" TEXT,
    "tempoExecucao" TEXT,
    "garantia" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "imagem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Servico_pkey" PRIMARY KEY ("servicoid")
);

-- CreateTable
CREATE TABLE "Proposta" (
    "propostaid" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "subtitulo" TEXT,
    "descricao" TEXT,
    "escopo" TEXT,
    "observacoes" TEXT,
    "observacoesInternas" TEXT,
    "status" "StatusProposta" NOT NULL DEFAULT 'RASCUNHO',
    "prioridade" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "desconto" DECIMAL(10,2),
    "acrescimo" DECIMAL(10,2),
    "frete" DECIMAL(10,2),
    "impostos" DECIMAL(10,2),
    "total" DECIMAL(10,2) NOT NULL,
    "percentualLucro" DECIMAL(10,2),
    "formaPagamento" TEXT,
    "condicoesPagamento" TEXT,
    "validadeDias" INTEGER,
    "dataValidade" TIMESTAMP(3),
    "dataAprovacao" TIMESTAMP(3),
    "dataRecusa" TIMESTAMP(3),
    "motivoRecusa" TEXT,
    "responsavel" TEXT,
    "vendedor" TEXT,
    "origem" TEXT,
    "etapaAtual" TEXT,
    "assinaturaCliente" TEXT,
    "aprovadoCliente" BOOLEAN NOT NULL DEFAULT false,
    "enviadoEmail" BOOLEAN NOT NULL DEFAULT false,
    "enviadoWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "visualizada" BOOLEAN NOT NULL DEFAULT false,
    "urlPublica" TEXT,
    "pdfUrl" TEXT,
    "clienteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "templatePropostaTemplateid" INTEGER,

    CONSTRAINT "Proposta_pkey" PRIMARY KEY ("propostaid")
);

-- CreateTable
CREATE TABLE "ItemProposta" (
    "itempropostaid" SERIAL NOT NULL,
    "codigo" TEXT,
    "descricao" TEXT NOT NULL,
    "detalhes" TEXT,
    "unidade" TEXT,
    "quantidade" DECIMAL(10,2) NOT NULL,
    "valorUnitario" DECIMAL(10,2) NOT NULL,
    "desconto" DECIMAL(10,2),
    "acrescimo" DECIMAL(10,2),
    "subtotal" DECIMAL(10,2) NOT NULL,
    "ordem" INTEGER,
    "observacoes" TEXT,
    "propostaId" INTEGER NOT NULL,
    "servicoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemProposta_pkey" PRIMARY KEY ("itempropostaid")
);

-- CreateTable
CREATE TABLE "Agenda" (
    "agendaid" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoAgenda" NOT NULL,
    "prioridade" "PrioridadeAgenda" NOT NULL DEFAULT 'MEDIA',
    "local" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "cor" TEXT,
    "observacoes" TEXT,
    "clienteId" INTEGER,
    "propostaId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agenda_pkey" PRIMARY KEY ("agendaid")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "usuarioid" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "telefone" TEXT,
    "cargo" TEXT,
    "foto" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("usuarioid")
);

-- CreateTable
CREATE TABLE "TemplateProposta" (
    "templateid" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "logo" TEXT,
    "corPrimaria" TEXT,
    "corSecundaria" TEXT,
    "cabecalho" TEXT,
    "rodape" TEXT,
    "textoApresentacao" TEXT,
    "textoGarantia" TEXT,
    "textoPagamento" TEXT,
    "textoObservacao" TEXT,
    "exibirLogo" BOOLEAN NOT NULL DEFAULT true,
    "exibirEndereco" BOOLEAN NOT NULL DEFAULT true,
    "exibirTelefone" BOOLEAN NOT NULL DEFAULT true,
    "exibirEmail" BOOLEAN NOT NULL DEFAULT true,
    "exibirAssinatura" BOOLEAN NOT NULL DEFAULT true,
    "htmlPersonalizado" TEXT,
    "cssPersonalizado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateProposta_pkey" PRIMARY KEY ("templateid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cnpj_key" ON "Cliente"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cpf_key" ON "Cliente"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Servico_codigo_key" ON "Servico"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Proposta_numero_key" ON "Proposta"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- AddForeignKey
ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_templatePropostaTemplateid_fkey" FOREIGN KEY ("templatePropostaTemplateid") REFERENCES "TemplateProposta"("templateid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemProposta" ADD CONSTRAINT "ItemProposta_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "Proposta"("propostaid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemProposta" ADD CONSTRAINT "ItemProposta_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("servicoid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agenda" ADD CONSTRAINT "Agenda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agenda" ADD CONSTRAINT "Agenda_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "Proposta"("propostaid") ON DELETE SET NULL ON UPDATE CASCADE;
