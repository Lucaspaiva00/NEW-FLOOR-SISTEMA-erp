/* Cadastro de padrões fiscais SBA. Não instala campos em outros perfis. */
(() => {
  const el=id=>document.getElementById(id);
  const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const empresaFields=["opSimpNac","regEspTrib","tribISSQN","tpRetISSQN","indTotTrib","cLocPrestacao"];
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
    ?dados.emissoras.find(x=>String(x.id)===el("sbaCfgEmpresa")?.value)
    :dados.servicos.find(x=>String(x.id)===el("sbaCfgServico")?.value);
  function carregarSelecao(tipo){
    const campos=tipo==="empresa"?empresaFields:servicoFields;
    setValues(campos,tipo==="empresa"?"sbaCfgE_":"sbaCfgS_",selecionada(tipo)?.padroes||{});
  }
  function render(){
    if(el("sbaPadroesFiscais"))return;
    const panel=document.createElement("section");
    panel.id="sbaPadroesFiscais";
    panel.className="fiscal-panel p-3 mb-3";
    panel.style.marginTop="16px";
    panel.innerHTML=
      '<div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">'+
      '<div><h2 class="h5 fw-bold mb-1">Padrões fiscais de NFS-e · SBA</h2>'+
      '<p class="small text-muted mb-0">Cadastre uma vez com a contabilidade. A emissão direta continua em preparação.</p></div>'+
      '<button type="button" id="sbaCfgRecarregar" class="btn-secondary-fiscal">Atualizar cadastros</button></div>'+
      '<div class="alert alert-warning small py-2">Padrões são sugestões para cada nota. Confira sempre o serviço, o município, a retenção e as condições do tomador antes de emitir.</div>'+
      '<div class="row g-3">'+
        '<div class="col-12 col-xl-6"><div class="border rounded p-3 h-100">'+
          '<h3 class="h6 fw-bold">1. Padrões da empresa emissora</h3>'+
          '<label for="sbaCfgEmpresa" class="form-label small">Emissora</label>'+
          '<select id="sbaCfgEmpresa" class="form-select mb-3"></select>'+
          '<div class="row g-3">'+empresaFields.map(key=>campo(key,"sbaCfgE_")).join("")+'</div>'+
          '<button type="button" id="sbaSalvarCfgEmpresa" class="btn-secondary-fiscal mt-3">Salvar padrões da empresa</button>'+
        '</div></div>'+
        '<div class="col-12 col-xl-6"><div class="border rounded p-3 h-100">'+
          '<h3 class="h6 fw-bold">2. Classificação fiscal por serviço</h3>'+
          '<p class="small text-muted">Escolha um serviço cadastrado. Materiais sem prestação de serviço não devem receber classificação NFS-e.</p>'+
          '<label for="sbaCfgServico" class="form-label small">Serviço cadastrado</label>'+
          '<select id="sbaCfgServico" class="form-select mb-3"></select>'+
          '<div class="row g-3">'+servicoFields.map(key=>campo(key,"sbaCfgS_")).join("")+'</div>'+
          '<button type="button" id="sbaSalvarCfgServico" class="btn-secondary-fiscal mt-3">Salvar classificação do serviço</button>'+
        '</div></div>'+
      '</div>';
    const ref=el("fiscalIntegracoesSba")||document.querySelector(".fiscal-kpis");
    ref?.after(panel);
    el("sbaCfgEmpresa").addEventListener("change",()=>carregarSelecao("empresa"));
    el("sbaCfgServico").addEventListener("change",()=>carregarSelecao("servico"));
    el("sbaCfgRecarregar").addEventListener("click",()=>atualizar().catch(erro=>Swal.fire("Erro",erro.message,"error")));
    async function salvar(tipo){
      const entity=selecionada(tipo);
      if(!entity){await Swal.fire("Cadastro necessário","Selecione uma emissora ou serviço.","warning");return;}
      const btn=el(tipo==="empresa"?"sbaSalvarCfgEmpresa":"sbaSalvarCfgServico");
      btn.disabled=true;
      try{
        const value=getValues(tipo==="empresa"?empresaFields:servicoFields,tipo==="empresa"?"sbaCfgE_":"sbaCfgS_");
        await api("/fiscal/sba/padroes/"+tipo+"/"+entity.id,{method:"PUT",body:JSON.stringify(value)});
        await atualizar();
        await Swal.fire({icon:"success",title:"Padrões salvos",text:"As próximas NFS-e usarão esses dados quando não houver informação específica na nota.",timer:2200,showConfirmButton:false});
      }catch(err){await Swal.fire({icon:"error",title:"Não foi possível salvar",text:err.message});}
      finally{btn.disabled=false;}
    }
    el("sbaSalvarCfgEmpresa").addEventListener("click",()=>salvar("empresa"));
    el("sbaSalvarCfgServico").addEventListener("click",()=>salvar("servico"));
  }
  async function atualizar(){
    const nova=await api("/fiscal/sba/padroes");
    dados=nova;
    const ce=el("sbaCfgEmpresa"),cs=el("sbaCfgServico");
    const preE=ce?.value,preS=cs?.value;
    if(ce){
      ce.innerHTML=dados.emissoras.map(x=>'<option value="'+x.id+'">'+escapeHtml(x.nome)+'</option>').join("");
      if(dados.emissoras.some(x=>String(x.id)===preE))ce.value=preE;
    }
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
    el("modalNotaFiscal")?.addEventListener("shown.bs.modal",()=>{
      // A tela original preenche o rascunho primeiro; apenas campos vazios recebem padrão.
      queueMicrotask(preencherNotaComPadroes);
    });
    el("nfEmpresa")?.addEventListener("change",preencherNotaComPadroes);
    el("nfTipo")?.addEventListener("change",preencherNotaComPadroes);
  }
  iniciar().catch(e=>console.warn("Padrões fiscais SBA:",String(e?.message||"indisponível")));
})();