import { Request, Response } from "express";
import prisma from "../prisma";

/**
 * Checagem somente leitura, exclusiva da SBA. Não usa token Focus e não
 * tenta transmitir documentos fiscais. Os indicadores permitem preparar
 * a integração direta à SEFIN Nacional sem interferir em outros tenants.
 */
export const diagnosticoFiscalSba = async (req: Request, res: Response): Promise<void> => {
  if (req.configuracaoSistema?.perfil !== "SBA" || !req.empresaId) {
    res.status(403).json({ error: "Diagnóstico disponível somente para o perfil SBA." });
    return;
  }
  try {
    const empresa = await prisma.empresa.findFirst({
      where: { empresaid: req.empresaId, slug: "sba", ativo: true },
      select: { empresaid: true },
    });
    if (!empresa) {
      res.status(403).json({ error: "Empresa não autorizada." });
      return;
    }
    const emissoras = await prisma.empresaFiscal.findMany({
      where: { empresaId: req.empresaId, ativo: true },
      select: {
        empresafiscalid: true, cnpj: true, razaoSocial: true, inscricaoMunicipal: true,
        codigoMunicipioIbge: true, certificadoCriptografado: true,
        regimeTributario: true, regimeApuracaoSimples: true, padraoNfse: true,
      },
      orderBy: { empresafiscalid: "asc" },
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({
      perfil: "SBA",
      nfsen: { destino: "SEFIN_NACIONAL_DIRETO", operacional: false,
        mensagem: "A integração direta de emissão ainda não está homologada. Nenhuma nota será enviada automaticamente." },
      materiais: { destino: "SIEG_EMISSOR", operacional: false,
        mensagem: "É necessário confirmar se o contrato da SBA habilita API de emissão de NF-e; API de documentos do SIEG Hüb não equivale à API do Emissor." },
      emissoras: emissoras.map(f => ({
        id: f.empresafiscalid,
        razaoSocial: f.razaoSocial,
        identificacaoCnpj: String(f.cnpj || "").replace(/\D/g, "").slice(-4),
        dados: {
          inscricaoMunicipal: Boolean(f.inscricaoMunicipal),
          codigoMunicipioIbge: /^\d{7}$/.test(String(f.codigoMunicipioIbge || "")),
          certificadoA1: Boolean(f.certificadoCriptografado),
          regimeTributario: Boolean(f.regimeTributario),
          apuracaoSimples: f.regimeApuracaoSimples != null,
          padraoNacional: f.padraoNfse === "NACIONAL",
        },
      })),
    });
  } catch (e) {
    console.error("Diagnóstico SBA:", e);
    res.status(500).json({ error: "Não foi possível verificar os pré-requisitos fiscais da SBA." });
  }
};
