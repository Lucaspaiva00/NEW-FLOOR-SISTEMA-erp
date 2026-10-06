(() => {
  "use strict";
  const sessao = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
  const token = sessao?.token;
  if (!token) { window.location.href = "login.html"; return; }

  const $ = (id) => document.getElementById(id);
  const modalLancamento = new bootstrap.Modal($("modalLancamento"));
  const modalBaixa = new bootstrap.Modal($("modalBaixa"));
  const modalConta = new bootstrap.Modal($("modalConta"));
  const modalCategoria = new bootstrap.Modal($("modalCategoria"));
  const modalHistorico=new bootstrap.Modal($("modalHistorico"));
  let lancamentos = [], categorias = [], contas = [], clientes = [], tipoFiltro = "", fluxoChart = null;

  let paginaLancamentos = 1;
  const contasPorPagina = 10;

  const dinheiro = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const esc = (v) => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const isoDate = (v) => { if(!v) return ""; const d=new Date(v); if(Number.isNaN(d.getTime())) return "";if(d.toISOString().endsWith("T00:00:00.000Z"))return d.toISOString().slice(0,10); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const dataBr = (v) => v ? (new Date(v).toISOString().endsWith("T00:00:00.000Z")?new Date(v).toLocaleDateString("pt-BR",{timeZone:"UTC"}):new Date(v).toLocaleDateString("pt-BR")) : "Sem vencimento";
  const nomeCliente = (c) => c?.nomeFantasia || c?.razaoSocial || c?.responsavel || `Cliente #${c?.clienteid || ""}`;
  const restante=l=>Math.max(0,Math.round((Number(l.valor)-Number(l.valorPago||0))*100))/100;
  const isVencido = (l) => l.status === "ABERTO" && l.dataVencimento && isoDate(l.dataVencimento) < isoDate(new Date());

  async function api(path, options={}) {
    const headers = { Authorization:`Bearer ${token}`, ...(options.body!==undefined?{"Content-Type":"application/json"}:{}), ...(options.headers||{}) };
    const r = await fetch(`${API_URL}${path}`, {...options, headers});
    const d = await r.json().catch(()=>null);
    if(!r.ok){ const e=new Error(d?.error || `Erro HTTP ${r.status}`); e.status=r.status; throw e; }
    return d;
  }
  function erro(e,t="Não foi possível concluir"){ console.error(e); Swal.fire({icon:"error",title:t,text:e?.message||"Erro inesperado."}); }
  function sucesso(t){ Swal.fire({icon:"success",title:t,timer:1300,showConfirmButton:false}); }

  async function carregarDashboard(){
    const d=await api("/financeiro/dashboard");
    $("kpiSaldo").textContent=dinheiro(d.saldoDisponivel); $("kpiReceber").textContent=dinheiro(d.contasReceber); $("kpiPagar").textContent=dinheiro(d.contasPagar); $("kpiProjetado").textContent=dinheiro(d.saldoProjetado); $("kpiVencidos").textContent=dinheiro(d.vencidosValor); $("kpiVencidosQtd").textContent=`${d.vencidosQuantidade||0} lançamento${d.vencidosQuantidade===1?"":"s"} vencido${d.vencidosQuantidade===1?"":"s"}`; $("recebidoMes").textContent=dinheiro(d.recebidoMes); $("pagoMes").textContent=dinheiro(d.pagoMes); $("resultadoMes").textContent=dinheiro(d.resultadoMes); renderProximos(d.ultimos||[]);
  }
  async function carregarFluxo(){
    const dados=await api(`/financeiro/fluxo?meses=${$("fluxoPeriodo").value}`); const ctx=$("fluxoChart"); if(fluxoChart) fluxoChart.destroy();
    fluxoChart=new Chart(ctx,{type:"bar",data:{labels:dados.map(x=>x.mes),datasets:[{label:"Recebido",data:dados.map(x=>x.entradas),backgroundColor:"rgba(25,135,84,.72)",borderRadius:6},{label:"Pago",data:dados.map(x=>x.saidas),backgroundColor:"rgba(220,53,69,.62)",borderRadius:6},{label:"A receber (pendente)",data:dados.map(x=>x.previstoReceber),backgroundColor:"rgba(25,135,84,.2)",borderRadius:6},{label:"A pagar (pendente)",data:dados.map(x=>x.previstoPagar),backgroundColor:"rgba(220,53,69,.2)",borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{usePointStyle:true,boxWidth:8,font:{size:10}}}},scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{beginAtZero:true,ticks:{font:{size:10},callback:v=>"R$ "+Number(v).toLocaleString("pt-BR")},grid:{color:"#f0f1f3"}}}}});
    aplicarFiltroFluxo();
  }
  function aplicarFiltroFluxo(){
    if(!fluxoChart)return;
    const grupos={todos:[0,1,2,3],movimentado:[0,1],pendente:[2,3],entradas:[0,2],saidas:[1,3]};
    const visiveis=grupos[$("fluxoExibicao").value]||grupos.todos;
    fluxoChart.data.datasets.forEach((_,i)=>fluxoChart.setDatasetVisibility(i,visiveis.includes(i)));
    fluxoChart.update();
  }
  $("fluxoPeriodo").addEventListener("change",()=>carregarFluxo().catch(erro));
  $("fluxoExibicao").addEventListener("change",aplicarFiltroFluxo);
  async function carregarLancamentos(){
    const q=new URLSearchParams(); if(tipoFiltro)q.set("tipo",tipoFiltro); if($("filtroStatus").value)q.set("status",$("filtroStatus").value); if($("filtroVencimento").value)q.set("vencimento",$("filtroVencimento").value); if($("buscaFinanceiro").value.trim())q.set("busca",$("buscaFinanceiro").value.trim()); lancamentos=await api(`/financeiro/lancamentos${q.toString()?`?${q}`:""}`); paginaLancamentos=1; renderLancamentos();
  }
  async function carregarAuxiliares(){
    const [cats,cts,cls]=await Promise.all([api("/financeiro/categorias"),api("/financeiro/contas"),api("/clientes")]); categorias=cats||[]; contas=cts||[]; clientes=Array.isArray(cls)?cls:(cls?.clientes||cls?.data||[]); renderConfiguracoes(); atualizarSelects();
  }
  async function atualizarTudo(){ try{ await Promise.all([carregarDashboard(),carregarFluxo(),carregarLancamentos(),carregarAuxiliares()]); }catch(e){ if(e.status===401){localStorage.removeItem("usuarioLogado");window.location.href="login.html";return;} erro(e,"Erro ao carregar financeiro"); } }

  function renderProximos(lista){ const abertos=lista.filter(x=>x.status==="ABERTO").slice(0,6); $("emptyProximos").classList.toggle("d-none",abertos.length>0); $("listaProximos").innerHTML=abertos.map(l=>`<div class="proximo-item"><div class="proximo-icon ${l.tipo.toLowerCase()}">${l.tipo==="ENTRADA"?"↗":"↘"}</div><div class="proximo-main"><strong>${esc(l.descricao)}</strong><span>${esc(l.clienteNome||l.categoria?.nome||"Sem categoria")}</span></div><div class="proximo-valor"><strong>${dinheiro(restante(l))}</strong><span class="${isVencido(l)?"vencimento-danger":""}">${isVencido(l)?"Vencido · ":""}${dataBr(l.dataVencimento)}</span></div></div>`).join(""); }
  function statusBadge(l){ if(l.status==="CANCELADO")return `<span class="fin-status cancelado">Cancelado</span>`; if(l.status==="PAGO")return `<span class="fin-status pago">${l.tipo==="ENTRADA"?"Recebido":"Pago"}</span>`; if(isVencido(l))return `<span class="fin-status vencido">Vencido</span>`; return `<span class="fin-status aberto">${Number(l.valorPago)>0?"Pago em parte":"Em aberto"}</span>`; }
  function renderLancamentos(){ renderPaginacao(); const body=$("listaLancamentos"); $("emptyLancamentos").classList.toggle("d-none",lancamentos.length>0); body.innerHTML=lancamentos.slice((paginaLancamentos-1)*contasPorPagina,paginaLancamentos*contasPorPagina).map(l=>`<tr><td><div class="fin-desc"><strong>${esc(l.descricao)}</strong><span>${esc(l.documento||"")}</span></div></td><td>${esc(l.favorecido||l.clienteNome||"-")}<br><span class="origin-badge">${l.origem==="PROPOSTA"?`Proposta ${esc(l.proposta?.numero||l.documento||"")}`:"Manual"}</span></td><td>${esc(l.categoria?.nome||"-")}</td><td class="${isVencido(l)?"vencimento-danger":""}">${dataBr(l.dataVencimento)}</td><td class="fin-value ${l.tipo.toLowerCase()}">${l.tipo==="SAIDA"?"− ":"+ "}${dinheiro(restante(l))}<small class="d-block text-muted">Total: ${dinheiro(l.valor)} · ${l.tipo==="ENTRADA"?"Recebido":"Pago"}: ${dinheiro(l.valorPago)}</small></td><td>${statusBadge(l)}</td><td><div class="action-menu"><button data-historico="${l.lancamentofinanceiroid}">Histórico</button>${l.status==="ABERTO"?`<button data-baixar="${l.lancamentofinanceiroid}">${l.tipo==="ENTRADA"?"Registrar recebimento":"Registrar pagamento"}</button><button data-editar="${l.lancamentofinanceiroid}">Editar</button><button data-cancelar="${l.lancamentofinanceiroid}">Cancelar</button>`:l.status==="PAGO"?`<button data-reabrir="${l.lancamentofinanceiroid}">Estornar pagamentos</button>`:""}${l.origem==="MANUAL"&&!l.pagamentos?.length?`<button data-excluir="${l.lancamentofinanceiroid}">Excluir</button>`:""}</div></td></tr>`).join(""); }
  function renderPaginacao(){
    const total=lancamentos.length, paginas=Math.max(1,Math.ceil(total/contasPorPagina));
    paginaLancamentos=Math.min(paginaLancamentos,paginas);
    $("resumoPaginacao").textContent=total?`Mostrando ${(paginaLancamentos-1)*contasPorPagina+1}–${Math.min(paginaLancamentos*contasPorPagina,total)} de ${total} contas`:"0 contas";
    const button=(pagina,texto,disabled=false,atual=false)=>`<button type="button" class="btn btn-sm ${atual?"btn-dark":"btn-light border"}" data-pagina="${pagina}" ${disabled?"disabled":""} ${atual?'aria-current="page"':""}>${texto}</button>`;
    let html=button(paginaLancamentos-1,"Anterior",paginaLancamentos===1);
    for(let p=Math.max(1,paginaLancamentos-2);p<=Math.min(paginas,paginaLancamentos+2);p++)html+=button(p,String(p),false,p===paginaLancamentos);
    html+=button(paginaLancamentos+1,"Próxima",paginaLancamentos===paginas);
    $("botoesPaginacao").innerHTML=html;
    $("paginacaoLancamentos").classList.toggle("d-none",total===0);
  }
  $("botoesPaginacao").addEventListener("click",e=>{
    const button=e.target.closest("button[data-pagina]");if(!button||button.disabled)return;
    const pagina=Number(button.dataset.pagina),paginas=Math.ceil(lancamentos.length/contasPorPagina);
    if(pagina<1||pagina>paginas)return;
    paginaLancamentos=pagina;renderLancamentos();
  });
  function renderConfiguracoes(){ $("listaContas").innerHTML=contas.length?contas.map(c=>`<div class="config-item"><div><strong>${esc(c.nome)}</strong><span>${esc(c.tipo)}${c.banco?` · ${esc(c.banco)}`:""}</span></div><div class="saldo">${dinheiro(c.saldoAtual)}</div></div>`).join(""):`<div class="empty-state">Cadastre a primeira conta para controlar saldos.</div>`; $("listaCategorias").innerHTML=categorias.map(c=>`<div class="config-item"><div><strong>${esc(c.nome)}</strong><span>${c.tipo==="ENTRADA"?"Receita":"Despesa"}</span></div><span>${esc(c.descricao||"")}</span></div>`).join(""); }
  function atualizarSelects(){ const clienteOpts=`<option value="">Sem cliente vinculado</option>`+clientes.sort((a,b)=>nomeCliente(a).localeCompare(nomeCliente(b),"pt-BR")).map(c=>`<option value="${c.clienteid}">${esc(nomeCliente(c))}</option>`).join(""); $("finCliente").innerHTML=clienteOpts; const contaOpts=`<option value="">Selecione uma conta</option>`+contas.filter(c=>c.ativo!==false).map(c=>`<option value="${c.contafinanceiraid}">${esc(c.nome)}</option>`).join(""); $("finConta").innerHTML=contaOpts; $("baixaConta").innerHTML=contaOpts; atualizarCategoriasSelect(); }
  function atualizarCategoriasSelect(){ const tipo=$("finTipo").value; $("finCategoria").innerHTML=`<option value="">Sem categoria</option>`+categorias.filter(c=>c.ativo!==false&&c.tipo===tipo).map(c=>`<option value="${c.categoriafinanceiraid}">${esc(c.nome)}</option>`).join(""); }
  function novoLancamento(tipo){ $("formLancamento").reset(); $("lancamentoId").value=""; $("finTipo").value=tipo; $("finCompetencia").value=isoDate(new Date()); $("finParcelas").value=1; $("finIntervalo").value=30; $("tituloLancamento").textContent=tipo==="ENTRADA"?"Nova conta a receber":"Nova conta a pagar"; document.querySelectorAll(".parcela-only").forEach(x=>x.classList.remove("d-none")); atualizarCategoriasSelect(); modalLancamento.show(); }
  async function editarLancamento(id){ const l=await api(`/financeiro/lancamentos/${id}`); $("lancamentoId").value=l.lancamentofinanceiroid; $("finTipo").value=l.tipo; $("finDescricao").value=l.descricao||""; $("finValor").value=Number(l.valor||0); $("finCompetencia").value=isoDate(l.dataCompetencia); $("finVencimento").value=isoDate(l.dataVencimento); $("finCliente").value=l.clienteId||""; atualizarCategoriasSelect(); $("finCategoria").value=l.categoriaFinanceiraId||""; $("finConta").value=l.contaFinanceiraId||""; $("finFormaPagamento").value=l.formaPagamento||""; $("finDocumento").value=l.documento||""; $("finObservacoes").value=l.observacoes||"";$("finFavorecido").value=l.favorecido||""; document.querySelectorAll(".parcela-only").forEach(x=>x.classList.add("d-none")); $("tituloLancamento").textContent="Editar lançamento"; modalLancamento.show(); }
  function abrirBaixa(id){ const l=lancamentos.find(x=>x.lancamentofinanceiroid===Number(id)); if(!l)return; $("baixaId").value=id; $("baixaValor").value=restante(l);$("baixaValor").max=restante(l);$("baixaResumo").textContent=`Total: ${dinheiro(l.valor)} · Já pago: ${dinheiro(l.valorPago)} · Restante: ${dinheiro(restante(l))}`;$("modalBaixa").querySelector(".modal-title").textContent=l.tipo==="ENTRADA"?"Registrar recebimento":"Registrar pagamento";$("modalBaixa").querySelector("button[type=submit]").textContent=l.tipo==="ENTRADA"?"Confirmar recebimento":"Confirmar pagamento"; $("baixaData").value=isoDate(new Date()); $("baixaConta").value=l.contaFinanceiraId||""; $("baixaForma").value=l.formaPagamento||""; modalBaixa.show(); }

  $("btnNovaEntrada").addEventListener("click",()=>novoLancamento("ENTRADA")); $("btnNovaSaida").addEventListener("click",()=>novoLancamento("SAIDA")); $("btnNovaConta").addEventListener("click",()=>{$("formConta").reset();$("contaSaldo").value=0;modalConta.show();}); $("btnNovaCategoria").addEventListener("click",()=>{$("formCategoria").reset();modalCategoria.show();}); $("finTipo").addEventListener("change",atualizarCategoriasSelect);
  $("tabsFinanceiro").addEventListener("click",e=>{const b=e.target.closest("button[data-tipo]");if(!b)return;tipoFiltro=b.dataset.tipo||"";$("tabsFinanceiro").querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));carregarLancamentos().catch(erro);});
  $("btnAtualizarFinanceiro").addEventListener("click",()=>carregarLancamentos().catch(erro)); $("filtroStatus").addEventListener("change",()=>carregarLancamentos().catch(erro)); $("filtroVencimento").addEventListener("change",()=>carregarLancamentos().catch(erro)); let timer; $("buscaFinanceiro").addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(()=>carregarLancamentos().catch(erro),300);});
  $("btnSincronizarFaturadas").addEventListener("click",async()=>{try{const d=await api("/financeiro/sincronizar-faturadas",{method:"POST",body:"{}"});sucesso(`${d.quantidade||0} proposta(s) sincronizada(s)`);await atualizarTudo();}catch(e){erro(e);}});

  $("formLancamento").addEventListener("submit",async e=>{e.preventDefault();try{const id=$("lancamentoId").value; const data={tipo:$("finTipo").value,descricao:$("finDescricao").value.trim(),valor:Number($("finValor").value),dataCompetencia:$("finCompetencia").value||null,dataVencimento:$("finVencimento").value||null,clienteId:$("finCliente").value||null,categoriaFinanceiraId:$("finCategoria").value||null,contaFinanceiraId:$("finConta").value||null,formaPagamento:$("finFormaPagamento").value||null,documento:$("finDocumento").value||null,observacoes:$("finObservacoes").value||null,favorecido:$("finFavorecido").value||null,totalParcelas:Number($("finParcelas").value||1),intervaloDias:Number($("finIntervalo").value||30)}; await api(id?`/financeiro/lancamentos/${id}`:"/financeiro/lancamentos",{method:id?"PUT":"POST",body:JSON.stringify(data)});modalLancamento.hide();sucesso("Conta salva");await atualizarTudo();}catch(e2){erro(e2);}});
  $("formBaixa").addEventListener("submit",async e=>{e.preventDefault();const button=e.currentTarget.querySelector("button[type=submit]");if(button.disabled)return;button.disabled=true;try{await api(`/financeiro/lancamentos/${$("baixaId").value}/baixar`,{method:"POST",body:JSON.stringify({valorPago:Number($("baixaValor").value),dataPagamento:$("baixaData").value,contaFinanceiraId:$("baixaConta").value||null,formaPagamento:$("baixaForma").value||null})});modalBaixa.hide();sucesso("Pagamento registrado");await atualizarTudo();}catch(er){erro(er);}finally{button.disabled=false;}});
  $("formConta").addEventListener("submit",async e=>{e.preventDefault();try{await api("/financeiro/contas",{method:"POST",body:JSON.stringify({nome:$("contaNome").value.trim(),tipo:$("contaTipo").value,saldoInicial:Number($("contaSaldo").value||0),banco:$("contaBanco").value||null,agencia:$("contaAgencia").value||null,conta:$("contaNumero").value||null})});modalConta.hide();sucesso("Conta criada");await carregarAuxiliares();await carregarDashboard();}catch(er){erro(er);}});
  $("formCategoria").addEventListener("submit",async e=>{e.preventDefault();try{await api("/financeiro/categorias",{method:"POST",body:JSON.stringify({nome:$("catNome").value.trim(),tipo:$("catTipo").value,descricao:$("catDescricao").value||null})});modalCategoria.hide();sucesso("Categoria criada");await carregarAuxiliares();}catch(er){erro(er);}});
  $("listaLancamentos").addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;try{if(b.dataset.historico)await abrirHistorico(b.dataset.historico);if(b.dataset.baixar) abrirBaixa(b.dataset.baixar); if(b.dataset.editar) await editarLancamento(b.dataset.editar); if(b.dataset.reabrir)await estornar(b.dataset.reabrir); if(b.dataset.cancelar){const c=await Swal.fire({icon:"warning",title:"Cancelar esta conta?",showCancelButton:true,confirmButtonText:"Cancelar conta",cancelButtonText:"Voltar"});if(c.isConfirmed){await api(`/financeiro/lancamentos/${b.dataset.cancelar}/cancelar`,{method:"POST",body:"{}"});await atualizarTudo();}} if(b.dataset.excluir){const c=await Swal.fire({icon:"warning",title:"Excluir esta conta?",text:"Esta ação não poderá ser desfeita.",showCancelButton:true,confirmButtonText:"Excluir",cancelButtonText:"Voltar"});if(c.isConfirmed){await api(`/financeiro/lancamentos/${b.dataset.excluir}`,{method:"DELETE"});await atualizarTudo();}}}catch(er){erro(er);}});

  async function estornar(id,pagamentoId){
   const confirm=await Swal.fire({title:"Estornar pagamento?",text:"O efeito no saldo será desfeito e o valor voltará a ficar pendente. O histórico será mantido.",input:"text",inputLabel:"Motivo do estorno",showCancelButton:true,confirmButtonText:"Confirmar estorno",cancelButtonText:"Voltar",inputValidator:value=>!value.trim()?"Informe o motivo":undefined});
   if(!confirm.isConfirmed)return;
   await api(`/financeiro/lancamentos/${id}/reabrir`,{method:"POST",body:JSON.stringify({motivo:confirm.value,pagamentoId})});await atualizarTudo();
  }
  async function abrirHistorico(id){
   const l=await api(`/financeiro/lancamentos/${id}`);
   $("historicoPagamentos").innerHTML=`<p><strong>${esc(l.descricao)}</strong></p><p>Total: ${dinheiro(l.valor)} · Pago: ${dinheiro(l.valorPago)} · Restante: ${dinheiro(restante(l))}</p>`+(l.pagamentos?.length?l.pagamentos.map(p=>`<div class="border rounded p-3 mb-2"><strong>${dinheiro(p.valor)}</strong> · ${dataBr(p.dataPagamento)}<div>${esc(contas.find(c=>c.contafinanceiraid===p.contaFinanceiraId)?.nome||"Conta não informada")} · ${esc(p.formaPagamento||"Forma não informada")}</div>${p.estornadoEm?`<small>Estornado em ${dataBr(p.estornadoEm)}: ${esc(p.motivoEstorno)}</small>`:`<button type="button" class="btn btn-sm btn-outline-danger mt-2" data-estornar-pagamento="${p.pagamentofinanceiroid}" data-conta="${l.lancamentofinanceiroid}">Estornar este pagamento</button>`}</div>`).join(""):"<p>Nenhum pagamento registrado.</p>");modalHistorico.show();
  }
  $("historicoPagamentos").addEventListener("click",async e=>{const b=e.target.closest('[data-estornar-pagamento]');if(!b)return;try{await estornar(b.dataset.conta,Number(b.dataset.estornarPagamento));await abrirHistorico(b.dataset.conta);}catch(error){erro(error);}});
  atualizarTudo();
})();
