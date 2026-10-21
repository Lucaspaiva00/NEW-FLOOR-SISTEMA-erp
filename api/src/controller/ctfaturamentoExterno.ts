import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../prisma";
import { sincronizarPropostaFaturada } from "../services/financeiro.service";
import { validarFaturamentoExterno, metadataFaturamentoExterno } from "../services/faturamentoExterno.service";

/** Registra nota já emitida fora do ERP, sem criar documento fiscal. */
export const registrar = async (req: Request, res: Response): Promise<void> => {
  const empresaId = Number(req.empresaId);
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(empresaId) || empresaId <= 0 ||
      !Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Empresa ou proposta inválida." }); return;
  }
  try {
    const resultado = await prisma.$transaction(async tx => {
      // Bloqueio de concorrência da proposta na empresa autenticada.
      await tx.$queryRawUnsafe('SELECT "propostaid" FROM "Proposta" WHERE "propostaid" = $1 AND "empresaId" = $2 FOR UPDATE', id, empresaId);
      const proposta = await tx.proposta.findFirst({
        where: { propostaid: id, empresaId },
        select: {
          propostaid: true, numero: true, status: true, subtotal: true, frete: true,
          planoRecebimento: true, valorLiquidoFinanceiro: true,
        },
      });
      if (!proposta) throw Object.assign(Error("Proposta não encontrada nesta empresa."), { statusCode: 404 });
      if (proposta.status === "FATURADA") {
        const origem = metadataFaturamentoExterno(proposta.planoRecebimento);
        throw Object.assign(Error(origem
          ? "Este faturamento externo já foi registrado. Consulte a conta a receber vinculada."
          : "A proposta já está faturada no ERP. Confira o documento antes de registrar outro faturamento."), { statusCode: 409 });
      }
      const vinculadas = await tx.notaFiscal.findMany({
        where: { empresaId, propostaId: id, status: { in: ["AUTORIZADA", "PROCESSANDO"] } },
        include: { empresaFiscal: { select: { ambiente: true } } },
      });
      if (vinculadas.some(n => n.status === "PROCESSANDO" || (n.ambienteEmissao || n.empresaFiscal.ambiente) === "PRODUCAO")) {
        throw Object.assign(Error("Já existe nota do ERP em processamento ou autorizada em produção para esta proposta. Consulte o Fiscal para evitar dupla cobrança."), { statusCode: 409 });
      }
      const receitasNaoProposta = await tx.lancamentoFinanceiro.findFirst({
        where: {
          empresaId, propostaId: id, tipo: "ENTRADA",
          origem: { not: "PROPOSTA" },
          status: { not: "CANCELADO" },
        },
        select: { lancamentofinanceiroid: true },
      });
      if (receitasNaoProposta) {
        throw Object.assign(Error("Existe uma conta a receber vinculada à proposta. Revise o financeiro antes de registrar faturamento externo."), { statusCode: 409 });
      }
      const total = Number(proposta.subtotal || 0) + Number(proposta.frete || 0);
      const dados = validarFaturamentoExterno(req.body, total);
      await tx.proposta.update({
        where: { propostaid: id },
        data: {
          status: "FATURADA", colunaKanbanId: null,
          dataFaturamento: dados.dataFaturamento,
          formaPagamento: dados.formaPagamento,
          condicoesPagamento: dados.condicoesPagamento,
          planoRecebimento: dados.planoRecebimento as Prisma.InputJsonValue,
          valorLiquidoFinanceiro: dados.valorLiquido,
        },
      });
      await sincronizarPropostaFaturada(id, empresaId, tx, true);
      return {
        propostaid: id, status: "FATURADA", origemFaturamento: "EXTERNO",
        referenciaFiscalExterna: dados.planoRecebimento.referenciaFiscalExterna,
        formaPagamento: dados.formaPagamento,
        valorLiquido: dados.valorLiquido,
        parcelas: dados.planoRecebimento.parcelas,
        mensagem: "Proposta faturada externamente; contas a receber geradas. Nenhuma nota fiscal foi emitida pelo ERP.",
      };
    }, { timeout: 30000 });
    res.json(resultado);
  } catch (error: any) {
    console.error("Faturamento externo:", error?.message || error);
    res.status(error?.statusCode || (error?.code === "P2002" ? 409 : 400)).json({
      error: error?.message || "Não foi possível faturar a proposta externamente.",
    });
  }
};
