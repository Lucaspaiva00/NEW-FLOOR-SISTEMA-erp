import express from "express";
import * as agenda from "../controller/agenda.controller";
import * as cliente from "../controller/ctcliente";
import * as proposta from "../controller/ctproposta";
import * as servico from "../controller/ctservico";
import * as template from "../controller/cttemplate";
import * as usuario from "../controller/ctusuario";
import * as vendedor from "../controller/ctvendedor";
import * as fiscal from "../controller/ctfiscal";
import * as financeiro from "../controller/ctfinanceiro";
import * as empresa from "../controller/ctempresa";
import auth from "../middlewares/auth";
import requireRole from "../middlewares/requireRole";

const routes = express.Router();

routes.get("/", (_req, res) => {
  return res.json({
    status: "API ONLINE",
  });
});

// --- Rotas públicas (sem token) ---
routes.post("/usuarios/login", usuario.login);
routes.post("/usuarios/esqueci-senha", usuario.solicitarRecuperacao);
routes.post("/usuarios/redefinir-senha", usuario.redefinirSenha);

// --- Provisionamento de empresas (tenants) — só Paiva Tech (SUPER_ADMIN) ---
routes
  .route("/empresas")
  .get(auth, requireRole(["SUPER_ADMIN"]), empresa.read)
  .post(auth, requireRole(["SUPER_ADMIN"]), empresa.create);
routes
  .route("/empresas/:id")
  .put(auth, requireRole(["SUPER_ADMIN"]), empresa.update);

// --- Usuários da própria empresa — só ADMIN/SUPER_ADMIN da empresa ---
routes
  .route("/usuarios")
  .get(auth, requireRole(["ADMIN", "SUPER_ADMIN"]), usuario.read)
  .post(auth, requireRole(["ADMIN", "SUPER_ADMIN"]), usuario.create);
routes
  .route("/usuarios/:id")
  .put(auth, requireRole(["ADMIN", "SUPER_ADMIN"]), usuario.update)
  .delete(auth, requireRole(["ADMIN", "SUPER_ADMIN"]), usuario.remove);

// --- Tudo abaixo exige login (auth), escopado por empresaId no controller ---
routes.route("/clientes").get(auth, cliente.read).post(auth, cliente.create);

routes
  .route("/clientes/:id")
  .get(auth, cliente.readOne)
  .put(auth, cliente.update)
  .delete(auth, cliente.remove);

routes.route("/servicos").get(auth, servico.read).post(auth, servico.create);

routes
  .route("/servicos/:id")
  .get(auth, servico.readOne)
  .put(auth, servico.update)
  .delete(auth, servico.remove);

routes.route("/propostas/kanban").get(auth, proposta.readKanban);
routes.route("/propostas").get(auth, proposta.read).post(auth, proposta.create);

routes.route("/propostas/dashboard").get(auth, proposta.dashboard);

routes.get("/observacoes/observacoes-padrao", auth, proposta.observacoesPadrao);

routes.post("/propostas/:id/pdf", auth, proposta.gerarPdf);
routes.get("/propostas/:id/download", auth, proposta.downloadPdf);
routes.post("/propostas/:id/email", auth, proposta.enviarEmail);
routes.get("/propostas/:id/whatsapp", auth, proposta.whatsapp);
routes.post("/propostas/:id/duplicar", auth, proposta.duplicar);

routes
  .route("/propostas/:id")
  .get(auth, proposta.readOne)
  .put(auth, proposta.update)
  .delete(auth, proposta.remove);

routes.route("/agenda").get(auth, agenda.read).post(auth, agenda.create);

routes.route("/agenda/dashboard").get(auth, agenda.dashboard);

routes
  .route("/agenda/:id")
  .get(auth, agenda.readOne)
  .put(auth, agenda.update)
  .delete(auth, agenda.remove);

routes.route("/templates").get(auth, template.read).post(auth, template.create);

routes
  .route("/templates/:id")
  .get(auth, template.readOne)
  .put(auth, template.update)
  .delete(auth, template.remove);

routes.route("/vendedores").get(auth, vendedor.read).post(auth, vendedor.create);

routes
  .route("/vendedores/:id")
  .get(auth, vendedor.readOne)
  .put(auth, vendedor.update)
  .delete(auth, vendedor.remove);

// Módulo fiscal
routes.get("/fiscal/dashboard", auth, fiscal.dashboard);
routes.route("/fiscal/empresas")
  .get(auth, fiscal.listarEmpresas)
  .post(auth, fiscal.criarEmpresa);
routes.route("/fiscal/empresas/:id")
  .put(auth, fiscal.atualizarEmpresa)
  .delete(auth, fiscal.removerEmpresa);
routes.get("/fiscal/propostas/:id/importar", auth, fiscal.importarProposta);
routes.get("/fiscal/logs", auth, fiscal.listarLogs);
routes.route("/fiscal/notas")
  .get(auth, fiscal.listarNotas)
  .post(auth, fiscal.criarNota);
routes.route("/fiscal/notas/:id")
  .get(auth, fiscal.buscarNota)
  .put(auth, fiscal.atualizarNota)
  .delete(auth, fiscal.removerNota);
routes.get("/fiscal/notas/:id/payload", auth, fiscal.visualizarPayload);
routes.post("/fiscal/notas/:id/emitir", auth, fiscal.emitirNota);
routes.post("/fiscal/notas/:id/consultar", auth, fiscal.consultarNota);
routes.post("/fiscal/notas/:id/cancelar", auth, fiscal.cancelarNota);
routes.post("/fiscal/notas/:id/carta-correcao", auth, fiscal.cartaCorrecaoNota);

// Módulo financeiro
routes.get("/financeiro/dashboard", auth, financeiro.dashboard);
routes.get("/financeiro/fluxo", auth, financeiro.fluxo);
routes.post("/financeiro/sincronizar-faturadas", auth, financeiro.sincronizarFaturadas);
routes.get("/financeiro/categorias", auth, financeiro.categorias);
routes.post("/financeiro/categorias", auth, financeiro.criarCategoria);
routes.get("/financeiro/contas", auth, financeiro.contas);
routes.post("/financeiro/contas", auth, financeiro.criarConta);
routes.post("/financeiro/propostas/:id/importar", auth, financeiro.importarProposta);
routes.route("/financeiro/lancamentos")
  .get(auth, financeiro.listar)
  .post(auth, financeiro.criar);
routes.route("/financeiro/lancamentos/:id")
  .get(auth, financeiro.buscar)
  .put(auth, financeiro.atualizar)
  .delete(auth, financeiro.excluir);
routes.post("/financeiro/lancamentos/:id/baixar", auth, financeiro.baixar);
routes.post("/financeiro/lancamentos/:id/reabrir", auth, financeiro.reabrir);
routes.post("/financeiro/lancamentos/:id/cancelar", auth, financeiro.cancelar);

export default routes;
