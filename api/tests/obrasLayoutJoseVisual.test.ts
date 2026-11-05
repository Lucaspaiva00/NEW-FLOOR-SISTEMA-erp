import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
test('gestão de obras do José tem barra compacta, ações contextuais e modais utilizáveis no desktop e celular',{skip:process.env.ERP_VISUAL_CHECK!=='1'},async()=>{
 const web=path.resolve(process.cwd(),'../web'),bootstrap=await fetch('https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css');assert.equal(bootstrap.ok,true);
 const css=await bootstrap.text(),browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
 try{const page=await browser.newPage(),errors:string[]=[],writes:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
 const obra={id:9,nome:'Cronograma Holambra',clienteId:1,valorContrato:100000,etapas:[],apontamentos:[],despesas:[],medicoes:[],financeiro:[],resumo:{custoTotal:0,custoMaoObra:0,custoDespesas:0,medido:0,recebido:0,aReceber:0}};
 await page.evaluateOnNewDocument(()=>localStorage.setItem('usuarioLogado',JSON.stringify({token:'teste-sem-credenciais',usuario:{role:'ADMIN',nome:'José'}})));
 await page.setRequestInterception(true);page.on('request',r=>{void(async()=>{
 const url=new URL(r.url()),cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,OPTIONS'};
 if(r.method()==='OPTIONS')return r.respond({status:204,headers:cors});
 if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.endsWith('bootstrap.min.css'))return r.respond({contentType:'text/css',body:css});
 if(url.hostname==='erp.test'){
  const file=path.join(web,url.pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file))return r.abort();
  const type=({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'} as any)[path.extname(file)]||'application/octet-stream';
  return r.respond({contentType:type,body:fs.readFileSync(file)});
 }
 if(url.hostname==='new-floor-sistema-erp.onrender.com'){
  if(r.method()!=='GET'){writes.push(r.method()+' '+url.pathname);return r.abort();}
  let data:any={};const p=url.pathname;
  if(p==='/empresas/me')data={empresaid:5,nome:'ConstruArty',slug:'construarty',configuracaoSistema:{modulos:{obras:true,propostas:true}}};
  else if(p==='/obras')data=[obra];else if(p==='/obras/colaboradores')data=[{id:1,nome:'João',ativo:true,diaria:100}];else if(p.endsWith('/consulta'))data={itens:[],total:0,paginas:1};else if(p==='/obras/9')data=obra;else if(p==='/obras/propostas-disponiveis')data=[];
  return r.respond({contentType:'application/json',headers:cors,body:JSON.stringify(data)});
 }
 return r.abort();})().catch(()=>{if(!r.isInterceptResolutionHandled())void r.abort();});});
 async function centro(){const r=await page.$eval('#editor',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight};});assert.ok(Math.abs(r.x+r.w/2-r.vw/2)<3,JSON.stringify(r));assert.ok(Math.abs(r.y+r.h/2-r.vh/2)<3,JSON.stringify(r));}
 for(const [width,height] of [[1440,1000],[390,844]]){
  await page.setViewport({width,height});await page.goto('https://erp.test/obras.html',{waitUntil:'networkidle0'});
  await page.waitForSelector('#joseObraEquipeAcoes');await page.waitForFunction(()=>document.querySelector('#consultaObras')?.textContent?.includes('Nenhum'));
  assert.equal(await page.$eval('body',e=>e.scrollWidth<=innerWidth),true);
  assert.equal(await page.$$eval('.toolbar>button',bs=>bs.filter(b=>b.getClientRects().length).length),1);
  assert.equal(await page.$eval('#joseObraFiltros',e=>(e as HTMLDetailsElement).open),false);
  await page.locator('#joseObraEquipeAcoes>summary').click();await page.locator('#equipe').click();await page.waitForSelector('#editor[open]');await centro();await page.locator('#cancelarEditor').click();
  await page.locator('[data-tab="medicoes"]').click();await page.waitForFunction(()=>document.querySelector('.section-head')?.contains(document.getElementById('abrirPlanilhasMedicaoJose')));
  await page.locator('[data-tab="custos"]').click();await page.waitForFunction(()=>document.getElementById('joseObraGuardar')?.contains(document.getElementById('abrirPlanilhasMedicaoJose')));
  await page.locator('#joseObraMais>summary').click();await page.waitForSelector('#importarPlanilha',{visible:true,timeout:5000}).catch(async e=>{throw Error(String(e)+' · '+JSON.stringify(await page.evaluate(()=>({menu:document.getElementById('joseObraMais')?.outerHTML,errors:document.getElementById('mensagem')?.textContent}))));});await page.locator('#importarPlanilha').click();await page.waitForSelector('#arquivoImportacao');await centro();await page.locator('#cancelarEditor').click();
 }
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
