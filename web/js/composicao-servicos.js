/* Composição interna por serviço, exclusiva do perfil SBA. */
(() => {
 const round=n=>Math.round((n+Number.EPSILON)*100)/100;
 const money=n=>Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
 function calcular(s){
  const custoMateriais=round(s.materiais.reduce((n,m)=>n+m.quantidade*m.custoUnitario,0));
  const custoMaoObra=round(s.maoObra.reduce((n,m)=>n+m.dias*m.pessoas*m.horasDia*m.valorHora,0));
  const custoTotal=round(custoMateriais+custoMaoObra);
  const valido=s.margem>=0&&s.margem<1&&s.imposto>=0&&s.imposto<=1&&s.quantidade>0;
  const valorUnitario=s.modoPreco==='MANUAL'?s.valorUnitario:valido?round(custoTotal/(1-s.margem)/s.quantidade):NaN;
  const subtotal=round(s.quantidade*valorUnitario),valorImposto=round(subtotal*s.imposto);
  return {...s,custoMateriais,custoMaoObra,custoTotal,valorUnitario,subtotal,valorImposto,lucro:round(subtotal-valorImposto-custoTotal)};
 }
 window.calcularServicoSba=calcular;
 window.criarComposicaoServicos=({host,catalogo,fornecedores,onChange})=>{
  let cards=[];
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  function campo(parent,key,label,value,type='text'){
   const wrap=el('label','',label),f=el(type==='textarea'?'textarea':'input');
   if(type!=='textarea')f.type=type;
   f.dataset.campo=key;f.value=value??'';f.setAttribute('aria-label',label);
   if(type==='number'){f.min=0;f.step='any';}
   if(key==='descricao')f.maxLength=1000;if(key==='detalhes')f.maxLength=2000;
   wrap.append(f);parent.append(wrap);return f;
  }
  function lerCampos(parent){return Object.fromEntries([...parent.querySelectorAll('[data-campo]')].map(f=>[f.dataset.campo,f.type==='number'?Number(f.value):f.value]));}
  function lerCard(card){
   const s=lerCampos(card.dados),preco=lerCampos(card.precos);
   return calcular({...s,...preco,margem:preco.margem/100,imposto:preco.imposto/100,
    materiais:[...card.materiais.children].map(r=>({...lerCampos(r),...(r.dataset.catalogoId?{servicoId:Number(r.dataset.catalogoId)}:{})})),
    maoObra:[...card.maoObra.children].map(lerCampos)});
  }
  function botao(parent,text,fn){const b=el('button','',text);b.type='button';b.onclick=fn;parent.append(b);return b;}
  function linha(card,tipo,m={}){
   const list=card[tipo];if(list.children.length>=(tipo==='materiais'?200:100))return;
   const r=el('div','sba-row '+tipo);
   const specs=tipo==='materiais'?[['descricao','Descrição','text',''],['especificacao','Especificação','text',''],['quantidade','Quantidade','number',1],['custoUnitario','Custo unitário (R$)','number',0]]:[['descricao','Atividade','text',''],['dias','Dias','number',1],['pessoas','Pessoas','number',1],['horasDia','Horas por dia','number',8],['valorHora','Valor por hora (R$)','number',37.5]];
   if(tipo==='materiais'){
    if(m.servicoId)r.dataset.catalogoId=m.servicoId;
    const wrap=el('label','','Catálogo'),select=el('select');select.setAttribute('aria-label','Material do catálogo');
    select.add(new Option('Selecione um material',''));catalogo().forEach(x=>select.add(new Option(x.nome,x.servicoid)));
    select.value=m.servicoId||'';wrap.append(select);r.append(wrap);
    select.onchange=()=>{const item=catalogo().find(x=>x.servicoid===Number(select.value));if(!item){delete r.dataset.catalogoId;atualizar();return;}
     r.dataset.catalogoId=item.servicoid;
     r.querySelector('[data-campo="descricao"]').value=item.nome;
     r.querySelector('[data-campo="especificacao"]').value=item.dadosMaterial?.especificacao||item.descricao||'';
     r.querySelector('[data-campo="custoUnitario"]').value=item.custo??item.dadosMaterial?.custo??0;atualizar();};
   }
   specs.forEach(([key,label,type,value])=>campo(r,key,label,m[key]??value,type));
   const subtotal=el('output','service-line-total');r.append(subtotal);
   botao(r,'Remover',()=>{r.remove();atualizar();});list.append(r);
  }
  const container=el('div','service-composition-list'),summary=el('div','service-comparison');host.replaceChildren(container,summary);
  function adicionar(s={}){
   if(cards.length>=100)return;
   const article=el('article','service-composition'),header=el('div','service-composition-heading');
   const titulo=el('strong','','Novo serviço');header.append(titulo);
   const card={article,titulo,dados:el('div','sba-grid'),materiais:el('div'),maoObra:el('div'),precos:el('div','sba-grid'),resultado:el('div','service-results'),fornecedor:el('p','budget-note')};
   botao(header,'Remover serviço',()=>{
    if((card.materiais.children.length||card.maoObra.children.length)&&!window.confirm('Remover este serviço e todos os seus materiais e mão de obra?'))return;
    cards=cards.filter(c=>c!==card);article.remove();atualizar();
   });article.append(header);
   const tabs=el('div','service-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Composição do serviço');article.append(tabs);
   const panels=[];
   for(const [index,nome] of ['Serviço','Materiais','Mão de obra','Valores'].entries()){
    const panel=el('section','service-panel');panel.hidden=index!==0;panel.setAttribute('role','tabpanel');
    const tab=botao(tabs,nome,()=>{panels.forEach((p,i)=>{p.hidden=i!==index;tabs.children[i].setAttribute('aria-selected',String(i===index));});});
    tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(index===0));
    panels.push(panel);article.append(panel);
   }
   [['descricao','Serviço / descrição',s.descricao,'text'],['detalhes','Detalhes (opcional)',s.detalhes,'textarea'],['quantidade','Quantidade',s.quantidade??1,'number'],['unidade','Unidade',s.unidade??'UN','text']].forEach(([key,label,value,type])=>campo(card.dados,key,label,value,type));
   panels[0].append(card.dados);
   panels[1].append(el('p','budget-note','Informe os materiais necessários para executar a quantidade total deste serviço.'),card.materiais);
   botao(panels[1],'+ Adicionar material',()=>{linha(card,'materiais');atualizar();});panels[1].append(card.fornecedor);
   panels[2].append(el('p','budget-note','Informe a equipe e o tempo para executar a quantidade total deste serviço.'),card.maoObra);
   botao(panels[2],'+ Adicionar mão de obra',()=>{linha(card,'maoObra');atualizar();});
   const modeWrap=el('label','','Cálculo do preço'),mode=el('select');mode.dataset.campo='modoPreco';mode.setAttribute('aria-label','Cálculo do preço');
   mode.add(new Option('Calcular pelo custo e margem','AUTOMATICO'));mode.add(new Option('Informar valor de venda','MANUAL'));mode.value=s.modoPreco||'AUTOMATICO';modeWrap.append(mode);card.precos.append(modeWrap);
   campo(card.precos,'margem','Margem (%)',(s.margem??.6)*100,'number');campo(card.precos,'imposto','Imposto estimado (%)',(s.imposto??.18)*100,'number');
   campo(card.precos,'valorUnitario','Valor unitário de venda (R$)',s.valorUnitario??0,'number');
   panels[3].append(card.precos,el('p','budget-note','Preço automático = custo ÷ (1 − margem), dividido pela quantidade. O imposto estimado é descontado do resultado; não altera a nota fiscal.'));
   article.append(card.resultado);container.append(article);cards.push(card);
   (s.materiais||[]).forEach(m=>linha(card,'materiais',m));(s.maoObra||[]).forEach(m=>linha(card,'maoObra',m));
   article.addEventListener('input',atualizar);article.addEventListener('change',atualizar);
  }
  function ler(){const servicos=cards.map(lerCard);return {versao:2,servicos,materiais:servicos.flatMap(s=>s.materiais),maoObra:servicos.flatMap(s=>s.maoObra)};}
  function atualizar(){
   const c=ler(),totais={custoMateriais:0,custoMaoObra:0,custoTotal:0,subtotal:0,valorImposto:0,lucro:0};
   cards.forEach((card,index)=>{
    const s=c.servicos[index];card.titulo.textContent=s.descricao||`Serviço ${index+1}`;
    const unit=card.precos.querySelector('[data-campo="valorUnitario"]');unit.readOnly=s.modoPreco!=='MANUAL';
    if(unit.readOnly)unit.value=Number.isFinite(s.valorUnitario)?s.valorUnitario:0;
    card.precos.querySelector('[data-campo="margem"]').disabled=s.modoPreco==='MANUAL';
    card.resultado.replaceChildren();
    for(const [key,label] of [['custoMateriais','Materiais'],['custoMaoObra','Mão de obra'],['custoTotal','Custo total'],['subtotal','Venda'],['valorImposto','Imposto estimado'],['lucro','Lucro estimado']]){
     const cell=el('div'),caption=el('span','',label),value=el('strong','',money(s[key]));if(s[key]<0)cell.className='budget-loss';cell.append(caption,value);card.resultado.append(cell);totais[key]=round(totais[key]+s[key]);
    }
    for(const tipo of ['materiais','maoObra'])[...card[tipo].children].forEach((r,i)=>{const m=s[tipo][i];r.querySelector('output').textContent=money(round(tipo==='materiais'?m.quantidade*m.custoUnitario:m.dias*m.pessoas*m.horasDia*m.valorHora));});
    const ids=new Set(s.materiais.map(m=>catalogo().find(x=>x.servicoid===m.servicoId)?.dadosMaterial?.fornecedorId).filter(Boolean));
    card.fornecedor.textContent=fornecedores().filter(f=>ids.has(f.fornecedorid)).map(f=>[f.nome,f.formaPagamento,f.condicoesPagamento].filter(Boolean).join(' · ')).join(' | ');
   });
   const table=el('table'),thead=el('thead'),head=el('tr');['Serviço','Materiais','Mão de obra','Custo total','Venda','Imposto','Lucro'].forEach(t=>head.append(el('th','',t)));thead.append(head);table.append(thead);
   const tbody=el('tbody');for(const s of [...c.servicos,{descricao:'TOTAL DA PROPOSTA',...totais}]){
    const tr=el('tr');tr.append(el('th','',s.descricao||'Sem descrição'));for(const k of ['custoMateriais','custoMaoObra','custoTotal','subtotal','valorImposto','lucro'])tr.append(el('td','',money(s[k])));tbody.append(tr);
   }table.append(tbody);summary.replaceChildren(el('h3','','Resumo de todos os serviços'),table);
   onChange();
  }
  return {ler,carregar(servicos){cards=[];container.replaceChildren();servicos.forEach(adicionar);atualizar();},adicionar(){adicionar();atualizar();}};
 };
})();
