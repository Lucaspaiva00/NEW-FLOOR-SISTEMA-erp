import {Request,Response} from "express";
import {carregarPadroesNewFloor,salvarPadroesNewFloor} from "../services/newFloorFiscalPadroes.service";
export async function ler(req:Request,res:Response){
 try{res.json({padroes:await carregarPadroesNewFloor(req.empresaId!,Number(req.params.id))});}
 catch(e:any){res.status(e.statusCode||500).json({error:e.message});}
}
export async function salvar(req:Request,res:Response){
 try{res.json({padroes:await salvarPadroesNewFloor(req.empresaId!,Number(req.params.id),req.body)});}
 catch(e:any){res.status(e.statusCode||500).json({error:e.message});}
}
