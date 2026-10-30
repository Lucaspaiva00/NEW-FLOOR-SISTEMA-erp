import * as emailUsuario from "../controller/ctemailUsuario";
import * as padroesNewFloor from "../controller/ctpadroesNewFloor";
import express from "express";
import * as obra from "../controller/ctobra";
import * as obraOperacao from "../controller/ctobraOperacao";
import * as obraImportacao from "../controller/ctobraImportacao";
import * as planilhasJose from "../controller/ctplanilhasMedicaoJose";
import * as agenda from "../controller/agenda.controller";
import * as compra from "../controller/ctcompra";
import * as fornecedor from "../controller/ctfornecedor";
import * as cliente from "../controller/ctcliente";
import * as cnpj from "../controller/ctcnpj";
import * as proposta from "../controller/ctproposta";
import * as faturamentoExterno from "../controller/ctfaturamentoExterno";
import * as servico from "../controller/ctservico";
import * as template from "../controller/cttemplate";
import * as usuario from "../controller/ctusuario";
import * as vendedor from "../controller/ctvendedor";
import * as fiscal from "../controller/ctfiscal";
import * as integracaoFiscalSba from "../controller/ctintegracaoFiscalSba";
import * as padroesSba from "../controller/ctpadroesFiscaisSba";
import * as nfseNacionalSba from "../controller/ctnfseNacionalSba";
import * as notasRecebidas from "../controller/ctnotasRecebidas";
import * as financeiro from "../controller/ctfinanceiro";
import * as empresa from "../controller/ctempresa";
import * as colunaKanban from "../controller/ctcolunakanban";
import * as arquivoFiscal from "../controller/ctarquivoFiscal";
import * as certificado from "../controller/ctcertificado";
import auth from "../middlewares/auth";
import requireRole from "../middlewares/requireRole";

const routes = express.Router();
routes.use('/obras', auth, obra.acesso);
routes.get('/obras', obra.listar);
routes.post('/obras', requireRole(['ADMIN','SUPER_ADMIN']), obra.salvar);
routes.get('/obras/colaboradores', obra.colaboradores);
routes.post('/obras/colaboradores', requireRole(['ADMIN','SUPER_ADMIN']), obra.salvarColaborador);
routes.put('/obras/colaboradores/:id', requireRole(['ADMIN','SUPER_ADMIN']), obra.salvarColaborador);
routes.post('/obras/apontamentos', requireRole(['ADMIN','SUPER_ADMIN']), obra.apontar);
routes.post('/obras/fechamentos', requireRole(['ADMIN','SUPER_ADMIN','FINANCEIRO']), obra.fechar);
routes.post('/obras/despesas', requireRole(['ADMIN','SUPER_ADMIN','FINANCEIRO']), obra.despesa);
routes.post('/obras/medicoes', requireRole(['ADMIN','SUPER_ADMIN']), obra.medir);
routes.post('/obras/medicoes/:id/aprovar', requireRole(['ADMIN','SUPER_ADMIN']), obra.aprovar);
routes.get('/obras/medicoes/:id/pdf', obra.pdf);
routes.post('/obras/importacao/previa', requireRole(['ADMIN','SUPER_ADMIN']), obraImportacao.previa);
routes.post('/obras/importacao/confirmar', requireRole(['ADMIN','SUPER_ADMIN']), obraImportacao.confirmar);
routes.post('/obras/planejamento', requireRole(['ADMIN','SUPER_ADMIN']), obraOperacao.planejar);
routes.delete('/obras/planejamento/:id', requireRole(['ADMIN','SUPER_ADMIN']), obraOperacao.removerPlanejamento);
routes.post('/obras/planilhas/previa', requireRole(['ADMIN','SUPER_ADMIN']), planilhasJose.somenteJose, planilhasJose.previa);
routes.post('/obras/planilhas/importar', requireRole(['ADMIN','SUPER_ADMIN']), planilhasJose.somenteJose, planilhasJose.importar);
routes.get('/obras/planilhas', planilhasJose.somenteJose, planilhasJose.listar);
routes.get('/obras/planilhas/:id', planilhasJose.somenteJose, planilhasJose.detalhe);
routes.put('/obras/planilhas/:id/medicao', requireRole(['ADMIN','SUPER_ADMIN']), planilhasJose.somenteJose, planilhasJose.salvarMedicao);
routes.get('/obras/planilhas/:id/excel', planilhasJose.somenteJose, planilhasJose.excel);
routes.get('/obras/medicoes/:id', obraOperacao.medicao);
routes.put('/obras/medicoes/:id', requireRole(['ADMIN','SUPER_ADMIN']), obraOperacao.corrigirMedicao);
routes.post('/obras/medicoes/:id/cancelar', requireRole(['ADMIN','SUPER_ADMIN']), obraOperacao.cancelar);
routes.post('/obras/despesas/:id/cancelar', requireRole(['ADMIN','SUPER_ADMIN','FINANCEIRO']), obraOperacao.cancelarGasto);
routes.post('/obras/fechamentos/:id/reabrir', requireRole(['ADMIN','SUPER_ADMIN','FINANCEIRO']), obraOperacao.reabrirFechamento);
routes.get('/obras/:id/consulta', obraOperacao.consulta);
routes.get('/obras/:id/relatorio', obraOperacao.relatorio);
routes.put('/obras/:id', requireRole(['ADMIN','SUPER_ADMIN']), obraOperacao.editar);
routes.get('/obras/:id', obra.detalhe);

routes.get("/", (_req, res) => {
  return res.json({
    status: "API ONLINE",
  });
});

routes.get("/email-envio/me", auth, emailUsuario.status);
// Provisionamento SMTP é responsabilidade da operação, fora da tela do cliente.

// --- Rotas públicas (sem token) ---
routes.post("/usuarios/login", usuario.login);
routes.post("/usuarios/esqueci-senha", usuario.solicitarRecuperacao);
routes.post("/usuarios/redefinir-senha", usuario.redefinirSenha);

// --- Provisionamento de empresas (tenants) — só Paiva Tech (SUPER_ADMIN) ---
routes
  .route("/empresas")
  .get(auth, requireRole(["SUPER_ADMIN"]), empresa.read)
  .post(auth, requireRole(["SUPER_ADMIN"]), empresa.create);

// --- Perfil da própria empresa (branding: logo, cores, contato) ---
// Qualquer usuário autenticado pode VER; só ADMIN da empresa pode EDITAR.
// Precisa vir ANTES de "/empresas/:id", senão o Express trata "me" como :id.
routes
  .route("/empresas/me")
  .get(auth, empresa.me)
  .put(auth, requireRole(["ADMIN", "SUPER_ADMIN"]), empresa.updateMe);

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

routes.get("/fornecedores", auth, fornecedor.empresaObrigatoria, fornecedor.listar);
routes.post("/fornecedores", auth, fornecedor.empresaObrigatoria, fornecedor.salvar);
routes.put("/fornecedores/:id", auth, fornecedor.empresaObrigatoria, fornecedor.salvar);

routes.get('/compras',auth,fornecedor.empresaObrigatoria,compra.listar);
routes.post('/compras',auth,fornecedor.empresaObrigatoria,compra.salvar);
routes.get('/compras/:id',auth,fornecedor.empresaObrigatoria,compra.buscar);
routes.put('/compras/:id',auth,fornecedor.empresaObrigatoria,compra.salvar);
routes.post('/compras/:id/confirmar',auth,fornecedor.empresaObrigatoria,compra.confirmar);
routes.post('/compras/:id/cancelar',auth,fornecedor.empresaObrigatoria,compra.cancelar);
// --- Tudo abaixo exige login (auth), escopado por empresaId no controller ---
routes.route("/clientes").get(auth, cliente.read).post(auth, cliente.create);
routes.get("/clientes/consulta-cnpj/:cnpj", auth, cnpj.consultar);
routes.get("/fornecedores/consulta-cnpj/:cnpj", auth, fornecedor.empresaObrigatoria, cnpj.consultar);

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

routes.route("/colunas-kanban").get(auth, colunaKanban.read).post(auth, colunaKanban.create);
routes
  .route("/colunas-kanban/:id")
  .put(auth, colunaKanban.update)
  .delete(auth, colunaKanban.remove);

routes.get("/observacoes/observacoes-padrao", auth, proposta.observacoesPadrao);

routes.post("/propostas/:id/pdf", auth, proposta.gerarPdf);
routes.post("/propostas/:id/faturamento-externo", auth, faturamentoExterno.registrar);
routes.get("/propostas/:id/download", auth, proposta.downloadPdf);
routes.get("/propostas/:id/visualizar", auth, proposta.visualizarPdf);
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

routes.use("/fiscal", (_req,res,next)=>{const json=res.json.bind(res);res.json=((body:any)=>json(JSON.parse(JSON.stringify(body,(key,value)=>["certificadoCriptografado","tokenHomologacao","tokenProducao"].includes(key)?undefined:value)))) as typeof res.json;next();});
routes.post("/fiscal/sba/certificado/validar",auth,requireRole(["ADMIN","SUPER_ADMIN"]),certificado.prevalidarSba);
routes.post("/fiscal/empresas/:id/certificado",auth,requireRole(["ADMIN","SUPER_ADMIN"]),certificado.upload);
routes.get("/fiscal/arquivos",auth,fornecedor.apenasSba,arquivoFiscal.listar);
routes.post("/fiscal/arquivos",auth,fornecedor.apenasSba,arquivoFiscal.criar);
routes.get("/fiscal/arquivos/:id/:tipo",auth,fornecedor.apenasSba,arquivoFiscal.baixar);
// Módulo fiscal
routes.get("/fiscal/dashboard", auth, fiscal.dashboard);
routes.get("/fiscal/sba/integracoes/status", auth, integracaoFiscalSba.diagnosticoFiscalSba);
routes.get("/fiscal/newfloor/padroes/:id",auth,requireRole(["ADMIN","SUPER_ADMIN"]),padroesNewFloor.ler);
routes.put("/fiscal/newfloor/padroes/:id",auth,requireRole(["ADMIN","SUPER_ADMIN"]),padroesNewFloor.salvar);
routes.get("/fiscal/sba/padroes",auth,requireRole(["ADMIN","SUPER_ADMIN"]),padroesSba.listar);
routes.put("/fiscal/sba/padroes/empresa/:id",auth,requireRole(["ADMIN","SUPER_ADMIN"]),padroesSba.salvarEmpresa);
routes.post("/fiscal/sba/padroes/servico",auth,requireRole(["ADMIN","SUPER_ADMIN"]),padroesSba.criarServico);
routes.put("/fiscal/sba/padroes/servico/:id",auth,requireRole(["ADMIN","SUPER_ADMIN"]),padroesSba.salvarServico);
routes.post("/fiscal/sba/nfse/certificado/:emissoraId/testar",auth,requireRole(["ADMIN","SUPER_ADMIN"]),nfseNacionalSba.diagnosticarAssinatura);
routes.post("/fiscal/sba/nfse/certificado/:emissoraId/testar-sefin",auth,requireRole(["ADMIN","SUPER_ADMIN"]),nfseNacionalSba.testarTlsSefin);
routes.get("/fiscal/sba/nfse/preparacao/:notaId",auth,requireRole(["ADMIN","SUPER_ADMIN"]),nfseNacionalSba.prepararNota);
routes.get("/fiscal/sba/nfse/preparacao/:notaId/xml",auth,requireRole(["ADMIN","SUPER_ADMIN"]),nfseNacionalSba.baixarPreviaDps);
routes.post("/fiscal/sba/nfse/preparacao/:notaId/assinar",auth,requireRole(["ADMIN","SUPER_ADMIN"]),nfseNacionalSba.baixarDpsAssinada);
routes.post("/fiscal/sba/nfse/preparacao/:notaId/validar-xsd",auth,requireRole(["ADMIN","SUPER_ADMIN"]),nfseNacionalSba.validarXsdDps);
routes.get("/fiscal/recebidas",auth,requireRole(["ADMIN","SUPER_ADMIN","FINANCEIRO"]),notasRecebidas.listar);
routes.post("/fiscal/recebidas/importar",auth,requireRole(["ADMIN","SUPER_ADMIN","FINANCEIRO"]),notasRecebidas.importarParaPagar);
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
routes.get("/fiscal/notas/:id/conferir",auth,fiscal.conferirNota);
routes.get("/fiscal/notas/:id/payload", auth, fiscal.visualizarPayload);
routes.post("/fiscal/notas/:id/emitir", auth, fiscal.emitirNota);
routes.post("/fiscal/notas/:id/enviar-emails", auth, fiscal.enviarEmailsNewFloor);
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
