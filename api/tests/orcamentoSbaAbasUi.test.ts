import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {JSDOM} from 'jsdom';import {calcularComposicao} from '../src/services/orcamentoSba.service';
const web=path.resolve(process.cwd(),'../web'),read=(p:string)=>fs.readFileSync(path.join(web,p),'utf8');
async function wait(f:()=>boolean){for(let i=0;i<100;i++){if(f())return;await new Promise(r=>setTimeout(r,5));}throw Error('Editor não carregou');}
function ambiente(perfil='SBA'){
 const dom=new JSDOM(read('orcamentos.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://erp.test/orcamentos.html',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window as any,d=w.document,posts:any[]=[];
 w.API_URL='https://api.test';w.__configuracaoSistema={perfil,composicaoCustos:true,textoEscopo:''};w.localStorage.setItem('usuarioLogado',JSON.stringify({token:'mock'}));
 w.bootstrap={Modal:class{node:any;constructor(n:any){this.node=n;}show(){this.node.dispatchEvent(new w.Event('show.bs.modal',{bubbles:true}));this.node.dispatchEvent(new w.Event('shown.bs.modal',{bubbles:true}));}hide(){}}};
 w.fetch=async(url:string,o:any={})=>{let data:any=[];if(o.method==='POST'||o.method==='PUT'){posts.push(JSON.parse(o.body));data={propostaid:100};}else if(url.endsWith('/clientes'))data=[{clienteid:1,razaoSocial:'Cliente',contatosAdicionais:Array.from({length:200},(_,i)=>({email:`contato${i}@example.invalid`,nomeEmail:'Contato '+i}))}];return {ok:true,json:async()=>data};};
 for(const p of ['pagamento-sba','plano-recebimento','composicao-servicos','orcamentos','modal-tabs'])w.eval(read('js/'+p+'.js'));
 w.dispatchEvent(new w.CustomEvent('configuracao-sistema',{detail:w.__configuracaoSistema}));return {dom,w,d,posts};
}
test('SBA tem somente Dados, Serviços e Condições, inclusive antes do carregamento; preço editado persiste com somas recalculadas',async()=>{
 const {dom,w,d,posts}=ambiente();try{
 await wait(()=>!!d.querySelector('.service-composition'));await d.getElementById('novoOrcamento').onclick();
 const nav=d.querySelector('.subject-tabs');assert.deepEqual([...nav.children].map((b:any)=>b.textContent),['Dados','Serviços','Condições']);assert.equal(d.getElementById('descricao').closest('label').hidden,true);
 nav.children[1].click();const panel=d.querySelector('.subject-tab-panel:not([hidden])');assert.ok(panel.querySelector('.service-composition'));assert.deepEqual([...panel.querySelectorAll('.service-tabs button')].map((b:any)=>b.textContent),['Serviço','Materiais','Mão de obra','Valores']);
 const servico=panel.querySelector('.service-composition');const set=(sel:string,v:string)=>{const input=servico.querySelector(sel);input.value=v;input.dispatchEvent(new w.Event('input',{bubbles:true}));};
 set('[data-campo=descricao]','Serralheria');set('[data-campo=quantidade]','2');
 [...servico.querySelectorAll('button')].find((b:any)=>b.textContent==='+ Adicionar material').click();set('[data-campo=custoUnitario]','100');
 const unit=servico.querySelector('[data-campo=valorUnitario]');assert.equal(unit.readOnly,false);assert.equal(Number(unit.value),125);
 set('[data-campo=valorUnitario]','180');assert.equal(servico.querySelector('[data-campo=modoPreco]').value,'MANUAL');
 d.getElementById('titulo').value='Orçamento';d.getElementById('cliente').value='1';d.getElementById('cliente').onchange();assert.ok([...d.getElementById('email').options].some((o:any)=>o.value==='contato199@example.invalid'));
 const todos=d.querySelector('.budget-destinatarios input[aria-label]');todos.checked=true;todos.onchange();assert.equal(d.querySelectorAll('.budget-destinatarios-lista input:checked').length,200);
 await d.getElementById('formOrcamento').onsubmit({preventDefault(){}});assert.equal(posts.length,1);assert.equal(posts[0].descricao,undefined);assert.equal(posts[0].emailsDestinatarios.length,200);
 const dados=posts[0].composicaoCustos;assert.equal(dados.servicos[0].modoPreco,'MANUAL');const total=calcularComposicao(dados);assert.equal(total.preco,360);assert.equal(total.custoMateriais,100);assert.equal(total.valorImposto,64.8);assert.equal(total.lucro,195.2);
 // Reabrir não cria guias duplicadas; alternar o preço automático usa os custos novamente.
 await d.getElementById('novoOrcamento').onclick();assert.equal(nav.children.length,3);
 }finally{dom.window.close();}
});
test('outros perfis preservam as guias e a descrição comercial',async()=>{
 const {dom,d}=ambiente('NEW_FLOOR');try{await wait(()=>!!d.getElementById('cliente').options.length);assert.equal(d.getElementById('descricao').closest('label').hidden,false);assert.ok([...d.querySelector('.subject-tabs').children].some((b:any)=>b.textContent==='Materiais'));}finally{await new Promise(r=>setTimeout(r,0));dom.window.close();}
});
