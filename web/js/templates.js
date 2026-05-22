const API_URL = "http://localhost:3000";

const token =
    JSON.parse(
        localStorage.getItem("usuarioLogado")
    )?.token;

const listaTemplates =
    document.getElementById(
        "listaTemplates"
    );

const formTemplate =
    document.getElementById(
        "formTemplate"
    );

async function carregarTemplates() {

    const response =
        await fetch(
            `${API_URL}/templates`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

    const templates =
        await response.json();

    listaTemplates.innerHTML = "";

    templates.forEach(t => {

        listaTemplates.innerHTML += `
            <tr>

                <td>${t.nome}</td>

                <td>
                    <span style="
                        display:inline-block;
                        width:30px;
                        height:30px;
                        border-radius:50%;
                        background:${t.corPrimaria || "#111827"};
                    "></span>
                </td>

                <td>
                    ${t.ativo ? "Ativo" : "Inativo"}
                </td>

                <td>

                    <button
                        class="btn btn-dark btn-sm"
                        onclick="editarTemplate(${t.templateid})">

                        Editar

                    </button>

                </td>

            </tr>
        `;

    });

}

async function editarTemplate(id) {

    const response =
        await fetch(
            `${API_URL}/templates/${id}`
        );

    const t =
        await response.json();

    Object.keys(t).forEach(chave => {

        const campo =
            document.getElementById(chave);

        if (!campo) return;

        if (campo.type === "checkbox") {

            campo.checked = t[chave];

        } else {

            campo.value = t[chave] || "";

        }

    });

    new bootstrap.Modal(
        document.getElementById(
            "modalTemplate"
        )
    ).show();

}

formTemplate.addEventListener(
    "submit",
    async e => {

        e.preventDefault();

        const body = {

            nome:
                nome.value,

            ativo:
                ativo.checked,

            corPrimaria:
                corPrimaria.value,

            corSecundaria:
                corSecundaria.value,

            cabecalho:
                cabecalho.value,

            rodape:
                rodape.value,

            textoApresentacao:
                textoApresentacao.value,

            textoGarantia:
                textoGarantia.value,

            textoPagamento:
                textoPagamento.value,

            textoObservacao:
                textoObservacao.value,

            exibirLogo:
                exibirLogo.checked,

            exibirEndereco:
                exibirEndereco.checked,

            exibirTelefone:
                exibirTelefone.checked,

            exibirEmail:
                exibirEmail.checked,

            exibirAssinatura:
                exibirAssinatura.checked,

            htmlPersonalizado:
                htmlPersonalizado.value,

            cssPersonalizado:
                cssPersonalizado.value

        };

        const id =
            templateid.value;

        await fetch(

            id
                ? `${API_URL}/templates/${id}`
                : `${API_URL}/templates`,

            {

                method:
                    id
                        ? "PUT"
                        : "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${token}`

                },

                body:
                    JSON.stringify(body)

            }

        );

        location.reload();

    }
);

carregarTemplates();