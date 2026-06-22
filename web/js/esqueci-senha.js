const API =
    "https://new-floor-sistema-erp.onrender.com";

document
    .getElementById("formRecuperacao")
    .addEventListener("submit", async (e) => {

        e.preventDefault();

        const email =
            document.getElementById("email").value;

        try {

            const response =
                await fetch(
                    `${API}/usuarios/esqueci-senha`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            email
                        })
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                alert(
                    data.error ||
                    "Erro ao enviar código"
                );

                return;

            }

            localStorage.setItem(
                "emailRecuperacao",
                email
            );

            alert(
                "Código enviado para seu e-mail."
            );

            window.location.href =
                "redefinir-senha.html";

        } catch (error) {

            console.error(error);

            alert(
                "Erro ao conectar com servidor."
            );

        }

    });