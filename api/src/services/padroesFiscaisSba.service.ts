import prisma from "../prisma";
import { validarParametrosRascunhoSba } from "./parametrosDpsSba.service";

export const CAMPOS_EMPRESA_SBA=["opSimpNac","regEspTrib","tribISSQN","tpRetISSQN","indTotTrib","cLocPrestacao"] as const;
export const CAMPOS_SERVICO_SBA=["cTribNac","cTribMun","cNBS"] as const;
type FiscalConfig=Record<string,unknown>;
const isObj=(x:unknown):x is FiscalConfig=>!!x&&typeof x==="object"&&!Array.isArray(x);
const keyEmpresa=(id:number)=>"sbaDpsEmpresa_"+id;
const keyServico=(id:number)=>"sbaDpsServico_"+id;
function onlyFields(input:unknown,campos:readonly string[],allowItem=false):FiscalConfig {
  if(!isObj(input))throw Object.assign(Error("Informe um objeto de configurações fiscais."),{statusCode:400});
  const dados:FiscalConfig={};
  for(const campo of campos) {
    const value=input[campo];
    if(value===null||value===undefined||String(value).trim()==="")continue;
    dados[campo]=String(value).trim();
  }
  if(allowItem && input.itemListaServico!=null && String(input.itemListaServico).trim()){
    const v=String(input.itemListaServico).trim();
    if(!/^[0-9.]{1,12}$/.test(v))throw Object.assign(Error("Item da lista de serviços inválido."),{statusCode:400});
    dados.itemListaServico=v;
  }
  validarParametrosRascunhoSba(dados);
  return dados;
}
async function obterTenantSba(empresaId:number){
  const emp=await prisma.empresa.findFirst({where:{empresaid:empresaId,slug:"sba",ativo:true},
    select:{empresaid:true,configuracaoSistema:true}});
  if(!emp)throw Object.assign(Error("Acesso fiscal exclusivo da SBA."),{statusCode:403});
  return {id:emp.empresaid,config:isObj(emp.configuracaoSistema)?emp.configuracaoSistema:{}};
}
export async function carregarPadroesSba(empresaId:number){
  const tenant=await obterTenantSba(empresaId);
  const [emissoras,servicos]=await Promise.all([
    prisma.empresaFiscal.findMany({where:{empresaId,ativo:true},
      select:{empresafiscalid:true,razaoSocial:true,itemListaServicoPadrao:true},
      orderBy:{empresafiscalid:"asc"}}),
    prisma.servico.findMany({where:{empresaId,ativo:true},
      select:{servicoid:true,codigo:true,nome:true,categoria:true},
      orderBy:{nome:"asc"}})
  ]);
  return {
    emissoras:emissoras.map(e=>({
      id:e.empresafiscalid,nome:e.razaoSocial,
      itemListaServicoPadrao:e.itemListaServicoPadrao||null,
      padroes:onlyFields(isObj(tenant.config[keyEmpresa(e.empresafiscalid)])?tenant.config[keyEmpresa(e.empresafiscalid)]:{},CAMPOS_EMPRESA_SBA)
    })),
    servicos:servicos.map(s=>({
      id:s.servicoid,nome:s.nome,codigo:s.codigo,categoria:s.categoria,
      padroes:onlyFields(isObj(tenant.config[keyServico(s.servicoid)])?tenant.config[keyServico(s.servicoid)]:{},CAMPOS_SERVICO_SBA,true)
    }))
  };
}
export async function salvarPadroesSba(empresaId:number,tipo:"empresa"|"servico",id:number,input:unknown){
  const tenant=await obterTenantSba(empresaId);
  if(!Number.isSafeInteger(id)||id<=0)throw Object.assign(Error("Selecione um cadastro válido."),{statusCode:400});
  if(tipo==="empresa"){
    const existe=await prisma.empresaFiscal.count({where:{empresaId,empresafiscalid:id,ativo:true}});
    if(!existe)throw Object.assign(Error("Emissora não encontrada na SBA."),{statusCode:404});
  } else {
    const existe=await prisma.servico.count({where:{empresaId,servicoid:id,ativo:true}});
    if(!existe)throw Object.assign(Error("Serviço não encontrado na SBA."),{statusCode:404});
  }
  const dados=onlyFields(input,tipo==="empresa"?CAMPOS_EMPRESA_SBA:CAMPOS_SERVICO_SBA,tipo==="servico");
  const key=tipo==="empresa"?keyEmpresa(id):keyServico(id);
  // Atualiza uma única chave JSON: preserva perfil, módulos e ajustes simultâneos.
  await prisma.$executeRawUnsafe(
    "UPDATE \"Empresa\" SET \"configuracaoSistema\"=jsonb_set(COALESCE(\"configuracaoSistema\",'{}'::jsonb), ARRAY[$1]::text[], $2::jsonb, true) WHERE empresaid=$3 AND slug='sba' AND ativo=true",
    key,JSON.stringify(dados),tenant.id
  );
  return {id,padroes:dados};
}
export async function aplicarPadroesEmNotaSba(empresaId:number,body:any):Promise<any>{
  const input={...body};
  if(input.tipo!=="NFSE")return body;
  const tenant=await obterTenantSba(empresaId);
  const emissoraId=Number(input.empresaFiscalId);
  if(!Number.isSafeInteger(emissoraId)||emissoraId<=0)return body;
  const f=await prisma.empresaFiscal.findFirst({
    where:{empresafiscalid:emissoraId,empresaId,ativo:true},
    select:{itemListaServicoPadrao:true}
  });
  if(!f)return body;
  const raw=input.payloadExtra;
  let extra:FiscalConfig={};
  if(typeof raw==="string"){
    try{const o=JSON.parse(raw);if(isObj(o))extra=o;else throw Error()}catch{
      throw Object.assign(Error("Dados avançados da nota não são um JSON válido."),{statusCode:400});
    }
  } else if(isObj(raw))extra={...raw};
  else if(raw!=null)throw Object.assign(Error("Dados avançados da nota inválidos."),{statusCode:400});
  const empresa=onlyFields(isObj(tenant.config[keyEmpresa(emissoraId)])?tenant.config[keyEmpresa(emissoraId)]:{},CAMPOS_EMPRESA_SBA);
  let servico:FiscalConfig={};
  if(extra.sbaServicoId!==undefined&&extra.sbaServicoId!==null&&extra.sbaServicoId!==""){
    const servicoId=Number(extra.sbaServicoId);
    if(!Number.isSafeInteger(servicoId)||servicoId<=0)throw Object.assign(Error("Serviço fiscal inválido."),{statusCode:400});
    const existe=await prisma.servico.count({where:{empresaId,servicoid:servicoId,ativo:true}});
    if(!existe)throw Object.assign(Error("Serviço fiscal não pertence à SBA."),{statusCode:400});
    servico=onlyFields(isObj(tenant.config[keyServico(servicoId)])?tenant.config[keyServico(servicoId)]:{},CAMPOS_SERVICO_SBA,true);
  }
  // O valor digitado na nota prevalece sobre o padrão.
  const completo={...empresa,...servico,...extra};
  input.payloadExtra=validarParametrosRascunhoSba(completo);
  if(!String(input.itemListaServico||"").trim()){
    input.itemListaServico=servico.itemListaServico || f.itemListaServicoPadrao || null;
  }
  return input;
}
