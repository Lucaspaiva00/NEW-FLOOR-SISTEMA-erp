import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {JSDOM} from 'jsdom';
const web=path.resolve(process.cwd(),'../web');const read=(s:string)=>fs.readFileSync(path.join(web,s),'utf8');
function setup(page='clientes.html'){
 const dom=new JSDOM(read(page).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://erp.test/'+page,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window as any;
 w.localStorage.setItem('usuarioLogado',JSON.stringify({token:'mock'}));w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 w.API_URL='https://api.test';w.alert=(v:any)=>{throw Error(v);};w.fetch=async()=>({ok:true,json:async()=>[]});w.configurarMascaras=()=>{};w.aplicarMascara=(v:any)=>v;w.bootstrap={Modal:class{show(){} static getInstance(){return {hide(){}};}}};w.eval(read('js/utils.js'));w.eval(read('js/masks.js'));w.eval(read('js/contatos-cliente.js'));return {dom,w,d:w.document};
}
test('cadastro SBA permite quinze contatos, reabre todos e remove extras; outros perfis mantêm quatro',async()=>{
 for(const perfil of ['SBA','NEW_FLOOR']){const {dom,w,d}=setup();try{w.eval(read('js/clientes.js'));await new Promise(r=>setTimeout(r,0));w.__configuracaoSistema={perfil};w.dispatchEvent(new w.CustomEvent('configuracao-sistema',{detail:{perfil}}));
 const lista=d.querySelector('[data-prefix=""] .contato-lista[data-tipo=email]');assert.equal(lista.querySelectorAll('.contato-item').length,perfil==='SBA'?50:4);
 if(perfil!=='SBA')continue;
 for(let i=1;i<=15;i++){if(i>1)d.querySelector('[data-prefix=""] .btn-contato-adicionar[data-tipo=email]').click();d.getElementById('email'+i).value=`p${i}@example.invalid`;d.getElementById('nomeEmail'+i).value='Contato '+i;}
 const body=w.montarBodyCliente();assert.equal(body.contatosAdicionais.length,11);assert.equal(body.contatosAdicionais[10].email,'p15@example.invalid');
 const cliente={...body,clienteid:1};w.fetch=async()=>({ok:true,json:async()=>cliente});await w.abrirModalCliente(1);assert.equal(d.getElementById('editarEmail15').value,'p15@example.invalid');assert.equal(d.getElementById('editarNomeEmail15').value,'Contato 15');assert.equal(d.getElementById('editarEmail15').closest('.contato-item').classList.contains('campo-oculto'),false);
 d.getElementById('editarEmail15').closest('.contato-item').querySelector('.btn-contato-remover').click();assert.equal(w.montarBodyCliente('editar').contatosAdicionais.length,10);
 }finally{dom.window.close();}}
});
test('modal seleciona um ou quinze contatos sem prompt, deduplica e escapa nomes',async()=>{
 const {dom,w,d}=setup('propostas.html');try{
 const cliente:any={email1:'a@example.invalid',nomeEmail1:'<img src=x onerror=alert(1)>',contatosAdicionais:Array.from({length:14},(_,i)=>({email:`p${i}@example.invalid`,nomeEmail:`Contato ${i}`}))};
 let promise=w.escolherEmailsCliente(cliente,'p13@example.invalid');assert.equal(d.querySelectorAll('dialog input[name=destinatarios]').length,15);assert.equal(d.querySelectorAll('dialog img').length,0);d.querySelector('dialog form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.deepEqual(Array.from(await promise),['p13@example.invalid']);
 promise=w.escolherEmailsCliente(cliente);const todos=d.querySelector('[data-todos]');todos.checked=true;todos.dispatchEvent(new w.Event('change'));d.querySelector('dialog form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal((await promise).length,15);
 promise=w.escolherEmailsCliente(cliente);d.querySelector('[data-voltar]').click();assert.equal(await promise,null);
 }finally{dom.window.close();}
});

test('ação do Kanban carrega contatos atuais e envia somente a seleção explícita',async()=>{
 const {dom,w,d}=setup('propostas.html');try{
 const posts:any[]=[];w.token='mock';w.__configuracaoSistema={perfil:'SBA'};w.toastErro=(v:any)=>{throw Error(v);};w.toastSucesso=()=>{};w.setCardLoading=()=>{};
 w.fetch=async(url:string,o:any={})=>{let data:any={};if(url.endsWith('/templates'))data=[];else if(url.endsWith('/email')){posts.push(JSON.parse(o.body));data={message:'Enviado'};}else data={cliente:{email1:'um@example.invalid',contatosAdicionais:[{email:'quinze@example.invalid',nomeEmail:'Contato adicional'}]},emailDestinatario:'quinze@example.invalid'};return {ok:true,text:async()=>JSON.stringify(data)};};
 w.eval(read('js/propostas-acoes.js'));const envio=w.enviarEmailProposta(12);await new Promise(r=>setTimeout(r,0));assert.equal(posts.length,0);d.querySelector('dialog form').dispatchEvent(new w.Event('submit',{cancelable:true}));await envio;assert.deepEqual(posts,[{destinatarios:['quinze@example.invalid']}]);
 }finally{dom.window.close();}
});
