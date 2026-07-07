const COOLDOWN_SEG = 60;
const STORAGE_ENVIO = "codigoRecuperacaoEnviadoEm";

const form = document.getElementById("formRedefinir");
const btnAlterar = document.getElementById("btnAlterar");
const btnReenviar = document.getElementById("btnReenviar");
const inputEmail = document.getElementById("email");
const feedback = document.getElementById("feedback");

let intervaloCooldown = null;

const emailSalvo = localStorage.getItem("emailRecuperacao");
if (emailSalvo) {
  inputEmail.value = emailSalvo;
}

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

function setLoadingAlterar(carregando) {
  btnAlterar.disabled = carregando;
  btnReenviar.disabled = carregando || segundosRestantes() > 0;

  if (carregando) {
    btnAlterar.classList.add("btn-loading");
    btnAlterar.innerHTML = '<span class="spinner branco"></span> Alterando...';
    return;
  }

  btnAlterar.classList.remove("btn-loading");
  btnAlterar.textContent = "Alterar Senha";
}

function setLoadingReenviar(carregando) {
  btnReenviar.disabled = carregando || segundosRestantes() > 0;
  btnAlterar.disabled = carregando;

  if (carregando) {
    btnReenviar.classList.add("btn-loading");
    btnReenviar.innerHTML = '<span class="spinner"></span> Reenviando...';
    return;
  }

  btnReenviar.classList.remove("btn-loading");
  atualizarCooldown();
}

function atualizarCooldown() {
  const restante = segundosRestantes();

  if (intervaloCooldown) {
    clearInterval(intervaloCooldown);
    intervaloCooldown = null;
  }

  if (!restante) {
    btnReenviar.disabled = false;
    btnReenviar.textContent = "Reenviar código";
    return;
  }

  btnReenviar.disabled = true;
  btnReenviar.textContent = `Reenviar em ${restante}s`;

  if (!feedback.classList.contains("success")) {
    mostrarFeedback(
      `Aguarde ${restante}s para reenviar. O código expira em 15 minutos.`
    );
  }

  intervaloCooldown = setInterval(() => {
    const segundos = segundosRestantes();

    if (!segundos) {
      clearInterval(intervaloCooldown);
      intervaloCooldown = null;
      btnReenviar.disabled = false;
      btnReenviar.textContent = "Reenviar código";
      if (!feedback.classList.contains("success") && !feedback.classList.contains("error")) {
        limparFeedback();
      }
      return;
    }

    btnReenviar.textContent = `Reenviar em ${segundos}s`;
    if (!feedback.classList.contains("success")) {
      feedback.textContent = `Aguarde ${segundos}s para reenviar. O código expira em 15 minutos.`;
    }
  }, 1000);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = inputEmail.value.trim();
  const codigo = document.getElementById("codigo").value.trim();
  const senha = document.getElementById("senha").value;
  const confirmarSenha = document.getElementById("confirmarSenha").value;

  if (senha !== confirmarSenha) {
    mostrarFeedback("As senhas não conferem.", "error");
    return;
  }

  limparFeedback();
  setLoadingAlterar(true);

  try {
    const response = await fetch(`${API_URL}/usuarios/redefinir-senha`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, codigo, senha }),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarFeedback(data.error || "Erro ao redefinir senha", "error");
      setLoadingAlterar(false);
      return;
    }

    localStorage.removeItem("emailRecuperacao");
    localStorage.removeItem(STORAGE_ENVIO);

    mostrarFeedback("Senha alterada! Redirecionando...", "success");

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1200);
  } catch (error) {
    console.error(error);
    mostrarFeedback("Erro ao conectar com servidor.", "error");
    setLoadingAlterar(false);
  }
});

btnReenviar.addEventListener("click", async () => {
  if (segundosRestantes() > 0) return;

  const email = inputEmail.value.trim();
  if (!email) {
    mostrarFeedback("Informe o e-mail para reenviar o código.", "error");
    return;
  }

  limparFeedback();
  setLoadingReenviar(true);

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
      mostrarFeedback(data.error || "Erro ao reenviar código", "error");
      setLoadingReenviar(false);
      return;
    }

    localStorage.setItem("emailRecuperacao", email);
    localStorage.setItem(STORAGE_ENVIO, String(Date.now()));

    mostrarFeedback("Novo código enviado para seu e-mail.", "success");
    setLoadingReenviar(false);
    atualizarCooldown();
  } catch (error) {
    console.error(error);
    mostrarFeedback("Erro ao conectar com servidor.", "error");
    setLoadingReenviar(false);
  }
});

atualizarCooldown();
