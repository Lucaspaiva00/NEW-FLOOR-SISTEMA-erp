window.criarEditorOrcamento = (options = {}) => {
const $=id=>options.root ? options.root.querySelector(`[data-orcamento-id="${id}"]`) : document.getElementById(id),token=JSON.parse(localStorage.getItem("usuarioLogado")||"null")?.token;
let editorServicos,porServico=false,secaoServicos,avisoLegado;
let config,clientes=[],catalogo=[],fornecedores=[], carregamento, propostaAberta=null;
let sba=(options.config||window.__configuracaoSistema)?.perfil==='SBA';
let pagamentoSba=sba?window.criarPagamentoSba($("pagamento")):null;
let plano=window.criarPlanoRecebimento($("pagamento"),{sba});
const modal=new bootstrap.Modal($("modalOrcamento"));
$("modalOrcamento").addEventListener("shown.bs.modal",()=>$("titulo").focus());
const money=v=>Number(Number.isFinite(Number(v))?v:0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
async function api(path,method="GET",body){const res=await fetch(API_URL+path,{method,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});const d=await res.json();if(!res.ok)throw Error(d.error||d.message||"Falha ao salvar");return d;}
function modoPorServico(ativo){
 if(!sba)return;
 if(!editorServicos){
  secaoServicos=document.createElement("section");secaoServicos.className="budget-section";
  secaoServicos.innerHTML='<div class="budget-section-heading"><span>02</span><div><h2>Serviços e composição</h2><p>Cadastre o serviço, seus materiais, mão de obra e preço. Os custos são para a quantidade total do serviço.</p></div></div>';
  const host=document.createElement("div"),add=document.createElement("button");add.type="button";add.textContent="+ Adicionar serviço";
  secaoServicos.append(host,add);$("materiais").closest("section").before(secaoServicos);
  editorServicos=window.criarComposicaoServicos({host,catalogo:()=>catalogo,fornecedores:()=>fornecedores,onChange:calcular});
  add.onclick=()=>editorServicos.adicionar();
  avisoLegado=document.createElement("section");avisoLegado.className="budget-section budget-legacy-notice";
  const texto=document.createElement("p");texto.textContent="Este orçamento mantém a composição anterior. Para organizar por serviço, os custos existentes serão colocados no primeiro serviço, preservando os preços de venda. Depois, distribua os custos entre os serviços.";
  const converter=document.createElement("button");converter.type="button";converter.textContent="Organizar custos por serviço";
  converter.onclick=()=>{
   const c=comp();const antigos=c.servicos?.length?c.servicos:[{descricao:$("titulo").value||"Serviço",quantidade:1,unidade:"UN",valorUnitario:calcularPrecoLegado(c)}];
   const servicos=antigos.map((item,i)=>({...item,modoPreco:"MANUAL",margem:c.margem,imposto:c.imposto,materiais:i===0?c.materiais:[],maoObra:i===0?c.maoObra:[]}));
   modoPorServico(true);editorServicos.carregar(servicos);
  };
  avisoLegado.append(texto,converter);secaoServicos.before(avisoLegado);
 }
 porServico=ativo;secaoServicos.hidden=!ativo;avisoLegado.hidden=ativo;
 for(const id of ["materiais","maoObra","servicosOrcamento","fornecedoresResumo"])if($(id))$(id).closest("section").hidden=ativo;
 $("margem").closest(".sba-grid").hidden=ativo;$("margem").disabled=ativo;$("imposto").disabled=ativo;
 const heading=$("totais").closest("section").querySelector(".budget-section-heading p");
 if(heading)heading.textContent=ativo?"Somatório dos custos, vendas e resultados de todos os serviços.":"Acompanhe o custo da execução e o valor comercial.";
}
function calcularPrecoLegado(c){const round=n=>Math.round((n+Number.EPSILON)*100)/100;const material=round(c.materiais.reduce((n,m)=>n+m.quantidade*m.custoUnitario,0)),labor=round(c.maoObra.reduce((n,m)=>n+m.dias*m.pessoas*m.horasDia*m.valorHora,0));return round(round(material+labor)/(1-c.margem));}
function input(value,type="text"){const el=document.createElement("input");el.type=type;el.value=value??"";if(type==="number"){el.min=0;el.step="any";}el.oninput=calcular;return el;}
function row(tipo,m={}){const el=document.createElement("div");el.className="sba-row "+tipo;if(sba&&tipo==="materiais")el.dataset.servicoId=m.servicoId||"";const keys=tipo==="materiais"?["descricao","especificacao","quantidade","custoUnitario"]:["descricao","dias","pessoas","horasDia","valorHora"];keys.forEach((k,i)=>{const defaults={quantidade:1,dias:1,pessoas:1,horasDia:8,valorHora:37.5,custoUnitario:0};const field=input(m[k]??defaults[k],i<(tipo==="materiais"?2:1)?"text":"number");field.dataset.key=k;const label={descricao:"Descrição",especificacao:"Especificação",quantidade:"Quantidade",custoUnitario:"Custo unitário",dias:"Dias",pessoas:"Pessoas",horasDia:"Horas por dia",valorHora:"Valor por hora"}[k];field.placeholder=label;field.setAttribute("aria-label",label);const wrap=document.createElement("label");const caption=document.createElement("span");caption.textContent=label;wrap.append(caption,field);el.append(wrap);});if(tipo==="materiais"&&catalogo.length){const select=document.createElement("select");select.add(new Option("Do catálogo",""));catalogo.forEach(s=>select.add(new Option(s.nome,s.servicoid)));select.onchange=()=>{const s=catalogo.find(s=>s.servicoid===Number(select.value));if(!s)return;if(sba)el.dataset.servicoId=s.servicoid;el.querySelector('[data-key="descricao"]').value=s.nome;el.querySelector('[data-key="especificacao"]').value=s.dadosMaterial?.especificacao||s.descricao||"";el.querySelector('[data-key="custoUnitario"]').value=s.custo??s.dadosMaterial?.custo??0;calcular();};const wrap=document.createElement("label");const caption=document.createElement("span");caption.textContent="Catálogo";wrap.append(caption,select);el.prepend(wrap);}const remove=document.createElement("button");remove.type="button";remove.textContent="Remover";remove.onclick=()=>{el.remove();calcular();};el.append(remove);$(tipo).append(el);calcular();}
function rowServico(m={}){
  if(!sba||!$("servicosOrcamento"))return;
  const el=document.createElement("div");
  el.className="sba-row servicos";
  const specs=[
    ["descricao","Serviço / descrição","text","Informe o serviço prestado"],
    ["detalhes","Detalhes (opcional)","text","Especificação do serviço"],
    ["quantidade","Quantidade","number","1"],
    ["unidade","Unid.","text","UN"],
    ["valorUnitario","Valor unitário (R$)","number","0"]
  ];
  for(const [key,label,tipo,placeholder] of specs){
    const wrap=document.createElement("label"),caption=document.createElement("span");
    caption.textContent=label;
    const field=input(m[key]??({quantidade:1,unidade:"UN",valorUnitario:0}[key]??""),tipo);
    field.dataset.key=key;field.setAttribute("aria-label",label);field.placeholder=placeholder;
    if(key==="quantidade"){field.min="0.01";field.step="0.01";}
    if(key==="valorUnitario"){field.min="0.01";field.step="0.01";}
    if(key==="descricao")field.maxLength=1000;
    if(key==="detalhes")field.maxLength=2000;
    wrap.append(caption,field);el.append(wrap);
  }
  const totalWrap=document.createElement("div");totalWrap.className="budget-servico-total";
  const totalLabel=document.createElement("span");totalLabel.textContent="Total do item";
  const total=document.createElement("strong");total.dataset.sbaSubtotal="true";
  total.textContent="R$ 0,00";totalWrap.append(totalLabel,total);
  el.append(totalWrap);
  const remove=document.createElement("button");remove.type="button";remove.textContent="Remover";
  remove.onclick=()=>{el.remove();calcular();};
  el.append(remove);$("servicosOrcamento").append(el);calcular();
}
function comp(){if(sba&&porServico&&editorServicos)return {...editorServicos.ler(),margem:Number($("margem").value)/100,imposto:Number($("imposto").value)/100};const read=id=>[...$(id).children].map(el=>Object.fromEntries([...el.querySelectorAll("[data-key]")].map(f=>[f.dataset.key,f.type==="number"?Number(f.value):f.value]).concat(sba&&id==="materiais"?[["servicoId",Number(el.dataset.servicoId)||null]]:[])));return{materiais:read("materiais"),maoObra:read("maoObra"),
  ...(sba?{servicos:read("servicosOrcamento")}:{}),
  margem:Number($("margem").value)/100,imposto:Number($("imposto").value)/100};}
function resumoFornecedores(){if(porServico)return;if(!sba||!$("fornecedoresResumo"))return;const list=$("fornecedoresResumo");list.replaceChildren();const ids=new Set([...$("materiais").children].map(el=>catalogo.find(s=>s.servicoid===Number(el.dataset.servicoId))?.dadosMaterial?.fornecedorId).filter(Boolean));for(const id of ids){const f=fornecedores.find(f=>f.fornecedorid===Number(id));if(!f)continue;const card=document.createElement('div');card.className='sba-card';card.textContent=[f.nome,f.formaPagamento,f.prazoPagamentoDias!=null?f.prazoPagamentoDias+' dias corridos':'',f.condicoesPagamento].filter(Boolean).join(' · ');list.append(card);}if(!list.children.length)list.textContent='Selecione materiais vinculados a fornecedores para consultar as condições de compra.';}
function calcular(){resumoFornecedores();const c=comp(),round=n=>Math.round((n+Number.EPSILON)*100)/100,valid=porServico||Number.isFinite(c.margem)&&c.margem>=0&&c.margem<1&&Number.isFinite(c.imposto)&&c.imposto>=0&&c.imposto<=1;
 const mat=porServico?round(c.servicos.reduce((n,s)=>n+s.custoMateriais,0)):round(c.materiais.reduce((s,m)=>s+m.quantidade*m.custoUnitario,0)),labor=porServico?round(c.servicos.reduce((n,s)=>n+s.custoMaoObra,0)):round(c.maoObra.reduce((s,m)=>s+m.dias*m.pessoas*m.horasDia*m.valorHora,0)),cost=round(mat+labor),
  temServicos=sba&&c.servicos?.length>0,
  servicosValidos=!temServicos||c.servicos.every(item=>
    item.descricao?.trim()&&Number.isFinite(item.quantidade)&&item.quantidade>0&&
    Number.isFinite(item.valorUnitario)&&item.valorUnitario>0&&item.quantidade<=10000&&
    (!porServico||(item.margem>=0&&item.margem<1&&item.imposto>=0&&item.imposto<=1&&
      [...item.materiais,...item.maoObra].every(m=>Object.values(m).every(v=>typeof v!=="number"||(Number.isFinite(v)&&v>=0&&v<=1e9)))))),
  precoServicos=temServicos?round(c.servicos.reduce((sum,item)=>
    sum+(porServico?item.subtotal:round(item.quantidade*item.valorUnitario)),0)):0,
  price=valid?(temServicos?precoServicos:round(cost/(1-c.margem))):NaN,
  tax=porServico?round(c.servicos.reduce((n,s)=>n+s.valorImposto,0)):round(price*c.imposto),revenue=round(price-tax),profit=round(revenue-cost);
 $("salvarOrcamento").disabled=(porServico&&(c.materiais.length>200||c.maoObra.length>100))||!valid||!servicosValidos||!Number.isFinite(price)||price<=0||price>99999999;
 if(sba&&!porServico&&$("servicosOrcamento")){
   for(const linha of $("servicosOrcamento").children){
     const q=Number(linha.querySelector('[data-key="quantidade"]')?.value||0);
     const v=Number(linha.querySelector('[data-key="valorUnitario"]')?.value||0);
     const total=linha.querySelector("[data-sba-subtotal]");
     if(total)total.textContent=Number.isFinite(q*v)?money(round(q*v)):"—";
   }
   if($("totalServicosOrcamento"))$("totalServicosOrcamento").textContent=money(precoServicos);
 }
$("totais").replaceChildren();for(const [label,value,classe] of [...(sba?[["Lucro antes de imposto",round(price-cost),""],["Margem líquida (%)",price>0?round(profit/price*100):0,"percent-total"]]:[]),["Materiais",mat,""],["Mão de obra",labor,""],["Custo total",cost,""],...(temServicos?[["Serviços vendidos",precoServicos,""]]:[]),["Preço de venda",price,"price-total"],["Imposto estimado",tax,""],["Receita após imposto",revenue,""],["Lucro após custo e imposto",profit,"profit-total"]]){const card=document.createElement("div");card.className="budget-total "+classe;const caption=document.createElement("span");caption.textContent=label;const total=document.createElement("strong");total.textContent=Number.isFinite(value)?(classe==="percent-total"?value.toLocaleString("pt-BR")+"%":money(value)):"—";if(value<0)card.classList.add("budget-loss");card.append(caption,total);$("totais").append(card);};}
function contatos(p={}){const c=clientes.find(c=>c.clienteid===Number($("cliente").value));for(const [id,values,chosen] of [["contato",c?[c.responsavel,...[1,2,3,4].flatMap(i=>[c["nomeEmail"+i],c["nomeTelefone"+i]])]:[],p.contatoDestinatario],["email",c?[1,2,3,4].map(i=>c["email"+i]):[],p.emailDestinatario]]){const el=$(id);el.replaceChildren(new Option("Selecione",""));for(const v of new Set(values.filter(Boolean)))el.add(new Option(v,v));el.value=chosen||"";}}
function novo(){ $("formOrcamento").reset();if(sba)modoPorServico(true);plano.preencher(null);$("tituloModalOrcamento").textContent=options.root?"Nova proposta":"Novo orçamento";$("mensagem").textContent="";$("orcamentoId").value="";$("materiais").replaceChildren();$("maoObra").replaceChildren();if($("servicosOrcamento")){$("servicosOrcamento").replaceChildren();if(sba&&!porServico)rowServico();}if(sba&&porServico)editorServicos.carregar([{}]);$("escopo").value=config.textoEscopo;contatos();calcular();}
async function listar(){if(options.root)return;const propostas=await api("/propostas");$("listaOrcamentos").replaceChildren();if(!propostas.some(p=>p.composicaoCustos)){const empty=document.createElement("p");empty.className="budget-empty";empty.textContent="Nenhum orçamento cadastrado. Clique em Novo orçamento para começar.";$("listaOrcamentos").append(empty);}for(const p of propostas.filter(p=>p.composicaoCustos)){const card=document.createElement("div");card.className="sba-card";const title=document.createElement("strong");title.textContent=`${p.numero} — ${p.titulo} — ${money(p.subtotal)}`;const editar=document.createElement("button");editar.textContent="Editar";editar.onclick=async()=>{try{await abrir(await api("/propostas/"+p.propostaid));}catch(e){$("mensagemListaOrcamentos").textContent=e.message;}};const pdf=document.createElement("button");pdf.textContent="Gerar PDF";pdf.onclick=async()=>{try{await api(`/propostas/${p.propostaid}/pdf`,"POST",{});location.href=`${API_URL}/propostas/${p.propostaid}/download?token=${encodeURIComponent(token)}`;}catch(e){$("mensagemListaOrcamentos").textContent=e.message;}};card.append(title,editar,pdf);$("listaOrcamentos").append(card);}}
$("cliente").onchange=()=>{contatos();if(sba){const c=clientes.find(x=>x.clienteid===Number($("cliente").value));$("pagamento").value=c?.condicoesPagamento||'';pagamentoSba.forma.value=c?.formaPagamento||'';pagamentoSba.prazo.value=c?.prazoPagamentoDias??'';plano.preencher(null);plano.aplicarPrazo(c?.prazoPagamentoDias);}};
if(pagamentoSba)pagamentoSba.prazo.oninput=()=>plano.aplicarPrazo(pagamentoSba.prazo.value);$("adicionarMaterial").onclick=()=>row("materiais");$("adicionarMaoObra").onclick=()=>row("maoObra");if($("adicionarServico"))$("adicionarServico").onclick=()=>rowServico();if($("novoOrcamento"))$("novoOrcamento").onclick=()=>abrir();$("margem").oninput=calcular;$("imposto").oninput=calcular;
$("formOrcamento").onsubmit=async e=>{e.preventDefault();$("salvarOrcamento").disabled=true;try{const body={...($("statusOrcamento")?{status:$("statusOrcamento").value}:{}),clienteId:Number($("cliente").value),titulo:$("titulo").value,descricao:$("descricao").value,escopo:$("escopo").value,contatoDestinatario:$("contato").value,emailDestinatario:$("email").value,composicaoCustos:comp(),dataValidade:$("validade").value||null,prazoEntrega:$("prazo").value,condicoesPagamento:$("pagamento").value,...(sba?{formaPagamento:pagamentoSba.forma.value}:{}),planoRecebimento:plano.ler(),tipoProposta:"SERVICOS"};const id=$("orcamentoId").value;const p=await api("/propostas"+(id?"/"+id:""),id?"PUT":"POST",body);$("orcamentoId").value=p.propostaid;if($("mensagemListaOrcamentos"))$("mensagemListaOrcamentos").textContent="Orçamento salvo com sucesso.";await listar();if(options.onSaved)await options.onSaved(p);modal.hide();}catch(e){$("mensagem").textContent=e.message;}finally{calcular();}};
async function configurar(c){config=c;
 if(c.perfil==='SBA'&&!sba){sba=true;plano.destruir();pagamentoSba=window.criarPagamentoSba($("pagamento"));pagamentoSba.prazo.oninput=()=>plano.aplicarPrazo(pagamentoSba.prazo.value);plano=window.criarPlanoRecebimento($("pagamento"),{sba:true});}if($("fornecedoresSection"))$("fornecedoresSection").hidden=!sba;if($("servicosSection"))$("servicosSection").hidden=!sba;
 if(sba)fornecedores=await api('/fornecedores');
 if(!c.composicaoCustos){if(!options.root)location.replace("perfil.html");return;}[clientes,catalogo]=await Promise.all([api("/clientes"),api("/servicos")]);catalogo=catalogo.filter(s=>s.ativo&&s.dadosMaterial);$("cliente").replaceChildren(new Option("Selecione",""));clientes.forEach(c=>$("cliente").add(new Option(c.razaoSocial||c.nomeFantasia,c.clienteid)));novo();await listar();}
async function abrir(p=null){
 // A SBA mostra o editor de imediato em vez de deixar o card carregando.
 if(options.root){
  $("formOrcamento").reset();
  $("materiais").replaceChildren();
  $("maoObra").replaceChildren();
  $("salvarOrcamento").disabled=true;
  $("mensagem").textContent="Carregando os dados da proposta...";
  modal.show();
 }
 try {
 if(carregamento)await carregamento;
 if(!config)throw Error("Aguarde o carregamento do perfil da empresa.");
 // O configurar() inicial já carregou as listas da SBA, sem fetch duplicado.
 if(!options.root){
  if(sba)fornecedores=await api("/fornecedores");
  [clientes,catalogo]=await Promise.all([api('/clientes'),api('/servicos')]);
  catalogo=catalogo.filter(s=>s.ativo&&s.dadosMaterial);
 }
 $("cliente").replaceChildren(new Option("Selecione",""));clientes.forEach(c=>$("cliente").add(new Option(c.razaoSocial||c.nomeFantasia,c.clienteid)));
 novo();plano.preencher(p?.planoRecebimento);propostaAberta=p;
 if(p){if(sba)modoPorServico(p.composicaoCustos.versao===2);if(sba){pagamentoSba.forma.value=p.formaPagamento||"";pagamentoSba.prazo.value=p.planoRecebimento?.prazoDias??"";}$("orcamentoId").value=p.propostaid;$("cliente").value=p.clienteId;contatos(p);for(const [id,k]of [["titulo","titulo"],["descricao","descricao"],["escopo","escopo"],["pagamento","condicoesPagamento"],["prazo","prazoEntrega"]])$(id).value=p[k]||"";$("validade").value=p.dataValidade?.slice(0,10)||"";$("margem").value=p.composicaoCustos.margem*100;$("imposto").value=p.composicaoCustos.imposto*100;p.composicaoCustos.materiais.forEach(m=>row("materiais",m));p.composicaoCustos.maoObra.forEach(m=>row("maoObra",m));
 if(sba&&porServico)editorServicos.carregar(p.composicaoCustos.servicos);
 if(sba&&!porServico&&$("servicosOrcamento")){
   $("servicosOrcamento").replaceChildren();
   (p.composicaoCustos.servicos||[]).forEach(m=>rowServico(m));
 }
 $("tituloModalOrcamento").textContent=(options.root?"Editar proposta · ":"Editar orçamento · ")+p.numero;}
 if($("statusOrcamento")){
  $("statusOrcamento").value=p?.status||"RASCUNHO";
  const faturada=$("statusOrcamento").querySelector('option[value="FATURADA"]');if(faturada)faturada.disabled=p?.status!=="FATURADA";
 }
 calcular();
 if(!options.root)modal.show();
 }catch(error){
  $("mensagem").textContent=error?.message||"Não foi possível carregar a proposta.";
  $("salvarOrcamento").disabled=true;
  throw error;
 }
}
if(options.config)carregamento=configurar(options.config);
else window.addEventListener("configuracao-sistema",({detail:c})=>{carregamento=configurar(c).catch(e=>{($("mensagemListaOrcamentos")||$("mensagem")).textContent=e.message;});});
return {abrir,ready:()=>carregamento};
};
if(document.getElementById("modalOrcamento"))window.criarEditorOrcamento();
