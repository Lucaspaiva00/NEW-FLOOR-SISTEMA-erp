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

    return quill;
}

function definirDescricaoEditor(campoId, valor) {
    const quill = editoresDescricao[campoId];
    const campo = document.getElementById(campoId);

    if (!campo) {
        return;
    }

    const conteudo = valor || "";

    campo.value = conteudo;

    if (quill) {
        if (!conteudo || conteudo === "<p><br></p>") {
            quill.setText("");
            return;
        }

        quill.root.innerHTML = conteudo;
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
        quill.root.innerHTML = conteudo;
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

    quill.root.innerHTML = conteudo;
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
