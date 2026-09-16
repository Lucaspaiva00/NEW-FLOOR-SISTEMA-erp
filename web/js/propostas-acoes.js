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

  // Abre a aba ANTES do fetch (ainda dentro do gesto de clique do usuário),
  // senão o navegador pode bloquear como pop-up depois do await.
  const novaAba = window.open("", "_blank");

  try {
    const response = await fetch(`${API_URL}/propostas/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      let mensagem = "Erro ao gerar PDF da proposta.";
      try {
        const erro = await response.json();
        mensagem = erro?.error || mensagem;
      } catch {
        // resposta não veio em JSON, mantém mensagem padrão
      }
      if (novaAba) novaAba.close();
      alert(mensagem);
      return;
    }

    const blob = await response.blob();

    // Content-Disposition vem do backend com o nome certo do arquivo
    // (ex: "Proposta Técnica Comercial SBA - 730 - Cliente X.pdf").
    // Sem isso, o navegador usa o UUID interno do blob como nome ao
    // salvar — por isso criamos um File nomeado em vez de um Blob puro.
    const disposicao = response.headers.get("content-disposition") || "";
    const match = disposicao.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const nomeArquivo = match ? decodeURIComponent(match[1]) : `proposta-${id}.pdf`;

    const arquivo = new File([blob], nomeArquivo, { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(arquivo);

    if (novaAba) {
      novaAba.location.href = blobUrl;
    } else {
      window.open(blobUrl, "_blank");
    }

    // Libera a memória depois de um tempo (dá margem pro navegador abrir a aba)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (error) {
    console.log(error);
    if (novaAba) novaAba.close();
    alert("Erro de conexão ao gerar PDF da proposta.");
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
