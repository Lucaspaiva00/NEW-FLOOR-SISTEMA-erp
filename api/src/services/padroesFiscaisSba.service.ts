import {randomUUID} from "node:crypto";
import prisma from "../prisma";
import {validarParametrosRascunhoSba,mesclarPadroesDpsSba} from "./parametrosDpsSba.service";

const EMPRESA_KEYS=["opSimpNac","regEspTrib","tribISSQN","tpRetISSQN","indTotTrib","cLocPrestacao"] as const;
const SERVICO_KEYS=["cTribNac","cTribMun","cNBS"] as const;
const PREFIXO_SERVICO="sbaDpsServicoFiscal_";
const isObj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x);
const nomeSeguro=(x:unknown)=>{
  const n=String(x??"").trim().replace(/\s+/g," ");
  if(n.length<3||n.length>120)throw Object.assign(Error("Informe um nome de serviço fiscal entre 3 e 120 caracteres."),{statusCode:400});
  return n;
};
const idValido=(id:unknown)=>typeof id==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const empresaKey=(id:number)=>"sbaDpsEmpresa_"+id;
const servicoKey=(id:string)=>PREFIXO_SERVICO+id;
function campos(input:unknown,allowService=false):Record<string,unknown>{
  if(!isObj(input))throw Object.assign(Error("Dados fiscais inválidos."),{statusCode:400});
  const keys=allowService?SERVICO_KEYS:EMPRESA_KEYS;
  const d:Record<string,unknown>={};
  for(const k of keys){
    const v=input[k];
    if(v!==undefined&&v!==null&&String(v).trim())d[k]=String(v).trim();
  }
  if(allowService&&input.itemListaServico!=null&&String(input.itemListaServico).trim()){
    const v=String(input.itemListaServico).trim();
    if(!/^[0-9.]{1,12}$/.test(v))throw Object.assign(Error("Item da lista de serviços inválido."),{statusCode:400});
    d.itemListaServico=v;
  }
  validarParametrosRascunhoSba(d);
  return d;
}
async function tenant(id:number){
  const e=await prisma.empresa.findFirst({where:{empresaid:id,slug:"sba",ativo:true},
    select:{empresaid:true,configuracaoSistema:true}});
  if(!e)throw Object.assign(Error("Configuração fiscal restrita à SBA."),{statusCode:403});
  return {id:e.empresaid,config:isObj(e.configuracaoSistema)?e.configuracaoSistema:{}};
}
async function gravarKey(empresaId:number,key:string,valor:unknown){
  // Atualização atômica da chave: módulos, perfil, PDFs e outros tenants intactos.
  await prisma.$executeRawUnsafe(
    "UPDATE \"Empresa\" SET \"configuracaoSistema\"=jsonb_set(COALESCE(\"configuracaoSistema\",'{}'::jsonb), ARRAY[$1]::text[], $2::jsonb, true) WHERE empresaid=$3 AND slug='sba' AND ativo=true",
    key,JSON.stringify(valor),empresaId
  );
}
function lerServico(cfg:Record<string,unknown>,id:string){
  if(!idValido(id))return null;
  const raw=cfg[servicoKey(id)];
  if(!isObj(raw)||raw.ativo===false||typeof raw.nome!=="string")return null;
  return {id,nome:raw.nome,padroes:campos(isObj(raw.padroes)?raw.padroes:{},true)};
}
export async function carregarPadroesSba(empresaId:number){
  const e=await tenant(empresaId);
  const emissoras=await prisma.empresaFiscal.findMany({where:{empresaId,ativo:true},
    select:{empresafiscalid:true,razaoSocial:true,itemListaServicoPadrao:true},
    orderBy:{empresafiscalid:"asc"}});
  const servicos=Object.keys(e.config).filter(k=>k.startsWith(PREFIXO_SERVICO))
    .map(k=>lerServico(e.config,k.slice(PREFIXO_SERVICO.length)))
    .filter((x):x is NonNullable<typeof x>=>x!==null)
    .sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
  return {
    emissoras:emissoras.map(f=>({
      id:f.empresafiscalid,nome:f.razaoSocial,itemListaServicoPadrao:f.itemListaServicoPadrao||null,
      padroes:campos(isObj(e.config[empresaKey(f.empresafiscalid)])?e.config[empresaKey(f.empresafiscalid)]:{})
    })),
    servicos
  };
}
export async function criarServicoFiscalSba(empresaId:number,input:unknown){
  const e=await tenant(empresaId);
  if(!isObj(input))throw Object.assign(Error("Informe o nome do serviço."),{statusCode:400});
  const nome=nomeSeguro(input.nome);
  if(Object.keys(e.config).filter(k=>k.startsWith(PREFIXO_SERVICO)).length>=100)
    throw Object.assign(Error("Limite de serviços fiscais atingido."),{statusCode:400});
  const id=randomUUID();
  const padroes=campos(input,true);
  await gravarKey(empresaId,servicoKey(id),{nome,padroes,ativo:true});
  return {id,nome,padroes};
}
export async function salvarPadroesSba(empresaId:number,tipo:"empresa"|"servico",id:number|string,input:unknown){
  const e=await tenant(empresaId);
  if(tipo==="empresa"){
    const numero=Number(id);
    if(!Number.isSafeInteger(numero)||numero<=0)throw Object.assign(Error("Emissora inválida."),{statusCode:400});
    const ok=await prisma.empresaFiscal.count({where:{empresafiscalid:numero,empresaId,ativo:true}});
    if(!ok)throw Object.assign(Error("Emissora fiscal não encontrada na SBA."),{statusCode:404});
    const padroes=campos(input);
    await gravarKey(empresaId,empresaKey(numero),padroes);
    return {id:numero,padroes};
  }
  const chave=String(id);
  const existente=lerServico(e.config,chave);
  if(!existente)throw Object.assign(Error("Tipo de serviço fiscal não cadastrado na SBA."),{statusCode:404});
  const nome=isObj(input)&&input.nome!=null?nomeSeguro(input.nome):existente.nome;
  const padroes=campos(input,true);
  await gravarKey(empresaId,servicoKey(chave),{nome,padroes,ativo:true});
  return {id:chave,nome,padroes};
}
export async function aplicarPadroesEmNotaSba(empresaId:number,body:any):Promise<any>{
  if(body.tipo!=="NFSE")return body;
  const e=await tenant(empresaId);
  const input={...body};
  const emissoraId=Number(input.empresaFiscalId);
  if(!Number.isSafeInteger(emissoraId)||emissoraId<=0)return body;
  const emissora=await prisma.empresaFiscal.findFirst({
    where:{empresafiscalid:emissoraId,empresaId,ativo:true},
    select:{itemListaServicoPadrao:true}
  });
  if(!emissora)return body;
  let extra:Record<string,unknown>={};
  if(typeof input.payloadExtra==="string"){
    try{const obj=JSON.parse(input.payloadExtra);if(!isObj(obj))throw Error();extra=obj;}
    catch{throw Object.assign(Error("JSON avançado da nota inválido."),{statusCode:400});}
  } else if(isObj(input.payloadExtra))extra={...input.payloadExtra};
  else if(input.payloadExtra!=null)throw Object.assign(Error("Dados fiscais da nota inválidos."),{statusCode:400});
  const padraoEmpresa=campos(isObj(e.config[empresaKey(emissoraId)])?e.config[empresaKey(emissoraId)]:{});
  let fiscalServico:Record<string,unknown>={};
  if(extra.sbaServicoId!=null && extra.sbaServicoId!==""){
    const servico=lerServico(e.config,String(extra.sbaServicoId));
    if(!servico)throw Object.assign(Error("Serviço fiscal não pertence à SBA."),{statusCode:400});
    fiscalServico=servico.padroes;
  }
  // Nota prevalece sobre serviço; serviço prevalece sobre padrões da empresa.
  input.payloadExtra=mesclarPadroesDpsSba(padraoEmpresa,fiscalServico,extra);
  if(!String(input.itemListaServico||"").trim()){
    input.itemListaServico=fiscalServico.itemListaServico||emissora.itemListaServicoPadrao||null;
  }
  return input;
}
