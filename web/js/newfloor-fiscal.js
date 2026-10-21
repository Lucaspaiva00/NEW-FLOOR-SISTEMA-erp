(() => {
 const user=JSON.parse(localStorage.getItem("usuarioLogado")||"null");
 const tokenNewFloor=user?.token;
 if(!tokenNewFloor || !document.getElementById("formNotaFiscal"))return;
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function iniciar(){
  const resp=await fetch(API_URL+"/empresas/me",{headers:{Authorization:"Bearer "+tokenNewFloor}});
  if(!resp.ok)return;
  const tenant=await resp.json();
  if(Number(tenant.empresaid)!==1||tenant.slug!=="new-floor")return;
  window.__newFloorFiscal=true;
  const email=$("nfDestEmail");
  if(email && !$("nfDestEmailAdicional")){
   const div=document.createElement("div");
   div.className="col-md-3";
   div.innerHTML='<label for="nfDestEmailAdicional">E-mail adicional (opcional)</label>'+
    '<input id="nfDestEmailAdicional" type="email" class="form-control" maxlength="254" placeholder="copia@empresa.com.br">'+
    '<small class="text-muted">Cópia do documento autorizado para outro destinatário.</small>';
   email.closest(".col-md-3")?.after(div);
  }
  const principal=$("nfDestNome");
  if(principal){
   principal.closest("div")?.querySelector("label")?.replaceChildren(document.createTextNode("Razão social do cliente *"));
  }
  const obs=$("nfInformacoesAdicionais");
  if(obs){
   obs.setAttribute("placeholder","Observações da nota fiscal (informações adicionais da operação).");
   const label=document.createElement("label");
   label.htmlFor="nfInformacoesAdicionais";
   label.textContent="Observações da nota fiscal";
   label.className="form-label fw-semibold";
   obs.before(label);
   const note=document.createElement("small");
   note.className="d-block text-muted mt-1";
   note.textContent="A descrição fiscal obrigatória dos itens permanece nos serviços/produtos. Use este campo para observações gerais.";
   obs.after(note);
  }
  // O campo legado de informação por item não deve competir com observações gerais.
  const lista=$("listaItensFiscal");
  const esconderInformacoes=()=>{
   lista?.querySelectorAll('[data-field="informacoesAdicionais"]').forEach(input=>{
    // Não descartar valores legados existentes: preservá-los no item.
    const container=input.closest(".col-12");
    if(container)container.hidden=true;
   });
  };
  const observer=new MutationObserver(esconderInformacoes);
  if(lista){observer.observe(lista,{childList:true,subtree:true});esconderInformacoes();}
  // Campos da NFS-e Nacional exclusivos da New Floor. Preenchidos
  // conscientemente pelo usuário/contabilidade, nunca presumidos.
  const nfseBloco=$("blocoNfse");
  if(nfseBloco && !$("nfTributosNewFloor")){
   const painel=document.createElement("div");
   painel.id="nfTributosNewFloor";
   painel.className="border rounded p-3 mt-3";
   painel.innerHTML='<h6>Tributação — NFS-e Nacional (New Floor)</h6>'+
    '<p class="small text-muted">Preencha conforme a orientação contábil. Campos em branco não geram percentuais ou CST fictícios. Essas informações serão incluídas no JSON enviado à Focus.</p>'+
    '<div class="row g-3">'+
    '<label class="col-12 col-sm-3">Situação tributária PIS/COFINS<input id="nfTribPis" class="form-control" maxlength="2" placeholder="CST"></label>'+
    '<label class="col-12 col-sm-3">Total tributos federais (%)<input id="nfTribFederal" type="number" min="0" max="100" step="0.01" class="form-control" placeholder="Conforme contabilidade"></label>'+
    '<label class="col-12 col-sm-3">Total tributos estaduais (%)<input id="nfTribEstadual" type="number" min="0" max="100" step="0.01" class="form-control"></label>'+
    '<label class="col-12 col-sm-3">Total tributos municipais (%)<input id="nfTribMunicipal" type="number" min="0" max="100" step="0.01" class="form-control"></label></div>'+
    '<small class="text-muted d-block mt-2">O CEP do tomador deve ter código IBGE do município preenchido. A descrição fiscal deve ter no máximo 2.000 caracteres.</small>';
   nfseBloco.append(painel);
  }
  const camposTrib=[
   ["nfTribPis","situacao_tributaria_pis_cofins"],
   ["nfTribFederal","percentual_total_tributos_federais"],
   ["nfTribEstadual","percentual_total_tributos_estaduais"],
   ["nfTribMunicipal","percentual_total_tributos_municipais"]
  ];
  function carregarTributos(){
   let extra={};
   try{extra=JSON.parse($("nfPayloadExtra")?.value||"{}");}catch(_){return;}
   for(const [id,key]of camposTrib){const input=$(id);if(input)input.value=extra[key]??"";}
   const info=$("nfInformacoesAdicionais");
   if(info){
    const plain=String(info.value||"").replace(/<[^>]*>/g,"").trim();
    const counter=$("nfDescricaoNacionalCount");
    if(counter){
     counter.textContent="Descrição fiscal (sem HTML): "+plain.length+" / 2.000 caracteres";
     counter.classList.toggle("text-danger",plain.length>2000);
    }
   }
  }
  const obsCounter=document.createElement("small");obsCounter.id="nfDescricaoNacionalCount";
  obsCounter.className="d-block text-muted mt-1";
  $("nfInformacoesAdicionais")?.after(obsCounter);
  $("nfInformacoesAdicionais")?.addEventListener("input",carregarTributos);
  $("modalNotaFiscal")?.addEventListener("shown.bs.modal",carregarTributos);
  $("formNotaFiscal")?.addEventListener("submit",event=>{
   const json=$("nfPayloadExtra");
   if(!json)return;
   let extra={};
   try{extra=JSON.parse(json.value||"{}");}
   catch(_){return;} // validação nativa existente exibirá o erro de JSON
   for(const [id,key]of camposTrib){
    const input=$(id),value=input?.value.trim()||"";
    if(!input)continue;
    if(!value){delete extra[key];continue;}
    if(key==="situacao_tributaria_pis_cofins"){
      if(!/^\d{2}$/.test(value)){event.preventDefault();event.stopImmediatePropagation();alert("Informe o CST de PIS/COFINS com 2 dígitos, conforme a contabilidade.");return;}
      extra[key]=value;
    }else{
      const numero=Number(value);
      if(!Number.isFinite(numero)||numero<0||numero>100){event.preventDefault();event.stopImmediatePropagation();alert("Revise os percentuais tributários informados.");return;}
      extra[key]=numero;
    }
   }
   json.value=Object.keys(extra).length?JSON.stringify(extra):"";
  },true);
  const botoes=$("acoesDetalheFiscal");
  const colocarEnvio=()=>{
   const nota=window.__newFloorNotaAtual;
   if(!nota || nota.status!=="AUTORIZADA" || !botoes || botoes.querySelector("[data-envio-email-newfloor]"))return;
   if(nota.tipo==="NFSE" && (nota.padraoNfseEmissao || nota.empresaFiscal?.padraoNfse)==="NACIONAL")return;
   const botao=document.createElement("button");
   botao.type="button";botao.className="btn btn-outline-primary";
   botao.dataset.envioEmailNewfloor=String(nota.notafiscalid);
   botao.textContent="Enviar nota por e-mail";
   botoes.appendChild(botao);
  };
  if(botoes){
   const monitor=new MutationObserver(colocarEnvio);
   monitor.observe(botoes,{childList:true});
   botoes.addEventListener("click",async e=>{
    const btn=e.target.closest("[data-envio-email-newfloor]");if(!btn)return;
    btn.disabled=true;
    try{
     const id=Number(btn.dataset.envioEmailNewfloor);
     const res=await fetch(API_URL+"/fiscal/notas/"+id+"/enviar-emails",{
      method:"POST",headers:{Authorization:"Bearer "+tokenNewFloor,"Content-Type":"application/json"},body:"{}"
     });
     const d=await res.json().catch(()=>({}));
     if(!res.ok)throw Error(d.error||"Não foi possível enviar.");
     await Swal.fire({icon:"success",title:"Envio solicitado",text:d.message});
    }catch(error){await Swal.fire({icon:"error",title:"Não foi possível enviar",text:error.message});}
    finally{btn.disabled=false;}
   });
  }
  window.addEventListener("newfloor-nota-detalhe",event=>{window.__newFloorNotaAtual=event.detail;colocarEnvio();});
 }
 iniciar().catch(e=>console.error("Recursos New Floor indisponíveis",e));
})();