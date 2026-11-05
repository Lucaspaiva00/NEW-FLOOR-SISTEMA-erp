import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
async function tela(perfil='SBA'){
 const eventos:any={},calls:any[]=[],dialogs:any[]=[];let confirmar=false;
 const area:any={children:[],querySelectorAll:()=>[],append(b:any){this.children.push(b);},addEventListener(n:string,fn:any){eventos[n]=fn;}};
 const context:any={API_URL:'https://erp-api.example',localStorage:{getItem:()=>JSON.stringify({token:'somente-laboratorio'})},window:{addEventListener:(n:string,fn:any)=>{eventos[n]=fn;}},document:{getElementById:(id:string)=>id==='sbaMotivoCancelamento'?{value:'9'}:id==='sbaJustificativaCancelamento'?{value:'Cancelamento solicitado para correção de laboratório.'}:area,createElement:()=>({dataset:{}}),querySelector:()=>null},Swal:{fire:async(d:any)=>{dialogs.push(d);return {isConfirmed:confirmar,value:confirmar&&d.preConfirm?await d.preConfirm():undefined};}},fetch:async(url:string,init:any)=>{calls.push({url,init});return {ok:true,json:async()=>url.endsWith('/empresas/me')?{slug:perfil==='SBA'?'sba':'new-floor',configuracaoSistema:{perfil}}:{status:'PROCESSANDO'}};},setTimeout,URL};
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

test('UI oferece cancelar somente nota autorizada da integração direta e Voltar não envia',async()=>{
 const a=await tela();Object.assign(a.nota,{status:'AUTORIZADA',diretaProducaoSba:true,chave:'2'.repeat(50),numero:'25'});a.abrir();const b=a.area.children.find((b:any)=>b.dataset.sbaTransmissao==='cancelar-producao');assert.ok(b);await a.eventos.click({target:{closest:()=>b}});assert.equal(a.calls.length,1);assert.match(a.dialogs[0].title,/25/);
 const p=await tela();Object.assign(p.nota,{status:'AUTORIZADA',diretaProducaoSba:true,cancelamentoPendente:true});p.abrir();assert.equal(p.area.children.some((b:any)=>b.dataset.sbaTransmissao==='cancelar-producao'),false);assert.ok(p.area.children.some((b:any)=>b.dataset.sbaTransmissao==='consultar-cancelamento'));
});
test('UI cancelamento exige dois passos e envia motivo, justificativa, chave e versão',async()=>{
 const a=await tela();Object.assign(a.nota,{status:'AUTORIZADA',diretaProducaoSba:true,chave:'2'.repeat(50),numero:'25'});a.abrir();a.confirmar();const b=a.area.children.find((b:any)=>b.dataset.sbaTransmissao==='cancelar-producao');await a.eventos.click({target:{closest:()=>b}});
 const r=a.calls.find((r:any)=>r.url.endsWith('/cancelar-producao'));assert.ok(r);const body=JSON.parse(r.init.body);assert.equal(body.confirmacao,'CANCELAR_NFSE_REAL');assert.equal(body.chaveConfirmada,'2'.repeat(50));assert.equal(body.codigoMotivo,'9');assert.equal(body.versaoConfirmada,a.nota.versao);assert.match(a.dialogs[1].title,/Confirmar cancelamento fiscal/);
});
