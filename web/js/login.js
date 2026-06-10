const btnLogin = document.getElementById("btnLogin");
const btnCadastro = document.getElementById("btnCadastro");
const formLogin = document.getElementById("formLogin");
const formCadastro = document.getElementById("formCadastro");
const btnEntrar = document.getElementById("btnEntrar");
const btnCriarConta = document.getElementById("btnCriarConta");

const loginAlert = document.getElementById("loginAlert");
const cadastroAlert = document.getElementById("cadastroAlert");

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

function validarCadastro() {
    const nome = document.getElementById("cadastroNome");
    const email = document.getElementById("cadastroEmail");
    const senha = document.getElementById("cadastroSenha");
    const nomeErro = document.getElementById("cadastroNomeErro");
    const emailErro = document.getElementById("cadastroEmailErro");
    const senhaErro = document.getElementById("cadastroSenhaErro");

    const campos = [
        { input: nome, erro: nomeErro },
        { input: email, erro: emailErro },
        { input: senha, erro: senhaErro }
    ];

    limparErrosCampos(campos);
    limparAlerta(cadastroAlert);

    let valido = true;

    if (!nome.value.trim()) {
        mostrarErroCampo(nomeErro, nome, "Informe o nome.");
        valido = false;
    } else if (nome.value.trim().length < 2) {
        mostrarErroCampo(nomeErro, nome, "O nome deve ter pelo menos 2 caracteres.");
        valido = false;
    }

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
    } else if (senha.value.length < 6) {
        mostrarErroCampo(senhaErro, senha, "A senha deve ter pelo menos 6 caracteres.");
        valido = false;
    }

    if (!valido) {
        mostrarAlerta(cadastroAlert, "Corrija os campos destacados para continuar.");
    }

    return valido;
}

btnLogin.addEventListener("click", () => {
    btnLogin.classList.add("active");
    btnCadastro.classList.remove("active");
    formLogin.style.display = "block";
    formCadastro.style.display = "none";
    limparAlerta(cadastroAlert);
});

btnCadastro.addEventListener("click", () => {
    btnCadastro.classList.add("active");
    btnLogin.classList.remove("active");
    formCadastro.style.display = "block";
    formLogin.style.display = "none";
    limparAlerta(loginAlert);
});

formCadastro.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!validarCadastro()) {
        return;
    }

    const nome = document.getElementById("cadastroNome").value.trim();
    const email = document.getElementById("cadastroEmail").value.trim();
    const senha = document.getElementById("cadastroSenha").value;

    setLoading(btnCriarConta, true, "Criar conta");
    limparAlerta(cadastroAlert);

    try {
        const response = await fetch(`${API_URL}/usuarios`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ nome, email, senha })
        });

        const data = await parseJson(response);

        if (!response.ok) {
            mostrarAlerta(
                cadastroAlert,
                mensagemErroApi(data, response)
            );
            return;
        }

        mostrarAlerta(
            cadastroAlert,
            "Conta criada com sucesso! Faça login para continuar.",
            "success"
        );

        formCadastro.reset();
        limparErrosCampos([
            {
                input: document.getElementById("cadastroNome"),
                erro: document.getElementById("cadastroNomeErro")
            },
            {
                input: document.getElementById("cadastroEmail"),
                erro: document.getElementById("cadastroEmailErro")
            },
            {
                input: document.getElementById("cadastroSenha"),
                erro: document.getElementById("cadastroSenhaErro")
            }
        ]);

        setTimeout(() => {
            btnLogin.click();
            document.getElementById("loginEmail").value = email;
            limparAlerta(cadastroAlert);
            mostrarAlerta(
                loginAlert,
                "Conta criada! Informe sua senha para entrar.",
                "success"
            );
        }, 1500);
    } catch {
        mostrarAlerta(
            cadastroAlert,
            "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente."
        );
    } finally {
        setLoading(btnCriarConta, false, "Criar conta");
    }
});

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
