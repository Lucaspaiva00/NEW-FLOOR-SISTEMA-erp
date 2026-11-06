import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import puppeteer from 'puppeteer';
test('orçamento SBA tem três guias com conteúdo, preço editável e modal centralizado no desktop e celular',{skip:process.env.ERP_VISUAL_CHECK!=='1'},async()=>{
 const web=path.resolve(process.cwd(),'../web'),read=(p:string)=>fs.readFileSync(path.join(web,p),'utf8'),bootstrap=await fetch('https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css');assert.equal(bootstrap.ok,true);const bootstrapCss=await bootstrap.text();
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
 try{const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.evaluateOnNewDocument(()=>{localStorage.setItem('usuarioLogado',JSON.stringify({token:'teste-sem-acesso-real'}));(window as any).__configuracaoSistema={perfil:'SBA',composicaoCustos:true,textoEscopo:''};});
 await page.setRequestInterception(true);page.on('request',r=>{void(async()=>{const url=new URL(r.url());
 if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.endsWith('bootstrap.min.css'))return r.respond({contentType:'text/css',body:bootstrapCss});
 if(url.pathname==='/clientes'||url.pathname==='/servicos'||url.pathname==='/fornecedores'||url.pathname==='/propostas')return r.respond({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:url.pathname==='/clientes'?JSON.stringify([{clienteid:1,razaoSocial:'Cliente',contatosAdicionais:Array.from({length:15},(_,i)=>({email:`pessoa${i}@example.invalid`,nomeEmail:'Contato '+i}))}]):'[]'});
 if(url.hostname==='erp.test'){const f=path.join(web,url.pathname);if(!f.startsWith(web+path.sep)||!fs.existsSync(f))return r.abort();let body:any=fs.readFileSync(f);if(url.pathname==='/orcamentos.html')body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');return r.respond({contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript'} as any)[path.extname(f)]||'application/octet-stream',body});}return r.abort();})().catch(()=>{if(!r.isInterceptResolutionHandled())void r.abort();});});
 for(const [width,height]of [[1440,1000],[390,844]]){
 await page.setViewport({width,height});await page.goto('https://erp.test/orcamentos.html',{waitUntil:'networkidle0'});
 await page.addScriptTag({content:read('vendor/bootstrap/bootstrap.bundle.min.js')});await page.addStyleTag({content:read('css/modal-tabs.css')+'\n'+read('css/modais.css')});
 await page.addScriptTag({content:"const API_URL='https://erp.test';"});for(const p of ['pagamento-sba','plano-recebimento','composicao-servicos','orcamentos','modal-tabs'])await page.addScriptTag({content:read('js/'+p+'.js')});
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('configuracao-sistema',{detail:(window as any).__configuracaoSistema})));await page.waitForSelector('.service-composition');await page.click('#novoOrcamento');await page.waitForSelector('#modalOrcamento.show');await new Promise(r=>setTimeout(r,350));
 assert.deepEqual(await page.$$eval('.subject-tabs>button',els=>els.map(e=>e.textContent)),['Dados','Serviços','Condições']);assert.equal(await page.$eval('#descricao',e=>getComputedStyle(e.closest('label')!).display),'none');
 await page.select('#cliente','1');await page.click('.budget-destinatarios input[aria-label]');assert.equal(await page.$$eval('.budget-destinatarios-lista input:checked',els=>els.length),15);
 await page.click('.subject-tabs>button:nth-child(2)');assert.equal(await page.$eval('.service-composition',e=>!!e.getBoundingClientRect().height),true);
 await page.click('.service-tabs>button:nth-child(4)');assert.equal(await page.$eval('[data-campo=valorUnitario]',e=>(e as HTMLInputElement).readOnly),false);await page.$eval('[data-campo=valorUnitario]',e=>{(e as HTMLInputElement).value='150';e.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.$eval('[data-campo=modoPreco]',e=>(e as HTMLSelectElement).value),'MANUAL');
 const b=await page.$eval('#modalOrcamento .modal-content',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});assert.ok(Math.abs(b.x+b.w/2-width/2)<3,JSON.stringify(b));assert.ok(Math.abs(b.y+b.h/2-height/2)<3,JSON.stringify(b));assert.ok(b.w<=width&&b.y>=0&&b.y+b.h<=height+1);
 await page.click('.subject-tabs>button:nth-child(3)');assert.equal(await page.$eval('#pagamento',e=>!!e.getBoundingClientRect().height),true);
 }assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
