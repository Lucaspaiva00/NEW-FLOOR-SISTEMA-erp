const prisma = require("../prisma");

/* ===================================================
   CREATE
=================================================== */

exports.create = async (req, res) => {

    try {

        const body = req.body;

        const cliente = await prisma.cliente.create({

            data: {

                tipo: body.tipo,
                nome: body.nome,
                nomeFantasia: body.nomeFantasia,
                razaoSocial: body.razaoSocial,
                cnpj: body.cnpj,
                cpf: body.cpf,
                inscricaoEstadual:
                    body.inscricaoEstadual,
                responsavel:
                    body.responsavel,
                telefone:
                    body.telefone,
                telefoneSecundario:
                    body.telefoneSecundario,
                whatsapp:
                    body.whatsapp,
                email:
                    body.email,
                site:
                    body.site,
                cep:
                    body.cep,
                endereco:
                    body.endereco,
                numero:
                    body.numero,
                complemento:
                    body.complemento,
                bairro:
                    body.bairro,
                cidade:
                    body.cidade,
                estado:
                    body.estado,
                pais:
                    body.pais,
                latitude:
                    body.latitude,
                longitude:
                    body.longitude,
                observacoes:
                    body.observacoes,
                origemLead:
                    body.origemLead,
                tags:
                    body.tags,
                statusCliente:
                    body.statusCliente,
                limiteCredito:
                    body.limiteCredito,
                descontoPadrao:
                    body.descontoPadrao,
                dataNascimento:
                    body.dataNascimento
                        ? new Date(body.dataNascimento)
                        : null
            }

        });

        return res.status(201).json(cliente);

    } catch (error) {

        console.log(error);

        return res.status(500).json({

            error: "Erro ao cadastrar cliente"

        });

    }

};

/* ===================================================
   READ
=================================================== */

exports.read = async (req, res) => {

    try {

        const clientes = await prisma.cliente.findMany({

            include: {

                propostas: true,

                agendas: true

            },

            orderBy: {

                createdAt: "desc"

            }

        });

        return res.status(200).json(clientes);

    } catch (error) {

        console.log(error);

        return res.status(500).json({

            error: "Erro ao buscar clientes"

        });

    }

};

/* ===================================================
   READ ONE
=================================================== */

exports.readOne = async (req, res) => {

    try {

        const { id } = req.params;

        const cliente =
            await prisma.cliente.findUnique({

                where: {

                    clienteid: Number(id)

                },

                include: {

                    propostas: {

                        include: {

                            itens: true

                        }

                    },

                    agendas: true

                }

            });

        if (!cliente) {

            return res.status(404).json({

                error: "Cliente não encontrado"

            });

        }

        return res.status(200).json(cliente);

    } catch (error) {

        console.log(error);

        return res.status(500).json({

            error: "Erro ao buscar cliente"

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

        const cliente =
            await prisma.cliente.update({

                where: {

                    clienteid: Number(id)

                },

                data: {

                    tipo: body.tipo,

                    nome: body.nome,

                    nomeFantasia:
                        body.nomeFantasia,

                    razaoSocial:
                        body.razaoSocial,

                    cnpj:
                        body.cnpj,

                    cpf:
                        body.cpf,

                    inscricaoEstadual:
                        body.inscricaoEstadual,

                    responsavel:
                        body.responsavel,

                    telefone:
                        body.telefone,

                    telefoneSecundario:
                        body.telefoneSecundario,

                    whatsapp:
                        body.whatsapp,

                    email:
                        body.email,

                    site:
                        body.site,

                    cep:
                        body.cep,

                    endereco:
                        body.endereco,

                    numero:
                        body.numero,

                    complemento:
                        body.complemento,

                    bairro:
                        body.bairro,

                    cidade:
                        body.cidade,

                    estado:
                        body.estado,

                    pais:
                        body.pais,

                    latitude:
                        body.latitude,

                    longitude:
                        body.longitude,

                    observacoes:
                        body.observacoes,

                    origemLead:
                        body.origemLead,

                    tags:
                        body.tags,

                    statusCliente:
                        body.statusCliente,

                    limiteCredito:
                        body.limiteCredito,

                    descontoPadrao:
                        body.descontoPadrao,

                    dataNascimento:
                        body.dataNascimento
                            ? new Date(body.dataNascimento)
                            : null

                }

            });

        return res.status(200).json(cliente);

    } catch (error) {

        console.log(error);

        return res.status(500).json({

            error: "Erro ao atualizar cliente"

        });

    }

};

/* ===================================================
   DELETE
=================================================== */

exports.remove = async (req, res) => {

    try {

        const { id } = req.params;

        await prisma.cliente.delete({

            where: {

                clienteid: Number(id)

            }

        });

        return res.status(200).json({

            message: "Cliente removido"

        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({

            error: "Erro ao remover cliente"

        });

    }

};