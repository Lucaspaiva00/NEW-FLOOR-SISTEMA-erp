const token = JSON.parse(
    localStorage.getItem("usuarioLogado")
)?.token;

if (!token) {
    window.location.href = "login.html";
}

const listaEmpresas = document.getElementById("listaEmpresas");
const formEmpresa = document.getElementById("formEmpresa");

let empresasCache = [];

async function carregarEmpresas() {

    try {

        const response = await fetch(`${API_URL}/empresas`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {

            if (response.status === 403) {
                alert("Sua conta não tem permissão de SUPER_ADMIN para acessar isso.");
                window.location.href = "dashboard.html";
                return;
            }

            alert("Erro ao carregar empresas.");
            return;
        }

        const empresas = await response.json();

        empresasCache = Array.isArray(empresas) ? empresas : [];

        atualizarKpis(empresasCache);
        renderizarEmpresas(empresasCache);

    } catch (error) {
        console.log(error);
        alert("Erro de conexão ao carregar empresas.");
    }
}

function atualizarKpis(empresas) {
    document.getElementById("kpiTotal").innerText = empresas.length;
    document.getElementById("kpiAtivas").innerText = empresas.filter(e => e.ativo).length;
    document.getElementById("kpiInativas").innerText = empresas.filter(e => !e.ativo).length;
}

function renderizarStatus(ativo) {
    if (ativo) {
        return `<span class="status-badge status-ativo">Ativa</span>`;
    }
    return `<span class="status-badge status-inativo">Inativa</span>`;
}

function renderizarEmpresas(empresas) {

    listaEmpresas.innerHTML = "";

    if (!empresas || empresas.length === 0) {
        listaEmpresas.innerHTML = `
            <div class="empty-state">
                <h3>Nenhuma empresa cadastrada</h3>
                <p>Cadastre a primeira empresa (tenant) do sistema.</p>
            </div>
        `;
        return;
    }

    empresas.forEach(empresa => {
        listaEmpresas.innerHTML += `
            <div class="cliente-card">

                <div class="cliente-header">

                    <div class="cliente-avatar">
                        ${textoSeguro(empresa.nome?.charAt(0)?.toUpperCase())}
                    </div>

                    <div class="cliente-header-info">
                        <h3>${textoSeguro(empresa.nome)}</h3>
                        <p>${textoSeguro(empresa.slug)}</p>
                    </div>

                    ${renderizarStatus(empresa.ativo)}

                </div>

                <div class="cliente-body">

                    <div class="cliente-item">
                        <span>Contato</span>
                        <strong>${textoSeguro(empresa.emailContato) || "—"}</strong>
                    </div>

                    <div class="cliente-item">
                        <span>Telefone</span>
                        <strong>${textoSeguro(empresa.telefoneContato) || "—"}</strong>
                    </div>

                    <div class="cliente-item">
                        <span>Status</span>
                        <strong>${empresa.ativo ? "Ativa" : "Inativa"}</strong>
                    </div>

                </div>

            </div>
        `;
    });
}

formEmpresa.addEventListener("submit", async (e) => {

    e.preventDefault();

    try {

        const body = {
            nome: pegarValor("nome"),
            slug: pegarValor("slug")?.toLowerCase(),
            adminNome: pegarValor("adminNome"),
            adminEmail: pegarValor("adminEmail"),
            adminSenha: pegarValor("adminSenha"),
        };

        if (!body.nome || !body.slug || !body.adminNome || !body.adminEmail || !body.adminSenha) {
            alert("Preencha todos os campos.");
            return;
        }

        const response = await fetch(`${API_URL}/empresas`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        const resposta = await response.json();

        if (!response.ok) {
            alert(resposta.error || "Erro ao criar empresa.");
            return;
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById("modalEmpresa"));
        if (modal) modal.hide();

        formEmpresa.reset();
        alert(`Empresa "${body.nome}" criada. Admin: ${body.adminEmail}`);
        carregarEmpresas();

    } catch (error) {
        console.log(error);
        alert("Erro de conexão ao criar empresa.");
    }
});

carregarEmpresas();
