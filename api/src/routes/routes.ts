import express from "express";
import * as agenda from "../controller/agenda.controller";
import * as cliente from "../controller/ctcliente";
import * as proposta from "../controller/ctproposta";
import * as servico from "../controller/ctservico";
import * as template from "../controller/cttemplate";
import * as usuario from "../controller/ctusuario";
import * as vendedor from "../controller/ctvendedor";
import auth from "../middlewares/auth";

const routes = express.Router();

void auth;

routes.get("/", (_req, res) => {
  return res.json({
    status: "API ONLINE",
  });
});

routes.post("/usuarios", usuario.create);
routes.post("/usuarios/login", usuario.login);
routes.post("/usuarios/esqueci-senha", usuario.solicitarRecuperacao);

routes.post("/usuarios/redefinir-senha", usuario.redefinirSenha);

routes.route("/clientes").get(cliente.read).post(cliente.create);

routes
  .route("/clientes/:id")
  .get(cliente.readOne)
  .put(cliente.update)
  .delete(cliente.remove);

routes.route("/servicos").get(servico.read).post(servico.create);

routes
  .route("/servicos/:id")
  .get(servico.readOne)
  .put(servico.update)
  .delete(servico.remove);

routes.route("/propostas").get(proposta.read).post(proposta.create);

routes.route("/propostas/dashboard").get(proposta.dashboard);

routes.get("/observacoes/observacoes-padrao", proposta.observacoesPadrao);

routes.post("/propostas/:id/pdf", proposta.gerarPdf);
routes.get("/propostas/:id/download", proposta.downloadPdf);
routes.post("/propostas/:id/email", proposta.enviarEmail);
routes.get("/propostas/:id/whatsapp", proposta.whatsapp);
routes.post("/propostas/:id/duplicar", proposta.duplicar);

routes
  .route("/propostas/:id")
  .get(proposta.readOne)
  .put(proposta.update)
  .delete(proposta.remove);

routes.route("/agenda").get(agenda.read).post(agenda.create);

routes.route("/agenda/dashboard").get(agenda.dashboard);

routes
  .route("/agenda/:id")
  .get(agenda.readOne)
  .put(agenda.update)
  .delete(agenda.remove);

routes.route("/templates").get(template.read).post(template.create);

routes
  .route("/templates/:id")
  .get(template.readOne)
  .put(template.update)
  .delete(template.remove);

routes.route("/vendedores").get(vendedor.read).post(vendedor.create);

routes
  .route("/vendedores/:id")
  .get(vendedor.readOne)
  .put(vendedor.update)
  .delete(vendedor.remove);

export default routes;
