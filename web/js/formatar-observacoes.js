function escHtmlObservacao(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isTituloSecaoObservacao(linha) {
  const indice = linha.indexOf(":");

  if (indice === -1) {
    return false;
  }

  const titulo = linha.slice(0, indice).trim();

  if (!titulo || titulo.length > 120) {
    return false;
  }

  const letras = titulo.replace(/[^A-Za-zÀ-ú]/g, "");
  const maiusculas = titulo.replace(/[^A-ZÀ-Ú]/g, "");

  return letras.length > 0 && maiusculas.length >= letras.length * 0.55;
}

function linhaTituloInlineObservacao(linha) {
  const indice = linha.indexOf(":");

  if (indice === -1) {
    return null;
  }

  const titulo = linha.slice(0, indice).trim();
  const conteudo = linha.slice(indice + 1).trim();

  if (!conteudo || !isTituloSecaoObservacao(`${titulo}:`)) {
    return null;
  }

  return `<p><strong>${escHtmlObservacao(`${titulo}:`)}</strong> ${escHtmlObservacao(conteudo)}</p>`;
}

function secaoEmListaObservacao(titulo) {
  const upper = titulo.toUpperCase();

  return (
    upper.includes("OBRIGAÇÕES DA CONTRATADA") ||
    upper.includes("RESPONSABILIDADES DO CONTRATANTE")
  );
}

function formatarTextoObservacoes(texto) {
  if (!texto?.trim()) {
    return "";
  }

  if (/<[a-z][\s\S]*>/i.test(texto.trim())) {
    return texto.trim();
  }

  const partes = [];
  let paragrafoAtual = [];
  let listaAtual = [];
  let modoLista = false;

  const flushParagrafo = () => {
    if (!paragrafoAtual.length) {
      return;
    }

    partes.push(`<p>${paragrafoAtual.map(escHtmlObservacao).join("<br>")}</p>`);
    paragrafoAtual = [];
  };

  const flushLista = () => {
    if (!listaAtual.length) {
      return;
    }

    partes.push(
      `<ul>${listaAtual.map((item) => `<li>${escHtmlObservacao(item)}</li>`).join("")}</ul>`,
    );
    listaAtual = [];
  };

  const flush = () => {
    flushParagrafo();
    flushLista();
    modoLista = false;
  };

  for (const linhaRaw of texto.split("\n")) {
    const linha = linhaRaw.trim();

    if (!linha) {
      flush();
      continue;
    }

    const tituloInline = linhaTituloInlineObservacao(linha);

    if (tituloInline) {
      flush();
      partes.push(tituloInline);
      continue;
    }

    if (isTituloSecaoObservacao(linha)) {
      flush();
      partes.push(`<h3><strong>${escHtmlObservacao(linha)}</strong></h3>`);
      modoLista = secaoEmListaObservacao(linha);
      continue;
    }

    if (modoLista) {
      flushParagrafo();
      listaAtual.push(linha);
      continue;
    }

    flushLista();
    paragrafoAtual.push(linha);
  }

  flush();

  return partes.join("");
}
