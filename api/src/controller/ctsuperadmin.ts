import {resumoKpis,validadeA1} from '../services/superadminKpis.service';
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
 const agora=new Date(),ha30dias=new Date(+agora-30*86400000),ha24h=new Date(+agora-86400000);
 const hojeBr=agora.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),inicioHoje=new Date(hojeBr+'T03:00:00Z');
 const [empresas,usuarios,clientes,comercial,fiscal,financeiro,uso,modulos,cobertura,plataforma,emissoras]=await Promise.all([
 prisma.empresa.findMany({orderBy:{nome:'asc'},select:{empresaid:true,nome:true,slug:true,ativo:true,emailContato:true,telefoneContato:true,configuracaoSistema:true,createdAt:true}}),
 prisma.usuario.findMany({select:{...usuarioPublico,empresaId:true}}),
 prisma.cliente.groupBy({by:['empresaId'],_count:{_all:true}}),
 prisma.$queryRaw<any[]>`SELECT "empresaId",COUNT(*)::integer AS "totalPropostas",COUNT(*) FILTER (WHERE status='APROVADA')::integer AS "aprovadasSemFaturar" FROM "Proposta" GROUP BY "empresaId"`,
 prisma.$queryRaw<any[]>`SELECT n."empresaId",COUNT(*) FILTER (WHERE n.status IN ('ERRO','REJEITADA'))::integer AS "notasComProblema",COUNT(*) FILTER (WHERE n.status='PROCESSANDO' AND n."updatedAt"<${ha24h})::integer AS "processando24h" FROM "NotaFiscal" n JOIN "EmpresaFiscal" e ON e.empresafiscalid=n."empresaFiscalId" WHERE COALESCE(n."ambienteEmissao",e.ambiente)='PRODUCAO' GROUP BY n."empresaId"`,
 prisma.$queryRaw<any[]>`SELECT "empresaId",COUNT(*)::integer AS "contasVencidas" FROM "LancamentoFinanceiro" WHERE status='ABERTO' AND valor>"valorPago" AND "dataVencimento"<${inicioHoje} GROUP BY "empresaId"`,
 prisma.$queryRaw<any[]>`SELECT "empresaId",MAX("createdAt") FILTER (WHERE "papel" IS DISTINCT FROM 'SUPER_ADMIN' AND status<400) AS "ultimaAtividade",COUNT(*) FILTER (WHERE "createdAt">=${ha24h})::integer AS "eventos24h",COUNT(DISTINCT "usuarioId") FILTER (WHERE "createdAt">=${ha30dias} AND status<400 AND "papel" IS DISTINCT FROM 'SUPER_ADMIN')::integer AS "usuariosAtivos30dias",COUNT(*) FILTER (WHERE "createdAt">=${ha24h} AND status>=400)::integer AS "erros24h",COUNT(*) FILTER (WHERE "createdAt">=${ha24h} AND status>=500)::integer AS "errosServidor24h" FROM "AuditoriaSistema" WHERE "empresaId" IS NOT NULL GROUP BY "empresaId"`,
 prisma.$queryRaw<any[]>`SELECT modulo,COUNT(*)::integer AS requisicoes,COUNT(DISTINCT "empresaId")::integer AS empresas FROM "AuditoriaSistema" WHERE "createdAt">=${ha30dias} AND status<400 AND "empresaId" IS NOT NULL AND "papel" IS DISTINCT FROM 'SUPER_ADMIN' AND modulo NOT IN ('usuarios','empresas','sistema','superadmin') GROUP BY modulo ORDER BY COUNT(*) DESC,modulo LIMIT 8`,
 prisma.$queryRaw<any[]>`SELECT MIN("createdAt") AS desde FROM "AuditoriaSistema"`,
 prisma.$queryRaw<any[]>`SELECT COUNT(*)::integer AS "erros24h",COUNT(*) FILTER (WHERE status>=500)::integer AS "errosServidor24h" FROM "AuditoriaSistema" WHERE "empresaId" IS NULL AND "createdAt">=${ha24h} AND status>=400`,
 prisma.empresaFiscal.findMany({where:{ativo:true},select:{empresafiscalid:true,empresaId:true,razaoSocial:true,certificadoCriptografado:true}})
 ]);
 const dados=resumoKpis({empresas,usuarios,clientes,comercial,fiscal,financeiro,uso,modulos,cobertura,plataforma,certificados:emissoras.map(e=>validadeA1(e,agora))},agora);
 res.setHeader('Cache-Control','no-store');res.json({perfil:res.locals.superadmin,...dados,auditoriaDesde:'Uso calculado por requisições registradas, sem incluir o superadmin. Ausência de histórico não é ausência de uso.'});
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

export const pendencias=handle(async(req,res)=>{
 const tipo=String(req.query.tipo||''),empresaId=req.query.empresaId?id(req.query.empresaId):null,pagina=req.query.pagina?Number(req.query.pagina):1;
 if(!['notas','processando','propostas','vencidas','certificados'].includes(tipo)||!Number.isSafeInteger(pagina)||pagina<1||pagina>100000)throw Error('Filtro inválido.');
 const empresa=empresaId?{empresaId}:{};let linhas:any[]=[],total=0;
 if(tipo==='certificados'){
  const emissoras=await prisma.empresaFiscal.findMany({where:{...empresa,ativo:true},select:{empresafiscalid:true,empresaId:true,razaoSocial:true,certificadoCriptografado:true}}),alertas=emissoras.map(e=>validadeA1(e)).filter(e=>['VENCIDO','VENCE_30_DIAS'].includes(e.situacao));total=alertas.length;
  linhas=alertas.slice((pagina-1)*50,pagina*50).map(e=>({id:e.id,empresaId:e.empresaId,titulo:e.nome,descricao:'Certificado A1 local',status:e.situacao,quando:e.vencimento}));
 }else if(tipo==='notas'||tipo==='processando'){
  const where:any={...empresa,OR:[{ambienteEmissao:'PRODUCAO'},{ambienteEmissao:null,empresaFiscal:{ambiente:'PRODUCAO'}}],...(tipo==='notas'?{status:{in:['ERRO','REJEITADA']}}:{status:'PROCESSANDO',updatedAt:{lt:new Date(Date.now()-86400000)}})};
  const [itens,count]=await Promise.all([prisma.notaFiscal.findMany({where,select:{notafiscalid:true,empresaId:true,tipo:true,numero:true,referencia:true,destinatarioNome:true,status:true,updatedAt:true,valorTotal:true},orderBy:{updatedAt:'asc'},skip:(pagina-1)*50,take:50}),prisma.notaFiscal.count({where})]);total=count;linhas=itens.map(n=>({id:n.notafiscalid,empresaId:n.empresaId,titulo:n.tipo+' '+(n.numero||n.referencia),descricao:n.destinatarioNome,status:n.status,quando:n.updatedAt,valor:Number(n.valorTotal)}));
 }else if(tipo==='propostas'){
  const where={...empresa,status:'APROVADA' as const};const [itens,count]=await Promise.all([prisma.proposta.findMany({where,select:{propostaid:true,empresaId:true,numero:true,titulo:true,status:true,updatedAt:true,subtotal:true,frete:true},orderBy:{updatedAt:'asc'},skip:(pagina-1)*50,take:50}),prisma.proposta.count({where})]);total=count;linhas=itens.map(p=>({id:p.propostaid,empresaId:p.empresaId,titulo:'Proposta '+p.numero,descricao:p.titulo,status:p.status,quando:p.updatedAt,valor:Number(p.subtotal)+Number(p.frete||0)}));
 }else{
  const hoje=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),where:any={...empresa,status:'ABERTO',dataVencimento:{lt:new Date(hoje+'T03:00:00Z')},valor:{gt:prisma.lancamentoFinanceiro.fields.valorPago}};
  const [itens,count]=await Promise.all([prisma.lancamentoFinanceiro.findMany({where,select:{lancamentofinanceiroid:true,empresaId:true,descricao:true,tipo:true,dataVencimento:true,valor:true,valorPago:true},orderBy:{dataVencimento:'asc'},skip:(pagina-1)*50,take:50}),prisma.lancamentoFinanceiro.count({where})]);total=count;linhas=itens.map(l=>({id:l.lancamentofinanceiroid,empresaId:l.empresaId,titulo:l.descricao,descricao:l.tipo==='ENTRADA'?'A receber':'A pagar',status:'VENCIDA',quando:l.dataVencimento,valor:Number(l.valor)-Number(l.valorPago)}));
 }
 res.setHeader('Cache-Control','no-store');res.json({linhas,total,pagina,paginas:Math.max(1,Math.ceil(total/50))});
});
