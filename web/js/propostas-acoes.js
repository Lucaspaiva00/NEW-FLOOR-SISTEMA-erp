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

async function visualizarPdfProposta(id) {
  if (!id) {
    alert("Selecione uma proposta.");
    return;
  }

  window.open(`${API_URL}/propostas/${id}/download`, "_blank");
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
