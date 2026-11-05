import {Request,Response} from 'express';
import prisma from '../prisma';
import {carregarNotaProducaoSba} from './ctproducaoSba';
import {assinarCancelamentoSba} from '../services/xmlAssinaturaDpsSba.service';
import {validarEventoSba} from '../services/validacaoEventoSba.service';
import {montarCancelamentoSba,compactarCancelamentoSba,lerCancelamentoSba} from '../services/cancelamentoSba.service';
import {solicitarSefinSba,lerRetornoSefinSba,comA1Sba} from '../services/sefinTransmissaoSba.service';
import {sincronizarFinanceiroNota} from '../services/fiscalFinanceiro.service';
const TIPO='SBA_CANCELAMENTO';
const falha=(message:string,statusCode=422)=>Object.assign(Error(message),{statusCode});
export const etapasCancelamentoSba={assinar:assinarCancelamentoSba,validar:validarEventoSba,solicitar:solicitarSefinSba,certificado:comA1Sba,financeiro:sincronizarFinanceiroNota};
function erro(res:Response,e:any){res.status([400,403,404,409,422,502,504].includes(e?.statusCode)?e.statusCode:422).json({error:e?.statusCode?e.message:'Não foi possível concluir o cancelamento. Consulte o resultado antes de reenviar.'});}
async function carregar(req:Request){
 const n=await carregarNotaProducaoSba(req);
 if(!['AUTORIZADA','CANCELADA'].includes(n.status)||!/^\d{50}$/.test(n.chave||'')||n.payloadEnviado?.provedor!=='SEFIN_NACIONAL_DIRETO_PRODUCAO')throw falha('Selecione uma NFS-e da SBA autorizada pela integração direta em produção.');
 const original=lerRetornoSefinSba({httpStatus:200,data:n.retornoProvedor},n.payloadEnviado.idDps,'PRODUCAO');
 if(original.status!=='AUTORIZADA'||original.chave!==n.chave)throw falha('O XML autorizado não corresponde à chave da nota.');
 return n;
}
/** Somente após o XML de evento oficial correspondente; nunca apagar nota ou recebimentos. */
async function confirmar(nota:any,result:any,parsed:ReturnType<typeof lerCancelamentoSba>,envioId?:number){
 if(parsed.estado!=='CONFIRMADO')throw falha('Cancelamento sem confirmação fiscal.');
 const data=new Date(parsed.data!);if(!Number.isFinite(data.getTime()))throw falha('Data do cancelamento retornada inválida.');
 const saved=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT notafiscalid FROM "NotaFiscal" WHERE notafiscalid=${nota.notafiscalid} AND "empresaId"=${nota.empresaId} FOR UPDATE`;
  const atual=await tx.notaFiscal.findFirst({where:{notafiscalid:nota.notafiscalid,empresaId:nota.empresaId}});
  if(!atual||!['AUTORIZADA','CANCELADA'].includes(atual.status))throw falha('Estado fiscal da nota mudou; reabra e consulte.',409);
  if(envioId)await tx.eventoNotaFiscal.update({where:{eventonotafiscalid:envioId},data:{status:'CONFIRMADO',descricao:parsed.mensagem,retorno:result.data}});
  else {
   const existe=await tx.eventoNotaFiscal.findFirst({where:{notaFiscalId:nota.notafiscalid,tipo:TIPO,status:'CONFIRMADO'}});
   if(!existe)await tx.eventoNotaFiscal.create({data:{notaFiscalId:nota.notafiscalid,tipo:TIPO,status:'CONFIRMADO',descricao:parsed.mensagem,retorno:result.data}});
   // Uma consulta reconciliada encerra também um envio cujo retorno se perdeu.
   await tx.eventoNotaFiscal.updateMany({where:{notaFiscalId:nota.notafiscalid,tipo:TIPO,status:'PENDENTE'},data:{status:'CONFIRMADO',descricao:parsed.mensagem,retorno:result.data}});
  }
  return tx.notaFiscal.update({where:{notafiscalid:nota.notafiscalid},data:{status:'CANCELADA',dataCancelamento:atual.dataCancelamento||data,mensagemRetorno:parsed.mensagem}});
 });
 let pendenciaFinanceira=false;
 if(nota.payloadExtra?.sbaTesteProducao!==true){
  try{await prisma.$transaction(tx=>etapasCancelamentoSba.financeiro({...nota,...saved},tx));}
  catch(_){pendenciaFinanceira=true;await prisma.eventoNotaFiscal.create({data:{notaFiscalId:nota.notafiscalid,tipo:'PENDENCIA_FINANCEIRA_CANCELAMENTO',status:'CANCELADA',descricao:'Cancelamento fiscal confirmado. Reconciliação financeira pendente; consulte o cancelamento novamente.'}}).catch(()=>{});}
 }
 return {notaId:nota.notafiscalid,status:'CANCELADA',mensagem:parsed.mensagem,pendenciaFinanceira};
}
export const cancelarProducaoSba=async(req:Request,res:Response):Promise<void>=>{
 let envio:any;
 try{
  const nota=await carregar(req);
  if(nota.status!=='AUTORIZADA')throw falha('Esta nota já está cancelada. Consulte o cancelamento para reconciliar o financeiro.',409);
  if(req.body?.confirmacao!=='CANCELAR_NFSE_REAL'||req.body?.chaveConfirmada!==nota.chave||req.body?.versaoConfirmada!==nota.updatedAt.toISOString())throw falha('Reabra a nota e confirme expressamente o cancelamento e a chave atual.',409);
  const pedido=montarCancelamentoSba(nota,req.body.codigoMotivo,req.body.justificativa);
  const assinado=etapasCancelamentoSba.assinar(pedido.xml,nota.empresaFiscal.certificadoCriptografado,nota.empresaId,nota.empresaFiscalId);
  const xsd=await etapasCancelamentoSba.validar(assinado.xmlAssinado);
  if(!xsd.valido){res.status(422).json({error:'Evento não aprovado no XSD oficial. Nenhum cancelamento enviado.',erroXsd:xsd.erro});return;}
  await etapasCancelamentoSba.certificado(nota,async()=>true);
  const consulta=await etapasCancelamentoSba.solicitar(nota,'GET','/nfse/'+nota.chave+'/eventos/101101/1');
  const encontrado=lerCancelamentoSba(consulta,nota.chave,nota.empresaFiscal.cnpj);
  if(encontrado.estado==='CONFIRMADO'){res.json(await confirmar(nota,consulta,encontrado));return;}
  if(consulta.httpStatus!==404)throw falha('Não foi possível confirmar a situação do cancelamento no Portal Nacional. Use Consultar cancelamento.',409);
  const payload=compactarCancelamentoSba(assinado.xmlAssinado);
  envio=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT notafiscalid FROM "NotaFiscal" WHERE notafiscalid=${nota.notafiscalid} AND "empresaId"=${nota.empresaId} FOR UPDATE`;
   const atual=await tx.notaFiscal.findFirst({where:{notafiscalid:nota.notafiscalid,empresaId:nota.empresaId}});
   if(atual?.status!=='AUTORIZADA'||atual.updatedAt.getTime()!==nota.updatedAt.getTime())throw falha('A nota foi alterada. Reabra e confira.',409);
   const anterior=await tx.eventoNotaFiscal.findFirst({where:{notaFiscalId:nota.notafiscalid,tipo:TIPO},orderBy:{eventonotafiscalid:'desc'}});
   if(anterior&&anterior.status!=='REJEITADO')throw falha('Já existe cancelamento enviado. Consulte o cancelamento antes de qualquer novo envio.',409);
   return tx.eventoNotaFiscal.create({data:{notaFiscalId:nota.notafiscalid,tipo:TIPO,status:'PENDENTE',descricao:'Cancelamento solicitado; aguardando confirmação fiscal.',retorno:{idPedido:pedido.id,usuarioId:req.usuario?.id||null,justificativa:pedido.motivo,codigoMotivo:pedido.codigo,...payload}}});
  });
  const r=await etapasCancelamentoSba.solicitar(nota,'POST','/nfse/'+nota.chave+'/eventos',payload);
  await prisma.eventoNotaFiscal.create({data:{notaFiscalId:nota.notafiscalid,tipo:'SBA_RETORNO_CANCELAMENTO',status:'RETORNO',descricao:'Retorno recebido do Portal Nacional para cancelamento.',retorno:{httpStatus:r.httpStatus,resposta:r.data}}});
  const p=lerCancelamentoSba(r,nota.chave,nota.empresaFiscal.cnpj);
  if(p.estado==='CONFIRMADO'){res.json(await confirmar(nota,r,p,envio.eventonotafiscalid));return;}
  if(p.estado==='REJEITADO')await prisma.eventoNotaFiscal.update({where:{eventonotafiscalid:envio.eventonotafiscalid},data:{status:'REJEITADO',descricao:p.mensagem,retorno:{...(envio.retorno as any),resposta:r.data}}});
  res.status(p.estado==='REJEITADO'?422:202).json({status:'AUTORIZADA',cancelamento:p.estado,mensagem:p.mensagem});
 }catch(e:any){
  if(envio){res.status(202).json({cancelamento:'PENDENTE',mensagem:'Resultado do cancelamento não confirmado. Use Consultar cancelamento; nenhum reenvio automático será feito.'});return;}
  erro(res,e);
 }
};
export const consultarCancelamentoSba=async(req:Request,res:Response):Promise<void>=>{
 try{
  const nota=await carregar(req);
  const r=await etapasCancelamentoSba.solicitar(nota,'GET','/nfse/'+nota.chave+'/eventos/101101/1');
  await prisma.eventoNotaFiscal.create({data:{notaFiscalId:nota.notafiscalid,tipo:'SBA_CONSULTA_CANCELAMENTO',status:'CONSULTA',descricao:'Retorno da consulta de cancelamento ao Portal Nacional.',retorno:{httpStatus:r.httpStatus,resposta:r.data}}});
  const p=lerCancelamentoSba(r,nota.chave,nota.empresaFiscal.cnpj);
  if(p.estado==='CONFIRMADO'){res.json(await confirmar(nota,r,p));return;}
  res.status(r.httpStatus===404?200:202).json({status:nota.status,cancelamento:'NAO_CONFIRMADO',mensagem:r.httpStatus===404?'Cancelamento ainda não localizado no Portal Nacional. A situação fiscal salva foi preservada.':'Consulta sem confirmação. A situação fiscal salva foi preservada.'});
 }catch(e:any){erro(res,e);}
};
export const xmlCancelamentoSba=async(req:Request,res:Response):Promise<void>=>{
 try{
  const n=await carregar(req);
  const e=await prisma.eventoNotaFiscal.findFirst({where:{notaFiscalId:n.notafiscalid,tipo:TIPO,status:'CONFIRMADO'},orderBy:{eventonotafiscalid:'desc'}});
  const p=lerCancelamentoSba({httpStatus:200,data:e?.retorno},n.chave,n.empresaFiscal.cnpj);
  if(p.estado!=='CONFIRMADO')throw falha('Comprovante de cancelamento ainda indisponível. Consulte o cancelamento.');
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/xml; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="cancelamento-nfse-sba.xml"');res.send(p.xml);
 }catch(e:any){erro(res,e);}
};
