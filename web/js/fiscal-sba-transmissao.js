/* Transmissão direta isolada da NFS-e SBA. */
(()=>{
 const user=JSON.parse(localStorage.getItem('usuarioLogado')||'null');
 if(!user?.token||typeof API_URL==='undefined')return;
 const headers={Authorization:'Bearer '+user.token};
 let sba=false,notaAtual=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 fetch(API_URL+'/empresas/me',{headers}).then(r=>r.ok?r.json():null).then(t=>{sba=t?.slug==='sba'&&t?.configuracaoSistema?.perfil==='SBA';}).catch(()=>{});
 window.addEventListener('sba-nota-detalhe',e=>{
  if(!sba||e.detail?.tipo!=='NFSE')return;
  notaAtual={...e.detail};
  const {id,status,ambiente,diretaSba}=e.detail;
  const area=document.getElementById('acoesDetalheFiscal');if(!area)return;
  // O fluxo genérico continua indisponível: não encaminhar SBA à Focus.
  area.querySelectorAll('[data-ver-payload],[data-emitir-nota],[data-cancelar-nota]').forEach(b=>b.hidden=true);
  const btn=(acao,texto)=>{const b=document.createElement('button');b.type='button';b.className='btn btn-outline-primary';b.dataset.sbaTransmissao=acao;b.dataset.id=String(id);b.textContent=texto;area.append(b);};
  if(ambiente==='PRODUCAO'){
   area.querySelectorAll('[data-consultar-nota],[data-conferir-nota]').forEach(b=>b.hidden=true);
   if(['RASCUNHO','ERRO','REJEITADA'].includes(status)){
    btn('preparar-producao','Conferir produção (sem emitir)');
    btn('transmitir-producao','Emitir NFS-e em produção');
   }
   if(['PROCESSANDO','AUTORIZADA','REJEITADA'].includes(status))btn('consultar-producao','Consultar produção');
   if(status==='AUTORIZADA'){btn('pdf-producao','Baixar PDF da nota');btn('xml-producao','Baixar XML da nota');}
  }
  if(ambiente==='HOMOLOGACAO' &&['RASCUNHO','ERRO','REJEITADA'].includes(status))btn('transmitir-homologacao','Transmitir em homologação');
  if(diretaSba&&['PROCESSANDO','AUTORIZADA'].includes(status)){
   // O botão Consultar do ERP usa a mesma consulta direta por DPS.
   if(status==='AUTORIZADA')btn('xml','Baixar XML de homologação');
  }
 });
 document.getElementById('acoesDetalheFiscal')?.addEventListener('click',async e=>{
  const b=e.target.closest('[data-sba-transmissao]');if(!b||!sba)return;
  const id=Number(b.dataset.id),acao=b.dataset.sbaTransmissao;
  if(!Number.isSafeInteger(id)||id<=0)return;
  let dadosConfirmados;
  if(acao==='transmitir-producao'){
   if(!notaAtual||Number(notaAtual.id)!==id||!Number.isFinite(notaAtual.valorTotal)||notaAtual.valorTotal<=0)return;
   dadosConfirmados={...notaAtual};
   const valor=dadosConfirmados.valorTotal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
   const c=await Swal.fire({icon:'warning',title:'Emitir NFS-e REAL de '+valor+'?',text:'Emitente: SBA. Tomador: '+(notaAtual.tomador||'')+' ('+(notaAtual.documento||'')+'). Esta confirmação envia ao ambiente de PRODUÇÃO e gera uma nota com validade fiscal.',showCancelButton:true,confirmButtonText:'Emitir nota real de '+valor,cancelButtonText:'Voltar'});
   if(!c.isConfirmed)return;
  }
  if(acao==='transmitir-homologacao'){
   const c=await Swal.fire({icon:'question',title:'Transmitir DPS em homologação?',text:'A DPS será assinada com o A1 da SBA, validada no XSD e enviada ao ambiente de testes da SEFIN. Não gera faturamento em produção.',showCancelButton:true,confirmButtonText:'Transmitir em homologação',cancelButtonText:'Voltar'});
   if(!c.isConfirmed)return;
  }
  b.disabled=true;
  try{
   const download=acao.startsWith('xml')||acao==='pdf-producao';
   const r=await fetch(API_URL+'/fiscal/sba/nfse/notas/'+id+'/'+acao,{method:download?'GET':'POST',headers:{...headers,...(acao==='transmitir-producao'?{'Content-Type':'application/json'}:{})},...(acao==='transmitir-producao'?{body:JSON.stringify({versaoConfirmada:dadosConfirmados.versao,confirmacao:dadosConfirmados.testeProducaoSba?'EMITIR_NOTA_REAL_R1':'EMITIR_NOTA_REAL',valorConfirmado:dadosConfirmados.valorTotal})}:{})});
   if(download&&r.ok){
    const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download=acao==='pdf-producao'?'nfse-sba.pdf':acao==='xml-producao'?'nfse-sba-producao.xml':'nfse-sba-homologacao.xml';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
   }
   const d=await r.json().catch(()=>({}));
   const pendencias=[...(d.pendencias||[]),...(d.erroXsd?[d.erroXsd]:[])];
   await Swal.fire({icon:!r.ok?'warning':d.status==='AUTORIZADA'?'success':'info',title:d.status==='AUTORIZADA'?(acao.includes('producao')?'Autorizada em produção':'Autorizada em homologação'):r.ok?'Retorno da SEFIN':'Revise a DPS',html:'<p>'+esc(d.error||d.mensagem||'Confira o documento.')+(d.pendenciaFinanceira?'<br><strong>Nota autorizada; faturamento pendente de sincronização. Use Consultar produção para reconciliar.</strong>':'')+'</p>'+ (pendencias.length?'<ul class="text-start">'+pendencias.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>':'')});
   if(r.ok){
    // Reabre o detalhe pelo botão existente para exibir o estado persistido.
    const abrir=document.querySelector('[data-abrir-nota="'+id+'"]');abrir?.click();
   }
  }catch(_){await Swal.fire({icon:'warning',title:'Resultado não confirmado',text:'Reabra a nota e use Consultar antes de qualquer reenvio. Não há reenvio automático.'});}
  finally{b.disabled=false;}
 });
})();
