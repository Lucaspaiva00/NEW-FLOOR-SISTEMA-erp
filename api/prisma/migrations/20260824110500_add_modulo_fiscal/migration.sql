-- CreateEnum
CREATE TYPE "public"."AmbienteFiscal" AS ENUM ('HOMOLOGACAO', 'PRODUCAO');

-- CreateEnum
CREATE TYPE "public"."PadraoNfse" AS ENUM ('MUNICIPAL', 'NACIONAL');

-- CreateEnum
CREATE TYPE "public"."TipoDocumentoFiscal" AS ENUM ('NFE', 'NFSE');

-- CreateEnum
CREATE TYPE "public"."StatusNotaFiscal" AS ENUM ('RASCUNHO', 'PROCESSANDO', 'AUTORIZADA', 'REJEITADA', 'CANCELADA', 'ERRO');

-- CreateTable
CREATE TABLE "public"."EmpresaFiscal" (
    "empresafiscalid" SERIAL NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnpj" TEXT NOT NULL,
    "inscricaoEstadual" TEXT,
    "inscricaoMunicipal" TEXT,
    "regimeTributario" INTEGER NOT NULL DEFAULT 1,
    "cnae" TEXT,
    "cep" TEXT,
    "endereco" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "codigoMunicipioIbge" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "ambiente" "public"."AmbienteFiscal" NOT NULL DEFAULT 'HOMOLOGACAO',
    "provedor" TEXT NOT NULL DEFAULT 'FOCUS_NFE',
    "tokenHomologacao" TEXT,
    "tokenProducao" TEXT,
    "padraoNfse" "public"."PadraoNfse" NOT NULL DEFAULT 'MUNICIPAL',
    "serieNfe" TEXT,
    "serieNfse" TEXT,
    "naturezaOperacaoNfe" TEXT,
    "naturezaOperacaoNfse" TEXT DEFAULT '1',
    "regimeEspecialTributacaoNfse" TEXT,
    "optanteSimplesNacional" BOOLEAN NOT NULL DEFAULT true,
    "incentivadorCultural" BOOLEAN NOT NULL DEFAULT false,
    "itemListaServicoPadrao" TEXT,
    "codigoTributarioMunicipal" TEXT,
    "aliquotaIssPadrao" DECIMAL(7,4),
    "cfopDentroEstado" TEXT,
    "cfopForaEstado" TEXT,
    "ncmPadrao" TEXT,
    "unidadePadrao" TEXT DEFAULT 'UN',
    "icmsOrigemPadrao" INTEGER DEFAULT 0,
    "icmsSituacaoTributariaPadrao" TEXT,
    "pisSituacaoTributariaPadrao" TEXT,
    "cofinsSituacaoTributariaPadrao" TEXT,
    "informacoesAdicionaisPadrao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpresaFiscal_pkey" PRIMARY KEY ("empresafiscalid")
);

-- CreateTable
CREATE TABLE "public"."NotaFiscal" (
    "notafiscalid" SERIAL NOT NULL,
    "referencia" TEXT NOT NULL,
    "tipo" "public"."TipoDocumentoFiscal" NOT NULL,
    "status" "public"."StatusNotaFiscal" NOT NULL DEFAULT 'RASCUNHO',
    "empresaFiscalId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "propostaId" INTEGER,
    "numero" TEXT,
    "serie" TEXT,
    "chave" TEXT,
    "protocolo" TEXT,
    "codigoVerificacao" TEXT,
    "dataEmissao" TIMESTAMP(3),
    "dataAutorizacao" TIMESTAMP(3),
    "dataCancelamento" TIMESTAMP(3),
    "naturezaOperacao" TEXT,
    "finalidadeEmissao" INTEGER NOT NULL DEFAULT 1,
    "consumidorFinal" INTEGER NOT NULL DEFAULT 1,
    "presencaComprador" INTEGER NOT NULL DEFAULT 9,
    "modalidadeFrete" INTEGER NOT NULL DEFAULT 9,
    "indicadorIeDestinatario" INTEGER NOT NULL DEFAULT 9,
    "destinatarioNome" TEXT NOT NULL,
    "destinatarioCnpj" TEXT,
    "destinatarioCpf" TEXT,
    "destinatarioIe" TEXT,
    "destinatarioIm" TEXT,
    "destinatarioEmail" TEXT,
    "destinatarioTelefone" TEXT,
    "destinatarioCep" TEXT,
    "destinatarioEndereco" TEXT,
    "destinatarioNumero" TEXT,
    "destinatarioComplemento" TEXT,
    "destinatarioBairro" TEXT,
    "destinatarioCidade" TEXT,
    "destinatarioEstado" TEXT,
    "destinatarioCodigoMunicipio" TEXT,
    "destinatarioPais" TEXT DEFAULT 'Brasil',
    "valorProdutos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorServicos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorFrete" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorSeguro" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorDesconto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorOutrasDespesas" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "itemListaServico" TEXT,
    "codigoTributarioMunicipal" TEXT,
    "cnaeServico" TEXT,
    "aliquotaIss" DECIMAL(7,4),
    "issRetido" BOOLEAN NOT NULL DEFAULT false,
    "codigoObra" TEXT,
    "art" TEXT,
    "informacoesAdicionais" TEXT,
    "payloadExtra" JSONB,
    "payloadEnviado" JSONB,
    "retornoProvedor" JSONB,
    "mensagemRetorno" TEXT,
    "caminhoXml" TEXT,
    "caminhoPdf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("notafiscalid")
);

-- CreateTable
CREATE TABLE "public"."ItemNotaFiscal" (
    "itemnotafiscalid" SERIAL NOT NULL,
    "notaFiscalId" INTEGER NOT NULL,
    "codigo" TEXT,
    "descricao" TEXT NOT NULL,
    "ncm" TEXT,
    "cest" TEXT,
    "cfop" TEXT,
    "unidade" TEXT NOT NULL DEFAULT 'UN',
    "quantidade" DECIMAL(14,4) NOT NULL,
    "valorUnitario" DECIMAL(14,6) NOT NULL,
    "valorBruto" DECIMAL(14,2) NOT NULL,
    "valorDesconto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "icmsOrigem" INTEGER DEFAULT 0,
    "icmsSituacaoTributaria" TEXT,
    "icmsModalidadeBaseCalculo" INTEGER,
    "icmsBaseCalculo" DECIMAL(14,2),
    "icmsAliquota" DECIMAL(7,4),
    "icmsValor" DECIMAL(14,2),
    "pisSituacaoTributaria" TEXT,
    "pisBaseCalculo" DECIMAL(14,2),
    "pisAliquota" DECIMAL(7,4),
    "pisValor" DECIMAL(14,2),
    "cofinsSituacaoTributaria" TEXT,
    "cofinsBaseCalculo" DECIMAL(14,2),
    "cofinsAliquota" DECIMAL(7,4),
    "cofinsValor" DECIMAL(14,2),
    "informacoesAdicionais" TEXT,
    "payloadExtra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemNotaFiscal_pkey" PRIMARY KEY ("itemnotafiscalid")
);

-- CreateTable
CREATE TABLE "public"."EventoNotaFiscal" (
    "eventonotafiscalid" SERIAL NOT NULL,
    "notaFiscalId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT,
    "descricao" TEXT,
    "protocolo" TEXT,
    "retorno" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoNotaFiscal_pkey" PRIMARY KEY ("eventonotafiscalid")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmpresaFiscal_cnpj_key" ON "public"."EmpresaFiscal"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_referencia_key" ON "public"."NotaFiscal"("referencia");

-- CreateIndex
CREATE INDEX "NotaFiscal_empresaFiscalId_idx" ON "public"."NotaFiscal"("empresaFiscalId");
CREATE INDEX "NotaFiscal_clienteId_idx" ON "public"."NotaFiscal"("clienteId");
CREATE INDEX "NotaFiscal_propostaId_idx" ON "public"."NotaFiscal"("propostaId");
CREATE INDEX "NotaFiscal_status_idx" ON "public"."NotaFiscal"("status");
CREATE INDEX "NotaFiscal_tipo_idx" ON "public"."NotaFiscal"("tipo");
CREATE INDEX "NotaFiscal_createdAt_idx" ON "public"."NotaFiscal"("createdAt");
CREATE INDEX "ItemNotaFiscal_notaFiscalId_idx" ON "public"."ItemNotaFiscal"("notaFiscalId");
CREATE INDEX "EventoNotaFiscal_notaFiscalId_idx" ON "public"."EventoNotaFiscal"("notaFiscalId");

-- AddForeignKey
ALTER TABLE "public"."NotaFiscal" ADD CONSTRAINT "NotaFiscal_empresaFiscalId_fkey" FOREIGN KEY ("empresaFiscalId") REFERENCES "public"."EmpresaFiscal"("empresafiscalid") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."NotaFiscal" ADD CONSTRAINT "NotaFiscal_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("clienteid") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."NotaFiscal" ADD CONSTRAINT "NotaFiscal_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "public"."Proposta"("propostaid") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ItemNotaFiscal" ADD CONSTRAINT "ItemNotaFiscal_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "public"."NotaFiscal"("notafiscalid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."EventoNotaFiscal" ADD CONSTRAINT "EventoNotaFiscal_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "public"."NotaFiscal"("notafiscalid") ON DELETE CASCADE ON UPDATE CASCADE;
