/* Organização visual exclusiva do José. Os botões originais mantêm suas ações. */
(async()=>{
 const u=window.obrasUI,$=id=>document.getElementById(id);
 if(!u)return;
 let empresa;try{empresa=await u.api('/empresas/me');}catch{return;}
 if(Number(empresa.empresaid)!==5||empresa.slug!=='construarty'||empresa.configuracaoSistema?.modulos?.obras!==true)return;
 const barra=document.querySelector('.obras-page .toolbar'),conteudo=$('conteudo');if(!barra||!conteudo)return;
 document.body.classList.add('jose-obras-organizada');
 const criarMenu=(id,titulo)=>{const d=document.createElement('details');d.id=id;d.className='jose-obra-menu';
 const s=document.createElement('summary');s.textContent=titulo;const box=document.createElement('div');box.className='jose-obra-menu-items';d.append(s,box);
 box.addEventListener('click',e=>{if(e.target.closest('button,a'))d.open=false;});return d;};
 const mais=criarMenu('joseObraMais','Mais ações'),itensMais=mais.lastElementChild;
 const guardar=document.createElement('div');guardar.id='joseObraGuardar';guardar.hidden=true;barra.append(mais,guardar);
 const contexto=['equipe','fechar','abrirPlanilhasMedicaoJose'];
 const referencias=new Map();
 function mover(id,destino){const el=$(id)||referencias.get(id);if(!el)return null;referencias.set(id,el);if(el.parentElement!==destino)destino.append(el);return el;}
 function organizarBarra(){
  for(const [id,nome] of [['editarObra','Editar dados da obra'],['relatorioObra','Baixar relatório consolidado'],['importarPlanilha','Importar dados do Excel'],['novaObra','Cadastrar obra sem proposta']]){
   const b=mover(id,itensMais);if(b)b.textContent=nome;
  }
  for(const id of contexto){const el=$(id);if(el&&!conteudo.contains(el))mover(id,guardar);}
  const principal=$('obraDaProposta');if(principal){principal.textContent='+ Nova obra';principal.title='Criar uma obra a partir de uma proposta cadastrada';principal.classList.add('jose-obra-primary');if(principal.nextElementSibling!==mais)barra.insertBefore(principal,mais);}
  mais.hidden=![...itensMais.children].some(b=>!b.hidden);
 }
 // Os filtros continuam com os mesmos eventos e só ocupam espaço quando abertos.
 const filtros=$('filtros'),filtroDetalhes=document.createElement('details'),sumario=document.createElement('summary');
 filtroDetalhes.id='joseObraFiltros';filtroDetalhes.className='jose-obra-filtros';sumario.textContent='Filtrar registros';
 filtros.before(filtroDetalhes);filtroDetalhes.append(sumario,filtros);
 const atualizarFiltro=()=>{const n=['buscaObra','filtroInicio','filtroFim'].filter(id=>$(id).value.trim()).length;sumario.textContent=n?'Filtros ativos ('+n+')':'Filtrar registros';filtroDetalhes.classList.toggle('tem-filtro',n>0);};
 filtros.addEventListener('input',atualizarFiltro);$('limparFiltros').addEventListener('click',atualizarFiltro);
 const nomes={planejamento:'Planejamento',medicoes:'Evolução e medições'};
 document.querySelectorAll('.obras-page .tabs [data-tab]').forEach(b=>{if(nomes[b.dataset.tab])b.textContent=nomes[b.dataset.tab];});
 const percent=new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:2});
 const percentual=valor=>percent.format(valor/100);
 const centavos=valor=>Math.round(Number(valor)*100);
 let medicaoSelecionada;
 let fonteImportada;
 let abasImportadas=[];
 let abaImportada;
 let versaoFonte=0;
 const listasImportadas=new Map();

 function montarEscopoImportado(aba){
  const etapas=aba.itens.map(i=>({id:i.linha,codigo:i.item,nome:[i.etapa,i.descricao].filter(Boolean).join(' · '),valor:i.valor}));
  const anteriores=new Map();
  const medicoes=aba.medicoes.map(m=>{
   const itens=aba.itens.map(i=>{
    const anterior=anteriores.get(i.linha)||0;
    const percentual=Number(fonteImportada.edicoes?.[aba.indice+':'+i.linha+':'+m.numero]??i.percentuais[m.numero]??0);
    const atual=anterior+percentual;
    anteriores.set(i.linha,atual);
    return {etapaId:i.linha,anterior,atual,valor:i.valoresMedidos?.[m.numero]??i.valor*percentual/100};
   });
   return {id:m.numero,titulo:m.titulo,fim:m.data,prevista:m.prevista,status:'APROVADA',itens,valor:itens.reduce((s,i)=>s+Number(i.valor),0)};
  });
  return {etapas,medicoes,financeiro:[],valorContrato:etapas.reduce((s,e)=>s+centavos(e.valor),0)/100};
 }

 async function listarImportadas(painel,obraId){
  const seletor=painel.querySelector('#joseEscopoFonte');
  if(!listasImportadas.has(obraId)){
   const consulta=u.api('/obras/planilhas?obraId='+obraId).catch(erro=>{listasImportadas.delete(obraId);throw erro;});
   listasImportadas.set(obraId,consulta);
  }
  const lista=await listasImportadas.get(obraId);
  if(!seletor.isConnected)return;
  for(const arquivo of lista)seletor.add(new Option(arquivo.nome,String(arquivo.id)));
  seletor.value=String(fonteImportada?.id||'');
  seletor.disabled=false;
  seletor.onchange=async()=>{
   const versao=++versaoFonte;
   try{
    const fonte=seletor.value?await u.api('/obras/planilhas/'+seletor.value):null;
    if(versao!==versaoFonte||!seletor.isConnected||u.obra?.id!==obraId)return;
    if(fonte&&fonte.obraId!==obraId)throw Error('Planilha vinculada a outra obra.');
    const abas=fonte?.abas.filter(a=>a.reconhecida)||[];
    if(fonte&&!abas.length)throw Error('Esta planilha não possui abas de medição reconhecidas.');
    fonteImportada=fonte;
    abasImportadas=abas;
    abaImportada=abas[0];
    medicaoSelecionada=undefined;
    escopoCivil();
    $('joseEscopoFonte').focus();
   }catch(erro){if(seletor.isConnected){seletor.value=String(fonteImportada?.id||'');u.erro(erro);}}
  };
 }


 function escopoCivil(){
  if(fonteImportada?.obraId!==u.obra.id){fonteImportada=null;abasImportadas=[];abaImportada=null;}
  const importada=Boolean(abaImportada);
  const obra=importada?montarEscopoImportado(abaImportada):u.obra;
  const emCentavos=importada?valor=>Number(valor)*100:centavos;
  const medicoes=obra.medicoes.filter(m=>m.status!=='CANCELADA')
   .sort(importada?(a,b)=>a.id-b.id:(a,b)=>String(a.fim).localeCompare(String(b.fim))||a.id-b.id);
  const selecionada=medicoes.find(m=>m.id===medicaoSelecionada)||medicoes.filter(m=>!m.prevista).at(-1)||medicoes.at(-1);
  const acumulados=new Map();
  for(const medicao of medicoes){
   if(medicao===selecionada||medicao.status==='APROVADA'){
    for(const item of medicao.itens){
     acumulados.set(item.etapaId,(acumulados.get(item.etapaId)||0)+emCentavos(item.valor));
    }
   }
   if(medicao===selecionada)break;
  }
  const itens=new Map((selecionada?.itens||[]).map(item=>[item.etapaId,item]));
  const contrato=centavos(obra.valorContrato);
  const lancamento=obra.financeiro.find(l=>l.lancamentofinanceiroid===selecionada?.lancamentoId);
  const recebido=centavos(lancamento?.valorPago||0);
  const saldo=lancamento?.status==='ABERTO'?Math.max(0,centavos(lancamento.valor)-recebido):0;
  const linhas=obra.etapas.map((etapa,indice)=>{
   const item=itens.get(etapa.id);
   const valor=centavos(etapa.valor);
   const acumulado=acumulados.get(etapa.id)||0;
   return `<tr><td>${u.esc(etapa.codigo||indice+1)}</td><th scope="row">${u.esc(etapa.nome)}</th><td>${u.brl(etapa.valor)}</td>
    <td>${percentual(contrato?valor/contrato*100:0)}</td>
    <td>${percentual(Number(item?.atual||0)-Number(item?.anterior||0))}</td>
    <td>${percentual(Number(item?.atual||0))}</td><td>${u.brl(item?.valor)}</td>
    <td>${u.brl(acumulado/100)}</td><td>${u.brl((valor-acumulado)/100)}</td></tr>`;
  });
  const totalAcumulado=[...acumulados.values()].reduce((soma,valor)=>soma+valor,0);
  const painel=document.createElement('section');
  painel.id='joseEscopoCivil';
  painel.innerHTML=`<div class="jose-escopo-cabecalho">
   <div><h3>Escopo de mão de obra civil</h3><p>Valor total da obra <strong>${u.brl(obra.valorContrato)}</strong></p></div>
   <label>Origem dos dados<select id="joseEscopoFonte" disabled><option value="">Medições do ERP</option></select></label>
   ${abasImportadas.length>1?`<label>Aba<select id="joseEscopoAba">${abasImportadas.map(a=>`<option value="${a.indice}" ${a===abaImportada?'selected':''}>${u.esc(a.nome)}</option>`).join('')}</select></label>`:''}
   ${medicoes.length?`<label>Medição<select id="joseEscopoMedicao">${medicoes.map((m,i)=>
    `<option value="${m.id}" ${m===selecionada?'selected':''}>${u.esc(m.titulo||('Medição '+String(i+1).padStart(2,'0')))} · ${m.fim?u.dia(m.fim):'Sem data'}${m.status==='RASCUNHO'?' · Rascunho':''}</option>`).join('')}</select></label>`:''}
   </div>
   <div class="obra-table-wrap">${u.tabela(['Item','Etapa / descrição','Valor da etapa','% do contrato','% na medição','% acumulado','Valor medido','Valor acumulado','Saldo a medir'],linhas)
    .replace('</table>',`<tfoot><tr><th colspan="2" scope="row">Total da obra</th><td>${u.brl(obra.valorContrato)}</td>
    <td>${percentual(contrato?100:0)}</td><td>${percentual(contrato?emCentavos(selecionada?.valor||0)/contrato*100:0)}</td>
    <td>${percentual(contrato?totalAcumulado/contrato*100:0)}</td><td>${u.brl(selecionada?.valor)}</td>
    <td>${u.brl(totalAcumulado/100)}</td><td>${u.brl((contrato-totalAcumulado)/100)}</td></tr></tfoot></table>`)}</div>
   ${importada?`<div class="jose-escopo-recebimento">Dados da planilha vinculada à obra. Consulte as medições do ERP para aprovações e recebimentos.
   ${obra.etapas.some(e=>(acumulados.get(e.id)||0)-centavos(e.valor)>0.5)?'<strong>Confira as etapas com valor acumulado acima do valor vigente.</strong>':''}</div>`:selecionada?`<div class="jose-escopo-recebimento"><span>Recebido nesta medição <strong>${u.brl(recebido/100)}</strong></span>
   ${lancamento?`<span>Saldo a receber <strong>${u.brl(saldo/100)}</strong></span>`:''}
   ${u.fin&&saldo>0?'<button type="button" id="joseReceberMedicao">Registrar recebimento</button>':''}</div>`:''}`;
  if($('joseEscopoCivil'))$('joseEscopoCivil').replaceWith(painel);
  else $('consultaObras')?.before(painel);
  listarImportadas(painel,u.obra.id).catch(erro=>{
   if(painel.isConnected)painel.querySelector('#joseEscopoFonte').options[0].text='Medições do ERP · Planilhas indisponíveis';
  });
  painel.querySelector('#joseEscopoAba')?.addEventListener('change',evento=>{
   abaImportada=abasImportadas.find(a=>a.indice===Number(evento.target.value));
   medicaoSelecionada=undefined;
   escopoCivil();
   $('joseEscopoAba').focus();
  });
  painel.querySelector('#joseEscopoMedicao')?.addEventListener('change',evento=>{
   medicaoSelecionada=Number(evento.target.value);
   escopoCivil();
   $('joseEscopoMedicao').focus();
  });
  painel.querySelector('#joseReceberMedicao')?.addEventListener('click',evento=>{
   registrarRecebimento(evento.currentTarget,lancamento,saldo).catch(u.erro);
  });
 }

 async function registrarRecebimento(botao,lancamento,saldo){
  botao.disabled=true;
  let contas;
  try{contas=(await u.api('/financeiro/contas')).filter(conta=>conta.ativo!==false);}
  finally{botao.disabled=false;}
  if(!botao.isConnected)return;
  if(!contas.length)throw Error('Cadastre uma conta financeira para registrar o recebimento.');
  const hoje=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  u.abrir('Registrar recebimento da medição',
   u.campo('valorPago','Valor recebido (R$)','number','',`required min="0.01" max="${saldo/100}" step="0.01"`)+
   u.campo('dataPagamento','Data do recebimento','date',hoje,`required max="${hoje}"`)+
   u.select('contaFinanceiraId','Conta de recebimento',contas.map(c=>({id:c.contafinanceiraid,nome:c.nome}))),
   dados=>u.api('/financeiro/lancamentos/'+lancamento.lancamentofinanceiroid+'/baixar','POST',dados));
 }

 const camposEditor=$('camposEditor');
 new MutationObserver(()=>{
  if(!camposEditor.querySelector('input[name^="etapa_"]'))return;
  const rotulo=camposEditor.querySelector('input[name="fim"]')?.parentElement.firstChild;
  if(rotulo?.nodeType===Node.TEXT_NODE)rotulo.textContent='Data da medição (fim do período)';
 }).observe(camposEditor,{childList:true});
 function organizarContexto(){
  filtroDetalhes.hidden=!u.obra;
  if(!u.obra)return;
  const head=conteudo.querySelector('.section-head');if(!head)return;
  let acoes=head.querySelector('.jose-obra-acoes');
  if(!acoes){acoes=document.createElement('div');acoes.className='jose-obra-acoes';[...head.children].filter(e=>e.tagName!=='H2').forEach(e=>acoes.append(e));head.append(acoes);}
  if(u.tab==='cronograma'){
   const menu=criarMenu('joseObraEquipeAcoes','Equipe e pagamentos');
   const equipe=mover('equipe',menu.lastElementChild);if(equipe)equipe.textContent=u.admin?'Gerenciar equipe':'Consultar equipe';
   const fechar=mover('fechar',menu.lastElementChild);if(fechar)fechar.textContent='Enviar diárias ao financeiro';
   if([...menu.lastElementChild.children].some(b=>!b.hidden))acoes.prepend(menu);
   if(u.admin){const novo=document.createElement('button');novo.type='button';novo.id='novoColaboradorDireto';novo.className='jose-obra-secondary';novo.textContent='+ Novo colaborador';novo.onclick=()=>u.abrirColaborador();acoes.prepend(novo);}
  }
  if(u.tab==='medicoes'){
   const planilhas=mover('abrirPlanilhasMedicaoJose',acoes);if(planilhas){planilhas.textContent='Planilhas da engenharia';planilhas.classList.add('jose-obra-secondary');}
   escopoCivil();
  }
 }
 const base=u.render;
 u.render=()=>{
  // Retirar os botões antes do render evita perder os eventos ao trocar de aba.
  contexto.forEach(id=>mover(id,guardar));mais.open=false;
  base();organizarBarra();organizarContexto();atualizarFiltro();
 };
 new MutationObserver(()=>{organizarBarra();if($('abrirPlanilhasMedicaoJose')?.parentElement===guardar&&u.tab==='medicoes')organizarContexto();})
  .observe(barra,{childList:true});
 document.addEventListener('click',e=>{document.querySelectorAll('.jose-obra-menu[open]').forEach(d=>{if(!d.contains(e.target))d.open=false;});});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.jose-obra-menu[open]').forEach(d=>{d.open=false;d.querySelector('summary').focus();});});
 organizarBarra();u.render();
})();
