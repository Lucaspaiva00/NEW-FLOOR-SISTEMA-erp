(() => {
  const session = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
  const jwt = session?.token;
  if (!jwt || !document.getElementById("kanbanBoard")) return;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const currency = n => Number(n || 0).toLocaleString("pt-BR", {style:"currency",currency:"BRL"});
  const today = () => new Date().toLocaleDateString("en-CA", {timeZone:"America/Sao_Paulo"});
  const request = async (url, opts={}) => {
    const resp = await fetch(API_URL + url, {
      ...opts,
      headers: { Authorization:"Bearer " + jwt, ...(opts.body ? {"Content-Type":"application/json"} : {}) }
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw Error(data.error || "Não foi possível registrar o faturamento.");
    return data;
  };
  const field = (id,label,type,value,extra="") =>
    '<label class="col-12 col-sm-6 text-start mb-2"><span class="fw-semibold">' + label +
    '</span><input id="'+id+'" type="'+type+'" '+extra+' value="'+esc(value)+
    '" class="form-control mt-1"></label>';
  function formContent(p) {
    const plan = p.planoRecebimento && typeof p.planoRecebimento === "object" ? p.planoRecebimento : {};
    const valor = Number(p.subtotal||0)+Number(p.frete||0);
    return '<div class="text-start"><p>Proposta <strong>'+esc(p.numero)+'</strong> · '+
      '<strong>'+currency(valor)+'</strong></p>'+
      '<label class="d-block fw-semibold mb-2">Onde a nota foi emitida?</label>'+
      '<select id="feOrigem" class="form-select mb-3">' +
      '<option value="EXTERNA" selected>Já emitida fora do ERP (Portal Nacional/outro sistema)</option>'+
      '<option value="ERP">Emitir pelo módulo Fiscal do ERP</option></select>'+
      '<div id="feCampos"><p class="small text-muted mb-3">Confirmando, a proposta vai para Faturadas e o financeiro criará as parcelas como contas a receber. <strong>Nenhuma nota será emitida pelo ERP.</strong></p>'+
      '<div class="row g-2">'+
      field("feReferencia","Número / referência da nota externa (opcional)","text",plan.referenciaFiscalExterna||'','maxlength="120"')+
      field("feEmissao","Data em que a nota foi emitida","date",plan.dataEmissaoExterna||today(),'required')+
      '<label class="col-12 col-sm-6 text-start mb-2"><span class="fw-semibold">Forma de pagamento *</span>'+
      '<select id="feForma" class="form-select mt-1">'+
      ['Boleto','Pix','Transferência bancária','Cartão de crédito','Cartão de débito','Dinheiro','Outro'].map(v=>'<option value="'+esc(v)+'"'+(p.formaPagamento===v?' selected':'')+'>'+esc(v)+'</option>').join('')+
      '</select></label>'+
      field("feRetencoes","Retenções confirmadas (R$)","number",p.valorLiquidoFinanceiro!=null?Math.max(0,valor-Number(p.valorLiquidoFinanceiro)).toFixed(2):"0",'min="0" step="0.01" max="'+valor+'"')+
      field("feParcelas","Quantidade de parcelas *","number",plan.parcelas||1,'min="1" max="120" step="1" required')+
      field("feVencimento","Primeiro vencimento *","date",plan.primeiroVencimento||today(),'required')+
      '<label class="col-12 col-sm-6 text-start mb-2"><span class="fw-semibold">Frequência</span>'+
      '<select id="feFrequencia" class="form-select mt-1"><option value="MENSAL">Mensal</option><option value="DIAS">Intervalo em dias</option></select></label>'+
      field("feIntervalo","Intervalo em dias","number",plan.intervaloDias||30,'min="1" max="3650" step="1"')+
      '</div><label class="d-block text-start mt-2"><span class="fw-semibold">Condições de pagamento (opcional)</span>'+
      '<textarea id="feCondicoes" maxlength="2000" class="form-control mt-1" rows="2">'+esc(p.condicoesPagamento||"")+'</textarea></label>'+
      '<p class="small text-muted mt-2">Se a cobrança já estiver lançada manualmente em Contas a receber, confira antes de registrar para evitar duplicidade.</p>'+
      '</div><div id="feInfoErp" class="alert alert-info d-none">O sistema abrirá o Fiscal para emitir a nota. A proposta só ficará faturada pelo ERP após autorização.</div></div>';
  }
  window.solicitarFaturamentoProposta = async id => {
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) return false;
    try {
      const p = await request("/propostas/" + Number(id));
      if (p.status === "FATURADA") {
        await Swal.fire({icon:"info",title:"Proposta já faturada",text:"Consulte as contas a receber e o documento fiscal antes de repetir o faturamento."});
        return false;
      }
      const r = await Swal.fire({
        title:"Registrar faturamento",
        html:formContent(p),
        width:"720px",
        showCancelButton:true,
        confirmButtonText:"Confirmar faturamento",
        cancelButtonText:"Cancelar",
        focusConfirm:false,
        didOpen:() => {
          const el = x => Swal.getPopup().querySelector("#"+x);
          el("feFrequencia").value=(p.planoRecebimento?.frequencia||"MENSAL");
          const toggle=() => {
            const isErp=el("feOrigem").value==="ERP";
            el("feCampos").classList.toggle("d-none",isErp);
            el("feInfoErp").classList.toggle("d-none",!isErp);
            Swal.getConfirmButton().textContent=isErp?"Abrir módulo Fiscal":"Confirmar faturamento externo";
            el("feIntervalo").disabled=el("feFrequencia").value==="MENSAL";
          };
          el("feOrigem").addEventListener("change",toggle);
          el("feFrequencia").addEventListener("change",toggle);
          toggle();
        },
        preConfirm:() => {
          const el=x=>Swal.getPopup().querySelector("#"+x);
          if(el("feOrigem").value==="ERP")return {origem:"ERP"};
          const parcelas=Number(el("feParcelas").value);
          const vencimento=el("feVencimento").value;
          const data=el("feEmissao").value;
          const retencoes=Number(el("feRetencoes").value);
          if(!data||!vencimento||!Number.isInteger(parcelas)||parcelas<1||parcelas>120||
             !Number.isFinite(retencoes)||retencoes<0||retencoes>=Number(p.subtotal||0)+Number(p.frete||0)){
            Swal.showValidationMessage("Confira as datas, a quantidade de parcelas e as retenções.");
            return false;
          }
          if(!window.confirm("Confirma que esta nota já foi emitida fora do ERP e que a cobrança ainda não está lançada no financeiro?"))return false;
          return {
            origem:"EXTERNA",
            referenciaFiscalExterna:el("feReferencia").value.trim(),
            dataEmissaoExterna:data,
            formaPagamento:el("feForma").value,
            retencoes,
            condicoesPagamento:el("feCondicoes").value.trim(),
            planoRecebimento:{
              parcelas,
              primeiroVencimento:vencimento,
              frequencia:el("feFrequencia").value,
              intervaloDias:Number(el("feIntervalo").value||30),
            },
          };
        }
      });
      if(!r.isConfirmed)return false;
      if(r.value.origem==="ERP"){
        window.location.assign("fiscal.html?propostaId="+Number(id));
        return false;
      }
      const confirmado=await request("/propostas/"+Number(id)+"/faturamento-externo",{
        method:"POST",body:JSON.stringify(r.value)
      });
      await Swal.fire({
        icon:"success",title:"Proposta faturada",
        text:confirmado.mensagem+" "+confirmado.parcelas+" parcela(s) registrada(s).",
        confirmButtonText:"Concluído"
      });
      if(typeof carregarPropostas==="function")await carregarPropostas();
      return true;
    }catch(err){
      await Swal.fire({icon:"error",title:"Faturamento não concluído",text:err.message});
      return false;
    }
  };
})();