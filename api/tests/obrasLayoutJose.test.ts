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
 const obra={id:9,nome:'Holambra',clienteId:1,valorContrato:100000,etapas:[] as any[],apontamentos:[],despesas:[],medicoes:[] as any[],financeiro:[] as any[],resumo:{custoTotal:0,custoMaoObra:0,custoDespesas:0,medido:0,recebido:0,aReceber:0}};
 Object.assign(w,{API_URL:'https://api.test'});
 const equipe:any[]=semEquipe?[]:[{id:1,nome:'João',ativo:true,diaria:100}],writes:any[]=[];
 w.fetch=async(url:any,options:any={})=>{const p=new URL(url).pathname;let data:any={};
 if(p==='/empresas/me')data={empresaid:empresaId,slug:empresaId===5?'construarty':'sba',configuracaoSistema:{modulos:{obras:true,propostas:true}}};
 else if(p==='/obras')data=[obra];else if(p==='/obras/colaboradores'){if(options.method==='POST'){const b=JSON.parse(options.body);writes.push(b);data={id:2,...b};equipe.push(data);}else data=equipe;}else if(p.endsWith('/consulta'))data={itens:[],total:0,paginas:1};else if(p==='/obras/9')data=obra;else if(p==='/obras/propostas-disponiveis')data=[];
 else if(p==='/obras/planilhas/previa'){
  const b=JSON.parse(options.body);
  const reconhecida=Boolean(b.mapeamentos?.[0]);
  data={hash:'teste',valida:true,avisos:[],abas:[{indice:0,nome:'Engenharia',reconhecida,cabecalho:2,
   amostra:[{linha:2,celulas:[{coluna:'A',valor:'Item'},{coluna:'B',valor:'Descrição'},{coluna:'C',valor:'Valor total'},{coluna:'D',valor:'Medição 1'}]}],
   itens:reconhecida?[{item:'A1',descricao:'Perfuração',valor:10000}]:[],
   medicoes:reconhecida?[{numero:1,titulo:'Medição 01',data:'2026-10-10'}]:[]}]};
 }
 else if(p==='/obras/planilhas/importar'){writes.push(JSON.parse(options.body));data={id:77};}
 else if(p==='/obras/planilhas')data=[{id:77,nome:'Escopo importado'}];
 else if(p==='/obras/planilhas/77')data={id:77,obraId:9,edicoes:{},abas:[{
  indice:0,reconhecida:true,itens:[{linha:12,item:'A1',etapa:'Fundação',descricao:'Perfuração',valor:10000,percentuais:{1:20,2:15},valoresMedidos:{1:2000,2:1500}}],
  medicoes:[{numero:1,titulo:'Medição 01',data:'2026-10-10'},{numero:2,titulo:'Medição 02 — Previsão',data:'2026-10-25',prevista:true}],
 }]};
 else if(p==='/obras/medicoes'){writes.push(JSON.parse(options.body));data={id:13};}
 else if(p==='/financeiro/contas')data=[{contafinanceiraid:3,nome:'Banco',ativo:true}];
 else if(p==='/financeiro/lancamentos/20/baixar'){
  const b=JSON.parse(options.body);writes.push(b);
  obra.financeiro[0].valorPago+=Number(b.valorPago);
 }
 else assert.fail('Requisição inesperada: '+p);
 return {ok:true,json:async()=>data} as any;
 };
 for(const p of ['obras','obras-operacao','obras-jose-simples','obras-propostas-jose','obras-planilhas-link','obras-jose-layout'])w.eval(read('js/'+p+'.js'));
 return {dom,w,d,writes,obra};
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
 (d.querySelector('[data-tab="medicoes"]') as HTMLElement).click();
 await wait(()=>!!d.getElementById('consultaObras')?.textContent?.includes('Nenhum'));
 assert.equal(d.getElementById('joseEscopoCivil'),null);
 }finally{dom.window.close();}
});

test('José consulta a composição e registra recebimento na cobrança da medição selecionada',async()=>{
 const {dom,w,d,writes,obra}=ambiente();
 try{
  obra.etapas=[{id:1,nome:'Fundação',valor:60000},{id:2,nome:'Revestimento',valor:40000}];
  obra.medicoes=[
   {id:2,fim:'2026-10-25',status:'RASCUNHO',valor:22000,itens:[{etapaId:1,anterior:25,atual:50,valor:15000},{etapaId:2,anterior:0,atual:17.5,valor:7000}]},
   {id:1,fim:'2026-10-10',status:'APROVADA',valor:15000,lancamentoId:20,itens:[{etapaId:1,anterior:0,atual:25,valor:15000},{etapaId:2,anterior:0,atual:0,valor:0}]},
  ];
  obra.financeiro=[{lancamentofinanceiroid:20,status:'ABERTO',valor:15000,valorPago:2000}];
  await wait(()=>!!d.getElementById('joseObraEquipeAcoes'));
  (d.querySelector('[data-tab="medicoes"]') as HTMLElement).click();
  const linha=()=>Array.from(d.querySelectorAll('#joseEscopoCivil tbody tr:first-child > *'),c=>c.textContent);
  assert.deepEqual(linha().slice(3,6),['60%','25%','50%']);
  assert.match(linha()[7]!,/30\.000,00/);
  assert.equal(d.getElementById('joseReceberMedicao'),null);
  const select=d.getElementById('joseEscopoMedicao') as HTMLSelectElement;
  select.value='1';select.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.match(linha()[7]!,/15\.000,00/);
  (d.getElementById('joseReceberMedicao') as HTMLElement).click();
  await wait(()=>d.getElementById('editor')!.hasAttribute('open'));
  const preencher=(nome:string,valor:string)=>{(d.querySelector('#editor [name="'+nome+'"]') as HTMLInputElement).value=valor;};
  preencher('valorPago','500');preencher('dataPagamento','2026-10-10');preencher('contaFinanceiraId','3');
  d.getElementById('formEditor')!.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true}));
  await wait(()=>d.querySelector('.jose-escopo-recebimento')?.textContent?.includes('2.500,00')===true);
  assert.deepEqual(writes,[{valorPago:'500',dataPagamento:'2026-10-10',contaFinanceiraId:'3'}]);
  (d.getElementById('medir') as HTMLElement).click();
  await wait(()=>d.querySelector('#editor input[name="fim"]')?.parentElement?.textContent?.includes('Data da medição')===true);
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

test('planilha importada aparece no mesmo escopo e mantém as previsões separadas da medição selecionada',async()=>{
 const {dom,w,d}=ambiente();
 try{
  await wait(()=>!!d.getElementById('joseObraEquipeAcoes'));
  (d.querySelector('[data-tab="medicoes"]') as HTMLElement).click();
  const selecionar=(id:string,v:string)=>{
   const el=d.getElementById(id) as HTMLSelectElement;
   el.value=v;el.dispatchEvent(new w.Event('change',{bubbles:true}));
  };
  await wait(()=>Boolean(d.querySelector('#joseEscopoFonte option[value="77"]')));
  selecionar('joseEscopoFonte','77');
  await wait(()=>d.getElementById('joseEscopoCivil')?.textContent?.includes('Perfuração')===true);
  assert.equal((d.getElementById('joseEscopoMedicao') as HTMLSelectElement).value,'1');
  assert.match(d.querySelector('#joseEscopoCivil tbody tr')!.textContent!,/2\.000,00/);
  selecionar('joseEscopoMedicao','2');
  assert.match(d.querySelector('#joseEscopoCivil tbody tr')!.textContent!,/3\.500,00/);
  assert.equal(d.getElementById('joseReceberMedicao'),null);
  await wait(()=>Boolean(d.querySelector('#joseEscopoFonte option[value="77"]')));
  selecionar('joseEscopoFonte','');
  await wait(()=>!d.getElementById('joseEscopoCivil')?.textContent?.includes('Perfuração'));
 }finally{dom.window.close();}
});

test('importação na aba de medições permite corrigir os campos e abre o resultado na mesma tela',async()=>{
 const {dom,w,d,writes}=ambiente();
 try{
  await wait(()=>!!d.getElementById('joseObraEquipeAcoes'));
  (d.querySelector('[data-tab="medicoes"]') as HTMLElement).click();
  (d.getElementById('joseImportarMedicao') as HTMLElement).click();
  const input=d.getElementById('joseExcelMedicao')!;
  Object.defineProperty(input,'files',{value:[{name:'engenharia.xlsx',size:150,arrayBuffer:async()=>new Uint8Array([80,75]).buffer}]});
  const enviar=()=>d.getElementById('formEditor')!.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true}));
  enviar();
  await wait(()=>!!d.getElementById('joseValidarMapa')&&!(d.getElementById('salvarEditor') as HTMLButtonElement).disabled);
  assert.equal(d.getElementById('salvarEditor')?.hasAttribute('hidden'),true);
  (d.getElementById('joseValidarMapa') as HTMLElement).click();
  await wait(()=>d.getElementById('camposEditor')?.textContent?.includes('Perfuração')===true);
  enviar();
  await wait(()=>d.getElementById('joseEscopoCivil')?.textContent?.includes('Perfuração')===true);
  await wait(()=>!d.getElementById('editor')?.hasAttribute('open'));
  assert.equal(writes[0].mapeamentos[0].colunasMedicoes,'D');
  assert.equal(writes[0].mapeamentos[0].valor,'C');
  assert.equal(writes[0].obraId,9);
 }finally{dom.window.close();}
});

test('avanço por item é editável na tabela, recalcula a cobrança e salva o acumulado',async()=>{
 const {dom,w,d,writes,obra}=ambiente();
 try{
  obra.etapas=[{id:12,nome:'A1 Fundação',valor:10000}];
  obra.valorContrato=10000;
  obra.medicoes=[{id:12,status:'APROVADA',observacoes:'Marco inicial importado da engenharia · Planilha #77 · Aba #0',inicio:'2026-10-10',fim:'2026-10-10',valor:2000,itens:[{etapaId:12,anterior:0,atual:20,valor:2000}]}];
  await wait(()=>!!d.getElementById('joseObraEquipeAcoes'));
  (d.querySelector('[data-tab="medicoes"]') as HTMLElement).click();
  (d.getElementById('medir') as HTMLElement).click();
  const campo=d.querySelector('[data-avanco-item="12"]') as HTMLInputElement;
  assert.ok(campo);campo.value='15';campo.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.match(d.getElementById('joseTotalAvanco')!.textContent!,/1\.500,00/);
  assert.equal(d.querySelector('[data-avanco-acumulado]')!.textContent,'35%');
  (d.getElementById('joseConferirAvanco') as HTMLElement).click();
  assert.equal((d.querySelector('#editor [name="etapa_12"]') as HTMLInputElement).value,'15');
  d.getElementById('formEditor')!.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true}));
  await wait(()=>writes.length===1&&!d.getElementById('editor')!.hasAttribute('open'));
  assert.deepEqual(writes[0].itens,[{etapaId:12,atual:35}]);
 }finally{dom.window.close();}
});
