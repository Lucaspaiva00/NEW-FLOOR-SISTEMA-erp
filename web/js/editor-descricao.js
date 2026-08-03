const quillToolbar = [
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ header: [2, 3, false] }],
    ["clean"],
];

const editoresDescricao = {};
const editoresItemDescricao = new WeakMap();

function inicializarEditorDescricao(editorId, campoId, placeholder) {
    const container = document.getElementById(editorId);
    const campo = document.getElementById(campoId);

    if (!container || !campo || editoresDescricao[campoId]) {
        return editoresDescricao[campoId];
    }

    const quill = new Quill(container, {
        theme: "snow",
        modules: { toolbar: quillToolbar },
        placeholder:
            placeholder || "Descreva o serviço para a proposta comercial...",
    });

    quill.on("text-change", () => {
        campo.value = quill.root.innerHTML;
    });

    editoresDescricao[campoId] = quill;

    const conteudo = campo.value || "";

    if (conteudo && conteudo !== "<p><br></p>") {
        const html =
            typeof normalizarConteudoObservacao === "function"
                ? normalizarConteudoObservacao(conteudo)
                : conteudo;

        quill.root.innerHTML = html;
        campo.value = html;
    }

    return quill;
}

function definirDescricaoEditor(campoId, valor) {
    const quill = editoresDescricao[campoId];
    const campo = document.getElementById(campoId);

    if (!campo) {
        return;
    }

  const conteudo = valor || "";

  if (quill) {
    if (!conteudo || conteudo === "<p><br></p>") {
      quill.setText("");
      campo.value = "";
      return;
    }

    const html =
      typeof normalizarConteudoObservacao === "function"
        ? normalizarConteudoObservacao(conteudo)
        : conteudo;

    quill.root.innerHTML = html;
    campo.value = html;
  }
}

function limparDescricaoEditor(campoId) {
    definirDescricaoEditor(campoId, "");
}

function inicializarEditorItemDescricao(itemEl) {
    const container = itemEl.querySelector(".item-descricao-editor");
    const campo = itemEl.querySelector(".item-descricao");

    if (!container || !campo) {
        return null;
    }

    if (editoresItemDescricao.has(container)) {
        return editoresItemDescricao.get(container);
    }

    const quill = new Quill(container, {
        theme: "snow",
        modules: { toolbar: quillToolbar },
        placeholder: "Descrição comercial do item...",
    });

    quill.on("text-change", () => {
        campo.value = quill.root.innerHTML;
    });

    editoresItemDescricao.set(container, quill);

    const conteudo = campo.value || "";

    if (conteudo && conteudo !== "<p><br></p>") {
        const html =
            typeof normalizarConteudoObservacao === "function"
                ? normalizarConteudoObservacao(conteudo)
                : conteudo;

        quill.root.innerHTML = html;
        campo.value = html;
    }

    return quill;
}

function definirDescricaoEditorItem(itemEl, valor) {
    const campo = itemEl.querySelector(".item-descricao");

    if (!campo) {
        return;
    }

    const conteudo = valor || "";

    campo.value = conteudo;

    const container = itemEl.querySelector(".item-descricao-editor");
    const quill = container ? editoresItemDescricao.get(container) : null;

    if (!quill) {
        return;
    }

    if (!conteudo || conteudo === "<p><br></p>") {
        quill.setText("");
        return;
    }

    const html =
        typeof normalizarConteudoObservacao === "function"
            ? normalizarConteudoObservacao(conteudo)
            : conteudo;

    quill.root.innerHTML = html;
    campo.value = html;
}

function sincronizarEditoresItemDescricao(raiz = document) {
    raiz.querySelectorAll(".item-servico").forEach((itemEl) => {
        const container = itemEl.querySelector(".item-descricao-editor");
        const campo = itemEl.querySelector(".item-descricao");
        const quill = container ? editoresItemDescricao.get(container) : null;

        if (quill && campo) {
            campo.value = quill.root.innerHTML;
        }
    });
}

function sincronizarEditoresDescricao() {
    Object.keys(editoresDescricao).forEach((campoId) => {
        const campo = document.getElementById(campoId);
        const quill = editoresDescricao[campoId];

        if (campo && quill) {
            campo.value = quill.root.innerHTML;
        }
    });

    sincronizarEditoresItemDescricao();
}

function textoPlanoDescricao(valor) {
    if (!valor) {
        return "";
    }

    const elemento = document.createElement("div");
    elemento.innerHTML = valor;

    return (elemento.textContent || elemento.innerText || "").trim();
}
