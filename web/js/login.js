const formLogin = document.getElementById("formLogin");
const btnEntrar = document.getElementById("btnEntrar");

const loginAlert = document.getElementById("loginAlert");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mostrarAlerta(el, mensagem, tipo = "error") {
    el.textContent = mensagem;
    el.classList.remove("hidden", "error", "success");
    el.classList.add(tipo);
}

function limparAlerta(el) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove("error", "success");
}

function mostrarErroCampo(elErro, input, mensagem) {
    elErro.textContent = mensagem;
    elErro.classList.remove("hidden");
    input.classList.add("is-invalid");
}

function limparErrosCampos(campos) {
    campos.forEach(({ input, erro }) => {
        erro.textContent = "";
        erro.classList.add("hidden");
        input.classList.remove("is-invalid");
    });
}

function setLoading(botao, carregando, textoPadrao) {
    botao.disabled = carregando;
    botao.textContent = carregando ? "Aguarde..." : textoPadrao;
}

async function parseJson(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function mensagemErroApi(data, response) {
    if (data?.error) {
        return typeof data.error === "string"
            ? data.error
            : "Não foi possível concluir a operação.";
    }

    if (data?.message) {
        return data.message;
    }

    if (response.status === 400) {
        return "Dados inválidos. Verifique os campos e tente novamente.";
    }

    if (response.status >= 500) {
        return "Erro no servidor. Tente novamente em alguns instantes.";
    }

    return "Não foi possível concluir a operação.";
}

function validarEmail(email) {
    return emailRegex.test(email.trim());
}

function validarLogin() {
    const email = document.getElementById("loginEmail");
    const senha = document.getElementById("loginSenha");
    const emailErro = document.getElementById("loginEmailErro");
    const senhaErro = document.getElementById("loginSenhaErro");

    const campos = [
        { input: email, erro: emailErro },
        { input: senha, erro: senhaErro }
    ];

    limparErrosCampos(campos);
    limparAlerta(loginAlert);

    let valido = true;

    if (!email.value.trim()) {
        mostrarErroCampo(emailErro, email, "Informe o e-mail.");
        valido = false;
    } else if (!validarEmail(email.value)) {
        mostrarErroCampo(emailErro, email, "Informe um e-mail válido.");
        valido = false;
    }

    if (!senha.value) {
        mostrarErroCampo(senhaErro, senha, "Informe a senha.");
        valido = false;
    }

    if (!valido) {
        mostrarAlerta(loginAlert, "Corrija os campos destacados para continuar.");
    }

    return valido;
}

formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!validarLogin()) {
        return;
    }

    const email = document.getElementById("loginEmail").value.trim();
    const senha = document.getElementById("loginSenha").value;

    setLoading(btnEntrar, true, "Entrar");
    limparAlerta(loginAlert);

    try {
        const response = await fetch(`${API_URL}/usuarios/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, senha })
        });

        const data = await parseJson(response);

        if (!response.ok) {
            mostrarAlerta(
                loginAlert,
                mensagemErroApi(data, response)
            );
            return;
        }

        if (!data?.token) {
            mostrarAlerta(
                loginAlert,
                "Resposta inválida do servidor. Tente novamente."
            );
            return;
        }

        localStorage.setItem("usuarioLogado", JSON.stringify(data));

        const role = data?.usuario?.role;

        if (role === "SUPER_ADMIN") {
            // SUPER_ADMIN não pertence a nenhuma empresa — nada de marca
            // de empresa pra carregar, e nada de cache antigo sobrando de
            // uma sessão anterior de outra conta nesse mesmo navegador.
            localStorage.removeItem("empresaBranding");
            window.location.href = "empresas.html";
            return;
        }

        // Busca a marca da empresa (logo/nome) ANTES de ir pro dashboard,
        // pra já cair na tela certa sem o "flash" da logo genérica.
        try {
            const brandingResponse = await fetch(`${API_URL}/empresas/me`, {
                headers: { Authorization: `Bearer ${data.token}` }
            });
            if (brandingResponse.ok) {
                const empresa = await brandingResponse.json();
                localStorage.setItem("empresaBranding", JSON.stringify(empresa));
            }
        } catch {
            // Se falhar, sem problema — o sidebar.js busca de novo depois.
        }

        window.location.href = "dashboard.html";
    } catch {
        mostrarAlerta(
            loginAlert,
            "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente."
        );
    } finally {
        setLoading(btnEntrar, false, "Entrar");
    }
});


document
    .querySelectorAll(".toggle-password")
    .forEach(botao => {

        botao.addEventListener("click", () => {

            const campo =
                document.getElementById(
                    botao.dataset.target
                );

            const visivel =
                campo.type === "text";

            campo.type =
                visivel
                    ? "password"
                    : "text";

            botao.textContent =
                visivel
                    ? "👀"
                    : "🙈";

        });

    });