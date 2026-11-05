import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
const root=path.resolve(process.cwd(),'../web');
const html=fs.readFileSync(path.join(root,'propostas.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const script=fs.readFileSync(path.join(root,'js/propostas-jose-pdf.js'),'utf8');
async function aguardar(fn:()=>boolean){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('A tela não concluiu a operação');}
function ambiente(tenant=5){
 const dom=new JSDOM(html,{url:'https://erp.exemplo.local/propostas.html',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,posts:any[]=[],calls:string[]=[];
 w.localStorage.setItem('usuarioLogado',JSON.stringify({token:'teste-sem-acesso-real',usuario:{role:'ADMIN'}}));
 Object.assign(w,{API_URL:'https://api.exemplo.local',carregarPropostas:async()=>{calls.push('recarregar');},toastSucesso:()=>{calls.push('sucesso');},previsualizarProposta:(id:string)=>calls.push('ver:'+id),visualizarPdfProposta:(id:string)=>calls.push('baixar:'+id)});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 w.URL.createObjectURL=()=> 'blob:https://erp.exemplo.local/arquivo-teste';w.URL.revokeObjectURL=()=>{};
 w.fetch=async(url:any,options:any={})=>{const p=new URL(url).pathname;let data:any={};
 if(p==='/empresas/me')data={empresaid:tenant,slug:tenant===5?'construarty':tenant===2?'sba':'new-floor',configuracaoSistema:{modulos:{propostas:true}}};
 else if(p.endsWith('/previa'))data={arquivoNome:'proposta-validacao.pdf',paginas:1,hash:'hash-teste',titulo:'Obra de validação',clienteId:15,valorTotal:2000,clientes:[{clienteid:15,razaoSocial:'Cliente de validação'}],itens:[{descricao:'Pintura',unidade:'M2',quantidade:100,valorUnitario:20,subtotal:2000}],avisos:['Confira os valores no PDF.']};
 else if(p.endsWith('/importar')){posts.push(JSON.parse(options.body));data={propostaid:700};}
 else if(p==='/propostas/700')data={propostaid:700,numero:'700',origem:'PDF_JOSE',titulo:'Proposta exemplo',subtotal:2000,cliente:{razaoSocial:'Cliente de validação'}};
 else assert.fail('Requisição inesperada '+p);
 return {ok:true,json:async()=>data};};
 w.eval(script);return {dom,w,posts,calls};
}
test('José: upload, conferência e salvamento sem abrir formulário legado; botões do cartão',async()=>{
 const {dom,w,posts,calls}=ambiente();const d=w.document;
 try{
 await aguardar(()=>!!d.querySelector('.jose-pdf-dialog'));
 const novo=[...d.querySelectorAll('button')].find(b=>b.textContent?.includes('Enviar proposta PDF')) as HTMLButtonElement;assert.ok(novo);novo.click();
 assert.ok(d.querySelector('dialog[open]'));assert.equal(d.querySelector('#modalNovaProposta.show'),null);
 const fileInput=d.getElementById('josePdfArquivo') as HTMLInputElement;
 Object.defineProperty(fileInput,'files',{value:[new w.File(['%PDF-1.4\n%%EOF'],'proposta-validacao.pdf',{type:'application/pdf'})]});fileInput.dispatchEvent(new w.Event('change'));
 (d.getElementById('josePdfLer') as HTMLButtonElement).click();await aguardar(()=>!!d.getElementById('josePdfConferido'));
 assert.equal((d.getElementById('josePdfTotal') as HTMLInputElement).value,'2000');assert.equal((d.getElementById('josePdfCliente') as HTMLSelectElement).value,'15');
 (d.getElementById('josePdfSalvar') as HTMLButtonElement).click();assert.equal(posts.length,0);assert.match(d.getElementById('josePdfErro')!.textContent!,/Confira/);
 (d.getElementById('josePdfConferido') as HTMLInputElement).checked=true;
 (d.getElementById('josePdfSalvar') as HTMLButtonElement).click();await aguardar(()=>posts.length===1&&!d.querySelector('dialog[open]'));
 assert.equal(posts[0].valorTotal,'2000');assert.equal(posts[0].clienteId,15);assert.equal(posts[0].itens[0].quantidade,'100');assert.ok(calls.includes('recarregar'));
 const board=d.getElementById('kanbanBoard')!;board.innerHTML='<article class="proposal-card" data-id="700"><h3>Proposta exemplo</h3><ul><li><button data-proposta-acao="editar">Editar</button></li><li><button data-proposta-acao="duplicar">Duplicar</button></li></ul></article>';
 await aguardar(()=>!!d.querySelector('[data-jose-pdf-acao="ver"]'));
 (d.querySelector('[data-jose-pdf-acao="ver"]') as HTMLButtonElement).click();(d.querySelector('[data-jose-pdf-acao="baixar"]') as HTMLButtonElement).click();
 assert.ok(calls.includes('ver:700'));assert.ok(calls.includes('baixar:700'));assert.equal(d.querySelector('[data-proposta-acao="duplicar"]'),null);
 (d.querySelector('[data-proposta-acao="editar"]') as HTMLButtonElement).click();await aguardar(()=>!!d.getElementById('josePdfRenomear'));assert.equal(d.querySelector('#modalProposta.show'),null);
 }finally{dom.window.close();}
});
test('UI de SBA e New Floor conserva botão e formulário existentes',async()=>{
 for(const tenant of [1,2]){const {dom,w}=ambiente(tenant);try{await new Promise(r=>setTimeout(r,10));assert.equal(w.document.querySelector('.jose-pdf-dialog'),null);assert.equal(w.document.querySelector('[data-bs-target="#modalNovaProposta"]')?.textContent?.trim(),'+ Nova proposta');assert.equal(w.document.body.classList.contains('jose-pdf-propostas'),false);}finally{dom.window.close();}}
});
