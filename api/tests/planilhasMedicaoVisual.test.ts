import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
test('medições mostram serviços e ocultam leitura técnica no desktop e celular',{skip:process.env.ERP_VISUAL_CHECK!=='1'},async()=>{
 const web=path.resolve(process.cwd(),'../web'),bootstrap=await fetch('https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css');assert.equal(bootstrap.ok,true);
 const css=await bootstrap.text(),browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
 try{const page=await browser.newPage(),errors:string[]=[],writes:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
 const aba={indice:1,nome:'Civil',reconhecida:true,itens:[{linha:12,item:'1',descricao:'Alvenaria',quantidade:10,unidade:'m²',valor:1000,percentuais:{1:0}}],medicoes:[{numero:1,coluna:12,titulo:'Medição 1'}],amostra:[]};
 let importada=false;const arquivo=path.join(process.cwd(),'medicao-visual.xlsx');fs.writeFileSync(arquivo,'fixture com API simulada');
 await page.evaluateOnNewDocument(()=>localStorage.setItem('usuarioLogado',JSON.stringify({token:'teste-sem-credenciais',usuario:{role:'ADMIN',nome:'José'}})));
 await page.setRequestInterception(true);page.on('request',r=>{void(async()=>{
 const url=new URL(r.url()),cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,PUT,OPTIONS'};
 if(r.method()==='OPTIONS')return r.respond({status:204,headers:cors});
 if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.endsWith('bootstrap.min.css'))return r.respond({contentType:'text/css',body:css});
 if(url.hostname==='erp.test'){
  const file=path.join(web,url.pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file))return r.abort();
  const type=({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'} as any)[path.extname(file)]||'application/octet-stream';
  return r.respond({contentType:type,body:fs.readFileSync(file)});
 }
 if(url.hostname==='new-floor-sistema-erp.onrender.com'){
  let data:any={};const p=url.pathname;
  if(p==='/empresas/me')data={empresaid:5,nome:'ConstruArty',slug:'construarty',configuracaoSistema:{modulos:{obras:true,propostas:true}}};
  else if(p==='/obras')data=[{id:9,nome:'Holambra'}];
  else if(p==='/obras/planilhas/previa')data={abas:[aba],avisos:[],valida:true,hash:'abc'};
  else if(p==='/obras/planilhas/importar'){importada=true;data={id:7};}
  else if(p==='/obras/planilhas')data=importada?[{id:7,nome:'Civil',arquivoNome:'medicao-visual.xlsx',updatedAt:'2026-11-05'}]:[];
  else if(p==='/obras/planilhas/7')data={id:7,nome:'Civil',abas:[aba],edicoes:{}};
  else if(r.method()!=='GET'){writes.push(r.method()+' '+p);return r.abort();}
  return r.respond({contentType:'application/json',headers:cors,body:JSON.stringify(data)});
 }
 return r.abort();})().catch(()=>{if(!r.isInterceptResolutionHandled())void r.abort();});});
 for(const [width,height] of [[1440,1000],[390,844]]){
  await page.setViewport({width,height});await page.goto('https://erp.test/planilhas-medicao.html?obra=9',{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.querySelector<HTMLSelectElement>('#pmObra')?.value==='9');
  await page.locator('#pmAdicionar').click();const input=await page.$('#pmArquivo');await input!.uploadFile(arquivo);await page.locator('#pmPrever').click();await page.waitForSelector('#pmConfirmar');
  assert.equal(await page.$eval('#pmAjustesLeitura',e=>(e as HTMLDetailsElement).open),false);
  assert.match(await page.$eval('#pmServicosPrevia',e=>e.textContent!),/Alvenaria/);
  assert.equal(await page.$eval('body',e=>e.scrollWidth<=innerWidth),true);
  assert.ok(await page.$eval('.pm-servicos-previa',e=>e.getBoundingClientRect().height<=362));
  await page.locator('#pmConfirmar').click();await page.waitForSelector('#pmEditor',{visible:true});
  assert.equal(await page.$eval('#pmImportador',e=>(e as HTMLElement).hidden),true);
  assert.equal(await page.$eval('#pmEditor .pm-historico',e=>getComputedStyle(e).display),'none');
  await page.locator('#pmMostrarAcumulado').click();assert.equal(await page.$eval('#pmEditor .pm-historico',e=>getComputedStyle(e).display),'table-cell');
  assert.equal(await page.$eval('body',e=>e.scrollWidth<=innerWidth),true);
 }
 fs.unlinkSync(arquivo);
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
