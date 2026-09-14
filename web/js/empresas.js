const token = JSON.parse(
    localStorage.getItem("usuarioLogado")
)?.token;

if (!token) {
    window.location.href = "login.html";
}

const formEmpresa = document.getElementById("formEmpresa");
const listaEmpresas = document.getElementById("listaEmpresas");

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

        listaEmpresas.innerHTML = empresas.map(e => `
            <div class="d-flex justify-content-between align-items-center border-bottom py-2">
                <div>
                    <strong>${e.nome}</strong>
                    <span class="text-muted"> (${e.slug})</span>
                </div>
                <span class="badge ${e.ativo ? "bg-success" : "bg-secondary"}">
                    ${e.ativo ? "Ativa" : "Inativa"}
                </span>
            </div>
        `).join("") || "<p class='text-muted'>Nenhuma empresa cadastrada.</p>";

    } catch (error) {
        console.log(error);
        alert("Erro de conexão ao carregar empresas.");
    }
}

formEmpresa.addEventListener("submit", async (e) => {
    e.preventDefault();

    const body = {
        nome: document.getElementById("nome").value.trim(),
        slug: document.getElementById("slug").value.trim().toLowerCase(),
        adminNome: document.getElementById("adminNome").value.trim(),
        adminEmail: document.getElementById("adminEmail").value.trim(),
        adminSenha: document.getElementById("adminSenha").value
    };

    try {
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

        alert(`Empresa "${body.nome}" criada com sucesso. Admin: ${body.adminEmail}`);
        formEmpresa.reset();
        carregarEmpresas();

    } catch (error) {
        console.log(error);
        alert("Erro de conexão ao criar empresa.");
    }
});

carregarEmpresas();
