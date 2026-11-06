import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {JSDOM} from 'jsdom';
const web=path.resolve(process.cwd(),'../web'),read=(p:string)=>fs.readFileSync(path.join(web,p),'utf8');
async function wait(f:()=>boolean){for(let i=0;i<100;i++){if(f())return;await new Promise(r=>setTimeout(r,5));}throw Error('Painel não carregou');}
function setup(role='SUPER_ADMIN'){
 const dom=new JSDOM(read('empresas.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://erp.test/empresas.html',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window as any,d=w.document,calls:string[]=[];
 w.localStorage.setItem('usuarioLogado',JSON.stringify({token:'mock',usuario:{role}}));w.API_URL='https://api.test';w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.dispatchEvent(new w.Event('close'));};
 const e={empresaId:2,nome:'SBA <exemplo>',ativo:true,clientes:3,contatosEmail:15,telefones:8,orcamentos:5,valorOrcamentos:10000,aprovadas:2,valorAprovadas:2000,faturadas:1,valorFaturado:1000,recebido:500,pago:200,aReceber:500,lucroEstimado:null,faturadasComCustos:0,semCustos:1,saldoCaixa:300};
 w.fetch=async(url:string)=>{calls.push(url);const detalhe=url.includes('/detalhes?');return {ok:true,json:async()=>detalhe?{linhas:[{id:1,empresaId:2,titulo:'<img src=x>',descricao:'Cliente',status:'FATURADA',quando:'2026-11-06',valor:1000}],total:70,pagina:Number(new URL(url).searchParams.get('pagina')),paginas:2}:{empresas:[e],total:e,empresasDisponiveis:[{empresaid:2,nome:e.nome}],geradoEm:new Date()}};};w.eval(read('js/superadmin-negocios.js'));return {dom,w,d,calls};
}
test('painel filtra empresa e período e abre detalhes paginados sem alterar dados',async()=>{
 const {dom,w,d,calls}=setup();try{await wait(()=>!!d.querySelector('[data-sn-tipo]'));assert.equal(d.querySelectorAll('#snKpis article').length,9);assert.match(d.getElementById('snKpis').textContent,/Sem custos/);assert.equal(d.querySelector('#snEmpresas img'),null);
 d.getElementById('snPeriodo').value='personalizado';d.getElementById('snPeriodo').onchange();d.getElementById('snInicio').value='2026-11-01';d.getElementById('snFim').value='2026-11-06';d.getElementById('snEmpresa').value='2';d.getElementById('snFiltros').onsubmit({preventDefault(){}});await wait(()=>calls.length===2);await new Promise(r=>setTimeout(r,0));assert.match(calls[1],/empresaId=2/);assert.match(calls[1],/inicio=2026-11-01/);
 d.querySelector('#snKpis [data-sn-tipo=faturadas]').click();await wait(()=>!!d.querySelector('.sa-detail-table'));assert.match(calls[2],/tipo=faturadas/);assert.match(calls[2],/empresaId=2/);assert.equal(d.querySelector('dialog img'),null);
 d.querySelector('dialog [data-proxima]').click();await wait(()=>calls.length===4);assert.match(calls[3],/pagina=2/);d.querySelector('dialog [data-fechar]').click();assert.equal(d.querySelector('dialog'),null);
 }finally{dom.window.close();}
});
test('perfil de cliente não solicita indicadores globais',async()=>{const {dom,calls}=setup('ADMIN');try{await new Promise(r=>setTimeout(r,0));assert.deepEqual(calls,[]);}finally{dom.window.close();}});
