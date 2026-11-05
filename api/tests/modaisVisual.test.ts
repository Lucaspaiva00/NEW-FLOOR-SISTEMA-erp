import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
// Chrome não é permitido no ambiente local. No deploy este teste é obrigatório.
test('painel do desenvolvedor e modais reais ficam centralizados no desktop e celular',{skip:process.env.ERP_VISUAL_CHECK!=='1'},async()=>{
 const web=path.resolve(process.cwd(),'../web');
 const bootstrap=await fetch('https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css');
 assert.equal(bootstrap.ok,true);const bootstrapCss=await bootstrap.text();
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
 try{const page=await browser.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
 const empresa={empresaid:5,nome:'ConstruArty',slug:'construarty',ativo:true,totalUsuarios:2,usuarios30dias:1,totalClientes:2,totalPropostas:3,erros24h:1,notasComProblema:0,ultimoLogin:'2026-11-05T12:00:00Z',usuarios:[{usuarioid:8,nome:'José Silva',role:'ADMIN',email:'jose@exemplo.com'}],configuracaoSistema:{perfil:'SBA',modulos:{obras:true,propostas:true}}};
 await page.evaluateOnNewDocument(()=>localStorage.setItem('usuarioLogado',JSON.stringify({token:'mock-sem-acesso-real',usuario:{role:'SUPER_ADMIN',nome:'Lucas Paiva'}})));
 await page.setRequestInterception(true);page.on('request',r=>{void(async()=>{
 const url=new URL(r.url());
 if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.endsWith('bootstrap.min.css'))return r.respond({contentType:'text/css',body:bootstrapCss});
 if(url.pathname==='/superadmin/resumo')return r.respond({contentType:'application/json',body:JSON.stringify({perfil:{nome:'Lucas'},geradoEm:new Date(),kpis:{ativas:3,empresas:4,usuarios:8,usuarios30dias:6,erros24h:1,notasComProblema:2},empresas:[empresa]})});
 if(url.pathname==='/superadmin/logs')return r.respond({contentType:'application/json',body:JSON.stringify({linhas:[],total:0,pagina:1,paginas:1})});
 if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.endsWith('bootstrap.bundle.min.js'))return r.respond({contentType:'text/javascript',body:fs.readFileSync(path.join(web,'vendor/bootstrap/bootstrap.bundle.min.js'))});
 if(url.hostname==='erp.test'){
 const file=path.join(web,url.pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file))return r.abort();
 const ext=path.extname(file),type=({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'} as any)[ext]||'application/octet-stream';
 return r.respond({contentType:type,body:fs.readFileSync(file)});
 }return r.abort();})().catch(()=>{if(!r.isInterceptResolutionHandled())void r.abort();});});
 async function centralizado(selector:string){const b=await page.$eval(selector,e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight};});
 assert.ok(Math.abs(b.x+b.w/2-b.vw/2)<3,JSON.stringify(b));assert.ok(Math.abs(b.y+b.h/2-b.vh/2)<3,JSON.stringify(b));assert.ok(b.y>=0&&b.y+b.h<=b.vh+1,JSON.stringify(b));}
 for(const [width,height] of [[1440,1000],[390,844]]){
  await page.setViewport({width,height});await page.goto('https://erp.test/empresas.html',{waitUntil:'networkidle0'});await page.waitForSelector('[data-sa-editar]');
  assert.equal(await page.$eval('body',e=>e.scrollWidth<=innerWidth),true);
  await page.click('[data-sa-editar]');await centralizado('dialog[open]');await page.click('dialog [data-fechar]');
  await page.click('[data-sa-config]');await centralizado('dialog[open]');await page.$eval('dialog',e=>e.close());
  await page.click('[data-bs-target="#modalEmpresa"]');await page.waitForSelector('#modalEmpresa.show');
  await new Promise(r=>setTimeout(r,400));await centralizado('#modalEmpresa .modal-content');
  await page.$eval('#modalEmpresa [data-bs-dismiss]',e=>(e as HTMLElement).click());await new Promise(r=>setTimeout(r,400));
 }
 assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
