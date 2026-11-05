/* Exclusivo da empresa 5 / Construarty. O Kanban e as transições existentes são mantidos. */
(async()=>{
 const sessao=JSON.parse(localStorage.getItem('usuarioLogado')||'null'),jwt=sessao?.token;
 if(!jwt)return;
 const headers={Authorization:'Bearer '+jwt,'Content-Type':'application/json'};
 let empresa;
 try{const r=await fetch(API_URL+'/empresas/me',{headers});if(!r.ok)return;empresa=await r.json();}catch{return;}
 if(empresa.empresaid!==5||empresa.slug!=='construarty'||empresa.configuracaoSistema?.modulos?.propostas!==true)return;
 document.body.classList.add('jose-pdf-propostas');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dinheiro=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const admin=['ADMIN','SUPER_ADMIN'].includes(sessao?.usuario?.role||sessao?.role);
 async function api(path,method='GET',body){const r=await fetch(API_URL+path,{method,headers,body:body?JSON.stringify(body):undefined}),d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível concluir.');return d;}
 const dialog=document.createElement('dialog');dialog.className='jose-pdf-dialog';dialog.innerHTML='<header><div><small>PROPOSTAS · CONSTRUARTY</small><h2 id="josePdfTitulo">Adicionar proposta em PDF</h2></div><button type="button" data-jose-fechar aria-label="Fechar">×</button></header><div id="josePdfConteudo"></div><p id="josePdfErro" role="alert"></p>';
 document.body.appendChild(dialog);
 const $=id=>dialog.querySelector('#'+id);let arquivo=null,leitura=null,urlPreview=null,busy=false;
 function fechar(){if(busy)return;dialog.close();if(urlPreview){URL.revokeObjectURL(urlPreview);urlPreview=null;}}
 dialog.querySelector('[data-jose-fechar]').onclick=fechar;
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();else fechar();});
 function abrir(titulo,html){$('josePdfTitulo').textContent=titulo;$('josePdfConteudo').innerHTML=html;$('josePdfErro').textContent='';if(!dialog.open)dialog.showModal();}
 function erro(e){$('josePdfErro').textContent=e.message||'Não foi possível concluir.';}
 function adicionar(){if(busy)return;arquivo=null;leitura=null;abrir('Adicionar proposta em PDF',`<p>Faça sua proposta no Word, salve em PDF e envie aqui. O documento original será mantido.</p><label class="jose-pdf-upload">Selecionar proposta em PDF<input id="josePdfArquivo" type="file" accept="application/pdf,.pdf"></label><p class="jose-pdf-muted">Até 5 MB · PDF sem senha. Não é necessário preencher o formulário de orçamento.</p><div id="josePdfRevisao"></div><footer><button type="button" id="josePdfVoltar">Fechar</button><button type="button" class="btn-new" id="josePdfLer" disabled>Ler proposta</button></footer>`);
 $('josePdfVoltar').onclick=fechar;
 $('josePdfArquivo').onchange=()=>{$('josePdfLer').disabled=!$('josePdfArquivo').files.length;};
 $('josePdfLer').onclick=async()=>{
 const f=$('josePdfArquivo').files[0];if(!f)return;
 if(!/\.pdf$/i.test(f.name)||f.size>5*1024*1024){erro(Error('Selecione um PDF de até 5 MB.'));return;}
 busy=true;$('josePdfLer').disabled=true;$('josePdfLer').textContent='Lendo PDF…';$('josePdfErro').textContent='';
 try{const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Não foi possível abrir o arquivo.'));reader.readAsDataURL(f);});
 arquivo={arquivo:base64,nome:f.name};leitura=await api('/propostas/jose/pdf/previa','POST',arquivo);urlPreview=URL.createObjectURL(f);conferir();
 }catch(e){erro(e);$('josePdfLer').disabled=false;$('josePdfLer').textContent='Ler proposta';}finally{busy=false;}
 };
 }
 function conferir(){
 const soma=leitura.itens.reduce((s,i)=>s+i.subtotal,0),bate=leitura.valorTotal!==null&&Math.abs(soma-leitura.valorTotal)<0.02&&leitura.itens.length>0;
 abrir('Confira sua proposta',`<div class="jose-pdf-review"><section><p><strong>${esc(leitura.arquivoNome)}</strong> · ${leitura.paginas} página(s)</p><div class="jose-pdf-notice">${leitura.avisos.map(a=>'<p>'+esc(a)+'</p>').join('')}</div><label>Título / obra<input id="josePdfNome" maxlength="250" value="${esc(leitura.titulo)}"></label><label>Cliente<select id="josePdfCliente"><option value="">Selecione o cliente</option>${leitura.clientes.map(c=>`<option value="${c.clienteid}" ${c.clienteid===leitura.clienteId?'selected':''}>${esc(c.nomeFantasia||c.razaoSocial||c.cpf||c.cnpj)}</option>`).join('')}</select></label><label>Valor total da proposta (R$)<input id="josePdfTotal" type="number" min="0.01" max="99999999.99" step="0.01" value="${leitura.valorTotal??''}"></label><p class="jose-pdf-muted">Confira o total no PDF ao lado. O valor confirmado será exibido no cartão e no faturamento.</p></section><iframe title="PDF original da proposta" src="${urlPreview}"></iframe></div>
 ${leitura.itens.length?`<details><summary>Metragens e preços identificados (${leitura.itens.length} itens)</summary><div class="jose-pdf-table"><table><thead><tr><th>Serviço</th><th>Unidade</th><th>Quantidade</th><th>Unitário (R$)</th><th>Total (R$)</th></tr></thead><tbody>${leitura.itens.map((i,index)=>`<tr data-jose-item="${index}"><td><input data-campo="descricao" value="${esc(i.descricao)}" aria-label="Descrição do item ${index+1}"></td><td><input data-campo="unidade" value="${esc(i.unidade)}" aria-label="Unidade do item ${index+1}"></td><td><input data-campo="quantidade" type="number" step="0.01" min="0.01" value="${i.quantidade}" aria-label="Quantidade do item ${index+1}"></td><td><input data-campo="valorUnitario" type="number" step="0.01" min="0.01" value="${i.valorUnitario}" aria-label="Valor unitário do item ${index+1}"></td><td data-total-item>${dinheiro(i.subtotal)}</td></tr>`).join('')}</tbody></table></div><label class="jose-pdf-check"><input id="josePdfUsarItens" type="checkbox" ${bate?'checked':''}>Usar os itens conferidos no sistema</label><p class="jose-pdf-muted">Se a tabela não corresponder ao PDF, desmarque a opção. O documento e o total continuam guardados sem inventar metragens.</p></details>`:''}
 <label class="jose-pdf-check"><input id="josePdfConferido" type="checkbox">Conferi o cliente e os valores com o PDF original.</label><footer><button type="button" id="josePdfOutro">Escolher outro PDF</button><button type="button" class="btn-new" id="josePdfSalvar">Salvar proposta</button></footer>`);
 dialog.querySelectorAll('[data-jose-item] input').forEach(input=>input.oninput=()=>{const tr=input.closest('tr'),q=Number(tr.querySelector('[data-campo="quantidade"]').value),v=Number(tr.querySelector('[data-campo="valorUnitario"]').value);tr.querySelector('[data-total-item]').textContent=dinheiro(q*v);});
 $('josePdfOutro').onclick=()=>{if(busy)return;if(urlPreview)URL.revokeObjectURL(urlPreview);urlPreview=null;adicionar();};
 $('josePdfSalvar').onclick=async()=>{
 if(!$('josePdfConferido').checked){erro(Error('Confira o cliente e os valores e marque a confirmação.'));return;}
 const btn=$('josePdfSalvar');busy=true;btn.disabled=true;btn.textContent='Salvando…';$('josePdfErro').textContent='';
 try{const itens=$('josePdfUsarItens')?.checked?[...dialog.querySelectorAll('[data-jose-item]')].map(tr=>Object.fromEntries([...tr.querySelectorAll('[data-campo]')].map(i=>[i.dataset.campo,i.value]))):[];
 await api('/propostas/jose/pdf/importar','POST',{...arquivo,hash:leitura.hash,titulo:$('josePdfNome').value,clienteId:Number($('josePdfCliente').value),valorTotal:$('josePdfTotal').value,itens,confirmado:true});busy=false;fechar();await carregarPropostas();toastSucesso('Proposta adicionada. O PDF original foi preservado.');
 }catch(e){erro(e);}finally{busy=false;btn.disabled=false;btn.textContent='Salvar proposta';}
 };
 }
 async function detalhe(id){
 abrir('Proposta','<p>Carregando proposta…</p>');
 try{const p=await api('/propostas/'+id);const importada=p.origem==='PDF_JOSE';
 abrir('Proposta nº '+p.numero,`<h3>${esc(p.titulo)}</h3><p>${esc(p.cliente?.nomeFantasia||p.cliente?.razaoSocial||'')}</p><p class="jose-pdf-value">${dinheiro(p.subtotal)}</p><p>${importada?'Documento original enviado em PDF.':'Proposta já cadastrada no sistema.'}</p><footer><button type="button" id="josePdfVer">Visualizar proposta</button><button type="button" id="josePdfBaixar">Baixar PDF</button>${importada&&admin?'<button type="button" id="josePdfRenomear">Alterar título</button>':''}</footer>`);
 $('josePdfVer').onclick=()=>previsualizarProposta(id,$('josePdfVer'));$('josePdfBaixar').onclick=()=>visualizarPdfProposta(id,$('josePdfBaixar'));
 $('josePdfRenomear')?.addEventListener('click',()=>{abrir('Alterar título',`<label>Título / obra<input id="josePdfEditarNome" maxlength="250" value="${esc(p.titulo)}"></label><p>O conteúdo e os valores do PDF original permanecem preservados.</p><footer><button type="button" id="josePdfSalvarNome" class="btn-new">Salvar título</button></footer>`);$('josePdfSalvarNome').onclick=async()=>{try{await api('/propostas/jose/pdf/'+id,'PATCH',{titulo:$('josePdfEditarNome').value});await carregarPropostas();await detalhe(id);}catch(e){erro(e);}};});
 }catch(e){erro(e);}
 }
 const novo=document.querySelector('[data-bs-target="#modalNovaProposta"]');
 if(novo){novo.removeAttribute('data-bs-toggle');novo.removeAttribute('data-bs-target');novo.textContent='+ Enviar proposta PDF';novo.hidden=!admin;novo.addEventListener('click',adicionar);}
 const board=document.getElementById('kanbanBoard');
 function decorar(){board?.querySelectorAll('.proposal-card').forEach(card=>{
 if(card.dataset.josePdfDecorado)return;card.dataset.josePdfDecorado='1';
 card.querySelectorAll('[data-proposta-acao="duplicar"],[data-proposta-acao="email"],[data-proposta-acao="whatsapp"]').forEach(b=>b.closest('li')?.remove());
 const a=document.createElement('div');a.className='jose-pdf-card-actions';a.innerHTML='<button type="button" data-jose-pdf-acao="ver">Visualizar proposta</button><button type="button" data-jose-pdf-acao="baixar">Baixar PDF</button>';a.addEventListener('pointerdown',e=>e.stopPropagation());card.appendChild(a);
 const tag=card.querySelector('.tag-origem');if(tag?.textContent==='PDF_JOSE')tag.textContent='PDF original';
 });}
 board?.addEventListener('click',e=>{
 const card=e.target.closest('.proposal-card');if(!card||typeof estaArrastando!=='undefined'&&estaArrastando)return;
 const direto=e.target.closest('[data-jose-pdf-acao]'),acao=e.target.closest('[data-proposta-acao]');
 if(direto){e.preventDefault();e.stopImmediatePropagation();if(direto.dataset.josePdfAcao==='ver')previsualizarProposta(card.dataset.id,direto);else visualizarPdfProposta(card.dataset.id,direto);return;}
 if(acao?.dataset.propostaAcao==='editar'||!e.target.closest('button,a,.dropdown')){e.preventDefault();e.stopImmediatePropagation();detalhe(card.dataset.id);}
 },true);
 if(board)new MutationObserver(decorar).observe(board,{childList:true,subtree:true});decorar();
 // Bloqueia a abertura do formulário antigo somente neste perfil.
 document.getElementById('modalNovaProposta')?.addEventListener('show.bs.modal',e=>{e.preventDefault();adicionar();});
})();
