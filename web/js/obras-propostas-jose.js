(async()=>{
 const u=window.obrasUI,$=id=>document.getElementById(id);if(!u||!u.admin)return;
 try{const empresa=await u.api('/empresas/me');if(empresa.empresaid!==5||empresa.slug!=='construarty')return;
 const button=document.createElement('button');button.id='obraDaProposta';button.textContent='Criar obra da proposta';button.type='button';$('novaObra').before(button);
 async function abrir(id){
  try{const propostas=await u.api('/obras/propostas-disponiveis');
   if(!propostas.length){u.abrir('Criar obra da proposta','<p class="wide">Envie primeiro a proposta em PDF no menu Propostas.</p>',null);return;}
   let selecionada=null;
   u.abrir('Criar obra da proposta','<label class="wide">Proposta<select id="obraProposta" required><option value="">Selecione a proposta</option>'+propostas.map(p=>'<option value="'+p.propostaId+'">'+u.esc(p.numero+' · '+p.nome+' · '+u.brl(p.valorContrato)+(p.obra?' · já vinculada':''))+'</option>').join('')+'</select></label><div id="obraPropostaDados" class="wide"></div>',async d=>{
    if(!selecionada)throw Error('Selecione uma proposta.');
    if(selecionada.obra){await u.carregar();$('obraSelecionada').value=String(selecionada.obra.id);await u.detalhe();return;}
    const nova=await u.api('/obras/a-partir-proposta','POST',{propostaId:selecionada.propostaId,inicio:d.inicio,prazo:d.prazo,endereco:d.endereco,responsavel:d.responsavel});
    await u.carregar();$('obraSelecionada').value=String(nova.id);await u.detalhe();
   });
   $('salvarEditor').disabled=true;
   $('editor')?.addEventListener('close',()=>{$('salvarEditor').disabled=false;},{once:true});
   const mostrar=()=>{selecionada=propostas.find(p=>p.propostaId===Number($('obraProposta').value));$('salvarEditor').disabled=!selecionada;
    if(!selecionada){$('obraPropostaDados').innerHTML='';return;}
    const p=selecionada;$('salvarEditor').textContent=p.obra?'Abrir obra vinculada':'Criar obra vinculada';
    if(p.obra){$('obraPropostaDados').innerHTML='<p>Esta proposta já está vinculada à obra <strong>'+u.esc(p.obra.nome)+'</strong>.</p>';return;}
    const hoje=new Date(),date=[hoje.getFullYear(),String(hoje.getMonth()+1).padStart(2,'0'),String(hoje.getDate()).padStart(2,'0')].join('-');
    $('obraPropostaDados').innerHTML='<div class="obra-proposta-summary"><h3>'+u.esc(p.nome)+'</h3><p>'+u.esc(p.clienteNome||'')+' · <strong>'+u.brl(p.valorContrato)+'</strong></p></div><div class="obra-proposta-fields">'+u.campo('inicio','Início da obra','date',date,'required')+u.campo('prazo','Prazo','date')+u.campo('endereco','Endereço real da obra','text',p.endereco,'required')+u.campo('responsavel','Responsável','text',p.responsavel,'required')+'</div><p>Confira o endereço da execução. Nome, cliente e valor serão aproveitados da proposta.</p>'+u.tabela(['Etapa da proposta','Valor contratado'],p.etapas.map(e=>'<tr><td>'+u.esc(e.nome)+'</td><td>'+u.brl(e.valor)+'</td></tr>'))+'<p>Os custos, as medições e os recebimentos serão acompanhados nesta obra. Criar a obra não gera cobrança.</p>';
   };
   $('obraProposta').onchange=mostrar;if(id){$('obraProposta').value=String(id);mostrar();}
  }catch(e){u.erro(e);}
 }
 button.onclick=()=>abrir();
 const proposta=Number(new URLSearchParams(location.search).get('proposta'));
 if(Number.isSafeInteger(proposta)&&proposta>0)await abrir(proposta);
 }catch(e){u.erro(e);}
})();
