/**
 * IBGE, via API pública de localidades. Não envia CNPJ, notas ou tokens.
 * Falha fechada: se município não for localizado de forma inequívoca,
 * mantém o campo em branco e a emissão exige revisão.
 */
const cache = new Map<string, { data:number, entries:Map<string,string> }>();
const normalizar=(s:unknown)=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .trim().toUpperCase().replace(/[^A-Z0-9 ]/g,"").replace(/\s+/g," ");
export async function codigoMunicipioIBGE(cidade:unknown, uf:unknown):Promise<string|null>{
 const estado=String(uf||"").trim().toUpperCase();
 const nome=normalizar(cidade);
 if(!/^[A-Z]{2}$/.test(estado) || !nome) return null;
 // Código verificado em fonte primária IBGE. Usa-se cache estático
 // apenas quando o nome e UF correspondem exatamente.
 if(estado==="SP"&&nome==="CAMPINAS")return "3509502";
 let entry=cache.get(estado);
 if(!entry||Date.now()-entry.data>86400000){
   try{
     const resposta=await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados/"+estado+"/municipios",{
       signal:AbortSignal.timeout(5000),headers:{Accept:"application/json"}
     });
     if(!resposta.ok)return null;
     const rows=await resposta.json();
     if(!Array.isArray(rows))return null;
     const dados=new Map<string,string>();
     for(const row of rows){
       const nomeUf=normalizar(row?.nome),id=String(row?.id||"");
       if(nomeUf&&/^\d{7}$/.test(id))dados.set(nomeUf,id);
     }
     entry={data:Date.now(),entries:dados};
     cache.set(estado,entry);
   }catch(_){return null;}
 }
 return entry.entries.get(nome)||null;
}
export async function notaComMunicipioIBGE(nota:any){
 if(nota?.empresaId!==1 || nota?.tipo!=="NFSE" ||
  (nota.padraoNfseEmissao||nota.empresaFiscal?.padraoNfse)!=="NACIONAL")return nota;
 if(/^\d{7}$/.test(String(nota.destinatarioCodigoMunicipio||"").replace(/\D/g,"")))return nota;
 const codigo=await codigoMunicipioIBGE(nota.destinatarioCidade||nota.cliente?.cidade,
   nota.destinatarioEstado||nota.cliente?.estado);
 return codigo?{...nota,destinatarioCodigoMunicipio:codigo}:nota;
}
