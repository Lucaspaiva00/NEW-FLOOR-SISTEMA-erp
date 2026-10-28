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
export async function statusEmailUsuario(usuarioId:number,empresaId:number){
 const u=await usuarioSba(usuarioId,empresaId);const row=await prisma.emailUsuario.findUnique({where:{usuarioId}});
 if(!row)return {email:u.email,nome:u.nome,configurado:false,host:"",port:465};
 const cfg=decifrarSmtp(row.configuracaoCriptografada,process.env.JWT_SECRET||"");
 return {email:u.email,nome:u.nome,configurado:cfg.email===u.email,host:cfg.host,port:cfg.port};
}
export async function obterContaEmailUsuario(usuarioId:number,empresaId:number):Promise<ContaEmailUsuario>{
 const u=await usuarioSba(usuarioId,empresaId);const row=await prisma.emailUsuario.findFirst({where:{usuarioId,empresaId}});
 if(!row)throw erro(`Conecte o e-mail ${u.email} em “Meu e-mail de envio”. A SBA não utiliza o remetente de outra empresa.`);
 const cfg=decifrarSmtp(row.configuracaoCriptografada,process.env.JWT_SECRET||"");
 if(cfg.email!==u.email||!cfg.senha)throw erro("O e-mail do cadastro mudou. Reconecte sua conta de envio.");
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
