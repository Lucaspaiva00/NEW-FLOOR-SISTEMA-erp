const API_URL = "https://new-floor-sistema-erp.onrender.com";

const token = JSON.parse(
    localStorage.getItem("usuarioLogado")
)?.token;

if (!token) {

    window.location.href =
        "login.html";

}

const headers = {

    Authorization:
        `Bearer ${token}`

};

let clientes = [];
let propostas = [];
let agenda = [];

/* ===================================================
   HELPERS
=================================================== */

function moeda(valor) {

    return Number(valor || 0)
        .toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );

}

function formatarData(data) {

    if (!data) return "-";

    return new Date(data)
        .toLocaleDateString("pt-BR");

}

function textoSeguro(valor) {

    if (!valor) return "-";

    return String(valor);

}

/* ===================================================
   CARREGAR DADOS
=================================================== */

async function carregarDados() {

    try {

        const [
            clientesRes,
            propostasRes,
            agendaRes
        ] = await Promise.all([

            fetch(
                `${API_URL}/clientes`,
                { headers }
            ),

            fetch(
                `${API_URL}/propostas`,
                { headers }
            ),

            fetch(
                `${API_URL}/agenda`,
                { headers }
            )

        ]);

        clientes =
            await clientesRes.json();

        propostas =
            await propostasRes.json();

        agenda =
            await agendaRes.json();

        atualizarKPIs();

        renderizarPipeline();

        renderizarAgenda();

        renderizarGrafico();

    } catch (error) {

        console.log(error);

    }

}

/* ===================================================
   KPIS
=================================================== */

function atualizarKPIs() {

    const pendentes =
        propostas.filter(p =>
            p.status === "PENDENTE"
        );

    const aprovadas =
        propostas.filter(p =>
            p.status === "APROVADA"
        );

    const faturadas =
        propostas.filter(p =>
            p.status === "FATURADA"
        );

    const hoje =
        new Date()
            .toLocaleDateString("pt-BR");

    const agendaHoje =
        agenda.filter(a => {

            return new Date(a.dataInicio)
                .toLocaleDateString("pt-BR")
                === hoje;

        });

    const totalFaturado =
        faturadas.reduce(
            (total, proposta) => {

                return total +
                    Number(proposta.total || 0);

            },
            0
        );

    document.getElementById(
        "kpiClientes"
    ).innerText =
        clientes.length;

    document.getElementById(
        "kpiPendentes"
    ).innerText =
        pendentes.length;

    document.getElementById(
        "kpiAprovadas"
    ).innerText =
        aprovadas.length;

    document.getElementById(
        "kpiFaturamento"
    ).innerText =
        moeda(totalFaturado);

    document.getElementById(
        "kpiAgendaHoje"
    ).innerText =
        agendaHoje.length;

}

/* ===================================================
   PIPELINE
=================================================== */

function criarCard(proposta) {

    return `

        <div class="proposal-card">

            <span class="proposal-number">

                ${textoSeguro(proposta.numero)}

            </span>

            <div class="proposal-tags">

                ${proposta.prioridade ? `
                    <div class="proposal-tag tag-priority">
                        ${proposta.prioridade}
                    </div>
                ` : ""}

                ${proposta.origem ? `
                    <div class="proposal-tag tag-origin">
                        ${proposta.origem}
                    </div>
                ` : ""}

            </div>

            <div class="proposal-client">

                ${textoSeguro(
        proposta.cliente?.nome
    )}

            </div>

            <div class="proposal-desc">

                ${textoSeguro(
        proposta.titulo
    )}

            </div>

            <div class="proposal-footer">

                <div class="proposal-value">

                    ${moeda(proposta.total)}

                </div>

                <div class="proposal-date">

                    ${formatarData(
        proposta.createdAt
    )}

                </div>

            </div>

        </div>

    `;

}

function renderizarPipeline() {

    const pendentes =
        propostas.filter(p =>
            p.status === "PENDENTE"
        );

    const aprovadas =
        propostas.filter(p =>
            p.status === "APROVADA"
        );

    const executando =
        propostas.filter(p =>
            p.status === "EXECUTANDO"
        );

    const faturadas =
        propostas.filter(p =>
            p.status === "FATURADA"
        );

    document.getElementById(
        "countPendentes"
    ).innerText =
        pendentes.length;

    document.getElementById(
        "countAprovadas"
    ).innerText =
        aprovadas.length;

    document.getElementById(
        "countExecutando"
    ).innerText =
        executando.length;

    document.getElementById(
        "countFaturadas"
    ).innerText =
        faturadas.length;

    document.getElementById(
        "colunaPendentes"
    ).innerHTML =
        pendentes.map(
            criarCard
        ).join("");

    document.getElementById(
        "colunaAprovadas"
    ).innerHTML =
        aprovadas.map(
            criarCard
        ).join("");

    document.getElementById(
        "colunaExecutando"
    ).innerHTML =
        executando.map(
            criarCard
        ).join("");

    document.getElementById(
        "colunaFaturadas"
    ).innerHTML =
        faturadas.map(
            criarCard
        ).join("");

}

/* ===================================================
   AGENDA
=================================================== */

function renderizarAgenda() {

    const hoje =
        new Date()
            .toLocaleDateString("pt-BR");

    const agendaHoje =
        agenda.filter(a => {

            return new Date(a.dataInicio)
                .toLocaleDateString("pt-BR")
                === hoje;

        });

    const container =
        document.getElementById(
            "agendaHoje"
        );

    if (agendaHoje.length === 0) {

        container.innerHTML = `

            <div class="empty-state">

                Nenhum compromisso hoje.

            </div>

        `;

        return;

    }

    container.innerHTML =
        agendaHoje.map(item => {

            const hora =
                new Date(item.dataInicio)
                    .toLocaleTimeString(
                        "pt-BR",
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    );

            return `

                <div class="agenda-item">

                    <div class="agenda-hour">

                        ${hora}

                    </div>

                    <div class="agenda-content">

                        <div class="agenda-title">

                            ${textoSeguro(
                item.titulo
            )}

                        </div>

                        <div class="agenda-desc">

                            ${textoSeguro(
                item.descricao
                || item.local
            )}

                        </div>

                        <div class="agenda-meta">

                            <span>

                                ${textoSeguro(
                item.tipo
            )}

                            </span>

                            <span>

                                ${textoSeguro(
                item.prioridade
            )}

                            </span>

                            <span>

                                ${textoSeguro(
                item.cliente?.nome
                || "Sem cliente"
            )}

                            </span>

                        </div>

                    </div>

                </div>

            `;

        }).join("");

}

/* ===================================================
   GRÁFICO
=================================================== */

function renderizarGrafico() {

    const meses = [
        "Jan",
        "Fev",
        "Mar",
        "Abr",
        "Mai",
        "Jun",
        "Jul",
        "Ago",
        "Set",
        "Out",
        "Nov",
        "Dez"
    ];

    const dados =
        Array(12).fill(0);

    propostas.forEach(proposta => {

        if (
            proposta.status !== "FATURADA"
        ) return;

        const data =
            new Date(
                proposta.createdAt
            );

        const mes =
            data.getMonth();

        dados[mes] +=
            Number(
                proposta.total || 0
            );

    });

    const ctx =
        document.getElementById(
            "graficoFaturamento"
        );

    new Chart(ctx, {

        type: "line",

        data: {

            labels: meses,

            datasets: [{

                label: "Faturamento",

                data: dados,

                borderColor: "#0f172a",

                backgroundColor:
                    "rgba(15,23,42,0.08)",

                borderWidth: 4,

                fill: true,

                tension: 0.35,

                pointRadius: 5,

                pointHoverRadius: 7

            }]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

                legend: {
                    display: false
                }

            },

            scales: {

                y: {

                    ticks: {

                        callback: function (
                            value
                        ) {

                            return moeda(value);

                        }

                    }

                }

            }

        }

    });

}

/* ===================================================
   INIT
=================================================== */

carregarDados();