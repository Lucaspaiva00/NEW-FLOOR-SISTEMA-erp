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
    // Adapta somente o modal da SBA: o HTML compartilhado continua intacto
    // para New Floor e José, mas o Luiz não vê campos ou tokens Focus.
    const modalEmpresa = document.getElementById("modalEmpresaFiscal");
    const aplicarCadastroDireto = () => {
      const provedor = document.getElementById("efProvedor");
      const padrao = document.getElementById("efPadraoNfse");
      if (!provedor || !padrao) return;
      const field = provedor.closest(".col-md-4");
      const label = field?.querySelector("label");
      if (label) label.textContent = "Serviços: integração planejada";
      provedor.value = "Portal Nacional — em preparação";
      provedor.readOnly = true;
      padrao.value = "NACIONAL";
      padrao.disabled = true; // fiscal.js lê .value normalmente.
      for (const id of ["efTokenHomologacao", "efTokenProducao"]) {
        const input = document.getElementById(id);
        if (!input) continue;
        input.value = "";
        input.disabled = true;
        input.closest(".col-md-6")?.setAttribute("hidden", "");
      }
      const area = field?.parentElement;
      if (area && !document.getElementById("avisoCadastroSbaSemFocus")) {
        const aviso = document.createElement("div");
        aviso.id = "avisoCadastroSbaSemFocus";
        aviso.className = "col-12";
        aviso.innerHTML = '<div class="alert alert-info mb-0" role="status"><strong>SBA:</strong> a NFS-e de serviços será integrada diretamente ao Portal Nacional. Para notas de materiais, a integração pretendida é o SIEG Emissor. <strong>Não é necessário preencher tokens Focus.</strong> Essas emissões ainda não estão habilitadas no ERP. Cadastre os dados fiscais e o certificado A1 para avançar na configuração.</div>';
        area.appendChild(aviso);
      }
      const note = document.querySelector(".fiscal-certificate-section .certificate-note");
      if (note) note.textContent = "Certificado A1 armazenado de forma criptografada para preparar a integração direta da SBA; nenhum documento será transmitido antes da homologação.";
    };
    modalEmpresa?.addEventListener("show.bs.modal", aplicarCadastroDireto);
    modalEmpresa?.addEventListener("shown.bs.modal", aplicarCadastroDireto);
    document.getElementById("formEmpresaFiscal")?.addEventListener("submit", aplicarCadastroDireto, true);
    // Validar o PFX ANTES de alterar o cadastro da empresa: evita salvar
    // parcialmente e depois receber erro de senha/chave do certificado.
    const formEmissora=document.getElementById("formEmpresaFiscal");
    let liberadoParaSalvar=false, validandoA1=false;
    formEmissora?.addEventListener("submit",async event=>{
      if(liberadoParaSalvar)return;
      const input=document.getElementById("certificadoA1");
      const file=input?.files?.[0];
      if(!file)return; // Luiz pode salvar cadastro mesmo sem enviar A1.
      event.preventDefault();
      event.stopImmediatePropagation();
      if(validandoA1)return;
      const senha=document.getElementById("senhaCertificadoA1")?.value||"";
      if(!senha){await Swal.fire({icon:"warning",title:"Senha do A1 necessária",text:"Informe a senha do arquivo PFX/P12."});return;}
      if(!/\.(pfx|p12)$/i.test(file.name)||file.size>1024*1024||!file.size){
        await Swal.fire({icon:"warning",title:"Arquivo inválido",text:"Selecione um PFX ou P12 com até 1 MB."});return;
      }
      validandoA1=true;
      const btn=formEmissora.querySelector('button[type="submit"]')||
        document.querySelector('#modalEmpresaFiscal button[type="submit"]');
      if(btn)btn.disabled=true;
      try{
        const arquivo=await new Promise((resolve,reject)=>{
          const reader=new FileReader();
          reader.onload=()=>resolve(String(reader.result).split(",")[1]);
          reader.onerror=()=>reject(new Error("Não foi possível ler o arquivo A1."));
          reader.readAsDataURL(file);
        });
        const resposta=await fetch(API_URL+"/fiscal/sba/certificado/validar",{
          method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
          body:JSON.stringify({arquivo,senha,nome:file.name})
        });
        const dados=await resposta.json().catch(()=>({}));
        if(!resposta.ok||!dados.valido)throw Error(dados.error||"O certificado A1 não passou na validação.");
        liberadoParaSalvar=true;
        try{formEmissora.requestSubmit();}finally{liberadoParaSalvar=false;}
      }catch(err){
        await Swal.fire({icon:"error",title:"Certificado A1 não aceito",text:err.message,
          footer:"Os dados da empresa não foram alterados nesta tentativa. Confira a senha, a validade e se o arquivo foi exportado com chave privada."});
      }finally{
        validandoA1=false;
        if(btn)btn.disabled=false;
      }
    },true);
    const certInput=document.getElementById("certificadoA1");
    if(certInput && !document.getElementById("sbaAvisoCertificadoA1")){
      const aviso=document.createElement("small");
      aviso.id="sbaAvisoCertificadoA1";
      aviso.className="d-block text-muted mt-2";
      aviso.textContent="O PFX deve conter a chave privada e estar vigente. Não coloque senhas no nome do arquivo. Validação antes de salvar os dados.";
      certInput.after(aviso);
    }

    // Mesmo os rascunhos não devem sugerir que a emissão via Focus funciona.
    const modalDetalhe = document.getElementById("modalDetalheFiscal");
    modalDetalhe?.addEventListener("shown.bs.modal", () => {
      modalDetalhe.querySelectorAll("[data-emitir-nota]").forEach(btn => {
        btn.disabled = true;
        btn.title = "SBA: emissão direta do Portal Nacional/SIEG ainda em preparação.";
        btn.textContent = "Emissão em preparação";
      });
    });

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
        '<button type="button" id="fiscalSbaAssinatura" class="btn-secondary-fiscal" disabled>Testar assinatura do A1</button>' +
      '</div>' +
      '<p class="small text-muted mt-3 mb-0">A emissão direta no ERP ainda não está habilitada. Não use “Emitir agora” para uma nota SBA como se o Portal Nacional estivesse integrado. Continue emitindo nos portais oficiais até a homologação.</p>';
    area.after(section);
    section.querySelector("#fiscalSbaCadastro")?.addEventListener("click", () =>
      document.querySelector('[data-fiscal-tab="empresas"]')?.click());
    let emissoraParaTeste=null;
    const btnAssinatura=section.querySelector("#fiscalSbaAssinatura");
    btnAssinatura?.addEventListener("click",async()=>{
      if(!emissoraParaTeste)return;
      btnAssinatura.disabled=true;
      try{
        const response=await fetch(API_URL+"/fiscal/sba/nfse/certificado/"+emissoraParaTeste+"/testar",{
          method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:"{}"
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw Error(data.error||"Assinatura local do A1 não pôde ser concluída.");
        await Swal.fire({
          icon:"success",title:"Assinatura local validada",
          text:"Certificado vigente até "+data.certificadoValidoAte+". O teste não transmitiu nota. A DPS em XML ainda precisa ser assinada e homologada na SEFIN."
        });
      }catch(e){
        await Swal.fire({icon:"error",title:"Falha no teste do A1",text:e.message});
      }finally{btnAssinatura.disabled=false;}
    });
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
        emissoraParaTeste=dados.emissoras.find(e=>e.dados?.certificadoA1)?.id||null;
        if(btnAssinatura)btnAssinatura.disabled=!emissoraParaTeste;
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