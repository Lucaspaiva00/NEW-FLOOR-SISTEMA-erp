(() => {
  const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
  const token = usuario?.token;
  const area = document.querySelector(".fiscal-kpis");
  if (!area || !token) return;
  const esc = valor => String(valor ?? "").replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const api = async rota => {
    const response = await fetch(API_URL + rota, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) throw new Error("Não foi possível consultar os pré-requisitos fiscais.");
    return response.json();
  };
  async function iniciar() {
    const tenant = await api("/empresas/me");
    if (tenant.slug !== "sba" || tenant.configuracaoSistema?.perfil !== "SBA") return;
    if (document.getElementById("fiscalIntegracoesSba")) return;
    const section = document.createElement("section");
    section.id = "fiscalIntegracoesSba";
    section.className = "fiscal-panel p-3 mb-3";
    section.style.cssText = "margin-top:18px;max-width:100%;";
    section.innerHTML =
      '<div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">' +
        '<div><h2 class="h5 fw-bold mb-1">Integrações fiscais · SBA</h2>' +
        '<p class="small text-muted mb-0">Serviços: Portal Nacional direto. Materiais: SIEG Emissor. Sem substituir ou configurar a Focus.</p></div>' +
        '<button type="button" id="fiscalSbaVerificar" class="btn-secondary-fiscal">Verificar preparação</button>' +
      '</div>' +
      '<div id="fiscalSbaSituacao" class="small" role="status" aria-live="polite">Consultando pré-requisitos…</div>' +
      '<div class="d-flex flex-wrap gap-2 mt-3">' +
        '<a class="btn-secondary-fiscal text-decoration-none" href="https://www.nfse.gov.br/EmissorNacional" target="_blank" rel="noopener noreferrer">Abrir Portal Nacional</a>' +
        '<a class="btn-secondary-fiscal text-decoration-none" href="https://emissor.sieg.com/" target="_blank" rel="noopener noreferrer">Abrir SIEG Emissor</a>' +
        '<button type="button" id="fiscalSbaCadastro" class="btn-secondary-fiscal">Cadastro da emissora / certificado A1</button>' +
      '</div>' +
      '<p class="small text-muted mt-3 mb-0">A emissão direta no ERP ainda não está habilitada. Não use “Emitir agora” para uma nota SBA como se o Portal Nacional estivesse integrado. Continue emitindo nos portais oficiais até a homologação.</p>';
    area.after(section);
    section.querySelector("#fiscalSbaCadastro")?.addEventListener("click", () =>
      document.querySelector('[data-fiscal-tab="empresas"]')?.click());
    async function verificar() {
      const status = section.querySelector("#fiscalSbaSituacao");
      const btn = section.querySelector("#fiscalSbaVerificar");
      btn.disabled = true;
      status.textContent = "Conferindo o cadastro fiscal da SBA…";
      try {
        const dados = await api("/fiscal/sba/integracoes/status");
        const nomes = {
          inscricaoMunicipal: "Inscrição municipal",
          codigoMunicipioIbge: "Código IBGE do município",
          certificadoA1: "Certificado A1",
          regimeTributario: "Regime tributário",
          apuracaoSimples: "Apuração do Simples",
          padraoNacional: "NFS-e Nacional"
        };
        if (!dados.emissoras.length) {
          status.innerHTML = '<strong class="text-warning">Pendente:</strong> ainda não há empresa emissora cadastrada na SBA. Cadastre a empresa fiscal antes de solicitar homologação.';
        } else {
          status.innerHTML = dados.emissoras.map(e => {
            const faltam = Object.entries(e.dados).filter(([k,v]) => !v && nomes[k]).map(([k]) => nomes[k]);
            return '<p class="mb-1"><strong>' + esc(e.razaoSocial) + ' · CNPJ final ' + esc(e.identificacaoCnpj) + '</strong> — ' +
              (faltam.length ? '<span class="text-warning">Pendências: ' + esc(faltam.join(", ")) + '</span>' :
                '<span class="text-success">Cadastro preliminar preenchido; emissão direta ainda não homologada.</span>') + '</p>';
          }).join("");
        }
      } catch (erro) {
        status.textContent = erro.message || "Erro ao consultar a preparação da SBA.";
      } finally {
        btn.disabled = false;
      }
    }
    section.querySelector("#fiscalSbaVerificar")?.addEventListener("click", verificar);
    await verificar();
  }
  iniciar().catch(erro => console.warn("Integrações SBA não puderam ser carregadas:", erro.message));
})();