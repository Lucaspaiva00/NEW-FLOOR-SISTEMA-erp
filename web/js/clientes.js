const API_URL = "https://new-floor-sistema-erp.onrender.com";

const token = JSON.parse(
    localStorage.getItem("usuarioLogado")
)?.token;

if (!token) {
    window.location.href = "login.html";
}

const listaClientes = document.getElementById("listaClientes");
const formCliente = document.getElementById("formCliente");
const formEditarCliente = document.getElementById("formEditarCliente");
const pesquisaCliente = document.getElementById("pesquisaCliente");

let clientesCache = [];

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

    return valor.replace(",", ".");
}

function formatarDataParaInput(data) {
    if (!data) return "";

    return String(data).split("T")[0];
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

function montarBodyCliente(prefixo = "") {
    const campo = (nome) => {
        if (!prefixo) return nome;

        return `${prefixo}${nome.charAt(0).toUpperCase()}${nome.slice(1)}`;
    };

    return {
        tipo: pegarValor(campo("tipo")) || "PESSOA_JURIDICA",

        nomeFantasia: pegarValor(campo("nomeFantasia")),

        razaoSocial: pegarValor(campo("razaoSocial")),

        cnpj: pegarValor(campo("cnpj")),

        cpf: pegarValor(campo("cpf")),

        inscricaoEstadual: pegarValor(campo("inscricaoEstadual")),

        responsavel: pegarValor(campo("responsavel")),

        telefone1: pegarValor(campo("telefone1")),

        telefone2: pegarValor(campo("telefone2")),

        telefone3: pegarValor(campo("telefone3")),

        telefone4: pegarValor(campo("telefone4")),

        email1: pegarValor(campo("email1")),

        email2: pegarValor(campo("email2")),

        email3: pegarValor(campo("email3")),

        email4: pegarValor(campo("email4")),



        site: pegarValor(campo("site")),

        cep: pegarValor(campo("cep")),

        endereco: pegarValor(campo("endereco")),

        numero: pegarValor(campo("numero")),

        complemento: pegarValor(campo("complemento")),

        bairro: pegarValor(campo("bairro")),

        cidade: pegarValor(campo("cidade")),

        estado: pegarValor(campo("estado")),

        pais: pegarValor(campo("pais")) || "Brasil",

        latitude: pegarValor(campo("latitude")),

        longitude: pegarValor(campo("longitude")),

        observacoes: pegarValor(campo("observacoes")),

        origemLead: pegarValor(campo("origemLead")),

        tags: pegarValor(campo("tags")),

        statusCliente: pegarValor(campo("statusCliente")) || "Novo",

        limiteCredito: pegarDecimal(campo("limiteCredito")),

        descontoPadrao: pegarDecimal(campo("descontoPadrao")),

        dataNascimento: pegarValor(campo("dataNascimento"))
    };
}

function preencherCampo(id, valor) {
    const elemento = document.getElementById(id);

    if (!elemento) return;

    elemento.value = valor ?? "";
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

        if (!response.ok) {
            alert("Erro ao carregar clientes.");
            return;
        }

        const clientes = await response.json();

        clientesCache = Array.isArray(clientes) ? clientes : [];

        atualizarKpis(clientesCache);

        renderizarClientes(clientesCache);

    } catch (error) {
        console.log(error);
        alert("Erro de conexão ao carregar clientes.");
    }
}

function atualizarKpis(clientes) {
    document.getElementById("kpiTotal").innerText = clientes.length;

    document.getElementById("kpiAtivos").innerText = clientes.filter(
        cliente => cliente.statusCliente === "Ativo"
    ).length;

    document.getElementById("kpiNegociacao").innerText = clientes.filter(
        cliente => cliente.statusCliente === "Negociação"
    ).length;

    document.getElementById("kpiNovos").innerText = clientes.filter(
        cliente => cliente.statusCliente === "Novo"
    ).length;
}

function renderizarStatus(status) {
    if (status === "Ativo") {
        return `
            <span class="status-badge status-ativo">
                Ativo
            </span>
        `;
    }

    if (status === "Negociação") {
        return `
            <span class="status-badge status-negociacao">
                Negociação
            </span>
        `;
    }

    return `
        <span class="status-badge status-novo">
            Novo
        </span>
    `;
}

function renderizarClientes(clientes) {
    listaClientes.innerHTML = "";

    if (!clientes || clientes.length === 0) {
        listaClientes.innerHTML = `
            <div class="empty-state">
                <h3>Nenhum cliente encontrado</h3>
                <p>Cadastre um novo cliente ou tente outra pesquisa.</p>
            </div>
        `;

        return;
    }

    clientes.forEach(cliente => {
        const primeiraLetra =
            (cliente.nomeFantasia ||
                cliente.razaoSocial ||
                "C")
                .charAt(0)
                .toUpperCase();

        listaClientes.innerHTML += `
    <div class="cliente-card">

        <div class="cliente-header">

            <div class="cliente-avatar">
                ${textoSeguro(
            (cliente.nomeFantasia ||
                cliente.razaoSocial ||
                "C")
                .charAt(0)
                .toUpperCase()
        )}
            </div>

            <div class="cliente-header-info">
                <h3>
                    ${textoSeguro(
            cliente.nomeFantasia ||
            cliente.razaoSocial ||
            "Sem nome"
        )}
                </h3>

                <p>
                    ${textoSeguro(cliente.responsavel)}
                </p>
            </div>

            ${renderizarStatus(cliente.statusCliente)}

        </div>

        <div class="cliente-body">

            <div class="cliente-item">
                <span>Responsável</span>
                <strong>${textoSeguro(cliente.responsavel)}</strong>
            </div>

            <div class="cliente-item">
                <span>Telefone</span>
                <strong>${textoSeguro(cliente.telefone1)}</strong>
            </div>

            <div class="cliente-item">
                <span>Telefone 2</span>
                <strong>${textoSeguro(cliente.telefone2)}</strong>
            </div>

            <div class="cliente-item">
                <span>Email</span>
                <strong>${textoSeguro(cliente.email1)}</strong>
            </div>

            <div class="cliente-item">
                <span>Cidade</span>
                <strong>${textoSeguro(cliente.cidade)}</strong>
            </div>

            <div class="cliente-item">
                <span>CNPJ / CPF</span>
                <strong>
                    ${textoSeguro(cliente.cnpj || cliente.cpf)}
                </strong>
            </div>

        </div>

        <div class="cliente-footer">

            <button
                class="btn-gerenciar"
                onclick="abrirModalCliente(${cliente.clienteid})"
            >
                Gerenciar cliente
            </button>

        </div>

    </div>
`;
    });
}

if (pesquisaCliente) {
    pesquisaCliente.addEventListener(
        "input",
        () => {
            const termo = pesquisaCliente.value.toLowerCase().trim();

            const filtrados = clientesCache.filter(cliente => {
                return (
                    cliente.nomeFantasia?.toLowerCase().includes(termo) ||
                    cliente.nomeFantasia?.toLowerCase().includes(termo) ||
                    cliente.razaoSocial?.toLowerCase().includes(termo) ||
                    cliente.email1?.toLowerCase().includes(termo) ||
                    cliente.telefone1?.toLowerCase().includes(termo) ||
                    cliente.cnpj?.toLowerCase().includes(termo) ||
                    cliente.cpf?.toLowerCase().includes(termo) ||
                    cliente.cidade?.toLowerCase().includes(termo)
                );
            });

            renderizarClientes(filtrados);
        }
    );
}

formCliente.addEventListener(
    "submit",
    async (e) => {
        e.preventDefault();

        try {
            const body = montarBodyCliente();

            if (!body.nomeFantasia && !body.razaoSocial) {
                alert("Informe o Nome Fantasia ou Razão Social.");
                return;
            }

            const response = await fetch(
                `${API_URL}/clientes`,
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
                alert(resposta.error || "Erro ao cadastrar cliente.");
                return;
            }

            const modal = bootstrap.Modal.getInstance(
                document.getElementById("modalCliente")
            );

            if (modal) {
                modal.hide();
            }

            formCliente.reset();

            preencherCampo("pais", "Brasil");

            carregarClientes();

        } catch (error) {
            console.log(error);
            alert("Erro de conexão ao cadastrar cliente.");
        }
    }
);

async function abrirModalCliente(id) {
    try {
        const response = await fetch(
            `${API_URL}/clientes/${id}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            alert("Erro ao buscar cliente.");
            return;
        }

        const cliente = await response.json();

        preencherCampo("editarId", cliente.clienteid);

        preencherCampo("editarTipo", cliente.tipo || "PESSOA_JURIDICA");

        preencherCampo("editarNomeFantasia", cliente.nomeFantasia);

        preencherCampo("editarRazaoSocial", cliente.razaoSocial);

        preencherCampo("editarCnpj", cliente.cnpj);

        preencherCampo("editarCpf", cliente.cpf);

        preencherCampo("editarInscricaoEstadual", cliente.inscricaoEstadual);

        preencherCampo("editarResponsavel", cliente.responsavel);

        preencherCampo("editarTelefone1", cliente.telefone1);
        preencherCampo("editarTelefone2", cliente.telefone2);
        preencherCampo("editarTelefone3", cliente.telefone3);
        preencherCampo("editarTelefone4", cliente.telefone4);

        preencherCampo("editarEmail1", cliente.email1);
        preencherCampo("editarEmail2", cliente.email2);
        preencherCampo("editarEmail3", cliente.email3);
        preencherCampo("editarEmail4", cliente.email4);

        preencherCampo("editarSite", cliente.site);

        preencherCampo("editarCep", cliente.cep);

        preencherCampo("editarEndereco", cliente.endereco);

        preencherCampo("editarNumero", cliente.numero);

        preencherCampo("editarComplemento", cliente.complemento);

        preencherCampo("editarBairro", cliente.bairro);

        preencherCampo("editarCidade", cliente.cidade);

        preencherCampo("editarEstado", cliente.estado);

        preencherCampo("editarPais", cliente.pais || "Brasil");

        preencherCampo("editarLatitude", cliente.latitude);

        preencherCampo("editarLongitude", cliente.longitude);

        preencherCampo("editarOrigemLead", cliente.origemLead);

        preencherCampo("editarTags", cliente.tags);

        preencherCampo("editarStatusCliente", cliente.statusCliente || "Novo");

        preencherCampo("editarLimiteCredito", cliente.limiteCredito);

        preencherCampo("editarDescontoPadrao", cliente.descontoPadrao);

        preencherCampo("editarDataNascimento", formatarDataParaInput(cliente.dataNascimento));

        preencherCampo("editarObservacoes", cliente.observacoes);

        const modal = new bootstrap.Modal(
            document.getElementById("modalEditarCliente")
        );

        modal.show();

    } catch (error) {
        console.log(error);
        alert("Erro de conexão ao abrir cliente.");
    }
}

formEditarCliente.addEventListener(
    "submit",
    async (e) => {
        e.preventDefault();

        try {
            const id = pegarValor("editarId");

            if (!id) {
                alert("Cliente inválido.");
                return;
            }

            const body = montarBodyCliente("editar");

            if (!body.nomeFantasia && !body.razaoSocial) {
                alert("Informe o Nome Fantasia ou Razão Social.");
                return;
            }

            const response = await fetch(
                `${API_URL}/clientes/${id}`,
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
                alert(resposta.error || "Erro ao atualizar cliente.");
                return;
            }

            const modal = bootstrap.Modal.getInstance(
                document.getElementById("modalEditarCliente")
            );

            if (modal) {
                modal.hide();
            }

            carregarClientes();

        } catch (error) {
            console.log(error);
            alert("Erro de conexão ao atualizar cliente.");
        }
    }
);

document.getElementById("btnExcluirCliente").addEventListener(
    "click",
    async () => {
        try {
            const id = pegarValor("editarId");

            if (!id) {
                alert("Cliente inválido.");
                return;
            }

            const confirmar = confirm("Deseja excluir este cliente?");

            if (!confirmar) return;

            const response = await fetch(
                `${API_URL}/clientes/${id}`,
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
                alert(resposta.error || "Erro ao excluir cliente.");
                return;
            }

            const modal = bootstrap.Modal.getInstance(
                document.getElementById("modalEditarCliente")
            );

            if (modal) {
                modal.hide();
            }

            carregarClientes();

        } catch (error) {
            console.log(error);
            alert("Erro de conexão ao excluir cliente.");
        }
    }
);

carregarClientes();