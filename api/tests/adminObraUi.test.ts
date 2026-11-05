import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
const web=path.resolve(process.cwd(),'../web'),read=(p:string)=>fs.readFileSync(path.join(web,p),'utf8');
const wait=async(fn:()=>boolean)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('A operação não terminou.');};
test('painel mostra indicadores reais, filtra logs e edita nomes com IDs da empresa',async()=>{
 const html=read('empresas.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 const dom=new JSDOM(html,{url:'https://erp.test/empresas.html',runScripts:'outside-only'}),w=dom.window,d=w.document,calls:any[]=[];
 const empresa={empresaid:5,nome:'ConstruArty',slug:'construarty',ativo:true,totalUsuarios:1,usuarios30dias:1,totalClientes:2,totalPropostas:3,erros24h:0,notasComProblema:0,ultimoLogin:'2026-11-05T12:00:00Z',usuarios:[{usuarioid:8,nome:'José',role:'ADMIN',email:'jose@exemplo.com'}]};
 w.localStorage.setItem('usuarioLogado',JSON.stringify({token:'teste',usuario:{role:'SUPER_ADMIN',nome:'Lucas'}}));
 Object.assign(w,{API_URL:'https://api.test',bootstrap:{Modal:{getInstance:()=>({hide(){}})}}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 w.fetch=async(url:any,opts:any={})=>{calls.push({url,opts});let data:any={};
 if(url.includes('/resumo'))data={perfil:{nome:'Lucas'},geradoEm:'2026-11-05T12:00:00Z',kpis:{ativas:1,empresas:1,usuarios:1,usuarios30dias:1,erros24h:0,notasComProblema:0},empresas:[empresa]};
 if(url.includes('/logs?'))data={linhas:[],pagina:1,paginas:1,total:0};
 return {ok:true,status:200,json:async()=>data} as any;};
 try{w.eval(read('js/empresas.js'));await wait(()=>!!d.querySelector('[data-sa-editar]'));
 assert.match(d.getElementById('saKpis')!.textContent!,/Acessaram em 30 dias/);assert.match(d.getElementById('listaEmpresas')!.textContent!,/José/);
 (d.querySelector('[data-sa-editar]') as HTMLElement).click();const form=d.querySelector('dialog form') as HTMLFormElement;
 (form.elements.namedItem('nome') as HTMLInputElement).value='Construtora José';(form.elements.namedItem('admin_8') as HTMLInputElement).value='José Silva';
 form.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:form.querySelector('[type=submit]')}));
 await wait(()=>calls.some(c=>c.opts.method==='PATCH'));
 const change=JSON.parse(calls.find(c=>c.opts.method==='PATCH').opts.body);assert.equal(change.nome,'Construtora José');assert.equal(change.administradores[0].id,8);assert.equal(change.administradores[0].nome,'José Silva');assert.equal(change.slug,undefined);
 (d.getElementById('saEmpresa') as HTMLSelectElement).value='5';(d.getElementById('saErros') as HTMLInputElement).checked=true;d.getElementById('saFiltros')!.dispatchEvent(new w.Event('submit',{cancelable:true}));
 await wait(()=>calls.some(c=>c.url.includes('empresaId=5')&&c.url.includes('erros=true')));
 await wait(()=>!d.querySelector('dialog')&&!!d.getElementById('saLogs')?.textContent?.includes('Nenhum evento'));
 await new Promise(r=>setTimeout(r,15));
 }finally{dom.window.close();}
});
function obraAmbiente(tenant=5,vinculada=false){
 const dom=new JSDOM('<button id="novaObra"></button><select id="obraSelecionada"><option value="9">Obra</option></select><form id="formEditor"><div id="camposEditor"></div><button id="salvarEditor"></button></form>',{url:'https://erp.test/obras.html?proposta=652',runScripts:'outside-only'}),w=dom.window,d=w.document,calls:any[]=[];let submit:any;
 const p={propostaId:652,numero:'652',nome:'Holambra',clienteNome:'Cliente',clienteId:7,valorContrato:100000,endereco:'Rua A',responsavel:'José',etapas:[{nome:'Fundação',valor:100000}],obra:vinculada?{id:9,nome:'Holambra'}:null};
 const u={admin:true,brl:(v:any)=>Number(v).toFixed(2),esc:(v:any)=>String(v||''),erro:(e:any)=>{throw e;},campo:(n:string,l:string,t:string,v:string,e:string)=>'<label>'+l+'<input name="'+n+'" type="'+t+'" value="'+(v||'')+'"></label>',tabela:()=>'<table>Etapas</table>',carregar:async()=>{},detalhe:async()=>{},abrir:(_t:string,html:string,fn:any)=>{d.getElementById('camposEditor')!.innerHTML=html;submit=fn;},api:async(p:string,m?:string,b?:any)=>{if(p==='/empresas/me')return {empresaid:tenant,slug:tenant===5?'construarty':'sba'};if(p==='/obras/propostas-disponiveis')return [pData];calls.push({p,m,b});return {id:9};}};
 const pData=p;Object.assign(w,{obrasUI:u});w.eval(read('js/obras-propostas-jose.js'));return {dom,w,d,calls,get submit(){return submit;}};
}
test('criar obra aproveita proposta selecionada e pede apenas local, responsável e datas',async()=>{
 const a=obraAmbiente();try{await wait(()=>!!a.d.getElementById('obraPropostaDados')?.textContent?.includes('Holambra'));
 assert.equal((a.d.querySelector('[name=endereco]') as HTMLInputElement).value,'Rua A');assert.equal(a.d.querySelector('[name=nome]'),null);
 await a.submit({inicio:'2026-11-05',endereco:'Local confirmado',responsavel:'José'});assert.equal(a.calls[0].b.propostaId,652);assert.equal(a.calls[0].b.endereco,'Local confirmado');assert.equal(a.calls[0].b.valorContrato,undefined);
 }finally{a.dom.window.close();}
});
test('proposta vinculada abre obra existente e outros perfis não recebem o fluxo',async()=>{
 const a=obraAmbiente(5,true);try{await wait(()=>!!a.d.getElementById('obraPropostaDados')?.textContent?.includes('já está vinculada'));await a.submit({});assert.equal(a.calls.length,0);}finally{a.dom.window.close();}
 const b=obraAmbiente(2);try{await new Promise(r=>setTimeout(r,10));assert.equal(b.d.getElementById('obraDaProposta'),null);}finally{b.dom.window.close();}
});
