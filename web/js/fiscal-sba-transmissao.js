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
  const {id,status,ambiente,diretaSba,diretaProducaoSba,cancelamentoPendente}=e.detail;
  const area=document.getElementById('acoesDetalheFiscal');if(!area)return;
  // O fluxo genérico continua indisponível: não encaminhar SBA à Focus.
  area.querySelectorAll('[data-ver-payload],[data-emitir-nota],[data-cancelar-nota]').forEach(b=>b.hidden=true);
  const btn=(acao,texto)=>{const b=document.createElement('button');b.type='button';b.className=acao==='cancelar-producao'?'btn btn-outline-danger':'btn btn-outline-primary';b.dataset.sbaTransmissao=acao;b.dataset.id=String(id);b.textContent=texto;area.append(b);};
  if(ambiente==='PRODUCAO'){
   area.querySelectorAll('[data-consultar-nota],[data-conferir-nota]').forEach(b=>b.hidden=true);
   if(['RASCUNHO','ERRO','REJEITADA'].includes(status)){
    btn('preparar-producao','Conferir produção (sem emitir)');
    btn('transmitir-producao','Emitir NFS-e em produção');
   }
   if(['PROCESSANDO','AUTORIZADA','REJEITADA'].includes(status))btn('consultar-producao','Consultar produção');
   if(['AUTORIZADA','CANCELADA'].includes(status)){btn('pdf-producao','Baixar PDF da nota');btn('xml-producao','Baixar XML da nota');}
   if(diretaProducaoSba&&['AUTORIZADA','CANCELADA'].includes(status))btn('consultar-cancelamento','Consultar cancelamento');
   if(diretaProducaoSba&&status==='AUTORIZADA'&&!cancelamentoPendente)btn('cancelar-producao','Cancelar NFS-e');
   if(diretaProducaoSba&&status==='CANCELADA')btn('xml-cancelamento','Baixar XML do cancelamento');
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
  let dadosConfirmados,corpoCancelamento;
  if(acao==='cancelar-producao'){
   if(!notaAtual||Number(notaAtual.id)!==id)return;
   dadosConfirmados={...notaAtual};
   const formulario=await Swal.fire({icon:'warning',title:'Cancelar NFS-e nº '+(dadosConfirmados.numero||'')+'?',html:'<p>Tomador: '+esc(dadosConfirmados.tomador)+'. O cancelamento será enviado ao Portal Nacional.</p><label for="sbaMotivoCancelamento">Motivo</label><select id="sbaMotivoCancelamento" class="swal2-input"><option value="">Selecione</option><option value="1">Erro na emissão</option><option value="2">Serviço não prestado</option><option value="9">Outros</option></select><label for="sbaJustificativaCancelamento">Justificativa (15 a 255 caracteres)</label><textarea id="sbaJustificativaCancelamento" class="swal2-textarea" minlength="15" maxlength="255"></textarea>',showCancelButton:true,confirmButtonText:'Revisar cancelamento',cancelButtonText:'Voltar',preConfirm:()=>{
    const codigoMotivo=document.getElementById('sbaMotivoCancelamento').value,justificativa=document.getElementById('sbaJustificativaCancelamento').value.replace(/\s+/g,' ').trim();
    if(!['1','2','9'].includes(codigoMotivo)||justificativa.length<15||justificativa.length>255){Swal.showValidationMessage('Selecione o motivo e informe uma justificativa de 15 a 255 caracteres.');return false;}
    return {codigoMotivo,justificativa};
   }});
   if(!formulario.isConfirmed)return;
   const confirmar=await Swal.fire({icon:'warning',title:'Confirmar cancelamento fiscal?',text:'NFS-e nº '+dadosConfirmados.numero+' — '+dadosConfirmados.tomador+'. Justificativa: '+formulario.value.justificativa+'. A nota só será marcada como cancelada após a confirmação do Portal Nacional.',showCancelButton:true,confirmButtonText:'Confirmar cancelamento',cancelButtonText:'Voltar'});
   if(!confirmar.isConfirmed)return;
   corpoCancelamento={...formulario.value,confirmacao:'CANCELAR_NFSE_REAL',chaveConfirmada:dadosConfirmados.chave,versaoConfirmada:dadosConfirmados.versao};
  }
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
   const r=await fetch(API_URL+'/fiscal/sba/nfse/notas/'+id+'/'+acao,{method:download?'GET':'POST',headers:{...headers,...(['transmitir-producao','cancelar-producao'].includes(acao)?{'Content-Type':'application/json'}:{})},...(acao==='cancelar-producao'?{body:JSON.stringify(corpoCancelamento)}:{}),...(acao==='transmitir-producao'?{body:JSON.stringify({versaoConfirmada:dadosConfirmados.versao,confirmacao:dadosConfirmados.testeProducaoSba?'EMITIR_NOTA_REAL_R1':'EMITIR_NOTA_REAL',valorConfirmado:dadosConfirmados.valorTotal})}:{})});
   if(download&&r.ok){
    const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download=acao==='xml-cancelamento'?'cancelamento-nfse-sba.xml':acao==='pdf-producao'?'nfse-sba.pdf':acao==='xml-producao'?'nfse-sba-producao.xml':'nfse-sba-homologacao.xml';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
   }
   const d=await r.json().catch(()=>({}));
   const pendencias=[...(d.pendencias||[]),...(d.erroXsd?[d.erroXsd]:[])];
   await Swal.fire({icon:!r.ok?'warning':d.status==='CANCELADA'||(!acao.includes('cancel')&&d.status==='AUTORIZADA')?'success':'info',title:d.status==='CANCELADA'?'Cancelamento confirmado':acao.includes('cancel')?'Retorno do cancelamento':d.status==='AUTORIZADA'?(acao.includes('producao')?'Autorizada em produção':'Autorizada em homologação'):r.ok?'Retorno da SEFIN':'Revise a DPS',html:'<p>'+esc(d.error||d.mensagem||'Confira o documento.')+(d.pendenciaFinanceira?'<br><strong>Situação fiscal confirmada; financeiro pendente de sincronização. Use a consulta correspondente para reconciliar.</strong>':'')+'</p>'+ (pendencias.length?'<ul class="text-start">'+pendencias.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>':'')});
   if(r.ok){
    // Reabre o detalhe pelo botão existente para exibir o estado persistido.
    const abrir=document.querySelector('[data-abrir-nota="'+id+'"]');abrir?.click();
   }
  }catch(_){await Swal.fire({icon:'warning',title:'Resultado não confirmado',text:'Reabra a nota e use Consultar antes de qualquer reenvio. Não há reenvio automático.'});}
  finally{b.disabled=false;}
 });
})();
