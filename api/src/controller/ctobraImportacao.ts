import {Request,Response} from 'express';
import prisma from '../prisma';
import {lerArquivo,assinarPrevia,importar} from '../services/obrasImportacao.service';
export async function previa(req:Request,res:Response){try{const p=await lerArquivo(req.body.arquivo,req.body.ano);res.json({...p,assinatura:assinarPrevia(req.empresaId!,p.hash,Number(req.body.ano))});}catch(e:any){res.status(400).json({error:e.message||'Não foi possível ler a planilha.'});}}
export async function confirmar(req:Request,res:Response){try{const p=await lerArquivo(req.body.arquivo,req.body.ano);res.json(await prisma.$transaction(db=>importar(db,req.empresaId!,p,req.body,req.usuario?.id),{isolationLevel:'Serializable',timeout:120000}));}catch(e:any){res.status(400).json({error:e.message||'Importação revertida. Nenhum registro foi gravado.'});}}
