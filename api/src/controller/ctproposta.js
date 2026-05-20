const prisma = require("../prisma");

/* ===================================================
   CREATE
=================================================== */

exports.create = async (req, res) => {

    try {

        const body = req.body;

        const proposta = await prisma.proposta.create({

            data: {

                numero:
                    body.numero,

                titulo:
                    body.titulo,

                subtitulo:
                    body.subtitulo,

                descricao:
                    body.descricao,

                escopo:
                    body.escopo,

                observacoes:
                    body.observacoes,

                observacoesInternas:
                    body.observacoesInternas,

                status:
                    body.status || "RASCUNHO",

                prioridade:
                    body.prioridade,

                subtotal:
                    body.subtotal,

                desconto:
                    body.desconto,

                acrescimo:
                    body.acrescimo,

                frete:
                    body.frete,

                impostos:
                    body.impostos,

                total:
                    body.total,

                percentualLucro:
                    body.percentualLucro,

                formaPagamento:
                    body.formaPagamento,

                condicoesPagamento:
                    body.condicoesPagamento,

                validadeDias:
                    body.validadeDias,

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
                    body.motivoRecusa,

                responsavel:
                    body.responsavel,

                vendedor:
                    body.vendedor,

                origem:
                    body.origem,

                etapaAtual:
                    body.etapaAtual,

                assinaturaCliente:
                    body.assinaturaCliente,

                aprovadoCliente:
                    body.aprovadoCliente ?? false,

                enviadoEmail:
                    body.enviadoEmail ?? false,

                enviadoWhatsapp:
                    body.enviadoWhatsapp ?? false,

                visualizada:
                    body.visualizada ?? false,

                urlPublica:
                    body.urlPublica,

                pdfUrl:
                    body.pdfUrl,

                clienteId:
                    body.clienteId,

                itens: {

                    create: body.itens.map(item => ({

                        codigo:
                            item.codigo,

                        descricao:
                            item.descricao,

                        detalhes:
                            item.detalhes,

                        unidade:
                            item.unidade,

                        quantidade:
                            item.quantidade,

                        valorUnitario:
                            item.valorUnitario,

                        desconto:
                            item.desconto,

                        acrescimo:
                            item.acrescimo,

                        subtotal:
                            item.subtotal,

                        ordem:
                            item.ordem,

                        observacoes:
                            item.observacoes,

                        servicoId:
                            item.servicoId || null

                    }))

                }

            },

            include: {

                cliente: true,

                itens: {

                    include: {

                        servico: true

                    }

                }

            }

        });

        return res.status(201).json(proposta);

    } catch (error) {

        console.log(error);

        return res.status(500).json({

            error: "Erro ao criar proposta"

        });

    }

};

/* ===================================================
   READ
=================================================== */

exports.read = async (req, res) => {

    try {

        const propostas =
            await prisma.proposta.findMany({

                include: {

                    cliente: true,

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

        return res.status(200).json(propostas);

    } catch (error) {

        console.log(error);

        return res.status(500).json({

            error: "Erro ao buscar propostas"

        });

    }

};

/* ===================================================
   READ ONE
=================================================== */

exports.readOne = async (req, res) => {

    try {

        const { id } = req.params;

        const proposta =
            await prisma.proposta.findUnique({

                where: {

                    propostaid: Number(id)

                },

                include: {

                    cliente: true,

                    itens: {

                        include: {

                            servico: true

                        }

                    },

                    agendas: true

                }

            });

        if (!proposta) {

            return res.status(404).json({

                error: "Proposta não encontrada"

            });

        }

        return res.status(200).json(proposta);

    } catch (error) {

        console.log(error);

        return res.status(500).json({

            error: "Erro ao buscar proposta"

        });

    }

};

/* ===================================================
   UPDATE
=================================================== */

exports.update = async (req, res) => {

    try {

        const { id } = req.params;

        const body = req.body;

        const propostaAtual =
            await prisma.proposta.findUnique({

                where: {

                    propostaid: Number(id)

                }

            });

        if (!propostaAtual) {

            return res.status(404).json({

                error: "Proposta não encontrada"

            });

        }

        const proposta =
            await prisma.proposta.update({

                where: {

                    propostaid: Number(id)

                },

                data: {

                    numero:
                        body.numero ??
                        propostaAtual.numero,

                    titulo:
                        body.titulo ??
                        propostaAtual.titulo,

                    subtitulo:
                        body.subtitulo ??
                        propostaAtual.subtitulo,

                    descricao:
                        body.descricao ??
                        propostaAtual.descricao,

                    escopo:
                        body.escopo ??
                        propostaAtual.escopo,

                    observacoes:
                        body.observacoes ??
                        propostaAtual.observacoes,

                    observacoesInternas:
                        body.observacoesInternas ??
                        propostaAtual.observacoesInternas,

                    status:
                        body.status ??
                        propostaAtual.status,

                    prioridade:
                        body.prioridade ??
                        propostaAtual.prioridade,

                    subtotal:
                        body.subtotal ??
                        propostaAtual.subtotal,

                    desconto:
                        body.desconto ??
                        propostaAtual.desconto,

                    acrescimo:
                        body.acrescimo ??
                        propostaAtual.acrescimo,

                    frete:
                        body.frete ??
                        propostaAtual.frete,

                    impostos:
                        body.impostos ??
                        propostaAtual.impostos,

                    total:
                        body.total ??
                        propostaAtual.total,

                    percentualLucro:
                        body.percentualLucro ??
                        propostaAtual.percentualLucro,

                    formaPagamento:
                        body.formaPagamento ??
                        propostaAtual.formaPagamento,

                    condicoesPagamento:
                        body.condicoesPagamento ??
                        propostaAtual.condicoesPagamento,

                    validadeDias:
                        body.validadeDias ??
                        propostaAtual.validadeDias,

                    dataValidade:
                        body.dataValidade
                            ? new Date(body.dataValidade)
                            : propostaAtual.dataValidade,

                    dataAprovacao:
                        body.dataAprovacao
                            ? new Date(body.dataAprovacao)
                            : propostaAtual.dataAprovacao,

                    dataRecusa:
                        body.dataRecusa
                            ? new Date(body.dataRecusa)
                            : propostaAtual.dataRecusa,

                    motivoRecusa:
                        body.motivoRecusa ??
                        propostaAtual.motivoRecusa,

                    responsavel:
                        body.responsavel ??
                        propostaAtual.responsavel,

                    vendedor:
                        body.vendedor ??
                        propostaAtual.vendedor,

                    origem:
                        body.origem ??
                        propostaAtual.origem,

                    etapaAtual:
                        body.etapaAtual ??
                        propostaAtual.etapaAtual,

                    assinaturaCliente:
                        body.assinaturaCliente ??
                        propostaAtual.assinaturaCliente,

                    aprovadoCliente:
                        body.aprovadoCliente ??
                        propostaAtual.aprovadoCliente,

                    enviadoEmail:
                        body.enviadoEmail ??
                        propostaAtual.enviadoEmail,

                    enviadoWhatsapp:
                        body.enviadoWhatsapp ??
                        propostaAtual.enviadoWhatsapp,

                    visualizada:
                        body.visualizada ??
                        propostaAtual.visualizada,

                    urlPublica:
                        body.urlPublica ??
                        propostaAtual.urlPublica,

                    pdfUrl:
                        body.pdfUrl ??
                        propostaAtual.pdfUrl,

                    clienteId:
                        body.clienteId ??
                        propostaAtual.clienteId

                },

                include: {

                    cliente: true,

                    itens: true

                }

            });

        return res.status(200).json(proposta);

    } catch (error) {

        console.log(error);

        return res.status(500).json({

            error: "Erro ao atualizar proposta"

        });

    }

};

/* ===================================================
   DELETE
=================================================== */

exports.remove = async (req, res) => {

    try {

        const { id } = req.params;

        await prisma.proposta.delete({

            where: {

                propostaid: Number(id)

            }

        });

        return res.status(200).json({

            message: "Proposta removida"

        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({

            error: "Erro ao remover proposta"

        });

    }

};

/* ===================================================
   DASHBOARD
=================================================== */

exports.dashboard = async (req, res) => {

    try {

        const totalPropostas =
            await prisma.proposta.count();

        const pendentes =
            await prisma.proposta.count({

                where: {

                    status: "PENDENTE"

                }

            });

        const aprovadas =
            await prisma.proposta.count({

                where: {

                    status: "APROVADA"

                }

            });

        const faturadas =
            await prisma.proposta.count({

                where: {

                    status: "FATURADA"

                }

            });

        const totalFaturado =
            await prisma.proposta.aggregate({

                _sum: {

                    total: true

                },

                where: {

                    status: "FATURADA"

                }

            });

        return res.status(200).json({

            totalPropostas,

            pendentes,

            aprovadas,

            faturadas,

            totalFaturado:
                totalFaturado._sum.total || 0

        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({

            error: "Erro dashboard"

        });

    }

};