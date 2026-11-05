(() => {
 const u=window.obrasUI, $=id=>document.getElementById(id);
 if(!u)return;
 u.api('/empresas/me').then(empresa=>{
  if(Number(empresa.empresaid)!==5||empresa.slug!=='construarty')return;
  document.querySelector('[data-tab="cronograma"]').textContent='Mão de obra';
  $('equipe').textContent='Cadastrar equipe';
  $('fechar').textContent='Enviar diárias ao financeiro';
  const base=u.render;
  u.render=()=>{
   base();
   if(!u.obra||u.tab!=='cronograma')return;
   const head=$('conteudo').querySelector('h2');if(head)head.textContent='Mão de obra · '+u.obra.nome;
   const explanation=$('conteudo').querySelector(':scope > p');
   if(explanation)explanation.textContent='Selecione a equipe e os dias trabalhados. O custo é calculado pelas diárias cadastradas.';
   const old=$('apontar'), button=old?.cloneNode(true);if(old)old.replaceWith(button);
   if(button){button.textContent='Lançar equipe / período';button.onclick=lancar;}
   const summary=document.createElement('div');summary.className='jose-mao-resumo';
   summary.textContent='Total de mão de obra desta obra: '+u.brl(u.obra.resumo.custoMaoObra);
   $('conteudo').querySelector('.section-head')?.after(summary);
  };
  function lancar(){
   const obra=u.obra, pessoas=u.pessoas.filter(c=>c.ativo), hoje=new Date().toLocaleDateString('en-CA');
   if(!pessoas.length){u.abrirColaborador();return;}
   u.abrir('Lançar mão de obra · '+obra.nome,
    u.campo('inicio','Primeiro dia','date',hoje,'required')+u.campo('fim','Último dia','date',hoje,'required')+
    '<label class="wide jose-check"><input id="joseUteis" type="checkbox" checked> Somente segunda a sexta (desmarque para incluir sábado e domingo)</label>'+
    '<fieldset class="wide jose-equipe"><legend>Quem trabalhou?</legend>'+pessoas.map(c=>'<label class="jose-check"><input type="checkbox" data-jose-pessoa="'+c.id+'"> '+u.esc(c.nome)+' · '+u.brl(c.diaria)+'/dia</label>').join('')+'</fieldset>'+
    '<label>Jornada<select name="fracao"><option value="1">Dia inteiro</option><option value="0.5">Meio dia</option></select></label>'+
    u.campo('observacoes','Observação (opcional)')+'<p id="joseTotalEquipe" class="wide" role="status"></p>',
    async d=>{
     const ids=[...document.querySelectorAll('[data-jose-pessoa]:checked')].map(c=>Number(c.dataset.josePessoa));
     if(!ids.length)throw Error('Selecione quem trabalhou.');
     const r=await u.api('/obras/apontamentos','POST',{...d,obraId:obra.id,periodo:true,colaboradorIds:ids,somenteUteis:$('joseUteis').checked});
     $('mensagem').textContent=r.registros+' diárias registradas · '+u.brl(r.total);return r;
    });
   const atualizar=()=>{
    if(!$('joseTotalEquipe'))return;
    const f=$('formEditor'), inicio=new Date(f.elements.inicio.value+'T00:00:00Z'), fim=new Date(f.elements.fim.value+'T00:00:00Z');
    let dias=0;
    if(Number.isFinite(+inicio)&&Number.isFinite(+fim)&&fim>=inicio&&(fim-inicio)/86400000<=30)
     for(let d=new Date(inicio);d<=fim;d.setUTCDate(d.getUTCDate()+1))if(!$('joseUteis').checked||![0,6].includes(d.getUTCDay()))dias++;
    const ids=[...document.querySelectorAll('[data-jose-pessoa]:checked')].map(c=>Number(c.dataset.josePessoa));
    const total=pessoas.filter(c=>ids.includes(c.id)).reduce((s,c)=>s+Math.round(Number(c.diaria)*Number(f.elements.fracao.value)*100)/100,0)*dias;
    $('joseTotalEquipe').textContent=dias+' dias × '+ids.length+' pessoas · Total previsto: '+u.brl(total)+'. Confira os dias efetivamente trabalhados antes de salvar.';
   };
   $('camposEditor').oninput=atualizar;atualizar();
  }
  $('fechar').onclick=()=>{
   const obra=u.obra;if(!obra){u.erro(Error('Selecione uma obra.'));return;}
   u.abrir('Enviar diárias ao financeiro · '+obra.nome,
    '<p class="wide">Gera contas a pagar das diárias pendentes somente desta obra.</p>'+
    u.campo('inicio','Primeiro dia','date','','required')+u.campo('fim','Último dia','date','','required')+u.campo('vencimento','Vencimento','date','','required'),
    d=>u.api('/obras/fechamentos','POST',{...d,obraId:obra.id}));
  };
  u.render();
 }).catch(u.erro);
})();
