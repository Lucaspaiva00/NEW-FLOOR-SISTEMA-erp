import {Request,Response,NextFunction} from 'express';
import {registrarAuditoria,EventoAuditoria} from '../services/auditoriaAdmin.service';
export function eventoDaRequisicao(req:Request,res:Response,inicio:number):EventoAuditoria|null{
 if(res.locals.auditoriaRegistrada)return null;
 const actor=res.locals.auditActor||req.usuario;
 if(!actor||!req.route)return null;
 const rota=String(req.route.path||'').split('?')[0];
 if(req.method==='GET'&&rota.startsWith('/superadmin'))return null;
 return {empresaId:res.locals.auditEmpresaId??req.empresaId??actor.empresaId??null,usuarioId:actor.id,
 usuarioNome:actor.nome,papel:actor.role,acao:rota==='/usuarios/login'?'LOGIN':req.method==='GET'?'CONSULTAR':req.method==='POST'?'EXECUTAR':req.method==='DELETE'?'EXCLUIR':'ALTERAR',
 modulo:rota.split('/')[1]||'sistema',rota,metodo:req.method,status:res.statusCode,duracaoMs:Date.now()-inicio,
 detalhes:res.locals.auditDetalhes,alvoId:/^\d+$/.test(String(req.params.id||''))?String(req.params.id):null};
}
export default function auditoria(req:Request,res:Response,next:NextFunction){
 const inicio=Date.now();res.once('finish',()=>{const evento=eventoDaRequisicao(req,res,inicio);if(evento)void registrarAuditoria(evento).catch(()=>console.error('Falha ao registrar evento de auditoria.'));});next();
}
