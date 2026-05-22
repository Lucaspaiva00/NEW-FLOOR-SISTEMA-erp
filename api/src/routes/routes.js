const express = require("express");

const routes = express.Router();

const auth = require("../middlewares/auth");
const usuario = require("../controller/ctusuario");
const cliente = require("../controller/ctcliente");
const servico = require("../controller/ctservico");
const proposta = require("../controller/ctproposta");
const agenda = require("../controller/agenda.controller");
const template = require("../controller/cttemplate");

routes.get("/", (req, res) => {
    return res.json({
        status: "API ONLINE"
    });
});

routes.post("/usuarios", usuario.create);
routes.post("/usuarios/login", usuario.login);

routes
    .route("/clientes")
    .get(cliente.read)
    .post(cliente.create);

routes
    .route("/clientes/:id")
    .get(cliente.readOne)
    .put(cliente.update)
    .delete(cliente.remove);

routes
    .route("/servicos")
    .get(servico.read)
    .post(servico.create);

routes
    .route("/servicos/:id")
    .get(servico.readOne)
    .put(servico.update)
    .delete(servico.remove);

routes
    .route("/propostas")
    .get(proposta.read)
    .post(proposta.create);

routes
    .route("/propostas/dashboard")
    .get(proposta.dashboard);

routes.post("/propostas/:id/pdf", proposta.gerarPdf);
routes.get("/propostas/:id/download", proposta.downloadPdf);
routes.post("/propostas/:id/email", proposta.enviarEmail);
routes.get("/propostas/:id/whatsapp", proposta.whatsapp);

routes
    .route("/propostas/:id")
    .get(proposta.readOne)
    .put(proposta.update)
    .delete(proposta.remove);

routes
    .route("/agenda")
    .get(agenda.read)
    .post(agenda.create);

routes
    .route("/agenda/dashboard")
    .get(agenda.dashboard);

routes
    .route("/agenda/:id")
    .get(agenda.readOne)
    .put(agenda.update)
    .delete(agenda.remove);

routes
    .route("/templates")
    .get(template.read)
    .post(template.create);

routes
    .route("/templates/:id")
    .get(template.readOne)
    .put(template.update)
    .delete(template.remove);

module.exports = routes;