const API_URL = "https://new-floor-sistema-erp.onrender.com";

const token = JSON.parse(
    localStorage.getItem("usuarioLogado")
)?.token;

const usuarioLogado = JSON.parse(
    localStorage.getItem("usuarioLogado")
);

if (!token) {
    window.location.href = "login.html";
}

const colunaPendente = document.getElementById("colunaPendente");
const colunaAprovada = document.getElementById("colunaAprovada");
const colunaExecutando = document.getElementById("colunaExecutando");
const colunaFaturada = document.getElementById("colunaFaturada");

const clienteSelect = document.getElementById("clienteId");
const editarClienteSelect = document.getElementById("editarClienteId");
const listaItensProposta = document.getElementById("listaItensProposta");
const valorTotal = document.getElementById("valorTotal");
const pesquisaProposta = document.getElementById("pesquisaProposta");
const formNovaProposta = document.getElementById("formNovaProposta");
const formEditarProposta = document.getElementById("formEditarProposta");
const listaItensEditar = document.getElementById("listaItensEditar");

let propostas = [];
let propostasCache = [];
let clientes = [];
let servicos = [];
let sortableInstances = [];
let estaArrastando = false;

function pegarValor(id) {
    const elemento = document.getElementById(id);

    if (!elemento) return null;

    const valor = elemento.value;

    if (valor === undefined || valor === null) return null;

    const tratado = String(valor).trim();

    return tratado === "" ? null : tratado;
}

function pegarNumero(id) {
    const valor = pegarValor(id);

    if (!valor) return null;

    const numero = Number(String(valor).replace(",", "."));

    return Number.isNaN(numero) ? null : numero;
}

function pegarInteiro(id) {
    const valor = pegarValor(id);

    if (!valor) return null;

    const numero = Number(valor);

    return Number.isNaN(numero) ? null : numero;
}

function pegarCheckbox(id) {
    const elemento = document.getElementById(id);

    if (!elemento) return false;

    return elemento.checked;
}

function preencherCampo(id, valor) {
    const elemento = document.getElementById(id);

    if (!elemento) return;

    elemento.value = valor ?? "";
}

function preencherCheckbox(id, valor) {
    const elemento = document.getElementById(id);

    if (!elemento) return;

    elemento.checked = Boolean(valor);
}

function dataInput(data) {
    if (!data) return "";

    return String(data).split("T")[0];
}

function moeda(valor) {
    return Number(valor || 0).toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );
}

function textoSeguro(valor) {
    if (valor === null || valor === undefined || valor === "") {
        return "-";
    }

    return String(valor)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function carregarClientes() {
    try {
        const response = await fetch(
            `${API_URL}/clientes`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        clientes = await response.json();

        clienteSelect.innerHTML = "";
        editarClienteSelect.innerHTML = "";

        clientes.forEach(cliente => {
            const option = `
                <option value="${cliente.clienteid}">
                    ${textoSeguro(
                cliente.nomeFantasia ||
                cliente.razaoSocial
            )}
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
        const response = await fetch(
            `${API_URL}/servicos`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        servicos = await response.json();

    } catch (error) {
        console.log(error);
        alert("Erro ao carregar serviços.");
    }
}

async function carregarPropostas() {
    try {
        const response = await fetch(
            `${API_URL}/propostas`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        propostas = await response.json();
        propostasCache = propostas;

        renderizarKanban(propostas);
        atualizarKpis(propostas);

    } catch (error) {
        console.log(error);
        alert("Erro ao carregar propostas.");
    }
}

function atualizarKpis(lista) {
    const pendentes = lista.filter(p => p.status === "PENDENTE").length;
    const aprovadas = lista.filter(p => p.status === "APROVADA").length;
    const executando = lista.filter(p => p.status === "EXECUTANDO").length;
    const faturadas = lista.filter(p => p.status === "FATURADA").length;

    document.getElementById("kpiPendentes").innerText = pendentes;
    document.getElementById("kpiAprovadas").innerText = aprovadas;
    document.getElementById("kpiExecutando").innerText = executando;
    document.getElementById("kpiFaturadas").innerText = faturadas;

    document.getElementById("countPendentes").innerText = pendentes;
    document.getElementById("countAprovadas").innerText = aprovadas;
    document.getElementById("countExecutando").innerText = executando;
    document.getElementById("countFaturadas").innerText = faturadas;
}

function criarCardProposta(proposta) {
    return `
        <div
            class="proposal-card"
            data-id="${proposta.propostaid}"
            onclick="abrirModalProposta(${proposta.propostaid})"
        >
            <span class="proposal-number">
                ${textoSeguro(proposta.numero)}
            </span>

            <div class="proposal-tags">
                ${proposta.prioridade ? `
                    <div class="proposal-tag tag-prioridade">
                        ${textoSeguro(proposta.prioridade)}
                    </div>
                ` : ""}

                ${proposta.origem ? `
                    <div class="proposal-tag tag-origem">
                        ${textoSeguro(proposta.origem)}
                    </div>
                ` : ""}

                
            </div>

            <div class="proposal-title">
                ${textoSeguro(proposta.titulo)}
            </div>

            <div class="proposal-client">
                ${textoSeguro(
        proposta.cliente?.nomeFantasia ||
        proposta.cliente?.razaoSocial
    )}
            </div>
            <div class="proposal-client">
    👤 ${textoSeguro(
        proposta.vendedor?.nome
    )}
</div>

            <div class="proposal-desc">
                ${textoSeguro(proposta.descricao || proposta.subtitulo || "Sem descrição")}
            </div>

            <div class="proposal-footer">
                <div class="proposal-value">
                    ${moeda(proposta.subtotal)}
                </div>

                <div class="proposal-date">
                    ${new Date(proposta.createdAt).toLocaleDateString("pt-BR")}
                </div>
            </div>
        </div>
    `;
}

function renderizarKanban(lista) {
    colunaPendente.innerHTML = "";
    colunaAprovada.innerHTML = "";
    colunaExecutando.innerHTML = "";
    colunaFaturada.innerHTML = "";

    lista.forEach(proposta => {
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

        if (proposta.status === "FATURADA") {
            colunaFaturada.innerHTML += card;
        }
    });

    iniciarSortableKanban();
}

function iniciarSortableKanban() {
    sortableInstances.forEach(instance => instance.destroy());
    sortableInstances = [];

    const listas = document.querySelectorAll(".kanban-list");

    listas.forEach(lista => {
        const sortable = new Sortable(lista, {
            group: "propostas-kanban",
            animation: 180,
            forceFallback: true,
            fallbackOnBody: true,
            swapThreshold: 0.65,
            ghostClass: "kanban-ghost",
            chosenClass: "kanban-chosen",
            dragClass: "kanban-drag",

            onStart: function () {
                estaArrastando = true;
                document.body.classList.add("kanban-is-dragging");
            },

            onEnd: async function (evt) {
                document.body.classList.remove("kanban-is-dragging");

                setTimeout(() => {
                    estaArrastando = false;
                }, 150);

                const propostaId = evt.item.dataset.id;
                const novoStatus = evt.to.dataset.status;

                if (!propostaId || !novoStatus) return;

                await atualizarStatusProposta(propostaId, novoStatus);
                await carregarPropostas();
            }
        });

        sortableInstances.push(sortable);
    });
}

async function atualizarStatusProposta(id, status) {
    await fetch(
        `${API_URL}/propostas/${id}`,
        {
            method: "PUT",

            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },

            body: JSON.stringify({
                status
            })
        }
    );
}

function montarOptionsServicos(servicoSelecionado = "") {
    return servicos.map(servico => {
        const selected = Number(servicoSelecionado) === Number(servico.servicoid)
            ? "selected"
            : "";

        return `
            <option
                value="${servico.servicoid}"
                data-codigo="${textoSeguro(servico.codigo || "")}"
                data-nome="${textoSeguro(servico.nome || "")}"
                data-descricao="${textoSeguro(servico.descricao || servico.nome || "")}"
                data-unidade="${textoSeguro(servico.unidade || "UN")}"
                data-valor="${servico.valor || 0}"
                ${selected}
            >
                ${textoSeguro(servico.nome)} - ${moeda(servico.valor)}
            </option>
        `;
    }).join("");
}

function adicionarItemProposta(item = null) {
    const index = document.querySelectorAll(".item-servico").length + 1;

    const servicoId = item?.servicoId || item?.servico?.servicoid || "";
    const quantidade = item?.quantidade || 1;
    const valorUnitario = item?.valorUnitario || 0;
    const desconto = item?.desconto || 0;
    const acrescimo = item?.acrescimo || 0;
    const subtotal = item?.subtotal || 0;

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
                    <input type="text" class="form-control premium-input-light item-descricao"
                        value="${textoSeguro(item?.descricao || "")}">
                </div>

                <div class="col-md-12 mb-3">
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

    if (!item) {
        preencherItemComServico(select);
    }

    preencherItemComServico(select);


}

function adicionarItemEditar(item = null) {

    const index = document.querySelectorAll(".item-servico").length + 1;

    const servicoId =
        item?.servicoId ||
        item?.servico?.servicoid ||
        "";

    const codigo =
        item?.codigo &&
            item.codigo !== "-"
            ? item.codigo
            : item?.servico?.codigo || "";

    const descricao =
        item?.descricao &&
            item.descricao !== "-"
            ? item.descricao
            : item?.servico?.descricao || "";

    const unidade =
        item?.unidade &&
            item.unidade !== "UN"
            ? item.unidade
            : item?.servico?.unidade || "UN";

    const valorUnitario =
        item?.valorUnitario &&
            Number(item.valorUnitario) > 0
            ? item.valorUnitario
            : item?.servico?.valor || 0;

    const quantidade = item?.quantidade || 1;
    const desconto = item?.desconto || 0;
    const acrescimo = item?.acrescimo || 0;
    const subtotal = item?.subtotal || 0;

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
                    <input
                        type="text"
                        class="form-control premium-input-light item-descricao"
                        value="${textoSeguro(descricao)}"
                    >
                </div>

                <div class="col-md-12 mb-3">
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

    listaItensEditar.insertAdjacentHTML(
        "beforeend",
        html
    );

    const novoItem =
        listaItensEditar.lastElementChild;

    const select =
        novoItem.querySelector(
            ".servico-select"
        );

    preencherItemComServico(select);

}

function preencherItemComServico(select) {

    const item = select.closest(".item-servico");

    const option =
        select.options[select.selectedIndex];

    if (!option) return;

    item.querySelector(".item-codigo").value =
        option.dataset.codigo || "";

    item.querySelector(".item-descricao").value =
        option.dataset.descricao || "";

    item.querySelector(".item-unidade").value =
        option.dataset.unidade || "UN";

    item.querySelector(".item-valor").value =
        Number(option.dataset.valor || 0);

    calcularSubtotalItem(item);
}

document.getElementById("btnAdicionarServico").addEventListener("click", () => {
    if (servicos.length === 0) {
        alert("Cadastre um serviço antes de criar uma proposta.");
        return;
    }

    adicionarItemProposta();
});

document.getElementById(
    "btnAdicionarServicoEditar"
)
    ?.addEventListener(
        "click",
        () => {

            if (
                servicos.length === 0
            ) {

                alert(
                    "Cadastre um serviço antes de criar uma proposta."
                );

                return;

            }

            adicionarItemEditar();

        }
    );

document.addEventListener(
    "click",
    (e) => {

        if (
            e.target.classList.contains(
                "btn-remove-item"
            )
        ) {

            e.target
                .closest(
                    ".item-servico"
                )
                .remove();

            document
                .querySelectorAll(
                    ".item-servico"
                )
                .forEach(
                    (
                        item,
                        index
                    ) => {

                        const titulo =
                            item.querySelector(
                                ".item-title strong"
                            );

                        if (titulo) {

                            titulo.textContent =
                                `Item ${index + 1}`;

                        }

                    }
                );



        }

    }
);

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

    const subtotal = (quantidade * valorUnitario) - desconto + acrescimo;

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

        const response = await fetch(
            `${API_URL}/vendedores`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        vendedoresCache = await response.json();

        preencherSelectVendedores();

    } catch (error) {

        console.log(error);

    }
}

function preencherSelectVendedores() {

    const selectNovo =
        document.getElementById("vendedor");

    const selectEditar =
        document.getElementById("editarVendedor");

    if (selectNovo) {

        selectNovo.innerHTML = `
            <option value="">
                Selecione um vendedor
            </option>
        `;

        vendedoresCache.forEach(vendedor => {

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

        vendedoresCache.forEach(vendedor => {

            selectEditar.innerHTML += `
                <option value="${vendedor.vendedorid}">
                    ${vendedor.nome}
                </option>
            `;
        });
    }
}


function montarItens() {
    const itens = [];

    const itensDOM = document.querySelectorAll(".item-servico");

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

            servicoId: select?.value ? Number(select.value) : null
        });
    });

    return itens;
}
function montarItensEditar() {

    const itens = [];

    const itensDOM =
        listaItensEditar.querySelectorAll(
            ".item-servico"
        );

    itensDOM.forEach(
        (item, index) => {

            const select =
                item.querySelector(
                    ".servico-select"
                );

            itens.push({

                codigo:
                    item.querySelector(
                        ".item-codigo"
                    )?.value || `ITEM-${index + 1}`,

                descricao:
                    item.querySelector(
                        ".item-descricao"
                    )?.value || "",

                detalhes:
                    item.querySelector(
                        ".item-detalhes"
                    )?.value || null,

                unidade:
                    item.querySelector(
                        ".item-unidade"
                    )?.value || "UN",

                quantidade:
                    Number(
                        item.querySelector(
                            ".item-quantidade"
                        )?.value || 0
                    ),

                valorUnitario:
                    Number(
                        item.querySelector(
                            ".item-valor"
                        )?.value || 0
                    ),

                desconto:
                    Number(
                        item.querySelector(
                            ".item-desconto"
                        )?.value || 0
                    ),

                acrescimo:
                    Number(
                        item.querySelector(
                            ".item-acrescimo"
                        )?.value || 0
                    ),

                subtotal:
                    Number(
                        item.querySelector(
                            ".item-subtotal"
                        )?.value || 0
                    ),

                ordem:
                    Number(
                        item.querySelector(
                            ".item-ordem"
                        )?.value || index + 1
                    ),

                observacoes:
                    item.querySelector(
                        ".item-observacoes"
                    )?.value || null,

                servicoId:
                    select?.value
                        ? Number(select.value)
                        : null

            });

        }
    );

    return itens;

}


function montarBodyNovaProposta() {
    const itens = montarItens();

    return {
        numero: null,

        titulo: pegarValor("titulo"),

        subtitulo: pegarValor("subtitulo"),

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

        vendedorId:
            pegarValor("vendedor")
                ? Number(pegarValor("vendedor"))
                : null,

        itens
    };
}

formNovaProposta.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
        const body = montarBodyNovaProposta();

        if (!body.titulo) {
            alert("Informe o título da proposta.");
            return;
        }

        if (!body.clienteId) {
            alert("Selecione um cliente.");
            return;
        }

        if (!body.itens || body.itens.length === 0) {
            alert("Adicione pelo menos um item na proposta.");
            return;
        }

        const response = await fetch(
            `${API_URL}/propostas`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },

                body: JSON.stringify(body)
            }
        );

        const resposta = await response.json();

        if (!response.ok) {
            console.log(resposta);
            alert(resposta.error || "Erro ao criar proposta.");
            return;
        }

        bootstrap.Modal.getInstance(
            document.getElementById("modalNovaProposta")
        ).hide();

        formNovaProposta.reset();

        listaItensProposta.innerHTML = "";
        valorTotal.innerText = moeda(0);

        await carregarPropostas();

    } catch (error) {
        console.log(error);
        alert("Erro ao criar proposta.");
    }
});

async function abrirModalProposta(id) {

    if (estaArrastando) return;

    try {

        const response = await fetch(
            `${API_URL}/propostas/${id}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            alert("Erro ao buscar proposta.");
            return;
        }

        const proposta = await response.json();

        preencherCampo("editarId", proposta.propostaid);
        preencherCampo("editarNumero", proposta.numero);
        preencherCampo("editarTitulo", proposta.titulo);
        preencherCampo("editarClienteId", proposta.clienteId);
        preencherCampo(
            "editarVendedor",
            proposta.vendedorId
        );
        preencherCampo("editarSubtitulo", proposta.subtitulo);
        preencherCampo("editarStatus", proposta.status);
        preencherCampo("editarPrioridade", proposta.prioridade);
        preencherCampo("editarDescricao", proposta.descricao);
        preencherCampo("editarEscopo", proposta.escopo);
        preencherCampo("editarResponsavel", proposta.responsavel);
        preencherCampo("editarOrigem", proposta.origem);
        preencherCampo("editarAssinaturaCliente", proposta.assinaturaCliente);

        preencherCampo(
            "editarDataValidade",
            dataInput(proposta.dataValidade)
        );

        preencherCampo(
            "editarDataAprovacao",
            dataInput(proposta.dataAprovacao)
        );

        preencherCampo(
            "editarDataRecusa",
            dataInput(proposta.dataRecusa)
        );

        preencherCampo("editarValidadeDias", proposta.validadeDias);

        preencherCampo("editarFrete", proposta.frete);



        preencherCampo(
            "editarFormaPagamento",
            proposta.formaPagamento
        );

        preencherCampo(
            "editarCondicoesPagamento",
            proposta.condicoesPagamento
        );

        preencherCampo(
            "editarObservacoes",
            proposta.observacoes
        );

        preencherCampo(
            "editarObservacoesInternas",
            proposta.observacoesInternas
        );

        preencherCampo(
            "editarMotivoRecusa",
            proposta.motivoRecusa
        );

        preencherCheckbox(
            "editarAprovadoCliente",
            proposta.aprovadoCliente
        );

        preencherCheckbox(
            "editarEnviadoEmail",
            proposta.enviadoEmail
        );

        preencherCheckbox(
            "editarEnviadoWhatsapp",
            proposta.enviadoWhatsapp
        );

        preencherCheckbox(
            "editarVisualizada",
            proposta.visualizada
        );

        /* =====================================
           CARREGA ITENS DA PROPOSTA
        ===================================== */

        listaItensEditar.innerHTML = "";

        if (
            proposta.itens &&
            proposta.itens.length
        ) {

            proposta.itens.forEach(item => {

                adicionarItemEditar(item);

            });

        }

        const modal =
            new bootstrap.Modal(
                document.getElementById(
                    "modalProposta"
                )
            );

        modal.show();

    } catch (error) {

        console.log(error);

        alert(
            "Erro ao abrir proposta."
        );

    }

}

function montarBodyEditarProposta() {

    return {

        numero:
            pegarValor("editarNumero"),

        titulo:
            pegarValor("editarTitulo"),

        subtitulo:
            pegarValor("editarSubtitulo"),

        descricao:
            pegarValor("editarDescricao"),

        escopo:
            pegarValor("editarEscopo"),

        observacoes:
            pegarValor("editarObservacoes"),

        observacoesInternas:
            pegarValor(
                "editarObservacoesInternas"
            ),

        status:
            pegarValor(
                "editarStatus"
            ),

        prioridade:
            pegarValor(
                "editarPrioridade"
            ),

        subtotal:
            pegarNumero(
                "editarSubtotal"
            ),

        frete:
            pegarNumero(
                "editarFrete"
            ),

        formaPagamento:
            pegarValor(
                "editarFormaPagamento"
            ),

        condicoesPagamento:
            pegarValor(
                "editarCondicoesPagamento"
            ),

        validadeDias:
            pegarInteiro(
                "editarValidadeDias"
            ),

        dataValidade:
            pegarValor(
                "editarDataValidade"
            ),

        dataAprovacao:
            pegarValor(
                "editarDataAprovacao"
            ),

        dataRecusa:
            pegarValor(
                "editarDataRecusa"
            ),

        motivoRecusa:
            pegarValor(
                "editarMotivoRecusa"
            ),

        responsavel:
            pegarValor(
                "editarResponsavel"
            ),



        origem:
            pegarValor(
                "editarOrigem"
            ),



        assinaturaCliente:
            pegarValor(
                "editarAssinaturaCliente"
            ),

        aprovadoCliente:
            pegarCheckbox(
                "editarAprovadoCliente"
            ),

        enviadoEmail:
            pegarCheckbox(
                "editarEnviadoEmail"
            ),

        enviadoWhatsapp:
            pegarCheckbox(
                "editarEnviadoWhatsapp"
            ),

        visualizada:
            pegarCheckbox(
                "editarVisualizada"
            ),



        clienteId:
            Number(
                pegarValor(
                    "editarClienteId"
                )
            ),

        vendedorId:
            pegarValor("editarVendedor")
                ? Number(pegarValor("editarVendedor"))
                : null,

        itens:
            montarItensEditar()

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

        console.log("BODY EDITAR PROPOSTA:", body);
        const response = await fetch(
            `${API_URL}/propostas/${id}`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },

                body: JSON.stringify(body)
            }
        );

        const resposta = await response.json();

        if (!response.ok) {
            console.log(resposta);
            alert(resposta.error || "Erro ao atualizar proposta.");
            return;
        }

        bootstrap.Modal.getInstance(
            document.getElementById("modalProposta")
        ).hide();

        await carregarPropostas();

    } catch (error) {
        console.log(error);
        alert("Erro ao atualizar proposta.");
    }
});

document.getElementById("btnExcluirProposta").addEventListener("click", async () => {
    try {
        const id = pegarValor("editarId");

        if (!id) {
            alert("Proposta inválida.");
            return;
        }

        const confirmar = confirm("Deseja excluir esta proposta?");

        if (!confirmar) return;

        const response = await fetch(
            `${API_URL}/propostas/${id}`,
            {
                method: "DELETE",

                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const resposta = await response.json();

        if (!response.ok) {
            console.log(resposta);
            alert(resposta.error || "Erro ao excluir proposta.");
            return;
        }

        bootstrap.Modal.getInstance(
            document.getElementById("modalProposta")
        ).hide();

        await carregarPropostas();

    } catch (error) {
        console.log(error);
        alert("Erro ao excluir proposta.");
    }
});

pesquisaProposta.addEventListener("input", () => {
    const termo = pesquisaProposta.value.toLowerCase().trim();

    const filtradas = propostasCache.filter(proposta => {
        return (
            proposta.titulo?.toLowerCase().includes(termo) ||
            proposta.numero?.toLowerCase().includes(termo) ||
            (
                proposta.cliente?.nomeFantasia ||
                proposta.cliente?.razaoSocial ||
                ""
            ).toLowerCase().includes(termo) ||
            proposta.descricao?.toLowerCase().includes(termo) ||
            proposta.status?.toLowerCase().includes(termo) ||
            (
                proposta.vendedor?.nome || ""
            ).toLowerCase().includes(termo) ||
            proposta.origem?.toLowerCase().includes(termo)
        );
    });

    renderizarKanban(filtradas);
    atualizarKpis(filtradas);
});

async function iniciarTela() {
    await carregarClientes();
    await carregarServicos();
    await carregarPropostas();

    const nomeResponsavel =
        usuarioLogado?.usuario?.nome ||
        usuarioLogado?.nome ||
        "";

    const responsavel =
        document.getElementById("responsavel");

    if (responsavel && nomeResponsavel) {
        responsavel.value = nomeResponsavel;
    }
}


iniciarTela();
carregarVendedores();
carregarPropostas();