/* Formulário complementar da DPS — carregado apenas após autenticar a SBA.
 * Nunca altera layout, modelos PDF nem fluxo fiscal de outros perfis.
 * Salva somente no payloadExtra da nota; não transmite notas fiscais.
 */
(() => {
  const $ = id => document.getElementById(id);
  const campos=[
    ["cTribNac","Código nacional do serviço (cTribNac)", "text",/^\d{6}$/,"6 dígitos conforme lista nacional"],
    ["opSimpNac","Situação no Simples Nacional", "select",/^[123]$/,"",[
      ["1","1 — Não optante"],["2","2 — MEI"],["3","3 — ME/EPP"]
    ]],
    ["regEspTrib","Regime especial de tributação municipal", "select",/^[01234569]$/,"",[
      ["0","0 — Nenhum"],["1","1 — Ato cooperado"],["2","2 — Estimativa"],
      ["3","3 — Microempresa municipal"],["4","4 — Notário/registrador"],
      ["5","5 — Profissional autônomo"],["6","6 — Sociedade de profissionais"],
      ["9","9 — Outros"]
    ]],
    ["tribISSQN","Tributação do ISSQN", "select",/^[1234]$/,"",[
      ["1","1 — Tributável"],["2","2 — Imunidade"],
      ["3","3 — Exportação de serviços"],["4","4 — Não incidência"]
    ]],
    ["tpRetISSQN","Retenção do ISSQN", "select",/^[123]$/,"",[
      ["1","1 — Não retido"],["2","2 — Retido pelo tomador"],
      ["3","3 — Retido pelo intermediário"]
    ]],
    ["indTotTrib","Indicador de tributos totais", "select",/^0$/,"",[
      ["0","0 — Optou por não informar estimativa de tributos"]
    ]],
    ["cLocPrestacao","Município de prestação (IBGE)", "text",/^\d{7}$/,"7 dígitos do local real do serviço"],
    ["cTribMun","Código municipal do serviço (se aplicável)", "text",/^[A-Za-z0-9.-]{1,20}$/,"Confirmar na legislação municipal"],
    ["cNBS","NBS (se aplicável)", "text",/^[0-9.]{7,16}$/,"Conforme classificação do serviço"]
  ];
  const chavesObrigatorias=new Set(["cTribNac","opSimpNac","regEspTrib","tribISSQN","tpRetISSQN","indTotTrib"]);
  const esc=valor=>String(valor??"").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
  function montar(){
    if($("sbaParametrosDps")||!$("blocoNfse"))return;
    const painel=document.createElement("section");
    painel.id="sbaParametrosDps";
    painel.className="border rounded p-3 mt-3";
    painel.innerHTML='<div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">'+
      '<div><h3 class="h6 mb-1">DPS Nacional · Parâmetros fiscais SBA</h3>'+
      '<p class="small text-muted mb-0">Informações da operação para o Portal Nacional. Não há envio de notas neste formulário.</p></div>'+
      '<span id="sbaCamposConferidos" class="small text-muted" role="status" aria-live="polite"></span></div>'+
      '<div class="alert alert-warning py-2 small" role="note">Não preencha códigos por tentativa. Utilize os dados confirmados pelo contador e a lista nacional vigente. É possível salvar o rascunho incompleto.</div>'+
      '<div class="row g-3">'+campos.map(([key,label,tipo,,,opcoes])=>
        '<div class="col-12 col-md-6">'+
        '<label for="sbaDps_'+key+'" class="form-label small fw-semibold">'+esc(label)+'</label>'+
        (tipo==="select"
          ?'<select id="sbaDps_'+key+'" data-sba-param="'+key+'" class="form-select">'+
            '<option value="">Selecione conforme a contabilidade…</option>'+
            opcoes.map(([valor,rotulo])=>'<option value="'+esc(valor)+'">'+esc(rotulo)+'</option>').join("")+'</select>'
          :'<input id="sbaDps_'+key+'" data-sba-param="'+key+'" class="form-control" autocomplete="off" inputmode="'+
             (key==="cTribNac"||key==="cLocPrestacao"?"numeric":"text")+'" placeholder="'+esc(campos.find(c=>c[0]===key)[4])+'">')+
        '</div>'
      ).join("")+'</div>'+
      '<div id="sbaDpsMensagens" class="small mt-3" role="status" aria-live="polite"></div>'+
      '<div class="small text-muted mt-2">Código da lista de serviço e dados do tomador permanecem nos campos NFS-e acima. O sistema preservará qualquer informação avançada já salva.</div>';
    $("blocoNfse").appendChild(painel);
    painel.querySelectorAll("[data-sba-param]").forEach(field=>
      field.addEventListener("input",conferirParcial));
  }
  function camposAtivos(){
    return $("nfTipo")?.value==="NFSE";
  }
  function carregar(){
    montar();
    const painel=$("sbaParametrosDps");
    if(!painel)return;
    painel.hidden=!camposAtivos();
    let atual={};
    try{
      const raw=$("nfPayloadExtra")?.value.trim();
      if(raw)atual=JSON.parse(raw);
    }catch(_){atual={};}
    for(const [key] of campos){
      const input=$("sbaDps_"+key);
      if(input)input.value=atual?.[key]==null?"":String(atual[key]);
    }
    conferirParcial();
  }
  function conferirParcial(){
    const preenchidas=campos.filter(([key])=>chavesObrigatorias.has(key)&&
      $("sbaDps_"+key)?.value.trim()).length;
    const aviso=$("sbaCamposConferidos");
    if(aviso)aviso.textContent=preenchidas+" de "+chavesObrigatorias.size+" parâmetros principais informados";
    const msg=$("sbaDpsMensagens");
    if(msg)msg.textContent=preenchidas<chavesObrigatorias.size
      ?"Rascunho incompleto: a DPS não será transmitida. Preencha os campos que faltam após conferir com a contabilidade."
      :"Campos principais informados. Salve e execute a validação oficial XSD; isso não garante autorização fiscal.";
  }
  function gravarAntesDeSalvar(event){
    if(!camposAtivos()||!$("sbaParametrosDps"))return;
    let dados={};
    try {
      const raw=$("nfPayloadExtra")?.value.trim();
      dados=raw?JSON.parse(raw):{};
      if(!dados||Array.isArray(dados)||typeof dados!=="object")
        throw Error("O JSON avançado deve conter um objeto.");
      for(const [key,label,,regexp] of campos){
        const input=$("sbaDps_"+key);
        const value=String(input?.value||"").trim();
        if(!value){delete dados[key];continue;}
        if(!regexp.test(value))throw Error(label+": valor inválido. Confira antes de salvar.");
        dados[key]=value;
      }
      if(["2","3","4"].includes(dados.tribISSQN)&&["2","3"].includes(dados.tpRetISSQN))
        throw Error("ISSQN imune, exportação ou não incidência não permite retenção. Confirme com o contador.");
      if(dados.opSimpNac==="2" && dados.regEspTrib && dados.regEspTrib!=="0")
        throw Error("Para MEI, o regime especial municipal deve ser 'Nenhum'.");
      $("nfPayloadExtra").value=Object.keys(dados).length?JSON.stringify(dados,null,2):"";
    } catch(err){
      event.preventDefault();event.stopImmediatePropagation();
      Swal.fire({icon:"warning",title:"Parâmetros fiscais inválidos",text:err.message});
    }
  }
  async function iniciar(){
    const usuario=JSON.parse(localStorage.getItem("usuarioLogado")||"null");
    if(!usuario?.token||typeof API_URL==="undefined"||!$("formNotaFiscal"))return;
    const resp=await fetch(API_URL+"/empresas/me",{
      headers:{Authorization:"Bearer "+usuario.token}
    });
    if(!resp.ok)return;
    const tenant=await resp.json();
    if(tenant.slug!=="sba"||tenant.configuracaoSistema?.perfil!=="SBA")return;
    montar();
    $("modalNotaFiscal")?.addEventListener("shown.bs.modal",carregar);
    $("nfTipo")?.addEventListener("change",carregar);
    $("formNotaFiscal")?.addEventListener("submit",gravarAntesDeSalvar,true);
  }
  iniciar().catch(e=>console.warn("Formulário fiscal da SBA indisponível",String(e.message||e)));
})();
