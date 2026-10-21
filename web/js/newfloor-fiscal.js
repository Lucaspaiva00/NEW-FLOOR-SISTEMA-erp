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
  const botoes=$("acoesDetalheFiscal");
  const colocarEnvio=()=>{
   const nota=window.__newFloorNotaAtual;
   if(!nota || nota.status!=="AUTORIZADA" || !botoes || botoes.querySelector("[data-envio-email-newfloor]"))return;
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