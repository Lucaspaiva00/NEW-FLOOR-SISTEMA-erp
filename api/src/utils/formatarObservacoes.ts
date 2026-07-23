function escHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isTituloSecao(linha: string): boolean {
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

function linhaTituloInline(linha: string): string | null {
  const indice = linha.indexOf(":");

  if (indice === -1) {
    return null;
  }

  const titulo = linha.slice(0, indice).trim();
  const conteudo = linha.slice(indice + 1).trim();

  if (!conteudo || !titulo || titulo.length > 80) {
    return null;
  }

  const podeNegritar =
    isTituloSecao(`${titulo}:`) ||
    (titulo.length <= 50 && /[A-Za-zÀ-ú]/.test(titulo));

  if (!podeNegritar) {
    return null;
  }

  return `<p><strong>${escHtml(`${titulo}:`)}</strong> ${escHtml(conteudo)}</p>`;
}

function linhaTituloComTraco(linha: string): string | null {
  const indice = linha.indexOf(" - ");

  if (indice === -1) {
    return null;
  }

  const titulo = linha.slice(0, indice).trim();
  const conteudo = linha.slice(indice + 3).trim();

  if (!conteudo || !titulo || titulo.length > 120) {
    return null;
  }

  const letras = titulo.replace(/[^A-Za-zÀ-ú]/g, "");
  const maiusculas = titulo.replace(/[^A-ZÀ-Ú]/g, "");

  if (letras.length === 0 || maiusculas.length < letras.length * 0.55) {
    return null;
  }

  return `<p><strong>${escHtml(titulo)}</strong> - ${escHtml(conteudo)}</p>`;
}

function linhaSubitem(linha: string): string | null {
  if (!/^[a-z]\)\s+.+/i.test(linha)) {
    return null;
  }

  return `<p><strong>${escHtml(linha)}</strong></p>`;
}

function linhaLabelSozinha(linha: string): string | null {
  if (!linha.endsWith(":") || isTituloSecao(linha)) {
    return null;
  }

  const titulo = linha.slice(0, -1).trim();

  if (!titulo || titulo.length > 50) {
    return null;
  }

  return `<p><strong>${escHtml(linha)}</strong></p>`;
}

function secaoEmLista(titulo: string): boolean {
  const upper = titulo.toUpperCase();

  return (
    upper.includes("OBRIGAÇÕES DA CONTRATADA") ||
    upper.includes("RESPONSABILIDADES DO CONTRATANTE")
  );
}

export function formatarTextoObservacoes(texto?: string | null): string {
  if (!texto?.trim()) {
    return "";
  }

  if (/<[a-z][\s\S]*>/i.test(texto.trim())) {
    return texto.trim();
  }

  const partes: string[] = [];
  let paragrafoAtual: string[] = [];
  let listaAtual: string[] = [];
  let modoLista = false;

  const flushParagrafo = () => {
    if (!paragrafoAtual.length) {
      return;
    }

    partes.push(`<p>${paragrafoAtual.map(escHtml).join("<br>")}</p>`);
    paragrafoAtual = [];
  };

  const flushLista = () => {
    if (!listaAtual.length) {
      return;
    }

    partes.push(
      `<ul>${listaAtual.map((item) => `<li>${escHtml(item)}</li>`).join("")}</ul>`,
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

    const tituloInline = linhaTituloInline(linha);

    if (tituloInline) {
      flush();
      partes.push(tituloInline);
      continue;
    }

    const tituloComTraco = linhaTituloComTraco(linha);

    if (tituloComTraco) {
      flush();
      partes.push(tituloComTraco);
      continue;
    }

    const subitem = linhaSubitem(linha);

    if (subitem) {
      flush();
      partes.push(subitem);
      continue;
    }

    if (isTituloSecao(linha)) {
      flush();
      partes.push(`<h3><strong>${escHtml(linha)}</strong></h3>`);
      modoLista = secaoEmLista(linha);
      continue;
    }

    const labelSozinha = linhaLabelSozinha(linha);

    if (labelSozinha) {
      flush();
      partes.push(labelSozinha);
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
