(() => {
  "use strict";

  const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
  const token = usuario?.token;
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const $ = (id) => document.getElementById(id);
  const modalEmpresa = new bootstrap.Modal($("modalEmpresaFiscal"));
  const modalNota = new bootstrap.Modal($("modalNotaFiscal"));
  const modalDetalhe = new bootstrap.Modal($("modalDetalheFiscal"));

  let empresas = [];
  let clientes = [];
  let notas = [];
  let notaAtual = null;
  let itemSeq = 0;

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function numero(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function vazioParaNull(value) {
    const v = String(value ?? "").trim();
    return v === "" ? null : v;
  }

  function dinheiro(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function dataBr(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function inputDateTimeLocal(value) {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function soDigitos(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function cnpjFormatado(value) {
    const d = soDigitos(value);
    if (d.length !== 14) return value || "-";
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  function documentoDestinatario(nota) {
    return nota.destinatarioCnpj
      ? cnpjFormatado(nota.destinatarioCnpj)
      : nota.destinatarioCpf || "-";
  }

  function nomeEmpresa(empresa) {
    return empresa?.nomeFantasia || empresa?.razaoSocial || "-";
  }

  function nomeCliente(cliente) {
    return cliente?.nomeFantasia || cliente?.razaoSocial || cliente?.responsavel || `Cliente #${cliente?.clienteid ?? ""}`;
  }

  function statusInfo(status) {
    const map = {
      RASCUNHO: ["Rascunho", "draft"],
      PROCESSANDO: ["Processando", "processing"],
      AUTORIZADA: ["Autorizada", "authorized"],
      REJEITADA: ["Rejeitada", "rejected"],
      ERRO: ["Erro", "error"],
      CANCELADA: ["Cancelada", "cancelled"],
    };
    return map[status] || [status || "-", "draft"];
  }

  function statusBadge(status) {
    const [label, css] = statusInfo(status);
    return `<span class="fiscal-status fiscal-status-${css}">${esc(label)}</span>`;
  }

  async function api(path, options = {}) {
    const headers = {
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    };

    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    let data = null;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    } else {
      const text = await response.text().catch(() => "");
      data = text ? { error: text } : null;
    }

    if (!response.ok) {
      const error = new Error(data?.error || `Erro HTTP ${response.status}`);
      error.status = response.status;
      error.detalhes = data?.detalhes;
      throw error;
    }
    return data;
  }

  function mostrarErro(error, titulo = "Não foi possível concluir") {
    console.error(error);
    let detalhes = "";
    if (error?.detalhes) {
      const raw = typeof error.detalhes === "string"
        ? error.detalhes
        : JSON.stringify(error.detalhes, null, 2);
      detalhes = `<pre class="text-start mt-3 p-3 bg-light rounded" style="max-height:260px;overflow:auto;font-size:12px">${esc(raw)}</pre>`;
    }
    Swal.fire({
      icon: "error",
      title: titulo,
      html: `<div>${esc(error?.message || "Erro inesperado.")}</div>${detalhes}`,
      confirmButtonText: "OK",
    });
  }

  async function carregarDashboard() {
    const d = await api("/fiscal/dashboard");
    $("kpiFiscalTotal").textContent = d.total || 0;
    $("kpiFiscalRascunhos").textContent = d.rascunhos || 0;
    $("kpiFiscalProcessando").textContent = d.processando || 0;
    $("kpiFiscalAutorizadas").textContent = d.autorizadas || 0;
    $("kpiFiscalRejeitadas").textContent = d.rejeitadas || 0;
    $("kpiFiscalValor").textContent = dinheiro(d.valorAutorizado);
  }

  async function carregarEmpresas() {
    empresas = await api("/fiscal/empresas");
    renderEmpresas();
    atualizarSelectEmpresas();
  }

  async function carregarClientes() {
    const resposta = await api("/clientes");
    clientes = Array.isArray(resposta) ? resposta : (resposta?.clientes || resposta?.data || []);
    clientes.sort((a, b) => nomeCliente(a).localeCompare(nomeCliente(b), "pt-BR"));
    atualizarSelectClientes();
  }

  async function carregarNotas() {
    const qs = new URLSearchParams();
    const tipo = $("filtroTipoFiscal").value;
    const status = $("filtroStatusFiscal").value;
    const busca = $("buscaFiscal").value.trim();
    if (tipo) qs.set("tipo", tipo);
    if (status) qs.set("status", status);
    if (busca) qs.set("busca", busca);
    notas = await api(`/fiscal/notas${qs.toString() ? `?${qs}` : ""}`);
    renderNotas();
  }

  async function atualizarTudo() {
    try {
      await Promise.all([carregarDashboard(), carregarEmpresas(), carregarClientes(), carregarNotas()]);
    } catch (error) {
      mostrarErro(error, "Erro ao carregar o módulo fiscal");
    }
  }

  function atualizarSelectEmpresas() {
    const atual = $("nfEmpresa").value;
    $("nfEmpresa").innerHTML = `<option value="">Selecione a empresa emitente...</option>` +
      empresas
        .filter((e) => e.ativo !== false)
        .map((e) => `<option value="${e.empresafiscalid}">${esc(nomeEmpresa(e))} · ${esc(cnpjFormatado(e.cnpj))} · ${e.ambiente === "PRODUCAO" ? "Produção" : "Homologação"}</option>`)
        .join("");
    if ([...$("nfEmpresa").options].some((o) => o.value === String(atual))) $("nfEmpresa").value = atual;
  }

  function atualizarSelectClientes() {
    const atual = $("nfCliente").value;
    $("nfCliente").innerHTML = `<option value="">Selecione o cliente/tomador...</option>` +
      clientes.map((c) => `<option value="${c.clienteid}">${esc(nomeCliente(c))}${c.cnpj ? ` · ${esc(cnpjFormatado(c.cnpj))}` : ""}</option>`).join("");
    if ([...$("nfCliente").options].some((o) => o.value === String(atual))) $("nfCliente").value = atual;
  }

  function renderEmpresas() {
    const container = $("listaEmpresasFiscais");
    $("emptyEmpresasFiscal").classList.toggle("d-none", empresas.length > 0);
    if (!empresas.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = empresas.map((e) => {
      const temTokenAmbiente = e.ambiente === "PRODUCAO" ? e.temTokenProducao : e.temTokenHomologacao;
      return `
        <article class="empresa-fiscal-card ${e.ativo === false ? "empresa-inativa" : ""}">
          <div class="empresa-fiscal-head">
            <div>
              <span class="empresa-fiscal-environment ${e.ambiente === "PRODUCAO" ? "producao" : "homologacao"}">${e.ambiente === "PRODUCAO" ? "PRODUÇÃO" : "HOMOLOGAÇÃO"}</span>
              <h3>${esc(nomeEmpresa(e))}</h3>
              <p>${esc(e.razaoSocial)}</p>
            </div>
            <button class="fiscal-icon-button" type="button" data-editar-empresa="${e.empresafiscalid}" title="Editar">✎</button>
          </div>
          <div class="empresa-fiscal-data">
            <div><span>CNPJ</span><strong>${esc(cnpjFormatado(e.cnpj))}</strong></div>
            <div><span>IE / IM</span><strong>${esc(e.inscricaoEstadual || "-")} / ${esc(e.inscricaoMunicipal || "-")}</strong></div>
            <div><span>Regime</span><strong>${esc(String(e.regimeTributario || "-"))}</strong></div>
            <div><span>NFS-e</span><strong>${e.padraoNfse === "NACIONAL" ? "Padrão Nacional" : "Municipal"}</strong></div>
          </div>
          <div class="empresa-fiscal-footer">
            <span class="${temTokenAmbiente ? "fiscal-token-ok" : "fiscal-token-warn"}">${temTokenAmbiente ? "● Token configurado" : "● Token do ambiente não configurado"}</span>
            <div class="d-flex gap-2">
              ${e.ativo === false ? `<span class="badge text-bg-secondary">Inativa</span>` : ""}
              <button class="btn btn-sm btn-outline-danger" type="button" data-remover-empresa="${e.empresafiscalid}">Excluir</button>
            </div>
          </div>
        </article>`;
    }).join("");
  }

  function renderNotas() {
    const tbody = $("listaNotasFiscais");
    $("emptyNotasFiscal").classList.toggle("d-none", notas.length > 0);
    if (!notas.length) {
      tbody.innerHTML = "";
      return;
    }

    tbody.innerHTML = notas.map((n) => `
      <tr data-abrir-nota="${n.notafiscalid}" class="fiscal-row-clickable">
        <td>
          <strong>${n.tipo === "NFE" ? "NF-e" : "NFS-e"} ${n.numero ? `#${esc(n.numero)}` : ""}</strong>
          <small>${esc(n.referencia)}</small>
        </td>
        <td><strong>${esc(n.destinatarioNome)}</strong><small>${esc(documentoDestinatario(n))}</small></td>
        <td><strong>${esc(nomeEmpresa(n.empresaFiscal))}</strong><small>${esc(cnpjFormatado(n.empresaFiscal?.cnpj))}</small></td>
        <td>${esc(dataBr(n.dataEmissao))}</td>
        <td><strong>${esc(dinheiro(n.valorTotal))}</strong></td>
        <td>${statusBadge(n.status)}</td>
        <td class="text-end"><button class="fiscal-icon-button" type="button" data-abrir-nota="${n.notafiscalid}" title="Abrir">›</button></td>
      </tr>`).join("");
  }

  function abrirNovaEmpresa() {
    $("formEmpresaFiscal").reset();
    $("empresaFiscalId").value = "";
    $("tituloModalEmpresa").textContent = "Nova empresa emissora";
    $("efAmbiente").value = "HOMOLOGACAO";
    $("efProvedor").value = "FOCUS_NFE";
    $("efPadraoNfse").value = "MUNICIPAL";
    $("efRegime").value = "1";
    $("efSerieNfe").value = "1";
    $("efSerieNfse").value = "1";
    $("efNaturezaNfse").value = "1";
    $("efUnidade").value = "UN";
    $("efAtivo").checked = true;
    $("efOptanteSimples").checked = true;
    $("tokenHomologacaoInfo").textContent = "";
    $("tokenProducaoInfo").textContent = "";
    modalEmpresa.show();
  }

  function preencherEmpresa(e) {
    $("formEmpresaFiscal").reset();
    $("empresaFiscalId").value = e.empresafiscalid;
    $("tituloModalEmpresa").textContent = "Editar empresa emissora";
    const campos = {
      efRazaoSocial: e.razaoSocial,
      efNomeFantasia: e.nomeFantasia,
      efCnpj: e.cnpj,
      efIe: e.inscricaoEstadual,
      efIm: e.inscricaoMunicipal,
      efRegime: e.regimeTributario,
      efCnae: e.cnae,
      efCodigoMunicipio: e.codigoMunicipioIbge,
      efCep: e.cep,
      efEndereco: e.endereco,
      efNumero: e.numero,
      efComplemento: e.complemento,
      efBairro: e.bairro,
      efCidade: e.cidade,
      efEstado: e.estado,
      efTelefone: e.telefone,
      efEmail: e.email,
      efAmbiente: e.ambiente,
      efProvedor: e.provedor,
      efPadraoNfse: e.padraoNfse,
      efSerieNfe: e.serieNfe,
      efNaturezaNfe: e.naturezaOperacaoNfe,
      efCfopDentro: e.cfopDentroEstado,
      efCfopFora: e.cfopForaEstado,
      efNcm: e.ncmPadrao,
      efUnidade: e.unidadePadrao,
      efIcmsOrigem: e.icmsOrigemPadrao,
      efIcmsCst: e.icmsSituacaoTributariaPadrao,
      efPisCst: e.pisSituacaoTributariaPadrao,
      efCofinsCst: e.cofinsSituacaoTributariaPadrao,
      efSerieNfse: e.serieNfse,
      efNaturezaNfse: e.naturezaOperacaoNfse,
      efRegimeEspecialNfse: e.regimeEspecialTributacaoNfse,
      efItemLista: e.itemListaServicoPadrao,
      efAliquotaIss: e.aliquotaIssPadrao,
      efCodigoTributario: e.codigoTributarioMunicipal,
      efInfoAdicional: e.informacoesAdicionaisPadrao,
    };
    Object.entries(campos).forEach(([id, value]) => {
      if ($(id)) $(id).value = value ?? "";
    });
    $("efTokenHomologacao").value = "";
    $("efTokenProducao").value = "";
    $("tokenHomologacaoInfo").textContent = e.temTokenHomologacao ? "Token já configurado. Deixe vazio para manter." : "Nenhum token salvo.";
    $("tokenProducaoInfo").textContent = e.temTokenProducao ? "Token já configurado. Deixe vazio para manter." : "Nenhum token salvo.";
    $("efOptanteSimples").checked = e.optanteSimplesNacional !== false;
    $("efIncentivador").checked = Boolean(e.incentivadorCultural);
    $("efAtivo").checked = e.ativo !== false;
    modalEmpresa.show();
  }

  function dadosEmpresaForm() {
    return {
      razaoSocial: $("efRazaoSocial").value.trim(),
      nomeFantasia: vazioParaNull($("efNomeFantasia").value),
      cnpj: $("efCnpj").value.trim(),
      inscricaoEstadual: vazioParaNull($("efIe").value),
      inscricaoMunicipal: vazioParaNull($("efIm").value),
      regimeTributario: numero($("efRegime").value, 1),
      cnae: vazioParaNull($("efCnae").value),
      codigoMunicipioIbge: vazioParaNull($("efCodigoMunicipio").value),
      cep: vazioParaNull($("efCep").value),
      endereco: vazioParaNull($("efEndereco").value),
      numero: vazioParaNull($("efNumero").value),
      complemento: vazioParaNull($("efComplemento").value),
      bairro: vazioParaNull($("efBairro").value),
      cidade: vazioParaNull($("efCidade").value),
      estado: vazioParaNull($("efEstado").value)?.toUpperCase(),
      telefone: vazioParaNull($("efTelefone").value),
      email: vazioParaNull($("efEmail").value),
      ambiente: $("efAmbiente").value,
      provedor: $("efProvedor").value,
      padraoNfse: $("efPadraoNfse").value,
      tokenHomologacao: $("efTokenHomologacao").value.trim(),
      tokenProducao: $("efTokenProducao").value.trim(),
      serieNfe: vazioParaNull($("efSerieNfe").value),
      naturezaOperacaoNfe: vazioParaNull($("efNaturezaNfe").value),
      cfopDentroEstado: vazioParaNull($("efCfopDentro").value),
      cfopForaEstado: vazioParaNull($("efCfopFora").value),
      ncmPadrao: vazioParaNull($("efNcm").value),
      unidadePadrao: vazioParaNull($("efUnidade").value) || "UN",
      icmsOrigemPadrao: $("efIcmsOrigem").value === "" ? null : numero($("efIcmsOrigem").value),
      icmsSituacaoTributariaPadrao: vazioParaNull($("efIcmsCst").value),
      pisSituacaoTributariaPadrao: vazioParaNull($("efPisCst").value),
      cofinsSituacaoTributariaPadrao: vazioParaNull($("efCofinsCst").value),
      serieNfse: vazioParaNull($("efSerieNfse").value),
      naturezaOperacaoNfse: vazioParaNull($("efNaturezaNfse").value),
      regimeEspecialTributacaoNfse: vazioParaNull($("efRegimeEspecialNfse").value),
      itemListaServicoPadrao: vazioParaNull($("efItemLista").value),
      aliquotaIssPadrao: $("efAliquotaIss").value === "" ? null : numero($("efAliquotaIss").value),
      codigoTributarioMunicipal: vazioParaNull($("efCodigoTributario").value),
      optanteSimplesNacional: $("efOptanteSimples").checked,
      incentivadorCultural: $("efIncentivador").checked,
      informacoesAdicionaisPadrao: vazioParaNull($("efInfoAdicional").value),
      ativo: $("efAtivo").checked,
    };
  }

  async function salvarEmpresa(event) {
    event.preventDefault();
    const id = $("empresaFiscalId").value;
    try {
      const data = dadosEmpresaForm();
      if (!data.razaoSocial || !data.cnpj) throw new Error("Razão social e CNPJ são obrigatórios.");
      await api(id ? `/fiscal/empresas/${id}` : "/fiscal/empresas", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(data),
      });
      modalEmpresa.hide();
      await Promise.all([carregarEmpresas(), carregarDashboard()]);
      Swal.fire({ icon: "success", title: "Empresa fiscal salva", timer: 1500, showConfirmButton: false });
    } catch (error) {
      mostrarErro(error, "Erro ao salvar empresa emissora");
    }
  }

  async function removerEmpresa(id) {
    const empresa = empresas.find((e) => e.empresafiscalid === Number(id));
    const result = await Swal.fire({
      icon: "warning",
      title: `Remover ${nomeEmpresa(empresa)}?`,
      text: "Se já houver documentos fiscais, a empresa será apenas desativada.",
      showCancelButton: true,
      confirmButtonText: "Remover",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });
    if (!result.isConfirmed) return;
    try {
      const resp = await api(`/fiscal/empresas/${id}`, { method: "DELETE" });
      await carregarEmpresas();
      Swal.fire({ icon: "success", title: resp?.message || "Concluído", timer: 1800, showConfirmButton: false });
    } catch (error) {
      mostrarErro(error, "Erro ao remover empresa");
    }
  }

  function preencherDestinatario(cliente) {
    if (!cliente) return;
    $("nfDestNome").value = nomeCliente(cliente);
    $("nfDestCnpj").value = cliente.cnpj || "";
    $("nfDestCpf").value = cliente.cpf || "";
    $("nfDestIe").value = cliente.inscricaoEstadual || "";
    $("nfDestEmail").value = cliente.email1 || "";
    $("nfDestTelefone").value = cliente.telefone1 || "";
    $("nfDestCep").value = cliente.cep || "";
    $("nfDestEndereco").value = cliente.endereco || "";
    $("nfDestNumero").value = cliente.numero || "";
    $("nfDestComplemento").value = cliente.complemento || "";
    $("nfDestBairro").value = cliente.bairro || "";
    $("nfDestCidade").value = cliente.cidade || "";
    $("nfDestEstado").value = cliente.estado || "";
    $("nfDestPais").value = cliente.pais || "Brasil";
  }

  function empresaSelecionada() {
    return empresas.find((e) => e.empresafiscalid === Number($("nfEmpresa").value));
  }

  function aplicarPadroesEmpresa({ preservarItens = false } = {}) {
    const e = empresaSelecionada();
    if (!e) return;
    const tipo = $("nfTipo").value;
    if (tipo === "NFE") {
      $("nfSerie").value = e.serieNfe || "1";
      $("nfNaturezaOperacao").value = e.naturezaOperacaoNfe || "Venda de mercadoria";
    } else {
      $("nfSerie").value = e.serieNfse || "1";
      $("nfNaturezaOperacao").value = e.naturezaOperacaoNfse || "1";
      $("nfItemListaServico").value = e.itemListaServicoPadrao || "";
      $("nfCodigoTributarioMunicipal").value = e.codigoTributarioMunicipal || "";
      $("nfCnaeServico").value = e.cnae || "";
      $("nfAliquotaIss").value = e.aliquotaIssPadrao ?? "";
    }
    if (!$("nfInformacoesAdicionais").value && e.informacoesAdicionaisPadrao) {
      $("nfInformacoesAdicionais").value = e.informacoesAdicionaisPadrao;
    }

    if (!preservarItens) {
      document.querySelectorAll(".fiscal-item-card").forEach((card) => aplicarPadraoItem(card));
    }
  }

  function aplicarPadraoItem(card) {
    const e = empresaSelecionada();
    if (!e) return;
    const destUf = $("nfDestEstado").value.trim().toUpperCase();
    const emitUf = String(e.estado || "").trim().toUpperCase();
    const cfop = destUf && emitUf && destUf !== emitUf ? e.cfopForaEstado : e.cfopDentroEstado;
    const setIfEmpty = (field, value) => {
      const el = card.querySelector(`[data-field="${field}"]`);
      if (el && !el.value && value !== null && value !== undefined) el.value = value;
    };
    setIfEmpty("ncm", e.ncmPadrao);
    setIfEmpty("cfop", cfop);
    setIfEmpty("unidade", e.unidadePadrao || "UN");
    setIfEmpty("icmsOrigem", e.icmsOrigemPadrao);
    setIfEmpty("icmsSituacaoTributaria", e.icmsSituacaoTributariaPadrao);
    setIfEmpty("pisSituacaoTributaria", e.pisSituacaoTributariaPadrao);
    setIfEmpty("cofinsSituacaoTributaria", e.cofinsSituacaoTributariaPadrao);
  }

  function atualizarTipoNota() {
    const tipo = $("nfTipo").value;
    $("blocoNfe").classList.toggle("d-none", tipo !== "NFE");
    $("blocoNfse").classList.toggle("d-none", tipo !== "NFSE");
    document.querySelectorAll(".nfe-tax-only").forEach((el) => el.classList.toggle("d-none", tipo !== "NFE"));
    $("nfValorProdutos").closest("div").classList.toggle("opacity-50", tipo !== "NFE");
    $("nfValorServicos").closest("div").classList.toggle("opacity-50", tipo !== "NFSE");
    aplicarPadroesEmpresa({ preservarItens: true });
    calcularTotais();
  }

  function adicionarItem(item = {}) {
    itemSeq += 1;
    const id = itemSeq;
    const card = document.createElement("div");
    card.className = "fiscal-item-card";
    card.dataset.itemId = String(id);
    card.innerHTML = `
      <div class="fiscal-item-header">
        <strong>Item <span class="item-numero">${id}</span></strong>
        <button type="button" class="fiscal-remove-item" data-remover-item>Remover</button>
      </div>
      <div class="row g-2">
        <div class="col-md-2"><label>Código</label><input class="form-control" data-field="codigo" value="${esc(item.codigo || "")}"></div>
        <div class="col-md-5"><label>Descrição *</label><input class="form-control" data-field="descricao" required value="${esc(item.descricao || "")}"></div>
        <div class="col-md-1"><label>Un.</label><input class="form-control" data-field="unidade" value="${esc(item.unidade || "UN")}"></div>
        <div class="col-md-2"><label>Quantidade</label><input type="number" step="0.0001" min="0" class="form-control item-calculo" data-field="quantidade" value="${esc(item.quantidade ?? 1)}"></div>
        <div class="col-md-2"><label>Valor unitário</label><input type="number" step="0.01" min="0" class="form-control item-calculo" data-field="valorUnitario" value="${esc(item.valorUnitario ?? 0)}"></div>

        <div class="col-md-2"><label>Valor bruto</label><input type="number" step="0.01" min="0" class="form-control item-calculo" data-field="valorBruto" value="${esc(item.valorBruto ?? "")}"></div>
        <div class="col-md-2"><label>Desconto item</label><input type="number" step="0.01" min="0" class="form-control item-calculo" data-field="valorDesconto" value="${esc(item.valorDesconto ?? 0)}"></div>
        <div class="col-md-2 nfe-tax-only"><label>NCM</label><input class="form-control" data-field="ncm" value="${esc(item.ncm || "")}"></div>
        <div class="col-md-2 nfe-tax-only"><label>CEST</label><input class="form-control" data-field="cest" value="${esc(item.cest || "")}"></div>
        <div class="col-md-2 nfe-tax-only"><label>CFOP</label><input class="form-control" data-field="cfop" value="${esc(item.cfop || "")}"></div>
        <div class="col-md-2 nfe-tax-only"><label>Origem ICMS</label><input type="number" min="0" max="8" class="form-control" data-field="icmsOrigem" value="${esc(item.icmsOrigem ?? "")}"></div>

        <div class="col-md-2 nfe-tax-only"><label>CST/CSOSN ICMS</label><input class="form-control" data-field="icmsSituacaoTributaria" value="${esc(item.icmsSituacaoTributaria || "")}"></div>
        <div class="col-md-2 nfe-tax-only"><label>Modalidade BC</label><input type="number" class="form-control" data-field="icmsModalidadeBaseCalculo" value="${esc(item.icmsModalidadeBaseCalculo ?? "")}"></div>
        <div class="col-md-2 nfe-tax-only"><label>Base ICMS</label><input type="number" step="0.01" class="form-control" data-field="icmsBaseCalculo" value="${esc(item.icmsBaseCalculo ?? "")}"></div>
        <div class="col-md-2 nfe-tax-only"><label>Alíquota ICMS %</label><input type="number" step="0.0001" class="form-control" data-field="icmsAliquota" value="${esc(item.icmsAliquota ?? "")}"></div>
        <div class="col-md-2 nfe-tax-only"><label>ICMS R$</label><input type="number" step="0.01" class="form-control" data-field="icmsValor" value="${esc(item.icmsValor ?? "")}"></div>
        <div class="col-md-2 nfe-tax-only"><label>CST PIS</label><input class="form-control" data-field="pisSituacaoTributaria" value="${esc(item.pisSituacaoTributaria || "")}"></div>

        <div class="col-md-2 nfe-tax-only"><label>Base PIS</label><input type="number" step="0.01" class="form-control" data-field="pisBaseCalculo" value="${esc(item.pisBaseCalculo ?? "")}"></div>
        <div class="col-md-2 nfe-tax-only"><label>Alíquota PIS %</label><input type="number" step="0.0001" class="form-control" data-field="pisAliquota" value="${esc(item.pisAliquota ?? "")}"></div>
        <div class="col-md-2 nfe-tax-only"><label>PIS R$</label><input type="number" step="0.01" class="form-control" data-field="pisValor" value="${esc(item.pisValor ?? "")}"></div>
        <div class="col-md-2 nfe-tax-only"><label>CST COFINS</label><input class="form-control" data-field="cofinsSituacaoTributaria" value="${esc(item.cofinsSituacaoTributaria || "")}"></div>
        <div class="col-md-2 nfe-tax-only"><label>Base COFINS</label><input type="number" step="0.01" class="form-control" data-field="cofinsBaseCalculo" value="${esc(item.cofinsBaseCalculo ?? "")}"></div>
        <div class="col-md-2 nfe-tax-only"><label>Alíquota COFINS %</label><input type="number" step="0.0001" class="form-control" data-field="cofinsAliquota" value="${esc(item.cofinsAliquota ?? "")}"></div>
        <div class="col-md-2 nfe-tax-only"><label>COFINS R$</label><input type="number" step="0.01" class="form-control" data-field="cofinsValor" value="${esc(item.cofinsValor ?? "")}"></div>

        <div class="col-12"><label>Informações do item</label><input class="form-control" data-field="informacoesAdicionais" value="${esc(item.informacoesAdicionais || "")}"></div>
      </div>`;

    $("listaItensFiscal").appendChild(card);
    aplicarPadraoItem(card);
    card.querySelectorAll(".item-calculo").forEach((el) => el.addEventListener("input", () => {
      const q = numero(card.querySelector('[data-field="quantidade"]').value, 0);
      const vu = numero(card.querySelector('[data-field="valorUnitario"]').value, 0);
      const bruto = card.querySelector('[data-field="valorBruto"]');
      if (el.dataset.field === "quantidade" || el.dataset.field === "valorUnitario") bruto.value = (q * vu).toFixed(2);
      calcularTotais();
    }));
    card.querySelector("[data-remover-item]").addEventListener("click", () => {
      card.remove();
      renumerarItens();
      calcularTotais();
    });
    atualizarTipoNota();
    calcularTotais();
  }

  function renumerarItens() {
    document.querySelectorAll(".fiscal-item-card").forEach((card, index) => {
      const span = card.querySelector(".item-numero");
      if (span) span.textContent = String(index + 1);
    });
  }

  function coletarItens() {
    return [...document.querySelectorAll(".fiscal-item-card")].map((card) => {
      const get = (field) => card.querySelector(`[data-field="${field}"]`)?.value ?? "";
      const valorOpt = (field) => get(field) === "" ? null : numero(get(field));
      const quantidade = numero(get("quantidade"), 1);
      const valorUnitario = numero(get("valorUnitario"), 0);
      return {
        codigo: vazioParaNull(get("codigo")),
        descricao: get("descricao").trim(),
        unidade: get("unidade").trim() || "UN",
        quantidade,
        valorUnitario,
        valorBruto: get("valorBruto") === "" ? quantidade * valorUnitario : numero(get("valorBruto")),
        valorDesconto: numero(get("valorDesconto"), 0),
        ncm: vazioParaNull(get("ncm")),
        cest: vazioParaNull(get("cest")),
        cfop: vazioParaNull(get("cfop")),
        icmsOrigem: valorOpt("icmsOrigem"),
        icmsSituacaoTributaria: vazioParaNull(get("icmsSituacaoTributaria")),
        icmsModalidadeBaseCalculo: valorOpt("icmsModalidadeBaseCalculo"),
        icmsBaseCalculo: valorOpt("icmsBaseCalculo"),
        icmsAliquota: valorOpt("icmsAliquota"),
        icmsValor: valorOpt("icmsValor"),
        pisSituacaoTributaria: vazioParaNull(get("pisSituacaoTributaria")),
        pisBaseCalculo: valorOpt("pisBaseCalculo"),
        pisAliquota: valorOpt("pisAliquota"),
        pisValor: valorOpt("pisValor"),
        cofinsSituacaoTributaria: vazioParaNull(get("cofinsSituacaoTributaria")),
        cofinsBaseCalculo: valorOpt("cofinsBaseCalculo"),
        cofinsAliquota: valorOpt("cofinsAliquota"),
        cofinsValor: valorOpt("cofinsValor"),
        informacoesAdicionais: vazioParaNull(get("informacoesAdicionais")),
      };
    });
  }

  function calcularTotais() {
    const tipo = $("nfTipo").value;
    const itens = coletarItens();
    const itensTotal = itens.reduce((s, i) => s + numero(i.valorBruto) - numero(i.valorDesconto), 0);
    if (tipo === "NFE") {
      $("nfValorProdutos").value = itensTotal.toFixed(2);
      $("nfValorServicos").value = "0.00";
    } else {
      $("nfValorServicos").value = itensTotal.toFixed(2);
      $("nfValorProdutos").value = "0.00";
    }
    const base = tipo === "NFE" ? numero($("nfValorProdutos").value) : numero($("nfValorServicos").value);
    const total = base + numero($("nfValorFrete").value) + numero($("nfValorSeguro").value) + numero($("nfValorOutras").value) - numero($("nfValorDesconto").value);
    $("nfValorTotal").value = Math.max(total, 0).toFixed(2);
  }

  function abrirNovaNota() {
    if (!empresas.some((e) => e.ativo !== false)) {
      Swal.fire({ icon: "info", title: "Cadastre uma empresa emissora primeiro", text: "O documento fiscal precisa estar vinculado a um CNPJ emitente." });
      return;
    }
    if (!clientes.length) {
      Swal.fire({ icon: "info", title: "Cadastre um cliente primeiro", text: "A nota precisa de um destinatário/tomador." });
      return;
    }
    $("formNotaFiscal").reset();
    $("notaFiscalId").value = "";
    $("tituloModalNota").textContent = "Nova nota fiscal";
    $("nfPropostaId").value = "";
    $("nfPropostaNumero").value = "";
    $("nfTipo").value = "NFSE";
    $("nfDataEmissao").value = inputDateTimeLocal();
    $("nfDestPais").value = "Brasil";
    $("nfFinalidade").value = "1";
    $("nfConsumidorFinal").value = "1";
    $("nfPresenca").value = "9";
    $("nfModalidadeFrete").value = "9";
    $("nfIndicadorIe").value = "9";
    $("nfValorFrete").value = "0";
    $("nfValorSeguro").value = "0";
    $("nfValorDesconto").value = "0";
    $("nfValorOutras").value = "0";
    $("nfIssRetido").checked = false;
    $("listaItensFiscal").innerHTML = "";
    itemSeq = 0;
    const primeiraEmpresa = empresas.find((e) => e.ativo !== false);
    if (primeiraEmpresa) $("nfEmpresa").value = String(primeiraEmpresa.empresafiscalid);
    adicionarItem();
    aplicarPadroesEmpresa();
    atualizarTipoNota();
    modalNota.show();
  }

  async function importarProposta() {
    const id = Number($("nfPropostaNumero").value.trim());
    if (!id) {
      Swal.fire({ icon: "warning", title: "Informe o ID da proposta" });
      return;
    }
    try {
      const p = await api(`/fiscal/propostas/${id}/importar`);
      $("nfPropostaId").value = p.propostaId;
      $("nfPropostaNumero").value = p.propostaId;
      $("nfCliente").value = String(p.cliente.clienteid);
      preencherDestinatario(p.cliente);
      $("nfTipo").value = p.tipoProposta === "PRODUTOS" ? "NFE" : "NFSE";
      $("nfValorFrete").value = numero(p.frete).toFixed(2);
      if (p.observacoes) $("nfInformacoesAdicionais").value = p.observacoes;
      $("listaItensFiscal").innerHTML = "";
      itemSeq = 0;
      (p.itens || []).forEach((item) => adicionarItem(item));
      if (!(p.itens || []).length) adicionarItem();
      aplicarPadroesEmpresa();
      atualizarTipoNota();
      calcularTotais();
      Swal.fire({ icon: "success", title: `Proposta ${p.numeroProposta} importada`, timer: 1400, showConfirmButton: false });
    } catch (error) {
      mostrarErro(error, "Não foi possível importar a proposta");
    }
  }

  function preencherNota(n) {
    notaAtual = n;
    $("formNotaFiscal").reset();
    $("notaFiscalId").value = n.notafiscalid;
    $("tituloModalNota").textContent = `Editar ${n.tipo === "NFE" ? "NF-e" : "NFS-e"} · ${n.referencia}`;
    $("nfPropostaId").value = n.propostaId || "";
    $("nfPropostaNumero").value = n.propostaId || "";
    $("nfTipo").value = n.tipo;
    $("nfEmpresa").value = String(n.empresaFiscalId);
    $("nfCliente").value = String(n.clienteId);
    $("nfDataEmissao").value = inputDateTimeLocal(n.dataEmissao);
    $("nfNaturezaOperacao").value = n.naturezaOperacao || "";
    $("nfSerie").value = n.serie || "";
    $("nfDestNome").value = n.destinatarioNome || "";
    $("nfDestCnpj").value = n.destinatarioCnpj || "";
    $("nfDestCpf").value = n.destinatarioCpf || "";
    $("nfDestIe").value = n.destinatarioIe || "";
    $("nfIndicadorIe").value = n.indicadorIeDestinatario ?? 9;
    $("nfDestIm").value = n.destinatarioIm || "";
    $("nfDestEmail").value = n.destinatarioEmail || "";
    $("nfDestTelefone").value = n.destinatarioTelefone || "";
    $("nfDestCep").value = n.destinatarioCep || "";
    $("nfDestEndereco").value = n.destinatarioEndereco || "";
    $("nfDestNumero").value = n.destinatarioNumero || "";
    $("nfDestComplemento").value = n.destinatarioComplemento || "";
    $("nfDestBairro").value = n.destinatarioBairro || "";
    $("nfDestCidade").value = n.destinatarioCidade || "";
    $("nfDestEstado").value = n.destinatarioEstado || "";
    $("nfDestCodigoMunicipio").value = n.destinatarioCodigoMunicipio || "";
    $("nfDestPais").value = n.destinatarioPais || "Brasil";
    $("nfFinalidade").value = n.finalidadeEmissao ?? 1;
    $("nfConsumidorFinal").value = n.consumidorFinal ?? 1;
    $("nfPresenca").value = n.presencaComprador ?? 9;
    $("nfModalidadeFrete").value = n.modalidadeFrete ?? 9;
    $("nfItemListaServico").value = n.itemListaServico || "";
    $("nfCodigoTributarioMunicipal").value = n.codigoTributarioMunicipal || "";
    $("nfCnaeServico").value = n.cnaeServico || "";
    $("nfAliquotaIss").value = n.aliquotaIss ?? "";
    $("nfIssRetido").checked = Boolean(n.issRetido);
    $("nfCodigoObra").value = n.codigoObra || "";
    $("nfArt").value = n.art || "";
    $("nfValorProdutos").value = numero(n.valorProdutos).toFixed(2);
    $("nfValorServicos").value = numero(n.valorServicos).toFixed(2);
    $("nfValorFrete").value = numero(n.valorFrete).toFixed(2);
    $("nfValorSeguro").value = numero(n.valorSeguro).toFixed(2);
    $("nfValorDesconto").value = numero(n.valorDesconto).toFixed(2);
    $("nfValorOutras").value = numero(n.valorOutrasDespesas).toFixed(2);
    $("nfValorTotal").value = numero(n.valorTotal).toFixed(2);
    $("nfInformacoesAdicionais").value = n.informacoesAdicionais || "";
    $("nfPayloadExtra").value = n.payloadExtra ? JSON.stringify(n.payloadExtra, null, 2) : "";
    $("listaItensFiscal").innerHTML = "";
    itemSeq = 0;
    (n.itens || []).forEach((item) => adicionarItem(item));
    if (!(n.itens || []).length) adicionarItem();
    atualizarTipoNota();
    modalNota.show();
  }

  function dadosNotaForm() {
    let payloadExtra = null;
    const json = $("nfPayloadExtra").value.trim();
    if (json) {
      try {
        payloadExtra = JSON.parse(json);
      } catch {
        throw new Error("O JSON adicional do provedor está inválido.");
      }
    }
    const itens = coletarItens();
    if (!itens.length || itens.some((i) => !i.descricao)) throw new Error("Adicione pelo menos um item e preencha a descrição.");
    if (!$("nfEmpresa").value) throw new Error("Selecione a empresa emitente.");
    if (!$("nfCliente").value) throw new Error("Selecione o cliente/tomador.");
    if (!$("nfDestNome").value.trim()) throw new Error("Informe o nome/razão social do destinatário.");

    return {
      tipo: $("nfTipo").value,
      empresaFiscalId: Number($("nfEmpresa").value),
      clienteId: Number($("nfCliente").value),
      propostaId: $("nfPropostaId").value ? Number($("nfPropostaId").value) : null,
      dataEmissao: $("nfDataEmissao").value,
      naturezaOperacao: vazioParaNull($("nfNaturezaOperacao").value),
      serie: vazioParaNull($("nfSerie").value),
      destinatarioNome: $("nfDestNome").value.trim(),
      destinatarioCnpj: vazioParaNull($("nfDestCnpj").value),
      destinatarioCpf: vazioParaNull($("nfDestCpf").value),
      destinatarioIe: vazioParaNull($("nfDestIe").value),
      indicadorIeDestinatario: numero($("nfIndicadorIe").value, 9),
      destinatarioIm: vazioParaNull($("nfDestIm").value),
      destinatarioEmail: vazioParaNull($("nfDestEmail").value),
      destinatarioTelefone: vazioParaNull($("nfDestTelefone").value),
      destinatarioCep: vazioParaNull($("nfDestCep").value),
      destinatarioEndereco: vazioParaNull($("nfDestEndereco").value),
      destinatarioNumero: vazioParaNull($("nfDestNumero").value),
      destinatarioComplemento: vazioParaNull($("nfDestComplemento").value),
      destinatarioBairro: vazioParaNull($("nfDestBairro").value),
      destinatarioCidade: vazioParaNull($("nfDestCidade").value),
      destinatarioEstado: vazioParaNull($("nfDestEstado").value)?.toUpperCase(),
      destinatarioCodigoMunicipio: vazioParaNull($("nfDestCodigoMunicipio").value),
      destinatarioPais: vazioParaNull($("nfDestPais").value) || "Brasil",
      finalidadeEmissao: numero($("nfFinalidade").value, 1),
      consumidorFinal: numero($("nfConsumidorFinal").value, 1),
      presencaComprador: numero($("nfPresenca").value, 9),
      modalidadeFrete: numero($("nfModalidadeFrete").value, 9),
      itemListaServico: vazioParaNull($("nfItemListaServico").value),
      codigoTributarioMunicipal: vazioParaNull($("nfCodigoTributarioMunicipal").value),
      cnaeServico: vazioParaNull($("nfCnaeServico").value),
      aliquotaIss: $("nfAliquotaIss").value === "" ? null : numero($("nfAliquotaIss").value),
      issRetido: $("nfIssRetido").checked,
      codigoObra: vazioParaNull($("nfCodigoObra").value),
      art: vazioParaNull($("nfArt").value),
      valorProdutos: numero($("nfValorProdutos").value),
      valorServicos: numero($("nfValorServicos").value),
      valorFrete: numero($("nfValorFrete").value),
      valorSeguro: numero($("nfValorSeguro").value),
      valorDesconto: numero($("nfValorDesconto").value),
      valorOutrasDespesas: numero($("nfValorOutras").value),
      valorTotal: numero($("nfValorTotal").value),
      informacoesAdicionais: vazioParaNull($("nfInformacoesAdicionais").value),
      payloadExtra,
      itens,
    };
  }

  async function salvarNota(event) {
    event.preventDefault();
    try {
      calcularTotais();
      const body = dadosNotaForm();
      const id = $("notaFiscalId").value;
      const nota = await api(id ? `/fiscal/notas/${id}` : "/fiscal/notas", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      modalNota.hide();
      await Promise.all([carregarNotas(), carregarDashboard()]);
      Swal.fire({ icon: "success", title: "Rascunho fiscal salvo", text: `Referência: ${nota.referencia}`, timer: 1800, showConfirmButton: false });
    } catch (error) {
      mostrarErro(error, "Erro ao salvar o documento fiscal");
    }
  }

  function linhaDetalhe(label, value, wide = false) {
    if (value === null || value === undefined || value === "") value = "-";
    return `<div class="${wide ? "detail-wide" : ""}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function renderDetalhe(n) {
    const itens = (n.itens || []).map((i, index) => `
      <tr>
        <td>${index + 1}</td><td>${esc(i.codigo || "-")}</td><td>${esc(i.descricao)}</td>
        <td>${esc(i.quantidade)}</td><td>${esc(i.unidade)}</td><td>${dinheiro(i.valorUnitario)}</td>
        <td>${dinheiro(i.valorBruto)}</td><td>${esc(i.ncm || "-")}</td><td>${esc(i.cfop || "-")}</td>
      </tr>`).join("");
    const eventos = (n.eventos || []).map((e) => `
      <div class="fiscal-event-item">
        <span>${esc(dataBr(e.createdAt))}</span>
        <strong>${esc(e.tipo)}</strong>
        <p>${esc(e.descricao || e.status || "-")}</p>
      </div>`).join("");

    $("detalheFiscalRef").textContent = `${n.tipo === "NFE" ? "NF-e" : "NFS-e"} · ${n.referencia}`;
    $("conteudoDetalheFiscal").innerHTML = `
      <div class="fiscal-detail-head">
        <div><h3>${n.numero ? `Nº ${esc(n.numero)}` : "Documento sem número autorizado"}</h3><p>${esc(n.referencia)}</p></div>
        <div>${statusBadge(n.status)}</div>
      </div>
      ${n.mensagemRetorno ? `<div class="alert ${n.status === "AUTORIZADA" ? "alert-success" : n.status === "PROCESSANDO" ? "alert-info" : "alert-warning"}"><strong>Retorno:</strong> ${esc(n.mensagemRetorno)}</div>` : ""}
      <div class="fiscal-detail-grid">
        ${linhaDetalhe("Emitente", nomeEmpresa(n.empresaFiscal))}
        ${linhaDetalhe("CNPJ emitente", cnpjFormatado(n.empresaFiscal?.cnpj))}
        ${linhaDetalhe("Ambiente", n.empresaFiscal?.ambiente === "PRODUCAO" ? "Produção" : "Homologação")}
        ${linhaDetalhe("Emissão", dataBr(n.dataEmissao))}
        ${linhaDetalhe("Cliente/Tomador", n.destinatarioNome)}
        ${linhaDetalhe("Documento", documentoDestinatario(n))}
        ${linhaDetalhe("Cidade/UF", `${n.destinatarioCidade || "-"}/${n.destinatarioEstado || "-"}`)}
        ${linhaDetalhe("Proposta", n.proposta ? `${n.proposta.numero} · ${n.proposta.titulo}` : "-")}
        ${linhaDetalhe("Chave", n.chave || "-", true)}
        ${linhaDetalhe("Protocolo", n.protocolo || "-")}
        ${linhaDetalhe("Código verificação", n.codigoVerificacao || "-")}
        ${linhaDetalhe("Valor total", dinheiro(n.valorTotal))}
      </div>
      <div class="fiscal-section-title mt-4">Itens</div>
      <div class="table-responsive"><table class="table table-sm fiscal-detail-table"><thead><tr><th>#</th><th>Cód.</th><th>Descrição</th><th>Qtd.</th><th>Un.</th><th>Unitário</th><th>Bruto</th><th>NCM</th><th>CFOP</th></tr></thead><tbody>${itens || `<tr><td colspan="9">Sem itens</td></tr>`}</tbody></table></div>
      ${n.informacoesAdicionais ? `<div class="fiscal-section-title mt-4">Informações adicionais</div><div class="fiscal-text-box">${esc(n.informacoesAdicionais)}</div>` : ""}
      <div class="fiscal-section-title mt-4">Histórico fiscal</div>
      <div class="fiscal-event-list">${eventos || `<div class="text-muted">Sem eventos registrados.</div>`}</div>`;

    const editavel = ["RASCUNHO", "ERRO", "REJEITADA"].includes(n.status);
    const consultavel = n.status !== "RASCUNHO";
    $("acoesDetalheFiscal").innerHTML = `
      <button type="button" class="btn btn-light" data-bs-dismiss="modal">Fechar</button>
      <button type="button" class="btn btn-outline-secondary" data-ver-payload="${n.notafiscalid}">Ver payload</button>
      ${editavel ? `<button type="button" class="btn btn-outline-danger" data-excluir-nota="${n.notafiscalid}">Excluir rascunho</button>` : ""}
      ${editavel ? `<button type="button" class="btn btn-outline-primary" data-editar-nota="${n.notafiscalid}">Editar</button>` : ""}
      ${n.caminhoXml ? `<a class="btn btn-outline-success" target="_blank" rel="noopener" href="${esc(n.caminhoXml)}">XML</a>` : ""}
      ${n.caminhoPdf ? `<a class="btn btn-outline-success" target="_blank" rel="noopener" href="${esc(n.caminhoPdf)}">PDF</a>` : ""}
      ${consultavel ? `<button type="button" class="btn btn-outline-dark" data-consultar-nota="${n.notafiscalid}">Consultar</button>` : ""}
      ${n.status === "AUTORIZADA" && n.tipo === "NFE" ? `<button type="button" class="btn btn-outline-primary" data-carta-correcao="${n.notafiscalid}">Carta de correção</button>` : ""}
      ${n.status === "AUTORIZADA" ? `<button type="button" class="btn btn-danger" data-cancelar-nota="${n.notafiscalid}">Cancelar nota</button>` : ""}
      ${editavel ? `<button type="button" class="btn-new" data-emitir-nota="${n.notafiscalid}">Emitir agora</button>` : ""}`;
  }

  async function abrirDetalheNota(id) {
    try {
      notaAtual = await api(`/fiscal/notas/${id}`);
      renderDetalhe(notaAtual);
      modalDetalhe.show();
    } catch (error) {
      mostrarErro(error, "Erro ao abrir documento fiscal");
    }
  }

  async function editarNota(id) {
    try {
      const n = await api(`/fiscal/notas/${id}`);
      modalDetalhe.hide();
      preencherNota(n);
    } catch (error) {
      mostrarErro(error, "Erro ao carregar rascunho");
    }
  }

  async function executarAcaoNota(id, acao, titulo, confirmacao = null) {
    if (confirmacao) {
      const conf = await Swal.fire(confirmacao);
      if (!conf.isConfirmed) return;
    }
    try {
      Swal.fire({ title: titulo, allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const n = await api(`/fiscal/notas/${id}/${acao}`, { method: "POST", body: JSON.stringify({}) });
      Swal.close();
      await Promise.all([carregarNotas(), carregarDashboard()]);
      notaAtual = n;
      renderDetalhe(n);
      modalDetalhe.show();
      Swal.fire({ icon: n.status === "AUTORIZADA" ? "success" : "info", title: statusInfo(n.status)[0], text: n.mensagemRetorno || "Operação concluída.", timer: 2200, showConfirmButton: false });
    } catch (error) {
      Swal.close();
      await Promise.allSettled([carregarNotas(), carregarDashboard()]);
      mostrarErro(error, "Falha na comunicação fiscal");
    }
  }

  async function emitirNota(id) {
    const n = notaAtual?.notafiscalid === Number(id) ? notaAtual : await api(`/fiscal/notas/${id}`);
    const empresa = n.empresaFiscal;
    const ambiente = empresa?.ambiente === "PRODUCAO" ? "PRODUÇÃO" : "HOMOLOGAÇÃO";
    const conf = await Swal.fire({
      icon: empresa?.ambiente === "PRODUCAO" ? "warning" : "question",
      title: `Emitir em ${ambiente}?`,
      html: `<p><strong>${esc(n.tipo === "NFE" ? "NF-e" : "NFS-e")}</strong> de ${esc(dinheiro(n.valorTotal))}</p><p>Emitente: ${esc(nomeEmpresa(empresa))}</p>`,
      showCancelButton: true,
      confirmButtonText: "Sim, emitir",
      cancelButtonText: "Cancelar",
    });
    if (!conf.isConfirmed) return;
    await executarAcaoNota(id, "emitir", "Enviando documento fiscal...");
  }

  async function consultarNota(id) {
    await executarAcaoNota(id, "consultar", "Consultando o provedor fiscal...");
  }

  async function cancelarNota(id) {
    const result = await Swal.fire({
      icon: "warning",
      title: "Cancelar documento fiscal?",
      text: "Informe uma justificativa entre 15 e 255 caracteres.",
      input: "textarea",
      inputPlaceholder: "Ex.: Operação cancelada por solicitação do cliente...",
      inputAttributes: { minlength: "15", maxlength: "255" },
      showCancelButton: true,
      confirmButtonText: "Cancelar documento",
      cancelButtonText: "Voltar",
      preConfirm: (value) => {
        const v = String(value || "").trim();
        if (v.length < 15 || v.length > 255) {
          Swal.showValidationMessage("A justificativa precisa ter entre 15 e 255 caracteres.");
          return false;
        }
        return v;
      },
    });
    if (!result.isConfirmed) return;
    try {
      Swal.fire({ title: "Solicitando cancelamento...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const n = await api(`/fiscal/notas/${id}/cancelar`, {
        method: "POST",
        body: JSON.stringify({ justificativa: result.value }),
      });
      Swal.close();
      await Promise.all([carregarNotas(), carregarDashboard()]);
      notaAtual = n;
      renderDetalhe(n);
      Swal.fire({ icon: n.status === "CANCELADA" ? "success" : "info", title: statusInfo(n.status)[0], text: n.mensagemRetorno || "Solicitação enviada." });
    } catch (error) {
      Swal.close();
      mostrarErro(error, "Não foi possível cancelar o documento");
    }
  }

  async function cartaCorrecao(id) {
    const result = await Swal.fire({
      icon: "question",
      title: "Emitir Carta de Correção?",
      text: "Use a CC-e somente para dados permitidos. Ela não pode alterar imposto, emitente/destinatário ou data de emissão.",
      input: "textarea",
      inputPlaceholder: "Descreva objetivamente a correção...",
      inputAttributes: { minlength: "15", maxlength: "1000" },
      showCancelButton: true,
      confirmButtonText: "Emitir CC-e",
      cancelButtonText: "Voltar",
      preConfirm: (value) => {
        const v = String(value || "").trim();
        if (v.length < 15 || v.length > 1000) {
          Swal.showValidationMessage("A correção precisa ter entre 15 e 1000 caracteres.");
          return false;
        }
        return v;
      },
    });
    if (!result.isConfirmed) return;
    try {
      Swal.fire({ title: "Enviando Carta de Correção...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const n = await api(`/fiscal/notas/${id}/carta-correcao`, {
        method: "POST",
        body: JSON.stringify({ correcao: result.value }),
      });
      Swal.close();
      notaAtual = n;
      renderDetalhe(n);
      Swal.fire({ icon: "success", title: "Carta de Correção enviada", text: "O evento foi registrado no histórico fiscal." });
    } catch (error) {
      Swal.close();
      mostrarErro(error, "Não foi possível emitir a Carta de Correção");
    }
  }

  async function excluirNota(id) {
    const conf = await Swal.fire({
      icon: "warning",
      title: "Excluir este rascunho?",
      text: "Essa ação remove o documento fiscal interno e seus itens.",
      showCancelButton: true,
      confirmButtonText: "Excluir",
      cancelButtonText: "Voltar",
      confirmButtonColor: "#dc3545",
    });
    if (!conf.isConfirmed) return;
    try {
      await api(`/fiscal/notas/${id}`, { method: "DELETE" });
      modalDetalhe.hide();
      await Promise.all([carregarNotas(), carregarDashboard()]);
      Swal.fire({ icon: "success", title: "Rascunho excluído", timer: 1300, showConfirmButton: false });
    } catch (error) {
      mostrarErro(error, "Erro ao excluir o rascunho");
    }
  }

  async function verPayload(id) {
    try {
      const payload = await api(`/fiscal/notas/${id}/payload`);
      await Swal.fire({
        title: "Payload que será enviado",
        width: "900px",
        html: `<pre class="text-start p-3 bg-dark text-light rounded" style="max-height:60vh;overflow:auto;font-size:12px">${esc(JSON.stringify(payload, null, 2))}</pre>`,
        confirmButtonText: "Fechar",
      });
    } catch (error) {
      mostrarErro(error, "Erro ao montar payload");
    }
  }

  function ligarEventos() {
    $("btnNovaEmpresa").addEventListener("click", abrirNovaEmpresa);
    $("btnNovaNota").addEventListener("click", abrirNovaNota);
    $("formEmpresaFiscal").addEventListener("submit", salvarEmpresa);
    $("formNotaFiscal").addEventListener("submit", salvarNota);
    $("btnImportarProposta").addEventListener("click", importarProposta);
    $("btnAdicionarItemFiscal").addEventListener("click", () => adicionarItem());
    $("nfTipo").addEventListener("change", atualizarTipoNota);
    $("nfEmpresa").addEventListener("change", () => aplicarPadroesEmpresa());
    $("nfCliente").addEventListener("change", () => {
      const c = clientes.find((x) => x.clienteid === Number($("nfCliente").value));
      preencherDestinatario(c);
      document.querySelectorAll(".fiscal-item-card").forEach(aplicarPadraoItem);
    });
    $("nfDestEstado").addEventListener("change", () => document.querySelectorAll(".fiscal-item-card").forEach(aplicarPadraoItem));
    ["nfValorFrete", "nfValorSeguro", "nfValorDesconto", "nfValorOutras"].forEach((id) => $(id).addEventListener("input", calcularTotais));

    document.querySelectorAll("[data-fiscal-tab]").forEach((btn) => btn.addEventListener("click", () => {
      document.querySelectorAll("[data-fiscal-tab]").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".fiscal-tab-content").forEach((s) => s.classList.remove("active"));
      btn.classList.add("active");
      $(btn.dataset.fiscalTab === "empresas" ? "tabFiscalEmpresas" : "tabFiscalNotas").classList.add("active");
    }));

    let buscaTimer;
    $("buscaFiscal").addEventListener("input", () => {
      clearTimeout(buscaTimer);
      buscaTimer = setTimeout(() => carregarNotas().catch((e) => mostrarErro(e)), 350);
    });
    $("filtroTipoFiscal").addEventListener("change", () => carregarNotas().catch((e) => mostrarErro(e)));
    $("filtroStatusFiscal").addEventListener("change", () => carregarNotas().catch((e) => mostrarErro(e)));
    $("btnAtualizarFiscal").addEventListener("click", () => atualizarTudo());

    document.addEventListener("click", (event) => {
      const editarEmpresaBtn = event.target.closest("[data-editar-empresa]");
      if (editarEmpresaBtn) {
        event.stopPropagation();
        const e = empresas.find((x) => x.empresafiscalid === Number(editarEmpresaBtn.dataset.editarEmpresa));
        if (e) preencherEmpresa(e);
        return;
      }
      const removerEmpresaBtn = event.target.closest("[data-remover-empresa]");
      if (removerEmpresaBtn) {
        event.stopPropagation();
        removerEmpresa(removerEmpresaBtn.dataset.removerEmpresa);
        return;
      }
      const abrirNotaBtn = event.target.closest("[data-abrir-nota]");
      if (abrirNotaBtn) {
        abrirDetalheNota(abrirNotaBtn.dataset.abrirNota);
        return;
      }
      const editarNotaBtn = event.target.closest("[data-editar-nota]");
      if (editarNotaBtn) return void editarNota(editarNotaBtn.dataset.editarNota);
      const emitirBtn = event.target.closest("[data-emitir-nota]");
      if (emitirBtn) return void emitirNota(emitirBtn.dataset.emitirNota);
      const consultarBtn = event.target.closest("[data-consultar-nota]");
      if (consultarBtn) return void consultarNota(consultarBtn.dataset.consultarNota);
      const cancelarBtn = event.target.closest("[data-cancelar-nota]");
      if (cancelarBtn) return void cancelarNota(cancelarBtn.dataset.cancelarNota);
      const cartaBtn = event.target.closest("[data-carta-correcao]");
      if (cartaBtn) return void cartaCorrecao(cartaBtn.dataset.cartaCorrecao);
      const excluirBtn = event.target.closest("[data-excluir-nota]");
      if (excluirBtn) return void excluirNota(excluirBtn.dataset.excluirNota);
      const payloadBtn = event.target.closest("[data-ver-payload]");
      if (payloadBtn) return void verPayload(payloadBtn.dataset.verPayload);
    });
  }

  ligarEventos();
  atualizarTudo();
})();
