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

    // Prévia da proposta passou a ser global em propostas-acoes.js.

  }
  iniciar().catch(console.error);
})();
