(() => {
 const usuario=JSON.parse(localStorage.getItem("usuarioLogado")||"null"),token=usuario?.token;
 const $=id=>document.getElementById(id);
 if(!token||!$("formEmpresaFiscal"))return;
 const campos=[
  ["codigo_nbs","Código NBS do serviço (9 dígitos)","nfCodigoNbs"],
  ["codigo_municipio_prestacao","Município de prestação padrão (IBGE; revise por operação)",null],
  ["percentual_total_tributos_federais","Tributos aproximados federais (%)","nfTribFederal"],
  ["percentual_total_tributos_estaduais","Tributos aproximados estaduais (%)","nfTribEstadual"],
  ["percentual_total_tributos_municipais","Tributos aproximados municipais (%)","nfTribMunicipal"],
  ["situacao_tributaria_pis_cofins","CST PIS/COFINS (somente se confirmado)","nfTribPis"],
  ["ibs_cbs_situacao_tributaria","CST IBS/CBS (quando aplicável)","nfIbsCst"],
  ["ibs_cbs_classificacao_tributaria","Classificação IBS/CBS (quando aplicável)","nfIbsClasse"]
 ];
 async function api(url,options={}){
  const r=await fetch(API_URL+url,{...options,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"}});
  const d=await r.json();if(!r.ok)throw Error(d.error||"Falha ao carregar padrões fiscais.");return d;
 }
 async function iniciar(){
  const tenant=await api("/empresas/me");if(Number(tenant.empresaid)!==1||tenant.slug!=="new-floor")return;
  const painel=document.createElement("section");painel.className="border rounded p-3 mt-3";
  painel.innerHTML='<h6>Padrões de NFS-e Nacional — New Floor</h6><p class="small text-muted">Informe os parâmetros confirmados pela contabilidade. Eles serão reaproveitados nas notas e podem ser ajustados em cada operação. Os percentuais abaixo são estimativas de tributos, não alíquotas de ISS. Simples Nacional, com federais e ISS dentro do regime: IBS/CBS dispensados nas competências de 2026; não preencha códigos fictícios.</p><div class="row g-3">'+campos.map(([key,label])=>'<label class="col-12 col-sm-6">'+label+'<input id="nfPadrao_'+key+'" class="form-control" autocomplete="off"></label>').join('')+'</div><button type="button" class="btn btn-outline-primary mt-3" id="nfSalvarPadroes">Salvar padrões NFS-e</button><p class="small mt-2" id="nfPadroesStatus" role="status"></p>';
  $("formEmpresaFiscal").querySelector(".modal-body").append(painel);
  let emissoraCarregada=0;
  const botao=$("nfSalvarPadroes");botao.disabled=true;
  $("modalEmpresaFiscal").addEventListener("shown.bs.modal",async()=>{
   const id=Number($("empresaFiscalId").value);emissoraCarregada=0;botao.disabled=true;
   campos.forEach(([key])=>$("nfPadrao_"+key).value="");
   $("nfPadroesStatus").textContent=id?"Carregando padrões…":"Salve a empresa antes de configurar os padrões.";
   if(!id)return;
   try{const d=await api("/fiscal/newfloor/padroes/"+id);if(Number($("empresaFiscalId").value)!==id)return;
    campos.forEach(([key])=>$("nfPadrao_"+key).value=d.padroes[key]??"");
    emissoraCarregada=id;botao.disabled=false;$("nfPadroesStatus").textContent="";
   }catch(e){$("nfPadroesStatus").textContent=e.message;}
  });
  botao.addEventListener("click",async()=>{
   const id=Number($("empresaFiscalId").value);if(!id||id!==emissoraCarregada)return;
   botao.disabled=true;
   try{const valores=Object.fromEntries(campos.map(([key])=>[key,$("nfPadrao_"+key).value.trim()]));
    await api("/fiscal/newfloor/padroes/"+id,{method:"PUT",body:JSON.stringify(valores)});
    $("nfPadroesStatus").textContent="Padrões NFS-e salvos para a New Floor.";
   }catch(e){$("nfPadroesStatus").textContent=e.message;}finally{botao.disabled=false;}
  });
  async function carregarNota(){
   const id=Number($("nfEmpresa")?.value);if(!id||$("nfTipo")?.value!=="NFSE")return;
   try{const d=await api("/fiscal/newfloor/padroes/"+id);if(Number($("nfEmpresa").value)!==id)return;
    const json=$("nfPayloadExtra");const extra={...d.padroes,...JSON.parse(json.value||"{}")};
    json.value=JSON.stringify(extra);
    campos.forEach(([key,,inputId])=>{if(inputId&&$(inputId))$(inputId).value=extra[key]??"";});
   }catch(e){console.error("Padrões fiscais New Floor:",e.message);}
  }
  $("modalNotaFiscal").addEventListener("shown.bs.modal",carregarNota);
  $("nfEmpresa")?.addEventListener("change",carregarNota);
 }
 iniciar().catch(e=>console.error("Configuração fiscal New Floor:",e.message));
})();
