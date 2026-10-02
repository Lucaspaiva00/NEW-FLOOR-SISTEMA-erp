(() => {
  let editorPromise;
  async function editor() {
    if (!window.__configuracaoSistema?.composicaoCustos) throw new Error("Composição desabilitada para esta empresa.");
    if (!editorPromise) editorPromise = montarEditor().catch(error => { editorPromise = null; throw error; });
    return editorPromise;
  }
  async function montarEditor() {
    const response = await fetch("orcamentos.html");
    if (!response.ok) throw new Error("Não foi possível carregar o formulário de orçamento.");
    const doc = new DOMParser().parseFromString(await response.text(), "text/html");
    const modal = doc.getElementById("modalOrcamento");
    if (!modal) throw new Error("Formulário de orçamento indisponível.");
    const root = document.createElement("div");
    root.className = "proposta-sba-editor";
    // Namespace IDs so the existing NEW FLOOR form keeps its own fields.
    for (const el of modal.querySelectorAll("[id]")) {
      el.dataset.orcamentoId = el.id;
      el.id = "sbaProposta_" + el.id;
    }
    modal.dataset.orcamentoId = "modalOrcamento";
    modal.id = "sbaProposta_modalOrcamento";
    modal.setAttribute("aria-labelledby", "sbaProposta_tituloModalOrcamento");
    for (const label of modal.querySelectorAll("label[for]")) label.htmlFor = "sbaProposta_" + label.htmlFor;
    root.append(modal);
    const field = id => root.querySelector(`[data-orcamento-id="${id}"]`);
    const manage = document.createElement("button");
    manage.type = "button";
    manage.className = "budget-secondary";
    manage.textContent = "Outras ações";
    field("salvarOrcamento").before(manage);
    manage.onclick = () => {
      const id = field("orcamentoId").value;
      if (!id) { field("mensagem").textContent = "Salve a proposta para acessar outras ações."; return; }
      modal.addEventListener("hidden.bs.modal", () => abrirModalProposta(id, true), {once:true});
      bootstrap.Modal.getInstance(modal).hide();
    };
    document.body.append(root);
    const instance = window.criarEditorOrcamento({
      root,
      config: window.__configuracaoSistema,
      onSaved: async () => { await carregarPropostas(); }
    });
    await instance.ready();
    return instance;
  }
  window.abrirOrcamentoNaProposta = async proposta => (await editor()).abrir(proposta);
  window.resumoComposicaoProposta = proposta => {
    const c = proposta.composicaoCustos;
    const valor = n => moeda(Number(n || 0));
    return `<div class="proposal-composition-summary"><span class="composition-caption">Composição do orçamento</span><div><span>Materiais</span><strong>${valor(c.custoMateriais)}</strong></div><div><span>Mão de obra</span><strong>${valor(c.custoMaoObra)}</strong></div><div><span>Custo total</span><strong>${valor(c.custoTotal)}</strong></div><div><span>Margem / imposto estimado</span><strong>${textoSeguro((Number(c.margem)*100).toLocaleString("pt-BR",{maximumFractionDigits:2}))}% / ${textoSeguro((Number(c.imposto)*100).toLocaleString("pt-BR",{maximumFractionDigits:2}))}%</strong></div><div class="composition-profit ${Number(c.lucro)<0?"loss":""}"><span>Lucro estimado</span><strong>${valor(c.lucro)}</strong></div>${proposta.contatoDestinatario?`<p>Contato: ${textoSeguro(proposta.contatoDestinatario)}</p>`:""}${proposta.emailDestinatario?`<p>${textoSeguro(proposta.emailDestinatario)}</p>`:""}</div>`;
  };
  window.addEventListener("configuracao-sistema", ({detail:c}) => {
    if (!c.composicaoCustos) return;
    const css = document.createElement("link");
    css.rel = "stylesheet";css.href = "css/orcamentos.css";document.head.append(css);
    const button = document.querySelector('[data-bs-target="#modalNovaProposta"]');
    if (button) {
      button.removeAttribute("data-bs-toggle");button.removeAttribute("data-bs-target");
      button.onclick = async () => { try { await window.abrirOrcamentoNaProposta(); } catch(error) { toastErro(error.message); } };
    }
    carregarPropostas();
  });
})();
