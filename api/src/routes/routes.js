const express = require("express");

const routes = express.Router();

const auth = require("../middlewares/auth");

const usuario = require("../controller/ctusuario");

const cliente = require("../controller/ctcliente");

const servico = require("../controller/ctservico");

routes.get("/", (req, res) => {

    return res.json({
        status: "API ONLINE"
    });

});

routes.post("/usuarios", usuario.create);

routes.post("/usuarios/login", usuario.login);

routes.get("/clientes", auth, cliente.read);

routes.post("/clientes", auth, cliente.create);

routes.put("/clientes/:id", auth, cliente.update);

routes.delete("/clientes/:id", auth, cliente.remove);

routes.get("/servicos", auth, servico.read);

routes.post("/servicos", auth, servico.create);

module.exports = routes;