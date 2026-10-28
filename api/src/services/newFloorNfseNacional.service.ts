/**
 * Pré-validação de NFS-e Nacional, exclusiva do tenant New Floor.
 * Não transforma silenciosamente documentos nem inventa tributos.
 */
export function textoDescricaoNacional(value: unknown): string {
  return String(value ?? "")
    .replace(/<\/(?:p|div|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}
// Receita Federal / CGNFS-e: optantes do Simples seguem sem IBS/CBS até 31/12/2026.
// Não inventar enquadramento. A dispensa exige competência e regime explícitos.
export function dispensaIbsCbsSimples2026(payload:any):boolean {
 const competencia=String(payload.data_competencia||"");
 return /^2026-\d{2}-\d{2}$/.test(competencia) &&
   Number(payload.codigo_opcao_simples_nacional)===3 &&
   Number(payload.regime_tributario_simples_nacional)===1;
}
export function problemasNfseNacionalNewFloor(nota:any, payload:any): string[] {
  if (nota?.empresaId !== 1 || nota?.tipo !== "NFSE" ||
     (nota.padraoNfseEmissao || nota.empresaFiscal?.padraoNfse) !== "NACIONAL") return [];
  const errors:string[]=[];
  const cep=String(payload.cep_tomador||"").replace(/\D/g,"");
  const municipio=String(payload.codigo_municipio_tomador||"").replace(/\D/g,"");
  if (cep && cep.length !== 8) errors.push("NFS-e Nacional: confira o CEP do cliente (8 dígitos).");
  if (cep && municipio.length !== 7) errors.push("NFS-e Nacional: informe o código IBGE do município do tomador (7 dígitos) antes de enviar o CEP.");
  const descricao=textoDescricaoNacional(payload.descricao_servico);
  if (!descricao) errors.push("NFS-e Nacional: descreva o serviço prestado.");
  if (descricao.length > 2000) errors.push(
    "NFS-e Nacional: a descrição do serviço tem " + descricao.length + " caracteres; o limite é de 2.000. Revise os itens antes de emitir."
  );
  const complementares=textoDescricaoNacional(payload.informacoes_complementares);
  if(complementares.length>2000) errors.push(
    "NFS-e Nacional: as observações complementares têm " + complementares.length + " caracteres; o limite é de 2.000. Resuma as observações antes de emitir. O conteúdo original permanecerá salvo no rascunho."
  );
  // Para a Focus montar o grupo trib devem existir parâmetros fiscais
  // fornecidos pela contabilidade. Não assumir CST, alíquota nem valores.
  const camposTrib=[
    "situacao_tributaria_pis_cofins",
    "percentual_total_tributos_federais",
    "percentual_total_tributos_estaduais",
    "percentual_total_tributos_municipais",
    "valor_total_tributos_federais",
    "valor_total_tributos_estaduais",
    "valor_total_tributos_municipais",
    "indicador_total_tributacao",
    "percentual_total_tributos_simples_nacional"
  ];
  if (!camposTrib.some(key => payload[key] !== null && payload[key] !== undefined && payload[key] !== "")) {
    errors.push("NFS-e Nacional: preencha os dados tributários reais (PIS/COFINS ou totalização dos tributos) com orientação contábil na configuração avançada. O XML retornou ausência do grupo 'trib'.");
  }
  const cst=String(payload.ibs_cbs_situacao_tributaria??"").trim();
  const classe=String(payload.ibs_cbs_classificacao_tributaria??"").trim();
  if(!dispensaIbsCbsSimples2026(payload)||cst||classe){
    if(!/^\d{3}$/.test(cst))errors.push("NFS-e Nacional: informe CST IBS/CBS (3 dígitos), conforme enquadramento da operação.");
    if(!/^\d{6}$/.test(classe))errors.push("NFS-e Nacional: informe classificação tributária IBS/CBS (6 dígitos), conforme orientação contábil.");
  }
  if(payload.codigo_nbs && !/^\d{9}$/.test(String(payload.codigo_nbs))) errors.push("NFS-e Nacional: informe o NBS com 9 dígitos.");
  if(nota.empresaFiscal?.optanteSimplesNacional===true&&Number(nota.empresaFiscal?.regimeTributario)!==4
    &&![1,2,3].includes(Number(payload.regime_tributario_simples_nacional))) {
    errors.push("NFS-e Nacional: no perfil fiscal da New Floor, selecione a apuração do Simples Nacional (1, 2 ou 3) conforme a contabilidade.");
  }
  return errors;
}
