import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const sidebar=fs.readFileSync('../web/js/sidebar.js','utf8');
const aplicar=sidebar.slice(sidebar.indexOf('function aplicarPerfilEmpresa(c)'));
function preparar(empresa:any,pagina:string,composicao=true){
 const dom=new JSDOM('<body><aside class="sidebar"><nav class="menu"><a href="clientes.html">Clientes</a><a href="servicos.html">Serviços</a><a href="orcamentos.html">Orçamentos</a><a href="propostas.html">Propostas</a></nav></aside></body>');
 const redirecionados:string[]=[];
 (dom.window as any).__empresaAtual=empresa;
 const context={window:dom.window,document:dom.window.document,location:{pathname:'/'+pagina,replace:(p:string)=>redirecionados.push(p)},MENU_ICONS:{},prepararItensMenu:()=>{},CustomEvent:dom.window.CustomEvent};
 vm.runInNewContext(aplicar+';aplicarPerfilEmpresa(config)',{...context,config:{perfil:empresa.empresaid===2?'SBA':'PERSONALIZADO',composicaoCustos:composicao,modulos:{propostas:true},camposProposta:{}}});
 return {dom,redirecionados};
}
test('José usa somente Propostas no menu e mantém Materiais',()=>{
 const {dom,redirecionados}=preparar({empresaid:5,slug:'construarty'},'propostas.html');
 try{const d=dom.window.document;assert.equal(d.querySelector('.menu a[href="orcamentos.html"]'),null);assert.equal(d.querySelector('.menu a[href="servicos.html"]'),null);assert.ok(d.querySelector('.menu a[href="propostas.html"]'));assert.ok(d.querySelector('.menu a[href="materiais.html"]'));assert.deepEqual(redirecionados,[]);}finally{dom.window.close();}
});
test('URL antiga de Orçamentos do José redireciona para Propostas',()=>{
 for(const pagina of ['orcamentos.html','servicos.html']){
 const {dom,redirecionados}=preparar({empresaid:5,slug:'construarty'},pagina);
 try{assert.deepEqual(redirecionados,['propostas.html']);}finally{dom.window.close();}
 }
});
test('SBA e New Floor mantêm seus menus sem redirecionamento para Propostas',()=>{
 for(const empresa of [{empresaid:2,slug:'sba'},{empresaid:1,slug:'new-floor'},{empresaid:5,slug:'outra'}]){
 const {dom,redirecionados}=preparar(empresa,'orcamentos.html',empresa.empresaid!==1);
 try{assert.ok(dom.window.document.querySelector('.menu a[href="orcamentos.html"]'));assert.deepEqual(redirecionados,[]);}finally{dom.window.close();}
 }
});
test('Modal PDF tem margem e posicionamento explícitos apesar do reset global',()=>{
 const css=fs.readFileSync('../web/css/propostas-jose-pdf.css','utf8');
 const dom=new JSDOM('<style>*{margin:0;padding:0}'+css+'</style><dialog class="jose-pdf-dialog" open>PDF</dialog>');
 try{const style=dom.window.getComputedStyle(dom.window.document.querySelector('dialog')!);assert.equal(style.position,'fixed');assert.equal(style.margin,'auto');assert.match(style.inset,/^0(?:px)?$/);assert.equal(style.height,'fit-content');assert.equal(style.boxSizing,'border-box');}finally{dom.window.close();}
});
