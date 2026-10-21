(() => {
  const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
  const tokenNewFloor = usuario?.token;
  if (!tokenNewFloor || !document.getElementById("formNovaProposta")) return;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  async function iniciar() {
    const res = await fetch(API_URL + "/empresas/me", { headers: { Authorization: "Bearer " + tokenNewFloor } });
    if (!res.ok) return;
    const empresa = await res.json();
    if (Number(empresa.empresaid) !== 1 || empresa.slug !== "new-floor") return;

    for (const [formId, selectId, emailId, label] of [
      ["formNovaProposta", "clienteId", "emailDestinatario", "E-mail adicional para envio (opcional)"],
      ["formEditarProposta", "editarClienteId", "editarEmailDestinatario", "E-mail adicional para envio (opcional)"]
    ]) {
      const select = document.getElementById(selectId);
      const container = select?.closest(".form-field") || select?.closest(".mb-3");
      if (!container || document.getElementById(emailId)) continue;
      const div = document.createElement("div");
      div.className = container.className || "col-md-4 mb-3";
      div.innerHTML = '<label for="' + emailId + '">' + label + '</label>' +
        '<input type="email" id="' + emailId + '" autocomplete="email" maxlength="254" ' +
        'class="form-control premium-input-light" placeholder="copia@empresa.com.br">' +
        '<small class="text-muted">Além do e-mail principal do cliente. Vale somente para New Floor.</small>';
      container.after(div);
    }
    const edit = document.getElementById("modalProposta");
    edit?.addEventListener("shown.bs.modal", async () => {
      const id = Number(document.getElementById("editarId")?.value);
      const input = document.getElementById("editarEmailDestinatario");
      if (!id || !input) return;
      try {
        const r = await fetch(API_URL + "/propostas/" + id, { headers: { Authorization: "Bearer " + tokenNewFloor } });
        if (!r.ok) return;
        const proposta = await r.json();
        if (Number(document.getElementById("editarId")?.value) === id) input.value = proposta.emailDestinatario || "";
      } catch (_) {}
    });

    // Prévia é sempre um novo tab autenticado via Bearer, sem expor token na URL.
    async function previsualizar(id, button) {
      const janela = window.open("", "_blank");
      if (!janela) { alert("Permita a abertura de janelas para visualizar a proposta."); return; }
      janela.document.title = "Visualização de proposta";
      janela.document.body.textContent = "Carregando a prévia do PDF…";
      if (button) button.disabled = true;
      try {
        const r = await fetch(API_URL + "/propostas/" + id + "/visualizar", {
          headers: { Authorization: "Bearer " + tokenNewFloor }
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || "Prévia indisponível.");
        }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        janela.location.replace(url);
        setTimeout(() => URL.revokeObjectURL(url), 120000);
      } catch (err) {
        janela.document.body.textContent = err.message;
      } finally { if (button) button.disabled = false; }
    }
    const cards = document.getElementById("kanbanBoard");
    cards?.addEventListener("click", event => {
      const btn = event.target.closest("[data-visualizar-newfloor]");
      if (!btn) return;
      event.preventDefault(); event.stopPropagation();
      previsualizar(Number(btn.dataset.visualizarNewfloor), btn);
    });
    const inserirBotoes = () => {
      if (!cards) return;
      cards.querySelectorAll(".proposal-card").forEach(card => {
        if (card.querySelector("[data-visualizar-newfloor]")) return;
        const pdf = card.querySelector('[data-proposta-acao="pdf"]');
        const menu = pdf?.closest("li") || pdf?.parentElement;
        const pid = Number(card.dataset.id || card.dataset.propostaId || pdf?.closest("[data-propostaid]")?.dataset.propostaid);
        // Verificar o atributo do cartão antes de criar um botão.
        if (!menu || !pid) return;
        const li = document.createElement(menu.tagName.toLowerCase() === "li" ? "li" : "div");
        li.innerHTML = '<button type="button" class="dropdown-item proposal-card-dropdown-item" data-visualizar-newfloor="' +
          pid + '">Visualizar proposta</button>';
        menu.after(li);
      });
    };
    const obs = new MutationObserver(inserirBotoes);
    if (cards) { obs.observe(cards, { childList: true, subtree: true }); inserirBotoes(); }
  }
  iniciar().catch(console.error);
})();