import {Request,Response,NextFunction} from 'express';
import prisma from '../prisma';
import {data,id,numero,texto,dinheiro,valorMedicao,htmlSeguro as h} from '../services/obras.service';
import puppeteer from 'puppeteer';
import {aprovarMedicao,apontarDia,fecharDiarias} from '../services/obrasOperacao.service';

export function acesso(req:Request,res:Response,next:NextFunction){
 if(!req.empresaId||req.configuracaoSistema?.modulos.obras!==true){res.status(403).json({error:'Gestão de obras não habilitada para esta empresa.'});return;}next();
}
const executar=(f:(req:Request,res:Response)=>Promise<void>)=>async(req:Request,res:Response)=>{try{await f(req,res);}catch(e:any){res.status(e.code==='P2002'?409:400).json({error:e.code==='P2002'?'Registro já existente.':e.message||'Falha na operação.'});}};
async function obra(db:any,empresaId:number,obraId:number){const o=await db.obra.findFirst({where:{id:obraId,empresaId},include:{etapas:true}});if(!o)throw Error('Obra não encontrada.');return o;}
async function colaborador(db:any,empresaId:number,colaboradorId:number){const c=await db.colaboradorObra.findFirst({where:{id:colaboradorId,empresaId,ativo:true}});if(!c)throw Error('Colaborador não encontrado ou inativo.');return c;}
export const listar=executar(async(req,res)=>{res.json(await prisma.obra.findMany({where:{empresaId:req.empresaId!},include:{etapas:true},orderBy:{id:'desc'}}));});
export const salvar=executar(async(req,res)=>{
 const b=req.body,empresaId=req.empresaId!,clienteId=id(b.clienteId),propostaId=b.propostaId?id(b.propostaId):null;
 if(!await prisma.cliente.findFirst({where:{clienteid:clienteId,empresaId}}))throw Error('Cliente não encontrado.');
 if(propostaId&&!await prisma.proposta.findFirst({where:{propostaid:propostaId,empresaId,clienteId}}))throw Error('Proposta não pertence a este cliente.');
 const inicio=data(b.inicio),prazo=b.prazo?data(b.prazo):null;if(prazo&&prazo<inicio)throw Error('Prazo anterior ao início.');
 const etapas=(Array.isArray(b.etapas)?b.etapas:[]).map((e:any)=>({nome:texto(e.nome,'nome da etapa',300),valor:dinheiro(numero(e.valor,0.01))}));
 const valorContrato=dinheiro(numero(b.valorContrato,0.01));if(!etapas.length||etapas.length>100||Math.abs(etapas.reduce((s:number,e:any)=>s+e.valor,0)-valorContrato)>0.009)throw Error('A soma das etapas deve corresponder ao valor contratado.');
 res.status(201).json(await prisma.obra.create({data:{empresaId,clienteId,propostaId,nome:texto(b.nome,'nome da obra',300),endereco:texto(b.endereco,'endereço'),responsavel:texto(b.responsavel,'responsável',300),inicio,prazo,valorContrato,etapas:{create:etapas}},include:{etapas:true}}));
});
export const colaboradores=executar(async(req,res)=>{res.json(await prisma.colaboradorObra.findMany({where:{empresaId:req.empresaId!},orderBy:{nome:'asc'}}));});
export const salvarColaborador=executar(async(req,res)=>{const b=req.body,empresaId=req.empresaId!,d={nome:texto(b.nome,'nome',300),funcao:texto(b.funcao,'função',300),diaria:dinheiro(numero(b.diaria,0.01)),ativo:b.ativo!==false};
 if(req.params.id){const r=await prisma.colaboradorObra.updateMany({where:{id:id(req.params.id),empresaId},data:d});if(!r.count)throw Error('Colaborador não encontrado.');res.json({ok:true});}else res.status(201).json(await prisma.colaboradorObra.create({data:{...d,empresaId}}));
});
export const apontar=executar(async(req,res)=>{res.json(await prisma.$transaction(db=>apontarDia(db,req.empresaId!,req.body,req.usuario?.id),{isolationLevel:'Serializable'}));});
export const fechar=executar(async(req,res)=>{res.json(await prisma.$transaction(db=>fecharDiarias(db,req.empresaId!,req.body,req.usuario?.id),{isolationLevel:'Serializable'}));});
export const despesa=executar(async(req,res)=>{
 const b=req.body,empresaId=req.empresaId!,obraId=id(b.obraId),valor=dinheiro(numero(b.valor,0.01)),dia=data(b.data),categoria=texto(b.categoria,'categoria',100),descricao=texto(b.descricao,'descrição');
 const r=await prisma.$transaction(async db=>{await obra(db,empresaId,obraId);const colaboradorId=b.colaboradorId?id(b.colaboradorId):null;if(colaboradorId)await colaborador(db,empresaId,colaboradorId);
  const l=await db.lancamentoFinanceiro.create({data:{empresaId,origem:'OBRA',tipo:'SAIDA',descricao:`Obra #${obraId} · ${categoria} · ${descricao}`,valor,dataCompetencia:dia,dataVencimento:dia}});
  return db.despesaObra.create({data:{empresaId,obraId,colaboradorId,categoria,descricao,data:dia,valor,lancamentoId:l.lancamentofinanceiroid}});
 });res.status(201).json(r);
});
export const medir=executar(async(req,res)=>{
 const b=req.body,empresaId=req.empresaId!,obraId=id(b.obraId),inicio=data(b.inicio),fim=data(b.fim),vencimento=data(b.vencimento);if(fim<inicio)throw Error('Período inválido.');
 const fotos=Array.isArray(b.fotos)?b.fotos:[];if(fotos.length>12||fotos.some((f:any)=>typeof f!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(f)||f.length>500000))throw Error('Use até 12 fotos JPG, PNG ou WebP de até 375 KB.');
 const r=await prisma.$transaction(async db=>{
  await db.$queryRaw`SELECT pg_advisory_xact_lock(${empresaId}::integer, 0::integer)::text`;
  const o=await obra(db,empresaId,obraId);if(await db.medicaoObra.findFirst({where:{empresaId,obraId,status:'RASCUNHO'}}))throw Error('Aprove a medição pendente antes de criar outra.');
  const prev=await db.medicaoObra.findFirst({where:{empresaId,obraId,status:'APROVADA'},orderBy:{fim:'desc'}});if(prev&&inicio<=prev.fim)throw Error('O período deve ser posterior à última medição aprovada.');
  if(!Array.isArray(b.itens)||b.itens.length!==o.etapas.length||new Set(b.itens.map((i:any)=>id(i.etapaId))).size!==o.etapas.length)throw Error('Informe todas as etapas uma única vez.');
  const itens=[];for(const e of o.etapas){const p=await db.itemMedicaoObra.findFirst({where:{etapaId:e.id,medicao:{empresaId,obraId,status:'APROVADA'}},orderBy:{id:'desc'}});const anterior=Number(p?.atual||0),atual=numero(b.itens.find((i:any)=>id(i.etapaId)===e.id)?.atual,anterior,100);itens.push({etapaId:e.id,anterior,atual,valor:valorMedicao(Number(e.valor),anterior,atual)});}
  const valor=dinheiro(itens.reduce((s,i)=>s+i.valor,0));if(valor<=0)throw Error('A medição deve registrar evolução com valor positivo.');
  return db.medicaoObra.create({data:{empresaId,obraId,inicio,fim,vencimento,observacoes:String(b.observacoes||'').slice(0,10000),fotos,valor,itens:{create:itens}},include:{itens:true}});
 },{isolationLevel:'Serializable'});res.status(201).json(r);
});
export const aprovar=executar(async(req,res)=>{res.json(await prisma.$transaction(db=>aprovarMedicao(db,req.empresaId!,id(req.params.id),req.usuario?.id),{isolationLevel:'Serializable'}));});
export const detalhe=executar(async(req,res)=>{
 const empresaId=req.empresaId!,obraId=id(req.params.id),o=await obra(prisma,empresaId,obraId);
 const [apontamentos,despesas,medicoes]=await Promise.all([prisma.apontamentoObra.findMany({where:{empresaId,obraId},include:{colaborador:true},orderBy:{data:'desc'}}),prisma.despesaObra.findMany({where:{empresaId,obraId},orderBy:{data:'desc'}}),prisma.medicaoObra.findMany({where:{empresaId,obraId},include:{itens:{include:{etapa:true}}},orderBy:{id:'desc'}})]);
 const ids=medicoes.flatMap(m=>m.lancamentoId?[m.lancamentoId]:[]),financeiro=await prisma.lancamentoFinanceiro.findMany({where:{empresaId,lancamentofinanceiroid:{in:ids}}});
 const custoMaoObra=dinheiro(apontamentos.reduce((s,a)=>s+dinheiro(Number(a.diaria)*Number(a.fracao)),0)),custoDespesas=dinheiro(despesas.filter(d=>!d.canceladoEm).reduce((s,d)=>s+Number(d.valor),0));
 res.json({...o,apontamentos,despesas,medicoes:medicoes.map(({fotos,...m})=>({...m,quantidadeFotos:(fotos as any[])?.length||0})),financeiro,resumo:{custoMaoObra,custoDespesas,custoTotal:dinheiro(custoMaoObra+custoDespesas),medido:dinheiro(medicoes.filter(m=>m.status==='APROVADA').reduce((s,m)=>s+Number(m.valor),0)),recebido:dinheiro(financeiro.filter(l=>l.status!=='CANCELADO').reduce((s,l)=>s+Number(l.valorPago),0)),aReceber:dinheiro(financeiro.filter(l=>l.status!=='CANCELADO').reduce((s,l)=>s+Number(l.valor)-Number(l.valorPago),0))}});
});
export const pdf=executar(async(req,res)=>{
 const empresaId=req.empresaId!,m=await prisma.medicaoObra.findFirst({where:{id:id(req.params.id),empresaId},include:{obra:true,itens:{include:{etapa:true}}}});if(!m)throw Error('Medição não encontrada.');
 const [c,e,l]=await Promise.all([prisma.cliente.findFirst({where:{empresaId,clienteid:m.obra.clienteId}}),prisma.empresa.findUnique({where:{empresaid:empresaId}}),m.lancamentoId?prisma.lancamentoFinanceiro.findFirst({where:{empresaId,lancamentofinanceiroid:m.lancamentoId}}):null]);
 const brl=(v:any)=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),dia=(d:Date)=>d.toISOString().slice(0,10).split('-').reverse().join('/');
 const html=`<!doctype html><html><meta charset="utf-8"><style>body{font:12px Arial;color:#172b3a}h1{font-size:23px}table{width:100%;border-collapse:collapse}td,th{padding:9px;border-bottom:1px solid #ddd;text-align:left}img{width:45%;max-height:260px;object-fit:contain;margin:8px}tr,img{break-inside:avoid}.assinatura{margin-top:60px;border-top:1px solid #777;padding:10px}</style><h2>${h(e?.nome)}</h2><h1>Evolução da obra · Medição #${m.id}</h1><p>${h(m.obra.nome)} · ${h(c?.razaoSocial||c?.nomeFantasia)}<br>${h(m.obra.endereco)}<br>Responsável: ${h(m.obra.responsavel)}</p><p>Período: ${dia(m.inicio)} a ${dia(m.fim)} · ${h(m.status)} · Vencimento: ${dia(m.vencimento)}</p><table><tr><th>Etapa</th><th>Contratado</th><th>Anterior</th><th>Acumulado</th><th>No período</th><th>Valor</th></tr>${m.itens.map(i=>`<tr><td>${h(i.etapa.nome)}</td><td>${brl(i.etapa.valor)}</td><td>${i.anterior}%</td><td>${i.atual}%</td><td>${Number(i.atual)-Number(i.anterior)}%</td><td>${brl(i.valor)}</td></tr>`).join('')}</table><h2>Valor desta medição: ${brl(m.valor)}</h2><p>Recebido nesta medição: ${brl(l?.valorPago||0)} · Saldo: ${brl(Number(m.valor)-Number(l?.valorPago||0))}${l?.status==='CANCELADO'?' · Cobrança cancelada':''}</p><p>${h(m.observacoes).replace(/\n/g,'<br>')}</p>${(m.fotos as string[]).map(f=>`<img src="${h(f)}">`).join('')}<div class="assinatura">Aprovação do cliente · Nome / assinatura / data</div></html>`;
 let browser;try{browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();await page.setJavaScriptEnabled(false);await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('data:')?r.continue():r.abort());await page.setContent(html,{waitUntil:'load'});const bytes=await page.pdf({format:'A4',printBackground:true,margin:{top:'15mm',bottom:'15mm',left:'12mm',right:'12mm'}});res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="medicao-${m.id}.pdf"`);res.send(Buffer.from(bytes));}finally{await browser?.close();}
});
