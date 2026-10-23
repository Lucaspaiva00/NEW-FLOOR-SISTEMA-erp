import { gzipSync, gunzipSync } from "node:zlib";

/** Homologação SEFIN, conforme página oficial de APIs de 20/08/2026. */
export const SEFIN_RESTRITA_DOCS = "https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/docs/index";
export const SEFIN_PRODUCAO_DOCS = "https://sefin.nfse.gov.br/SefinNacional/docs/index";

/**
 * A checagem é deliberadamente conservadora. Confere campos do ERP, não
 * declara que uma DPS está válida em XSD ou apta a ser enviada.
 * Layout nacional 1.01 atualizado em 20/10/2026 na produção restrita.
 */
export function verificarCamposDpsSba(nota:any): { pendencias:string[]; avisos:string[] } {
  const pendencias:string[]=[];
  const avisos:string[]=[];
  const digitos=(v:unknown)=>String(v??"").replace(/\D/g,"");
  const colocar=(teste:boolean,problema:string)=>{if(!teste)pendencias.push(problema);};
  if(!nota || nota.tipo!=="NFSE") return {pendencias:["Selecione uma nota de serviço (NFS-e)."],avisos};
  const fiscal=nota.empresaFiscal||{};
  colocar(!!fiscal.ativo,"A empresa emissora precisa estar ativa.");
  colocar(digitos(fiscal.cnpj).length===14,"Confira o CNPJ da SBA no cadastro fiscal.");
  colocar(!!String(fiscal.razaoSocial||"").trim(),"Informe a razão social da emissora.");
  colocar(!!String(fiscal.inscricaoMunicipal||"").trim(),"Informe a inscrição municipal da SBA.");
  colocar(/^\d{7}$/.test(digitos(fiscal.codigoMunicipioIbge)),"Confira o código IBGE do município do prestador.");
  colocar(!!fiscal.certificadoCriptografado,"Cadastre o certificado digital A1 da SBA.");
  colocar(!!String(nota.destinatarioNome||"").trim(),"Informe nome ou razão social do tomador.");
  colocar([11,14].includes(digitos(nota.destinatarioCnpj||nota.destinatarioCpf).length),
    "Informe CPF ou CNPJ válido do tomador.");
  colocar(/^\d{7}$/.test(digitos(nota.destinatarioCodigoMunicipio)),
    "Informe o código IBGE do município do tomador.");
  colocar(Number(nota.valorServicos)>0,"O valor dos serviços precisa ser maior que zero.");
  colocar(!!String(nota.itemListaServico||fiscal.itemListaServicoPadrao||"").trim(),
    "Informe o item da lista nacional de serviços e confira sua classificação.");
  const itens=Array.isArray(nota.itens)?nota.itens:[];
  colocar(itens.length>0&&itens.some((item:any)=>String(item.descricao||"").trim()),
    "A nota precisa conter um serviço descrito.");
  if(itens.some((item:any)=>String(item.descricao||"").length>2000)){
    pendencias.push("A descrição do serviço excede 2.000 caracteres. Revise o texto.");
  }
  if(["AUTORIZADA","CANCELADA","PROCESSANDO"].includes(String(nota.status))){
    pendencias.push("A nota já possui processamento fiscal; não gere outra DPS sem consultar a situação.");
  }
  if(nota.proposta?.status==="FATURADA" && nota.proposta?.planoRecebimento?.origemFaturamento==="EXTERNO"){
    pendencias.push("Proposta faturada fora do ERP: evite emitir nota duplicada.");
  }
  avisos.push("O documento ainda precisa ser montado conforme XSD nacional 1.01 e assinado em XMLDSig.");
  avisos.push("CST, classificação IBS/CBS, NBS, ISS e Simples devem seguir dados reais e o leiaute vigente.");
  avisos.push("O certificado A1 precisa pertencer ao emissor e ser aceito pela cadeia ICP-Brasil/SEFIN.");
  return {pendencias,avisos};
}

/**
 * Utilitário interno para a etapa posterior de transporte da DPS já
 * validada e assinada em XMLDSig. Não transmite e não declara XML válido.
 */
export function compactarDpsXmlAssinado(xml:string):{dpsXmlGZipB64:string}{
  if(typeof xml!=="string"||xml.length>1_000_000 ||
     !/<DPS\b[^>]*xmlns=["']http:\/\/www\.sped\.fazenda\.gov\.br\/nfse["']/.test(xml)||
     !/<infDPS\b[^>]*\bId=["'][A-Za-z0-9]+["']/.test(xml)||
     !/<(?:[A-Za-z0-9]+:)?Signature\b/.test(xml)){
    throw Error("Informe uma DPS nacional XMLDSig assinada e previamente validada no XSD.");
  }
  const data=gzipSync(Buffer.from(xml,"utf8"));
  if(data.length>1_000_000)throw Error("DPS compactada excede o tamanho permitido na preparação.");
  return {dpsXmlGZipB64:data.toString("base64")};
}
export function descompactarXmlDeTeste(b64:string){
  if(!b64||b64.length>1_400_000)throw Error("Payload inválido.");
  return gunzipSync(Buffer.from(b64,"base64"),{maxOutputLength:1_000_000}).toString("utf8");
}
