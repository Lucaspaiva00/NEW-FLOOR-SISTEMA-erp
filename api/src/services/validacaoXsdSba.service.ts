import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type XsdResultado = {
  valido:boolean;versao?:string;sha256?:string;erro?:string;
};
export function estadoXsdOficialSba():{disponivel:boolean,versao:string,fonte:string}{
  const arquivo=resolve(process.cwd(),"nfse-xsds","manifest.json");
  if(!existsSync(arquivo))return {
    disponivel:false,versao:"PRODREST-v1.01-20261020",
    fonte:"gov.br/nfse/Documentação Técnica (Homologação/testes)"
  };
  try{
    const m=JSON.parse(readFileSync(arquivo,"utf8"));
    return {disponivel:m.versao==="PRODREST-v1.01-20261020"&&!!m.raiz,
      versao:String(m.versao),fonte:String(m.fonte||"")};
  }catch{return {disponivel:false,versao:"PRODREST-v1.01-20261020",fonte:"gov.br"};}
}
/**
 * Validação XSD da DPS, isolada em processo Node ESM. Não usa shell,
 * não faz requisição fiscal e nunca registra XML em logs.
 * O schema precisa ser obtido na origem oficial durante o build.
 */
export async function validarDpsOficialSba(xml:string):Promise<XsdResultado>{
 if(!estadoXsdOficialSba().disponivel)return {
   valido:false,erro:"Pacote XSD oficial de 20/10/2026 não disponível neste deploy. Validação e transmissão bloqueadas."
 };
 if(typeof xml!=="string"||xml.length>1_000_000)return {
   valido:false,erro:"XML excede o limite permitido para validação."
 };
 const script=resolve(process.cwd(),"scripts","validar-dps-xsd.mjs");
 return new Promise(resolvePromise=>{
   const filho=spawn(process.execPath,[script],{
     cwd:process.cwd(),stdio:["pipe","pipe","pipe"],env:{...process.env,NODE_OPTIONS:"--max-old-space-size=160"}
   });
   let output="",erros="";
   let encerrado=false;
   const encerrar=(r:XsdResultado)=>{
     if(encerrado)return;
     encerrado=true;clearTimeout(timer);filho.kill();
     resolvePromise(r);
   };
   const timer=setTimeout(()=>encerrar({valido:false,erro:"Validação XSD excedeu o tempo limite."}),12000);
   filho.stdout.setEncoding("utf8");
   filho.stdout.on("data",chunk=>{
     output+=chunk;
     if(output.length>9000)encerrar({valido:false,erro:"Validador retornou informação excessiva."});
   });
   filho.stderr.setEncoding("utf8");
   filho.stderr.on("data",chunk=>{erros+=chunk.slice(0,1000);});
   filho.on("error",()=>encerrar({valido:false,erro:"Validador XSD indisponível no servidor."}));
   filho.on("close",code=>{
     if(encerrado)return;
     if(code!==0){encerrar({valido:false,erro:"Falha técnica do verificador XSD."});return;}
     try{
       const data=JSON.parse(output);
       encerrar(data.valido===true?{
         valido:true,versao:String(data.versao),sha256:String(data.sha256)
       }:{
         valido:false,erro:String(data.erro||"XML rejeitado pelo esquema XSD oficial.").slice(0,700)
       });
     }catch{encerrar({valido:false,erro:"Resultado inválido do verificador XSD."});}
   });
   filho.stdin.on("error",()=>undefined);
   filho.stdin.end(xml);
 });
}
