import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import nodemailer from "nodemailer";
import prisma from "../prisma";
export interface ContaEmailUsuario { email:string; nome:string; host:string; port:number; senha:string }
const erro=(texto:string,statusCode=422)=>Object.assign(new Error(texto),{statusCode});
function chave(segredo:string){if(!segredo)throw erro("Configuração de criptografia indisponível.");return crypto.createHash("sha256").update("smtp-usuario-v1:"+segredo).digest();}
export function cifrarSmtp(dados:unknown,segredo:string){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",chave(segredo),iv);
 const texto=Buffer.concat([cipher.update(JSON.stringify(dados),"utf8"),cipher.final()]);
 return ["v1",iv.toString("base64"),cipher.getAuthTag().toString("base64"),texto.toString("base64")].join(".");
}
export function decifrarSmtp(texto:string,segredo:string):any{
 try{const [v,iv,tag,corpo]=texto.split(".");if(v!=="v1")throw Error();const decipher=crypto.createDecipheriv("aes-256-gcm",chave(segredo),Buffer.from(iv,"base64"));decipher.setAuthTag(Buffer.from(tag,"base64"));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(corpo,"base64")),decipher.final()]).toString("utf8"));}
 catch{throw erro("Reconecte seu e-mail de envio no sistema.");}
}
export function validarContaSmtp(host:unknown,port:unknown){
 const servidor=String(host||"").trim().toLowerCase(),porta=Number(port);
 if(!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(servidor)||net.isIP(servidor)||/(?:^|\.)(localhost|local|internal|test|invalid)$/.test(servidor))throw erro("Informe o servidor SMTP público do seu provedor de e-mail.");
 if(![465,587].includes(porta))throw erro("Use a porta SMTP segura 465 ou 587.");
 return {host:servidor,port:porta};
}
async function hostPublico(host:string){
 const rows=await dns.lookup(host,{all:true});
 if(!rows.length||rows.some(({address})=>{const v=address.toLowerCase();if(v.includes(":"))return !/^[23]/.test(v);const [a,b]=v.split(".").map(Number);return a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127);}))throw erro("O servidor SMTP deve usar um endereço público do provedor.");
}
export function transporteUsuario(conta:ContaEmailUsuario){
 return nodemailer.createTransport({host:conta.host,port:conta.port,secure:conta.port===465,requireTLS:conta.port===587,connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000,auth:{user:conta.email,pass:conta.senha}});
}
async function usuarioSba(usuarioId:number,empresaId:number){
 if(empresaId!==2)throw erro("Configuração de envio exclusiva da SBA.",403);
 const usuario=await prisma.usuario.findFirst({where:{usuarioid:usuarioId,empresaId,ativo:true,empresa:{slug:"sba"}},select:{usuarioid:true,empresaId:true,email:true,nome:true}});
 if(!usuario)throw erro("Usuário da SBA não encontrado.",403);
 return usuario;
}
/** Credenciais provisionadas pela operação, isoladas por empresa e remetente. */
export function contaEmailGerenciada(
 usuario:{email:string;nome:string},empresaId:number,env:NodeJS.ProcessEnv=process.env
):ContaEmailUsuario|undefined{
 const prefixo=`SMTP_EMPRESA_${empresaId}_`;
 const host=env[prefixo+"HOST"],email=env[prefixo+"USER"],senha=env[prefixo+"PASS"];
 if(!host&&!email&&!senha)return undefined;
 if(!host||!email||!senha)throw erro("O envio de e-mail está em configuração pela administração da plataforma.");
 if(email.trim().toLowerCase()!==usuario.email.trim().toLowerCase())
  throw erro("O remetente cadastrado ainda não foi autorizado pela administração da plataforma.");
 const dados=validarContaSmtp(host,env[prefixo+"PORT"]||465);
 return {...dados,email:usuario.email.trim(),nome:usuario.nome,senha};
}
export async function statusEmailUsuario(usuarioId:number,empresaId:number){
 const u=await usuarioSba(usuarioId,empresaId);
 try{
  const conta=await obterContaEmailUsuario(usuarioId,empresaId);
  return {email:u.email,nome:u.nome,configurado:!!conta,gerenciado:true};
 }catch(e:any){
  if(e.statusCode!==422)throw e;
  return {email:u.email,nome:u.nome,configurado:false,gerenciado:true};
 }
}
export async function obterContaEmailUsuario(usuarioId:number,empresaId:number):Promise<ContaEmailUsuario>{
 const u=await usuarioSba(usuarioId,empresaId);
 const gerenciada=contaEmailGerenciada(u,empresaId);
 if(gerenciada){await hostPublico(gerenciada.host);return gerenciada;}
 // Preserva contas já autorizadas, sem exigir nova configuração ao usuário.
 const row=await prisma.emailUsuario.findFirst({where:{usuarioId,empresaId}});
 if(!row)throw erro("O envio de e-mail precisa ser habilitado pela administração da plataforma para o remetente do seu cadastro.");
 const cfg=decifrarSmtp(row.configuracaoCriptografada,process.env.JWT_SECRET||"");
 if(cfg.email!==u.email||!cfg.senha)throw erro("O remetente cadastrado precisa ser atualizado pela administração da plataforma.");
 validarContaSmtp(cfg.host,cfg.port);await hostPublico(cfg.host);
 return {...cfg,email:u.email,nome:u.nome};
}
export async function salvarEmailUsuario(usuarioId:number,empresaId:number,body:any){
 const u=await usuarioSba(usuarioId,empresaId);const dados=validarContaSmtp(body.host,body.port);
 let senha=String(body.senha||"");
 if(!senha){const anterior=await prisma.emailUsuario.findFirst({where:{usuarioId,empresaId}});if(anterior){const cfg=decifrarSmtp(anterior.configuracaoCriptografada,process.env.JWT_SECRET||"");if(cfg.email===u.email&&cfg.host===dados.host)senha=cfg.senha;}}
 if(!senha)throw erro("Informe a senha de acesso SMTP ou senha de aplicativo da sua caixa de e-mail.");
 await hostPublico(dados.host);
 const conta={...dados,email:u.email,nome:u.nome,senha};const transport=transporteUsuario(conta);
 try{await transport.verify();}catch{throw erro("Não foi possível autenticar sua caixa de e-mail. Confira servidor, porta e senha SMTP com o seu provedor.");}finally{transport.close();}
 const configuracaoCriptografada=cifrarSmtp(conta,process.env.JWT_SECRET||"");
 await prisma.emailUsuario.upsert({where:{usuarioId},create:{usuarioId,empresaId,configuracaoCriptografada},update:{empresaId,configuracaoCriptografada}});
 return {email:u.email,nome:u.nome,configurado:true,...dados};
}
