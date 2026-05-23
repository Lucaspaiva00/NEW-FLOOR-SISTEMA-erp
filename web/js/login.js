const btnLogin = document.getElementById("btnLogin");

const btnCadastro = document.getElementById("btnCadastro");

const formLogin = document.getElementById("formLogin");

const formCadastro = document.getElementById("formCadastro");

btnLogin.addEventListener("click", () => {

    btnLogin.classList.add("active");

    btnCadastro.classList.remove("active");

    formLogin.style.display = "block";

    formCadastro.style.display = "none";

});

btnCadastro.addEventListener("click", () => {

    btnCadastro.classList.add("active");

    btnLogin.classList.remove("active");

    formCadastro.style.display = "block";

    formLogin.style.display = "none";

});

formCadastro.addEventListener("submit", async (e) => {

    e.preventDefault();

    const nome = document.getElementById("cadastroNome").value;

    const email = document.getElementById("cadastroEmail").value;

    const senha = document.getElementById("cadastroSenha").value;

    const response = await fetch(
        "https://new-floor-sistema-erp.onrender.com/usuarios",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                nome,
                email,
                senha
            })
        }
    );

    const data = await response.json();

    if (data.error) {

        alert(data.error);

        return;

    }

    alert("Conta criada com sucesso");

    btnLogin.click();

});

formLogin.addEventListener("submit", async (e) => {

    e.preventDefault();

    const email = document.getElementById("loginEmail").value;

    const senha = document.getElementById("loginSenha").value;

    const response = await fetch(
        "https://new-floor-sistema-erp.onrender.com/usuarios/login",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email,
                senha
            })
        }
    );

    const data = await response.json();

    if (data.error) {

        alert(data.error);

        return;

    }

    localStorage.setItem(
        "usuarioLogado",
        JSON.stringify(data)
    );

    window.location.href = "dashboard.html";

});