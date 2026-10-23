import { Request, Response } from "express";
import prisma from "../prisma";
import { testarAssinaturaA1ArmazenadoSba } from "../services/assinaturaA1Sba.service";
import { verificarCamposDpsSba, SEFIN_RESTRITA_DOCS, SEFIN_PRODUCAO_DOCS } from "../services/dpsNacionalSba.service";

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
  const dados=verificarCamposDpsSba(nota);
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
