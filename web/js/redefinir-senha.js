const API =
    "https://new-floor-sistema-erp.onrender.com";

const emailSalvo =
    localStorage.getItem(
        "emailRecuperacao"
    );

if (emailSalvo) {

    document.getElementById("email").value =
        emailSalvo;

}

document
    .getElementById("formRedefinir")
    .addEventListener("submit", async (e) => {

        e.preventDefault();

        const email =
            document.getElementById("email").value;

        const codigo =
            document.getElementById("codigo").value;

        const senha =
            document.getElementById("senha").value;

        const confirmarSenha =
            document.getElementById(
                "confirmarSenha"
            ).value;

        if (senha !== confirmarSenha) {

            alert(
                "As senhas não conferem."
            );

            return;

        }

        try {

            const response =
                await fetch(
                    `${API}/usuarios/redefinir-senha`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            email,
                            codigo,
                            senha
                        })
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                alert(
                    data.error ||
                    "Erro ao redefinir senha"
                );

                return;

            }

            localStorage.removeItem(
                "emailRecuperacao"
            );

            alert(
                "Senha alterada com sucesso."
            );

            window.location.href =
                "login.html";

        } catch (error) {

            console.error(error);

            alert(
                "Erro ao conectar com servidor."
            );

        }

    });