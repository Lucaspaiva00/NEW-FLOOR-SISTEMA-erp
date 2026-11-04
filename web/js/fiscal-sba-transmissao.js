/* Transmissão direta exclusivamente em homologação da SBA. */
(()=>{
 const user=JSON.parse(localStorage.getItem('usuarioLogado')||'null');
 if(!user?.token||typeof API_URL==='undefined')return;
 const headers={Authorization:'Bearer '+user.token};
 let sba=false;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 fetch(API_URL+'/empresas/me',{headers}).then(r=>r.ok?r.json():null).then(t=>{sba=t?.slug==='sba'&&t?.configuracaoSistema?.perfil==='SBA';}).catch(()=>{});
 window.addEventListener('sba-nota-detalhe',e=>{
  if(!sba||e.detail?.tipo!=='NFSE')return;
  const {id,status,ambiente,diretaSba,testeProducaoSba}=e.detail;
  const area=document.getElementById('acoesDetalheFiscal');if(!area)return;
  // O fluxo genérico continua indisponível: não encaminhar SBA à Focus.
  area.querySelectorAll('[data-ver-payload],[data-emitir-nota],[data-cancelar-nota]').forEach(b=>b.hidden=true);
  const btn=(acao,texto)=>{const b=document.createElement('button');b.type='button';b.className='btn btn-outline-primary';b.dataset.sbaTransmissao=acao;b.dataset.id=String(id);b.textContent=texto;area.append(b);};
  if(ambiente==='PRODUCAO'){
   area.querySelectorAll('[data-consultar-nota],[data-conferir-nota]').forEach(b=>b.hidden=true);
   if(testeProducaoSba&&['RASCUNHO','ERRO','REJEITADA'].includes(status)){
    btn('preparar-producao','Conferir produção (sem emitir)');
    btn('transmitir-producao','Emitir R$ 1,00 em produção');
   }
   if(testeProducaoSba&&['PROCESSANDO','AUTORIZADA','REJEITADA'].includes(status))btn('consultar-producao','Consultar produção');
   if(testeProducaoSba&&status==='AUTORIZADA')btn('xml-producao','Baixar XML da nota');
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
  if(acao==='transmitir-producao'){
   const c=await Swal.fire({icon:'warning',title:'Emitir nota fiscal REAL de R$ 1,00?',text:'Emitente SBA. Tomador: CNPJ 47.051.253/0001-58. Descrição: Teste de emissão. Esta confirmação envia ao ambiente de PRODUÇÃO e poderá gerar uma NFS-e com validade fiscal.',showCancelButton:true,confirmButtonText:'Emitir nota real de R$ 1,00',cancelButtonText:'Voltar'});
   if(!c.isConfirmed)return;
  }
  if(acao==='transmitir-homologacao'){
   const c=await Swal.fire({icon:'question',title:'Transmitir DPS em homologação?',text:'A DPS será assinada com o A1 da SBA, validada no XSD e enviada ao ambiente de testes da SEFIN. Não gera faturamento em produção.',showCancelButton:true,confirmButtonText:'Transmitir em homologação',cancelButtonText:'Voltar'});
   if(!c.isConfirmed)return;
  }
  b.disabled=true;
  try{
   const r=await fetch(API_URL+'/fiscal/sba/nfse/notas/'+id+'/'+acao,{method:acao.startsWith('xml')?'GET':'POST',headers:{...headers,...(acao==='transmitir-producao'?{'Content-Type':'application/json'}:{})},...(acao==='transmitir-producao'?{body:JSON.stringify({confirmacao:'EMITIR_NOTA_REAL_R1'})}:{})});
   if(acao.startsWith('xml')&&r.ok){
    const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download=acao==='xml-producao'?'nfse-sba-producao.xml':'nfse-sba-homologacao.xml';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
   }
   const d=await r.json().catch(()=>({}));
   const pendencias=[...(d.pendencias||[]),...(d.erroXsd?[d.erroXsd]:[])];
   await Swal.fire({icon:!r.ok?'warning':d.status==='AUTORIZADA'?'success':'info',title:d.status==='AUTORIZADA'?(acao.includes('producao')?'Autorizada em produção':'Autorizada em homologação'):r.ok?'Retorno da SEFIN':'Revise a DPS',html:'<p>'+esc(d.error||d.mensagem||'Confira o documento.')+'</p>'+ (pendencias.length?'<ul class="text-start">'+pendencias.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>':'')});
   if(r.ok){
    // Reabre o detalhe pelo botão existente para exibir o estado persistido.
    const abrir=document.querySelector('[data-abrir-nota="'+id+'"]');abrir?.click();
   }
  }catch(_){await Swal.fire({icon:'warning',title:'Resultado não confirmado',text:'Reabra a nota e use Consultar antes de qualquer reenvio. Não há reenvio automático.'});}
  finally{b.disabled=false;}
 });
})();
