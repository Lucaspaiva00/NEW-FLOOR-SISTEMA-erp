(() => {
 const usuario=JSON.parse(localStorage.getItem("usuarioLogado")||"null");
 if(!usuario?.token)return;
 async function api(path,options={}){
  const r=await fetch(API_URL+path,{...options,headers:{Authorization:"Bearer "+usuario.token,"Content-Type":"application/json"}});
  const d=await r.json();if(!r.ok)throw Error(d.error||"Não foi possível configurar seu e-mail.");return d;
 }
 async function iniciar(){
  const empresa=await api("/empresas/me");if(Number(empresa.empresaid)!==2||empresa.slug!=="sba")return;
  const botao=document.createElement("button");botao.type="button";botao.className="btn btn-outline-primary";botao.textContent="Meu e-mail de envio";
  document.querySelector(".topbar").append(botao);
  const modal=document.createElement("div");modal.className="modal fade";modal.tabIndex=-1;
  modal.innerHTML='<div class="modal-dialog modal-dialog-centered"><form class="modal-content"><div class="modal-header"><h5 class="modal-title">Meu e-mail de envio</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div><div class="modal-body"><p>As propostas sairão pelo e-mail do seu cadastro na SBA. Conecte sua caixa de e-mail para habilitar o envio.</p><label class="d-block mb-3">E-mail do cadastro<input name="email" class="form-control" type="email" readonly></label><label class="d-block mb-3">Servidor SMTP<input name="host" class="form-control" required autocomplete="off" placeholder="smtp.seuprovedor.com.br"></label><label class="d-block mb-3">Porta<select name="port" class="form-select"><option value="465">465 — TLS</option><option value="587">587 — STARTTLS</option></select></label><label class="d-block mb-3">Senha da caixa de e-mail ou senha de aplicativo<input name="senha" class="form-control" type="password" autocomplete="new-password"></label><p class="small text-muted">Use os dados SMTP do provedor da sua caixa de e-mail. Esta não é a senha de acesso ao ERP. Após conectar, deixe a senha em branco para mantê-la.</p><p class="small" role="status" aria-live="polite"></p></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button><button type="submit" class="btn btn-primary">Conectar e verificar</button></div></form></div>';
  document.body.append(modal);const form=modal.querySelector("form"),status=modal.querySelector('[role="status"]'),submit=form.querySelector('[type="submit"]');
  botao.addEventListener("click",async()=>{
   status.textContent="Carregando…";submit.disabled=true;form.elements.senha.value="";new bootstrap.Modal(modal).show();
   try{const d=await api("/email-envio/me");for(const key of ["email","host","port"])form.elements[key].value=d[key];status.textContent=d.configurado?"Conta conectada. O remetente será o e-mail acima.":"Conecte sua conta para enviar propostas. O envio pela conta da New Floor está bloqueado.";submit.disabled=false;}
   catch(e){status.textContent=e.message;}
  });
  form.addEventListener("submit",async e=>{
   e.preventDefault();submit.disabled=true;status.textContent="Verificando conexão com seu provedor…";
   try{await api("/email-envio/me",{method:"PUT",body:JSON.stringify({host:form.elements.host.value.trim(),port:Number(form.elements.port.value),senha:form.elements.senha.value})});status.textContent="Conta conectada. As propostas sairão pelo e-mail do seu cadastro.";}
   catch(e){status.textContent=e.message;}finally{form.elements.senha.value="";submit.disabled=false;}
  });
  modal.addEventListener("hidden.bs.modal",()=>{form.elements.senha.value="";});
 }
 iniciar().catch(e=>console.error("E-mail de envio:",e.message));
})();
