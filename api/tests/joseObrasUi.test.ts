import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
const root=path.resolve(process.cwd(),'../web');
const script=fs.readFileSync(path.join(root,'js/obras-jose-simples.js'),'utf8');
async function ambiente(tenant:number){
 const dom=new JSDOM('<button data-tab="cronograma">Diárias realizadas</button><button id="equipe">Equipe</button><button id="fechar">Fechar</button><div id="conteudo"></div><p id="mensagem"></p><form id="formEditor"><div id="camposEditor"></div></form>',{runScripts:'outside-only'});
 const w=dom.window,d=w.document,calls:any[]=[];let submit:any,legacy=0;
 const u:any={obra:{id:2,nome:'Casa',resumo:{custoMaoObra:100}},pessoas:[{id:3,nome:'João',diaria:100,ativo:true}],tab:'cronograma',
 brl:(v:any)=>Number(v).toFixed(2),esc:(v:any)=>String(v),erro:(e:any)=>{throw e;},
 campo:(n:string,l:string,t='text',v='')=>'<label>'+l+'<input name="'+n+'" type="'+t+'" value="'+v+'"></label>',
 api:async(p:string,m?:string,b?:any)=>{if(p==='/empresas/me')return {empresaid:tenant,slug:tenant===5?'construarty':'sba'};calls.push({p,m,b});return {registros:1,total:100};},
 abrir:(_t:string,html:string,fn:any)=>{d.getElementById('camposEditor')!.innerHTML=html;submit=fn;},
 render:()=>{d.getElementById('conteudo')!.innerHTML='<div class="section-head"><h2>Equipe e cronograma</h2><button id="apontar">Apontar dia</button></div><p>Explicação antiga</p>';d.getElementById('apontar')!.addEventListener('click',()=>legacy++);}};
 Object.assign(w,{obrasUI:u});w.eval(script);await new Promise(r=>setTimeout(r,0));
 return {dom,d,w,u,calls,get submit(){return submit;},get legacy(){return legacy;}};
}
test('José lança equipe na obra escolhida, mostra total e não abre modal legado',async()=>{
 const a=await ambiente(5);try{
 a.d.getElementById('apontar')!.click();assert.equal(a.legacy,0);
 const pessoa=a.d.querySelector('[data-jose-pessoa]') as HTMLInputElement;pessoa.checked=true;
 const f=a.d.getElementById('formEditor') as HTMLFormElement;
 (f.elements.namedItem('inicio') as HTMLInputElement).value='2026-11-05';
 (f.elements.namedItem('fim') as HTMLInputElement).value='2026-11-06';
 pessoa.dispatchEvent(new a.w.Event('input',{bubbles:true}));
 assert.match(a.d.getElementById('joseTotalEquipe')!.textContent!,/200.00/);
 await a.submit({inicio:'2026-11-05',fim:'2026-11-06',fracao:'1'});
 assert.equal(a.calls[0].b.obraId,2);assert.equal(a.calls[0].b.periodo,true);
 assert.deepEqual(Array.from(a.calls[0].b.colaboradorIds),[3]);
 a.d.getElementById('fechar')!.click();await a.submit({inicio:'2026-11-05',fim:'2026-11-06',vencimento:'2026-11-10'});
 assert.equal(a.calls[1].b.obraId,2);
 }finally{a.dom.window.close();}
});
test('outros perfis mantêm mão de obra e ações originais',async()=>{
 const a=await ambiente(2);try{assert.equal(a.d.getElementById('equipe')!.textContent,'Equipe');assert.equal(a.d.querySelector('.jose-mao-resumo'),null);assert.equal(a.calls.length,0);}finally{a.dom.window.close();}
});
