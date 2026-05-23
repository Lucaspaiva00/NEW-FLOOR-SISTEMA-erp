const API_URL = "https://new-floor-sistema-erp.onrender.com";

const token = JSON.parse(
    localStorage.getItem("usuarioLogado")
)?.token;

if (!token) {
    window.location.href = "login.html";
}

const listaServicos = document.getElementById("listaServicos");
const formServico = document.getElementById("formServico");
const formEditarServico = document.getElementById("formEditarServico");
const pesquisaServico = document.getElementById("pesquisaServico");

let servicosCache = [];

function pegarValor(id) {
    const elemento = document.getElementById(id);

    if (!elemento) return null;

    const valor = elemento.value;

    if (valor === undefined || valor === null) return null;

    const valorTratado = String(valor).trim();

    return valorTratado === "" ? null : valorTratado;
}

function pegarDecimal(id) {
    const valor = pegarValor(id);

    if (!valor) return null;

    return Number(valor.replace(",", "."));
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

function moeda(valor) {
    const numero = Number(valor || 0);

    return numero.toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );
}

function montarBodyServico(prefixo = "") {
    const campo = (nome) => {
        if (!prefixo) return nome;

        return `${prefixo}${nome.charAt(0).toUpperCase()}${nome.slice(1)}`;
    };

    return {
        codigo: pegarValor(campo("codigo")),

        nome: pegarValor(campo("nome")),

        categoria: pegarValor(campo("categoria")),

        descricao: pegarValor(campo("descricao")),

        descricaoInterna: pegarValor(campo("descricaoInterna")),

        valor: pegarDecimal(campo("valor")),

        custo: pegarDecimal(campo("custo")),

        margemLucro: pegarDecimal(campo("margemLucro")),

        unidade: pegarValor(campo("unidade")),

        tempoExecucao: pegarValor(campo("tempoExecucao")),

        garantia: pegarValor(campo("garantia")),

        observacoes: pegarValor(campo("observacoes")),

        ativo: pegarCheckbox(campo("ativo")),

        destaque: pegarCheckbox(campo("destaque")),

        imagem: pegarValor(campo("imagem"))
    };
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

        if (!response.ok) {
            alert("Erro ao carregar serviços.");
            return;
        }

        const servicos = await response.json();

        servicosCache = Array.isArray(servicos) ? servicos : [];

        atualizarKpis(servicosCache);

        renderizarServicos(servicosCache);

    } catch (error) {
        console.log(error);
        alert("Erro de conexão ao carregar serviços.");
    }
}

function atualizarKpis(servicos) {
    const total = servicos.length;

    const ativos = servicos.filter(
        servico => servico.ativo === true
    ).length;

    const destaques = servicos.filter(
        servico => servico.destaque === true
    ).length;

    const somaValores = servicos.reduce(
        (total, servico) => total + Number(servico.valor || 0),
        0
    );

    const valorMedio = total > 0 ? somaValores / total : 0;

    document.getElementById("kpiTotal").innerText = total;
    document.getElementById("kpiAtivos").innerText = ativos;
    document.getElementById("kpiDestaques").innerText = destaques;
    document.getElementById("kpiValorMedio").innerText = moeda(valorMedio);
}

function renderizarStatus(servico) {
    const badgeAtivo = servico.ativo
        ? `<span class="status-badge status-ativo">Ativo</span>`
        : `<span class="status-badge status-inativo">Inativo</span>`;

    const badgeDestaque = servico.destaque
        ? `<span class="status-badge status-destaque">Destaque</span>`
        : "";

    return `
        <div class="badges">
            ${badgeAtivo}
            ${badgeDestaque}
        </div>
    `;
}

function renderizarServicos(servicos) {
    listaServicos.innerHTML = "";

    if (!servicos || servicos.length === 0) {
        listaServicos.innerHTML = `
            <div class="empty-state">
                <h3>Nenhum serviço encontrado</h3>
                <p>Cadastre um novo serviço ou tente outra pesquisa.</p>
            </div>
        `;

        return;
    }

    servicos.forEach(servico => {
        const primeiraLetra = servico.nome
            ? textoSeguro(servico.nome.charAt(0).toUpperCase())
            : "S";

        listaServicos.innerHTML += `
            <div class="servico-card">

                <div class="servico-top">

                    <div class="servico-profile">

                        <div class="servico-icon">
                            ${primeiraLetra}
                        </div>

                        <div>
                            <strong>${textoSeguro(servico.nome)}</strong>
                            <span>
                                ${textoSeguro(servico.categoria || "Sem categoria")}
                            </span>
                        </div>

                    </div>

                    ${renderizarStatus(servico)}

                </div>

                <p class="servico-desc">
                    ${textoSeguro(servico.descricao || "Sem descrição cadastrada.")}
                </p>

                <div class="preco-box">
                    <small>Valor de venda</small>
                    <strong>${moeda(servico.valor)}</strong>
                </div>

                <div class="servico-info-grid">

                    <div class="info-box">
                        <small>Código</small>
                        <strong>${textoSeguro(servico.codigo)}</strong>
                    </div>

                    <div class="info-box">
                        <small>Unidade</small>
                        <strong>${textoSeguro(servico.unidade)}</strong>
                    </div>

                    <div class="info-box">
                        <small>Custo</small>
                        <strong>${moeda(servico.custo)}</strong>
                    </div>

                    <div class="info-box">
                        <small>Margem</small>
                        <strong>${textoSeguro(servico.margemLucro ? `${servico.margemLucro}%` : "-")}</strong>
                    </div>

                    <div class="info-box">
                        <small>Execução</small>
                        <strong>${textoSeguro(servico.tempoExecucao)}</strong>
                    </div>

                    <div class="info-box">
                        <small>Garantia</small>
                        <strong>${textoSeguro(servico.garantia)}</strong>
                    </div>

                </div>

                <div class="servico-footer">
                    <button
                        class="btn-gerenciar"
                        onclick="abrirModalServico(${servico.servicoid})"
                    >
                        Gerenciar serviço
                    </button>
                </div>

            </div>
        `;
    });
}

if (pesquisaServico) {
    pesquisaServico.addEventListener(
        "input",
        () => {
            const termo = pesquisaServico.value.toLowerCase().trim();

            const filtrados = servicosCache.filter(servico => {
                return (
                    servico.nome?.toLowerCase().includes(termo) ||
                    servico.codigo?.toLowerCase().includes(termo) ||
                    servico.categoria?.toLowerCase().includes(termo) ||
                    servico.descricao?.toLowerCase().includes(termo) ||
                    servico.unidade?.toLowerCase().includes(termo)
                );
            });

            renderizarServicos(filtrados);
        }
    );
}

formServico.addEventListener(
    "submit",
    async (e) => {
        e.preventDefault();

        try {
            const body = montarBodyServico();

            if (!body.nome) {
                alert("Informe o nome do serviço.");
                return;
            }

            if (body.valor === null || Number.isNaN(body.valor)) {
                alert("Informe o valor do serviço.");
                return;
            }

            const response = await fetch(
                `${API_URL}/servicos`,
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
                alert(resposta.error || "Erro ao cadastrar serviço.");
                return;
            }

            const modal = bootstrap.Modal.getInstance(
                document.getElementById("modalServico")
            );

            if (modal) {
                modal.hide();
            }

            formServico.reset();

            preencherCheckbox("ativo", true);
            preencherCheckbox("destaque", false);

            carregarServicos();

        } catch (error) {
            console.log(error);
            alert("Erro de conexão ao cadastrar serviço.");
        }
    }
);

async function abrirModalServico(id) {
    try {
        const response = await fetch(
            `${API_URL}/servicos/${id}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            alert("Erro ao buscar serviço.");
            return;
        }

        const servico = await response.json();

        preencherCampo("editarId", servico.servicoid);

        preencherCampo("editarCodigo", servico.codigo);

        preencherCampo("editarNome", servico.nome);

        preencherCampo("editarCategoria", servico.categoria);

        preencherCampo("editarDescricao", servico.descricao);

        preencherCampo("editarDescricaoInterna", servico.descricaoInterna);

        preencherCampo("editarValor", servico.valor);

        preencherCampo("editarCusto", servico.custo);

        preencherCampo("editarMargemLucro", servico.margemLucro);

        preencherCampo("editarUnidade", servico.unidade);

        preencherCampo("editarTempoExecucao", servico.tempoExecucao);

        preencherCampo("editarGarantia", servico.garantia);

        preencherCampo("editarObservacoes", servico.observacoes);

        preencherCheckbox("editarAtivo", servico.ativo);

        preencherCheckbox("editarDestaque", servico.destaque);

        preencherCampo("editarImagem", servico.imagem);

        const modal = new bootstrap.Modal(
            document.getElementById("modalEditarServico")
        );

        modal.show();

    } catch (error) {
        console.log(error);
        alert("Erro de conexão ao abrir serviço.");
    }
}

formEditarServico.addEventListener(
    "submit",
    async (e) => {
        e.preventDefault();

        try {
            const id = pegarValor("editarId");

            if (!id) {
                alert("Serviço inválido.");
                return;
            }

            const body = montarBodyServico("editar");

            if (!body.nome) {
                alert("Informe o nome do serviço.");
                return;
            }

            if (body.valor === null || Number.isNaN(body.valor)) {
                alert("Informe o valor do serviço.");
                return;
            }

            const response = await fetch(
                `${API_URL}/servicos/${id}`,
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
                alert(resposta.error || "Erro ao atualizar serviço.");
                return;
            }

            const modal = bootstrap.Modal.getInstance(
                document.getElementById("modalEditarServico")
            );

            if (modal) {
                modal.hide();
            }

            carregarServicos();

        } catch (error) {
            console.log(error);
            alert("Erro de conexão ao atualizar serviço.");
        }
    }
);

document.getElementById("btnExcluirServico").addEventListener(
    "click",
    async () => {
        try {
            const id = pegarValor("editarId");

            if (!id) {
                alert("Serviço inválido.");
                return;
            }

            const confirmar = confirm("Deseja excluir este serviço?");

            if (!confirmar) return;

            const response = await fetch(
                `${API_URL}/servicos/${id}`,
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
                alert(resposta.error || "Erro ao excluir serviço.");
                return;
            }

            const modal = bootstrap.Modal.getInstance(
                document.getElementById("modalEditarServico")
            );

            if (modal) {
                modal.hide();
            }

            carregarServicos();

        } catch (error) {
            console.log(error);
            alert("Erro de conexão ao excluir serviço.");
        }
    }
);

carregarServicos();