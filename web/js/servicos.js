const token = JSON.parse(
    localStorage.getItem("usuarioLogado")
)?.token;

const listaServicos = document.getElementById(
    "listaServicos"
);

const formServico = document.getElementById(
    "formServico"
);

const formEditarServico = document.getElementById(
    "formEditarServico"
);

/* =========================
   CARREGAR
========================= */

async function carregarServicos() {

    const response = await fetch(
        "http://localhost:3000/servicos",
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    const servicos = await response.json();

    listaServicos.innerHTML = "";

    servicos.forEach(servico => {

        listaServicos.innerHTML += `

            <div class="service-card">

                <div class="service-top">

                    <span>
                        ${servico.unidade || "Serviço"}
                    </span>

                    <button
                        class="btn-action"
                        onclick="abrirModalServico(${servico.servicoid})"
                    >
                        Gerenciar
                    </button>

                </div>

                <h3>
                    ${servico.nome}
                </h3>

                <p>
                    ${servico.descricao || "-"}
                </p>

                <strong>
                    R$ ${Number(servico.valor).toFixed(2)}
                </strong>

            </div>

        `;

    });

}

carregarServicos();

/* =========================
   CADASTRAR
========================= */

formServico.addEventListener("submit", async (e) => {

    e.preventDefault();

    const body = {

        nome: document.getElementById("nome").value,

        valor: Number(
            document.getElementById("valor").value
        ),

        unidade:
            document.getElementById("unidade").value,

        descricao:
            document.getElementById("descricao").value

    };

    await fetch(
        "http://localhost:3000/servicos",
        {
            method: "POST",

            headers: {

                "Content-Type": "application/json",

                Authorization: `Bearer ${token}`
            },

            body: JSON.stringify(body)
        }
    );

    location.reload();

});

/* =========================
   MODAL
========================= */

async function abrirModalServico(id) {

    const response = await fetch(
        "http://localhost:3000/servicos",
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    const servicos = await response.json();

    const servico = servicos.find(
        s => s.servicoid == id
    );

    if (!servico) return;

    document.getElementById("editarId").value =
        servico.servicoid;

    document.getElementById("editarNome").value =
        servico.nome;

    document.getElementById("editarValor").value =
        servico.valor;

    document.getElementById("editarUnidade").value =
        servico.unidade || "";

    document.getElementById("editarDescricao").value =
        servico.descricao || "";

    const modal = new bootstrap.Modal(
        document.getElementById("modalEditarServico")
    );

    modal.show();

}

/* =========================
   EDITAR
========================= */

formEditarServico.addEventListener("submit", async (e) => {

    e.preventDefault();

    const id =
        document.getElementById("editarId").value;

    const body = {

        nome:
            document.getElementById("editarNome").value,

        valor:
            Number(
                document.getElementById("editarValor").value
            ),

        unidade:
            document.getElementById("editarUnidade").value,

        descricao:
            document.getElementById("editarDescricao").value

    };

    await fetch(
        `http://localhost:3000/servicos/${id}`,
        {
            method: "PUT",

            headers: {

                "Content-Type": "application/json",

                Authorization: `Bearer ${token}`

            },

            body: JSON.stringify(body)
        }
    );

    location.reload();

});

/* =========================
   EXCLUIR
========================= */

document.getElementById(
    "btnExcluirServico"
).addEventListener("click", async () => {

    const id =
        document.getElementById("editarId").value;

    const confirmar = confirm(
        "Deseja excluir este serviço?"
    );

    if (!confirmar) return;

    await fetch(
        `http://localhost:3000/servicos/${id}`,
        {
            method: "DELETE",

            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    location.reload();

});