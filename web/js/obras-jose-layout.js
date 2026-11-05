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
