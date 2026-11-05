import {Request,Response} from 'express';
import prisma from '../prisma';
import {criarObraDaProposta,dadosObraDaProposta} from '../services/obraPropostaJose.service';
export const listar=async(req:Request,res:Response)=>{try{
 const [propostas,obras]=await Promise.all([
  prisma.proposta.findMany({where:{empresaId:5,subtotal:{gt:0}},orderBy:{propostaid:'desc'},take:500,include:{cliente:{select:{clienteid:true,razaoSocial:true,nomeFantasia:true,endereco:true,numero:true,complemento:true,bairro:true,cidade:true,estado:true,responsavel:true}},itens:{orderBy:{ordem:'asc'}}}}),
  prisma.obra.findMany({where:{empresaId:5,propostaId:{not:null}},select:{id:true,nome:true,propostaId:true}})]);
 res.json(propostas.map(p=>({...dadosObraDaProposta(p),numero:p.numero,clienteNome:p.cliente.nomeFantasia||p.cliente.razaoSocial,
  obra:obras.find(o=>o.propostaId===p.propostaid)||null})));
}catch(e:any){res.status(400).json({error:e.message});}};
export const criar=async(req:Request,res:Response)=>{try{
 const obra=await prisma.$transaction(db=>criarObraDaProposta(db,req.empresaId!,req.body,req.usuario?.id),{isolationLevel:'Serializable',timeout:15000});
 res.status(201).json(obra);
}catch(e:any){res.status(400).json({error:e.message});}};
