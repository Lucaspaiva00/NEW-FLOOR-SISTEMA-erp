import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
const web=path.resolve(process.cwd(),'../web');
const read=(p:string)=>fs.readFileSync(path.join(web,p),'utf8');
async function wait(fn:()=>boolean){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Operação não concluída');}
function ambiente(empresa=5,invalida=false){
 const dom=new JSDOM(read('planilhas-medicao.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://erp.test/planilhas-medicao.html?obra=9',runScripts:'outside-only'}),w=dom.window,d=w.document,writes:any[]=[];
 w.localStorage.setItem('usuarioLogado',JSON.stringify({token:'teste',usuario:{role:'ADMIN'}}));Object.assign(w,{API_URL:'https://api.test'});w.HTMLElement.prototype.scrollIntoView=function(){};
 const aba={indice:1,nome:'Serviços',reconhecida:true,itens:[{linha:12,item:'1',descricao:'Alvenaria',etapa:'Civil',quantidade:10,unidade:'m²',valor:1000,percentuais:{1:0}}],medicoes:[{numero:1,coluna:12,titulo:'Medição 1'}],amostra:[{linha:1,celulas:[{coluna:'L',valor:'Fri Sep 26 2025 GMT+0000'}]}]};let importada=false;
 w.fetch=async(url:any,options:any={})=>{const p=new URL(url).pathname;let data:any={};if(options.body)writes.push({p,...JSON.parse(options.body)});
 if(p==='/empresas/me')data={empresaid:empresa,slug:'construarty',configuracaoSistema:{modulos:{obras:true}}};else if(p==='/obras')data=[{id:9,nome:'Holambra'}];
 else if(p==='/obras/planilhas/previa')data={hash:'abc',abas:[aba],avisos:invalida?['Valor sem resultado salvo']:[],valida:!invalida};
 else if(p==='/obras/planilhas/importar'){importada=true;data={id:7};}else if(p==='/obras/planilhas')data=importada?[{id:7,nome:'Obra',arquivoNome:'escopo.xlsx',updatedAt:'2026-11-05'}]:[];
 else if(p==='/obras/planilhas/7')data={id:7,nome:'Obra',abas:[aba],edicoes:{}};else if(p==='/obras/planilhas/7/medicao')data={edicoes:{'1:12:1':25}};else assert.fail('Rota inesperada '+p);
 return {ok:true,json:async()=>data} as any;};w.eval(read('js/planilhas-medicao.js'));return {dom,w,d,writes};
}
async function previa(a:ReturnType<typeof ambiente>){await wait(()=>(a.d.getElementById('pmObra') as HTMLSelectElement).value==='9' && !!a.d.getElementById('pmPrever')!.onclick);(a.d.getElementById('pmAdicionar') as HTMLElement).click();const f=a.d.getElementById('pmArquivo') as HTMLInputElement;Object.defineProperty(f,'files',{value:[new a.w.File(['excel'],'escopo.xlsx')]});(a.d.getElementById('pmPrever') as HTMLElement).click();await wait(()=>!!a.d.getElementById('pmConfirmar')).catch(e=>{throw Error(e.message+': '+a.d.getElementById('pmStatus')!.textContent);});}
test('prévia mostra serviços, recolhe detalhes e salva percentuais sem gerar cobrança',async()=>{const a=ambiente();try{await previa(a);const {d,w,writes}=a;assert.equal((d.getElementById('pmAjustesLeitura') as HTMLDetailsElement).open,false);assert.match(d.getElementById('pmServicosPrevia')!.textContent!,/Alvenaria/);assert.doesNotMatch(d.getElementById('pmServicosPrevia')!.textContent!,/GMT/);
(d.getElementById('pmConfirmar') as HTMLElement).click();await wait(()=>!d.getElementById('pmEditor')!.hidden);assert.equal(d.getElementById('pmImportador')!.hidden,true);const input=d.querySelector('[data-progresso]') as HTMLInputElement;input.value='25';input.dispatchEvent(new w.Event('input'));assert.match(d.querySelector('[data-valor]')!.textContent!,/250,00/);(d.getElementById('pmSalvar') as HTMLElement).click();await wait(()=>d.getElementById('pmStatus')!.textContent!.includes('salva com sucesso') && !(d.getElementById('pmSalvar') as HTMLButtonElement).disabled);assert.equal(writes.find(x=>x.p.endsWith('/medicao')).itens[0].percentual,25);assert.equal(writes.some(x=>/financeiro/.test(x.p)),false);(d.getElementById('pmMostrarAcumulado') as HTMLInputElement).click();assert.equal(d.getElementById('pmEditor')!.classList.contains('pm-com-historico'),true);
}finally{a.dom.window.close();}});
test('leitura inválida bloqueia importação e mantém ajuste manual acessível',async()=>{const a=ambiente(5,true);try{await previa(a);assert.equal((a.d.getElementById('pmConfirmar') as HTMLButtonElement).disabled,true);assert.ok(a.d.getElementById('pmRevisarMapa'));assert.match(a.d.getElementById('pmPrevia')!.textContent!,/não puderam ser lidos/);}finally{a.dom.window.close();}});
test('outros perfis não carregam a área exclusiva',async()=>{const a=ambiente(2);try{await wait(()=>a.d.getElementById('pmStatus')!.textContent!.includes('exclusiva'));assert.equal(a.d.getElementById('pmPrincipal')!.hidden,true);assert.deepEqual(a.writes,[]);}finally{a.dom.window.close();}});
