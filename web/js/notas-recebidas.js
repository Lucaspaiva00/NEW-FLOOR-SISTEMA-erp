(() => {
  const $=id=>document.getElementById(id);
  if(!$("tabFiscalRecebidas"))return;
  const usuario=JSON.parse(localStorage.getItem("usuarioLogado")||"null");
  const token=usuario?.token;
  if(!token)return;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dinheiro=v=>Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  let docs=[],cursor=0,carregando=false;
  const api=async(path,opts={})=>{
    const response=await fetch(API_URL+path,{
      ...opts,headers:{Authorization:"Bearer "+token,...(opts.body?{"Content-Type":"application/json"}:{})}
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||"Falha na consulta à Focus.");
    return data;
  };
  function render(){
    $("nrTabela").innerHTML=docs.length?docs.map((d,i)=> {
      const quitacao=d.contaExistente;
      const autorizado=["autorizado","autorizada"].includes(d.situacao);
      return '<tr><td><strong>'+esc(d.emissor)+'</strong><small class="d-block">'+esc(d.documentoEmissor||"-")+
        '</small></td><td>'+esc(d.dataEmissao?new Date(d.dataEmissao).toLocaleDateString("pt-BR"):"-")+
        '<small class="d-block text-break">'+esc(d.chave)+'</small></td><td>'+dinheiro(d.valor)+'</td><td>'+
        esc(d.situacao)+'</td><td>'+(quitacao?
        '<span class="text-success">Já importada · '+esc(quitacao.status)+'</span>':
        autorizado?'<button type="button" class="btn-secondary-fiscal" data-nr-pagar="'+i+'">Gerar conta a pagar</button>':
        '<span class="text-muted">Não importável</span>')+'</td></tr>';
    }).join(""):'<tr><td colspan="5">Nenhuma nota encontrada nesta página da Focus.</td></tr>';
  }
  async function carregarEmpresas(){
    const empresas=await api("/fiscal/empresas");
    $("nrEmpresa").innerHTML='<option value="">Selecione uma empresa emissora cadastrada</option>'+
      empresas.map(e=>'<option value="'+Number(e.empresafiscalid)+'">'+esc(e.razaoSocial)+' · '+esc(e.cnpj)+
      (e.ambiente==="PRODUCAO"?" · Produção":" · Emissão em homologação (recepção requer token de produção)")+'</option>').join("");
  }
  async function consultar(mais=false){
    if(carregando)return;
    const empresaFiscalId=Number($("nrEmpresa").value);
    const tipo=$("nrTipo").value;
    if(!empresaFiscalId){$("nrAviso").textContent="Selecione a empresa destinatária.";return;}
    carregando=true;$("nrConsultar").disabled=true;$("nrMais").disabled=true;
    $("nrAviso").textContent="Consultando documentos recebidos pela Focus...";
    try{
      const url=new URLSearchParams({empresaFiscalId:String(empresaFiscalId),tipo,versao:String(mais?cursor:0)});
      const result=await api("/fiscal/recebidas?"+url);
      if(!mais)docs=[];
      const ids=new Set(docs.map(d=>d.tipo+":"+d.chave));
      for(const d of result.documentos){if(!ids.has(d.tipo+":"+d.chave)){docs.push(d);ids.add(d.tipo+":"+d.chave);}}
      const previous=cursor;
      cursor=result.proximaVersao;
      $("nrAviso").textContent=result.aviso+" Foram retornados "+result.documentos.length+" documento(s) nesta página.";
      $("nrMais").classList.toggle("d-none",result.documentos.length<100||mais&&cursor<=previous);
      render();
    }catch(e){$("nrAviso").textContent=e.message;if(!mais)docs=[];render();}
    finally{carregando=false;$("nrConsultar").disabled=false;$("nrMais").disabled=false;}
  }
  $("nrConsultar").addEventListener("click",()=>consultar(false));
  $("nrMais").addEventListener("click",()=>consultar(true));
  for(const field of ["nrEmpresa","nrTipo"])$(field).addEventListener("change",()=>{
    docs=[];cursor=0;$("nrMais").classList.add("d-none");render();
  });
  $("nrTabela").addEventListener("click",async(event)=>{
    const btn=event.target.closest("[data-nr-pagar]");
    if(!btn)return;
    const d=docs[Number(btn.dataset.nrPagar)];
    if(!d||d.contaExistente)return;
    const resposta=await Swal.fire({
      title:"Registrar conta a pagar",
      width:"600px",
      html:'<div class="text-start"><p>Documento de <strong>'+esc(d.emissor)+
        '</strong>, no valor bruto de <strong>'+dinheiro(d.valor)+
        '</strong>. A consulta fiscal não comprova dívida nem determina o vencimento.</p>'+
        '<label class="d-block fw-semibold">Vencimento combinado com o fornecedor *'+
        '<input id="nrVencimento" class="form-control mt-1" type="date"></label>'+
        '<p class="small text-muted mt-2">Confira se a nota foi entregue, se há retenções ou pagamentos já feitos. Esta operação cria somente uma conta <strong>em aberto</strong>, sem pagamento automático.</p></div>',
      showCancelButton:true,confirmButtonText:"Criar conta a pagar",cancelButtonText:"Cancelar",focusConfirm:false,
      preConfirm:()=> {
        const vencimento=Swal.getPopup().querySelector("#nrVencimento").value;
        if(!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)){Swal.showValidationMessage("Informe o vencimento.");return false;}
        return {vencimento};
      }
    });
    if(!resposta.isConfirmed)return;
    btn.disabled=true;
    try{
      const r=await api("/fiscal/recebidas/importar",{
        method:"POST",
        body:JSON.stringify({
          empresaFiscalId:Number($("nrEmpresa").value),tipo:d.tipo,chave:d.chave,versao:d.versao,
          vencimento:resposta.value.vencimento,confirmar:true
        })
      });
      d.contaExistente={status:"ABERTO",lancamentofinanceiroid:r.lancamentofinanceiroid};
      render();await Swal.fire({icon:"success",title:"Conta criada",text:r.mensagem});
    }catch(e){await Swal.fire({icon:"error",title:"Importação não concluída",text:e.message});}
    finally{btn.disabled=false;}
  });
  let fetched=false;
  document.querySelector('[data-fiscal-tab="recebidas"]')?.addEventListener("click",()=>{
    if(fetched)return;fetched=true;
    carregarEmpresas().catch(e=>{$("nrAviso").textContent=e.message;fetched=false;});
  });
})();