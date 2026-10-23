import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { XmlDocument, XsdValidator } from "libxml2-wasm";
import { xmlRegisterFsInputProviders } from "libxml2-wasm/lib/nodejs.mjs";

xmlRegisterFsInputProviders();
const base=resolve(process.cwd(),"nfse-xsds");
function safePath(version,relative){
  if(version!=="PRODREST-v1.01-20261020" || typeof relative!=="string" ||
    !/^[\w. /()\-]+$/.test(relative) || relative.split("/").includes(".."))
    throw Error("Pacote de XSD não reconhecido");
  const file=resolve(base,"20261020",relative);
  if(!file.startsWith(resolve(base,"20261020")+sep))throw Error("Esquema fora da pasta");
  return file;
}
async function check(xml,onlySchema=false){
  if(!onlySchema&&(typeof xml!=="string"||xml.length>1024*1024||/<!DOCTYPE|<!ENTITY/i.test(xml))){
    return {valido:false,erro:"XML excede limite ou contém declaração proibida"};
  }
  let schema,validator,document;
  try{
    const manifest=JSON.parse(readFileSync(resolve(base,"manifest.json"),"utf8"));
    const file=safePath(manifest.versao,manifest.raiz);
    // Importações e includes resolvidos somente a partir dos XSD oficiais
    // previamente obtidos em build. Não busca URLs do XML do usuário.
    schema=XmlDocument.fromBuffer(readFileSync(file),{url:pathToFileURL(file).href});
    validator=XsdValidator.fromDoc(schema);
    if(onlySchema)return {valido:true,schemaCompilado:true,versao:manifest.versao,sha256:manifest.zipSha256};
    document=XmlDocument.fromString(xml);
    validator.validate(document);
    return {valido:true,versao:manifest.versao,sha256:manifest.zipSha256};
  }catch(e){
    return {valido:false,erro:String(e?.message||e).slice(0,700)};
  }finally{
    document?.dispose();validator?.dispose();schema?.dispose();
  }
}
let input="";
process.stdin.setEncoding("utf8");
for await(const chunk of process.stdin){
  input+=chunk;
  if(input.length>1024*1024){input="";break;}
}
const result=await check(input,process.argv.includes("--schema-check"));
process.stdout.write(JSON.stringify(result));
