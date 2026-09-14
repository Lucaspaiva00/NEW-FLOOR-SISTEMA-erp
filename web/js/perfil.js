const token = JSON.parse(
    localStorage.getItem("usuarioLogado")
)?.token;

if (!token) {
    window.location.href = "login.html";
}

const formPerfil = document.getElementById("formPerfil");
const inputLogo = document.getElementById("logo");
const previewLogo = document.getElementById("previewLogo");

async function carregarPerfil() {
    try {
        const response = await fetch(`${API_URL}/empresas/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
            alert("Erro ao carregar dados da empresa.");
            return;
        }

        const empresa = await response.json();

        preencherCampo("nome", empresa.nome);
        preencherCampo("logo", empresa.logo);
        preencherCampo("emailContato", empresa.emailContato);
        preencherCampo("telefoneContato", empresa.telefoneContato);

        if (empresa.corPrimaria) preencherCampo("corPrimaria", empresa.corPrimaria);
        if (empresa.corSecundaria) preencherCampo("corSecundaria", empresa.corSecundaria);

        if (empresa.logo) {
            previewLogo.src = empresa.logo;
        }

    } catch (error) {
        console.log(error);
        alert("Erro de conexão ao carregar dados da empresa.");
    }
}

inputLogo.addEventListener("input", () => {
    if (inputLogo.value) {
        previewLogo.src = inputLogo.value;
    }
});

formPerfil.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
        const body = {
            nome: pegarValor("nome"),
            logo: pegarValor("logo") || null,
            corPrimaria: pegarValor("corPrimaria"),
            corSecundaria: pegarValor("corSecundaria"),
            emailContato: pegarValor("emailContato"),
            telefoneContato: pegarValor("telefoneContato"),
        };

        const response = await fetch(`${API_URL}/empresas/me`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        const resposta = await response.json();

        if (!response.ok) {
            alert(resposta.error || "Erro ao salvar alterações.");
            return;
        }

        alert("Perfil da empresa atualizado. Recarregue a página para ver a nova logo no menu.");

    } catch (error) {
        console.log(error);
        alert("Erro de conexão ao salvar alterações.");
    }
});

carregarPerfil();
