const prisma = require("../prisma");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

module.exports = {

    async create(req, res) {

        try {

            const {
                nome,
                email,
                senha
            } = req.body;

            const usuarioExiste = await prisma.usuario.findUnique({
                where: {
                    email
                }
            });

            if (usuarioExiste) {
                return res.status(400).json({
                    error: "E-mail já cadastrado"
                });
            }

            const senhaHash = await bcrypt.hash(senha, 10);

            const usuario = await prisma.usuario.create({
                data: {
                    nome,
                    email,
                    senha: senhaHash
                }
            });

            return res.status(201).json(usuario);

        } catch (error) {

            return res.status(500).json(error);

        }

    },

    async login(req, res) {

        try {

            const {
                email,
                senha
            } = req.body;

            const usuario = await prisma.usuario.findUnique({
                where: {
                    email
                }
            });

            if (!usuario) {
                return res.status(400).json({
                    error: "Usuário não encontrado"
                });
            }

            const senhaValida = await bcrypt.compare(
                senha,
                usuario.senha
            );

            if (!senhaValida) {
                return res.status(400).json({
                    error: "Senha inválida"
                });
            }

            const token = jwt.sign(
                {
                    id: usuario.usuarioid
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "7d"
                }
            );

            return res.json({
                usuario,
                token
            });

        } catch (error) {

            return res.status(500).json(error);

        }

    }

};