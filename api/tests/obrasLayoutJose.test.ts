import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
const web=path.resolve(process.cwd(),'../web');
const read=(p:string)=>fs.readFileSync(path.join(web,p),'utf8');
async function wait(fn:()=>boolean){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('A tela não terminou a operação.');}
function ambiente(empresaId=5,semEquipe=false){
 const dom=new JSDOM(read('obras.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://erp.test/obras.html',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.localStorage.setItem('usuarioLogado',JSON.stringify({token:'teste',usuario:{role:'ADMIN'}}));
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 const obra={id:9,nome:'Holambra',clienteId:1,valorContrato:100000,etapas:[],apontamentos:[],despesas:[],medicoes:[],financeiro:[],resumo:{custoTotal:0,custoMaoObra:0,custoDespesas:0,medido:0,recebido:0,aReceber:0}};
 Object.assign(w,{API_URL:'https://api.test'});
 const equipe:any[]=semEquipe?[]:[{id:1,nome:'João',ativo:true,diaria:100}],writes:any[]=[];
 w.fetch=async(url:any,options:any={})=>{const p=new URL(url).pathname;let data:any={};
 if(p==='/empresas/me')data={empresaid:empresaId,slug:empresaId===5?'construarty':'sba',configuracaoSistema:{modulos:{obras:true,propostas:true}}};
 else if(p==='/obras')data=[obra];else if(p==='/obras/colaboradores'){if(options.method==='POST'){const b=JSON.parse(options.body);writes.push(b);data={id:2,...b};equipe.push(data);}else data=equipe;}else if(p.endsWith('/consulta'))data={itens:[],total:0,paginas:1};else if(p==='/obras/9')data=obra;else if(p==='/obras/propostas-disponiveis')data=[];
 else assert.fail('Requisição inesperada: '+p);
 return {ok:true,json:async()=>data} as any;
 };
 for(const p of ['obras','obras-operacao','obras-jose-simples','obras-propostas-jose','obras-planilhas-link','obras-jose-layout'])w.eval(read('js/'+p+'.js'));
 return {dom,w,d,writes};
}
test('José organiza ações por área e conserva os eventos após trocar abas',async()=>{
 const {dom,w,d}=ambiente();try{
 await wait(()=>d.body.classList.contains('jose-obras-organizada')&&!!d.getElementById('joseObraEquipeAcoes')&&!!d.getElementById('consultaObras')?.textContent?.includes('Nenhum'));
 assert.equal(d.getElementById('obraDaProposta')!.textContent,'+ Nova obra');
 (d.getElementById('novoColaboradorDireto') as HTMLElement).click();assert.equal(d.getElementById('tituloEditor')!.textContent,'Novo colaborador');assert.ok(d.querySelector('[name="nome"]'));assert.ok(d.querySelector('[name="diaria"]'));(d.getElementById('cancelarEditor') as HTMLElement).click();
 assert.equal(d.querySelectorAll('.toolbar>button').length,1);
 assert.ok(d.getElementById('joseObraMais')!.contains(d.getElementById('editarObra')));
 assert.ok(d.getElementById('joseObraMais')!.contains(d.getElementById('importarPlanilha')));
 assert.ok(d.getElementById('joseObraEquipeAcoes')!.contains(d.getElementById('equipe')));
 assert.equal((d.getElementById('joseObraFiltros') as HTMLDetailsElement).open,false);
 (d.getElementById('equipe') as HTMLElement).click();assert.match(d.getElementById('tituloEditor')!.textContent!,/Equipe/);(d.getElementById('cancelarEditor') as HTMLElement).click();
 for(const tab of ['custos','medicoes','planejamento','cronograma','medicoes','cronograma']){
  (d.querySelector('[data-tab="'+tab+'"]') as HTMLElement).click();
  await wait(()=>!!d.getElementById('consultaObras')?.textContent?.includes('Nenhum'));
  assert.equal(d.querySelectorAll('#equipe').length,1);assert.equal(d.querySelectorAll('#fechar').length,1);
  const engineer=d.getElementById('abrirPlanilhasMedicaoJose')!;
  assert.equal(d.getElementById('conteudo')!.contains(engineer),tab==='medicoes');
 }
 (d.getElementById('fechar') as HTMLElement).click();assert.match(d.getElementById('tituloEditor')!.textContent!,/Holambra/);(d.getElementById('cancelarEditor') as HTMLElement).click();
 (d.getElementById('importarPlanilha') as HTMLElement).click();assert.ok(d.getElementById('arquivoImportacao'));(d.getElementById('cancelarEditor') as HTMLElement).click();
 const filtro=d.getElementById('buscaObra') as HTMLInputElement;filtro.value='pintura';filtro.dispatchEvent(new w.Event('input',{bubbles:true}));assert.match(d.querySelector('#joseObraFiltros>summary')!.textContent!,/1/);
 (d.getElementById('limparFiltros') as HTMLElement).click();assert.equal(d.querySelector('#joseObraFiltros>summary')!.textContent,'Filtrar registros');
 // Esperar o debounce de consulta antes de liberar o DOM.
 await new Promise(r=>setTimeout(r,300));
 }finally{dom.window.close();}
});
test('SBA conserva barra e filtros originais, sem receber a organização do José',async()=>{
 const {dom,d}=ambiente(2);try{await wait(()=>!!d.getElementById('consultaObras')?.textContent?.includes('Nenhum'));
 assert.equal(d.body.classList.contains('jose-obras-organizada'),false);assert.equal(d.getElementById('joseObraMais'),null);assert.equal(d.querySelectorAll('.toolbar>button').length,6);assert.equal(d.getElementById('filtros')!.parentElement?.tagName,'MAIN');
 }finally{dom.window.close();}
});

test('sem equipe, lançar abre cadastro direto; salvar disponibiliza o colaborador para as diárias',async()=>{
 const {dom,w,d,writes}=ambiente(5,true);try{
 await wait(()=>!!d.getElementById('novoColaboradorDireto'));
 (d.getElementById('apontar') as HTMLElement).click();assert.equal(d.getElementById('tituloEditor')!.textContent,'Novo colaborador');
 for(const [nome,v] of [['nome','Colaborador de validação'],['funcao','Pedreiro'],['diaria','150']]) (d.querySelector('#editor [name="'+nome+'"]') as HTMLInputElement).value=v;
 const form=d.getElementById('formEditor') as HTMLFormElement;form.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:d.getElementById('salvarEditor')}));
 await wait(()=>writes.length===1&&!d.getElementById('editor')!.hasAttribute('open'));
 assert.equal(writes[0].ativo,true);assert.equal(writes[0].nome,'Colaborador de validação');assert.equal(writes[0].diaria,'150');
 (d.getElementById('apontar') as HTMLElement).click();assert.ok(d.querySelector('[data-jose-pessoa="2"]'));assert.match(d.getElementById('tituloEditor')!.textContent!,/Lançar mão de obra/);
 (d.getElementById('cancelarEditor') as HTMLElement).click();await new Promise(r=>setTimeout(r,15));
 }finally{dom.window.close();}
});
