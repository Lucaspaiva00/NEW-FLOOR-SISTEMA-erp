const prisma = require("../prisma");

module.exports = {

    async create(req, res) {

        try {

            const servico = await prisma.servico.create({
                data: req.body
            });

            return res.status(201).json(servico);

        } catch (error) {

            return res.status(500).json(error);

        }

    },

    async read(req, res) {

        try {

            const servicos = await prisma.servico.findMany({
                orderBy: {
                    servicoid: "desc"
                }
            });

            return res.json(servicos);

        } catch (error) {

            return res.status(500).json(error);

        }

    }

};