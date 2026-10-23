import {Request,Response} from "express";
import { carregarPadroesSba, salvarPadroesSba } from "../services/padroesFiscaisSba.service";

function autorizar(req:Request,res:Response):number|null{
  if(req.configuracaoSistema?.perfil!=="SBA"||!req.empresaId){
    res.status(403).json({error:"Configuração exclusiva da SBA."});
    return null;
  }
  return req.empresaId;
}
function falha(res:Response,e:any){
  const status=Number(e?.statusCode);
  res.status(status>=400&&status<500?status:500).json({
    error:status>=400&&status<500?String(e.message).slice(0,240):"Falha ao consultar os padrões fiscais SBA."
  });
}
export const listar=async(req:Request,res:Response):Promise<void>=>{
  const empresaId=autorizar(req,res);if(!empresaId)return;
  try{res.setHeader("Cache-Control","no-store");res.json(await carregarPadroesSba(empresaId));}
  catch(e:any){falha(res,e);}
};
export const salvarEmpresa=async(req:Request,res:Response):Promise<void>=>{
  const empresaId=autorizar(req,res);if(!empresaId)return;
  try{res.setHeader("Cache-Control","no-store");res.json(await salvarPadroesSba(empresaId,"empresa",Number(req.params.id),req.body));}
  catch(e:any){falha(res,e);}
};
export const salvarServico=async(req:Request,res:Response):Promise<void>=>{
  const empresaId=autorizar(req,res);if(!empresaId)return;
  try{res.setHeader("Cache-Control","no-store");res.json(await salvarPadroesSba(empresaId,"servico",Number(req.params.id),req.body));}
  catch(e:any){falha(res,e);}
};
