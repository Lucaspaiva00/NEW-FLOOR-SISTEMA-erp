(() => {
  const sessao = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
  const token = sessao?.token;
  if (!token || !document.querySelector(".obras-page .toolbar")) return;
  fetch(API_URL + "/empresas/me", { headers: { Authorization: "Bearer " + token } })
    .then(r => r.ok ? r.json() : null)
    .then(empresa => {
      if (empresa?.empresaid !== 5 || empresa?.slug !== "construarty" ||
          empresa?.configuracaoSistema?.modulos?.obras !== true) return;
      const barra = document.querySelector(".obras-page .toolbar");
      if (!barra || document.getElementById("abrirPlanilhasMedicaoJose")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.id = "abrirPlanilhasMedicaoJose";
      button.textContent = "Planilhas de medição da engenharia";
      button.addEventListener("click", () => { location.assign("planilhas-medicao.html"); });
      barra.append(button);
    }).catch(() => {});
})();