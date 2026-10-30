(() => {
 const usuario=JSON.parse(localStorage.getItem("usuarioLogado")||"null");
 if(!usuario?.token)return;
 async function api(path){
  const r=await fetch(API_URL+path,{headers:{Authorization:"Bearer "+usuario.token}});
  const d=await r.json();if(!r.ok)throw Error(d.error||"Não foi possível consultar o envio.");return d;
 }
 async function iniciar(){
  const empresa=await api("/empresas/me");if(Number(empresa.empresaid)!==2||empresa.slug!=="sba")return;
  const botao=document.createElement("button");botao.type="button";botao.className="btn btn-outline-primary";botao.textContent="Remetente das propostas";
  document.querySelector(".topbar").append(botao);
  const modal=document.createElement("div");modal.className="modal fade";modal.tabIndex=-1;
  modal.innerHTML='<div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Remetente das propostas</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div><div class="modal-body"><p>Suas propostas usam o e-mail do seu cadastro como remetente.</p><label class="d-block mb-3">Seu e-mail<input class="form-control" type="email" readonly></label><p class="small text-muted">A configuração do envio é feita pela administração da plataforma. Você só precisa selecionar a proposta e enviar.</p><p class="small" role="status" aria-live="polite"></p></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button></div></div></div>';
  document.body.append(modal);
  const status=modal.querySelector('[role="status"]'),email=modal.querySelector("input"),instancia=new bootstrap.Modal(modal);
  botao.addEventListener("click",async()=>{
   status.textContent="Consultando envio…";email.value="";instancia.show();
   try{const d=await api("/email-envio/me");email.value=d.email;status.textContent=d.configurado?"Remetente configurado. As propostas serão enviadas com este e-mail.":"A administração da plataforma precisa habilitar este remetente para liberar o envio.";}
   catch(e){status.textContent=e.message;}
  });
 }
 iniciar().catch(e=>console.error("Remetente das propostas:",e.message));
})();
