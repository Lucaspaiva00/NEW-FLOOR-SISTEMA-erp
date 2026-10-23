/**
 * Campos DPS exclusivos da SBA; rascunhos podem permanecer incompletos.
 * Valores digitados são validados, mas jamais substituídos por códigos
 * fiscais presumidos. Demais chaves do JSON existente são preservadas.
 */
export const CAMPOS_DPS_SBA = {
  cTribNac:/^\d{6}$/,
  opSimpNac:/^[123]$/,
  regEspTrib:/^[01234569]$/,
  tribISSQN:/^[1234]$/,
  tpRetISSQN:/^[123]$/,
  indTotTrib:/^0$/,
  cLocPrestacao:/^\d{7}$/,
  cTribMun:/^[A-Za-z0-9.-]{1,20}$/,
  cNBS:/^[0-9.]{7,16}$/,
} as const;
export const ROTULOS_DPS_SBA: Record<keyof typeof CAMPOS_DPS_SBA,string> = {
  cTribNac:"Código de tributação nacional (cTribNac)",
  opSimpNac:"Opção pelo Simples (opSimpNac)",
  regEspTrib:"Regime especial municipal (regEspTrib)",
  tribISSQN:"Tributação ISSQN (tribISSQN)",
  tpRetISSQN:"Retenção ISSQN (tpRetISSQN)",
  indTotTrib:"Indicador de tributos totais (indTotTrib)",
  cLocPrestacao:"Município de prestação IBGE (cLocPrestacao)",
  cTribMun:"Tributação municipal (cTribMun)",
  cNBS:"Classificação NBS (cNBS)",
};
export function validarParametrosRascunhoSba(extra:unknown):Record<string,unknown>|null {
  if(extra===null || extra===undefined)return null;
  if(typeof extra!=="object"||Array.isArray(extra))
    throw Object.assign(new Error("Os parâmetros da DPS devem formar um objeto JSON."),{statusCode:400});
  const dados={...(extra as Record<string,unknown>)};
  if(JSON.stringify(dados).length>10000)
    throw Object.assign(new Error("Parâmetros da DPS excedem o tamanho permitido."),{statusCode:400});
  for(const key of Object.keys(CAMPOS_DPS_SBA) as Array<keyof typeof CAMPOS_DPS_SBA>){
    const valor=dados[key];
    if(valor===null||valor===undefined||valor===""){delete dados[key];continue;}
    if(typeof valor!=="string" && typeof valor!=="number")
      throw Object.assign(new Error(ROTULOS_DPS_SBA[key]+": valor inválido."),{statusCode:400});
    const texto=String(valor).trim();
    if(!CAMPOS_DPS_SBA[key].test(texto))
      throw Object.assign(new Error(ROTULOS_DPS_SBA[key]+": código fora do formato aceito. Revise com a contabilidade."),{statusCode:400});
    dados[key]=texto;
  }
  if(["2","3","4"].includes(String(dados.tribISSQN)) &&
    ["2","3"].includes(String(dados.tpRetISSQN)))
    throw Object.assign(new Error("Serviço imune, exportação ou não incidência não pode ter retenção ISSQN. Confirme com a contabilidade."),{statusCode:400});
  if(dados.opSimpNac==="2" && dados.regEspTrib && dados.regEspTrib!=="0")
    throw Object.assign(new Error("MEI não pode ter regime especial informado nesta DPS."),{statusCode:400});
  return dados;
}

/** Mesclagem pura: padrões da empresa < serviço < valores da nota.
 * Sem converter "0" em vazio e sem descartar informações adicionais antigas.
 */
export function mesclarPadroesDpsSba(empresa:unknown,servico:unknown,nota:unknown){
  const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
  return validarParametrosRascunhoSba({...obj(empresa),...obj(servico),...obj(nota)});
}
