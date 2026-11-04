import {validarParametrosRascunhoSba} from "./parametrosDpsSba.service";
import { verificarCamposDpsSba } from "./dpsNacionalSba.service";

/**
 * Preparação da DPS Nacional apenas para homologação da SBA.
 * Leiaute-alvo: 1.01 (produção restrita 20/10/2026).
 * NÃO é possível declarar conformidade XSD sem validar contra os arquivos
 * oficiais publicados nessa data (inclusive o grupo IBSCBS).
 */
const digits=(v:unknown)=>String(v??"").replace(/\D/g,"");
const xmlText=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"
})[c]!).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"");
const tag=(name:string,value:unknown)=>"<"+name+">"+xmlText(value)+"</"+name+">";
const opt=(name:string,value:unknown)=>value===null||value===undefined||String(value).trim()===""?"":tag(name,value);
const fmtValor=(value:unknown)=>{
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0||n>999999999999.99)throw Error("Valor dos serviços inválido.");
  return n.toFixed(2);
};
const dataCompetencia=(value:unknown):string=>{
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString().slice(0,10);
  const text=String(value||"").slice(0,10);
  if(/^\d{4}-\d{2}-\d{2}$/.test(text)&&!Number.isNaN(Date.parse(text)))return text;
  return new Date().toISOString().slice(0,10);
};
export interface DpsSbaPrevia {
  xml:string;
  id:string;
  pendencias:string[];
  avisos:string[];
  conformidadeXsdValidada:false;
  somenteHomologacao:true;
}
export function montarDpsPreviaSba(nota:any,agora=new Date()):DpsSbaPrevia{
  const check=verificarCamposDpsSba(nota);
  const pendencias=[...check.pendencias];
  const fiscal=nota?.empresaFiscal||{};
  const extra=nota?.payloadExtra&&typeof nota.payloadExtra==="object"&&!Array.isArray(nota.payloadExtra)?nota.payloadExtra:{};
  const cnpj=digits(fiscal.cnpj);
  const municipio=digits(fiscal.codigoMunicipioIbge);
  const serie=digits(fiscal.serieNfse);
  const numero=Number(nota?.notafiscalid);
  const cTribNac=digits(extra.cTribNac??extra.codigoTributacaoNacional);
  const opSimpNac=String(extra.opSimpNac??"").trim();
  const regAp=Number(fiscal.regimeApuracaoSimples);
  const regEsp=String(extra.regEspTrib??"").trim();
  const tribIss=String(extra.tribISSQN??"").trim();
  const tipoRet=String(extra.tpRetISSQN??"").trim();
  const totalTrib=String(extra.indTotTrib??"").trim();
  if(!/^\d{1,5}$/.test(serie))pendencias.push("Informe série DPS numérica (1 a 5 dígitos) em Padrões NFS-e da SBA.");
  if(!Number.isSafeInteger(numero)||numero<=0||numero>999999999999999)pendencias.push("Número interno da nota inválido para numeração provisória da DPS.");
  if(!/^\d{7}$/.test(String(extra.cLocPrestacao||"")))pendencias.push("Informe o município real da prestação (IBGE, 7 dígitos) nesta nota.");
  if(!/^\d{6}$/.test(cTribNac))pendencias.push("Informe cTribNac (6 dígitos) conforme classificação oficial do serviço.");
  if(!/^[123]$/.test(opSimpNac))pendencias.push("Confirme a opção Simples Nacional (opSimpNac: 1, 2 ou 3) com os dados fiscais da SBA.");
  if(!/^[0-9]$/.test(regEsp))pendencias.push("Confirme o regime especial tributário (regEspTrib) da operação com o contador.");
  if(!/^[0-9]$/.test(tribIss))pendencias.push("Confirme tribISSQN (tributação municipal) para a operação.");
  if(!/^[0-9]$/.test(tipoRet))pendencias.push("Confirme tpRetISSQN (retenção do ISSQN) da operação.");
  if(!/^(0|PERCENTUAL)$/.test(totalTrib))pendencias.push("Confirme o modo de informação dos tributos totais.");
  try{validarParametrosRascunhoSba(extra);}catch(err:any){pendencias.push(err.message);}
  if(totalTrib==="PERCENTUAL"){
    for(const key of ["pTotTribFed","pTotTribEst","pTotTribMun"]){
      const v=extra[key];
      if(v==null||String(v).trim()===""||!Number.isFinite(Number(String(v).replace(",",".")))||Number(String(v).replace(",","."))<0||Number(String(v).replace(",","."))>100)
        pendencias.push("Informe "+key+" (percentual aproximado entre 0 e 100).");
    }
  }
  const temIbsCbs=["ibsCbsCst","ibsCbsClassTrib","ibsCbsIndOp","ibsCbsIndDest"].some(k=>extra[k]!=null&&extra[k]!=="");
  if(temIbsCbs){
    for(const [key,re] of [["ibsCbsCst",/^\d{3}$/],["ibsCbsClassTrib",/^\d{6}$/],["ibsCbsIndOp",/^\d{6}$/],["ibsCbsIndDest",/^[01]$/]] as const){
      if(!re.test(String(extra[key]??"")))pendencias.push("Confirme "+key+" para os dados IBS/CBS desta nota.");
    }
    if(extra.ibsCbsIndDest==="1")pendencias.push("Destinatário diferente do tomador exige cadastro específico; esta integração ainda não monta esse grupo.");
  }
  if(fiscal.optanteSimplesNacional&&![1,2,3].includes(regAp))
    pendencias.push("Confirme regime de apuração do Simples (1, 2 ou 3) para a SBA.");
  if(digits(nota?.destinatarioCep).length!==8)
    pendencias.push("Informe CEP do tomador com oito dígitos.");
  for(const field of ["destinatarioEndereco","destinatarioNumero","destinatarioBairro"]){
    if(!String(nota?.[field]||"").trim())pendencias.push("Informe "+field+" para o endereço do tomador.");
  }
  // O identificador oficial: DPS+município(7)+tipo inscrição(1)
  // +inscrição federal(14)+série(5)+número(15). Tipo 2 = CNPJ.
  const id="DPS"+municipio+"2"+cnpj+serie.padStart(5,"0")+String(numero).padStart(15,"0");
  if(pendencias.length)return {
    xml:"",id:"",pendencias:[...new Set(pendencias)],avisos:check.avisos,
    conformidadeXsdValidada:false,somenteHomologacao:true,
  };
  const descricao=(nota.itens||[]).map((i:any)=>String(i.descricao||"").trim()).filter(Boolean).join("; ");
  if(descricao.length>2000)throw Error("Descrição agregada dos serviços excede 2000 caracteres.");
  const documento=digits(nota.destinatarioCnpj||nota.destinatarioCpf);
  const tipoDocumento=documento.length===14?"CNPJ":"CPF";
  const prest=
    tag("CNPJ",cnpj)+opt("IM",fiscal.inscricaoMunicipal)+
    "<regTrib>"+tag("opSimpNac",opSimpNac)+
    (fiscal.optanteSimplesNacional?tag("regApTribSN",regAp):"")+
    tag("regEspTrib",regEsp)+"</regTrib>";
  const toma=tag(tipoDocumento,documento)+tag("xNome",nota.destinatarioNome)+
    "<end><endNac>"+tag("cMun",digits(nota.destinatarioCodigoMunicipio))+
    tag("CEP",digits(nota.destinatarioCep))+"</endNac>"+
    tag("xLgr",nota.destinatarioEndereco)+tag("nro",nota.destinatarioNumero)+
    opt("xCpl",nota.destinatarioComplemento)+tag("xBairro",nota.destinatarioBairro)+"</end>"+
    opt("email",nota.destinatarioEmail);
  const serv="<locPrest>"+tag("cLocPrestacao",digits(extra.cLocPrestacao))+"</locPrest>"+
    "<cServ>"+tag("cTribNac",cTribNac)+opt("cTribMun",extra.cTribMun)+
    tag("xDescServ",descricao)+opt("cNBS",extra.cNBS)+"</cServ>"+
    (nota.codigoObra?"<obra>"+tag("cObra",nota.codigoObra)+"</obra>":"");
  const totalTribXml=totalTrib==="PERCENTUAL"
    ?"<pTotTrib>"+["pTotTribFed","pTotTribEst","pTotTribMun"].map(k=>tag(k,Number(String(extra[k]).replace(",",".")).toFixed(2))).join("")+"</pTotTrib>"
    :tag("indTotTrib","0");
  const ibsCbs=temIbsCbs?"<IBSCBS>"+tag("cIndOp",extra.ibsCbsIndOp)+tag("indDest",extra.ibsCbsIndDest)+
    "<valores><trib>"+tag("CST",extra.ibsCbsCst)+tag("cClassTrib",extra.ibsCbsClassTrib)+"</trib></valores></IBSCBS>":"";
  const valores="<vServPrest>"+tag("vServ",fmtValor(nota.valorServicos))+"</vServPrest>"+
    "<trib><tribMun>"+tag("tribISSQN",tribIss)+tag("tpRetISSQN",tipoRet)+"</tribMun>"+
    "<totTrib>"+totalTribXml+"</totTrib></trib>";
  const hora=agora.toISOString().replace(/\.\d{3}Z$/,"+00:00");
  const xml='<?xml version="1.0" encoding="UTF-8"?>'+
    '<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">'+
    '<infDPS Id="'+id+'">'+
    tag("tpAmb","2")+tag("dhEmi",hora)+tag("verAplic","PAIVA_TECH_1.0")+
    tag("serie",String(Number(serie)))+tag("nDPS",String(numero))+
    tag("dCompet",dataCompetencia(nota.dataEmissao))+
    tag("tpEmit","1")+tag("finNFSe","0")+tag("cLocEmi",municipio)+
    "<prest>"+prest+"</prest><toma>"+toma+"</toma><serv>"+serv+
    "</serv><valores>"+valores+"</valores>"+ibsCbs+
    "</infDPS></DPS>";
  return {
    xml,id,pendencias:[],
    avisos:[...check.avisos,
      "Prévia com campos principais. Grupos e regras IBS/CBS vigentes em 20/10/2026 ainda aguardam validação XSD.",
      "O nDPS é provisoriamente derivado do ID interno da nota; não é numeração homologada de produção."],
    conformidadeXsdValidada:false,somenteHomologacao:true,
  };
}
