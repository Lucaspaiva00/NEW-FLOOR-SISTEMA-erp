function pegarValor(id) {
  const elemento = document.getElementById(id);

  if (!elemento) return null;

  const valor = elemento.value;

  if (valor === undefined || valor === null) return null;

  const tratado = String(valor).trim();

  return tratado === "" ? null : tratado;
}

function pegarValorHtml(id) {
  const elemento = document.getElementById(id);

  if (!elemento) return null;

  const valor = elemento.value;

  if (valor === undefined || valor === null) return null;

  const texto = typeof textoPlanoDescricao === "function"
    ? textoPlanoDescricao(valor)
    : String(valor).replace(/<[^>]*>/g, "").trim();

  return texto === "" ? null : String(valor);
}

function pegarNumero(id) {
  const valor = pegarValor(id);

  if (!valor) return null;

  const numero = Number(String(valor).replace(",", "."));

  return Number.isNaN(numero) ? null : numero;
}

function pegarInteiro(id) {
  const valor = pegarValor(id);

  if (!valor) return null;

  const numero = Number(valor);

  return Number.isNaN(numero) ? null : numero;
}

function pegarDecimal(id) {
  return pegarNumero(id);
}

function pegarCheckbox(id) {
  const elemento = document.getElementById(id);

  if (!elemento) return false;

  return elemento.checked;
}

function preencherCampo(id, valor) {
  const elemento = document.getElementById(id);

  if (!elemento) return;

  elemento.value = valor ?? "";
}

function preencherCheckbox(id, valor) {
  const elemento = document.getElementById(id);

  if (!elemento) return;

  elemento.checked = Boolean(valor);
}

function formatarDataParaInput(data) {
  if (!data) return "";

  return String(data).split("T")[0];
}

function dataInput(data) {
  return formatarDataParaInput(data);
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function textoSeguro(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "-";
  }

  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarData(data) {
  if (!data) return "-";

  return new Date(data).toLocaleDateString("pt-BR");
}

function formatarDataHora(data) {
  if (!data) return "-";

  return new Date(data).toLocaleString("pt-BR");
}

function setLoading(botao, carregando, textoPadrao) {
  if (!botao) return;

  botao.disabled = carregando;
  botao.textContent = carregando ? "Salvando..." : textoPadrao;
}

function toast(mensagem, icone) {
  if (typeof Swal !== "undefined") {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: icone,
      title: mensagem,
      showConfirmButton: false,
      timer: icone === "error" ? 4000 : 3000,
      timerProgressBar: true,
    });
    return;
  }

  alert(mensagem);
}

function toastSucesso(mensagem) {
  toast(mensagem, "success");
}

function toastErro(mensagem) {
  toast(mensagem, "error");
}
