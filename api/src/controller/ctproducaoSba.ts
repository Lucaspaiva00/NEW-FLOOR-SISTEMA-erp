import {sincronizarFinanceiroNota} from '../services/fiscalFinanceiro.service';
import {resolverConfiguracao} from '../services/configuracaoSistema.service';
import {gerarDanfseSba} from '../services/danfseSba.service';
import {Request,Response} from 'express';
import prisma from '../prisma';
import {aplicarPadroesEmNotaSba} from '../services/padroesFiscaisSba.service';
import {montarDpsProducaoSba as montarDpsPreviaSba} from '../services/dpsProducaoSba.service';
import {assinarDpsXmlSba} from '../services/xmlAssinaturaDpsSba.service';
import {validarDpsProducaoSba as validarDpsOficialSba} from '../services/validacaoXsdProducaoSba.service';
import {compactarDpsXmlAssinado} from '../services/dpsNacionalSba.service';
import {validarDestinoSba,comA1Sba,solicitarSefinSba,lerRetornoSefinSba} from '../services/sefinTransmissaoSba.service';
// Etapas isoladas para exercitar falhas e concorrência sem transmissão real em testes.
export const etapasSba={padroes:aplicarPadroesEmNotaSba,preparar:montarDpsPreviaSba,assinar:assinarDpsXmlSba,validar:validarDpsOficialSba,certificado:comA1Sba,solicitar:solicitarSefinSba,financeiro:sincronizarFinanceiroNota};
const PROVEDOR='SEFIN_NACIONAL_DIRETO_PRODUCAO';
const falha=(message:string,statusCode=422)=>Object.assign(Error(message),{statusCode});
async function carregar(req:Request):Promise<any>{
 if(req.configuracaoSistema?.perfil!=='SBA'||req.empresaId!==2)throw falha('Recurso exclusivo da SBA.',403);
 const id=Number(req.params.id);
 if(!Number.isSafeInteger(id)||id<=0)throw falha('Nota inválida.',400);
 const nota=await prisma.notaFiscal.findFirst({where:{notafiscalid:id,empresaId:req.empresaId},include:{empresa:true,empresaFiscal:true,itens:true,proposta:true}});
 if(!nota)throw falha('Nota não encontrada na SBA.',404);
 validarDestinoSba(nota,true);
 if((nota.ambienteEmissao||nota.empresaFiscal.ambiente)!=="PRODUCAO")throw falha("Esta rota exige nota de produção.");
 return nota;
}
function erro(res:Response,e:any){
 res.status([400,403,404,409,422,502,504].includes(e?.statusCode)?e.statusCode:422).json({error:e?.statusCode?e.message:'Não foi possível concluir a preparação fiscal da SBA. Nenhum reenvio automático foi realizado.'});
}
async function evento(notaId:number,tipo:string,status:string,descricao:string){
 await prisma.eventoNotaFiscal.create({data:{notaFiscalId:notaId,tipo,status,descricao}});
}
async function guardar(nota:any,retorno:any,parseado:any){
 // Primeiro preserva o retorno fiscal. Falha financeira nunca transforma autorização em rejeição.
 const saved=await prisma.notaFiscal.update({where:{notafiscalid:nota.notafiscalid},data:{
  status:parseado.status,retornoProvedor:retorno,
  mensagemRetorno:parseado.mensagem,
  ...(parseado.chave?{chave:parseado.chave,numero:parseado.numero,dataAutorizacao:nota.dataAutorizacao||new Date()}:{}),
 }});
 let pendenciaFinanceira=false;
 if(saved.status==='AUTORIZADA'&&nota.payloadExtra?.sbaTesteProducao!==true){
  try{
   await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT propostaid FROM "Proposta" WHERE propostaid=${nota.propostaId} AND "empresaId"=${nota.empresaId} FOR UPDATE`;
    const p=await tx.proposta.findFirst({where:{propostaid:nota.propostaId,empresaId:nota.empresaId}});
    if(!p||p.clienteId!==nota.clienteId||Math.round((Number(p.subtotal)+Number(p.frete||0))*100)!==Math.round(Number(nota.valorTotal)*100))throw Error('Proposta alterada após emissão.');
    if(resolverConfiguracao(nota.empresa?.configuracaoSistema).modulos.financeiro)return etapasSba.financeiro({...nota,...saved},tx);
    return tx.proposta.updateMany({where:{propostaid:nota.propostaId,empresaId:nota.empresaId},data:{status:'FATURADA',dataFaturamento:nota.proposta?.dataFaturamento||saved.dataAutorizacao,colunaKanbanId:null}});
   });
  }catch(_){pendenciaFinanceira=true;await evento(nota.notafiscalid,'PENDENCIA_FINANCEIRA','AUTORIZADA','Nota autorizada. Sincronização financeira pendente; consulte novamente para reconciliar.').catch(()=>{});}
 }
 await evento(nota.notafiscalid,'RETORNO_SEFIN_PRODUCAO',saved.status,parseado.mensagem);
 return {notaId:saved.notafiscalid,status:saved.status,mensagem:saved.mensagemRetorno,ambiente:'PRODUCAO',chave:saved.chave,numero:saved.numero,pendenciaFinanceira};
}
export const transmitirProducaoSba=async(req:Request,res:Response):Promise<void>=>{
 let reservada:any=null;
 try{
  const original=await carregar(req);
  const teste=original.payloadExtra?.sbaTesteProducao===true;
  if(req.body?.confirmacao!==(teste?'EMITIR_NOTA_REAL_R1':'EMITIR_NOTA_REAL'))throw falha('Confirme expressamente a emissão real desta nota.');
  if(!teste&&req.body?.versaoConfirmada!==original.updatedAt.toISOString())throw falha('A nota foi alterada. Reabra e confira antes de confirmar.',409);
  if(!teste&&(!Number.isFinite(Number(req.body?.valorConfirmado))||Math.round(Number(req.body.valorConfirmado)*100)!==Math.round(Number(original.valorTotal)*100)))throw falha('O valor da nota mudou. Reabra e confirme o valor atual.',409);
  if(!['RASCUNHO','REJEITADA','ERRO'].includes(original.status))throw falha('Documento já enviado. Consulte a DPS antes de reenviar.',409);
  const ajustes=await etapasSba.padroes(original.empresaId,{...original});
  const nota={...original,...ajustes};
  const dps=etapasSba.preparar(nota);
  if(dps.pendencias.length){res.status(422).json({error:'Complete os dados desta nota antes de transmitir.',pendencias:dps.pendencias});return;}
  const assinada=etapasSba.assinar(dps.xml,nota.empresaFiscal.certificadoCriptografado,nota.empresaId,nota.empresaFiscalId);
  const xsd=await etapasSba.validar(assinada.xmlAssinado);
  if(!xsd.valido){res.status(422).json({error:'DPS não aprovada no XSD oficial. Nenhum documento transmitido.',erroXsd:xsd.erro});return;}
  await etapasSba.certificado(nota,async()=>true);
  const consulta=await etapasSba.solicitar(nota,'GET','/dps/'+dps.id);
  if(consulta.httpStatus!==404)throw falha('A identificação da DPS não está comprovadamente disponível. Consulte antes de emitir.',409);
  const payload=compactarDpsXmlAssinado(assinada.xmlAssinado);
  await prisma.$transaction(async tx=>{
   // Serializa também rascunhos distintos da mesma proposta.
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(${nota.empresaId}::int, ${nota.propostaId||-nota.notafiscalid}::int)`;
   if(nota.propostaId){
    await tx.$queryRaw`SELECT propostaid FROM "Proposta" WHERE propostaid=${nota.propostaId} AND "empresaId"=${nota.empresaId} FOR UPDATE`;
    const atual=await tx.proposta.findFirst({where:{propostaid:nota.propostaId,empresaId:nota.empresaId}});
    if(!atual||atual.clienteId!==nota.clienteId||Math.round((Number(atual.subtotal)+Number(atual.frete||0))*100)!==Math.round(Number(nota.valorTotal)*100)||['RECUSADA','CANCELADA'].includes(atual.status)||(atual.planoRecebimento as any)?.origemFaturamento==='EXTERNO')throw falha('A proposta foi alterada. Reabra e confira antes de emitir.',409);
    const ativa=await tx.notaFiscal.count({where:{empresaId:nota.empresaId,propostaId:nota.propostaId,notafiscalid:{not:nota.notafiscalid},status:{in:['PROCESSANDO','AUTORIZADA']},OR:[{ambienteEmissao:'PRODUCAO'},{ambienteEmissao:null,empresaFiscal:{ambiente:'PRODUCAO'}}]}});
    if(ativa)throw falha('A proposta já possui outra nota ativa. Consulte antes de transmitir.',409);
   }
   const lock=await tx.notaFiscal.updateMany({where:{notafiscalid:nota.notafiscalid,empresaId:nota.empresaId,status:{in:['RASCUNHO','REJEITADA','ERRO']},updatedAt:original.updatedAt},data:{
    status:'PROCESSANDO',ambienteEmissao:'PRODUCAO',padraoNfseEmissao:'NACIONAL',
    payloadExtra:ajustes.payloadExtra,payloadEnviado:{provedor:PROVEDOR,idDps:dps.id,...payload},
    mensagemRetorno:'Transmissão de produção iniciada. Consulte a DPS antes de qualquer reenvio.',
   }});
   if(lock.count!==1)throw falha('A nota foi alterada ou já está sendo transmitida. Reabra e confira.',409);
  });
  reservada=nota;
  await evento(nota.notafiscalid,'ENVIO_SEFIN_PRODUCAO','PROCESSANDO','DPS assinada e validada no XSD oficial. Destino: produção da SEFIN.');
  const result=await etapasSba.solicitar(nota,'POST','/nfse',payload);
  const parsed=lerRetornoSefinSba(result,dps.id,"PRODUCAO");
  res.json(await guardar(nota,result.data,parsed));
 }catch(e:any){
  if(reservada){
   // Timeout/5xx/resposta malformada nunca autoriza reenvio do POST.
   const atual=await prisma.notaFiscal.findFirst({where:{notafiscalid:reservada.notafiscalid,empresaId:reservada.empresaId},select:{status:true,chave:true,numero:true}}).catch(()=>null);
   if(atual?.status==='AUTORIZADA'){
    res.json({notaId:reservada.notafiscalid,status:atual.status,chave:atual.chave,numero:atual.numero,mensagem:'Autorizada em produção. Reabra a nota para consultar o documento.'});return;
   }
   res.status(202).json({notaId:reservada.notafiscalid,status:atual?.status||'PROCESSANDO',mensagem:'Resultado não confirmado. Use Consultar DPS; a nota não será reenviada automaticamente.'});return;
  }
  erro(res,e);
 }
};
export const consultarProducaoSba=async(req:Request,res:Response):Promise<void>=>{
 try{
  const nota=await carregar(req);
  const meta=nota.payloadEnviado;
  if(meta?.provedor!==PROVEDOR||!/^DPS\d{42}$/.test(meta.idDps))throw falha('Esta nota ainda não possui uma DPS transmitida pela integração direta.');
  let chave=nota.chave;
  if(!chave){
   const r=await etapasSba.solicitar(nota,'GET','/dps/'+meta.idDps);
   if(r.httpStatus===404){res.json({status:nota.status,mensagem:'DPS ainda não localizada na SEFIN. Aguarde e consulte novamente; nenhum reenvio foi realizado.'});return;}
   chave=r.httpStatus===200?r.data?.chaveAcesso:null;
   if(!/^\d{50}$/.test(String(chave||'')))throw falha('Não foi possível confirmar a chave da DPS na SEFIN. Nenhum reenvio realizado.',502);
  }
  const r=await etapasSba.solicitar(nota,'GET','/nfse/'+chave);
  // Consulta não rebaixa nota autorizada por erro de rede/provedor.
  const p=lerRetornoSefinSba(r,meta.idDps,"PRODUCAO");
  if(p.status!=='AUTORIZADA'){res.json({status:nota.status,mensagem:'A consulta não confirmou novo resultado. O estado fiscal anterior foi preservado.'});return;}
  res.json(await guardar(nota,r.data,p));
 }catch(e:any){erro(res,e);}
};
export const xmlAutorizadoProducaoSba=async(req:Request,res:Response):Promise<void>=>{
 try{
  const nota=await carregar(req);
  if(nota.status!=='AUTORIZADA'||nota.payloadEnviado?.provedor!==PROVEDOR)throw falha('Documento ainda não autorizado em produção.');
  const parsed=lerRetornoSefinSba({httpStatus:200,data:nota.retornoProvedor},nota.payloadEnviado.idDps,"PRODUCAO");
  if(parsed.status!=='AUTORIZADA')throw falha('XML autorizado indisponível. Consulte a DPS.');
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/xml; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="nfse-sba-producao.xml"');res.send(parsed.xml);
 }catch(e:any){erro(res,e);}
};

/** Diagnóstico e consulta somente de leitura, sem POST de emissão. */
export const prepararProducaoSba=async(req:Request,res:Response):Promise<void>=>{
 try{
  const nota=await carregar(req);
  const ajustes=await etapasSba.padroes(nota.empresaId,{...nota});
  const dps=etapasSba.preparar({...nota,...ajustes});
  if(dps.pendencias.length){res.status(422).json({error:'Complete os dados da nota.',pendencias:dps.pendencias});return;}
  const a=etapasSba.assinar(dps.xml,nota.empresaFiscal.certificadoCriptografado,nota.empresaId,nota.empresaFiscalId);
  const xsd=await etapasSba.validar(a.xmlAssinado);
  if(!xsd.valido){res.status(422).json({error:'XML não aprovado no XSD de produção.',erroXsd:xsd.erro});return;}
  const consulta=await etapasSba.solicitar(nota,'GET','/dps/'+dps.id);
  res.status(consulta.httpStatus===404?200:409).json({notaId:nota.notafiscalid,ambiente:'PRODUCAO',validadoXsdOficial:true,idDps:dps.id,identificacaoDisponivel:consulta.httpStatus===404,httpConsulta:consulta.httpStatus,notaTransmitida:false,mensagem:consulta.httpStatus===404?'XML de produção e assinatura validados. Identificação da DPS ainda não utilizada. Nenhuma nota emitida.':'Identificação não confirmada como disponível; emissão bloqueada.'});
 }catch(e:any){erro(res,e);}
};

export const pdfAutorizadoProducaoSba=async(req:Request,res:Response):Promise<void>=>{
 try{
  const nota=await carregar(req);
  if(nota.status!=='AUTORIZADA'||nota.payloadEnviado?.provedor!==PROVEDOR)throw falha('Documento ainda não autorizado em produção.');
  const parsed=lerRetornoSefinSba({httpStatus:200,data:nota.retornoProvedor},nota.payloadEnviado.idDps,"PRODUCAO");
  if(parsed.status!=='AUTORIZADA'||parsed.chave!==nota.chave||String(parsed.numero)!==String(nota.numero))throw falha('XML autorizado indisponível ou divergente. Consulte a DPS.');
  const pdf=await gerarDanfseSba(parsed.xml!,nota.chave);
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition',`attachment; filename="nfse-sba-${parsed.numero}.pdf"`);res.send(pdf);
 }catch(e:any){erro(res,e);}
};
