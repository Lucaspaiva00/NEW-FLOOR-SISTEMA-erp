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
 let edicaoAvanco;
 let abrindoAvanco=false;
 let fonteImportada;
 let abasImportadas=[];
 let abaImportada;
 let versaoFonte=0;
 const listasImportadas=new Map();

 function montarEscopoImportado(aba){
  const etapas=aba.itens.map(i=>({id:i.linha,codigo:i.item,nome:i.etapa||i.descricao,descricao:i.etapa?i.descricao:'',valor:i.valor}));
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

 async function selecionarFonte(id,obraId,indice){
  const versao=++versaoFonte;
  const fonte=id?await u.api('/obras/planilhas/'+id):null;
  if(versao!==versaoFonte||u.obra?.id!==obraId||u.tab!=='medicoes')return;
  if(fonte&&fonte.obraId!==obraId)throw Error('Planilha vinculada a outra obra.');
  const abas=fonte?.abas.filter(a=>a.reconhecida)||[];
  if(fonte&&!abas.length)throw Error('Esta planilha não possui abas de medição reconhecidas.');
  fonteImportada=fonte;
  abasImportadas=abas;
  abaImportada=abas.find(a=>a.indice===indice)||abas[0];
  medicaoSelecionada=undefined;
  escopoCivil();
 }

 function importarNoEscopo(){
  const obraId=u.obra.id;
  let arquivo, previa, nome, mapas={};
  const chaveMapas='construarty-mapeamentos-medicao';
  const assinatura=(aba,linha)=>{
   const cabecalho=aba.amostra?.find(r=>r.linha===Number(linha));
   return cabecalho?.celulas.length?JSON.stringify([aba.nome.trim().toUpperCase(),cabecalho.celulas.map(c=>[c.coluna,c.valor.trim().toUpperCase()])]):'';
  };
  let salvos=[];
  try{const valor=JSON.parse(localStorage.getItem(chaveMapas)||'[]');if(Array.isArray(valor))salvos=valor;}catch{}
  const vigente=()=>u.obra?.id===obraId;
  const dialogo=(titulo,html,acao)=>{
   u.abrir(titulo,html,acao);
   $('salvarEditor').textContent=previa?'Importar para a obra':'Conferir planilha';
  };
  dialogo('Importar medições do Excel',
   '<label class="wide">Arquivo Excel (.xlsx)<input id="joseExcelMedicao" type="file" accept=".xlsx" required></label>',
   async()=>{
    const campoArquivo=$('joseExcelMedicao');
    const excel=campoArquivo.files[0];
    if(!excel||!/\.xlsx$/i.test(excel.name)||excel.size>5000000)throw Error('Selecione um arquivo .xlsx de até 5 MB.');
    nome=excel.name;
    const bytes=new Uint8Array(await excel.arrayBuffer());
    let binario='';
    for(let i=0;i<bytes.length;i+=16384)binario+=String.fromCharCode(...bytes.subarray(i,i+16384));
    arquivo=btoa(binario);
    previa=await u.api('/obras/planilhas/previa','POST',{arquivo});
    for(const aba of previa.abas){
     if(aba.reconhecida)continue;
     const salvo=salvos.find(m=>m?.config&&m.assinatura&&assinatura(aba,m.config.cabecalho)===m.assinatura);
     if(salvo)mapas[aba.indice]=salvo.config;
    }
    if(Object.keys(mapas).length)previa=await u.api('/obras/planilhas/previa','POST',{arquivo,mapeamentos:mapas});
    if(vigente()&&campoArquivo.isConnected&&$('editor').open)mostrarPrevia();
    return {continuar:true};
   });
  function mostrarPrevia(indice){
   const civil=previa.abas.find(a=>/^escopo\s+(?:mo|mão de obra)\s+civil$/i.test(a.nome.trim()));
   const reconhecidas=previa.abas.filter(a=>a.reconhecida);
   const candidatas=civil?[civil]:reconhecidas.length?reconhecidas:previa.abas;
   const aba=candidatas.find(a=>a.indice===indice)||candidatas[0];
   if(!aba)throw Error('O Excel não possui abas disponíveis.');
   const campos=mapas[aba.indice]||aba.mapeamento||{};
   const pronto=aba.reconhecida&&previa.valida!==false;
   const total=aba.itens.reduce((s,i)=>s+Number(i.valor),0);
   const listaAbas=candidatas.length===1?`<p class="wide">Aba do Excel <strong>${u.esc(aba.nome)}</strong></p>`:
    '<label class="wide">Aba do Excel<select id="joseAbaPrevia">'+candidatas.map(a=>
    `<option value="${a.indice}" ${a===aba?'selected':''}>${u.esc(a.nome)}${a.reconhecida?' · Reconhecida':''}</option>`).join('')+'</select></label>';
   const resumo=pronto?`<div class="wide jose-importacao-resumo"><strong>${aba.itens.length} itens · ${aba.medicoes.length} medições</strong><span>Valor das etapas ${u.brl(total)}</span></div>
    <div class="wide obra-table-wrap">${u.tabela(['Item','Etapa / descrição','Valor da etapa'],aba.itens.slice(0,8).map(i=>
     `<tr><td>${u.esc(i.item)}</td><td>${u.esc([i.etapa,i.descricao].filter(Boolean).join(' · '))}</td><td>${u.brl(i.valor)}</td></tr>`))}</div>
    ${aba.itens.length>8?'<p class="wide">A prévia mostra os 8 primeiros itens. A importação inclui todos os itens reconhecidos.</p>':''}
    <details class="wide"><summary>Conferir medições e datas</summary><ul>${aba.medicoes.map(m=>`<li>${u.esc(m.titulo)} · ${m.data?u.dia(m.data):'Sem data identificada'}</li>`).join('')}</ul></details>`
    :'<p class="wide" role="status">Confira a linha de cabeçalho e indique as colunas da sua planilha.</p>';
   const avisos=previa.avisos.filter(a=>a.startsWith(aba.nome+' ')||a.startsWith(aba.nome+':'));
   const revisarCivil=civil&&!pronto;
   const avisosHtml=avisos.length?`<details class="wide" ${pronto?'':'open'}><summary>Avisos da aba (${avisos.length})</summary><ul>${avisos.map(a=>'<li>'+u.esc(a)+'</li>').join('')}</ul></details>`:'';
   if(revisarCivil){
    dialogo('Conferir importação',listaAbas+
     '<p class="wide" role="status">A aba Escopo MO Civil usa fórmulas do contrato. Tente reconhecer o arquivo novamente. Se os avisos persistirem, confira os valores no Excel antes de importar.</p>'+
     avisosHtml+'<button type="button" id="joseRelerExcel">Tentar reconhecer novamente</button>',null);
    $('joseRelerExcel').onclick=async e=>{
     const botao=e.currentTarget;
     botao.disabled=true;
     try{const nova=await u.api('/obras/planilhas/previa','POST',{arquivo});if(botao.isConnected&&vigente()){mapas={};previa=nova;mostrarPrevia();}}
     catch(erro){if(botao.isConnected)$('erroEditor').textContent=erro.message;}
     finally{botao.disabled=false;}
    };
    return;
   }
   dialogo('Conferir importação',listaAbas+resumo+
    avisosHtml+
    `<details class="wide" ${pronto?'':'open'}><summary>Conferir ou ajustar campos</summary>
    <label>Linha de cabeçalho<select id="joseLinhaCabecalho">${(aba.amostra||[]).map(r=>`<option value="${r.linha}">Linha ${r.linha} · ${u.esc(r.celulas.slice(0,5).map(c=>c.valor).join(' · ').slice(0,160))}</option>`).join('')}</select></label>
    <div id="joseCamposMapa" class="jose-importacao-mapa"></div>
    <button type="button" id="joseValidarMapa">Validar campos</button></details>`,
    pronto?async()=>{
     if(!vigente())throw Error('A obra selecionada mudou. Abra a importação novamente.');
     const salvo=await u.api('/obras/planilhas/importar','POST',{obraId,nome:nome.replace(/\.xlsx$/i,'').slice(0,180),arquivoNome:nome,arquivo,hash:previa.hash,mapeamentos:mapas});
     for(const a of previa.abas){
      const config=mapas[a.indice];
      const chave=config&&assinatura(a,config.cabecalho);
      if(chave)salvos.push({assinatura:chave,config});
     }
     try{localStorage.setItem(chaveMapas,JSON.stringify([...new Map(salvos.map(m=>[m.assinatura,m])).values()].slice(-30)));}catch{}
     listasImportadas.delete(obraId);
     await selecionarFonte(salvo.id,obraId,aba.indice);
    }:null);
   $('joseAbaPrevia')?.addEventListener('change',e=>mostrarPrevia(Number(e.target.value)));
   const cabecalho=$('joseLinhaCabecalho');
   const linhasValidas=(aba.amostra||[]).filter(r=>r.celulas.length>=3);
   const linhasPermitidas=new Set(linhasValidas.map(r=>String(r.linha)));
   for(const opcao of cabecalho.options)opcao.disabled=!linhasPermitidas.has(opcao.value);
   const sugerirLinha=(aba.amostra||[]).find(r=>r.celulas.some(c=>/descri|serviço|atividade/i.test(c.valor))&&r.celulas.some(c=>/valor|preço|total/i.test(c.valor)));
   cabecalho.value=String(campos.cabecalho||aba.cabecalho||sugerirLinha?.linha||linhasValidas[0]?.linha||'');
   const letra=n=>{let s='';for(let i=Number(n);i>0;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s||String(n||'');};
   const atualizarCampos=()=>{
    const colunas=aba.amostra?.find(r=>r.linha===Number(cabecalho.value))?.celulas||[];
    const definicoes=[['item','Item',/^(item|c[oó]digo|ref\.?)/i],['etapa','Etapa',/etapa|fase|grupo/i],
     ['descricao','Descrição',/descri|serviço|atividade/i],['valor','Valor da etapa',/valor.*(total|contrat|etapa|vigente)|^total$/i],
     ['unidade','Unidade',/^(un|uni|und|unidade)\.?$/i],['quantidade','Quantidade',/^(qtd|qtde|quantidade)\.?$/i]];
    $('joseCamposMapa').innerHTML=definicoes.map(([chave,rotulo,regex])=>`<label>${rotulo}<select data-mapa="${chave}">
     <option value="0">Sem coluna</option>${colunas.map(c=>`<option value="${u.esc(c.coluna)}" ${c.coluna===(letra(campos[chave])||colunas.find(col=>regex.test(col.valor))?.coluna)?'selected':''}>${u.esc(c.coluna+' · '+c.valor)}</option>`).join('')}</select></label>`).join('')+
     '<label>Tipo de valor<select data-mapa="tipoValor"><option value="total">Total da etapa</option><option value="unitario">Valor unitário</option></select></label>'+
     '<label>Percentual da medição<select data-mapa="tipoPercentual"><option value="periodo">Do período</option><option value="acumulado">Acumulado</option></select></label>'+
     u.campo('linhaDatas','Linha das datas (opcional)','number',mapas[aba.indice]?.linhaDatas||'','min="1" max="200"')+
     '<fieldset class="wide"><legend>Colunas de medição</legend>'+colunas.map(c=>`<label><input type="checkbox" data-coluna-medicao="${u.esc(c.coluna)}" ${(campos.colunasMedicoes||'').split(',').includes(c.coluna)||/medi[çc][aã]o\s*\d/i.test(c.valor)?'checked':''}> ${u.esc(c.coluna+' · '+c.valor)}</label>`).join('')+'</fieldset>';
    for(const chave of ['tipoValor','tipoPercentual']){
     const escolha=mapas[aba.indice]?.[chave]||campos[chave];
     if(escolha)$('joseCamposMapa').querySelector('[data-mapa="'+chave+'"]').value=escolha;
    }
   };
   cabecalho.onchange=atualizarCampos;
   atualizarCampos();
   $('joseValidarMapa').onclick=async e=>{
    const botao=e.currentTarget;
    botao.disabled=true;
    try{
     const camposEditor=$('joseCamposMapa');
     const mapa=Object.fromEntries([...camposEditor.querySelectorAll('[data-mapa]')].map(c=>[c.dataset.mapa,c.value]));
     const colunas=[...camposEditor.querySelectorAll('[data-coluna-medicao]:checked')].map(c=>c.dataset.colunaMedicao);
     if(!linhasPermitidas.has(cabecalho.value)||mapa.descricao==='0'||mapa.valor==='0'||(mapa.item==='0'&&mapa.etapa==='0')||!colunas.length)throw Error('Indique item ou etapa, descrição, valor e pelo menos uma coluna de medição.');
     const usadas=['item','etapa','descricao','valor','unidade','quantidade'].map(c=>mapa[c]).filter(c=>c!=='0');
     if(new Set(usadas).size!==usadas.length||colunas.some(c=>usadas.includes(c)))throw Error('Escolha uma coluna diferente para cada campo e para as medições.');
     const tentativa={...mapas,[aba.indice]:{...mapa,cabecalho:cabecalho.value,linhaDatas:camposEditor.querySelector('[name="linhaDatas"]').value,colunasMedicoes:colunas.join(',')}};
     previa=await u.api('/obras/planilhas/previa','POST',{arquivo,mapeamentos:tentativa});
     mapas=tentativa;
     if(vigente()&&botao.isConnected)mostrarPrevia(aba.indice);
    }catch(erro){if(botao.isConnected)$('erroEditor').textContent=erro.message;}
    finally{botao.disabled=false;}
   };
  }
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
   try{
    await selecionarFonte(seletor.value,obraId);
    $('joseEscopoFonte')?.focus();
   }catch(erro){if(seletor.isConnected){seletor.value=String(fonteImportada?.id||'');u.erro(erro);}}
  };
 }


 function vincularPlanilhaOutraObra(){
  const origem=u.obra,fonte=fonteImportada,aba=abaImportada;
  const total=aba.itens.reduce((soma,item)=>soma+centavos(item.valor),0);
  const candidatas=u.obras.filter(o=>o.id!==origem.id&&centavos(o.valorContrato)===total&&!['CANCELADA','CONCLUIDA'].includes(o.status));
  const texto=`<p class="wide">Planilha <strong>${u.esc(fonte.nome)}</strong> · Contrato ${u.brl(total/100)}.</p>`;
  if(!candidatas.length){
   u.abrir('Vincular à obra correta',texto+'<p class="wide">Cadastre a obra com o cliente correto e esse valor de contrato. Depois volte à planilha e use este botão para mover o vínculo.</p>',null);
   return;
  }
  u.abrir('Vincular à obra correta',texto+u.select('obraId','Obra de destino',candidatas)+
   '<p class="wide">Confira o cliente na obra de destino antes de transferir.</p>',
   async dados=>{
    if(u.obra?.id!==origem.id)throw Error('A obra selecionada mudou.');
    const resultado=await u.api('/obras/planilhas/'+fonte.id+'/transferir','POST',{...dados,aba:aba.indice});
    listasImportadas.delete(origem.id);listasImportadas.delete(resultado.obraId);
    $('obraSelecionada').value=String(resultado.obraId);
    await u.detalhe();
    await selecionarFonte(resultado.id,resultado.obraId,aba.indice);
    $('editor').close();
    return {continuar:true};
   });
  $('salvarEditor').textContent='Transferir vínculo';
 }

 function iniciarAvancoNaTabela(){
  fonteImportada=null;abasImportadas=[];abaImportada=null;medicaoSelecionada=undefined;
  edicaoAvanco={obraId:u.obra.id,percentuais:new Map()};
  escopoCivil();
  $('joseEscopoCivil').querySelector('input[data-avanco-item]:not([disabled])')?.focus();
 }
 function configurarAvanco(painel,etapas,contrato){
  const entradas=[...painel.querySelectorAll('input[data-avanco-item]')];
  const atualizar=()=>{
   let total=0,totalAnterior=0,invalido=false;
   for(const entrada of entradas){
    const linha=entrada.closest('tr');
    const avancou=Number(entrada.value||0);
    const valor=Math.round(Number(entrada.dataset.valor)*avancou/100);
    const jaMedido=Number(entrada.dataset.acumulado);
    total+=valor;totalAnterior+=jaMedido;
    invalido||=!entrada.validity.valid;
    linha.querySelector('[data-avanco-valor]').textContent=u.brl(valor/100);
    linha.querySelector('[data-avanco-acumulado]').textContent=percentual(Number(entrada.dataset.anterior)+avancou);
    linha.querySelector('[data-avanco-valor-acumulado]').textContent=u.brl((jaMedido+valor)/100);
    linha.querySelector('[data-avanco-saldo]').textContent=u.brl((Number(entrada.dataset.valor)-jaMedido-valor)/100);
   }
   painel.querySelector('#joseTotalAvanco').textContent=u.brl(total/100);
   painel.querySelector('[data-total-avanco]').textContent=percentual(contrato?total/contrato*100:0);
   painel.querySelector('[data-valor-avanco]').textContent=u.brl(total/100);
   painel.querySelector('[data-total-acumulado-avanco]').textContent=percentual(contrato?(totalAnterior+total)/contrato*100:0);
   painel.querySelector('[data-valor-acumulado-avanco]').textContent=u.brl((totalAnterior+total)/100);
   painel.querySelector('[data-saldo-avanco]').textContent=u.brl((contrato-totalAnterior-total)/100);
   painel.querySelector('#joseConferirAvanco').disabled=invalido||total<=0;
  };
  for(const entrada of entradas)entrada.oninput=()=>{
   edicaoAvanco.percentuais.set(Number(entrada.dataset.avancoItem),entrada.value);atualizar();
  };
  painel.querySelector('#joseCancelarAvanco').onclick=()=>{edicaoAvanco=null;escopoCivil();};
  painel.querySelector('#joseConferirAvanco').onclick=()=>{
   abrindoAvanco=true;
   try{$('medir')?.click();}finally{abrindoAvanco=false;}
   const campos=$('camposEditor');
   for(const etapa of etapas){
    const campo=campos.querySelector('[name="etapa_'+etapa.id+'"]');
    if(!campo)continue;
    campo.value=edicaoAvanco.percentuais.get(etapa.id)||'0';
    campo.parentElement.style.display='none';
   }
   const resumo=document.createElement('p');
   resumo.className='wide';resumo.textContent='Valor da medição: '+painel.querySelector('#joseTotalAvanco').textContent+'. Informe o período e o vencimento para salvar o rascunho.';
   campos.prepend(resumo);
   $('salvarEditor').textContent='Salvar rascunho';
  };
  atualizar();
 }
 function prepararNovaMedicaoImportada(evento){
  if(abrindoAvanco)return;
  const obra=u.obra;
  if(!abaImportada||!fonteImportada){
   if(obra.medicoes.some(m=>m.observacoes?.startsWith('Marco inicial importado da engenharia'))&&!obra.medicoes.some(m=>m.status==='RASCUNHO')){
    evento.stopImmediatePropagation();
    if(edicaoAvanco)$('joseEscopoCivil')?.querySelector('input[data-avanco-item]:not([disabled])')?.focus();
    else iniciarAvancoNaTabela();
   }
   return;
  }
  const marco=obra.medicoes.find(m=>m.status==='APROVADA'&&!m.lancamentoId&&m.observacoes==='Marco inicial importado da engenharia · Planilha #'+fonteImportada.id+' · Aba #'+abaImportada.indice);
  if(marco){
   evento.stopImmediatePropagation();
   iniciarAvancoNaTabela();
   return;
  }
  evento.stopImmediatePropagation();
  const total=abaImportada.itens.reduce((soma,i)=>soma+centavos(i.valor),0);
  if(obra.medicoes.length||total!==centavos(obra.valorContrato)){
   u.abrir('Usar os itens do Excel na medição',
    `<p class="wide">A obra selecionada é <strong>${u.esc(obra.nome)}</strong> e tem contrato de <strong>${u.brl(obra.valorContrato)}</strong>. O Excel soma <strong>${u.brl(total/100)}</strong>.</p>
    <p class="wide">Vincule a planilha à obra do cliente correto, com o mesmo valor contratado da aba e sem medições no ERP. Depois, volte a esta tela e clique em Nova medição.</p>`,null);
   return;
  }
  const fonte=fonteImportada,aba=abaImportada;
  const hoje=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const opcoes=[{id:'0',nome:'Ainda não houve medição realizada'},...aba.medicoes.filter(m=>!m.prevista&&(!m.data||m.data<=hoje)).map(m=>({
   id:m.numero,nome:m.titulo+(m.data?' · '+u.dia(m.data):''),
  }))];
  u.abrir('Usar os itens do Excel na medição',
   `<p class="wide"><strong>${u.esc(obra.nome)}</strong> · ${aba.itens.length} itens · ${u.brl(total/100)}</p>
   <p class="wide">Escolha a última medição realizada. O percentual já executado será a base da próxima medição. Essa vinculação registra o histórico sem gerar uma conta a receber.</p>`+
   u.select('medicao','Última medição realizada',opcoes)+
   u.campo('dataCorte','Data do histórico','date','',`max="${hoje}"`)+
   '<div id="joseExcedenteHistorico" class="wide" hidden></div>'+
   '<label class="wide"><input type="checkbox" required> Conferi a obra, o cliente e o histórico medido.</label>',
   async dados=>{
    if(u.obra?.id!==obra.id)throw Error('A obra selecionada mudou.');
    await u.api('/obras/planilhas/'+fonte.id+'/ativar-escopo','POST',{...dados,obraId:obra.id,aba:aba.indice});
    fonteImportada=null;abasImportadas=[];abaImportada=null;medicaoSelecionada=undefined;
    await u.detalhe();
    $('editor').close();
    iniciarAvancoNaTabela();
    return {continuar:true};
   });
  $('salvarEditor').textContent='Vincular itens e abrir medição';
  const escolha=$('camposEditor').querySelector('[name="medicao"]');
  const campoData=$('camposEditor').querySelector('[name="dataCorte"]');
  const ajustarData=()=>{
   const medicao=aba.medicoes.find(m=>m.numero===Number(escolha.value));
   campoData.value=medicao?.data||'';
   campoData.required=Boolean(escolha.value);
   campoData.readOnly=Boolean(medicao?.data);
   const modelo=montarEscopoImportado(aba);
   const excedentes=modelo.etapas.flatMap(etapa=>{
    const medido=modelo.medicoes.filter(m=>!m.prevista&&m.id<=Number(escolha.value)).reduce((s,m)=>s+Number(m.itens.find(i=>i.etapaId===etapa.id)?.valor||0),0);
    return centavos(medido)>centavos(etapa.valor)?[etapa.nome+' · '+u.brl(medido)+' medidos de '+u.brl(etapa.valor)]:[];
   });
   const alerta=$('joseExcedenteHistorico');
   alerta.hidden=!excedentes.length;
   alerta.innerHTML=excedentes.length?'<p>O histórico já ultrapassa o valor vigente destes itens. Eles ficam em 100%, e o valor histórico é preservado.</p><ul>'+
    excedentes.map(s=>'<li>'+u.esc(s)+'</li>').join('')+'</ul><label><input type="checkbox" name="confirmarExcedente" required> Conferi os excedentes da planilha.</label>':'';
  };
  escolha.addEventListener('change',ajustarData);
  ajustarData();
 }

 function escopoCivil(){
  if(fonteImportada?.obraId!==u.obra.id){fonteImportada=null;abasImportadas=[];abaImportada=null;}
  if(edicaoAvanco?.obraId!==u.obra.id||u.obra.medicoes.some(m=>m.status==='RASCUNHO'))edicaoAvanco=null;
  const importada=Boolean(abaImportada);
  const editando=!importada&&Boolean(edicaoAvanco);
  const obra=importada?montarEscopoImportado(abaImportada):u.obra;
  const emCentavos=importada?valor=>Number(valor)*100:centavos;
  const medicoes=obra.medicoes.filter(m=>m.status!=='CANCELADA')
   .sort(importada?(a,b)=>a.id-b.id:(a,b)=>String(a.fim).localeCompare(String(b.fim))||a.id-b.id);
  const selecionada=editando?medicoes.filter(m=>m.status==='APROVADA').at(-1):medicoes.find(m=>m.id===medicaoSelecionada)||medicoes.filter(m=>!m.prevista).at(-1)||medicoes.at(-1);
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
   return `<tr><td>${u.esc(etapa.codigo||indice+1)}</td><th scope="row">${u.esc(etapa.nome)}${etapa.descricao?`<small class="jose-escopo-descricao">${u.esc(etapa.descricao)}</small>`:''}</th><td>${u.brl(etapa.valor)}</td>
    <td>${percentual(contrato?valor/contrato*100:0)}</td>
    <td>${editando?`<input type="number" inputmode="decimal" data-avanco-item="${etapa.id}" data-anterior="${Number(item?.atual||0)}"
     data-valor="${valor}" data-acumulado="${acumulado}" min="0" max="${(100-Number(item?.atual||0)).toFixed(2)}" step="0.01"
     aria-label="Avanço de ${u.esc(etapa.nome)}" value="${u.esc(edicaoAvanco.percentuais.get(etapa.id)||'')}" placeholder="0" ${Number(item?.atual||0)>=100?'disabled':''}>`:percentual(Number(item?.atual||0)-Number(item?.anterior||0))}</td>
    <td data-avanco-acumulado>${percentual(Number(item?.atual||0))}</td><td data-avanco-valor>${u.brl(item?.valor)}</td>
    <td data-avanco-valor-acumulado>${u.brl(acumulado/100)}</td><td data-avanco-saldo>${u.brl((valor-acumulado)/100)}</td></tr>`;
  });
  const totalAcumulado=[...acumulados.values()].reduce((soma,valor)=>soma+valor,0);
  const painel=document.createElement('section');
  painel.id='joseEscopoCivil';
  painel.innerHTML=`<div class="jose-escopo-cabecalho">
   <div><h3>Escopo de mão de obra civil</h3><p>Valor total da obra <strong>${u.brl(obra.valorContrato)}</strong></p></div>
   ${editando?'<p>Digite o avanço novo em cada item. Os valores mudam na hora.</p>':'<label>Origem dos dados<select id="joseEscopoFonte" disabled><option value="">Medições do ERP</option></select></label>'}
   ${abasImportadas.length>1?`<label>Aba<select id="joseEscopoAba">${abasImportadas.map(a=>`<option value="${a.indice}" ${a===abaImportada?'selected':''}>${u.esc(a.nome)}</option>`).join('')}</select></label>`:''}
   ${importada&&u.admin?'<button type="button" class="jose-obra-secondary" id="joseTransferirPlanilha">Vincular à obra correta</button>':''}
   ${!editando&&medicoes.length?`<label>Medição<select id="joseEscopoMedicao">${medicoes.map((m,i)=>
    `<option value="${m.id}" ${m===selecionada?'selected':''}>${u.esc(m.titulo||('Medição '+String(i+1).padStart(2,'0')))} · ${m.fim?u.dia(m.fim):'Sem data'}${m.status==='RASCUNHO'?' · Rascunho':m.observacoes?.startsWith('Marco inicial importado da engenharia')?' · Histórico importado':''}</option>`).join('')}</select></label>`:''}
   </div>
   ${editando?'<div class="jose-escopo-recebimento"><strong>Valor desta medição <span id="joseTotalAvanco"></span></strong><button type="button" id="joseConferirAvanco">Conferir e salvar</button><button type="button" id="joseCancelarAvanco">Cancelar edição</button></div>':''}
   <div class="obra-table-wrap">${u.tabela(['Item','Etapa / descrição','Valor da etapa','% do contrato',editando?'Avanço nesta medição (%)':'% na medição','% acumulado','Valor medido','Valor acumulado','Saldo a medir'],linhas)
    .replace('</table>',`<tfoot><tr><th colspan="2" scope="row">Total da obra</th><td>${u.brl(obra.valorContrato)}</td>
    <td>${percentual(contrato?100:0)}</td><td data-total-avanco>${percentual(contrato?emCentavos(selecionada?.valor||0)/contrato*100:0)}</td>
    <td data-total-acumulado-avanco>${percentual(contrato?totalAcumulado/contrato*100:0)}</td><td data-valor-avanco>${u.brl(selecionada?.valor)}</td>
    <td data-valor-acumulado-avanco>${u.brl(totalAcumulado/100)}</td><td data-saldo-avanco>${u.brl((contrato-totalAcumulado)/100)}</td></tr></tfoot></table>`)}</div>
   ${editando?'':importada?`<div class="jose-escopo-recebimento">Planilha importada · Clique em <strong>Nova medição</strong> para lançar avanço.
   ${obra.etapas.some(e=>(acumulados.get(e.id)||0)-centavos(e.valor)>0.5)?'<strong>Confira as etapas com valor acumulado acima do valor vigente.</strong>':''}</div>`:selecionada?.observacoes?.startsWith('Marco inicial importado da engenharia')?'<div class="jose-escopo-recebimento">Histórico de execução importado da planilha.</div>':selecionada?`<div class="jose-escopo-recebimento"><span>Recebido nesta medição <strong>${u.brl(recebido/100)}</strong></span>
   ${lancamento?`<span>Saldo a receber <strong>${u.brl(saldo/100)}</strong></span>`:''}
   ${u.fin&&saldo>0?'<button type="button" id="joseReceberMedicao">Registrar recebimento</button>':''}</div>`:''}`;
  if($('joseEscopoCivil'))$('joseEscopoCivil').replaceWith(painel);
  else $('consultaObras')?.before(painel);
  if(editando){configurarAvanco(painel,obra.etapas,contrato);return;}
  listarImportadas(painel,u.obra.id).catch(erro=>{
   if(painel.isConnected)painel.querySelector('#joseEscopoFonte').options[0].text='Medições do ERP · Planilhas indisponíveis';
  });
  painel.querySelector('#joseTransferirPlanilha')?.addEventListener('click',vincularPlanilhaOutraObra);
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
   $('medir')?.addEventListener('click',prepararNovaMedicaoImportada,true);
   if(u.admin&&!$('joseImportarMedicao')){
    const botao=document.createElement('button');
    botao.type='button';botao.id='joseImportarMedicao';botao.textContent='Importar Excel';
    botao.onclick=importarNoEscopo;acoes.prepend(botao);
   }
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
