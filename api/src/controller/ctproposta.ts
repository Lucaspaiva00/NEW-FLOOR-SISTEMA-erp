import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import prisma from "../prisma";
import { gerarHtmlProposta } from "../services/propostaHtml.service";
import { gerarPdfProposta } from "../services/propostaPdf.service";
import { enviarPropostaPorEmail } from "../services/propostaEmail.service";
import { gerarLinkWhatsapp } from "../services/propostaWhatsapp.service";

function paramId(
  id: string | string[] | number
): string {

  if (Array.isArray(id)) {
    return id[0];
  }

  return String(id);

}

async function buscarPropostaCompleta(id: string) {
  return prisma.proposta.findUnique({
    where: {
      propostaid: Number(id)
    },
    include: {
      cliente: true,
      vendedor: true,
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

async function buscarTemplatePadrao() {
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
      cabecalho: "NEW FLOOR PISOS E REVESTIMENTOS",
      textoApresentacao: "Proposta Técnica Comercial",
      textoGarantia: "Garantia conforme condições comerciais apresentadas.",
      textoPagamento: "Condições de pagamento conforme negociação.",
      textoObservacao: "Valores sujeitos à aprovação e validade da proposta.",
      rodape: "Documento gerado automaticamente pelo sistema NEW FLOOR ERP."
    }
  });
}

async function gerarPdfInterno(id: string | string[] | number) {

  const proposta =
    await buscarPropostaCompleta(
      paramId(id)
    );

  if (!proposta) {

    throw new Error(
      "Proposta não encontrada"
    );

  }

  let template =
    proposta.templateProposta;

  if (!template) {

    template =
      await buscarTemplatePadrao();

  }

  const html =
    gerarHtmlProposta({

      proposta,

      cliente:
        proposta.cliente,

      itens:
        proposta.itens,

      template

    });

  const nomeArquivo =
    `proposta-${proposta.numero}-${Date.now()}.pdf`;

  const pdf =
    await gerarPdfProposta(
      html,
      nomeArquivo
    );

  await prisma.proposta.update({

    where: {
      propostaid:
        proposta.propostaid
    },

    data: {
      pdfUrl:
        pdf.url
    }

  });

  return {

    proposta,

    caminho:
      pdf.caminho,

    pdfUrl:
      pdf.url

  };

}

export const create = async (
  req: Request,
  res: Response
): Promise<void> => {

  try {

    const body = req.body;

    const ultimaProposta =
      await prisma.proposta.findFirst({
        orderBy: {
          propostaid: "desc"
        }
      });

    const numeroAutomatico =
      `PROP-${String(
        (ultimaProposta?.propostaid || 0) + 1
      ).padStart(5, "0")}`;

    const subtotal =
      (body.itens || []).reduce(
        (total: number, item: any) =>
          total + Number(item.subtotal || 0),
        0
      );

    const proposta =
      await prisma.proposta.create({

        data: {

          numero:
            body.numero || numeroAutomatico,

          titulo:
            body.titulo,

          subtitulo:
            body.subtitulo || null,

          descricao:
            body.descricao || null,

          escopo:
            body.escopo || null,

          observacoes:
            body.observacoes || null,

          observacoesInternas:
            body.observacoesInternas || null,

          status:
            body.status || "RASCUNHO",

          prioridade:
            body.prioridade || null,

          subtotal:
            subtotal,

          frete:
            body.frete
              ? Number(body.frete)
              : null,

          formaPagamento:
            body.formaPagamento || null,

          condicoesPagamento:
            body.condicoesPagamento || null,

          validadeDias:
            body.validadeDias
              ? Number(body.validadeDias)
              : null,

          dataValidade:
            body.dataValidade
              ? new Date(body.dataValidade)
              : null,

          dataAprovacao:
            body.dataAprovacao
              ? new Date(body.dataAprovacao)
              : null,

          dataRecusa:
            body.dataRecusa
              ? new Date(body.dataRecusa)
              : null,

          motivoRecusa:
            body.motivoRecusa || null,

          responsavel:
            body.responsavel || null,

          vendedorId:
            body.vendedorId
              ? Number(body.vendedorId)
              : null,

          pdfUrl:
            body.pdfUrl || null,

          origem:
            body.origem || null,

          assinaturaCliente:
            body.assinaturaCliente || null,

          aprovadoCliente:
            body.aprovadoCliente ?? false,

          enviadoEmail:
            body.enviadoEmail ?? false,

          enviadoWhatsapp:
            body.enviadoWhatsapp ?? false,

          visualizada:
            body.visualizada ?? false,

          clienteId:
            Number(body.clienteId),

          templatePropostaTemplateid:
            body.templatePropostaTemplateid
              ? Number(body.templatePropostaTemplateid)
              : null,

          itens: {

            create:
              (body.itens || []).map(
                (item: any) => ({

                  codigo:
                    item.codigo || null,

                  descricao:
                    item.descricao || "",

                  detalhes:
                    item.detalhes || null,

                  unidade:
                    item.unidade || null,

                  quantidade:
                    Number(item.quantidade || 0),

                  valorUnitario:
                    Number(item.valorUnitario || 0),

                  desconto:
                    item.desconto
                      ? Number(item.desconto)
                      : null,

                  acrescimo:
                    item.acrescimo
                      ? Number(item.acrescimo)
                      : null,

                  subtotal:
                    Number(item.subtotal || 0),

                  ordem:
                    item.ordem
                      ? Number(item.ordem)
                      : null,

                  observacoes:
                    item.observacoes || null,

                  servicoId:
                    item.servicoId
                      ? Number(item.servicoId)
                      : null

                })
              )

          }

        },

        include: {

          cliente: true,

          vendedor: true,

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
        vendedor: true,
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


export const update = async (
  req: Request,
  res: Response
): Promise<void> => {
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

    const itensBody = body.itens || [];

    const subtotal = itensBody.reduce(
      (total: number, item: any) =>
        total + Number(item.subtotal || 0),
      0
    );

    await prisma.itemProposta.deleteMany({
      where: {
        propostaId: Number(id)
      }
    });

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

        subtotal,

        frete:
          body.frete !== undefined && body.frete !== null
            ? Number(body.frete)
            : propostaAtual.frete,

        formaPagamento:
          body.formaPagamento ?? propostaAtual.formaPagamento,

        condicoesPagamento:
          body.condicoesPagamento ?? propostaAtual.condicoesPagamento,

        validadeDias:
          body.validadeDias !== undefined && body.validadeDias !== null
            ? Number(body.validadeDias)
            : propostaAtual.validadeDias,

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

        vendedorId:
          body.vendedorId !== undefined && body.vendedorId !== null
            ? Number(body.vendedorId)
            : propostaAtual.vendedorId,

        pdfUrl: body.pdfUrl ?? propostaAtual.pdfUrl,
        origem: body.origem ?? propostaAtual.origem,

        assinaturaCliente:
          body.assinaturaCliente ?? propostaAtual.assinaturaCliente,

        aprovadoCliente:
          body.aprovadoCliente ?? propostaAtual.aprovadoCliente,

        enviadoEmail:
          body.enviadoEmail ?? propostaAtual.enviadoEmail,

        enviadoWhatsapp:
          body.enviadoWhatsapp ?? propostaAtual.enviadoWhatsapp,

        visualizada:
          body.visualizada ?? propostaAtual.visualizada,

        clienteId:
          body.clienteId !== undefined && body.clienteId !== null
            ? Number(body.clienteId)
            : propostaAtual.clienteId,

        templatePropostaTemplateid:
          body.templatePropostaTemplateid !== undefined &&
            body.templatePropostaTemplateid !== null
            ? Number(body.templatePropostaTemplateid)
            : propostaAtual.templatePropostaTemplateid,

        itens: {
          create: itensBody.map((item: any) => ({
            codigo: item.codigo || null,
            descricao: item.descricao || "",
            detalhes: item.detalhes || null,
            unidade: item.unidade || null,
            quantidade: Number(item.quantidade || 0),
            valorUnitario: Number(item.valorUnitario || 0),
            desconto:
              item.desconto !== undefined && item.desconto !== null
                ? Number(item.desconto)
                : null,
            acrescimo:
              item.acrescimo !== undefined && item.acrescimo !== null
                ? Number(item.acrescimo)
                : null,
            subtotal: Number(item.subtotal || 0),
            ordem:
              item.ordem !== undefined && item.ordem !== null
                ? Number(item.ordem)
                : null,
            observacoes: item.observacoes || null,
            servicoId: item.servicoId ? Number(item.servicoId) : null
          }))
        }
      },

      include: {
        cliente: true,
        vendedor: true,
        templateProposta: true,
        itens: {
          include: {
            servico: true
          }
        }
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
        status: "PENDENTE"
      }
    });

    const aprovadas = await prisma.proposta.count({
      where: {
        status: "APROVADA"
      }
    });

    const faturadas = await prisma.proposta.count({
      where: {
        status: "FATURADA"
      }
    });



    res.status(200).json({
      totalPropostas,
      pendentes,
      aprovadas,
      faturadas
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro dashboard"
    });
  }
};

export const gerarPdf =
  async (
    req: Request,
    res: Response
  ): Promise<void> => {

    try {

      const { id } =
        req.params;

      const resultado =
        await gerarPdfInterno(
          paramId(id)
        );

      const baseUrl =
        process.env.BASE_URL ||
        `${req.protocol}://${req.get("host")}`;

      res.status(200).json({

        success: true,

        pdfUrl:
          resultado.pdfUrl,

        downloadUrl:
          `${baseUrl}${resultado.pdfUrl}`

      });

    } catch (error: any) {

      console.error(error);

      res.status(500).json({

        error:
          error.message ||
          "Erro ao gerar PDF"

      });

    }

  };

export const downloadPdf =
  async (
    req: Request,
    res: Response
  ): Promise<void> => {

    try {

      const { id } =
        req.params;

      const proposta =
        await prisma.proposta.findUnique({

          where: {
            propostaid:
              Number(id)
          }

        });

      if (!proposta) {

        res.status(404).json({
          error:
            "Proposta não encontrada"
        });

        return;

      }

      if (!proposta.pdfUrl) {

        await gerarPdfInterno(
          paramId(id)
        );

      }

      const propostaAtualizada =
        await prisma.proposta.findUnique({

          where: {
            propostaid:
              Number(id)
          }

        });

      if (
        !propostaAtualizada?.pdfUrl
      ) {

        res.status(404).json({

          error:
            "PDF não encontrado"

        });

        return;

      }

      const caminhoArquivo =
        path.join(
          process.cwd(),
          "public",
          propostaAtualizada.pdfUrl.replace(/^\//, "")
        );

      if (
        !fs.existsSync(
          caminhoArquivo
        )
      ) {

        res.status(404).json({

          error:
            "Arquivo inexistente"

        });

        return;

      }

      res.download(
        caminhoArquivo
      );

    } catch (error) {

      console.error(error);

      res.status(500).json({

        error:
          "Erro download PDF"

      });

    }

  };

export const enviarEmail =
  async (
    req: Request,
    res: Response
  ): Promise<void> => {

    try {

      const { id } =
        req.params;

      const proposta =
        await buscarPropostaCompleta(
          paramId(id)
        );

      if (!proposta) {

        res.status(404).json({
          error:
            "Proposta não encontrada"
        });

        return;

      }

      if (
        !proposta.cliente?.email1
      ) {

        res.status(400).json({

          error:
            "Cliente sem e-mail"

        });

        return;

      }

      const resultado =
        await gerarPdfInterno(
          paramId(id)
        );

      await enviarPropostaPorEmail({

        destinatario:
          proposta.cliente.email1,

        clienteNome:
          proposta.cliente.nomeFantasia ||
          proposta.cliente.razaoSocial ||
          "Cliente",

        numeroProposta:
          proposta.numero,

        caminhoPdf:
          resultado.caminho

      });

      await prisma.proposta.update({

        where: {
          propostaid:
            proposta.propostaid
        },

        data: {
          enviadoEmail:
            true
        }

      });

      res.status(200).json({

        success: true,

        message:
          "E-mail enviado"

      });

    } catch (error) {

      console.error(error);

      res.status(500).json({

        error:
          "Erro envio e-mail"

      });

    }

  };
export const whatsapp =
  async (
    req: Request,
    res: Response
  ): Promise<void> => {

    try {

      const { id } =
        req.params;

      const proposta =
        await buscarPropostaCompleta(
          paramId(id)
        );

      if (!proposta) {

        res.status(404).json({

          error:
            "Proposta não encontrada"

        });

        return;

      }

      const telefone =
        proposta.cliente?.telefone1;

      if (!telefone) {

        res.status(400).json({

          error:
            "Cliente sem telefone"

        });

        return;

      }

      const resultado =
        await gerarPdfInterno(
          paramId(id)
        );

      const baseUrl =
        process.env.BASE_URL ||
        "https://new-floor-sistema-erp.onrender.com";

      const linkPdf =
        `${baseUrl}/propostas/${proposta.propostaid}/download`;

      const whatsappUrl =
        gerarLinkWhatsapp({

          clienteNome:
            proposta.cliente.nomeFantasia ||
            proposta.cliente.razaoSocial ||
            "Cliente",

          telefone,

          numeroProposta:
            proposta.numero,

          linkPdf

        });

      await prisma.proposta.update({

        where: {
          propostaid:
            proposta.propostaid
        },

        data: {
          enviadoWhatsapp:
            true
        }

      });

      res.status(200).json({

        whatsappUrl,

        pdfUrl:
          linkPdf

      });

    } catch (error) {

      console.error(error);

      res.status(500).json({

        error:
          "Erro WhatsApp"

      });

    }

  };