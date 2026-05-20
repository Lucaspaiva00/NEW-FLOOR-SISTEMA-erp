const token = JSON.parse(
    localStorage.getItem("usuarioLogado")
)?.token;

if (!token) {
    window.location.href = "login.html";
}

const colunaPendente = document.getElementById("colunaPendente");
const colunaAprovada = document.getElementById("colunaAprovada");
const colunaExecutando = document.getElementById("colunaExecutando");
const colunaFaturada = document.getElementById("colunaFaturada");

const clienteSelect = document.getElementById("clienteId");
const listaItensProposta = document.getElementById("listaItensProposta");
const valorTotal = document.getElementById("valorTotal");

let propostas = [];
let servicos = [];
let sortableInstances = [];
let estaArrastando = false;

async function carregarClientes() {

    const response = await fetch(
        "http://localhost:3000/clientes",
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    const clientes = await response.json();

    clienteSelect.innerHTML = "";

    clientes.forEach(cliente => {
        clienteSelect.innerHTML += `
            <option value="${cliente.clienteid}">
                ${cliente.nome}
            </option>
        `;
    });
}

async function carregarServicos() {

    const response = await fetch(
        "http://localhost:3000/servicos",
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    servicos = await response.json();
}

async function carregarPropostas() {

    const response = await fetch(
        "http://localhost:3000/propostas",
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    propostas = await response.json();

    colunaPendente.innerHTML = "";
    colunaAprovada.innerHTML = "";
    colunaExecutando.innerHTML = "";
    colunaFaturada.innerHTML = "";

    let pendentes = 0;
    let aprovadas = 0;
    let executando = 0;
    let faturadas = 0;

    propostas.forEach(proposta => {

        const card = criarCardProposta(proposta);

        if (proposta.status === "PENDENTE") {
            colunaPendente.innerHTML += card;
            pendentes++;
        }

        if (proposta.status === "APROVADA") {
            colunaAprovada.innerHTML += card;
            aprovadas++;
        }

        if (proposta.status === "EXECUTANDO") {
            colunaExecutando.innerHTML += card;
            executando++;
        }

        if (proposta.status === "FATURADA") {
            colunaFaturada.innerHTML += card;
            faturadas++;
        }

    });

    document.getElementById("kpiPendentes").innerText = pendentes;
    document.getElementById("kpiAprovadas").innerText = aprovadas;
    document.getElementById("kpiExecutando").innerText = executando;
    document.getElementById("kpiFaturadas").innerText = faturadas;

    iniciarSortableKanban();
}

function criarCardProposta(proposta) {

    return `
        <div
            class="proposal-card"
            data-id="${proposta.propostaid}"
            onclick="abrirModalProposta(${proposta.propostaid})"
        >

            <small>${proposta.numero}</small>

            <h4>${proposta.cliente?.nome || "-"}</h4>

            <p>${proposta.titulo}</p>

            <div class="proposal-footer">
                <strong>
                    R$ ${Number(proposta.total).toFixed(2)}
                </strong>

                <span>
                    ${new Date(proposta.createdAt).toLocaleDateString("pt-BR")}
                </span>
            </div>

        </div>
    `;
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
        `http://localhost:3000/propostas/${id}`,
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

function abrirModalProposta(id) {

    if (estaArrastando) return;

    const proposta = propostas.find(
        p => p.propostaid == id
    );

    if (!proposta) return;

    document.getElementById("editarId").value = proposta.propostaid;
    document.getElementById("editarStatus").value = proposta.status;

    const modal = new bootstrap.Modal(
        document.getElementById("modalProposta")
    );

    modal.show();
}

document.getElementById("btnAdicionarServico").addEventListener("click", () => {

    if (servicos.length === 0) {
        alert("Cadastre um serviço antes de criar a proposta.");
        return;
    }

    const html = `
        <div class="item-servico">

            <select class="form-control servico-select">

                ${servicos.map(servico => `
                    <option
                        value="${servico.servicoid}"
                        data-nome="${servico.nome}"
                        data-valor="${servico.valor}"
                    >
                        ${servico.nome} - R$ ${Number(servico.valor).toFixed(2)}
                    </option>
                `).join("")}

            </select>

            <input
                type="number"
                class="form-control quantidade-input"
                value="1"
                min="1"
            >

            <button
                type="button"
                class="btn btn-danger btn-remover-item"
            >
                X
            </button>

        </div>
    `;

    listaItensProposta.innerHTML += html;

    atualizarTotal();
});

document.addEventListener("click", (e) => {

    if (e.target.classList.contains("btn-remover-item")) {
        e.target.parentElement.remove();
        atualizarTotal();
    }
});

document.addEventListener("change", atualizarTotal);
document.addEventListener("input", atualizarTotal);

function atualizarTotal() {

    let total = 0;

    const itensDOM = document.querySelectorAll(".item-servico");

    itensDOM.forEach(item => {

        const select = item.querySelector(".servico-select");
        const quantidade = item.querySelector(".quantidade-input");

        if (!select || !quantidade) return;

        const option = select.options[select.selectedIndex];

        const valor = Number(option.dataset.valor || 0);
        const qtd = Number(quantidade.value || 0);

        total += valor * qtd;
    });

    valorTotal.innerText = total.toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );
}

document.getElementById("formNovaProposta").addEventListener("submit", async (e) => {

    e.preventDefault();

    const itensDOM = document.querySelectorAll(".item-servico");

    if (itensDOM.length === 0) {
        alert("Adicione pelo menos um serviço na proposta.");
        return;
    }

    const itens = [];

    let total = 0;

    itensDOM.forEach(item => {

        const select = item.querySelector(".servico-select");
        const quantidade = item.querySelector(".quantidade-input");

        const option = select.options[select.selectedIndex];

        const valor = Number(option.dataset.valor);
        const qtd = Number(quantidade.value);
        const subtotal = valor * qtd;

        total += subtotal;

        itens.push({
            descricao: option.dataset.nome,
            servicoId: Number(select.value),
            quantidade: qtd,
            valorUnitario: valor,
            subtotal
        });
    });

    const body = {
        numero: `PROP-${Date.now()}`,
        titulo: document.getElementById("titulo").value,
        descricao: document.getElementById("descricao").value,
        clienteId: Number(clienteSelect.value),
        subtotal: total,
        desconto: 0,
        total,
        status: "PENDENTE",
        itens
    };

    await fetch(
        "http://localhost:3000/propostas",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },

            body: JSON.stringify(body)
        }
    );

    location.reload();
});

document.getElementById("btnSalvarStatus").addEventListener("click", async () => {

    const id = document.getElementById("editarId").value;
    const status = document.getElementById("editarStatus").value;

    await atualizarStatusProposta(id, status);

    location.reload();
});

document.getElementById("btnExcluirProposta").addEventListener("click", async () => {

    const id = document.getElementById("editarId").value;

    const confirmar = confirm(
        "Deseja excluir esta proposta?"
    );

    if (!confirmar) return;

    await fetch(
        `http://localhost:3000/propostas/${id}`,
        {
            method: "DELETE",

            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    location.reload();
});

async function iniciarTela() {
    await carregarClientes();
    await carregarServicos();
    await carregarPropostas();
}

iniciarTela();