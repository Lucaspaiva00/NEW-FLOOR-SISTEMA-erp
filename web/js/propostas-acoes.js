async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data = null;

  try {
    data = JSON.parse(text);
  } catch {
    if (!response.ok) {
      throw new Error(text || "Erro na requisição");
    }

    return text;
  }

  if (!response.ok) {
    throw new Error(data?.error || "Erro na requisição");
  }

  return data;
}

function visualizarPdfProposta(id) {
  if (!id) {
    alert("Selecione uma proposta.");
    return;
  }

  // Navegação de verdade (não blob) — assim o navegador recebe o
  // Content-Disposition do servidor e usa o nome certo do arquivo
  // se o usuário clicar em "Salvar" dentro do próprio visualizador de PDF.
  window.open(
    `${API_URL}/propostas/${id}/download?token=${encodeURIComponent(token)}`,
    "_blank",
  );
}

// Prévia de PDF por Bearer em nova aba, sem download forçado nem token na URL.
// Funciona para todos os perfis e utiliza o gerador de cada empresa no backend.
async function previsualizarProposta(id, btn) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    toastErro("Selecione uma proposta válida.");
    return;
  }
  const janela = window.open("", "_blank");
  if (!janela) {
    toastErro("Permita pop-ups para visualizar a proposta.");
    return;
  }
  janela.document.title = "Prévia da proposta";
  janela.document.body.textContent = "Preparando prévia do PDF…";
  if (btn) btn.disabled = true;
  try {
    const resposta = await fetch(`${API_URL}/propostas/${encodeURIComponent(id)}/visualizar`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resposta.ok) {
      const dados = await resposta.json().catch(() => ({}));
      throw new Error(dados.error || "Não foi possível visualizar a proposta.");
    }
    const arquivo = await resposta.blob();
    if (!arquivo.size || arquivo.type !== "application/pdf") {
      throw new Error("A prévia não retornou um PDF válido.");
    }
    const urlTemporaria = URL.createObjectURL(arquivo);
    janela.location.replace(urlTemporaria);
    // Manter o endereço temporário enquanto o visualizador do PDF estiver aberto.
    // Não revogar imediatamente: Safari/iOS precisa ler o blob após a navegação.
  } catch (erro) {
    if (!janela.closed) {
      janela.document.body.textContent = erro.message || "Erro ao carregar a prévia.";
    }
    toastErro(erro.message || "Não foi possível visualizar a proposta.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function enviarWhatsappProposta(id, btn) {
  if (!id) {
    alert("Selecione uma proposta.");
    return;
  }

  if (btn) btn.disabled = true;

  try {
    const data = await request(`${API_URL}/propostas/${id}/whatsapp`, {
      method: "GET",
    });

    if (data.whatsappUrl) {
      window.open(data.whatsappUrl, "_blank");
    } else {
      alert("Link do WhatsApp não retornado.");
    }
  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function duplicarProposta(id, btn) {
  if (!id) {
    alert("Selecione uma proposta.");
    return;
  }

  if (btn) btn.disabled = true;
  setCardLoading(id, true);

  try {
    const proposta = await request(`${API_URL}/propostas/${id}/duplicar`, {
      method: "POST",
    });

    toastSucesso(`Proposta Nº ${proposta.numero} criada`);
    await carregarPropostas();
  } catch (error) {
    console.error(error);
    toastErro(error.message || "Erro ao duplicar proposta.");
  } finally {
    setCardLoading(id, false);
    if (btn) btn.disabled = false;
  }
}

async function enviarEmailProposta(id, btn) {
  if (!id) {
    toastErro("Selecione uma proposta.");
    return;
  }

  const proposta = (typeof propostasCache !== "undefined" ? propostasCache : []).find(
    (p) => Number(p.propostaid) === Number(id),
  );

  const emailPadrao =
    proposta?.cliente?.email1 || proposta?.cliente?.email2 || "";

  if (!emailPadrao) {
    toastErro("Cliente sem e-mail cadastrado.");
    return;
  }

  const destinatario = prompt(
    "E-mail do destinatário:",
    emailPadrao,
  )?.trim();

  if (!destinatario) return;

  const textoOriginal = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Enviando...";
  }

  setCardLoading(id, true);

  try {
    const data = await request(`${API_URL}/propostas/${id}/email`, {
      method: "POST",
      body: JSON.stringify({ destinatario }),
    });

    toastSucesso(
      data.message
        ? `${data.message} para ${data.destinatario || destinatario}`
        : "E-mail enviado com sucesso.",
    );

    if (proposta) {
      proposta.enviadoEmail = true;
    }
  } catch (error) {
    console.error(error);
    toastErro(error.message || "Erro ao enviar e-mail.");
  } finally {
    setCardLoading(id, false);
    if (btn) {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  }
}

async function executarAcaoProposta(acao, id, btn) {
  try {
    if (acao === "editar") {
      abrirModalProposta(id);
    } else if (acao === "duplicar") {
      await duplicarProposta(id, btn);
    } else if (acao === "visualizar") {
      await previsualizarProposta(id, btn);
    } else if (acao === "pdf") {
      await visualizarPdfProposta(id);
    } else if (acao === "whatsapp") {
      await enviarWhatsappProposta(id, btn);
    } else if (acao === "email") {
      await enviarEmailProposta(id, btn);
    }
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

function initCardMenus() {
  const kanbanBoard = document.getElementById("kanbanBoard");
  if (!kanbanBoard) return;

  kanbanBoard.addEventListener("click", (e) => {
    const acaoBtn = e.target.closest("[data-proposta-acao]");
    if (!acaoBtn) return;

    e.stopPropagation();

    const card = acaoBtn.closest(".proposal-card");
    const id = card?.dataset.id;
    const acao = acaoBtn.dataset.propostaAcao;

    const dropdownToggle = acaoBtn
      .closest(".dropdown")
      ?.querySelector('[data-bs-toggle="dropdown"]');

    if (dropdownToggle) {
      bootstrap.Dropdown.getOrCreateInstance(dropdownToggle).hide();
    }

    executarAcaoProposta(acao, id, acaoBtn);
  });
}

async function carregarTemplates() {
  const select = document.getElementById("editarTemplateId");

  if (!select) return;

  try {
    const templates = await request(`${API_URL}/templates`);

    select.innerHTML = '<option value="">Selecione...</option>';

    templates.forEach((template) => {
      select.innerHTML += `
                    <option value="${template.templateid}">
                        ${template.nome}
                    </option>
                `;
    });
  } catch (error) {
    console.error("Erro templates:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initCardMenus();
  carregarTemplates();
});
