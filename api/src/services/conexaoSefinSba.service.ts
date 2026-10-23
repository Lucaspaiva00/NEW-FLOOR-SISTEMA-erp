import { createDecipheriv, hkdfSync } from "node:crypto";
import { connect as tlsConnect } from "node:tls";
import { validarCertificadoA1Sba } from "./certificadoA1Sba.service";

const HOST="sefin.producaorestrita.nfse.gov.br";

/**
 * Somente teste de negociação TLS com a SEFIN em PRODUÇÃO RESTRITA.
 * NÃO chama POST /nfse, NÃO envia DPS e não confirma acesso ao emissor.
 */
export async function testarCanalTlsSefinSba(
  envelopeCriptografado:string,empresaId:number,empresaFiscalId:number
):Promise<{
  tlsConectou:true;servidorValidado:true;protocolo:string|null;
  host:string;apiAutorizada:false;notaTransmitida:false;
}>{
  if(!Number.isSafeInteger(empresaId)||empresaId<=0||
     !Number.isSafeInteger(empresaFiscalId)||empresaFiscalId<=0)throw Error("Empresa inválida");
  const segredo=process.env.CERTIFICADO_ENCRYPTION_KEY||process.env.JWT_SECRET;
  if(!segredo)throw Error("Chave do servidor indisponível.");
  let buffer:Buffer|undefined;
  let arquivoCertificado:Buffer|undefined;
  let senha="";
  try{
    const obj=JSON.parse(envelopeCriptografado);
    if(obj.v!==1||![obj.iv,obj.tag,obj.data].every((v:unknown)=>typeof v==="string"))throw Error();
    const key=Buffer.from(hkdfSync("sha256",segredo,"sba-certificado-a1","fiscal-v1",32));
    const dec=createDecipheriv("aes-256-gcm",key,Buffer.from(obj.iv,"base64"));
    dec.setAAD(Buffer.from(empresaId+":"+empresaFiscalId));
    dec.setAuthTag(Buffer.from(obj.tag,"base64"));
    buffer=Buffer.concat([dec.update(Buffer.from(obj.data,"base64")),dec.final()]);
    const pacote=JSON.parse(buffer.toString("utf8"));
    senha=pacote.senha;
    arquivoCertificado=validarCertificadoA1Sba(pacote.arquivo,senha);
  }catch{throw Error("Não foi possível utilizar o A1 da emissora SBA.");}
  finally{buffer?.fill(0);}
  try{
    return await new Promise((resolve,reject)=>{
      let concluido=false;
      const terminar=(erro?:Error,resultado?:any)=>{
        if(concluido)return;
        concluido=true;
        socket.destroy();
        if(erro)reject(erro);else resolve(resultado);
      };
      const socket=tlsConnect({
        host:HOST,port:443,servername:HOST,
        pfx:arquivoCertificado,passphrase:senha,
        minVersion:"TLSv1.2",rejectUnauthorized:true,timeout:12000,
        ALPNProtocols:["http/1.1"]
      });
      socket.once("secureConnect",()=>{
        if(!socket.authorized){
          terminar(Error("A identidade TLS do servidor SEFIN não foi validada."));return;
        }
        terminar(undefined,{
          tlsConectou:true,servidorValidado:true,protocolo:socket.getProtocol(),host:HOST,
          apiAutorizada:false,notaTransmitida:false
        });
      });
      socket.once("timeout",()=>terminar(Error("Tempo esgotado ao conectar à SEFIN de homologação.")));
      socket.once("error",err=>{
        const code=String((err as any).code||"");
        const reason=/^E(?:TIMEDOUT|CONNRESET|CONNREFUSED|HOSTUNREACH|NETUNREACH)$/.test(code)
          ?"Não foi possível alcançar a SEFIN pelo canal TLS."
          :"A negociação TLS com a SEFIN foi recusada. Confirme habilitação e cadeia do certificado.";
        terminar(Error(reason));
      });
    });
  }finally{
    arquivoCertificado?.fill(0);senha="";
  }
}
