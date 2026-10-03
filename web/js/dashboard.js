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
let financeiro = null, grafico = null, anoSelecionado = new Date().getFullYear(), financeiroRequest = 0;
function valorProposta(p) {return Number(p.subtotal || 0) + Number(p.frete || 0);}
function mesFaturamento(p) {
 if(p.status!=="FATURADA" || !p.dataFaturamento)return null;
 const date=new Date(p.dataFaturamento);if(Number.isNaN(date.getTime()))return null;
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"numeric"}).formatToParts(date);
 return Number(parts.find(p=>p.type==="year").value)===anoSelecionado?Number(parts.find(p=>p.type==="month").value)-1:null;
}
function prepararAnos(){
 const select=document.getElementById("dashboardAno"),anos=new Set(Array.from({length:6},(_,i)=>new Date().getFullYear()-i));
 propostas.forEach(p=>{if(p.dataFaturamento)anos.add(Number(new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric"}).format(new Date(p.dataFaturamento))));});
 select.innerHTML=[...anos].sort((a,b)=>b-a).map(ano=>`<option value="${ano}">${ano}</option>`).join("");select.value=String(anoSelecionado);
 select.onchange=()=>{anoSelecionado=Number(select.value);financeiro=null;atualizarKPIs();renderizarGrafico();carregarFinanceiro();};
}
async function carregarFinanceiro(){
 const request=++financeiroRequest,panel=document.getElementById("dashboardFinanceiro"),aviso=document.getElementById("dashboardAviso");panel.hidden=true;
 try{
  const response=await fetch(`${API_URL}/financeiro/dashboard?ano=${anoSelecionado}`,{headers});if(request!==financeiroRequest)return;
  if(response.status===403){financeiro=null;aviso.textContent="Indicadores financeiros indisponíveis para este acesso.";return;}
  if(!response.ok)throw new Error("Falha no Financeiro");
  const d=await response.json();if(request!==financeiroRequest)return;financeiro=d;panel.hidden=false;
  document.getElementById("kpiRecebido").textContent=moeda(d.recebidoPorMes.reduce((a,b)=>a+Number(b),0));
  for(const [id,key]of Object.entries({kpiSaldo:"saldoDisponivel",kpiReceber:"contasReceber",kpiPagar:"contasPagar",kpiVencidos:"vencidosValor"}))document.getElementById(id).textContent=moeda(d[key]);
  const semData=propostas.filter(p=>p.status==="FATURADA"&&!p.dataFaturamento).length;
  aviso.textContent=semData?`${semData} proposta(s) faturada(s) sem data histórica conhecida ficam fora do total anual e do gráfico.`:"";renderizarGrafico();
 }catch(error){if(request!==financeiroRequest)return;financeiro=null;aviso.textContent="Não foi possível carregar o Financeiro. Os valores financeiros não estão disponíveis.";renderizarGrafico();}
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

        if(![clientesRes,propostasRes,agendaRes].every(r=>r.ok))throw new Error("Falha ao carregar dados comerciais");
        clientes =
            await clientesRes.json();

        propostas =
            await propostasRes.json();

        agenda =
            await agendaRes.json();

        prepararAnos();
        atualizarKPIs();

        renderizarPipeline();

        renderizarAgenda();

        renderizarGrafico();
        carregarFinanceiro();

    } catch (error) {

        console.log(error);
        document.getElementById("dashboardAviso").textContent="Não foi possível carregar o dashboard. Recarregue a página.";

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
            mesFaturamento(p) !== null
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
                    valorProposta(proposta);

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
        proposta.cliente?.nomeFantasia || proposta.cliente?.razaoSocial || proposta.cliente?.nome
    )}

            </div>

            <div class="proposal-desc">

                ${textoSeguro(
        proposta.titulo
    )}

            </div>

            <div class="proposal-footer">

                <div class="proposal-value">

                    ${moeda(valorProposta(proposta))}

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

    propostas.forEach(p=>{const mes=mesFaturamento(p);if(mes!==null)dados[mes]+=valorProposta(p);});

    const ctx =
        document.getElementById(
            "graficoFaturamento"
        );

    if(grafico)grafico.destroy();
    grafico=new Chart(ctx, {

        type: "line",

        data: {

            labels: meses,

            datasets: [{

                label: "Faturado",

                data: dados,

                borderColor: "#0f172a",

                backgroundColor:
                    "rgba(15,23,42,0.08)",

                borderWidth: 4,

                fill: true,

                tension: 0.35,

                pointRadius: 5,

                pointHoverRadius: 7

            }, ...(financeiro?[{label:"Recebido",data:financeiro.recebidoPorMes,borderColor:"#198754",borderWidth:3,fill:false,tension:0.35}]:[])]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

                legend: {
                    display: true
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