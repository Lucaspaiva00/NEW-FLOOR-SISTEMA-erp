const prisma = require("../prisma");

exports.create = async (req, res) => {
    try {
        const template = await prisma.templateProposta.create({
            data: req.body
        });

        return res.status(201).json(template);

    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "Erro ao criar template" });
    }
};

exports.read = async (req, res) => {
    try {
        const templates = await prisma.templateProposta.findMany({
            orderBy: { createdAt: "desc" }
        });

        return res.json(templates);

    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "Erro ao buscar templates" });
    }
};

exports.readOne = async (req, res) => {
    try {
        const { id } = req.params;

        const template = await prisma.templateProposta.findUnique({
            where: { templateid: Number(id) }
        });

        if (!template) {
            return res.status(404).json({ error: "Template não encontrado" });
        }

        return res.json(template);

    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "Erro ao buscar template" });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;

        const template = await prisma.templateProposta.update({
            where: { templateid: Number(id) },
            data: req.body
        });

        return res.json(template);

    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "Erro ao atualizar template" });
    }
};

exports.remove = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.templateProposta.delete({
            where: { templateid: Number(id) }
        });

        return res.json({ message: "Template removido" });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "Erro ao remover template" });
    }
};