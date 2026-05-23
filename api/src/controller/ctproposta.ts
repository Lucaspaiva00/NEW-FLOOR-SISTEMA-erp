import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { StatusProposta, TemplateProposta } from "@prisma/client";
import prisma from "../prisma";
import { montarHtmlProposta } from "../services/template.service";
import { gerarPDF } from "../services/pdf.service";
import { enviarEmailComPdf } from "../services/email.service";

function paramId(id: string | string[]): string {
  return Array.isArray(id) ? id[0] : id;
}

async function buscarPropostaCompleta(id: string | number) {
  return await prisma.proposta.findUnique({
    where: {
      propostaid: Number(id)
    },
    include: {
      cliente: true,
      templateProposta: true,
      itens: {
        include: {
          servico: true
        }
      },
      agendas: true
    }
  });
}

async function buscarTemplatePadrao(): Promise<TemplateProposta> {
  const templateAtivo = await prisma.templateProposta.findFirst({
    where: {
      ativo: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (templateAtivo) {
    return templateAtivo;
  }

  return await prisma.templateProposta.create({
    data: {
      nome: "Template Padrão NEW FLOOR",
      ativo: true,
      corPrimaria: "#111827",
      corSecundaria: "#e5e7eb",
      cabecalho: "NEW FLOOR",
      textoApresentacao: "Proposta comercial personalizada",
      textoGarantia: "Garantia conforme condições comerciais apresentadas.",
      textoPagamento: "Condições de pagamento conforme negociação.",
      textoObservacao: "Valores sujeitos à aprovação e validade da proposta.",
      rodape: "Documento gerado automaticamente pelo sistema NEW FLOOR ERP."
    }
  });
}

async function gerarPdfInterno(id: string | number) {
  const proposta = await buscarPropostaCompleta(id);

  if (!proposta) {
    throw new Error("Proposta não encontrada");
  }

  let template = proposta.templateProposta;

  if (!template) {
    template = await buscarTemplatePadrao();
  }

  const html = montarHtmlProposta(proposta, template);

  const nomeArquivo = `proposta-${proposta.propostaid}-${Date.now()}.pdf`;

  const pdf = await gerarPDF(html, nomeArquivo);

  const propostaAtualizada = await prisma.proposta.update({
    where: {
      propostaid: proposta.propostaid
    },
    data: {
      pdfUrl: pdf.url
    }
  });

  return {
    proposta: propostaAtualizada,
    caminho: pdf.caminho,
    pdfUrl: pdf.url
  };
}

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;

    const proposta = await prisma.proposta.create({
      data: {
        numero: body.numero,
        titulo: body.titulo,
        subtitulo: body.subtitulo,
        descricao: body.descricao,
        escopo: body.escopo,
        observacoes: body.observacoes,
        observacoesInternas: body.observacoesInternas,
        status: body.status || "RASCUNHO",
        prioridade: body.prioridade,
        subtotal: body.subtotal,
        desconto: body.desconto,
        acrescimo: body.acrescimo,
        frete: body.frete,
        impostos: body.impostos,
        total: body.total,
        percentualLucro: body.percentualLucro,
        formaPagamento: body.formaPagamento,
        condicoesPagamento: body.condicoesPagamento,
        validadeDias: body.validadeDias,
        dataValidade: body.dataValidade
          ? new Date(body.dataValidade)
          : null,
        dataAprovacao: body.dataAprovacao
          ? new Date(body.dataAprovacao)
          : null,
        dataRecusa: body.dataRecusa ? new Date(body.dataRecusa) : null,
        motivoRecusa: body.motivoRecusa,
        responsavel: body.responsavel,
        vendedor: body.vendedor,
        origem: body.origem,
        etapaAtual: body.etapaAtual,
        assinaturaCliente: body.assinaturaCliente,
        aprovadoCliente: body.aprovadoCliente ?? false,
        enviadoEmail: body.enviadoEmail ?? false,
        enviadoWhatsapp: body.enviadoWhatsapp ?? false,
        visualizada: body.visualizada ?? false,
        urlPublica: body.urlPublica,
        pdfUrl: body.pdfUrl,
        clienteId: body.clienteId,
        templatePropostaTemplateid:
          body.templatePropostaTemplateid || null,
        itens: {
          create: body.itens.map(
            (item: {
              codigo?: string;
              descricao: string;
              detalhes?: string;
              unidade?: string;
              quantidade: number;
              valorUnitario: number;
              desconto?: number;
              acrescimo?: number;
              subtotal: number;
              ordem?: number;
              observacoes?: string;
              servicoId?: number | null;
            }) => ({
              codigo: item.codigo,
              descricao: item.descricao,
              detalhes: item.detalhes,
              unidade: item.unidade,
              quantidade: item.quantidade,
              valorUnitario: item.valorUnitario,
              desconto: item.desconto,
              acrescimo: item.acrescimo,
              subtotal: item.subtotal,
              ordem: item.ordem,
              observacoes: item.observacoes,
              servicoId: item.servicoId || null
            })
          )
        }
      },
      include: {
        cliente: true,
        templateProposta: true,
        itens: {
          include: {
            servico: true
          }
        }
      }
    });

    res.status(201).json(proposta);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao criar proposta"
    });
  }
};

export const read = async (_req: Request, res: Response): Promise<void> => {
  try {
    const propostas = await prisma.proposta.findMany({
      include: {
        cliente: true,
        templateProposta: true,
        itens: {
          include: {
            servico: true
          }
        },
        agendas: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json(propostas);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao buscar propostas"
    });
  }
};

export const readOne = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const proposta = await buscarPropostaCompleta(paramId(id));

    if (!proposta) {
      res.status(404).json({
        error: "Proposta não encontrada"
      });
      return;
    }

    res.status(200).json(proposta);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao buscar proposta"
    });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body;

    const propostaAtual = await prisma.proposta.findUnique({
      where: {
        propostaid: Number(id)
      }
    });

    if (!propostaAtual) {
      res.status(404).json({
        error: "Proposta não encontrada"
      });
      return;
    }

    const proposta = await prisma.proposta.update({
      where: {
        propostaid: Number(id)
      },
      data: {
        numero: body.numero ?? propostaAtual.numero,
        titulo: body.titulo ?? propostaAtual.titulo,
        subtitulo: body.subtitulo ?? propostaAtual.subtitulo,
        descricao: body.descricao ?? propostaAtual.descricao,
        escopo: body.escopo ?? propostaAtual.escopo,
        observacoes: body.observacoes ?? propostaAtual.observacoes,
        observacoesInternas:
          body.observacoesInternas ?? propostaAtual.observacoesInternas,
        status: body.status ?? propostaAtual.status,
        prioridade: body.prioridade ?? propostaAtual.prioridade,
        subtotal: body.subtotal ?? propostaAtual.subtotal,
        desconto: body.desconto ?? propostaAtual.desconto,
        acrescimo: body.acrescimo ?? propostaAtual.acrescimo,
        frete: body.frete ?? propostaAtual.frete,
        impostos: body.impostos ?? propostaAtual.impostos,
        total: body.total ?? propostaAtual.total,
        percentualLucro:
          body.percentualLucro ?? propostaAtual.percentualLucro,
        formaPagamento:
          body.formaPagamento ?? propostaAtual.formaPagamento,
        condicoesPagamento:
          body.condicoesPagamento ?? propostaAtual.condicoesPagamento,
        validadeDias: body.validadeDias ?? propostaAtual.validadeDias,
        dataValidade: body.dataValidade
          ? new Date(body.dataValidade)
          : propostaAtual.dataValidade,
        dataAprovacao: body.dataAprovacao
          ? new Date(body.dataAprovacao)
          : propostaAtual.dataAprovacao,
        dataRecusa: body.dataRecusa
          ? new Date(body.dataRecusa)
          : propostaAtual.dataRecusa,
        motivoRecusa: body.motivoRecusa ?? propostaAtual.motivoRecusa,
        responsavel: body.responsavel ?? propostaAtual.responsavel,
        vendedor: body.vendedor ?? propostaAtual.vendedor,
        origem: body.origem ?? propostaAtual.origem,
        etapaAtual: body.etapaAtual ?? propostaAtual.etapaAtual,
        assinaturaCliente:
          body.assinaturaCliente ?? propostaAtual.assinaturaCliente,
        aprovadoCliente:
          body.aprovadoCliente ?? propostaAtual.aprovadoCliente,
        enviadoEmail: body.enviadoEmail ?? propostaAtual.enviadoEmail,
        enviadoWhatsapp:
          body.enviadoWhatsapp ?? propostaAtual.enviadoWhatsapp,
        visualizada: body.visualizada ?? propostaAtual.visualizada,
        urlPublica: body.urlPublica ?? propostaAtual.urlPublica,
        pdfUrl: body.pdfUrl ?? propostaAtual.pdfUrl,
        clienteId: body.clienteId ?? propostaAtual.clienteId,
        templatePropostaTemplateid:
          body.templatePropostaTemplateid ??
          propostaAtual.templatePropostaTemplateid
      },
      include: {
        cliente: true,
        templateProposta: true,
        itens: true
      }
    });

    res.status(200).json(proposta);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao atualizar proposta"
    });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.proposta.delete({
      where: {
        propostaid: Number(id)
      }
    });

    res.status(200).json({
      message: "Proposta removida"
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao remover proposta"
    });
  }
};

export const dashboard = async (_req: Request, res: Response): Promise<void> => {
  try {
    const totalPropostas = await prisma.proposta.count();

    const pendentes = await prisma.proposta.count({
      where: {
        status: StatusProposta.PENDENTE
      }
    });

    const aprovadas = await prisma.proposta.count({
      where: {
        status: StatusProposta.APROVADA
      }
    });

    const faturadas = await prisma.proposta.count({
      where: {
        status: StatusProposta.FATURADA
      }
    });

    const totalFaturado = await prisma.proposta.aggregate({
      _sum: {
        total: true
      },
      where: {
        status: StatusProposta.FATURADA
      }
    });

    res.status(200).json({
      totalPropostas,
      pendentes,
      aprovadas,
      faturadas,
      totalFaturado: totalFaturado._sum.total || 0
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro dashboard"
    });
  }
};

export const gerarPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const resultado = await gerarPdfInterno(paramId(id));

    res.status(200).json({
      message: "PDF gerado com sucesso",
      pdfUrl: resultado.pdfUrl,
      downloadUrl: `http://localhost:${process.env.PORT || 3000}${resultado.pdfUrl}`
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao gerar PDF"
    });
  }
};

export const downloadPdf = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const proposta = await prisma.proposta.findUnique({
      where: {
        propostaid: Number(id)
      }
    });

    if (!proposta) {
      res.status(404).json({
        error: "Proposta não encontrada"
      });
      return;
    }

    if (!proposta.pdfUrl) {
      await gerarPdfInterno(paramId(id));
    }

    const propostaAtualizada = await prisma.proposta.findUnique({
      where: {
        propostaid: Number(id)
      }
    });

    if (!propostaAtualizada?.pdfUrl) {
      res.status(404).json({
        error: "Arquivo PDF não encontrado"
      });
      return;
    }

    const caminho = path.resolve(
      __dirname,
      "../../public",
      propostaAtualizada.pdfUrl.replace("/", "")
    );

    if (!fs.existsSync(caminho)) {
      res.status(404).json({
        error: "Arquivo PDF não encontrado"
      });
      return;
    }

    res.download(caminho);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao baixar PDF"
    });
  }
};

export const enviarEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const proposta = await buscarPropostaCompleta(paramId(id));

    if (!proposta) {
      res.status(404).json({
        error: "Proposta não encontrada"
      });
      return;
    }

    if (!proposta.cliente?.email) {
      res.status(400).json({
        error: "Cliente não possui e-mail cadastrado"
      });
      return;
    }

    const resultadoPdf = await gerarPdfInterno(paramId(id));

    await enviarEmailComPdf({
      para: proposta.cliente.email,
      assunto: `Proposta Comercial ${proposta.numero}`,
      mensagem: `
                <p>Olá, ${proposta.cliente.nome}.</p>
                <p>Segue em anexo a proposta comercial <strong>${proposta.numero}</strong>.</p>
                <p>Qualquer dúvida, estamos à disposição.</p>
            `,
      caminhoPdf: resultadoPdf.caminho
    });

    await prisma.proposta.update({
      where: {
        propostaid: Number(id)
      },
      data: {
        enviadoEmail: true
      }
    });

    res.status(200).json({
      message: "E-mail enviado com sucesso"
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao enviar e-mail"
    });
  }
};

export const whatsapp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const proposta = await buscarPropostaCompleta(paramId(id));

    if (!proposta) {
      res.status(404).json({
        error: "Proposta não encontrada"
      });
      return;
    }

    const telefone =
      proposta.cliente?.whatsapp || proposta.cliente?.telefone;

    if (!telefone) {
      res.status(400).json({
        error: "Cliente não possui WhatsApp/telefone cadastrado"
      });
      return;
    }

    const resultadoPdf = await gerarPdfInterno(paramId(id));

    const baseUrl =
      process.env.BASE_URL ||
      `http://localhost:${process.env.PORT || 3000}`;

    const linkPdf = `${baseUrl}${resultadoPdf.pdfUrl}`;

    const telefoneLimpo = telefone.replace(/\D/g, "");

    const texto = `
Olá ${proposta.cliente?.nome}, tudo bem?

Segue a proposta comercial ${proposta.numero}:

${linkPdf}

Qualquer dúvida, estou à disposição.
        `;

    const whatsappUrl = `https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(texto)}`;

    await prisma.proposta.update({
      where: {
        propostaid: Number(id)
      },
      data: {
        enviadoWhatsapp: true
      }
    });

    res.status(200).json({
      whatsappUrl,
      pdfUrl: linkPdf
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao gerar WhatsApp"
    });
  }
};
