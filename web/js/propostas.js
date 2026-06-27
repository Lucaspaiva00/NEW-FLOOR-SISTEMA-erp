const token = JSON.parse(localStorage.getItem("usuarioLogado"))?.token;

const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));

if (!token) {
  window.location.href = "login.html";
}

const colunaPendente = document.getElementById("colunaPendente");
const colunaAprovada = document.getElementById("colunaAprovada");
const colunaExecutando = document.getElementById("colunaExecutando");
const colunaEspeciais = document.getElementById("colunaEspeciais");
const colunaFaturada = document.getElementById("colunaFaturada");
const colunasKanban = [
  colunaPendente,
  colunaAprovada,
  colunaExecutando,
  colunaEspeciais,
  colunaFaturada,
];

const clienteSelect = document.getElementById("clienteId");
const editarClienteSelect = document.getElementById("editarClienteId");
const listaItensProposta = document.getElementById("listaItensProposta");
const valorTotal = document.getElementById("valorTotal");
const pesquisaProposta = document.getElementById("pesquisaProposta");
const formNovaProposta = document.getElementById("formNovaProposta");
const formEditarProposta = document.getElementById("formEditarProposta");
const listaItensEditar = document.getElementById("listaItensEditar");
const btnSalvarNovaProposta = document.getElementById("btnSalvarNovaProposta");
const btnSalvarEditarProposta = document.getElementById(
  "btnSalvarEditarProposta",
);
const btnProximoNovaProposta = document.getElementById(
  "btnStepProximoNovaProposta",
);

let propostas = [];
let propostasCache = [];
let clientes = [];
let servicos = [];
let templateAtivo = null;
let sortableInstances = [];
let estaArrastando = false;
let carregandoModalProposta = false;

function setCardLoading(id, carregando) {
  document
    .querySelectorAll(`.proposal-card[data-id="${id}"]`)
    .forEach((card) => {
      card.classList.toggle("is-loading", carregando);
    });
}

const botoesAcaoEditarProposta = [
  document.getElementById("btnExcluirProposta"),
  document.getElementById("btnAdicionarServicoEditar"),
].filter(Boolean);

function setBotoesModalEditarProposta(carregando) {
  setLoading(btnSalvarEditarProposta, carregando, "Salvar alterações");
  botoesAcaoEditarProposta.forEach((btn) => {
    btn.disabled = carregando;
  });
}

const botoesAcaoNovaProposta = [
  btnProximoNovaProposta,
  document.getElementById("btnMockProposta"),
  document.getElementById("btnAdicionarServico"),
].filter(Boolean);

function setBotoesNovaProposta(carregando) {
  setLoading(btnSalvarNovaProposta, carregando, "Salvar proposta");
  botoesAcaoNovaProposta.forEach((btn) => {
    btn.disabled = carregando;
  });
  document
    .querySelectorAll("#stepsNavNovaProposta .step-pill")
    .forEach((pill) => {
      pill.disabled = carregando;
    });
}

async function carregarClientes() {
  try {
    const response = await fetch(`${API_URL}/clientes`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    clientes = await response.json();

    clienteSelect.innerHTML = "";
    editarClienteSelect.innerHTML = "";

    clientes.forEach((cliente) => {
      const option = `
                <option value="${cliente.clienteid}">
                    ${textoSeguro(cliente.nomeFantasia || cliente.razaoSocial)}
                </option>
            `;

      clienteSelect.innerHTML += option;
      editarClienteSelect.innerHTML += option;
    });
  } catch (error) {
    console.log(error);
    alert("Erro ao carregar clientes.");
  }
}

async function carregarServicos() {
  try {
    const response = await fetch(`${API_URL}/servicos`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    servicos = await response.json();
  } catch (error) {
    console.log(error);
    alert("Erro ao carregar serviços.");
  }
}

async function carregarTemplateAtivo() {
  try {
    const response = await fetch(`${API_URL}/templates`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return;
    }

    const templates = await response.json();
    templateAtivo =
      templates.find((template) => template.ativo) || templates[0] || null;
  } catch (error) {
    console.log(error);
  }
}

function textoObservacaoPorTipo(tipo) {
  if (!templateAtivo) {
    return "";
  }

  if (tipo === "SISTEMA") {
    return (
      templateAtivo.textoObservacaoSistema ||
      templateAtivo.textoObservacao ||
      ""
    );
  }

  return (
    templateAtivo.textoObservacaoServicos ||
    templateAtivo.textoObservacao ||
    ""
  );
}

function textoParaHtmlObservacao(texto) {
  if (!texto) {
    return "";
  }

  if (texto.trim().startsWith("<")) {
    return texto;
  }

  return `<p>${texto.replace(/\n/g, "<br>")}</p>`;
}

function tituloObservacaoPorTipo(tipo) {
  return tipo === "SISTEMA" ? "Observações Sistema" : "Observações Serviços";
}

function atualizarLabelObservacoes(tipo, labelId) {
  const label = document.getElementById(labelId);

  if (label) {
    label.textContent = tituloObservacaoPorTipo(tipo);
  }
}

function aplicarObservacaoPorTipo(tipo, campoId = "observacoes") {
  const labelId =
    campoId === "editarObservacoes"
      ? "labelEditarObservacoes"
      : "labelObservacoes";

  atualizarLabelObservacoes(tipo, labelId);
  definirDescricaoEditor(
    campoId,
    textoParaHtmlObservacao(textoObservacaoPorTipo(tipo)),
  );
}

function montarLoadingColunaKanban() {
  const numeroAleatorioDeCards = Math.floor(Math.random() * 3) + 1;
  let cards = "";
  for (let i = 0; i < numeroAleatorioDeCards; i++) {
    cards += `
            <div class="kanban-skeleton-card"></div>
        `;
  }
  return `
        <div class="kanban-list-loading" aria-live="polite">
            <div class="kanban-list-spinner"></div>
            <span>Carregando...</span>
        </div>
       ${cards}
    `;
}

function mostrarLoadingKanban() {
  colunasKanban.forEach((coluna) => {
    coluna.innerHTML = montarLoadingColunaKanban();
    coluna.classList.add("is-loading");
  });
}

function ocultarLoadingKanban() {
  colunasKanban.forEach((coluna) => {
    coluna.classList.remove("is-loading");
  });
}

async function carregarPropostas() {
  mostrarLoadingKanban();

  try {
    const response = await fetch(`${API_URL}/propostas`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    propostas = await response.json();
    propostasCache = propostas;

    renderizarKanban(obterListaFiltrada());
    atualizarKpis(obterListaFiltrada());
  } catch (error) {
    console.log(error);
    alert("Erro ao carregar propostas.");
    renderizarKanban([]);
    atualizarKpis([]);
  } finally {
    ocultarLoadingKanban();
  }
}

function atualizarKpis(lista) {
  const pendentes = lista.filter(
    (p) => p.status === "PENDENTE" || p.status === "RASCUNHO",
  ).length;
  const aprovadas = lista.filter((p) => p.status === "APROVADA").length;
  const executando = lista.filter((p) => p.status === "EXECUTANDO").length;
  const especiais = lista.filter((p) => p.status === "ESPECIAIS").length;
  const faturadas = lista.filter((p) => p.status === "FATURADA").length;

  document.getElementById("kpiPendentes").innerText = pendentes;
  document.getElementById("kpiAprovadas").innerText = aprovadas;
  document.getElementById("kpiExecutando").innerText = executando;
  document.getElementById("kpiEspeciais").innerText = especiais;
  document.getElementById("kpiFaturadas").innerText = faturadas;

  document.getElementById("countPendentes").innerText = pendentes;
  document.getElementById("countAprovadas").innerText = aprovadas;
  document.getElementById("countExecutando").innerText = executando;
  document.getElementById("countEspeciais").innerText = especiais;
  document.getElementById("countFaturadas").innerText = faturadas;
}

function classePrioridadeCard(prioridade) {
  const p = (prioridade || "").toLowerCase();
  if (p.includes("alta")) return "proposal-card--priority-alta";
  if (p.includes("média") || p.includes("media"))
    return "proposal-card--priority-media";
  return "";
}

function criarCardProposta(proposta) {
  const cliente =
    proposta.cliente?.nomeFantasia || proposta.cliente?.razaoSocial || "—";
  const vendedor = proposta.vendedor?.nome;
  const prioridadeClass = classePrioridadeCard(proposta.prioridade);
  const subtitulo = proposta.subtitulo?.trim();

  return `
        <div
            class="proposal-card ${prioridadeClass}"
            data-id="${proposta.propostaid}"
            data-status="${proposta.status}"
        >
            <div class="proposal-card-top">
                <span class="proposal-number">Proposta Nº ${textoSeguro(proposta.numero)}</span>
                <div class="dropdown proposal-card-menu">
                    <button
                        type="button"
                        class="proposal-card-menu-btn"
                        data-bs-toggle="dropdown"
                        data-bs-auto-close="true"
                        aria-expanded="false"
                        aria-label="Ações"
                        onclick="event.stopPropagation()"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <circle cx="12" cy="5" r="1.75"/>
                            <circle cx="12" cy="12" r="1.75"/>
                            <circle cx="12" cy="19" r="1.75"/>
                        </svg>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end proposal-card-dropdown">
                        <li>
                            <button type="button" class="dropdown-item proposal-card-dropdown-item" data-proposta-acao="editar">
                                <span class="proposal-card-dropdown-icon" aria-hidden="true">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M12 20h9"/>
                                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                                    </svg>
                                </span>
                                Editar
                            </button>
                        </li>
                        <li>
                            <button type="button" class="dropdown-item proposal-card-dropdown-item" data-proposta-acao="pdf">
                                <span class="proposal-card-dropdown-icon" aria-hidden="true">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                    </svg>
                                </span>
                                PDF
                            </button>
                        </li>
                        <li>
                            <button type="button" class="dropdown-item proposal-card-dropdown-item" data-proposta-acao="whatsapp">
                                <span class="proposal-card-dropdown-icon" aria-hidden="true">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>
                                    </svg>
                                </span>
                                WhatsApp
                            </button>
                        </li>
                        <li>
                            <button type="button" class="dropdown-item proposal-card-dropdown-item" data-proposta-acao="email">
                                <span class="proposal-card-dropdown-icon" aria-hidden="true">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect width="20" height="16" x="2" y="4" rx="2"/>
                                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                                    </svg>
                                </span>
                                E-mail
                            </button>
                        </li>
                    </ul>
                </div>
            </div>

            <h5 class="proposal-title">${textoSeguro(proposta.titulo)}</h5>

            ${
              subtitulo
                ? `<p class="proposal-subtitle">${textoSeguro(subtitulo)}</p>`
                : ""
            }

            <div class="proposal-meta">
                <div class="proposal-meta-item" title="Cliente">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M3 21h18"/>
                        <path d="M9 8h1"/>
                        <path d="M9 12h1"/>
                        <path d="M9 16h1"/>
                        <path d="M14 8h1"/>
                        <path d="M14 12h1"/>
                        <path d="M14 16h1"/>
                        <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
                    </svg>
                    <span>${textoSeguro(cliente)}</span>
                </div>
                ${
                  vendedor
                    ? `
                <div class="proposal-meta-item" title="Vendedor">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>${textoSeguro(vendedor)}</span>
                </div>`
                    : ""
                }
            </div>

            ${
              proposta.prioridade || proposta.origem
                ? `
            <div class="proposal-tags">
                ${
                  proposta.prioridade
                    ? `<span class="proposal-tag tag-prioridade">${textoSeguro(proposta.prioridade)}</span>`
                    : ""
                }
                ${
                  proposta.origem
                    ? `<span class="proposal-tag tag-origem">${textoSeguro(proposta.origem)}</span>`
                    : ""
                }
            </div>`
                : ""
            }

            <div class="proposal-card-bottom">
                <span class="proposal-value">${moeda(proposta.subtotal)}</span>
                <time class="proposal-date" datetime="${proposta.createdAt}">
                    ${new Date(proposta.createdAt).toLocaleDateString("pt-BR")}
                </time>
            </div>
        </div>
    `;
}

function renderizarKanban(lista) {
  colunaPendente.innerHTML = "";
  colunaAprovada.innerHTML = "";
  colunaExecutando.innerHTML = "";
  colunaEspeciais.innerHTML = "";
  colunaFaturada.innerHTML = "";

  lista.forEach((proposta) => {
    const card = criarCardProposta(proposta);

    if (proposta.status === "PENDENTE" || proposta.status === "RASCUNHO") {
      colunaPendente.innerHTML += card;
    }

    if (proposta.status === "APROVADA") {
      colunaAprovada.innerHTML += card;
    }

    if (proposta.status === "EXECUTANDO") {
      colunaExecutando.innerHTML += card;
    }

    if (proposta.status === "ESPECIAIS") {
      colunaEspeciais.innerHTML += card;
    }

    if (proposta.status === "FATURADA") {
      colunaFaturada.innerHTML += card;
    }
  });

  iniciarSortableKanban();
}

function iniciarSortableKanban() {
  sortableInstances.forEach((instance) => instance.destroy());
  sortableInstances = [];

  const listas = document.querySelectorAll(".kanban-list");

  listas.forEach((lista) => {
    const sortable = new Sortable(lista, {
      group: "propostas-kanban",
      animation: 150,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
      forceFallback: true,
      fallbackOnBody: true,
      fallbackClass: "kanban-fallback",
      fallbackTolerance: 3,
      scroll: true,
      bubbleScroll: true,
      swapThreshold: 0.65,
      emptyInsertThreshold: 8,
      filter: ".dropdown, .dropdown *",
      preventOnFilter: true,
      ghostClass: "kanban-ghost",
      chosenClass: "kanban-chosen",
      dragClass: "kanban-drag",

      onStart: function (evt) {
        estaArrastando = true;
        document.body.classList.add("kanban-is-dragging");

        const rect = evt.item.getBoundingClientRect();

        requestAnimationFrame(() => {
          const fallback = document.querySelector(".kanban-fallback");
          if (!fallback) return;

          fallback.style.width = `${rect.width}px`;
          fallback.style.boxSizing = "border-box";
        });
      },

      onEnd: async function (evt) {
        document.body.classList.remove("kanban-is-dragging");

        setTimeout(() => {
          estaArrastando = false;
        }, 150);

        if (evt.from === evt.to) return;

        const propostaId = evt.item.dataset.id;
        const statusAnterior = evt.item.dataset.status;
        const novoStatus = evt.to.dataset.status;

        if (!propostaId || !novoStatus) return;
        if (statusAnterior === novoStatus) return;

        const ok = await atualizarStatusProposta(propostaId, novoStatus);

        if (!ok) {
          renderizarKanban(obterListaFiltrada());
          alert("Erro ao atualizar status da proposta.");
          return;
        }

        const proposta = propostasCache.find(
          (p) => Number(p.propostaid) === Number(propostaId),
        );

        if (proposta) {
          proposta.status = novoStatus;
        }

        propostas = propostasCache;
        const lista = obterListaFiltrada();
        // renderizarKanban(lista);
        atualizarKpis(lista);
      },
    });

    sortableInstances.push(sortable);
  });
}

async function atualizarStatusProposta(id, status) {
  const response = await fetch(`${API_URL}/propostas/${id}`, {
    method: "PUT",

    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },

    body: JSON.stringify({
      status,
    }),
  });

  return response.ok;
}

function obterListaFiltrada() {
  const termo = pesquisaProposta.value.toLowerCase().trim();

  if (!termo) return propostasCache;

  return propostasCache.filter((proposta) => {
    return (
      proposta.titulo?.toLowerCase().includes(termo) ||
      proposta.numero?.toLowerCase().includes(termo) ||
      (proposta.cliente?.nomeFantasia || proposta.cliente?.razaoSocial || "")
        .toLowerCase()
        .includes(termo) ||
      proposta.descricao?.toLowerCase().includes(termo) ||
      proposta.status?.toLowerCase().includes(termo) ||
      (proposta.vendedor?.nome || "").toLowerCase().includes(termo) ||
      proposta.origem?.toLowerCase().includes(termo)
    );
  });
}

function calcularValorUnitarioServico(servico) {
  const custo = Number(servico?.custo || 0);
  const margem = Number(servico?.margemLucro || 0);

  if (!custo) return 0;

  return Number((custo * (1 + margem / 100)).toFixed(2));
}

function montarOptionsServicos(servicoSelecionado = "") {
  return servicos
    .map((servico) => {
      const selected =
        Number(servicoSelecionado) === Number(servico.servicoid)
          ? "selected"
          : "";

      return `
            <option
                value="${servico.servicoid}"
                data-codigo="${textoSeguro(servico.codigo || "")}"
                data-nome="${textoSeguro(servico.nome || "")}"
                data-descricao="${textoSeguro(servico.descricao || servico.nome || "")}"
                data-unidade="${textoSeguro(servico.unidade || "UN")}"
                ${selected}
            >
                ${textoSeguro(servico.nome)}
            </option>
        `;
    })
    .join("");
}

function adicionarItemProposta(item = null) {
  const index = document.querySelectorAll(".item-servico").length + 1;

  const servicoId = item?.servicoId || item?.servico?.servicoid || "";
  const descricao =
    item?.descricao && item.descricao !== "-"
      ? item.descricao
      : item?.servico?.descricao || "";
  const quantidade = item?.quantidade || 1;
  const valorUnitario = Number(item?.valorUnitario) || 0;
  const desconto = Number(item?.desconto) || 0;
  const acrescimo = Number(item?.acrescimo) || 0;
  const subtotal = Number(item?.subtotal) || 0;

  const html = `
        <div class="item-servico">

            <div class="item-title">
                <strong>Item ${index}</strong>

                <button type="button" class="btn-remove-item">
                    X
                </button>
            </div>

            <div class="row">

                <div class="col-md-5 mb-3">
                    <label>Serviço</label>
                    <select class="form-control premium-input-light servico-select">
                        ${montarOptionsServicos(servicoId)}
                    </select>
                </div>

                <div class="col-md-3 mb-3">
                    <label>Código</label>
                    <input type="text" class="form-control premium-input-light item-codigo"
                        value="${textoSeguro(item?.codigo || "")}">
                </div>

                <div class="col-md-2 mb-3">
                    <label>Unidade</label>
                    <input type="text" class="form-control premium-input-light item-unidade"
                        value="${textoSeguro(item?.unidade || "UN")}">
                </div>

                <div class="col-md-2 mb-3">
                    <label>Ordem</label>
                    <input type="number" class="form-control premium-input-light item-ordem"
                        value="${item?.ordem || index}">
                </div>

                <div class="col-md-12 mb-3">
                    <label>Descrição</label>
                    <div class="editor-descricao item-descricao-editor"></div>
                    <textarea class="d-none item-descricao" aria-hidden="true"></textarea>
                </div>

                <div class="col-md-12 mb-3 mt-8">
                    <label>Detalhes</label>
                    <textarea class="form-control premium-input-light textarea-premium item-detalhes">${item?.detalhes || ""}</textarea>
                </div>

                <div class="col-md-2 mb-3">
                    <label>Quantidade</label>
                    <input type="number" step="0.01" min="0" class="form-control premium-input-light item-quantidade"
                        value="${quantidade}">
                </div>

                <div class="col-md-2 mb-3">
                    <label>Valor unitário</label>
                    <input type="number" step="0.01" min="0" class="form-control premium-input-light item-valor"
                        value="${valorUnitario}">
                </div>

                <div class="col-md-2 mb-3">
                    <label>Desconto</label>
                    <input type="number" step="0.01" min="0" class="form-control premium-input-light item-desconto"
                        value="${desconto}">
                </div>

                <div class="col-md-2 mb-3">
                    <label>Acréscimo</label>
                    <input type="number" step="0.01" min="0" class="form-control premium-input-light item-acrescimo"
                        value="${acrescimo}">
                </div>

                <div class="col-md-4 mb-3">
                    <label>Subtotal</label>
                    <input type="number" step="0.01" class="form-control premium-input-light item-subtotal"
                        value="${subtotal}">
                </div>

                <div class="col-md-12 mb-3">
                    <label>Observações do item</label>
                    <textarea class="form-control premium-input-light textarea-premium item-observacoes">${item?.observacoes || ""}</textarea>
                </div>

            </div>

        </div>
    `;

  listaItensProposta.insertAdjacentHTML("beforeend", html);

  const novoItem = listaItensProposta.lastElementChild;
  const select = novoItem.querySelector(".servico-select");

  novoItem.querySelector(".item-descricao").value = descricao;
  inicializarEditorItemDescricao(novoItem);

  if (!item) {
    preencherItemComServico(select);
  }
}

function adicionarItemEditar(item = null) {
  const index = document.querySelectorAll(".item-servico").length + 1;

  const servicoId = item?.servicoId || item?.servico?.servicoid || "";

  const codigo =
    item?.codigo && item.codigo !== "-"
      ? item.codigo
      : item?.servico?.codigo || "";

  const descricao =
    item?.descricao && item.descricao !== "-"
      ? item.descricao
      : item?.servico?.descricao || "";

  const unidade =
    item?.unidade && item.unidade !== "UN"
      ? item.unidade
      : item?.servico?.unidade || "UN";

  const valorUnitario = Number(item?.valorUnitario) || 0;

  const quantidade = Number(item?.quantidade) || 1;
  const desconto = Number(item?.desconto) || 0;
  const acrescimo = Number(item?.acrescimo) || 0;
  const subtotal = Number(item?.subtotal) || 0;

  const html = `
        <div class="item-servico">

            <div class="item-title">
                <strong>Item ${index}</strong>

                <button type="button" class="btn-remove-item">
                    X
                </button>
            </div>

            <div class="row">

                <div class="col-md-5 mb-3">
                    <label>Serviço</label>
                    <select class="form-control premium-input-light servico-select">
                        ${montarOptionsServicos(servicoId)}
                    </select>
                </div>

                <div class="col-md-3 mb-3">
                    <label>Código</label>
                    <input
                        type="text"
                        class="form-control premium-input-light item-codigo"
                        value="${textoSeguro(codigo)}"
                    >
                </div>

                <div class="col-md-2 mb-3">
                    <label>Unidade</label>
                    <input
                        type="text"
                        class="form-control premium-input-light item-unidade"
                        value="${textoSeguro(unidade)}"
                    >
                </div>

                <div class="col-md-2 mb-3">
                    <label>Ordem</label>
                    <input
                        type="number"
                        class="form-control premium-input-light item-ordem"
                        value="${item?.ordem || index}"
                    >
                </div>

                <div class="col-md-12 mb-3">
                    <label>Descrição</label>
                    <div class="editor-descricao item-descricao-editor"></div>
                    <textarea class="d-none item-descricao" aria-hidden="true"></textarea>
                </div>

                <div class="col-md-12 mb-3 mt-8">
                    <label>Detalhes</label>
                    <textarea class="form-control premium-input-light textarea-premium item-detalhes">${item?.detalhes || ""}</textarea>
                </div>

                <div class="col-md-2 mb-3">
                    <label>Quantidade</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        class="form-control premium-input-light item-quantidade"
                        value="${quantidade}"
                    >
                </div>

                <div class="col-md-2 mb-3">
                    <label>Valor unitário</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        class="form-control premium-input-light item-valor"
                        value="${valorUnitario}"
                    >
                </div>

                <div class="col-md-2 mb-3">
                    <label>Desconto</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        class="form-control premium-input-light item-desconto"
                        value="${desconto}"
                    >
                </div>

                <div class="col-md-2 mb-3">
                    <label>Acréscimo</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        class="form-control premium-input-light item-acrescimo"
                        value="${acrescimo}"
                    >
                </div>

                <div class="col-md-4 mb-3">
                    <label>Subtotal</label>
                    <input
                        type="number"
                        step="0.01"
                        class="form-control premium-input-light item-subtotal"
                        value="${subtotal}"
                    >
                </div>

                <div class="col-md-12 mb-3">
                    <label>Observações do item</label>
                    <textarea class="form-control premium-input-light textarea-premium item-observacoes">${item?.observacoes || ""}</textarea>
                </div>

            </div>

        </div>
    `;

  listaItensEditar.insertAdjacentHTML("beforeend", html);

  const novoItem = listaItensEditar.lastElementChild;

  const select = novoItem.querySelector(".servico-select");

  novoItem.querySelector(".item-descricao").value = descricao;
  inicializarEditorItemDescricao(novoItem);

  if (!item) {
    preencherItemComServico(select);
  } else {
    calcularSubtotalItem(novoItem);
  }
}

function preencherItemComServico(select) {
  const item = select.closest(".item-servico");

  const option = select.options[select.selectedIndex];

  if (!option) return;

  item.querySelector(".item-codigo").value = option.dataset.codigo || "";

  const servico = servicos.find(
    (s) => Number(s.servicoid) === Number(select.value),
  );

  definirDescricaoEditorItem(
    item,
    servico?.descricao || option.dataset.nome || "",
  );

  item.querySelector(".item-unidade").value = option.dataset.unidade || "UN";

  item.querySelector(".item-valor").value =
    calcularValorUnitarioServico(servico);

  calcularSubtotalItem(item);
}

document.getElementById("btnAdicionarServico").addEventListener("click", () => {
  if (servicos.length === 0) {
    alert("Cadastre um serviço antes de criar uma proposta.");
    return;
  }

  adicionarItemProposta();
});

document
  .getElementById("btnAdicionarServicoEditar")
  ?.addEventListener("click", () => {
    if (servicos.length === 0) {
      alert("Cadastre um serviço antes de criar uma proposta.");

      return;
    }

    adicionarItemEditar();
  });

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-remove-item")) {
    e.target.closest(".item-servico").remove();

    document.querySelectorAll(".item-servico").forEach((item, index) => {
      const titulo = item.querySelector(".item-title strong");

      if (titulo) {
        titulo.textContent = `Item ${index + 1}`;
      }
    });
  }
});

document.addEventListener("change", (e) => {
  if (e.target.classList.contains("servico-select")) {
    preencherItemComServico(e.target);
  }
});

function calcularSubtotalItem(item) {
  const quantidade = Number(item.querySelector(".item-quantidade")?.value || 0);
  const valorUnitario = Number(item.querySelector(".item-valor")?.value || 0);
  const desconto = Number(item.querySelector(".item-desconto")?.value || 0);
  const acrescimo = Number(item.querySelector(".item-acrescimo")?.value || 0);

  const subtotal = quantidade * valorUnitario - desconto + acrescimo;

  const campoSubtotal = item.querySelector(".item-subtotal");

  if (campoSubtotal) {
    campoSubtotal.value = subtotal.toFixed(2);
  }
}

document.addEventListener("input", (e) => {
  if (
    e.target.classList.contains("item-quantidade") ||
    e.target.classList.contains("item-valor") ||
    e.target.classList.contains("item-desconto") ||
    e.target.classList.contains("item-acrescimo")
  ) {
    const item = e.target.closest(".item-servico");

    if (item) {
      calcularSubtotalItem(item);
    }
  }
});

let vendedoresCache = [];

async function carregarVendedores() {
  try {
    const response = await fetch(`${API_URL}/vendedores`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    vendedoresCache = await response.json();

    preencherSelectVendedores();
  } catch (error) {
    console.log(error);
  }
}

function preencherSelectVendedores() {
  const selectNovo = document.getElementById("vendedor");

  const selectEditar = document.getElementById("editarVendedor");

  if (selectNovo) {
    selectNovo.innerHTML = `
            <option value="">
                Selecione um vendedor
            </option>
        `;

    vendedoresCache.forEach((vendedor) => {
      selectNovo.innerHTML += `
                <option value="${vendedor.vendedorid}">
                    ${vendedor.nome}
                </option>
            `;
    });
  }

  if (selectEditar) {
    selectEditar.innerHTML = `
            <option value="">
                Selecione um vendedor
            </option>
        `;

    vendedoresCache.forEach((vendedor) => {
      selectEditar.innerHTML += `
                <option value="${vendedor.vendedorid}">
                    ${vendedor.nome}
                </option>
            `;
    });
  }
}

function montarItens() {
  sincronizarEditoresItemDescricao(listaItensProposta);
  const itens = [];

  const itensDOM = document.querySelectorAll(
    "#listaItensProposta .item-servico",
  );

  itensDOM.forEach((item, index) => {
    const select = item.querySelector(".servico-select");

    itens.push({
      codigo: item.querySelector(".item-codigo")?.value || `ITEM-${index + 1}`,

      descricao: item.querySelector(".item-descricao")?.value || "",

      detalhes: item.querySelector(".item-detalhes")?.value || null,

      unidade: item.querySelector(".item-unidade")?.value || "UN",

      quantidade: Number(item.querySelector(".item-quantidade")?.value || 0),

      valorUnitario: Number(item.querySelector(".item-valor")?.value || 0),

      desconto: Number(item.querySelector(".item-desconto")?.value || 0),

      acrescimo: Number(item.querySelector(".item-acrescimo")?.value || 0),

      subtotal: Number(item.querySelector(".item-subtotal")?.value || 0),

      ordem: Number(item.querySelector(".item-ordem")?.value || index + 1),

      observacoes: item.querySelector(".item-observacoes")?.value || null,

      servicoId: select?.value ? Number(select.value) : null,
    });
  });

  return itens;
}

function validarValorItens(itens) {
  const itemInvalido = itens.find(
    (item) => !item.valorUnitario || Number(item.valorUnitario) <= 0,
  );

  if (itemInvalido) {
    toastErro("Informe o valor unitário de todos os itens.");
    return false;
  }

  return true;
}

function montarItensEditar() {
  sincronizarEditoresItemDescricao(listaItensEditar);
  const itens = [];

  const itensDOM = listaItensEditar.querySelectorAll(".item-servico");

  itensDOM.forEach((item, index) => {
    const select = item.querySelector(".servico-select");

    itens.push({
      codigo: item.querySelector(".item-codigo")?.value || `ITEM-${index + 1}`,

      descricao: item.querySelector(".item-descricao")?.value || "",

      detalhes: item.querySelector(".item-detalhes")?.value || null,

      unidade: item.querySelector(".item-unidade")?.value || "UN",

      quantidade: Number(item.querySelector(".item-quantidade")?.value || 0),

      valorUnitario: Number(item.querySelector(".item-valor")?.value || 0),

      desconto: Number(item.querySelector(".item-desconto")?.value || 0),

      acrescimo: Number(item.querySelector(".item-acrescimo")?.value || 0),

      subtotal: Number(item.querySelector(".item-subtotal")?.value || 0),

      ordem: Number(item.querySelector(".item-ordem")?.value || index + 1),

      observacoes: item.querySelector(".item-observacoes")?.value || null,

      servicoId: select?.value ? Number(select.value) : null,
    });
  });

  return itens;
}

function atualizarTotalProposta() {
  const frete = Number(pegarValor("frete") || 0);
  let totalItens = 0;

  document
    .querySelectorAll("#listaItensProposta .item-servico")
    .forEach((item) => {
      totalItens += Number(item.querySelector(".item-subtotal")?.value || 0);
    });

  if (valorTotal) {
    valorTotal.innerText = moeda(totalItens + frete);
  }
}

function preencherPropostaMock() {
  const sufixo = Date.now().toString().slice(-4);

  preencherCampo("titulo", `Proposta Mock ${sufixo}`);
  preencherCampo("subtitulo", "Serviços de piso industrial");
  preencherCampo("descricao", "Proposta gerada automaticamente para testes.");
  preencherCampo(
    "escopo",
    "Aplicação de revestimento epóxi em área industrial.",
  );
  preencherCampo("status", "PENDENTE");
  preencherCampo("prioridade", "Média");

  if (clienteSelect?.options.length > 0) {
    clienteSelect.selectedIndex = 0;
  }

  const nomeResponsavel =
    usuarioLogado?.usuario?.nome || usuarioLogado?.nome || "Responsável Mock";

  preencherCampo("responsavel", nomeResponsavel);

  const vendedorSelect = document.getElementById("vendedor");

  if (vendedorSelect?.options.length > 1) {
    vendedorSelect.selectedIndex = 1;
  }

  preencherCampo("origem", "Teste interno");
  preencherCampo("etapaAtual", "Orçamento");
  preencherCampo("assinaturaCliente", "");
  preencherCampo("validadeDias", "30");

  const validade = new Date();
  validade.setDate(validade.getDate() + 30);
  preencherCampo("dataValidade", validade.toISOString().split("T")[0]);

  preencherCampo("frete", "150");
  preencherCampo("formaPagamento", "Boleto");
  preencherCampo("condicoesPagamento", "50% entrada + 50% na entrega");

  listaItensProposta.innerHTML = "";

  if (servicos.length > 0) {
    adicionarItemProposta();
  } else {
    alert("Cadastre um serviço para incluir item mock.");
  }

  preencherCampo("observacoesInternas", "Gerada via botão Preencher mock.");
  preencherCampo("tipoProposta", "SERVICOS");
  aplicarObservacaoPorTipo("SERVICOS", "observacoes");

  preencherCheckbox("aprovadoCliente", false);
  preencherCheckbox("enviadoEmail", false);
  preencherCheckbox("enviadoWhatsapp", false);
  preencherCheckbox("visualizada", false);

  atualizarTotalProposta();
}

function montarBodyNovaProposta() {
  sincronizarEditoresDescricao();
  const itens = montarItens();

  return {
    titulo: pegarValor("titulo"),

    subtitulo: pegarValor("subtitulo"),

    tipoProposta: pegarValor("tipoProposta") || "SERVICOS",

    descricao: pegarValor("descricao"),

    escopo: pegarValor("escopo"),

    observacoes: pegarValor("observacoes"),

    observacoesInternas: pegarValor("observacoesInternas"),

    status: pegarValor("status") || "RASCUNHO",

    prioridade: pegarValor("prioridade"),

    frete: pegarNumero("frete"),

    formaPagamento: pegarValor("formaPagamento"),

    condicoesPagamento: pegarValor("condicoesPagamento"),

    validadeDias: pegarInteiro("validadeDias"),

    dataValidade: pegarValor("dataValidade"),

    dataAprovacao: pegarValor("dataAprovacao"),

    dataRecusa: pegarValor("dataRecusa"),

    motivoRecusa: pegarValor("motivoRecusa"),

    responsavel: pegarValor("responsavel"),

    origem: pegarValor("origem"),

    assinaturaCliente: pegarValor("assinaturaCliente"),

    aprovadoCliente: pegarCheckbox("aprovadoCliente"),

    enviadoEmail: pegarCheckbox("enviadoEmail"),

    enviadoWhatsapp: pegarCheckbox("enviadoWhatsapp"),

    visualizada: pegarCheckbox("visualizada"),

    clienteId: Number(pegarValor("clienteId")),

    vendedorId: pegarValor("vendedor") ? Number(pegarValor("vendedor")) : null,

    itens,
  };
}

formNovaProposta.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    const body = montarBodyNovaProposta();

    if (!body.titulo) {
      toastErro("Informe o título da proposta.");
      return;
    }

    if (!body.clienteId) {
      toastErro("Selecione um cliente.");
      return;
    }

    if (!body.itens || body.itens.length === 0) {
      toastErro("Adicione pelo menos um item na proposta.");
      return;
    }

    if (!validarValorItens(body.itens)) {
      return;
    }

    setBotoesNovaProposta(true);

    const response = await fetch(`${API_URL}/propostas`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify(body),
    });

    const resposta = await response.json();

    if (!response.ok) {
      console.log(resposta);
      toastErro(resposta.error || "Erro ao criar proposta.");
      return;
    }

    bootstrap.Modal.getInstance(
      document.getElementById("modalNovaProposta"),
    ).hide();

    formNovaProposta.reset();

    limparDescricaoEditor("observacoes");
    listaItensProposta.innerHTML = "";
    valorTotal.innerText = moeda(0);

    toastSucesso("Proposta criada com sucesso");

    await carregarPropostas();
  } catch (error) {
    console.log(error);
    toastErro("Erro ao criar proposta.");
  } finally {
    setBotoesNovaProposta(false);
  }
});

async function abrirModalProposta(id) {
  if (estaArrastando || carregandoModalProposta) return;

  carregandoModalProposta = true;
  setCardLoading(id, true);

  try {
    const response = await fetch(`${API_URL}/propostas/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      toastErro("Erro ao buscar proposta.");
      return;
    }

    const proposta = await response.json();

    preencherCampo("editarId", proposta.propostaid);
    preencherCampo("editarNumero", proposta.numero);
    preencherCampo("editarTitulo", proposta.titulo);
    preencherCampo("editarClienteId", proposta.clienteId);
    preencherCampo("editarVendedor", proposta.vendedorId);
    preencherCampo("editarSubtitulo", proposta.subtitulo);
    preencherCampo("editarTipoProposta", proposta.tipoProposta || "SERVICOS");
    atualizarLabelObservacoes(
      proposta.tipoProposta || "SERVICOS",
      "labelEditarObservacoes",
    );
    preencherCampo("editarStatus", proposta.status);
    preencherCampo("editarPrioridade", proposta.prioridade);
    preencherCampo("editarDescricao", proposta.descricao);
    preencherCampo("editarEscopo", proposta.escopo);
    preencherCampo("editarResponsavel", proposta.responsavel);
    preencherCampo("editarOrigem", proposta.origem);
    preencherCampo("editarAssinaturaCliente", proposta.assinaturaCliente);

    preencherCampo("editarDataValidade", dataInput(proposta.dataValidade));

    preencherCampo("editarDataAprovacao", dataInput(proposta.dataAprovacao));

    preencherCampo("editarDataRecusa", dataInput(proposta.dataRecusa));

    preencherCampo("editarValidadeDias", proposta.validadeDias);

    preencherCampo("editarFrete", proposta.frete);

    preencherCampo("editarFormaPagamento", proposta.formaPagamento);

    preencherCampo("editarCondicoesPagamento", proposta.condicoesPagamento);

    definirDescricaoEditor("editarObservacoes", proposta.observacoes);

    preencherCampo("editarObservacoesInternas", proposta.observacoesInternas);

    preencherCampo("editarMotivoRecusa", proposta.motivoRecusa);

    preencherCheckbox("editarAprovadoCliente", proposta.aprovadoCliente);

    preencherCheckbox("editarEnviadoEmail", proposta.enviadoEmail);

    preencherCheckbox("editarEnviadoWhatsapp", proposta.enviadoWhatsapp);

    preencherCheckbox("editarVisualizada", proposta.visualizada);

    /* =====================================
           CARREGA ITENS DA PROPOSTA
        ===================================== */

    listaItensEditar.innerHTML = "";

    if (proposta.itens && proposta.itens.length) {
      proposta.itens.forEach((item) => {
        adicionarItemEditar(item);
      });
    }

    const modal = new bootstrap.Modal(document.getElementById("modalProposta"));

    modal.show();
  } catch (error) {
    console.log(error);

    toastErro("Erro ao abrir proposta.");
  } finally {
    setCardLoading(id, false);
    carregandoModalProposta = false;
  }
}

function montarBodyEditarProposta() {
  sincronizarEditoresDescricao();

  return {
    numero: pegarValor("editarNumero"),

    titulo: pegarValor("editarTitulo"),

    subtitulo: pegarValor("editarSubtitulo"),

    tipoProposta: pegarValor("editarTipoProposta") || "SERVICOS",

    descricao: pegarValor("editarDescricao"),

    escopo: pegarValor("editarEscopo"),

    observacoes: pegarValor("editarObservacoes"),

    observacoesInternas: pegarValor("editarObservacoesInternas"),

    status: pegarValor("editarStatus"),

    prioridade: pegarValor("editarPrioridade"),

    subtotal: pegarNumero("editarSubtotal"),

    frete: pegarNumero("editarFrete"),

    formaPagamento: pegarValor("editarFormaPagamento"),

    condicoesPagamento: pegarValor("editarCondicoesPagamento"),

    validadeDias: pegarInteiro("editarValidadeDias"),

    dataValidade: pegarValor("editarDataValidade"),

    dataAprovacao: pegarValor("editarDataAprovacao"),

    dataRecusa: pegarValor("editarDataRecusa"),

    motivoRecusa: pegarValor("editarMotivoRecusa"),

    responsavel: pegarValor("editarResponsavel"),

    origem: pegarValor("editarOrigem"),

    assinaturaCliente: pegarValor("editarAssinaturaCliente"),

    aprovadoCliente: pegarCheckbox("editarAprovadoCliente"),

    enviadoEmail: pegarCheckbox("editarEnviadoEmail"),

    enviadoWhatsapp: pegarCheckbox("editarEnviadoWhatsapp"),

    visualizada: pegarCheckbox("editarVisualizada"),

    clienteId: Number(pegarValor("editarClienteId")),

    vendedorId: pegarValor("editarVendedor")
      ? Number(pegarValor("editarVendedor"))
      : null,

    itens: montarItensEditar(),
  };
}

formEditarProposta.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    const id = pegarValor("editarId");

    if (!id) {
      alert("Proposta inválida.");
      return;
    }

    const body = montarBodyEditarProposta();
    if (!body.itens || body.itens.length === 0) {
      alert("Adicione pelo menos um item na proposta antes de salvar.");
      return;
    }

    if (!validarValorItens(body.itens)) {
      return;
    }

    setBotoesModalEditarProposta(true);

    const response = await fetch(`${API_URL}/propostas/${id}`, {
      method: "PUT",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify(body),
    });

    const resposta = await response.json();

    if (!response.ok) {
      console.log(resposta);
      alert(resposta.error || "Erro ao atualizar proposta.");
      return;
    }

    bootstrap.Modal.getInstance(
      document.getElementById("modalProposta"),
    ).hide();

    toastSucesso("Proposta atualizada com sucesso");

    await carregarPropostas();
  } catch (error) {
    console.log(error);
    alert("Erro ao atualizar proposta.");
  } finally {
    setBotoesModalEditarProposta(false);
  }
});

document
  .getElementById("btnExcluirProposta")
  .addEventListener("click", async () => {
    try {
      const id = pegarValor("editarId");

      if (!id) {
        alert("Proposta inválida.");
        return;
      }

      const confirmar = confirm("Deseja excluir esta proposta?");

      if (!confirmar) return;

      const response = await fetch(`${API_URL}/propostas/${id}`, {
        method: "DELETE",

        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const resposta = await response.json();

      if (!response.ok) {
        console.log(resposta);
        alert(resposta.error || "Erro ao excluir proposta.");
        return;
      }

      bootstrap.Modal.getInstance(
        document.getElementById("modalProposta"),
      ).hide();

      await carregarPropostas();
    } catch (error) {
      console.log(error);
      alert("Erro ao excluir proposta.");
    }
  });

pesquisaProposta.addEventListener("input", () => {
  const filtradas = obterListaFiltrada();
  renderizarKanban(filtradas);
  atualizarKpis(filtradas);
});

const TOTAL_STEPS_NOVA_PROPOSTA = 4;

function validarStepNovaProposta(step) {
  if (step !== 1) return true;

  if (!pegarValor("titulo")) {
    toastErro("Informe o título da proposta.");
    return false;
  }

  if (!pegarValor("clienteId")) {
    toastErro("Selecione um cliente.");
    return false;
  }

  return true;
}

function criarWizardProposta({
  form,
  modal,
  nav,
  btnProximo,
  btnSalvar,
  totalSteps,
  validarStep,
}) {
  let stepAtual = 1;

  function atualizarBotoes() {
    btnProximo?.classList.toggle("d-none", stepAtual === totalSteps);
    btnSalvar?.classList.toggle("d-none", stepAtual !== totalSteps);
  }

  function irParaStep(step) {
    stepAtual = Math.max(1, Math.min(totalSteps, step));

    form.querySelectorAll(".form-step").forEach((elemento) => {
      elemento.classList.toggle(
        "active",
        Number(elemento.dataset.step) === stepAtual,
      );
    });

    nav?.querySelectorAll(".step-pill").forEach((pill) => {
      const numero = Number(pill.dataset.step);

      pill.classList.toggle("active", numero === stepAtual);
      pill.classList.toggle("done", numero < stepAtual);
    });

    atualizarBotoes();
  }

  btnProximo?.addEventListener("click", () => {
    if (!validarStep(stepAtual)) return;

    irParaStep(stepAtual + 1);
  });

  nav?.querySelectorAll(".step-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const destino = Number(pill.dataset.step);

      if (destino <= stepAtual) {
        irParaStep(destino);
        return;
      }

      if (validarStep(stepAtual)) {
        irParaStep(destino);
      }
    });
  });

  modal?.addEventListener("hidden.bs.modal", () => {
    irParaStep(1);
  });

  irParaStep(1);

  return { irParaStep };
}

document.getElementById("btnMockProposta")?.addEventListener("click", () => {
  preencherPropostaMock();
});

const wizardNovaProposta = criarWizardProposta({
  form: formNovaProposta,
  modal: document.getElementById("modalNovaProposta"),
  nav: document.getElementById("stepsNavNovaProposta"),
  btnProximo: document.getElementById("btnStepProximoNovaProposta"),
  btnSalvar: document.getElementById("btnSalvarNovaProposta"),
  totalSteps: TOTAL_STEPS_NOVA_PROPOSTA,
  validarStep: validarStepNovaProposta,
});

async function iniciarTela() {
  mostrarLoadingKanban();
  await carregarClientes();
  await carregarServicos();
  await carregarTemplateAtivo();
  await carregarPropostas();

  inicializarEditorDescricao(
    "editorObservacoes",
    "observacoes",
    "Insira as observações internas",
  );
  inicializarEditorDescricao(
    "editorEditarObservacoes",
    "editarObservacoes",
    "Insira as observações internas",
  );

  document.getElementById("modalNovaProposta")?.addEventListener(
    "shown.bs.modal",
    () => {
      preencherCampo("tipoProposta", "SERVICOS");
      aplicarObservacaoPorTipo("SERVICOS", "observacoes");
    },
  );

  document.getElementById("tipoProposta")?.addEventListener("change", (e) => {
    aplicarObservacaoPorTipo(e.target.value, "observacoes");
  });

  document.getElementById("editarTipoProposta")?.addEventListener(
    "change",
    (e) => {
      aplicarObservacaoPorTipo(e.target.value, "editarObservacoes");
    },
  );

  const nomeResponsavel =
    usuarioLogado?.usuario?.nome || usuarioLogado?.nome || "";

  const responsavel = document.getElementById("responsavel");

  if (responsavel && nomeResponsavel) {
    responsavel.value = nomeResponsavel;
  }
}

iniciarTela();
carregarVendedores();
