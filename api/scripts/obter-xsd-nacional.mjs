import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";

// Pacote oficial de PRODUÇÃO RESTRITA: 20/10/2026, não o de produção.
const url="https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita/esquemas_prod_restrita_20261020.zip";
const destino=resolve(process.cwd(),"nfse-xsds");
const pasta=join(destino,"20261020");
const manifestPath=join(destino,"manifest.json");
const limite=15*1024*1024;
const tempo=AbortSignal.timeout(15000);
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
async function baixar(){
  const resp=await fetch(url,{signal:tempo,redirect:"follow",headers:{"Accept":"application/zip,application/octet-stream"}});
  if(!resp.ok)throw Error("HTTP "+resp.status);
  if(new URL(resp.url).hostname!=="www.gov.br")throw Error("Redirecionamento fora do gov.br");
  const total=Number(resp.headers.get("content-length"));
  if(Number.isFinite(total)&&total>limite)throw Error("ZIP oficial maior que 15 MB");
  const parts=[];let tam=0;
  for await(const chunk of resp.body){
    tam+=chunk.length;
    if(tam>limite)throw Error("ZIP oficial maior que 15 MB");
    parts.push(chunk);
  }
  const zipped=Buffer.concat(parts);
  const files=unzipSync(new Uint8Array(zipped));
  let tamanhoTotal=0;let xmls=[];
  for(const [name,bytes]of Object.entries(files)){
    if(!name.toLowerCase().endsWith(".xsd"))continue;
    const path=name.replace(/\\/g,"/");
    if(path.startsWith("/")||path.split("/").some(segment=>segment===".."||segment==="."))throw Error("ZIP com caminho inválido");
    if(!/^[\w. /()\-]+$/.test(path))throw Error("Nome de arquivo de esquema inesperado");
    tamanhoTotal+=bytes.length;
    if(tamanhoTotal>30*1024*1024)throw Error("Pacote de esquemas excede 30 MB");
    const conteudo=Buffer.from(bytes).toString("utf8");
    if(!/<(?:xs|xsd|schema):schema\b|<schema\b/.test(conteudo))continue;
    xmls.push({name:path,bytes,hash:hash(bytes)});
  }
  if(xmls.length<3||xmls.length>150)throw Error("Arquivo XSD não contém conjunto esperado");
  const candidates=xmls.filter(f=>
    /(?:<xs:element|<xsd:element|<element)\s+name=["']DPS["']/.test(Buffer.from(f.bytes).toString("utf8")) &&
    /DPS/i.test(f.name));
  if(candidates.length!==1)throw Error("Não foi possível identificar o único XSD raiz da DPS");
  // Usa pasta limpa para garantir que XSD antigos não sejam misturados.
  await rm(pasta,{recursive:true,force:true});
  for(const file of xmls){
    const caminho=join(pasta,file.name);
    if(!resolve(caminho).startsWith(pasta+"/"))throw Error("Caminho fora da pasta XSD");
    await mkdir(dirname(caminho),{recursive:true});
    await writeFile(caminho,file.bytes);
  }
  const manifest={
    fonte:url,versao:"PRODREST-v1.01-20261020",consultadoEm:new Date().toISOString(),
    zipSha256:hash(zipped),raiz:candidates[0].name,
    arquivos:xmls.map(f=>({nome:f.name,sha256:f.hash}))
  };
  await mkdir(destino,{recursive:true});
  await writeFile(manifestPath,JSON.stringify(manifest,null,2));
  process.stdout.write("Pacote oficial XSD obtido: "+xmls.length+" arquivos; raiz="+candidates[0].name+"\n");
}
try{await baixar();}
catch(err){
  // Não implantar validação falsa nem impedir os outros perfis de operar
  // caso o gov.br esteja indisponível durante o build.
  await rm(manifestPath,{force:true});
  process.stdout.write("XSD oficial indisponível: "+String(err.message).slice(0,160)+". Emissão SBA permanecerá bloqueada.\n");
}
