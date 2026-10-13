import {Request,Response} from 'express';
import prisma from '../prisma';
import {salvarCompra,confirmarCompra,cancelarCompra} from '../services/compras.service';
export async function listar(req:Request,res:Response){try{
 const pagina=Math.min(1000000,Math.max(1,Math.floor(Number(req.query.pagina)||1))),busca=String(req.query.busca||'').slice(0,300),status=String(req.query.status||'');
 const where:any={empresaId:req.empresaId!};if(['RASCUNHO','CONFIRMADA','CANCELADA'].includes(status))where.status=status;if(busca)where.OR=[{numero:{contains:busca,mode:'insensitive'}},{documento:{contains:busca,mode:'insensitive'}},{fornecedor:{nome:{contains:busca,mode:'insensitive'}}}];
 const [total,itens]=await Promise.all([prisma.compra.count({where}),prisma.compra.findMany({where,include:{fornecedor:true,lancamentos:{select:{status:true,valorPago:true,valor:true}}},orderBy:{createdAt:'desc'},skip:(pagina-1)*10,take:10})]);res.json({total,pagina,itens});
 }catch{res.status(500).json({error:'Não foi possível carregar as compras.'});}}
export async function buscar(req:Request,res:Response){const compra=await prisma.compra.findFirst({where:{compraid:Number(req.params.id),empresaId:req.empresaId!},include:{fornecedor:true,lancamentos:true}});if(!compra){res.status(404).json({error:'Compra não encontrada.'});return;}res.json(compra);}
export async function salvar(req:Request,res:Response){try{const id=req.params.id?Number(req.params.id):undefined;res.status(id?200:201).json(await salvarCompra(req.empresaId!,req.body,id));}catch(e:any){res.status(400).json({error:e.message||'Não foi possível salvar a compra.'});}}
export async function confirmar(req:Request,res:Response){try{res.json(await confirmarCompra(req.empresaId!,Number(req.params.id)));}catch(e:any){res.status(400).json({error:e.message});}}
export async function cancelar(req:Request,res:Response){try{res.json(await cancelarCompra(req.empresaId!,Number(req.params.id)));}catch(e:any){res.status(400).json({error:e.message});}}
