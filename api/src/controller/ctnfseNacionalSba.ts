import { Request, Response } from "express";
import prisma from "../prisma";
import { testarAssinaturaA1ArmazenadoSba } from "../services/assinaturaA1Sba.service";
import { verificarCamposDpsSba, SEFIN_RESTRITA_DOCS, SEFIN_PRODUCAO_DOCS } from "../services/dpsNacionalSba.service";
import {montarDpsPreviaSba} from "../services/dpsXmlSba.service";
import {assinarDpsXmlSba} from "../services/xmlAssinaturaDpsSba.service";
import {validarDpsOficialSba,estadoXsdOficialSba} from "../services/validacaoXsdSba.service";
import {testarCanalTlsSefinSba} from "../services/conexaoSefinSba.service";

async function autorizarSba(req:Request) {
  if(req.configuracaoSistema?.perfil!=="SBA"||!req.empresaId)
    throw Object.assign(Error("Integração exclusiva do perfil SBA."),{statusCode:403});
  const empresa=await prisma.empresa.findFirst({
    where:{empresaid:req.empresaId,slug:"sba",ativo:true},
    select:{empresaid:true}
  });
  if(!empresa)throw Object.assign(Error("Empresa SBA não encontrada no acesso."),{statusCode:403});
  return empresa.empresaid;
}
function erroSeguro(res:Response,e:any){
  // NUNCA registrar conteúdo do PFX/senha, XML ou o objeto de banco no log.
  const permitido=[
    "Integração exclusiva do perfil SBA.","Empresa SBA não encontrada no acesso.",
    "Emissora fiscal não encontrada na SBA.","Certificado A1 ainda não cadastrado.",
    "Nota fiscal não encontrada no perfil SBA."
  ];
  const mensagem=String(e?.message||"Falha na preparação da emissão.").slice(0,280);
  const status=Number(e?.statusCode)||422;
  res.status(status>=400&&status<500?status:500).json({
    error: permitido.includes(mensagem)||status===422?mensagem:"Falha interna na preparação da emissão."
  });
}
export const diagnosticarAssinatura=async(req:Request,res:Response):Promise<void>=>{
 try{
  const empresaId=await autorizarSba(req);
  const id=Number(req.params.emissoraId);
  if(!Number.isSafeInteger(id)||id<=0){
    res.status(400).json({error:"Selecione uma emissora fiscal válida."});return;
  }
  const emissora=await prisma.empresaFiscal.findFirst({
    where:{empresaId,empresafiscalid:id,ativo:true},
    select:{empresafiscalid:true,certificadoCriptografado:true}
  });
  if(!emissora)throw Object.assign(Error("Emissora fiscal não encontrada na SBA."),{statusCode:404});
  if(!emissora.certificadoCriptografado)throw Object.assign(Error("Certificado A1 ainda não cadastrado."),{statusCode:422});
  const verificada=testarAssinaturaA1ArmazenadoSba(emissora.certificadoCriptografado,empresaId,id);
  res.setHeader("Cache-Control","no-store");
  res.json({...verificada,mensagem:"Teste local de assinatura RSA concluído. XMLDSig, identidade ICP-Brasil e SEFIN ainda precisam ser homologados.",
    transmissaoHabilitada:false});
 }catch(e:any){erroSeguro(res,e);}
};
export const prepararNota=async(req:Request,res:Response):Promise<void>=>{
 try{
  const empresaId=await autorizarSba(req);
  const id=Number(req.params.notaId);
  if(!Number.isSafeInteger(id)||id<=0){res.status(400).json({error:"Número da nota inválido."});return;}
  const nota=await prisma.notaFiscal.findFirst({
    where:{empresaId,notafiscalid:id},
    include:{empresaFiscal:true,itens:true,proposta:true}
  });
  if(!nota)throw Object.assign(Error("Nota fiscal não encontrada no perfil SBA."),{statusCode:404});
  const dados=montarDpsPreviaSba(nota);
  res.setHeader("Cache-Control","no-store");
  res.json({
    notaId:id,perfil:"SBA",tipo:"NFS-e Nacional",ambiente:"PRODUCAO_RESTRITA",
    pendencias:dados.pendencias,avisos:dados.avisos,
    cadastroRevisado:dados.pendencias.length===0,
    assinaturaXmlValidada:false,xmlXsdValidado:false,transmissaoHabilitada:false,
    documentacao:{homologacao:SEFIN_RESTRITA_DOCS,producao:SEFIN_PRODUCAO_DOCS},
  });
 }catch(e:any){erroSeguro(res,e);}
};

/**
 * Geração de prévia XML de DPS para homologação. Sem envio à SEFIN.
 * Assinatura separada em POST com verificação local obrigatória.
 */
export const baixarPreviaDps=async(req:Request,res:Response):Promise<void>=>{
 try{
  const empresaId=await autorizarSba(req);
  const id=Number(req.params.notaId);
  if(!Number.isSafeInteger(id)||id<=0){res.status(400).json({error:"Nota inválida."});return;}
  const nota=await prisma.notaFiscal.findFirst({where:{empresaId,notafiscalid:id},
    include:{empresaFiscal:true,itens:true,proposta:true}});
  if(!nota)throw Object.assign(Error("Nota fiscal não encontrada no perfil SBA."),{statusCode:404});
  if(nota.empresaFiscal.empresaId!==empresaId)throw Object.assign(Error("Emissora não pertence ao perfil SBA."),{statusCode:403});
  const dps=montarDpsPreviaSba(nota);
  if(dps.pendencias.length){res.status(422).json({error:"Ainda existem dados obrigatórios pendentes na DPS.",pendencias:dps.pendencias});return;}
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Content-Disposition",'attachment; filename="dps-sba-previa-nao-validada.xml"');
  res.setHeader("Content-Type","application/xml; charset=utf-8");
  res.setHeader("X-DPS-XSD-Validado","nao");
  res.send(dps.xml);
 }catch(e:any){erroSeguro(res,e);}
};
export const baixarDpsAssinada=async(req:Request,res:Response):Promise<void>=>{
 try{
  const empresaId=await autorizarSba(req);
  const id=Number(req.params.notaId);
  if(!Number.isSafeInteger(id)||id<=0){res.status(400).json({error:"Nota inválida."});return;}
  const nota=await prisma.notaFiscal.findFirst({where:{empresaId,notafiscalid:id},
    include:{empresaFiscal:true,itens:true,proposta:true}});
  if(!nota)throw Object.assign(Error("Nota fiscal não encontrada no perfil SBA."),{statusCode:404});
  if(nota.empresaFiscal.empresaId!==empresaId)throw Object.assign(Error("Emissora não pertence ao perfil SBA."),{statusCode:403});
  if(!nota.empresaFiscal.certificadoCriptografado)throw Object.assign(Error("Certificado A1 ainda não cadastrado."),{statusCode:422});
  const dps=montarDpsPreviaSba(nota);
  if(dps.pendencias.length){res.status(422).json({error:"Ainda existem dados fiscais pendentes na DPS.",pendencias:dps.pendencias});return;}
  const documento=assinarDpsXmlSba(dps.xml,nota.empresaFiscal.certificadoCriptografado,empresaId,nota.empresaFiscalId);
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Content-Disposition",'attachment; filename="dps-sba-assinada-nao-homologada.xml"');
  res.setHeader("Content-Type","application/xml; charset=utf-8");
  res.setHeader("X-DPS-XSD-Validado","nao");
  res.send(documento.xmlAssinado);
 }catch(e:any){erroSeguro(res,e);}
};

/**
 * Validação XSD OFICIAL em produção restrita, exclusivamente SBA.
 * A assinatura XMLDSig é verificada antes de validar o documento.
 * Não transmite nem salva/autoriza a nota.
 */
export const validarXsdDps=async(req:Request,res:Response):Promise<void>=>{
 try{
  const empresaId=await autorizarSba(req);
  const id=Number(req.params.notaId);
  if(!Number.isSafeInteger(id)||id<=0){
    res.status(400).json({error:"Número da nota inválido."});return;
  }
  const nota=await prisma.notaFiscal.findFirst({where:{empresaId,notafiscalid:id},
    include:{empresaFiscal:true,itens:true,proposta:true}});
  if(!nota)throw Object.assign(Error("Nota fiscal não encontrada no perfil SBA."),{statusCode:404});
  if(nota.tipo!=="NFSE"){
    res.status(422).json({error:"Somente NFS-e de serviço podem gerar DPS Nacional."});return;
  }
  if(nota.empresaFiscal.empresaId!==empresaId){
    res.status(403).json({error:"Emissora não pertence ao perfil SBA."});return;
  }
  if(!nota.empresaFiscal.certificadoCriptografado){
    res.status(422).json({error:"Certificado A1 ainda não cadastrado."});return;
  }
  const xsd=estadoXsdOficialSba();
  if(!xsd.disponivel){
    res.status(503).json({error:"Pacote XSD da homologação indisponível. A emissão permanece bloqueada.",xsd});return;
  }
  const dps=montarDpsPreviaSba(nota);
  if(dps.pendencias.length){
    res.status(422).json({error:"Revise os dados da nota antes de gerar a DPS.",pendencias:dps.pendencias,xsd});return;
  }
  const assinada=assinarDpsXmlSba(dps.xml,nota.empresaFiscal.certificadoCriptografado,empresaId,nota.empresaFiscalId);
  const resultado=await validarDpsOficialSba(assinada.xmlAssinado);
  res.setHeader("Cache-Control","no-store");
  res.status(resultado.valido?200:422).json({
    notaId:id,perfil:"SBA",ambiente:"PRODUCAO_RESTRITA",
    xmlAssinadoLocalmente:true,
    validadoXsdOficial:resultado.valido===true,
    pacote:resultado.versao||xsd.versao,sha256Pacote:resultado.sha256||null,
    erroXsd:resultado.valido?null:resultado.erro||"XML rejeitado pelo validador XSD.",
    observacao:"Nenhum dado foi transmitido ao governo, nenhuma nota foi emitida ou faturada.",
    transmissaoHabilitada:false
  });
 }catch(e:any){erroSeguro(res,e);}
};

/**
 * Teste de conectividade HTTPS/TLS mútua: operação sem efeito fiscal.
 * O canal TLS não equivale a credenciamento/autorização de emissão.
 */
export const testarTlsSefin=async(req:Request,res:Response):Promise<void>=>{
 try{
  const empresaId=await autorizarSba(req);
  const id=Number(req.params.emissoraId);
  if(!Number.isSafeInteger(id)||id<=0){
    res.status(400).json({error:"Emissora inválida."});return;
  }
  const emissora=await prisma.empresaFiscal.findFirst({
    where:{empresaId,empresafiscalid:id,ativo:true},
    select:{certificadoCriptografado:true}
  });
  if(!emissora)throw Object.assign(Error("Emissora fiscal não encontrada na SBA."),{statusCode:404});
  if(!emissora.certificadoCriptografado)throw Object.assign(Error("Certificado A1 ainda não cadastrado."),{statusCode:422});
  const resultado=await testarCanalTlsSefinSba(emissora.certificadoCriptografado,empresaId,id);
  res.setHeader("Cache-Control","no-store");
  res.json({...resultado,mensagem:"Canal TLS validado, mas a autorização de emissão do CNPJ e a aceitação da DPS ainda não foram verificadas."});
 }catch(e:any){
  // Erros operacionais conhecidos sem expor segredo ou mensagens OpenSSL.
  const mensagem=String(e?.message||"Falha de conectividade.");
  const permitido=/^Não foi possível|^A negociação TLS|^A identidade TLS|^Tempo esgotado|^Certificado A1|^Emissora fiscal/;
  res.status(e?.statusCode||422).json({error:permitido.test(mensagem)?mensagem:"Falha ao testar conexão da SBA com a SEFIN."});
 }
};
