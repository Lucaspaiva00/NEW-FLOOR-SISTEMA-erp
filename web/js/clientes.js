const CLOUDINARY_UPLOAD_URL =
  "https://api.cloudinary.com/v1_1/dfdinbti3/image/upload";

const token = JSON.parse(localStorage.getItem("usuarioLogado"))?.token;

if (!token) {
  window.location.href = "login.html";
}

const listaClientes = document.getElementById("listaClientes");
const formCliente = document.getElementById("formCliente");
const formEditarCliente = document.getElementById("formEditarCliente");
const pesquisaCliente = document.getElementById("pesquisaCliente");

let clientesCache = [];

const MAX_CONTATOS = 4;

function idCampoContato(tipo, index, prefixo = "") {
  const nome = `${tipo}${index}`;

  if (!prefixo) return nome;

  return `${prefixo}${nome.charAt(0).toUpperCase()}${nome.slice(1)}`;
}

function pegarListaContato(prefixo, tipo) {
  const seletor = `[data-contato-grupo][data-prefix="${prefixo}"] .contato-lista[data-tipo="${tipo}"]`;

  return document.querySelector(seletor);
}

function contatosVisiveis(lista) {
  return [...lista.querySelectorAll(".contato-item")].filter(
    (item) => !item.classList.contains("campo-oculto"),
  );
}

function atualizarBotaoAdicionarContato(grupo, tipo) {
  const lista = grupo.querySelector(`.contato-lista[data-tipo="${tipo}"]`);
  const botao = grupo.querySelector(
    `.btn-contato-adicionar[data-tipo="${tipo}"]`,
  );

  if (!lista || !botao) return;

  const visiveis = contatosVisiveis(lista).length;
  botao.disabled = visiveis >= MAX_CONTATOS;
}

function revelarProximoContato(prefixo, tipo) {
  const lista = pegarListaContato(prefixo, tipo);

  if (!lista) return;

  const proximo = lista.querySelector(".contato-extra.campo-oculto");

  if (!proximo) return;

  proximo.classList.remove("campo-oculto");
  proximo.querySelector("input")?.focus();

  const grupo = lista.closest("[data-contato-grupo]");
  if (grupo) atualizarBotaoAdicionarContato(grupo, tipo);
}

function removerContato(item, prefixo, tipo) {
  const input = item.querySelector("input");

  if (input) input.value = "";

  item.classList.add("campo-oculto");

  const grupo = item.closest("[data-contato-grupo]");
  if (grupo) atualizarBotaoAdicionarContato(grupo, tipo);
}

function sincronizarVisibilidadeContatos(prefixo = "") {
  ["telefone", "email"].forEach((tipo) => {
    const lista = pegarListaContato(prefixo, tipo);

    if (!lista) return;

    for (let i = 2; i <= MAX_CONTATOS; i++) {
      const item = lista.querySelector(`[data-index="${i}"]`);
      const valor = pegarValor(idCampoContato(tipo, i, prefixo));

      if (item) {
        item.classList.toggle("campo-oculto", !valor);
      }
    }

    const grupo = lista.closest("[data-contato-grupo]");
    if (grupo) atualizarBotaoAdicionarContato(grupo, tipo);
  });
}

function resetarContatos(prefixo = "") {
  ["telefone", "email"].forEach((tipo) => {
    const lista = pegarListaContato(prefixo, tipo);

    if (!lista) return;

    lista.querySelectorAll(".contato-extra").forEach((item) => {
      item.classList.add("campo-oculto");
    });

    const grupo = lista.closest("[data-contato-grupo]");
    if (grupo) atualizarBotaoAdicionarContato(grupo, tipo);
  });
}

function configurarContatosDinamicos() {
  document.querySelectorAll("[data-contato-grupo]").forEach((grupo) => {
    const prefixo = grupo.dataset.prefix || "";

    grupo.querySelectorAll(".btn-contato-adicionar").forEach((botao) => {
      botao.addEventListener("click", () => {
        revelarProximoContato(prefixo, botao.dataset.tipo);
      });
    });

    grupo.querySelectorAll(".contato-item.contato-extra").forEach((item) => {
      const lista = item.closest(".contato-lista");
      const tipo = lista?.dataset.tipo;

      item.querySelector(".btn-contato-remover")?.addEventListener("click", () => {
        removerContato(item, prefixo, tipo);
      });
    });

    ["telefone", "email"].forEach((tipo) => {
      atualizarBotaoAdicionarContato(grupo, tipo);
    });
  });
}

function formatarContatosExtras(valores) {
  const preenchidos = valores.filter(Boolean);

  if (!preenchidos.length) return textoSeguro("");

  if (preenchidos.length === 1) {
    return textoSeguro(preenchidos[0]);
  }

  return `${textoSeguro(preenchidos[0])} <span class="contato-mais">+${preenchidos.length - 1}</span>`;
}

function montarBodyCliente(prefixo = "") {
  const campo = (nome) => {
    if (!prefixo) return nome;

    return `${prefixo}${nome.charAt(0).toUpperCase()}${nome.slice(1)}`;
  };

  return {
    tipo: pegarValor(campo("tipo")) || "PESSOA_JURIDICA",

    nomeFantasia: pegarValor(campo("nomeFantasia")),

    razaoSocial: pegarValor(campo("razaoSocial")),

    cnpj: pegarValor(campo("cnpj")),

    cpf: pegarValor(campo("cpf")),

    inscricaoEstadual: pegarValor(campo("inscricaoEstadual")),

    responsavel: pegarValor(campo("responsavel")),

    telefone1: pegarValor(campo("telefone1")),

    telefone2: pegarValor(campo("telefone2")),

    telefone3: pegarValor(campo("telefone3")),

    telefone4: pegarValor(campo("telefone4")),

    email1: pegarValor(campo("email1")),

    email2: pegarValor(campo("email2")),

    email3: pegarValor(campo("email3")),

    email4: pegarValor(campo("email4")),

    site: pegarValor(campo("site")),

    cep: pegarValor(campo("cep")),

    endereco: pegarValor(campo("endereco")),

    numero: pegarValor(campo("numero")),

    complemento: pegarValor(campo("complemento")),

    bairro: pegarValor(campo("bairro")),

    cidade: pegarValor(campo("cidade")),

    estado: pegarValor(campo("estado")),

    pais: pegarValor(campo("pais")) || "Brasil",

    observacoes: pegarValor(campo("observacoes")),

    origemLead: pegarValor(campo("origemLead")),

    tags: pegarValor(campo("tags")),

    statusCliente: pegarValor(campo("statusCliente")) || "Novo",

    limiteCredito: pegarNumero(campo("limiteCredito")),

    descontoPadrao: pegarNumero(campo("descontoPadrao")),

    logo: pegarValor(campo("logo")),

    dataNascimento: pegarValor(campo("dataNascimento")),
  };
}

async function uploadLogoCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "newfloor");
  formData.append("folder", "newfloor/clientes");

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Erro ao enviar logo.");
  }

  return data.secure_url;
}

function atualizarPreviewLogo(previewId, url) {
  const preview = document.getElementById(previewId);

  if (!preview) return;

  if (url) {
    preview.innerHTML = `<img src="${url}" alt="Logo cliente">`;
    return;
  }

  preview.innerHTML = "Nenhuma logo selecionada";
}

function configurarPreviewLogo(fileId, previewId) {
  const fileInput = document.getElementById(fileId);

  if (!fileInput) return;

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      atualizarPreviewLogo(previewId, event.target?.result);
    };

    reader.readAsDataURL(file);
  });
}

async function resolverLogo(prefixo = "") {
  const campo = (nome) => {
    if (!prefixo) return nome;

    return `${prefixo}${nome.charAt(0).toUpperCase()}${nome.slice(1)}`;
  };

  const fileInput = document.getElementById(campo("logoFile"));
  const hiddenInput = document.getElementById(campo("logo"));

  if (fileInput?.files?.[0]) {
    const url = await uploadLogoCloudinary(fileInput.files[0]);

    if (hiddenInput) {
      hiddenInput.value = url;
    }

    return url;
  }

  return pegarValor(campo("logo"));
}

function preencherCampoMascarado(id, valor, mascara) {
  if (!valor) {
    preencherCampo(id, "");
    return;
  }

  preencherCampo(id, formatarComMascara(valor, mascara));
}

const TOTAL_STEPS_CLIENTE = 4;

function validarStepCliente(step, prefixo = "") {
  if (step !== 1) return true;

  const campo = (nome) => {
    if (!prefixo) return nome;

    return `${prefixo}${nome.charAt(0).toUpperCase()}${nome.slice(1)}`;
  };

  const razaoSocial = pegarValor(campo("razaoSocial"));
  const nomeFantasia = pegarValor(campo("nomeFantasia"));

  if (!razaoSocial && !nomeFantasia) {
    alert("Informe a razão social ou nome fantasia.");
    return false;
  }

  return true;
}

function criarWizardCliente({
  form,
  modal,
  nav,
  btnProximo,
  btnSalvar,
  prefixo = "",
}) {
  let stepAtual = 1;

  function atualizarBotoes() {
    btnProximo?.classList.toggle("d-none", stepAtual === TOTAL_STEPS_CLIENTE);
    btnSalvar?.classList.toggle("d-none", stepAtual !== TOTAL_STEPS_CLIENTE);
  }

  function irParaStep(step) {
    stepAtual = Math.max(1, Math.min(TOTAL_STEPS_CLIENTE, step));

    form.querySelectorAll(".form-step").forEach((elemento) => {
      elemento.classList.toggle(
        "active",
        Number(elemento.dataset.step) === stepAtual,
      );
    });

    nav?.querySelectorAll(".step-pill").forEach((pill) => {
      const numero = Number(pill.dataset.step);

      pill.classList.toggle("active", numero === stepAtual);
      pill.classList.toggle("done", numero < stepAtual);
    });

    atualizarBotoes();
  }

  btnProximo?.addEventListener("click", () => {
    if (!validarStepCliente(stepAtual, prefixo)) return;

    irParaStep(stepAtual + 1);
  });

  nav?.querySelectorAll(".step-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const destino = Number(pill.dataset.step);

      if (destino <= stepAtual) {
        irParaStep(destino);
        return;
      }

      if (validarStepCliente(stepAtual, prefixo)) {
        irParaStep(destino);
      }
    });
  });

  modal?.addEventListener("hidden.bs.modal", () => {
    irParaStep(1);
  });

  irParaStep(1);

  return { irParaStep };
}

function atualizarCamposPorTipo(prefixo = "") {
  const campo = (nome) => {
    if (!prefixo) return nome;

    return `${prefixo}${nome.charAt(0).toUpperCase()}${nome.slice(1)}`;
  };

  const form = prefixo ? formEditarCliente : formCliente;
  const tipo = pegarValor(campo("tipo")) || "PESSOA_JURIDICA";
  const isPj = tipo === "PESSOA_JURIDICA";

  form.querySelectorAll(".campo-pj").forEach((elemento) => {
    elemento.classList.toggle("campo-oculto", !isPj);
  });

  form.querySelectorAll(".campo-pf").forEach((elemento) => {
    elemento.classList.toggle("campo-oculto", isPj);
  });

  const labelRazao = document.getElementById(
    prefixo ? "labelEditarRazaoSocial" : "labelRazaoSocial",
  );

  if (labelRazao) {
    labelRazao.textContent = isPj ? "Razão social" : "Nome completo";
  }
}

async function carregarClientes() {
  try {
    const response = await fetch(`${API_URL}/clientes`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      alert("Erro ao carregar clientes.");
      return;
    }

    const clientes = await response.json();

    clientesCache = Array.isArray(clientes) ? clientes : [];

    atualizarKpis(clientesCache);

    renderizarClientes(clientesCache);
  } catch (error) {
    console.log(error);
    alert("Erro de conexão ao carregar clientes.");
  }
}

function atualizarKpis(clientes) {
  document.getElementById("kpiTotal").innerText = clientes.length;

  document.getElementById("kpiAtivos").innerText = clientes.filter(
    (cliente) => cliente.statusCliente === "Ativo",
  ).length;

  document.getElementById("kpiNegociacao").innerText = clientes.filter(
    (cliente) => cliente.statusCliente === "Negociação",
  ).length;

  document.getElementById("kpiNovos").innerText = clientes.filter(
    (cliente) => cliente.statusCliente === "Novo",
  ).length;
}

function setLoading(botao, carregando, textoPadrao) {
  if (!botao) return;

  botao.disabled = carregando;
  botao.textContent = carregando ? "Salvando..." : textoPadrao;
}

function renderizarAvatarCliente(cliente) {
  const nome = cliente.nomeFantasia || cliente.razaoSocial || "C";
  const inicial = nome.charAt(0).toUpperCase();

  if (cliente.logo) {
    return `
      <div class="cliente-avatar cliente-avatar--logo">
        <img src="${textoSeguro(cliente.logo)}" alt="${textoSeguro(nome)}">
      </div>
    `;
  }

  return `
    <div class="cliente-avatar">
      ${textoSeguro(inicial)}
    </div>
  `;
}

function renderizarStatus(status) {
  if (status === "Ativo") {
    return `
            <span class="status-badge status-ativo">
                Ativo
            </span>
        `;
  }

  if (status === "Negociação") {
    return `
            <span class="status-badge status-negociacao">
                Negociação
            </span>
        `;
  }

  return `
        <span class="status-badge status-novo">
            Novo
        </span>
    `;
}

function renderizarClientes(clientes) {
  listaClientes.innerHTML = "";

  if (!clientes || clientes.length === 0) {
    listaClientes.innerHTML = `
            <div class="empty-state">
                <h3>Nenhum cliente encontrado</h3>
                <p>Cadastre um novo cliente ou tente outra pesquisa.</p>
            </div>
        `;

    return;
  }

  clientes.forEach((cliente) => {
    listaClientes.innerHTML += `
    <div class="cliente-card">

        <div class="cliente-header">

            ${renderizarAvatarCliente(cliente)}

            <div class="cliente-header-info">
                <h3>
                    ${textoSeguro(
                      cliente.nomeFantasia || cliente.razaoSocial || "Sem nome",
                    )}
                </h3>

                <p>
                    ${textoSeguro(cliente.responsavel)}
                </p>
            </div>

            ${renderizarStatus(cliente.statusCliente)}

        </div>

        <div class="cliente-body">

            <div class="cliente-item">
                <span>Responsável</span>
                <strong>${textoSeguro(cliente.responsavel)}</strong>
            </div>

            <div class="cliente-item">
                <span>Telefones</span>
                <strong>${formatarContatosExtras([
                  cliente.telefone1,
                  cliente.telefone2,
                  cliente.telefone3,
                  cliente.telefone4,
                ])}</strong>
            </div>

            <div class="cliente-item">
                <span>E-mails</span>
                <strong>${formatarContatosExtras([
                  cliente.email1,
                  cliente.email2,
                  cliente.email3,
                  cliente.email4,
                ])}</strong>
            </div>

            <div class="cliente-item">
                <span>Cidade</span>
                <strong>${textoSeguro(cliente.cidade)}</strong>
            </div>

            <div class="cliente-item">
                <span>CNPJ / CPF</span>
                <strong>
                    ${textoSeguro(
                      cliente.cnpj
                        ? formatarComMascara(cliente.cnpj, "cnpj")
                        : formatarComMascara(cliente.cpf, "cpf"),
                    )}
                </strong>
            </div>

        </div>

        <div class="cliente-footer">

            <button
                class="btn-gerenciar"
                onclick="abrirModalCliente(${cliente.clienteid})"
            >
                Gerenciar cliente
            </button>

        </div>

    </div>
`;
  });
}

if (pesquisaCliente) {
  pesquisaCliente.addEventListener("input", () => {
    const termo = pesquisaCliente.value.toLowerCase().trim();

    const filtrados = clientesCache.filter((cliente) => {
      return (
        cliente.nomeFantasia?.toLowerCase().includes(termo) ||
        cliente.nomeFantasia?.toLowerCase().includes(termo) ||
        cliente.razaoSocial?.toLowerCase().includes(termo) ||
        cliente.email1?.toLowerCase().includes(termo) ||
        cliente.email2?.toLowerCase().includes(termo) ||
        cliente.email3?.toLowerCase().includes(termo) ||
        cliente.email4?.toLowerCase().includes(termo) ||
        cliente.telefone1?.toLowerCase().includes(termo) ||
        cliente.telefone2?.toLowerCase().includes(termo) ||
        cliente.telefone3?.toLowerCase().includes(termo) ||
        cliente.telefone4?.toLowerCase().includes(termo) ||
        cliente.cnpj?.toLowerCase().includes(termo) ||
        cliente.cpf?.toLowerCase().includes(termo) ||
        cliente.cidade?.toLowerCase().includes(termo)
      );
    });

    renderizarClientes(filtrados);
  });
}

const btnSalvarCliente = document.getElementById("btnSalvarCliente");
const btnSalvarEditar = document.getElementById("btnSalvarEditar");

formCliente.addEventListener("submit", async (e) => {
  e.preventDefault();

  setLoading(btnSalvarCliente, true, "Salvar cliente");

  try {
    const body = montarBodyCliente();

    if (!body.nomeFantasia && !body.razaoSocial) {
      alert("Informe o Nome Fantasia ou Razão Social.");
      return;
    }

    body.logo = await resolverLogo();

    const response = await fetch(`${API_URL}/clientes`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify(body),
    });

    const resposta = await response.json();

    if (!response.ok) {
      console.log(resposta);
      alert(resposta.error || "Erro ao cadastrar cliente.");
      return;
    }

    const modal = bootstrap.Modal.getInstance(
      document.getElementById("modalCliente"),
    );

    if (modal) {
      modal.hide();
    }

    formCliente.reset();

    preencherCampo("pais", "Brasil");
    atualizarPreviewLogo("logoPreview", null);
    atualizarCamposPorTipo();
    resetarContatos();
    wizardCliente.irParaStep(1);

    carregarClientes();
  } catch (error) {
    console.log(error);
    alert("Erro de conexão ao cadastrar cliente.");
  } finally {
    setLoading(btnSalvarCliente, false, "Salvar cliente");
  }
});

async function abrirModalCliente(id) {
  try {
    const response = await fetch(`${API_URL}/clientes/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      alert("Erro ao buscar cliente.");
      return;
    }

    const cliente = await response.json();

    preencherCampo("editarId", cliente.clienteid);

    preencherCampo("editarTipo", cliente.tipo || "PESSOA_JURIDICA");

    preencherCampo("editarNomeFantasia", cliente.nomeFantasia);

    preencherCampo("editarRazaoSocial", cliente.razaoSocial);

    preencherCampoMascarado("editarCnpj", cliente.cnpj, "cnpj");
    preencherCampoMascarado("editarCpf", cliente.cpf, "cpf");

    preencherCampo("editarInscricaoEstadual", cliente.inscricaoEstadual);

    preencherCampo("editarResponsavel", cliente.responsavel);

    preencherCampoMascarado("editarTelefone1", cliente.telefone1, "telefone");
    preencherCampoMascarado("editarTelefone2", cliente.telefone2, "telefone");
    preencherCampoMascarado("editarTelefone3", cliente.telefone3, "telefone");
    preencherCampoMascarado("editarTelefone4", cliente.telefone4, "telefone");

    preencherCampo("editarEmail1", cliente.email1);
    preencherCampo("editarEmail2", cliente.email2);
    preencherCampo("editarEmail3", cliente.email3);
    preencherCampo("editarEmail4", cliente.email4);

    preencherCampo("editarSite", cliente.site);

    preencherCampoMascarado("editarCep", cliente.cep, "cep");

    preencherCampo("editarEndereco", cliente.endereco);

    preencherCampo("editarNumero", cliente.numero);

    preencherCampo("editarComplemento", cliente.complemento);

    preencherCampo("editarBairro", cliente.bairro);

    preencherCampo("editarCidade", cliente.cidade);

    preencherCampo("editarEstado", cliente.estado);

    preencherCampo("editarPais", cliente.pais || "Brasil");

    preencherCampo("editarOrigemLead", cliente.origemLead);

    preencherCampo("editarTags", cliente.tags);

    preencherCampo("editarStatusCliente", cliente.statusCliente || "Novo");

    preencherCampo("editarLimiteCredito", cliente.limiteCredito);

    preencherCampo("editarDescontoPadrao", cliente.descontoPadrao);

    preencherCampo(
      "editarDataNascimento",
      formatarDataParaInput(cliente.dataNascimento),
    );

    preencherCampo("editarObservacoes", cliente.observacoes);

    preencherCampo("editarLogo", cliente.logo);
    atualizarPreviewLogo("editarLogoPreview", cliente.logo);

    const fileInputEditar = document.getElementById("editarLogoFile");
    if (fileInputEditar) {
      fileInputEditar.value = "";
    }

    atualizarCamposPorTipo("editar");
    sincronizarVisibilidadeContatos("editar");
    wizardEditarCliente.irParaStep(1);

    const modal = new bootstrap.Modal(
      document.getElementById("modalEditarCliente"),
    );

    modal.show();
  } catch (error) {
    console.log(error);
    alert("Erro de conexão ao abrir cliente.");
  }
}

formEditarCliente.addEventListener("submit", async (e) => {
  e.preventDefault();

  setLoading(btnSalvarEditar, true, "Salvar alterações");

  try {
    const id = pegarValor("editarId");

    if (!id) {
      alert("Cliente inválido.");
      return;
    }

    const body = montarBodyCliente("editar");

    if (!body.nomeFantasia && !body.razaoSocial) {
      alert("Informe o Nome Fantasia ou Razão Social.");
      return;
    }

    body.logo = await resolverLogo("editar");

    const response = await fetch(`${API_URL}/clientes/${id}`, {
      method: "PUT",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify(body),
    });

    const resposta = await response.json();

    if (!response.ok) {
      console.log(resposta);
      alert(resposta.error || "Erro ao atualizar cliente.");
      return;
    }

    const modal = bootstrap.Modal.getInstance(
      document.getElementById("modalEditarCliente"),
    );

    if (modal) {
      modal.hide();
    }

    carregarClientes();
  } catch (error) {
    console.log(error);
    alert("Erro de conexão ao atualizar cliente.");
  } finally {
    setLoading(btnSalvarEditar, false, "Salvar alterações");
  }
});

document
  .getElementById("btnExcluirCliente")
  .addEventListener("click", async () => {
    try {
      const id = pegarValor("editarId");

      if (!id) {
        alert("Cliente inválido.");
        return;
      }

      const confirmar = confirm("Deseja excluir este cliente?");

      if (!confirmar) return;

      const response = await fetch(`${API_URL}/clientes/${id}`, {
        method: "DELETE",

        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const resposta = await response.json();

      if (!response.ok) {
        console.log(resposta);
        alert(resposta.error || "Erro ao excluir cliente.");
        return;
      }

      const modal = bootstrap.Modal.getInstance(
        document.getElementById("modalEditarCliente"),
      );

      if (modal) {
        modal.hide();
      }

      carregarClientes();
    } catch (error) {
      console.log(error);
      alert("Erro de conexão ao excluir cliente.");
    }
  });

/*
|--------------------------------------------------------------------------
| CONSULTA AUTOMÁTICA DE CNPJ
|--------------------------------------------------------------------------
*/

async function consultarCnpj(campoCnpj, prefixo = "") {
  if (!campoCnpj) return;

  const cnpj = campoCnpj.value.replace(/\D/g, "");

  if (cnpj.length !== 14) {
    return;
  }

  const campo = (nome) => {
    if (!prefixo) return nome;

    return `${prefixo}${nome.charAt(0).toUpperCase()}${nome.slice(1)}`;
  };

  try {
    campoCnpj.disabled = true;

    const response = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
    );

    if (!response.ok) {
      throw new Error("CNPJ não encontrado");
    }

    const empresa = await response.json();

    preencherCampo(campo("razaoSocial"), empresa.razao_social);
    preencherCampo(campo("nomeFantasia"), empresa.nome_fantasia);
    preencherCampoMascarado(campo("cep"), empresa.cep, "cep");
    preencherCampo(campo("endereco"), empresa.logradouro);
    preencherCampo(campo("numero"), empresa.numero);
    preencherCampo(campo("bairro"), empresa.bairro);
    preencherCampo(campo("cidade"), empresa.municipio);
    preencherCampo(campo("estado"), empresa.uf);
    preencherCampo(campo("email1"), empresa.email);
    preencherCampoMascarado(
      campo("telefone1"),
      empresa.ddd_telefone_1,
      "telefone",
    );
  } catch (error) {
    console.log(error);
    alert("Não foi possível consultar o CNPJ.");
  } finally {
    campoCnpj.disabled = false;
  }
}

function preencherClienteMock() {
  const sufixo = Date.now().toString().slice(-4);

  preencherCampo("tipo", "PESSOA_JURIDICA");
  atualizarCamposPorTipo();

  preencherCampo("razaoSocial", `Empresa Mock Ltda ${sufixo}`);
  preencherCampo("nomeFantasia", `Mock Floor ${sufixo}`);
  preencherCampoMascarado("cnpj", "11444777000161", "cnpj");
  preencherCampo("inscricaoEstadual", "123456789");
  preencherCampo("responsavel", "João Silva");

  preencherCampoMascarado("telefone1", "11987654321", "telefone");
  preencherCampoMascarado("telefone2", "1133334444", "telefone");
  preencherCampoMascarado("telefone3", "11999887766", "telefone");

  preencherCampo("email1", `contato.mock${sufixo}@email.com`);
  preencherCampo("email2", `financeiro.mock${sufixo}@email.com`);

  sincronizarVisibilidadeContatos();
  preencherCampo("site", "https://www.mockfloor.com.br");
  preencherCampo("origemLead", "Teste interno");

  preencherCampoMascarado("cep", "01310100", "cep");
  preencherCampo("endereco", "Av. Paulista");
  preencherCampo("numero", "1000");
  preencherCampo("complemento", "Sala 42");
  preencherCampo("bairro", "Bela Vista");
  preencherCampo("cidade", "São Paulo");
  preencherCampo("estado", "SP");
  preencherCampo("pais", "Brasil");

  preencherCampo("statusCliente", "Novo");
  preencherCampo("limiteCredito", "50000");
  preencherCampo("descontoPadrao", "5");
  preencherCampo("tags", "mock, teste");
  preencherCampo(
    "observacoes",
    "Cliente gerado automaticamente para testes do sistema.",
  );
}

function configurarConsultaCnpj(idCampo, prefixo = "") {
  const campo = document.getElementById(idCampo);

  if (!campo) return;

  campo.addEventListener("blur", () => consultarCnpj(campo, prefixo));
}

async function consultarCep(campoCep, prefixo = "") {
  if (!campoCep) return;

  const cep = campoCep.value.replace(/\D/g, "");

  if (cep.length !== 8) return;

  const campo = (nome) => {
    if (!prefixo) return nome;

    return `${prefixo}${nome.charAt(0).toUpperCase()}${nome.slice(1)}`;
  };

  try {
    campoCep.disabled = true;

    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);

    if (!response.ok) {
      throw new Error("CEP não encontrado");
    }

    const endereco = await response.json();

    if (endereco.erro) {
      throw new Error("CEP não encontrado");
    }

    preencherCampoMascarado(campo("cep"), endereco.cep, "cep");
    preencherCampo(campo("endereco"), endereco.logradouro);
    preencherCampo(campo("bairro"), endereco.bairro);
    preencherCampo(campo("cidade"), endereco.localidade);
    preencherCampo(campo("estado"), endereco.uf);
    preencherCampo(campo("pais"), "Brasil");

    if (endereco.complemento && !pegarValor(campo("complemento"))) {
      preencherCampo(campo("complemento"), endereco.complemento);
    }
  } catch (error) {
    console.log(error);
    alert("Não foi possível consultar o CEP.");
  } finally {
    campoCep.disabled = false;
  }
}

function configurarConsultaCep(idCampo, prefixo = "") {
  const campo = document.getElementById(idCampo);

  if (!campo) return;

  campo.addEventListener("blur", () => consultarCep(campo, prefixo));
}

document.getElementById("btnMockCliente")?.addEventListener("click", () => {
  preencherClienteMock();
});

document.getElementById("tipo")?.addEventListener("change", () => {
  atualizarCamposPorTipo();
});

document.getElementById("editarTipo")?.addEventListener("change", () => {
  atualizarCamposPorTipo("editar");
});

configurarMascaras(formCliente);
configurarMascaras(formEditarCliente);
configurarConsultaCnpj("cnpj");
configurarConsultaCnpj("editarCnpj", "editar");
configurarConsultaCep("cep");
configurarConsultaCep("editarCep", "editar");
configurarPreviewLogo("logoFile", "logoPreview");
configurarPreviewLogo("editarLogoFile", "editarLogoPreview");
configurarContatosDinamicos();
atualizarCamposPorTipo();
atualizarCamposPorTipo("editar");

document.getElementById("modalCliente")?.addEventListener("hidden.bs.modal", () => {
  resetarContatos();
});

const wizardCliente = criarWizardCliente({
  form: formCliente,
  modal: document.getElementById("modalCliente"),
  nav: document.getElementById("stepsNavCliente"),
  btnProximo: document.getElementById("btnStepProximoCliente"),
  btnSalvar: document.getElementById("btnSalvarCliente"),
});

const wizardEditarCliente = criarWizardCliente({
  form: formEditarCliente,
  modal: document.getElementById("modalEditarCliente"),
  nav: document.getElementById("stepsNavEditarCliente"),
  btnProximo: document.getElementById("btnStepProximoEditar"),
  btnSalvar: document.getElementById("btnSalvarEditar"),
  prefixo: "editar",
});

carregarClientes();
