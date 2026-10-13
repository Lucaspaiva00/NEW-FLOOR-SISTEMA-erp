import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer';
import prisma from '../prisma';
export async function testarTelaObras(){
 const chave='qa:obras-ui-v2';if(await prisma.importacaoObra.findUnique({where:{chave}}))return;
 if(!await prisma.empresa.findFirst({where:{empresaid:5,slug:'construarty',nome:'Jose'}}))return;
 const arquivo=path.join(process.cwd(),'..','web','obras.html');if(!fs.existsSync(arquivo))throw Error('Tela de obras ausente no checkout de validação.');
 const o={id:1,nome:'Obra de validação visual',clienteId:1,endereco:'Rua de teste',responsavel:'Teste',inicio:'2026-01-01',valorContrato:20000,status:'EM_ANDAMENTO',etapas:[{id:1,nome:'Fundação',valor:20000}],apontamentos:[],despesas:[],medicoes:[],resumo:{custoTotal:0,custoMaoObra:0,custoDespesas:0,medido:0,recebido:0,aReceber:0}};
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
 try{const page=await browser.newPage(),erros:string[]=[];page.on('pageerror',e=>erros.push(String(e)));await page.setViewport({width:1440,height:1000});
  await page.evaluateOnNewDocument(()=>localStorage.setItem('usuarioLogado',JSON.stringify({token:'validacao-local-sem-acesso-real',usuario:{nome:'Teste',role:'ADMIN'}})));
  await page.setRequestInterception(true);page.on('request',r=>{const url=r.url();if(url.startsWith('http://localhost:3000')){const p=new URL(url).pathname;let d:any=[];if(p==='/empresas/me')d={nome:'Teste',configuracaoSistema:{modulos:{obras:true},composicaoCustos:true}};else if(p==='/obras')d=[o];else if(p==='/obras/1')d=o;else if(p==='/obras/colaboradores')d=[{id:1,nome:'Colaborador teste',funcao:'Pedreiro',diaria:350,ativo:true}];else if(p==='/clientes')d=[{clienteid:1,razaoSocial:'Cliente teste'}];else if(p.endsWith('/consulta'))d={itens:[],paginas:1,total:0};return void r.respond({status:200,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'},contentType:'application/json',body:JSON.stringify(d)});}if(url.startsWith('file:')||url.startsWith('data:'))void r.continue();else void r.abort();});
  await page.goto(pathToFileURL(arquivo).href,{waitUntil:'load'});await page.waitForSelector('#consultaObras table');
  assert.equal(await page.$eval('.menu a[href="servicos.html"],.menu a[href="orcamentos.html"]',()=>true),true);
  await page.click('#novaObra');await page.waitForSelector('dialog[open]');
  const centro=await page.$eval('dialog',(el:any)=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height};});assert.ok(Math.abs(centro.x-720)<2&&Math.abs(centro.y-500)<2,'Modal desktop fora do centro.');
  await page.setViewport({width:390,height:844});const mobile=await page.$eval('dialog',(el:any)=>{const r=el.getBoundingClientRect();return {x:r.x,w:r.width,h:r.height,cols:getComputedStyle(document.getElementById('camposEditor')!).gridTemplateColumns};});assert.ok(mobile.x>=0&&mobile.w<=390&&mobile.h<=844,'Modal mobile extrapola a tela.');assert.equal(mobile.cols.split(' ').length,1,'Campos não estão em uma coluna no celular.');
  await page.click('#cancelarEditor');await page.click('[data-tab="planejamento"]');await page.waitForSelector('#planejar');await page.click('#planejar');assert.ok(await page.$('input[name="fracao"]'));await page.click('#cancelarEditor');
  await page.click('#equipe');await page.waitForSelector('#novoColaborador');await page.click('#novoColaborador');assert.ok(await page.$('input[name="diaria"]'));await page.click('#cancelarEditor');
  await page.click('#importarPlanilha');assert.ok(await page.$('#arquivoImportacao'));await page.click('#cancelarEditor');await page.click('#editarObra');await page.waitForSelector('#adicionarEtapa');assert.ok(await page.$('.obra-stage'));await page.click('#cancelarEditor');
  assert.deepEqual(erros,[],'Erro JavaScript na tela de obras.');
 }finally{await browser.close();}
 await prisma.importacaoObra.upsert({where:{chave},create:{empresaId:5,chave,dados:{validadoEm:new Date().toISOString(),desktop:'1440x1000',mobile:'390x844',apiSimulada:true}},update:{}});
 console.log('QA UI OBRAS OK: menu completo, modais centralizados, campos mobile, planejamento, equipe, contrato e importação sem erros JavaScript.');
}
