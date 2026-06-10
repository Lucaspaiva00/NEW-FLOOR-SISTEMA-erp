function somenteDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function mascararCpf(valor) {
  const digitos = somenteDigitos(valor).slice(0, 11);

  return digitos
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function mascararCnpj(valor) {
  const digitos = somenteDigitos(valor).slice(0, 14);

  return digitos
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function mascararTelefone(valor) {
  const digitos = somenteDigitos(valor).slice(0, 11);

  if (digitos.length <= 10) {
    return digitos
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return digitos
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function mascararCep(valor) {
  const digitos = somenteDigitos(valor).slice(0, 8);

  return digitos.replace(/(\d{5})(\d)/, "$1-$2");
}

const MASCARAS = {
  cpf: mascararCpf,
  cnpj: mascararCnpj,
  telefone: mascararTelefone,
  cep: mascararCep,
};

function aplicarMascaraInput(input) {
  const tipo = input.dataset.mask;

  if (!MASCARAS[tipo]) return;

  input.addEventListener("input", () => {
    const inicio = input.selectionStart;
    const tamanhoAnterior = input.value.length;

    input.value = MASCARAS[tipo](input.value);

    const diferenca = input.value.length - tamanhoAnterior;
    const novaPosicao = Math.max(0, inicio + diferenca);

    input.setSelectionRange(novaPosicao, novaPosicao);
  });
}

function configurarMascaras(container = document) {
  container.querySelectorAll("[data-mask]").forEach(aplicarMascaraInput);
}

function formatarComMascara(valor, tipo) {
  if (!valor || !MASCARAS[tipo]) return valor || "";

  return MASCARAS[tipo](valor);
}
