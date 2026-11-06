// Compatível com os quatro contatos antigos e a lista adicional da SBA.
window.contatosDoCliente = function(c = {}) {
  return [...Array.from({length:4},(_,i)=>({email:c['email'+(i+1)]||'',nomeEmail:c['nomeEmail'+(i+1)]||'',telefone:c['telefone'+(i+1)]||'',nomeTelefone:c['nomeTelefone'+(i+1)]||''})),...(Array.isArray(c.contatosAdicionais)?c.contatosAdicionais:[])];
};
window.escolherEmailsCliente = function(cliente, padrao) {
  const emails=new Map();
  window.contatosDoCliente(cliente).forEach(c=>{const email=String(c.email||'').trim().toLowerCase();if(email&&!emails.has(email))emails.set(email,c.nomeEmail||'Contato');});
  if(!emails.size)return Promise.reject(new Error('Cliente sem e-mail cadastrado. Cadastre os contatos na aba Clientes.'));
  return new Promise(resolve=>{
    const d=document.createElement('dialog');d.className='contatos-envio-dialog';
    d.innerHTML='<form><header><h2>Enviar proposta por e-mail</h2><button type="button" data-voltar aria-label="Fechar">×</button></header><p>Selecione os contatos deste cliente que receberão a proposta.</p><label class="contatos-todos"><input type="checkbox" data-todos> Selecionar todos</label><div class="contatos-envio-lista"></div><p data-resumo aria-live="polite"></p><footer><button type="button" data-voltar>Cancelar</button><button type="submit" class="contatos-enviar">Enviar proposta</button></footer></form>';
    const lista=d.querySelector('.contatos-envio-lista');
    for(const [email,nome] of emails){const label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');check.type='checkbox';check.value=email;check.name='destinatarios';strong.textContent=nome;small.textContent=email;text.append(strong,small);label.append(check,text);lista.append(label);}
    const checks=[...lista.querySelectorAll('input')],todos=d.querySelector('[data-todos]'),submit=d.querySelector('[type="submit"]');
    const selecionado=String(padrao||'').trim().toLowerCase();(checks.find(c=>c.value===selecionado)||checks[0]).checked=true;
    function atualizar(){const n=checks.filter(c=>c.checked).length;todos.checked=n===checks.length;todos.indeterminate=n>0&&n<checks.length;submit.disabled=!n;d.querySelector('[data-resumo]').textContent=n+' de '+checks.length+' contato(s) selecionado(s)';}
    checks.forEach(c=>c.onchange=atualizar);todos.onchange=()=>{checks.forEach(c=>c.checked=todos.checked);atualizar();};
    let resultado=null;d.querySelectorAll('[data-voltar]').forEach(b=>b.onclick=()=>d.close());d.querySelector('form').onsubmit=e=>{e.preventDefault();resultado=checks.filter(c=>c.checked).map(c=>c.value);if(resultado.length)d.close();};d.onclose=()=>{d.remove();resolve(resultado);};document.body.append(d);atualizar();d.showModal();
  });
};
