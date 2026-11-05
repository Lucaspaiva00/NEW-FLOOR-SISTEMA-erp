import {Request,Response,NextFunction} from 'express';
import prisma from '../prisma';
import {filtrosLogs,condicaoLogs,editarCadastroEmpresa,usuarioPublico} from '../services/superadmin.service';
import {id,texto} from '../services/obras.service';
import {registrarAuditoria} from '../services/auditoriaAdmin.service';
export async function somenteSuperAdmin(req:Request,res:Response,next:NextFunction){
 if(req.usuario?.role!=='SUPER_ADMIN'){res.status(403).json({error:'Acesso exclusivo do superadmin.'});return;}
 const u=await prisma.usuario.findFirst({where:{usuarioid:req.usuario.id,role:'SUPER_ADMIN',ativo:true},select:{usuarioid:true,nome:true}});
 if(!u){res.status(403).json({error:'Superadmin inativo ou sem permissão.'});return;}
 res.locals.superadmin=u;next();
}
const handle=(fn:(req:Request,res:Response)=>Promise<void>)=>async(req:Request,res:Response)=>{try{await fn(req,res);}catch(e:any){res.status(400).json({error:e.message||'Não foi possível concluir.'});}};
export const resumo=handle(async(req,res)=>{
 const ha30dias=new Date(Date.now()-30*86400000),ha24h=new Date(Date.now()-86400000);
 const [empresas,usuarios,propostas,clientes,notas,uso,erros]=await Promise.all([
 prisma.empresa.findMany({orderBy:{nome:'asc'},select:{empresaid:true,nome:true,slug:true,ativo:true,emailContato:true,telefoneContato:true,configuracaoSistema:true,createdAt:true}}),
 prisma.usuario.findMany({select:{...usuarioPublico,empresaId:true}}),
 prisma.proposta.groupBy({by:['empresaId'],_count:{_all:true}}),prisma.cliente.groupBy({by:['empresaId'],_count:{_all:true}}),
 prisma.notaFiscal.groupBy({by:['empresaId','status'],_count:{_all:true}}),
 prisma.$queryRaw<any[]>`SELECT "empresaId",MAX("createdAt") as "ultimaAtividade",COUNT(*)::integer as "eventos24h" FROM "AuditoriaSistema" WHERE "createdAt">=${ha24h} GROUP BY "empresaId"`,
 prisma.$queryRaw<any[]>`SELECT "empresaId",COUNT(*)::integer as "erros24h" FROM "AuditoriaSistema" WHERE "createdAt">=${ha24h} AND "status">=400 GROUP BY "empresaId"`]);
 const itens=empresas.map(e=>{const users=usuarios.filter(u=>u.empresaId===e.empresaid);return {...e,usuarios:users,
  totalUsuarios:users.length,usuarios30dias:users.filter(u=>u.ultimoLogin&&u.ultimoLogin>=ha30dias).length,
  ultimoLogin:users.reduce<Date|null>((d,u)=>u.ultimoLogin&&(!d||u.ultimoLogin>d)?u.ultimoLogin:d,null),
  totalPropostas:propostas.find(p=>p.empresaId===e.empresaid)?._count._all||0,totalClientes:clientes.find(c=>c.empresaId===e.empresaid)?._count._all||0,
  notasComProblema:notas.filter(n=>n.empresaId===e.empresaid&&['ERRO','REJEITADA'].includes(n.status)).reduce((s,n)=>s+n._count._all,0),
  ...uso.find(u=>u.empresaId===e.empresaid),erros24h:erros.find(u=>u.empresaId===e.empresaid)?.erros24h||0};});
 res.json({perfil:res.locals.superadmin,geradoEm:new Date(),auditoriaDesde:'Registros de atividade disponíveis a partir da implantação da auditoria.',
 kpis:{empresas:empresas.length,ativas:empresas.filter(e=>e.ativo).length,usuarios:usuarios.filter(u=>u.empresaId!==null).length,
 usuarios30dias:usuarios.filter(u=>u.empresaId!==null&&u.ultimoLogin&&u.ultimoLogin>=ha30dias).length,
 erros24h:erros.reduce((s,u)=>s+u.erros24h,0),notasComProblema:itens.reduce((s,e)=>s+e.notasComProblema,0)},empresas:itens});
});
export const logs=handle(async(req,res)=>{
 const f=filtrosLogs(req.query),where=condicaoLogs(f);
 const [linhas,total]=await Promise.all([
 prisma.$queryRaw<any[]>`SELECT a."id"::text,a."createdAt",a."empresaId",e."nome" as "empresaNome",a."usuarioId",COALESCE(a."usuarioNome",u."nome",'Usuário removido') as "usuarioNome",a."papel",a."acao",a."modulo",a."rota",a."metodo",a."status",a."duracaoMs",a."alvoId",a."detalhes" FROM "AuditoriaSistema" a LEFT JOIN "Empresa" e ON e."empresaid"=a."empresaId" LEFT JOIN "Usuario" u ON u."usuarioid"=a."usuarioId" WHERE ${where} ORDER BY a."createdAt" DESC,a."id" DESC LIMIT 50 OFFSET ${(f.pagina-1)*50}`,
 prisma.$queryRaw<any[]>`SELECT COUNT(*)::integer as total FROM "AuditoriaSistema" a WHERE ${where}`]);
 res.json({linhas,total:total[0].total,pagina:f.pagina,paginas:Math.max(1,Math.ceil(total[0].total/50))});
});
export const editar=handle(async(req,res)=>{
 const empresa=await prisma.$transaction(db=>editarCadastroEmpresa(db,id(req.params.id),req.body,{id:req.usuario!.id,role:'SUPER_ADMIN',nome:res.locals.superadmin.nome}));
 res.locals.auditoriaRegistrada=true;res.json(empresa);
});
export const meuPerfil=handle(async(req,res)=>{
 const nome=texto(req.body.nome,'seu nome',200),u=res.locals.superadmin;
 await prisma.$transaction(async db=>{await db.usuario.update({where:{usuarioid:u.usuarioid},data:{nome}});
 await registrarAuditoria({usuarioId:u.usuarioid,usuarioNome:u.nome,papel:'SUPER_ADMIN',acao:'RENOMEAR_PERFIL',modulo:'usuarios',rota:'/superadmin/perfil',metodo:'PATCH',status:200,detalhes:{antes:u.nome,depois:nome}},db);});
 res.locals.auditoriaRegistrada=true;res.json({nome});
});
