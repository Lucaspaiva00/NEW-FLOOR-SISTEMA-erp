const COOLDOWN_SEG = 60;
const STORAGE_ENVIO = "codigoRecuperacaoEnviadoEm";

const form = document.getElementById("formRecuperacao");
const btnEnviar = document.getElementById("btnEnviar");
const inputEmail = document.getElementById("email");
const feedback = document.getElementById("feedback");

let intervaloCooldown = null;

function segundosRestantes() {
  const enviadoEm = Number(localStorage.getItem(STORAGE_ENVIO) || 0);
  if (!enviadoEm) return 0;

  const restante = COOLDOWN_SEG - Math.floor((Date.now() - enviadoEm) / 1000);
  return restante > 0 ? restante : 0;
}

function mostrarFeedback(mensagem, tipo = "") {
  feedback.textContent = mensagem;
  feedback.classList.remove("hidden", "error", "success");
  if (tipo) feedback.classList.add(tipo);
}

function limparFeedback() {
  feedback.textContent = "";
  feedback.classList.add("hidden");
  feedback.classList.remove("error", "success");
}

function setLoading(carregando) {
  btnEnviar.disabled = carregando;
  inputEmail.disabled = carregando;

  if (carregando) {
    btnEnviar.classList.add("btn-loading");
    btnEnviar.innerHTML = '<span class="spinner"></span> Enviando...';
    return;
  }

  btnEnviar.classList.remove("btn-loading");
  atualizarCooldown();
}

function atualizarCooldown() {
  const restante = segundosRestantes();

  if (intervaloCooldown) {
    clearInterval(intervaloCooldown);
    intervaloCooldown = null;
  }

  if (!restante) {
    btnEnviar.disabled = false;
    btnEnviar.textContent = "Enviar Código";
    limparFeedback();
    return;
  }

  btnEnviar.disabled = true;
  btnEnviar.textContent = `Aguarde ${restante}s para reenviar`;

  mostrarFeedback(
    `Aguarde ${restante}s para solicitar um novo código. O código expira em 15 minutos.`
  );

  intervaloCooldown = setInterval(() => {
    const segundos = segundosRestantes();

    if (!segundos) {
      clearInterval(intervaloCooldown);
      intervaloCooldown = null;
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Enviar Código";
      limparFeedback();
      return;
    }

    btnEnviar.textContent = `Aguarde ${segundos}s para reenviar`;
    feedback.textContent = `Aguarde ${segundos}s para solicitar um novo código. O código expira em 15 minutos.`;
  }, 1000);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (segundosRestantes() > 0) return;

  const email = inputEmail.value.trim();
  limparFeedback();
  setLoading(true);

  try {
    const response = await fetch(`${API_URL}/usuarios/esqueci-senha`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarFeedback(data.error || "Erro ao enviar código", "error");
      setLoading(false);
      return;
    }

    localStorage.setItem("emailRecuperacao", email);
    localStorage.setItem(STORAGE_ENVIO, String(Date.now()));

    mostrarFeedback("Código enviado! Redirecionando...", "success");

    setTimeout(() => {
      window.location.href = "redefinir-senha.html";
    }, 1200);
  } catch (error) {
    console.error(error);
    mostrarFeedback("Erro ao conectar com servidor.", "error");
    setLoading(false);
  }
});

atualizarCooldown();
