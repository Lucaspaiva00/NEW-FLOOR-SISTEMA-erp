/* Cadastro de padrões fiscais SBA. Não instala campos em outros perfis. */
(() => {
  const el=id=>document.getElementById(id);
  const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const empresaFields=["opSimpNac","regEspTrib","tribISSQN","tpRetISSQN","indTotTrib","cLocPrestacao"];
  // tribISSQN e regEspTrib já aparecem em Padrões NFS-e do modal da empresa.
  const empresaCamposAdicionais=["opSimpNac","tpRetISSQN","indTotTrib","cLocPrestacao"];
  const servicoFields=["cTribNac","itemListaServico","cTribMun","cNBS"];
  const labels={
    opSimpNac:"Opção pelo Simples Nacional",regEspTrib:"Regime especial municipal",
    tribISSQN:"Tributação ISSQN",tpRetISSQN:"Retenção ISSQN",
    indTotTrib:"Indicador tributos totais",cLocPrestacao:"Município prestação (IBGE)",
    cTribNac:"Código nacional do serviço (cTribNac)",
    itemListaServico:"Item da lista de serviços",cTribMun:"Tributação municipal",cNBS:"NBS"
  };
  const opcoes={
    opSimpNac:[["1","1 — Não optante"],["2","2 — MEI"],["3","3 — ME/EPP"]],
    regEspTrib:[["0","0 — Nenhum"],["1","1 — Cooperativa"],["2","2 — Estimativa"],
      ["3","3 — Microempresa municipal"],["4","4 — Notário/registrador"],
      ["5","5 — Autônomo"],["6","6 — Sociedade de profissionais"],["9","9 — Outros"]],
    tribISSQN:[["1","1 — Tributável"],["2","2 — Imune"],["3","3 — Exportação"],["4","4 — Não incidência"]],
    tpRetISSQN:[["1","1 — Não retido"],["2","2 — Tomador"],["3","3 — Intermediário"]],
    indTotTrib:[["0","0 — Não informar estimativa"]]
  };
  let dados={emissoras:[],servicos:[]};
  let token="";
  async function api(path,options={}){
    const res=await fetch(API_URL+path,{...options,headers:{
      Authorization:"Bearer "+token,...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})
    }});
    const body=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(body.error||"Não foi possível salvar os padrões fiscais.");
    return body;
  }
  function campo(key,prefix){
    const id=prefix+key;
    if(opcoes[key]){
      return '<div class="col-12 col-md-6"><label class="form-label small fw-semibold" for="'+id+'">'+
        escapeHtml(labels[key])+'</label><select id="'+id+'" class="form-select">'+
        '<option value="">Não definido</option>'+
        opcoes[key].map(([v,n])=>'<option value="'+v+'">'+escapeHtml(n)+'</option>').join("")+
        '</select></div>';
    }
    return '<div class="col-12 col-md-6"><label class="form-label small fw-semibold" for="'+id+'">'+
      escapeHtml(labels[key])+'</label><input class="form-control" id="'+id+'" autocomplete="off" placeholder="Conforme contabilidade"></div>';
  }
  const getValues=(fields,prefix)=>Object.fromEntries(fields.map(key=>[key,el(prefix+key)?.value.trim()||""])
    .filter(([,v])=>v!==""));
  const setValues=(fields,prefix,data)=>fields.forEach(key=>{
    const input=el(prefix+key);if(input)input.value=data?.[key]||"";
  });
  const selecionada=(tipo)=>tipo==="empresa"
    ?dados.emissoras.find(x=>String(x.id)===el("empresaFiscalId")?.value)
    :dados.servicos.find(x=>String(x.id)===el("sbaCfgServico")?.value);
  function carregarSelecao(tipo){
    const campos=tipo==="empresa"?empresaCamposAdicionais:servicoFields;
    const cadastro=selecionada(tipo);
    setValues(campos,tipo==="empresa"?"sbaCfgE_":"sbaCfgS_",cadastro?.padroes||{});
    if(tipo==="empresa"){
      const nome=el("sbaCfgEmissoraNome");
      if(nome)nome.textContent=cadastro?.nome||"Primeiro salve o cadastro da empresa emissora.";
      const botao=el("sbaSalvarCfgEmpresa");
      if(botao)botao.disabled=!cadastro;
    }
    if(tipo==="servico"&&el("sbaCfgServicoNome"))el("sbaCfgServicoNome").value=cadastro?.nome||"";
  }
  // Usa os campos já existentes no modal, sem exibir formulários duplicados.
  function aplicarValoresConfirmadosEmpresa(){
    const valores=selecionada("empresa")?.padroes||{};
    if(valores.tribISSQN!=null && el("efNaturezaNfse"))
      el("efNaturezaNfse").value=String(valores.tribISSQN);
    if(valores.regEspTrib!=null && el("efRegimeEspecialNfse"))
      el("efRegimeEspecialNfse").value=String(valores.regEspTrib);
  }
  function render(){
    const body=el("modalEmpresaFiscal")?.querySelector(".modal-body");
    if(!body||el("sbaPadroesFiscais"))return;
    const panel=document.createElement("details");
    panel.id="sbaPadroesFiscais";
    panel.className="border rounded p-3 mt-3";
    panel.innerHTML=
      '<summary class="fw-semibold" style="cursor:pointer">Configurações complementares NFS-e Nacional · SBA</summary>'+
      '<div class="mt-3">'+
        '<p class="small text-muted">Configure os dados confirmados pela contabilidade uma vez no cadastro da empresa. Estes padrões apenas preenchem rascunhos: cada nota ainda precisa de conferência.</p>'+
        '<div class="alert alert-warning py-2 small">A tributação do ISS e o regime especial ficam nos campos <strong>Padrões NFS-e</strong>, logo acima. Os demais parâmetros são informados aqui. Não preencha códigos por tentativa.</div>'+
        '<div class="mb-3"><span class="small text-muted">Emissora em edição:</span> <strong id="sbaCfgEmissoraNome" class="small"></strong></div>'+
        '<div class="row g-3">'+empresaCamposAdicionais.map(key=>campo(key,"sbaCfgE_")).join("")+'</div>'+
        '<div class="d-flex flex-wrap align-items-center gap-2 mt-3">'+
          '<button type="button" id="sbaSalvarCfgEmpresa" class="btn-secondary-fiscal">Salvar padrões da NFS-e</button>'+
          '<span class="text-muted small">Para salvar também os dados gerais da emissora, use “Salvar empresa” abaixo.</span>'+
        '</div>'+
        '<details class="border rounded p-3 mt-4" id="sbaCfgTiposServico">'+
          '<summary class="fw-semibold" style="cursor:pointer">Classificações fiscais dos tipos de serviço</summary>'+
          '<div class="mt-3">'+
            '<p class="small text-muted">Cadastre a classificação de cada serviço uma vez. Esta lista é fiscal e não altera o cadastro de materiais da SBA.</p>'+
            '<label for="sbaCfgServico" class="form-label small">Tipo de serviço fiscal</label>'+
            '<select id="sbaCfgServico" class="form-select mb-3"></select>'+
            '<button type="button" id="sbaCriarTipoServico" class="btn-secondary-fiscal mb-3">+ Cadastrar tipo de serviço</button>'+
            '<label for="sbaCfgServicoNome" class="form-label small">Nome do tipo de serviço</label>'+
            '<input id="sbaCfgServicoNome" class="form-control mb-3" maxlength="120" autocomplete="off">'+
            '<div class="row g-3">'+servicoFields.map(key=>campo(key,"sbaCfgS_")).join("")+'</div>'+
            '<button type="button" id="sbaSalvarCfgServico" class="btn-secondary-fiscal mt-3">Salvar classificação fiscal</button>'+
          '</div>'+
        '</details>'+
      '</div>';
    // Exclusivamente dentro do modal Empresa emissora, imediatamente após
    // Padrões NFS-e. Não cria cartão no dashboard/na tela principal.
    const titulos=[...body.querySelectorAll(".fiscal-section-title")];
    const titulo=titulos.find(x=>x.textContent.trim()==="Padrões NFS-e");
    const linha=titulo?.nextElementSibling;
    if(linha?.parentElement===body)linha.after(panel);
    else body.appendChild(panel);
    el("sbaCfgServico").addEventListener("change",()=>carregarSelecao("servico"));
    async function salvar(tipo){
      const entity=selecionada(tipo);
      if(!entity){
        await Swal.fire({icon:"info",title:"Cadastro necessário",
          text:tipo==="empresa"?"Salve a empresa emissora antes de configurar seus padrões fiscais.":"Selecione um tipo de serviço fiscal."});
        return;
      }
      const btn=el(tipo==="empresa"?"sbaSalvarCfgEmpresa":"sbaSalvarCfgServico");
      btn.disabled=true;
      try{
        const value=tipo==="empresa"
          ?getValues(empresaCamposAdicionais,"sbaCfgE_")
          :getValues(servicoFields,"sbaCfgS_");
        if(tipo==="empresa"){
          // Reaproveita os campos próprios do modal, sem duplicá-los.
          value.tribISSQN=el("efNaturezaNfse")?.value||"";
          value.regEspTrib=el("efRegimeEspecialNfse")?.value||"";
        }else value.nome=el("sbaCfgServicoNome").value.trim();
        await api("/fiscal/sba/padroes/"+tipo+"/"+entity.id,{
          method:"PUT",body:JSON.stringify(value)
        });
        await atualizar();
        await Swal.fire({icon:"success",title:"Configuração fiscal salva",
          text:"Os dados serão sugeridos nas próximas NFS-e da SBA e podem ser ajustados por nota.",
          timer:2200,showConfirmButton:false});
      }catch(err){
        await Swal.fire({icon:"error",title:"Não foi possível salvar",text:err.message});
      }finally{
        btn.disabled=false;
      }
    }
    el("sbaSalvarCfgEmpresa").addEventListener("click",()=>salvar("empresa"));
    el("sbaSalvarCfgServico").addEventListener("click",()=>salvar("servico"));
    el("sbaCriarTipoServico").addEventListener("click",async()=>{
      const resposta=await Swal.fire({
        title:"Cadastrar tipo de serviço fiscal",input:"text",
        inputLabel:"Nome do tipo de serviço prestado (não material)",
        inputPlaceholder:"Ex.: Instalação de estruturas metálicas",
        inputAttributes:{"maxlength":"120"},showCancelButton:true,
        confirmButtonText:"Criar cadastro",cancelButtonText:"Cancelar",
        inputValidator:v=>!v||v.trim().length<3?"Informe pelo menos 3 caracteres.":undefined
      });
      if(!resposta.isConfirmed)return;
      try{
        const novo=await api("/fiscal/sba/padroes/servico",{
          method:"POST",body:JSON.stringify({nome:resposta.value.trim()})
        });
        await atualizar();
        el("sbaCfgTiposServico").open=true;
        el("sbaCfgServico").value=novo.id;
        carregarSelecao("servico");
        await Swal.fire({icon:"success",title:"Serviço fiscal cadastrado",
          text:"Preencha os códigos confirmados pela contabilidade e salve a classificação."});
      }catch(err){
        await Swal.fire({icon:"error",title:"Erro ao criar serviço",text:err.message});
      }
    });
  }
  async function atualizar(){
    const nova=await api("/fiscal/sba/padroes");
    dados=nova;
    const cs=el("sbaCfgServico");
    const preS=cs?.value;
    if(cs){
      cs.innerHTML='<option value="">Selecione serviço...</option>'+
        dados.servicos.map(x=>'<option value="'+x.id+'">'+escapeHtml(x.codigo||"")+" — "+escapeHtml(x.nome)+'</option>').join("");
      if(dados.servicos.some(x=>String(x.id)===preS))cs.value=preS;
    }
    carregarSelecao("empresa");carregarSelecao("servico");
    construirSelecaoNota();
  }
  function construirSelecaoNota(){
    const original=el("sbaParametrosDps");
    if(!original)return;
    let select=el("sbaNotaServico");
    if(!select){
      const bloco=document.createElement("div");
      bloco.className="mb-3";
      bloco.innerHTML='<label class="form-label small fw-semibold" for="sbaNotaServico">Serviço cadastrado para classificação NFS-e</label>'+
        '<select id="sbaNotaServico" class="form-select"><option value="">Selecione se houver serviço cadastrado</option></select>'+
        '<small class="text-muted">Ao escolher um serviço, os códigos da classificação fiscal cadastrada serão aplicados. Revise antes de salvar.</small>';
      const row=original.querySelector(".row");
      original.insertBefore(bloco,row||original.firstChild);
      select=el("sbaNotaServico");
      select.addEventListener("change",()=>{
        let extra={};
        try{extra=JSON.parse(el("nfPayloadExtra")?.value||"{}");}catch{}
        const escolhido=dados.servicos.find(x=>String(x.id)===select.value);
        if(escolhido){
          extra.sbaServicoId=escolhido.id;
          for(const key of ["cTribNac","cTribMun","cNBS"]){
            const input=el("sbaDps_"+key);
            if(input)input.value=escolhido.padroes?.[key]||"";
          }
          if(escolhido.padroes?.itemListaServico)el("nfItemListaServico").value=escolhido.padroes.itemListaServico;
        }else{
          delete extra.sbaServicoId;
        }
        el("nfPayloadExtra").value=JSON.stringify(extra,null,2);
        el("sbaDps_cTribNac")?.dispatchEvent(new Event("input",{bubbles:true}));
      });
    }
    const old=select.value;
    select.innerHTML='<option value="">Nenhum serviço selecionado</option>'+
      dados.servicos.map(x=>'<option value="'+x.id+'">'+escapeHtml(x.codigo||"")+" — "+escapeHtml(x.nome)+'</option>').join("");
    if(dados.servicos.some(x=>String(x.id)===old))select.value=old;
  }
  function preencherNotaComPadroes(){
    if(el("nfTipo")?.value!=="NFSE")return;
    construirSelecaoNota();
    const fiscal=dados.emissoras.find(x=>String(x.id)===el("nfEmpresa")?.value);
    let extra={};
    try{extra=JSON.parse(el("nfPayloadExtra")?.value||"{}");}catch{return;}
    const select=el("sbaNotaServico");
    const id=extra.sbaServicoId;
    if(select)select.value=dados.servicos.some(x=>String(x.id)===String(id))?String(id):"";
    const servico=dados.servicos.find(x=>String(x.id)===select?.value);
    const defaults={...(fiscal?.padroes||{}),...(servico?.padroes||{})};
    for(const key of [...empresaFields,"cTribNac","cTribMun","cNBS"]){
      const field=el("sbaDps_"+key);
      if(field && !field.value && extra[key]==null && defaults[key]!=null){
        field.value=String(defaults[key]);
      }
    }
    if(!el("nfItemListaServico")?.value && (servico?.padroes?.itemListaServico || fiscal?.itemListaServicoPadrao)){
      el("nfItemListaServico").value=servico?.padroes?.itemListaServico||fiscal.itemListaServicoPadrao;
    }
    el("sbaDps_cTribNac")?.dispatchEvent(new Event("input",{bubbles:true}));
  }
  async function iniciar(){
    const usuario=JSON.parse(localStorage.getItem("usuarioLogado")||"null");
    if(!usuario?.token||typeof API_URL==="undefined"||!el("formNotaFiscal"))return;
    token=usuario.token;
    const resp=await fetch(API_URL+"/empresas/me",{headers:{Authorization:"Bearer "+token}});
    if(!resp.ok)return;
    const tenant=await resp.json();
    if(tenant.slug!=="sba"||tenant.configuracaoSistema?.perfil!=="SBA")return;
    render();
    await atualizar();
    el("modalEmpresaFiscal")?.addEventListener("shown.bs.modal",()=>{
      // A tela fiscal já preencheu os dados da emissora no modal.
      carregarSelecao("empresa");
      aplicarValoresConfirmadosEmpresa();
    });
    el("modalEmpresaFiscal")?.addEventListener("hidden.bs.modal",()=>{
      el("sbaPadroesFiscais")?.removeAttribute("open");
      el("sbaCfgTiposServico")?.removeAttribute("open");
    });
    el("modalNotaFiscal")?.addEventListener("shown.bs.modal",()=>{
      // A tela original preenche o rascunho primeiro; apenas campos vazios recebem padrão.
      queueMicrotask(preencherNotaComPadroes);
    });
    el("nfEmpresa")?.addEventListener("change",preencherNotaComPadroes);
    el("nfTipo")?.addEventListener("change",preencherNotaComPadroes);
  }
  iniciar().catch(e=>console.warn("Padrões fiscais SBA:",String(e?.message||"indisponível")));
})();