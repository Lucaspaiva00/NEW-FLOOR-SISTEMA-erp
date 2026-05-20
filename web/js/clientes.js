const token = JSON.parse(
    localStorage.getItem("usuarioLogado")
)?.token;

if (!token) {

    window.location.href =
        "login.html";

}

/* ===================================================
   ELEMENTOS
=================================================== */

const listaClientes =
    document.getElementById("listaClientes");

const formCliente =
    document.getElementById("formCliente");

const formEditarCliente =
    document.getElementById("formEditarCliente");

const pesquisaCliente =
    document.getElementById("pesquisaCliente");

/* ===================================================
   CACHE
=================================================== */

let clientesCache = [];

/* ===================================================
   CARREGAR CLIENTES
=================================================== */

async function carregarClientes() {

    try {

        const response = await fetch(
            "http://localhost:3000/clientes",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const clientes =
            await response.json();

        clientesCache = clientes;

        atualizarKpis(clientes);

        renderizarClientes(clientes);

    } catch (error) {

        console.log(error);

    }

}

/* ===================================================
   KPIS
=================================================== */

function atualizarKpis(clientes) {

    document.getElementById(
        "kpiTotal"
    ).innerText = clientes.length;

    document.getElementById(
        "kpiAtivos"
    ).innerText = clientes.filter(c =>
        c.statusCliente === "Ativo"
    ).length;

    document.getElementById(
        "kpiNegociacao"
    ).innerText = clientes.filter(c =>
        c.statusCliente === "Negociação"
    ).length;

    document.getElementById(
        "kpiNovos"
    ).innerText = clientes.filter(c =>
        c.statusCliente === "Novo"
    ).length;

}

/* ===================================================
   STATUS
=================================================== */

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

/* ===================================================
   RENDER CLIENTES
=================================================== */

function renderizarClientes(clientes) {

    listaClientes.innerHTML = "";

    if (clientes.length === 0) {

        listaClientes.innerHTML = `

            <div class="empty-state">

                <h3>
                    Nenhum cliente encontrado
                </h3>

                <p>
                    Tente outra pesquisa.
                </p>

            </div>

        `;

        return;

    }

    clientes.forEach(cliente => {

        listaClientes.innerHTML += `

            <div class="cliente-card">

                <div class="cliente-header">

                    <div class="cliente-avatar">

                        ${cliente.nome?.charAt(0) || "C"}

                    </div>

                    <div class="cliente-header-info">

                        <h3>
                            ${cliente.nome || "-"}
                        </h3>

                        <p>
                            ${cliente.nomeFantasia || "Sem nome fantasia"}
                        </p>

                    </div>

                    ${renderizarStatus(
            cliente.statusCliente
        )}

                </div>

                <div class="cliente-body">

                    <div class="cliente-item">

                        <span>
                            Responsável
                        </span>

                        <strong>
                            ${cliente.responsavel || "-"}
                        </strong>

                    </div>

                    <div class="cliente-item">

                        <span>
                            Telefone
                        </span>

                        <strong>
                            ${cliente.telefone || "-"}
                        </strong>

                    </div>

                    <div class="cliente-item">

                        <span>
                            Email
                        </span>

                        <strong>
                            ${cliente.email || "-"}
                        </strong>

                    </div>

                    <div class="cliente-item">

                        <span>
                            Cidade
                        </span>

                        <strong>
                            ${cliente.cidade || "-"}
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

carregarClientes();

/* ===================================================
   PESQUISA
=================================================== */

pesquisaCliente.addEventListener(
    "input",
    () => {

        const termo =
            pesquisaCliente.value
                .toLowerCase();

        const filtrados =
            clientesCache.filter(cliente => {

                return (

                    cliente.nome
                        ?.toLowerCase()
                        .includes(termo)

                    ||

                    cliente.nomeFantasia
                        ?.toLowerCase()
                        .includes(termo)

                    ||

                    cliente.email
                        ?.toLowerCase()
                        .includes(termo)

                    ||

                    cliente.telefone
                        ?.toLowerCase()
                        .includes(termo)

                );

            });

        renderizarClientes(filtrados);

    }
);

/* ===================================================
   NOVO CLIENTE
=================================================== */

formCliente.addEventListener(
    "submit",
    async (e) => {

        e.preventDefault();

        try {

            const body = {

                tipo:
                    document.getElementById("tipo").value,

                nome:
                    document.getElementById("nome").value,

                nomeFantasia:
                    document.getElementById("nomeFantasia").value,

                razaoSocial:
                    document.getElementById("razaoSocial").value,

                cnpj:
                    document.getElementById("cnpj").value,

                cpf:
                    document.getElementById("cpf").value,

                inscricaoEstadual:
                    document.getElementById("inscricaoEstadual").value,

                responsavel:
                    document.getElementById("responsavel").value,

                telefone:
                    document.getElementById("telefone").value,

                telefoneSecundario:
                    document.getElementById("telefoneSecundario").value,

                whatsapp:
                    document.getElementById("whatsapp").value,

                email:
                    document.getElementById("email").value,

                site:
                    document.getElementById("site").value,

                cep:
                    document.getElementById("cep").value,

                endereco:
                    document.getElementById("endereco").value,

                numero:
                    document.getElementById("numero").value,

                complemento:
                    document.getElementById("complemento").value,

                bairro:
                    document.getElementById("bairro").value,

                cidade:
                    document.getElementById("cidade").value,

                estado:
                    document.getElementById("estado").value,

                pais:
                    document.getElementById("pais").value,

                latitude:
                    document.getElementById("latitude").value,

                longitude:
                    document.getElementById("longitude").value,

                observacoes:
                    document.getElementById("observacoes").value,

                origemLead:
                    document.getElementById("origemLead").value,

                tags:
                    document.getElementById("tags").value,

                statusCliente:
                    document.getElementById("statusCliente").value,

                limiteCredito:
                    document.getElementById("limiteCredito").value,

                descontoPadrao:
                    document.getElementById("descontoPadrao").value,

                dataNascimento:
                    document.getElementById("dataNascimento").value

            };

            const response = await fetch(
                "http://localhost:3000/clientes",
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
                    "Erro ao cadastrar cliente."
                );

                return;

            }

            bootstrap.Modal.getInstance(
                document.getElementById(
                    "modalCliente"
                )
            ).hide();

            formCliente.reset();

            carregarClientes();

        } catch (error) {

            console.log(error);

        }

    }
);

/* ===================================================
   ABRIR MODAL CLIENTE
=================================================== */

async function abrirModalCliente(id) {

    try {

        const response = await fetch(
            `http://localhost:3000/clientes/${id}`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

        const cliente =
            await response.json();

        document.getElementById(
            "editarId"
        ).value =
            cliente.clienteid || "";

        document.getElementById(
            "editarTipo"
        ).value =
            cliente.tipo || "PESSOA_JURIDICA";

        document.getElementById(
            "editarNome"
        ).value =
            cliente.nome || "";

        document.getElementById(
            "editarEmpresa"
        ).value =
            cliente.nomeFantasia || "";

        document.getElementById(
            "editarResponsavel"
        ).value =
            cliente.responsavel || "";

        document.getElementById(
            "editarCnpj"
        ).value =
            cliente.cnpj || "";

        document.getElementById(
            "editarCpf"
        ).value =
            cliente.cpf || "";

        document.getElementById(
            "editarInscricaoEstadual"
        ).value =
            cliente.inscricaoEstadual || "";

        document.getElementById(
            "editarInscricaoMunicipal"
        ).value =
            cliente.inscricaoMunicipal || "";

        document.getElementById(
            "editarSegmento"
        ).value =
            cliente.segmento || "";

        document.getElementById(
            "editarTelefone"
        ).value =
            cliente.telefone || "";

        document.getElementById(
            "editarWhatsapp"
        ).value =
            cliente.whatsapp || "";

        document.getElementById(
            "editarEmail"
        ).value =
            cliente.email || "";

        document.getElementById(
            "editarSite"
        ).value =
            cliente.site || "";

        document.getElementById(
            "editarOrigemLead"
        ).value =
            cliente.origemLead || "";

        document.getElementById(
            "editarCep"
        ).value =
            cliente.cep || "";

        document.getElementById(
            "editarEndereco"
        ).value =
            cliente.endereco || "";

        document.getElementById(
            "editarNumero"
        ).value =
            cliente.numero || "";

        document.getElementById(
            "editarBairro"
        ).value =
            cliente.bairro || "";

        document.getElementById(
            "editarCidade"
        ).value =
            cliente.cidade || "";

        document.getElementById(
            "editarEstado"
        ).value =
            cliente.estado || "";

        document.getElementById(
            "editarStatusCliente"
        ).value =
            cliente.statusCliente || "Novo";

        document.getElementById(
            "editarLimiteCredito"
        ).value =
            cliente.limiteCredito || "";

        document.getElementById(
            "editarCondicaoPagamento"
        ).value =
            cliente.condicaoPagamento || "";

        document.getElementById(
            "editarVendedorResponsavel"
        ).value =
            cliente.vendedorResponsavel || "";

        document.getElementById(
            "editarTags"
        ).value =
            cliente.tags || "";

        document.getElementById(
            "editarObservacoes"
        ).value =
            cliente.observacoes || "";

        const modal =
            new bootstrap.Modal(
                document.getElementById(
                    "modalEditarCliente"
                )
            );

        modal.show();

    } catch (error) {

        console.log(error);

    }

}

/* ===================================================
   EDITAR CLIENTE
=================================================== */

formEditarCliente.addEventListener(
    "submit",
    async (e) => {

        e.preventDefault();

        try {

            const body = {

                tipo:
                    document.getElementById("editarTipo").value,

                nome:
                    document.getElementById("editarNome").value,

                nomeFantasia:
                    document.getElementById("editarNomeFantasia").value,

                razaoSocial:
                    document.getElementById("editarRazaoSocial").value,

                cnpj:
                    document.getElementById("editarCnpj").value,

                cpf:
                    document.getElementById("editarCpf").value,

                inscricaoEstadual:
                    document.getElementById("editarInscricaoEstadual").value,

                responsavel:
                    document.getElementById("editarResponsavel").value,

                telefone:
                    document.getElementById("editarTelefone").value,

                telefoneSecundario:
                    document.getElementById("editarTelefoneSecundario").value,

                whatsapp:
                    document.getElementById("editarWhatsapp").value,

                email:
                    document.getElementById("editarEmail").value,

                site:
                    document.getElementById("editarSite").value,

                cep:
                    document.getElementById("editarCep").value,

                endereco:
                    document.getElementById("editarEndereco").value,

                numero:
                    document.getElementById("editarNumero").value,

                complemento:
                    document.getElementById("editarComplemento").value,

                bairro:
                    document.getElementById("editarBairro").value,

                cidade:
                    document.getElementById("editarCidade").value,

                estado:
                    document.getElementById("editarEstado").value,

                pais:
                    document.getElementById("editarPais").value,

                latitude:
                    document.getElementById("editarLatitude").value,

                longitude:
                    document.getElementById("editarLongitude").value,

                observacoes:
                    document.getElementById("editarObservacoes").value,

                origemLead:
                    document.getElementById("editarOrigemLead").value,

                tags:
                    document.getElementById("editarTags").value,

                statusCliente:
                    document.getElementById("editarStatusCliente").value,

                limiteCredito:
                    document.getElementById("editarLimiteCredito").value,

                descontoPadrao:
                    document.getElementById("editarDescontoPadrao").value,

                dataNascimento:
                    document.getElementById("editarDataNascimento").value

            };

            const response = await fetch(
                `http://localhost:3000/clientes/${id}`,
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
                    "Erro ao atualizar cliente."
                );

                return;

            }

            bootstrap.Modal.getInstance(
                document.getElementById(
                    "modalEditarCliente"
                )
            ).hide();

            carregarClientes();

        } catch (error) {

            console.log(error);

        }

    }
);

/* ===================================================
   EXCLUIR
=================================================== */

document.getElementById(
    "btnExcluirCliente"
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
                    "Deseja excluir este cliente?"
                );

            if (!confirmar) return;

            const response = await fetch(
                `http://localhost:3000/clientes/${id}`,
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
                    "Erro ao excluir cliente."
                );

                return;

            }

            bootstrap.Modal.getInstance(
                document.getElementById(
                    "modalEditarCliente"
                )
            ).hide();

            carregarClientes();

        } catch (error) {

            console.log(error);

        }

    }
);