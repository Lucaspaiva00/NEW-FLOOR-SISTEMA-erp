/* Layout de propostas do Cláudio: ativa somente no tenant New Floor confirmado. */
window.montarAbasPropostasNewFloor = () => {
 const nomes=['Dados','Equipe e prazos','Itens e valores','Condições','Observações','Controle'];
 const criar=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
 function novoPainel(titulo){
  const p=criar('section','nf-proposal-panel'),card=criar('div','form-section');
  card.append(criar('h3','section-title',titulo));const grid=criar('div','row g-3');card.append(grid);p.append(card);return {p,grid};
 }
 function mover(ids,destino){for(const id of ids){const f=document.getElementById(id);const wrap=f?.closest('.form-field,.mb-3');if(wrap){const plano=/condicoespagamento/i.test(id)&&wrap.nextElementSibling?.querySelector('[data-plano]')?wrap.nextElementSibling:null;destino.append(wrap);if(plano)destino.append(plano);}}}
 for(const [formId,modalId,novo] of [['formNovaProposta','modalNovaProposta',true],['formEditarProposta','modalProposta',false]]){
  const form=document.getElementById(formId),modal=document.getElementById(modalId);
  if(!form||!modal||form.dataset.newfloorAbas)return;
  form.dataset.newfloorAbas='true';modal.classList.add('nf-proposal-modal');
  modal.querySelector('.modal-title').textContent=novo?'Nova proposta':'Gerenciar proposta';
  const sections=[...form.querySelectorAll(novo?':scope > .form-step':':scope > .form-section')];
  if(sections.length!==(novo?4:5))continue;
  const condicoes=novoPainel('Condições comerciais');
  let panels;
  if(novo){
   const controle=novoPainel('Controle do cliente');
   mover(['formaPagamento','condicoesPagamento'],condicoes.grid);
   mover(['aprovadoCliente','enviadoEmail','enviadoWhatsapp','visualizada','motivoRecusa'],controle.grid);
   panels=[sections[0],sections[1],sections[2],condicoes.p,sections[3],controle.p];
   // Os campos permanecem nos mesmos formulários e conservam todos os listeners.
   for(const panel of sections){panel.classList.remove('form-step','active');panel.classList.add('nf-proposal-panel');}
   const title=sections[3].querySelector('.section-title');if(title)title.textContent='Observações';
   const subtitle=sections[3].querySelector('.section-subtitle');if(subtitle)subtitle.textContent='Textos comerciais e anotações internas.';
   const footer=modal.querySelector('.modal-footer');
   const cancelar=criar('button','btn nf-cancelar','Cancelar');cancelar.type='button';cancelar.dataset.bsDismiss='modal';footer.prepend(cancelar);
   document.getElementById('btnSalvarNovaProposta').classList.remove('d-none');
  }else{
   mover(['editarFormaPagamento','editarCondicoesPagamento','editarTemplateId'],condicoes.grid);
   const controle=sections[4];mover(['editarMotivoRecusa'],controle.querySelector('.row'));
   mover(['editarFrete'],sections[2]);
   panels=[sections[0],sections[1],sections[2],condicoes.p,sections[3],controle];
   panels.forEach(p=>p.classList.add('nf-proposal-panel'));
   const title=sections[1].querySelector('.section-title');if(title)title.textContent='Equipe e prazos';
   const obs=sections[3].querySelector('.section-title');if(obs)obs.textContent='Observações';
   const footer=form.querySelector('.proposta-editar-footer');footer.classList.add('nf-edit-actions');
   const cancelar=criar('button','btn nf-cancelar','Cancelar');cancelar.type='button';cancelar.dataset.bsDismiss='modal';footer.querySelector('.row').prepend(cancelar);
  }
  const anchor=form.querySelector('.proposta-editar-footer');for(const p of panels)form.insertBefore(p,anchor);
  const nav=criar('nav','nf-proposal-tabs');nav.setAttribute('role','tablist');nav.setAttribute('aria-label',novo?'Abas da nova proposta':'Abas da proposta');
  const old=novo?document.getElementById('stepsNavNovaProposta'):null;
  if(old){nav.id=old.id;old.replaceWith(nav);}else form.before(nav);
  const botoes=[];
  function ativar(index,foco=false){
   panels.forEach((p,i)=>{p.hidden=i!==index;botoes[i].classList.toggle('active',i===index);botoes[i].setAttribute('aria-selected',String(i===index));botoes[i].tabIndex=i===index?0:-1;});
   modal.querySelector('.modal-body').scrollTop=0;
   if(foco)botoes[index].focus();
  }
  nomes.forEach((nome,i)=>{
   const b=criar('button','nf-proposal-tab step-pill',nome);b.type='button';b.id=formId+'_aba_'+i;b.setAttribute('role','tab');b.setAttribute('aria-controls',formId+'_painel_'+i);
   const p=panels[i];p.id=formId+'_painel_'+i;p.setAttribute('role','tabpanel');p.setAttribute('aria-labelledby',b.id);
   b.onclick=()=>ativar(i);
   b.onkeydown=e=>{let target;if(e.key==='ArrowRight')target=(i+1)%nomes.length;if(e.key==='ArrowLeft')target=(i+nomes.length-1)%nomes.length;if(e.key==='Home')target=0;if(e.key==='End')target=nomes.length-1;if(target!==undefined){e.preventDefault();ativar(target,true);}};
   nav.append(b);botoes.push(b);
  });
  // Expõe o campo inválido antes da validação nativa tentar focá-lo.
  form.addEventListener('invalid',e=>{const i=panels.findIndex(p=>p.contains(e.target));if(i>=0)ativar(i);},true);
  modal.addEventListener('show.bs.modal',()=>ativar(0));ativar(0);
 }
};
