const token = JSON.parse(
    localStorage.getItem("usuarioLogado")
)?.token;

if (!token) {
    window.location.href = "login.html";
}

const listaVendedores = document.getElementById("listaVendedores");
const formVendedor = document.getElementById("formVendedor");
const formEditarVendedor = document.getElementById("formEditarVendedor");
const pesquisaVendedor = document.getElementById("pesquisaVendedor");

let vendedoresCache = [];

function montarBodyVendedor(prefixo = "") {

    const campo = (nome) => {

        if (!prefixo) return nome;

        return `${prefixo}${nome.charAt(0).toUpperCase()}${nome.slice(1)}`;

    };

    return {
        nome: pegarValor(campo("nome")),
        email: pegarValor(campo("email")),
        telefone: pegarValor(campo("telefone")),
        ativo: pegarValor(campo("ativo")) === "true"
    };
}

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

        if (!response.ok) {
            alert("Erro ao carregar vendedores.");
            return;
        }

        const vendedores = await response.json();

        vendedoresCache = Array.isArray(vendedores)
            ? vendedores
            : [];

        atualizarKpis(vendedoresCache);

        renderizarVendedores(vendedoresCache);

    } catch (error) {

        console.log(error);

        alert("Erro de conexão ao carregar vendedores.");

    }
}

function atualizarKpis(vendedores) {

    document.getElementById("kpiTotal").innerText =
        vendedores.length;

    document.getElementById("kpiAtivos").innerText =
        vendedores.filter(v => v.ativo).length;

    document.getElementById("kpiInativos").innerText =
        vendedores.filter(v => !v.ativo).length;

    const totalPropostas =
        vendedores.reduce(
            (total, vendedor) =>
                total + (vendedor.propostas?.length || 0),
            0
        );

    document.getElementById("kpiPropostas").innerText =
        totalPropostas;
}

function renderizarStatus(ativo) {

    if (ativo) {
        return `
            <span class="status-badge status-ativo">
                Ativo
            </span>
        `;
    }

    return `
        <span class="status-badge status-inativo">
            Inativo
        </span>
    `;
}

function renderizarVendedores(vendedores) {

    listaVendedores.innerHTML = "";

    if (!vendedores || vendedores.length === 0) {

        listaVendedores.innerHTML = `
            <div class="empty-state">
                <h3>Nenhum vendedor encontrado</h3>
                <p>
                    Cadastre um novo vendedor.
                </p>
            </div>
        `;

        return;
    }

    vendedores.forEach(vendedor => {

        listaVendedores.innerHTML += `
        
            <div class="cliente-card">

                <div class="cliente-header">

                    <div class="cliente-avatar">

                        ${textoSeguro(
            vendedor.nome
                ?.charAt(0)
                ?.toUpperCase()
        )}

                    </div>

                    <div class="cliente-header-info">

                        <h3>
                            ${textoSeguro(vendedor.nome)}
                        </h3>

                        <p>
                            ${textoSeguro(vendedor.email)}
                        </p>

                    </div>

                    ${renderizarStatus(vendedor.ativo)}

                </div>

                <div class="cliente-body">

                    <div class="cliente-item">
                        <span>Telefone</span>
                        <strong>
                            ${textoSeguro(vendedor.telefone)}
                        </strong>
                    </div>

                    <div class="cliente-item">
                        <span>Email</span>
                        <strong>
                            ${textoSeguro(vendedor.email)}
                        </strong>
                    </div>

                    <div class="cliente-item">
                        <span>Status</span>
                        <strong>
                            ${vendedor.ativo
                ? "Ativo"
                : "Inativo"}
                        </strong>
                    </div>

                    <div class="cliente-item">
                        <span>Propostas</span>
                        <strong>
                            ${vendedor.propostas?.length || 0}
                        </strong>
                    </div>

                </div>

                <div class="cliente-footer">

                    <button
                        class="btn-gerenciar"
                        onclick="abrirModalVendedor(${vendedor.vendedorid})">

                        Gerenciar vendedor

                    </button>

                </div>

            </div>

        `;
    });
}

if (pesquisaVendedor) {

    pesquisaVendedor.addEventListener(
        "input",
        () => {

            const termo =
                pesquisaVendedor.value
                    .toLowerCase()
                    .trim();

            const filtrados =
                vendedoresCache.filter(vendedor => {

                    return (
                        vendedor.nome
                            ?.toLowerCase()
                            .includes(termo)

                        ||

                        vendedor.email
                            ?.toLowerCase()
                            .includes(termo)

                        ||

                        vendedor.telefone
                            ?.toLowerCase()
                            .includes(termo)
                    );
                });

            renderizarVendedores(filtrados);

        }
    );
}

formVendedor.addEventListener(
    "submit",
    async (e) => {

        e.preventDefault();

        try {

            const body =
                montarBodyVendedor();

            if (!body.nome) {
                alert("Informe o nome.");
                return;
            }

            const response = await fetch(
                `${API_URL}/vendedores`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },

                    body: JSON.stringify(body)
                }
            );

            const resposta =
                await response.json();

            if (!response.ok) {

                console.log(resposta);

                alert(
                    resposta.error ||
                    "Erro ao cadastrar vendedor."
                );

                return;
            }

            const modal =
                bootstrap.Modal.getInstance(
                    document.getElementById(
                        "modalVendedor"
                    )
                );

            if (modal) {
                modal.hide();
            }

            formVendedor.reset();

            carregarVendedores();

        } catch (error) {

            console.log(error);

            alert(
                "Erro de conexão ao cadastrar vendedor."
            );
        }
    }
);

async function abrirModalVendedor(id) {

    try {

        const response = await fetch(
            `${API_URL}/vendedores/${id}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            alert("Erro ao buscar vendedor.");
            return;
        }

        const vendedor =
            await response.json();

        preencherCampo(
            "editarId",
            vendedor.vendedorid
        );

        preencherCampo(
            "editarNome",
            vendedor.nome
        );

        preencherCampo(
            "editarEmail",
            vendedor.email
        );

        preencherCampo(
            "editarTelefone",
            vendedor.telefone
        );

        preencherCampo(
            "editarAtivo",
            vendedor.ativo
                ? "true"
                : "false"
        );

        const modal =
            new bootstrap.Modal(
                document.getElementById(
                    "modalEditarVendedor"
                )
            );

        modal.show();

    } catch (error) {

        console.log(error);

        alert(
            "Erro de conexão ao abrir vendedor."
        );
    }
}

window.abrirModalVendedor =
    abrirModalVendedor;

formEditarVendedor.addEventListener(
    "submit",
    async (e) => {

        e.preventDefault();

        try {

            const id =
                pegarValor("editarId");

            if (!id) {
                alert("Vendedor inválido.");
                return;
            }

            const body =
                montarBodyVendedor("editar");

            const response = await fetch(
                `${API_URL}/vendedores/${id}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`
                    },

                    body:
                        JSON.stringify(body)
                }
            );

            const resposta =
                await response.json();

            if (!response.ok) {

                console.log(resposta);

                alert(
                    resposta.error ||
                    "Erro ao atualizar vendedor."
                );

                return;
            }

            const modal =
                bootstrap.Modal.getInstance(
                    document.getElementById(
                        "modalEditarVendedor"
                    )
                );

            if (modal) {
                modal.hide();
            }

            carregarVendedores();

        } catch (error) {

            console.log(error);

            alert(
                "Erro de conexão ao atualizar vendedor."
            );
        }
    }
);

document
    .getElementById(
        "btnExcluirVendedor"
    )
    .addEventListener(
        "click",
        async () => {

            try {

                const id =
                    pegarValor(
                        "editarId"
                    );

                if (!id) {
                    alert(
                        "Vendedor inválido."
                    );
                    return;
                }

                const confirmar =
                    confirm(
                        "Deseja excluir este vendedor?"
                    );

                if (!confirmar)
                    return;

                const response =
                    await fetch(
                        `${API_URL}/vendedores/${id}`,
                        {
                            method:
                                "DELETE",

                            headers: {
                                Authorization:
                                    `Bearer ${token}`
                            }
                        }
                    );

                const resposta =
                    await response.json();

                if (!response.ok) {

                    console.log(
                        resposta
                    );

                    alert(
                        resposta.error ||
                        "Erro ao excluir vendedor."
                    );

                    return;
                }

                const modal =
                    bootstrap.Modal.getInstance(
                        document.getElementById(
                            "modalEditarVendedor"
                        )
                    );

                if (modal) {
                    modal.hide();
                }

                carregarVendedores();

            } catch (error) {

                console.log(error);

                alert(
                    "Erro de conexão ao excluir vendedor."
                );
            }
        }
    );

carregarVendedores();