import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import puppeteer from 'puppeteer';
test('seleção dos quinze contatos permanece centralizada e utilizável no desktop e celular',{skip:process.env.ERP_VISUAL_CHECK!=='1'},async()=>{
 const web=path.resolve(process.cwd(),'../web'),browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
 try{const page=await browser.newPage();for(const [width,height]of [[1440,1000],[390,844]]){
 await page.setViewport({width,height});await page.setContent('<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>');
 await page.addStyleTag({content:fs.readFileSync(path.join(web,'css/modais.css'),'utf8')+'\n'+fs.readFileSync(path.join(web,'css/contatos-cliente.css'),'utf8')});await page.addScriptTag({content:fs.readFileSync(path.join(web,'js/contatos-cliente.js'),'utf8')});
 await page.evaluate(()=>{(window as any).escolherEmailsCliente({email1:'contato1@example.invalid',contatosAdicionais:Array.from({length:14},(_,i)=>({nomeEmail:'Contato '+(i+2),email:`contato${i+2}@example.invalid`}))});});
 const b=await page.$eval('dialog',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight};});assert.ok(Math.abs(b.x+b.w/2-b.vw/2)<3);assert.ok(Math.abs(b.y+b.h/2-b.vh/2)<3);assert.ok(b.y>=0&&b.y+b.h<=height+1);assert.equal(await page.$$eval('input[name=destinatarios]',els=>els.length),15);
 await page.click('[data-todos]');assert.equal(await page.$$eval('input[name=destinatarios]:checked',els=>els.length),15);assert.equal(await page.$eval('body',e=>e.scrollWidth<=innerWidth),true);await page.click('[data-voltar]');await page.waitForFunction(()=>!document.querySelector('dialog'));assert.equal(await page.$('dialog'),null);
 }}finally{await browser.close();}
});
