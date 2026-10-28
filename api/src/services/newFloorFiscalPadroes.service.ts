import prisma from "../prisma";
const chave = (id:number) => `nfse_newfloor_emissora_${id}`;
const obj = (v:any):v is Record<string,any> => !!v && typeof v === "object" && !Array.isArray(v);
const erro=(texto:string,statusCode=400)=>Object.assign(new Error(texto),{statusCode});
export function validarPadroesNewFloor(input:any) {
 if(!obj(input))throw erro("Informe os padrões fiscais da emissora.");
 const saida:Record<string,any>={};
 for(const k of ["codigo_nbs","codigo_municipio_prestacao","ibs_cbs_situacao_tributaria","ibs_cbs_classificacao_tributaria","situacao_tributaria_pis_cofins"]){
  if(input[k]==null||input[k]==="")continue;
  const v=String(input[k]).replace(/[.\s-]/g,"");
  const tamanho=({codigo_nbs:9,codigo_municipio_prestacao:7,ibs_cbs_situacao_tributaria:3,ibs_cbs_classificacao_tributaria:6,situacao_tributaria_pis_cofins:2} as Record<string,number>)[k];
  if(!new RegExp(`^\\d{${tamanho}}$`).test(v))throw erro(`Revise ${k}: são necessários ${tamanho} dígitos.`);
  saida[k]=v;
 }
 for(const k of ["percentual_total_tributos_federais","percentual_total_tributos_estaduais","percentual_total_tributos_municipais"]){
  if(input[k]==null||input[k]==="")continue;
  const v=Number(input[k]);if(!Number.isFinite(v)||v<0||v>100)throw erro("Os percentuais aproximados de tributos devem estar entre 0 e 100.");
  saida[k]=v;
 }
 if(Boolean(saida.ibs_cbs_situacao_tributaria)!==Boolean(saida.ibs_cbs_classificacao_tributaria))throw erro("Informe CST e classificação IBS/CBS juntos, ou mantenha ambos vazios quando dispensados.");
 return saida;
}
async function contexto(empresaId:number,emissoraId:number){
 if(empresaId!==1||!Number.isSafeInteger(emissoraId)||emissoraId<=0)throw erro("Padrões exclusivos da New Floor.",403);
 const [tenant,emissora]=await Promise.all([
  prisma.empresa.findFirst({where:{empresaid:empresaId,slug:"new-floor"},select:{configuracaoSistema:true}}),
  prisma.empresaFiscal.findFirst({where:{empresafiscalid:emissoraId,empresaId},select:{empresafiscalid:true}})
 ]);
 if(!tenant||!emissora)throw erro("Emissora da New Floor não encontrada.",404);
 return (obj(tenant.configuracaoSistema)?tenant.configuracaoSistema:{}) as Record<string,any>;
}
export async function carregarPadroesNewFloor(empresaId:number,emissoraId:number){
 const cfg=await contexto(empresaId,emissoraId);
 return validarPadroesNewFloor(obj(cfg[chave(emissoraId)])?cfg[chave(emissoraId)]:{});
}
export async function salvarPadroesNewFloor(empresaId:number,emissoraId:number,input:any){
 await contexto(empresaId,emissoraId);const padroes=validarPadroesNewFloor(input);
 await prisma.$executeRawUnsafe('UPDATE "Empresa" SET "configuracaoSistema"=jsonb_set(COALESCE("configuracaoSistema",\'{}\'::jsonb),ARRAY[$1]::text[],$2::jsonb,true) WHERE empresaid=$3 AND slug=\'new-floor\'',chave(emissoraId),JSON.stringify(padroes),empresaId);
 return padroes;
}
export function combinarPadroesNewFloor(padroes:any,extra:any){
 return {...padroes,...(obj(extra)?extra:{})};
}
export async function notaComPadroesNewFloor(nota:any){
 if(nota?.empresaId!==1||nota.tipo!=="NFSE"||(nota.padraoNfseEmissao||nota.empresaFiscal?.padraoNfse)!=="NACIONAL")return nota;
 const padroes=await carregarPadroesNewFloor(nota.empresaId,nota.empresaFiscalId);
 return {...nota,payloadExtra:combinarPadroesNewFloor(padroes,nota.payloadExtra)};
}
