import {Request,Response} from "express";
import {statusEmailUsuario,salvarEmailUsuario} from "../services/emailUsuario.service";
export async function status(req:Request,res:Response){try{res.json(await statusEmailUsuario(req.usuario!.id,req.empresaId!));}catch(e:any){res.status(e.statusCode||500).json({error:e.message});}}
export async function salvar(req:Request,res:Response){try{res.json(await salvarEmailUsuario(req.usuario!.id,req.empresaId!,req.body));}catch(e:any){res.status(e.statusCode||500).json({error:e.message});}}
