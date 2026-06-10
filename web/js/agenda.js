const token = JSON.parse(
    localStorage.getItem("usuarioLogado")
)?.token;

if (!token) {

    window.location.href = "login.html";

}

const listaAgenda =
    document.getElementById("listaAgenda");

const formAgenda =
    document.getElementById("formAgenda");

const pesquisaAgenda =
    document.getElementById("pesquisaAgenda");

const clienteSelect =
    document.getElementById("clienteId");

const propostaSelect =
    document.getElementById("propostaId");

let agendaCache = [];
let clientesCache = [];
let propostasCache = [];

/* ===================================================
   CLIENTES
=================================================== */

async function carregarClientes() {

    try {

        const response = await fetch(
            `${API_URL}/clientes`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

        const clientes =
            await response.json();

        clientesCache = clientes;

        clientes.forEach(cliente => {

            clienteSelect.innerHTML += `
                <option value="${cliente.clienteid}">
                    ${cliente.nome}
                </option>
            `;

        });

    } catch (error) {

        console.log(error);

    }

}

/* ===================================================
   PROPOSTAS
=================================================== */

async function carregarPropostas() {

    try {

        const response = await fetch(
            `${API_URL}/propostas`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

        const propostas =
            await response.json();

        propostasCache = propostas;

        propostas.forEach(proposta => {

            propostaSelect.innerHTML += `
                <option value="${proposta.propostaid}">
                    ${proposta.numero} - ${proposta.titulo}
                </option>
            `;

        });

    } catch (error) {

        console.log(error);

    }

}

/* ===================================================
   CARREGAR AGENDA
=================================================== */

async function carregarAgenda() {

    try {

        const response = await fetch(
            `${API_URL}/agenda`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

        const agendas =
            await response.json();

        agendaCache = agendas;

        atualizarKpis(agendas);

        renderizarAgenda(agendas);

    } catch (error) {

        console.log(error);

    }

}

/* ===================================================
   KPIS
=================================================== */

function atualizarKpis(agendas) {

    document.getElementById(
        "kpiTotal"
    ).innerText =
        agendas.length;

    document.getElementById(
        "kpiConcluidos"
    ).innerText =
        agendas.filter(a =>
            a.concluido
        ).length;

    document.getElementById(
        "kpiPendentes"
    ).innerText =
        agendas.filter(a =>
            !a.concluido
        ).length;

    const hoje = new Date()
        .toLocaleDateString("pt-BR");

    document.getElementById(
        "kpiHoje"
    ).innerText =
        agendas.filter(a => {

            return new Date(a.dataInicio)
                .toLocaleDateString("pt-BR")
                === hoje;

        }).length;

}

/* ===================================================
   RENDER
=================================================== */

function renderizarAgenda(agendas) {

    listaAgenda.innerHTML = "";

    if (agendas.length === 0) {

        listaAgenda.innerHTML = `
            <div class="empty-state">

                <h3>
                    Nenhum compromisso encontrado
                </h3>

                <p>
                    Cadastre um novo compromisso.
                </p>

            </div>
        `;

        return;

    }

    agendas.forEach(agenda => {

        listaAgenda.innerHTML += `

            <div
                class="agenda-card"
                style="--card-color:${agenda.cor || "#0f172a"}"
            >

                <div class="agenda-top">

                    <div class="agenda-badges">

                        <div class="badge-type">
                            ${agenda.tipo || "-"}
                        </div>

                        <div class="badge-priority">
                            ${agenda.prioridade || "-"}
                        </div>

                        <div class="badge-status">
                            ${agenda.status || "Pendente"}
                        </div>

                    </div>

                </div>

                <div class="agenda-title">
                    ${agenda.titulo}
                </div>

                <div class="agenda-description">
                    ${agenda.descricao || "Sem descrição"}
                </div>

                <div class="agenda-info">

                    <div class="agenda-info-item">

                        <span>
                            Cliente
                        </span>

                        <strong>
                            ${agenda.cliente?.nome || "-"}
                        </strong>

                    </div>

                    <div class="agenda-info-item">

                        <span>
                            Proposta
                        </span>

                        <strong>
                            ${agenda.proposta?.numero || "-"}
                        </strong>

                    </div>

                    <div class="agenda-info-item">

                        <span>
                            Início
                        </span>

                        <strong>
                            ${formatarDataHora(agenda.dataInicio)}
                        </strong>

                    </div>

                    <div class="agenda-info-item">

                        <span>
                            Local
                        </span>

                        <strong>
                            ${agenda.local || "-"}
                        </strong>

                    </div>

                </div>

                <div class="agenda-footer">

                    <button
                        class="btn-gerenciar"
                        onclick="abrirModalAgenda(${agenda.agendaid})"
                    >

                        Gerenciar compromisso

                    </button>

                </div>

            </div>

        `;

    });

}

/* ===================================================
   PESQUISA
=================================================== */

pesquisaAgenda.addEventListener(
    "input",
    () => {

        const termo =
            pesquisaAgenda.value
                .toLowerCase();

        const filtrados =
            agendaCache.filter(agenda => {

                return (

                    agenda.titulo
                        ?.toLowerCase()
                        .includes(termo)

                    ||

                    agenda.descricao
                        ?.toLowerCase()
                        .includes(termo)

                    ||

                    agenda.tipo
                        ?.toLowerCase()
                        .includes(termo)

                    ||

                    agenda.status
                        ?.toLowerCase()
                        .includes(termo)

                );

            });

        renderizarAgenda(filtrados);

    }
);

/* ===================================================
   CADASTRAR
=================================================== */

formAgenda.addEventListener(
    "submit",
    async (e) => {

        e.preventDefault();

        try {

            const body = {

                titulo:
                    pegarValor("titulo"),

                descricao:
                    pegarValor("descricao"),

                tipo:
                    pegarValor("tipo"),

                prioridade:
                    pegarValor("prioridade"),

                local:
                    pegarValor("local"),

                endereco:
                    pegarValor("endereco"),

                cidade:
                    pegarValor("cidade"),

                estado:
                    pegarValor("estado"),

                dataInicio:
                    pegarValor("dataInicio"),

                dataFim:
                    pegarValor("dataFim"),

                concluido:
                    pegarCheckbox("concluido"),

                status:
                    pegarValor("status"),

                cor:
                    pegarValor("cor"),

                observacoes:
                    pegarValor("observacoes"),

                clienteId:
                    pegarValor("clienteId")
                        ? Number(pegarValor("clienteId"))
                        : null,

                propostaId:
                    pegarValor("propostaId")
                        ? Number(pegarValor("propostaId"))
                        : null

            };

            const response = await fetch(
                `${API_URL}/agenda`,
                {
                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`

                    },

                    body: JSON.stringify(body)

                }
            );

            if (!response.ok) {

                alert(
                    "Erro ao cadastrar compromisso."
                );

                return;

            }

            bootstrap.Modal.getInstance(
                document.getElementById(
                    "modalAgenda"
                )
            ).hide();

            formAgenda.reset();

            carregarAgenda();

        } catch (error) {

            console.log(error);

        }

    }
);

/* ===================================================
   MODAL EDITAR
=================================================== */

async function abrirModalAgenda(id) {

    try {

        const response = await fetch(
            `${API_URL}/agenda/${id}`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

        const agenda =
            await response.json();

        document.getElementById(
            "editarId"
        ).value =
            agenda.agendaid;

        document.getElementById(
            "conteudoEditarAgenda"
        ).innerHTML = `

            <div class="form-section">

                <div class="section-title">
                    Informações
                </div>

                <div class="row">

                    <div class="col-md-6 mb-3">

                        <label>Título</label>

                        <input
                            type="text"
                            id="editarTitulo"
                            class="form-control premium-input-light"
                            value="${agenda.titulo || ""}"
                        >

                    </div>

                    <div class="col-md-3 mb-3">

                        <label>Tipo</label>

                        <input
                            type="text"
                            id="editarTipo"
                            class="form-control premium-input-light"
                            value="${agenda.tipo || ""}"
                        >

                    </div>

                    <div class="col-md-3 mb-3">

                        <label>Prioridade</label>

                        <input
                            type="text"
                            id="editarPrioridade"
                            class="form-control premium-input-light"
                            value="${agenda.prioridade || ""}"
                        >

                    </div>

                    <div class="col-12 mb-3">

                        <label>Descrição</label>

                        <textarea
                            id="editarDescricao"
                            class="form-control premium-input-light textarea-premium"
                        >${agenda.descricao || ""}</textarea>

                    </div>

                    <div class="col-md-6 mb-3">

                        <label>Data início</label>

                        <input
                            type="datetime-local"
                            id="editarDataInicio"
                            class="form-control premium-input-light"
                            value="${agenda.dataInicio
                ? new Date(agenda.dataInicio)
                    .toISOString()
                    .slice(0, 16)
                : ""
            }"
                        >

                    </div>

                    <div class="col-md-6 mb-3">

                        <label>Data fim</label>

                        <input
                            type="datetime-local"
                            id="editarDataFim"
                            class="form-control premium-input-light"
                            value="${agenda.dataFim
                ? new Date(agenda.dataFim)
                    .toISOString()
                    .slice(0, 16)
                : ""
            }"
                        >

                    </div>

                    <div class="col-md-6 mb-3">

                        <label>Local</label>

                        <input
                            type="text"
                            id="editarLocal"
                            class="form-control premium-input-light"
                            value="${agenda.local || ""}"
                        >

                    </div>

                    <div class="col-md-6 mb-3">

                        <label>Status</label>

                        <input
                            type="text"
                            id="editarStatus"
                            class="form-control premium-input-light"
                            value="${agenda.status || ""}"
                        >

                    </div>

                    <div class="col-md-6 mb-3">

                        <label>Cor</label>

                        <input
                            type="color"
                            id="editarCor"
                            class="color-picker"
                            value="${agenda.cor || "#0f172a"}"
                        >

                    </div>

                    <div class="col-md-6 mb-3">

                        <label>Concluído</label>

                        <div class="switch-row">

                            <input
                                type="checkbox"
                                id="editarConcluido"
                                ${agenda.concluido ? "checked" : ""}
                            >

                            <span>
                                Sim
                            </span>

                        </div>

                    </div>

                    <div class="col-12 mb-3">

                        <label>Observações</label>

                        <textarea
                            id="editarObservacoes"
                            class="form-control premium-input-light textarea-premium"
                        >${agenda.observacoes || ""}</textarea>

                    </div>

                </div>

            </div>

        `;

        const modal =
            new bootstrap.Modal(
                document.getElementById(
                    "modalEditarAgenda"
                )
            );

        modal.show();

    } catch (error) {

        console.log(error);

    }

}

/* ===================================================
   EDITAR
=================================================== */

document.getElementById(
    "formEditarAgenda"
).addEventListener(
    "submit",
    async (e) => {

        e.preventDefault();

        try {

            const id =
                document.getElementById(
                    "editarId"
                ).value;

            const body = {

                titulo:
                    pegarValor("editarTitulo"),

                descricao:
                    pegarValor("editarDescricao"),

                tipo:
                    pegarValor("editarTipo"),

                prioridade:
                    pegarValor("editarPrioridade"),

                dataInicio:
                    pegarValor("editarDataInicio"),

                dataFim:
                    pegarValor("editarDataFim"),

                local:
                    pegarValor("editarLocal"),

                status:
                    pegarValor("editarStatus"),

                cor:
                    pegarValor("editarCor"),

                concluido:
                    pegarCheckbox("editarConcluido"),

                observacoes:
                    pegarValor("editarObservacoes")

            };

            const response = await fetch(
                `${API_URL}/agenda/${id}`,
                {
                    method: "PUT",

                    headers: {

                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`

                    },

                    body: JSON.stringify(body)

                }
            );

            if (!response.ok) {

                alert(
                    "Erro ao atualizar compromisso."
                );

                return;

            }

            bootstrap.Modal.getInstance(
                document.getElementById(
                    "modalEditarAgenda"
                )
            ).hide();

            carregarAgenda();

        } catch (error) {

            console.log(error);

        }

    }
);

/* ===================================================
   EXCLUIR
=================================================== */

document.getElementById(
    "btnExcluirAgenda"
).addEventListener(
    "click",
    async () => {

        try {

            const id =
                document.getElementById(
                    "editarId"
                ).value;

            const confirmar =
                confirm(
                    "Deseja excluir este compromisso?"
                );

            if (!confirmar) return;

            const response = await fetch(
                `${API_URL}/agenda/${id}`,
                {
                    method: "DELETE",

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {

                alert(
                    "Erro ao excluir compromisso."
                );

                return;

            }

            bootstrap.Modal.getInstance(
                document.getElementById(
                    "modalEditarAgenda"
                )
            ).hide();

            carregarAgenda();

        } catch (error) {

            console.log(error);

        }

    }
);

/* ===================================================
   INIT
=================================================== */

async function iniciarTela() {

    await carregarClientes();

    await carregarPropostas();

    await carregarAgenda();

}

iniciarTela();