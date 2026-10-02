/* Formulários por assunto, habilitados somente no perfil com composição de custos. */
(() => {
  let sequence = 0;
  const title = node => node.querySelector('h2,h3,.section-title,.fiscal-section-title')?.textContent.trim();
  const fieldId = node => node.querySelector('input,select,textarea')?.id.toLowerCase() || '';
  function groupsFor(form, body) {
    if (form.querySelector('.form-step')) return []; // Clientes já possuem abas e validação próprias.
    const budgets = [...form.querySelectorAll(':scope > .budget-section')];
    if (budgets.length) return budgets.map((node, i) => ({label:['Dados','Materiais','Mão de obra','Valores','Condições'][i], nodes:[node]}));
    if (form.id === 'formMaterial') {
      const sections = ['identificacao','organizacao','fiscal','quantidades'].map(id => form.querySelector('#'+id));
      const side = [...form.querySelectorAll('.material-side > section')];
      return [
        {label:'Identificação',nodes:[sections[0],side[0]]},
        {label:'Organização',nodes:[sections[1]]},
        {label:'Fiscal',nodes:[sections[2]]},
        {label:'Quantidades',nodes:[sections[3],form.querySelector('.material-note')]},
        {label:'Preços',nodes:[form.querySelector('.price-section')]},
        {label:'Fotos e observações',nodes:side.slice(1)}
      ];
    }
    const sections = [...form.querySelectorAll(':scope > .form-section')];
    if (sections.length > 1) return sections.map(node => ({label:title(node)||'Dados',nodes:[node]}));
    const headings = [...body.children].filter(node => node.matches('.fiscal-section-title'));
    if (headings.length > 1) return headings.map(node => {
      const nodes=[node]; let next=node.nextElementSibling;
      while(next && !next.matches('.fiscal-section-title')) {nodes.push(next);next=next.nextElementSibling;}
      return {label:node.textContent.trim(),nodes};
    });
    // Formulários menores: preservar cada coluna e seus listeners ao agrupar os campos.
    const row = form.querySelector('.row');
    if (!row || row.children.length < 4) return [];
    const group = new Map();
    for (const node of [...row.children]) {
      const id=fieldId(node);
      let label='Dados';
      if (/formTemplate/i.test(form.id)) label=/cor/.test(id)?'Aparência':/cabecalho|rodape|texto/.test(id)?'Textos':'Dados';
      else if (/Usuario/i.test(form.id)) label=/senha|cargo|perfil|role|empresa|ativo/.test(id)?'Acesso':'Dados';
      else if (/Vendedor/i.test(form.id)) label=/email|telefone|celular|endereco/.test(id)?'Contato':'Dados';
      else if (/Lancamento/i.test(form.id)) label=/parcela|intervalo|forma|conta|vencimento/.test(id)?'Pagamento':/observacoes|documento/.test(id)?'Complementos':'Dados';
      else if (/Agenda/i.test(form.id)) label=/descricao|observ|lembrete|notif/.test(id)?'Detalhes':'Dados';
      else continue;
      if (!group.has(label)) group.set(label,[]);
      group.get(label).push(node);
    }
    if (group.size < 2) return [];
    return [...group].map(([label,nodes]) => {
      const wrapper=document.createElement('div'); wrapper.className=row.className;
      nodes.forEach(node=>wrapper.append(node)); return {label,nodes:[wrapper]};
    });
  }
  function prepare(modal) {
    if (!window.__configuracaoSistema?.composicaoCustos || modal.dataset.subjectTabs) return;
    const body=modal.querySelector('.modal-body'), form=modal.querySelector('form');
    if (!body || !form) return;
    const groups=groupsFor(form,body).filter(group=>group.nodes.some(Boolean));
    if (groups.length < 2) return;
    modal.dataset.subjectTabs='true'; modal.classList.add('subject-tabs-modal');
    const host=body.contains(form)?form:body;
    const nav=document.createElement('div'); nav.className='subject-tabs'; nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Seções do formulário');
    const panels=document.createElement('div'); panels.className='subject-tab-panels';
    host.prepend(nav);nav.after(panels);
    const buttons=[], panes=[];
    function activate(index, focus=false) {
      buttons.forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;panes[i].hidden=i!==index;});
      if(focus) buttons[index].focus();
    }
    groups.forEach((group,index)=>{
      const key='subject-tab-'+(++sequence), button=document.createElement('button'), panel=document.createElement('section');
      button.type='button';button.id=key;button.textContent=group.label;button.setAttribute('role','tab');button.setAttribute('aria-controls',key+'-panel');
      panel.id=key+'-panel';panel.className='subject-tab-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',key);
      group.nodes.filter(Boolean).forEach(node=>panel.append(node));
      button.addEventListener('click',()=>activate(index));buttons.push(button);panes.push(panel);nav.append(button);panels.append(panel);
    });
    nav.addEventListener('keydown',event=>{
      const index=buttons.indexOf(document.activeElement);if(index<0)return;
      const next=event.key==='ArrowRight'?(index+1)%buttons.length:event.key==='ArrowLeft'?(index+buttons.length-1)%buttons.length:event.key==='Home'?0:event.key==='End'?buttons.length-1:null;
      if(next!==null){event.preventDefault();activate(next,true);}
    });
    let pending=false, reporting=false;
    form.addEventListener('invalid',event=>{
      if(reporting)return;
      event.preventDefault();if(pending)return;
      const index=panes.findIndex(panel=>panel.contains(event.target));if(index<0)return;
      pending=true;activate(index);
      setTimeout(()=>{pending=false;event.target.focus();reporting=true;try{event.target.reportValidity();}finally{reporting=false;}},0);
    },true);
    modal.addEventListener('show.bs.modal',()=>activate(0));
    activate(0);
    // Remove apenas os containers de layout que ficaram vazios, sem alterar campos.
    form.querySelectorAll('.material-editor,.editor-sections,.material-side').forEach(node=>{if(!node.querySelector('input,select,textarea,section'))node.remove();});
    const save=form.querySelector('[data-orcamento-id="salvarOrcamento"]');if(save)save.textContent='Salvar proposta';
  }
  document.querySelectorAll('.modal').forEach(prepare);
  document.addEventListener('show.bs.modal',event=>prepare(event.target));
  new MutationObserver(records=>{
    for(const record of records) for(const node of record.addedNodes) if(node.nodeType===1){if(node.matches('.modal'))prepare(node);node.querySelectorAll('.modal').forEach(prepare);}
  }).observe(document.body,{childList:true,subtree:true});
})();
