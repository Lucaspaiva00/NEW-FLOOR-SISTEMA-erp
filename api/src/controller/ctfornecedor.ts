import {Request, Response, NextFunction} from 'express';
import prisma from '../prisma';
export function apenasSba(req:Request,res:Response,next:NextFunction){
 if(!req.empresaId || req.configuracaoSistema?.perfil!=='SBA'){res.status(403).json({error:'Recurso disponível apenas para o perfil SBA.'});return;}next();
}
export function dadosFornecedor(body:any){
 const nome=String(body.nome||'').trim().slice(0,500);
 if(!nome)throw Error('Informe o nome do fornecedor.');
 const cnpj=String(body.cnpj||'').replace(/\D/g,'');
 if(cnpj && cnpj.length!==14)throw Error('Informe um CNPJ com 14 dígitos.');
 const prazo=body.prazoPagamentoDias==null||body.prazoPagamentoDias===''?null:Number(body.prazoPagamentoDias);
 if(prazo!==null && (!Number.isInteger(prazo)||prazo<0||prazo>3650))throw Error('Prazo de pagamento deve ser de 0 a 3650 dias.');
 const text=(k:string,max=2000)=>String(body[k]||'').trim().slice(0,max)||null;
 return {nome,cnpj:cnpj||null,email:text('email',300),telefone:text('telefone',100),endereco:text('endereco'),formaPagamento:text('formaPagamento',100),condicoesPagamento:text('condicoesPagamento'),prazoPagamentoDias:prazo,ativo:body.ativo!==false};
}
export async function listar(req:Request,res:Response){try{res.json(await prisma.fornecedor.findMany({where:{empresaId:req.empresaId!},orderBy:{nome:'asc'}}));}catch{res.status(500).json({error:'Não foi possível carregar fornecedores.'});}}
export async function salvar(req:Request,res:Response){
 try{
  const data=dadosFornecedor(req.body),empresaId=req.empresaId!;
  if(req.params.id){
   const id=Number(req.params.id),updated=await prisma.fornecedor.updateMany({where:{fornecedorid:id,empresaId},data});
   if(!updated.count){res.status(404).json({error:'Fornecedor não encontrado.'});return;}
   res.json(await prisma.fornecedor.findFirst({where:{fornecedorid:id,empresaId}}));
  }else res.status(201).json(await prisma.fornecedor.create({data:{...data,empresaId}}));
 }catch(error:any){res.status(error.code==='P2002'?409:400).json({error:error.code==='P2002'?'Este CNPJ já está cadastrado como fornecedor.':error.message||'Não foi possível salvar fornecedor.'});}
}
