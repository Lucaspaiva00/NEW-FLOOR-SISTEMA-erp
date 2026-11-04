import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
async function tela(perfil='SBA'){
 const eventos:any={},calls:any[]=[],dialogs:any[]=[];let confirmar=false;
 const area:any={children:[],querySelectorAll:()=>[],append(b:any){this.children.push(b);},addEventListener(n:string,fn:any){eventos[n]=fn;}};
 const context:any={API_URL:'https://erp-api.example',localStorage:{getItem:()=>JSON.stringify({token:'somente-laboratorio'})},window:{addEventListener:(n:string,fn:any)=>{eventos[n]=fn;}},document:{getElementById:()=>area,createElement:()=>({dataset:{}}),querySelector:()=>null},Swal:{fire:async(d:any)=>{dialogs.push(d);return {isConfirmed:confirmar};}},fetch:async(url:string,init:any)=>{calls.push({url,init});return {ok:true,json:async()=>url.endsWith('/empresas/me')?{slug:perfil==='SBA'?'sba':'new-floor',configuracaoSistema:{perfil}}:{status:'PROCESSANDO'}};},setTimeout,URL};
 vm.runInNewContext(fs.readFileSync('../web/js/fiscal-sba-transmissao.js','utf8'),context);await new Promise(r=>setImmediate(r));
 const nota={id:99,tipo:'NFSE',status:'RASCUNHO',ambiente:'PRODUCAO',propostaId:137,valorTotal:4500.50,tomador:'Cliente de laboratório',documento:'12345678000195',versao:'2026-11-04T20:00:00.000Z'};
 return {area,calls,dialogs,nota,eventos,confirmar:()=>{confirmar=true;},abrir:()=>eventos['sba-nota-detalhe']({detail:nota}),clicar:async()=>{const b=area.children.find((b:any)=>b.dataset.sbaTransmissao==='transmitir-producao');await eventos.click({target:{closest:()=>b}});}};
}
test('UI SBA mostra valor/tomador reais e cancelar confirmação não transmite',async()=>{
 const a=await tela();a.abrir();assert.ok(a.area.children.some((b:any)=>b.textContent==='Emitir NFS-e em produção'));await a.clicar();assert.match(a.dialogs[0].title,/4\.500,50/);assert.match(a.dialogs[0].text,/Cliente de laboratório/);assert.equal(a.calls.length,1);
});
test('UI confirma valor e versão da nota, sem substituir pelo ensaio de R$ 1',async()=>{
 const a=await tela();a.abrir();a.confirmar();await a.clicar();const r=a.calls.find((c:any)=>c.url.endsWith('/transmitir-producao'));assert.ok(r);assert.deepEqual(JSON.parse(r.init.body),{versaoConfirmada:a.nota.versao,confirmacao:'EMITIR_NOTA_REAL',valorConfirmado:4500.50});
});
test('UI de outros perfis não recebe ações de emissão SBA',async()=>{const a=await tela('PADRAO');a.abrir();assert.equal(a.area.children.length,0);});
