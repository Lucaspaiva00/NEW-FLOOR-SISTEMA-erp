import {Prisma} from '@prisma/client';
import {registrarAuditoria} from './auditoriaAdmin.service';
import {id,texto,data} from './obras.service';
export const usuarioPublico={usuarioid:true,nome:true,email:true,role:true,ativo:true,ultimoLogin:true,createdAt:true,cargo:true,telefone:true} as const;
export function filtrosLogs(q:any){
 const inteiro=(v:any,padrao:number,max:number)=>{const n=v===undefined||v===''?padrao:Number(v);if(!Number.isSafeInteger(n)||n<1||n>max)throw Error('Filtro numérico inválido.');return n;};
 const pagina=inteiro(q.pagina,1,100000),empresaId=q.empresaId?inteiro(q.empresaId,1,2147483647):null,usuarioId=q.usuarioId?inteiro(q.usuarioId,1,2147483647):null;
 const ate=q.horas24==='true'?new Date():q.fim?new Date(+data(q.fim)+27*3600000-1):new Date(),de=q.horas24==='true'?new Date(+ate-86400000):q.inicio?new Date(+data(q.inicio)+3*3600000):new Date(+ate-7*86400000);
 if(!Number.isFinite(+de)||!Number.isFinite(+ate)||de>ate||+ate-+de>367*86400000)throw Error('Período inválido (máximo de um ano).');
 const modulo=String(q.modulo||'');if(modulo&&!/^[a-z-]{1,80}$/.test(modulo))throw Error('Módulo inválido.');
 return {pagina,empresaId,usuarioId,inicio:de,fim:ate,modulo,erros:q.erros==='true',servidor:q.servidor==='true'};
}
export async function editarCadastroEmpresa(db:any,empresaId:number,b:any,actor:{id:number;nome?:string;role:string}){
 const nome=texto(b.nome,'nome da empresa',200),admins=Array.isArray(b.administradores)?b.administradores:[];
 if(admins.length>50||new Set(admins.map((a:any)=>id(a.id))).size!==admins.length)throw Error('Lista de administradores inválida.');
 const atual=await db.empresa.findUnique({where:{empresaid:empresaId},select:{empresaid:true,nome:true,emailContato:true,telefoneContato:true}});
 if(!atual)throw Error('Empresa não encontrada.');
 const dadosAdmins=[];
 for(const a of admins){
  const usuario=await db.usuario.findFirst({where:{usuarioid:id(a.id),empresaId,role:'ADMIN'},select:{usuarioid:true,nome:true}});
  if(!usuario)throw Error('Administrador não pertence a esta empresa.');
  dadosAdmins.push({id:usuario.usuarioid,antes:usuario.nome,nome:texto(a.nome,'nome do administrador',200)});
 }
 const emailContato=b.emailContato===undefined?atual.emailContato:String(b.emailContato).trim().slice(0,254)||null;
 if(emailContato&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailContato))throw Error('E-mail de contato inválido.');
 const telefoneContato=b.telefoneContato===undefined?atual.telefoneContato:String(b.telefoneContato).trim().slice(0,50)||null;
 const empresa=await db.empresa.update({where:{empresaid:empresaId},data:{nome,emailContato,telefoneContato}});
 for(const a of dadosAdmins)await db.usuario.update({where:{usuarioid:a.id},data:{nome:a.nome}});
 await registrarAuditoria({empresaId,usuarioId:actor.id,usuarioNome:actor.nome,papel:actor.role,acao:'EDITAR_CADASTRO',modulo:'empresas',rota:'/superadmin/empresas/:id',metodo:'PATCH',status:200,alvoId:String(empresaId),detalhes:{antes:atual,depois:{nome,emailContato,telefoneContato},administradores:dadosAdmins}},db);
 return {empresaid:empresa.empresaid,nome:empresa.nome};
}
export function condicaoLogs(f:ReturnType<typeof filtrosLogs>){return Prisma.sql`a."createdAt" >= ${f.inicio} AND a."createdAt" <= ${f.fim}
 ${f.empresaId?Prisma.sql`AND a."empresaId"=${f.empresaId}`:Prisma.empty}
 ${f.usuarioId?Prisma.sql`AND a."usuarioId"=${f.usuarioId}`:Prisma.empty}
 ${f.modulo?Prisma.sql`AND a."modulo"=${f.modulo}`:Prisma.empty}
 ${f.servidor?Prisma.sql`AND a."status">=500`:f.erros?Prisma.sql`AND a."status">=400`:Prisma.empty}`;}
