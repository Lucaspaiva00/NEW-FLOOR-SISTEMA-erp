import {Request,Response} from "express";
import {createCipheriv,hkdfSync,randomBytes} from "crypto";
import forge from "node-forge";
import prisma from "../prisma";
export function validarCertificado(base64:string,senha:string) {
 if(typeof base64!=="string"||typeof senha!=="string"||base64.length>1400000||!base64.length||!senha.length||senha.length>1000) throw new Error("Arquivo e senha obrigatórios; limite de 1 MB.");
 const buffer=Buffer.from(base64,"base64");if(buffer.length>1024*1024)throw new Error("Certificado maior que 1 MB");
 let pfx;
 try{pfx=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(buffer.toString("binary")),senha);}catch{throw new Error("Certificado inválido ou senha incorreta.");}
 const keys=pfx.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]||[];
 const plain=pfx.getBags({bagType:forge.pki.oids.keyBag})[forge.pki.oids.keyBag]||[];
 const certs=pfx.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[];
 if(![...keys,...plain].some(b=>b.key)||!certs.some(b=>b.cert&&b.cert.validity.notBefore<=new Date()&&b.cert.validity.notAfter>new Date()))throw new Error("A1 sem chave privada ou certificado válido.");
 return buffer;
}
export function criptografarCertificado(base64:string,senha:string,empresaId:number,id:number){
 const secret=process.env.CERTIFICADO_ENCRYPTION_KEY||process.env.JWT_SECRET;if(!secret)throw new Error("Chave de criptografia não configurada");
 const key=Buffer.from(hkdfSync("sha256",secret,"sba-certificado-a1","fiscal-v1",32)),iv=randomBytes(12);
 const cipher=createCipheriv("aes-256-gcm",key,iv);cipher.setAAD(Buffer.from(`${empresaId}:${id}`));
 const encrypted=Buffer.concat([cipher.update(JSON.stringify({arquivo:base64,senha}),"utf8"),cipher.final()]);
 return JSON.stringify({v:1,iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),data:encrypted.toString("base64")});
}
export async function upload(req:Request,res:Response):Promise<void>{
 if(!req.configuracaoSistema?.certificadoA1){res.status(403).json({error:"Certificado A1 desabilitado para esta empresa"});return;}
 const id=Number(req.params.id);
 try{const emissora=await prisma.empresaFiscal.findFirst({where:{empresafiscalid:id,empresaId:req.empresaId as number}});if(!emissora){res.status(404).json({error:"Empresa emissora não encontrada"});return;}
 const {arquivo,senha,nome}=req.body;
 if(typeof nome!=="string"||!/^.+\.(pfx|p12)$/i.test(nome))throw new Error("Selecione um arquivo PFX ou P12");
 validarCertificado(arquivo,senha);
 const certificadoCriptografado=criptografarCertificado(arquivo,senha,req.empresaId as number,id);
 await prisma.empresaFiscal.update({where:{empresafiscalid:id},data:{certificadoCriptografado,certificadoNome:nome.slice(0,200)}});
 res.json({temCertificado:true,certificadoNome:nome.slice(0,200)});
 }catch(e){res.status(400).json({error:(e as Error).message});}
}
