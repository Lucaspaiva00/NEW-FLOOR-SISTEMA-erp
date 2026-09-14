const token = JSON.parse(
    localStorage.getItem("usuarioLogado")
)?.token;

if (!token) {
    window.location.href = "login.html";
}

const listaUsuarios = document.getElementById("listaUsuarios");
const formUsuario = document.getElementById("formUsuario");
const formEditarUsuario = document.getElementById("formEditarUsuario");
const pesquisaUsuario = document.getElementById("pesquisaUsuario");

let usuariosCache = [];

const rotulosRole = {
    ADMIN: "Administrador",
    SUPER_ADMIN: "Super Admin",
    VENDEDOR: "Vendedor",
    FINANCEIRO: "Financeiro",
    PADRAO: "Padrão"
};

function montarBodyNovoUsuario() {
    return {
        nome: pegarValor("nome"),
        email: pegarValor("email"),
        senha: pegarValor("senha"),
        cargo: pegarValor("cargo"),
        telefone: pegarValor("telefone"),
        role: pegarValor("role")
    };
}

function montarBodyEditarUsuario() {
    return {
        nome: pegarValor("editarNome"),
        cargo: pegarValor("editarCargo"),
        telefone: pegarValor("editarTelefone"),
        ativo: pegarValor("editarAtivo") === "true",
        role: pegarValor("editarRole")
    };
}

async function carregarUsuarios() {

    try {

        const response = await fetch(
            `${API_URL}/usuarios`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {

            if (response.status === 403) {
                alert("Sua conta não tem permissão para gerenciar usuários.");
                window.location.href = "dashboard.html";
                return;
            }

            alert("Erro ao carregar usuários.");
            return;
        }

        const usuarios = await response.json();

        usuariosCache = Array.isArray(usuarios) ? usuarios : [];

        atualizarKpis(usuariosCache);

        renderizarUsuarios(usuariosCache);

    } catch (error) {

        console.log(error);

        alert("Erro de conexão ao carregar usuários.");

    }
}

function atualizarKpis(usuarios) {

    document.getElementById("kpiTotal").innerText = usuarios.length;

    document.getElementById("kpiAtivos").innerText =
        usuarios.filter(u => u.ativo).length;

    document.getElementById("kpiInativos").innerText =
        usuarios.filter(u => !u.ativo).length;

    document.getElementById("kpiAdmins").innerText =
        usuarios.filter(u => u.role === "ADMIN" || u.role === "SUPER_ADMIN").length;
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

function renderizarUsuarios(usuarios) {

    listaUsuarios.innerHTML = "";

    if (!usuarios || usuarios.length === 0) {

        listaUsuarios.innerHTML = `
            <div class="empty-state">
                <h3>Nenhum usuário encontrado</h3>
                <p>
                    Cadastre um novo usuário da sua equipe.
                </p>
            </div>
        `;

        return;
    }

    usuarios.forEach(usuario => {

        listaUsuarios.innerHTML += `

            <div class="cliente-card">

                <div class="cliente-header">

                    <div class="cliente-avatar">

                        ${textoSeguro(
            usuario.nome
                ?.charAt(0)
                ?.toUpperCase()
        )}

                    </div>

                    <div class="cliente-header-info">

                        <h3>
                            ${textoSeguro(usuario.nome)}
                        </h3>

                        <p>
                            ${textoSeguro(usuario.email)}
                        </p>

                    </div>

                    ${renderizarStatus(usuario.ativo)}

                </div>

                <div class="cliente-body">

                    <div class="cliente-item">
                        <span>Permissão</span>
                        <strong>
                            ${rotulosRole[usuario.role] || usuario.role}
                        </strong>
                    </div>

                    <div class="cliente-item">
                        <span>Cargo</span>
                        <strong>
                            ${textoSeguro(usuario.cargo)}
                        </strong>
                    </div>

                    <div class="cliente-item">
                        <span>Telefone</span>
                        <strong>
                            ${textoSeguro(usuario.telefone)}
                        </strong>
                    </div>

                    <div class="cliente-item">
                        <span>Status</span>
                        <strong>
                            ${usuario.ativo ? "Ativo" : "Inativo"}
                        </strong>
                    </div>

                </div>

                <div class="cliente-footer">

                    <button
                        class="btn-gerenciar"
                        onclick="abrirModalUsuario(${usuario.usuarioid})">

                        Gerenciar usuário

                    </button>

                </div>

            </div>

        `;
    });
}

if (pesquisaUsuario) {

    pesquisaUsuario.addEventListener(
        "input",
        () => {

            const termo = pesquisaUsuario.value.toLowerCase().trim();

            const filtrados = usuariosCache.filter(usuario => {

                return (
                    usuario.nome?.toLowerCase().includes(termo)
                    ||
                    usuario.email?.toLowerCase().includes(termo)
                    ||
                    usuario.cargo?.toLowerCase().includes(termo)
                );
            });

            renderizarUsuarios(filtrados);

        }
    );
}

formUsuario.addEventListener(
    "submit",
    async (e) => {

        e.preventDefault();

        try {

            const body = montarBodyNovoUsuario();

            if (!body.nome || !body.email || !body.senha) {
                alert("Informe nome, e-mail e senha.");
                return;
            }

            if (body.senha.length < 6) {
                alert("A senha precisa ter pelo menos 6 caracteres.");
                return;
            }

            const response = await fetch(
                `${API_URL}/usuarios`,
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

                alert(resposta.error || "Erro ao cadastrar usuário.");

                return;
            }

            const modal = bootstrap.Modal.getInstance(
                document.getElementById("modalUsuario")
            );

            if (modal) {
                modal.hide();
            }

            formUsuario.reset();

            carregarUsuarios();

        } catch (error) {

            console.log(error);

            alert("Erro de conexão ao cadastrar usuário.");
        }
    }
);

function abrirModalUsuario(id) {

    const usuario = usuariosCache.find(u => u.usuarioid === id);

    if (!usuario) {
        alert("Usuário não encontrado.");
        return;
    }

    preencherCampo("editarId", usuario.usuarioid);
    preencherCampo("editarNome", usuario.nome);
    preencherCampo("editarEmail", usuario.email);
    preencherCampo("editarCargo", usuario.cargo);
    preencherCampo("editarTelefone", usuario.telefone);
    preencherCampo("editarAtivo", usuario.ativo ? "true" : "false");
    preencherCampo("editarRole", usuario.role);

    const modal = new bootstrap.Modal(
        document.getElementById("modalEditarUsuario")
    );

    modal.show();
}

window.abrirModalUsuario = abrirModalUsuario;

formEditarUsuario.addEventListener(
    "submit",
    async (e) => {

        e.preventDefault();

        try {

            const id = pegarValor("editarId");

            if (!id) {
                alert("Usuário inválido.");
                return;
            }

            const body = montarBodyEditarUsuario();

            const response = await fetch(
                `${API_URL}/usuarios/${id}`,
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

                alert(resposta.error || "Erro ao atualizar usuário.");

                return;
            }

            const modal = bootstrap.Modal.getInstance(
                document.getElementById("modalEditarUsuario")
            );

            if (modal) {
                modal.hide();
            }

            carregarUsuarios();

        } catch (error) {

            console.log(error);

            alert("Erro de conexão ao atualizar usuário.");
        }
    }
);

document
    .getElementById("btnExcluirUsuario")
    .addEventListener(
        "click",
        async () => {

            try {

                const id = pegarValor("editarId");

                if (!id) {
                    alert("Usuário inválido.");
                    return;
                }

                const confirmar = confirm("Deseja excluir este usuário?");

                if (!confirmar) return;

                const response = await fetch(
                    `${API_URL}/usuarios/${id}`,
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

                    alert(resposta.error || "Erro ao excluir usuário.");

                    return;
                }

                const modal = bootstrap.Modal.getInstance(
                    document.getElementById("modalEditarUsuario")
                );

                if (modal) {
                    modal.hide();
                }

                carregarUsuarios();

            } catch (error) {

                console.log(error);

                alert("Erro de conexão ao excluir usuário.");
            }
        }
    );

carregarUsuarios();
