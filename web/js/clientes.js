const token = JSON.parse(
    localStorage.getItem("usuarioLogado")
)?.token;

if (!token) {
    window.location.href = "login.html";
}

const listaClientes = document.getElementById("listaClientes");

const formCliente = document.getElementById("formCliente");

const formEditarCliente = document.getElementById("formEditarCliente");

/* =========================
   CARREGAR CLIENTES
========================= */

async function carregarClientes() {

    try {

        const response = await fetch(
            "http://localhost:3000/clientes",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const clientes = await response.json();

        listaClientes.innerHTML = "";

        clientes.forEach(cliente => {

            listaClientes.innerHTML += `

                <tr>

                    <td>
                        <div class="cliente-info">

                            <div class="cliente-avatar">
                                ${cliente.nome.charAt(0)}
                            </div>

                            <div>

                                <strong>
                                    ${cliente.nome}
                                </strong>

                                <small>
                                    ID #${cliente.clienteid}
                                </small>

                            </div>

                        </div>
                    </td>

                    <td>
                        ${cliente.empresa || "-"}
                    </td>

                    <td>
                        ${cliente.telefone || "-"}
                    </td>

                    <td>
                        ${cliente.email || "-"}
                    </td>

                    <td align="right">

                        <button
                            class="btn-action"
                            onclick="abrirModalCliente(${cliente.clienteid})"
                        >
                            Gerenciar
                        </button>

                    </td>

                </tr>

            `;

        });

    } catch (error) {

        console.log(error);

    }

}

carregarClientes();

/* =========================
   CADASTRAR CLIENTE
========================= */

formCliente.addEventListener("submit", async (e) => {

    e.preventDefault();

    try {

        const body = {

            nome: document.getElementById("nome").value,

            empresa: document.getElementById("empresa").value,

            telefone: document.getElementById("telefone").value,

            email: document.getElementById("email").value,

            endereco: document.getElementById("endereco").value

        };

        await fetch(
            "http://localhost:3000/clientes",
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

    } catch (error) {

        console.log(error);

    }

});

/* =========================
   ABRIR MODAL
========================= */

async function abrirModalCliente(id) {

    try {

        const response = await fetch(
            "http://localhost:3000/clientes",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const clientes = await response.json();

        const cliente = clientes.find(
            c => c.clienteid == id
        );

        if (!cliente) return;

        document.getElementById("editarId").value =
            cliente.clienteid;

        document.getElementById("editarNome").value =
            cliente.nome || "";

        document.getElementById("editarEmpresa").value =
            cliente.empresa || "";

        document.getElementById("editarTelefone").value =
            cliente.telefone || "";

        document.getElementById("editarEmail").value =
            cliente.email || "";

        document.getElementById("editarEndereco").value =
            cliente.endereco || "";

        const modal = new bootstrap.Modal(
            document.getElementById("modalEditarCliente")
        );

        modal.show();

    } catch (error) {

        console.log(error);

    }

}

/* =========================
   EDITAR CLIENTE
========================= */

formEditarCliente.addEventListener("submit", async (e) => {

    e.preventDefault();

    try {

        const id =
            document.getElementById("editarId").value;

        const body = {

            nome:
                document.getElementById("editarNome").value,

            empresa:
                document.getElementById("editarEmpresa").value,

            telefone:
                document.getElementById("editarTelefone").value,

            email:
                document.getElementById("editarEmail").value,

            endereco:
                document.getElementById("editarEndereco").value

        };

        await fetch(
            `http://localhost:3000/clientes/${id}`,
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

    } catch (error) {

        console.log(error);

    }

});

/* =========================
   EXCLUIR CLIENTE
========================= */

document.getElementById(
    "btnExcluirCliente"
).addEventListener("click", async () => {

    try {

        const id =
            document.getElementById("editarId").value;

        const confirmar = confirm(
            "Deseja excluir este cliente?"
        );

        if (!confirmar) return;

        await fetch(
            `http://localhost:3000/clientes/${id}`,
            {
                method: "DELETE",

                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        location.reload();

    } catch (error) {

        console.log(error);

    }

});