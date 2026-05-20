const express = require("express");

const routes = express.Router();

const auth = require("../middlewares/auth");
const usuario = require("../controller/ctusuario");
const cliente = require("../controller/ctcliente");
const servico = require("../controller/ctservico");
const proposta = require("../controller/ctproposta");
const agenda = require("../controller/agenda.controller");

routes.get("/", (req, res) => {

    return res.json({
        status: "API ONLINE"
    });

});

routes.post("/usuarios", usuario.create);

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
    .route("/propostas")
    .get(proposta.read)
    .post(proposta.create);

routes
    .route("/propostas/dashboard")
    .get(proposta.dashboard);

routes
    .route("/propostas/:id")
    .get(proposta.readOne)
    .put(proposta.update)
    .delete(proposta.remove);

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

module.exports = routes;