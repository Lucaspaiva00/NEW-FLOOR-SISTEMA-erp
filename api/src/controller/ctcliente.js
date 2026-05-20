const prisma = require("../prisma");

module.exports = {

    async create(req, res) {

        try {

            const cliente = await prisma.cliente.create({
                data: req.body
            });

            return res.status(201).json(cliente);

        } catch (error) {

            return res.status(500).json(error);

        }

    },

    async read(req, res) {

        try {

            const clientes = await prisma.cliente.findMany({
                orderBy: {
                    clienteid: "desc"
                }
            });

            return res.json(clientes);

        } catch (error) {

            return res.status(500).json(error);

        }

    },

    async update(req, res) {

        try {

            const { id } = req.params;

            const cliente = await prisma.cliente.update({
                where: {
                    clienteid: Number(id)
                },
                data: req.body
            });

            return res.json(cliente);

        } catch (error) {

            return res.status(500).json(error);

        }

    },

    async remove(req, res) {

        try {

            const { id } = req.params;

            await prisma.cliente.delete({
                where: {
                    clienteid: Number(id)
                }
            });

            return res.json({
                message: "Cliente removido"
            });

        } catch (error) {

            return res.status(500).json(error);

        }

    }

};