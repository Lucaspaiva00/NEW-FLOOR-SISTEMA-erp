import {buildFocusPayload} from './focusNfe.service';
export function conferirNotaFiscal(nota:any){
 const erros:string[]=[],avisos:string[]=[],empresa=nota.empresaFiscal||{};
 const digits=(v:any)=>String(v??'').replace(/\D/g,'');
 const exigir=(ok:any,texto:string)=>{if(!ok)erros.push(texto);};
 exigir(empresa.ativo!==false,'A empresa emissora está inativa.');
 exigir(digits(empresa.cnpj).length===14,'Empresa emissora: informe CNPJ com 14 dígitos.');
 exigir(empresa.ambiente==='PRODUCAO'?empresa.tokenProducao:empresa.tokenHomologacao,'Configure o token Focus do ambiente selecionado na empresa emissora.');
 exigir([1,2,3,4].includes(Number(empresa.regimeTributario)),'Empresa emissora: selecione um regime tributário válido.');
 exigir(digits(empresa.codigoMunicipioIbge).length===7,'Empresa emissora: informe o código IBGE do município (7 dígitos).');
 exigir(!(nota.destinatarioCnpj&&nota.destinatarioCpf),'Destinatário: informe CNPJ ou CPF, sem preencher os dois.');
 exigir(digits(nota.destinatarioCnpj).length===14||digits(nota.destinatarioCpf).length===11,'Destinatário: informe CNPJ ou CPF válido.');
 exigir(nota.itens?.length>0,'Adicione ao menos um item à nota.');
 const total=Number(nota.valorTotal);exigir(Number.isFinite(total)&&total>0,'Informe um valor total positivo.');
 const soma=(nota.itens||[]).reduce((s:number,i:any)=>s+Number(i.valorBruto)-Number(i.valorDesconto||0),0);
 const base=Number(nota.tipo==='NFE'?nota.valorProdutos:nota.valorServicos);
 exigir(Number.isFinite(soma)&&Math.abs(soma-base)<.011,'O valor de produtos/serviços deve conferir com a soma dos itens e seus descontos.');
 const calculado=base+Number(nota.valorFrete||0)+Number(nota.valorSeguro||0)+Number(nota.valorOutrasDespesas||0)-Number(nota.valorDesconto||0);
 exigir(Math.abs(calculado-total)<.011,'O total não confere com itens, descontos e despesas.');
 const payload=buildFocusPayload(nota);
 for(const [index,item]of (nota.itens||[]).entries()){
  const label=`Item ${index+1}: `;
  exigir(String(item.descricao||'').trim(),label+'preencha a descrição.');
  exigir(Number(item.quantidade)>0&&Number.isFinite(Number(item.quantidade)),label+'quantidade deve ser positiva.');
  exigir(Number(item.valorUnitario)>=0&&Number.isFinite(Number(item.valorUnitario)),label+'valor unitário inválido.');
  exigir(Number(item.valorBruto)>0&&Number(item.valorDesconto||0)>=0&&Number(item.valorDesconto||0)<=Number(item.valorBruto),label+'valor bruto ou desconto inválido.');
  exigir(Math.abs(Number(item.quantidade)*Number(item.valorUnitario)-Number(item.valorBruto))<.011,label+'valor bruto não confere com quantidade × valor unitário.');
  if(nota.tipo==='NFE'){
   const p=payload.items?.[index]||{};
   exigir(/^\d{8}$/.test(String(p.codigo_ncm||'')),label+'informe NCM com 8 dígitos.');
   exigir(/^\d{4}$/.test(String(p.cfop||'')),label+'informe CFOP com 4 dígitos.');
   exigir(p.icms_situacao_tributaria,label+'informe CST/CSOSN do ICMS.');
   exigir(p.pis_situacao_tributaria,label+'informe CST do PIS.');
   exigir(p.cofins_situacao_tributaria,label+'informe CST da COFINS.');
  }
 }
 if(nota.aliquotaIss!=null)exigir(Number.isFinite(Number(nota.aliquotaIss))&&Number(nota.aliquotaIss)>=0&&Number(nota.aliquotaIss)<=100,'Informe uma alíquota de ISS entre 0 e 100%.');
 if(nota.tipo==='NFE'){
  exigir(payload.natureza_operacao,'Preencha a natureza da operação.');
  exigir(digits(empresa.inscricaoEstadual),'Empresa emissora: informe a inscrição estadual.');
  for(const [campo,label]of [['endereco','logradouro'],['numero','número'],['bairro','bairro'],['estado','UF']])exigir(empresa[campo],`Empresa emissora: preencha ${label}.`);
  exigir(digits(nota.destinatarioCodigoMunicipio).length===7,'Destinatário: informe o código IBGE do município.');
 }else if(empresa.padraoNfse==='NACIONAL'){
  exigir(/^\d{6}$/.test(String(payload.codigo_tributacao_nacional_iss||'')),'Informe o código de tributação nacional do ISS com 6 dígitos; CNAE é um campo diferente.');
  exigir([1,2,3].includes(Number(payload.tipo_retencao_iss)),'Informe um tipo válido de retenção do ISS.');
  if(empresa.regimeApuracaoSimples!=null)exigir([1,2,3].includes(Number(empresa.regimeApuracaoSimples)),'Informe uma apuração válida do Simples Nacional.');
 }else exigir(payload.servico?.item_lista_servico,'Informe o item da lista de serviços.');
 if(empresa.ambiente!=='PRODUCAO')avisos.push('Homologação: documento de teste, sem faturamento ou parcelas financeiras.');
 avisos.push('Confira os códigos, alíquotas e retenções com a contabilidade. Esta conferência não substitui a autorização do fisco.');
 return {podeEmitir:erros.length===0,erros,avisos,ambiente:empresa.ambiente,tipo:nota.tipo};
}
