import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {montarDpsPreviaSba} from './dpsXmlSba.service';
import {validarTesteProducaoSba,validarDestinoSba} from './sefinTransmissaoSba.service';
/** Adaptação explícita ao XSD de produção 1.01/20260209. */
export function montarDpsProducaoSba(nota:any,agora=new Date()){
 validarOperacaoProducaoSba(nota);
 const previa=montarDpsPreviaSba(nota,agora);
 if(!previa.xml)return {...previa,somenteHomologacao:false};
 const NS='http://www.sped.fazenda.gov.br/nfse';
 const doc=new DOMParser().parseFromString(previa.xml,'application/xml');
 const inf=doc.getElementsByTagNameNS(NS,'infDPS')[0];
 doc.getElementsByTagNameNS(NS,'tpAmb')[0].textContent='1';
 const fin=doc.getElementsByTagNameNS(NS,'finNFSe')[0];if(fin)inf.removeChild(fin);
 const serv=doc.getElementsByTagNameNS(NS,'cServ')[0];
 const nbs=doc.getElementsByTagNameNS(NS,'cNBS')[0];
 if(nbs){serv.removeChild(nbs);serv.appendChild(nbs);}
 const ibs=doc.getElementsByTagNameNS(NS,'IBSCBS')[0];
 if(ibs){const trib=ibs.getElementsByTagNameNS(NS,'trib')[0];const grupo=doc.createElementNS(NS,'gIBSCBS');while(trib.firstChild)grupo.appendChild(trib.firstChild);trib.appendChild(grupo);const finProd=doc.createElementNS(NS,'finNFSe');finProd.textContent='0';ibs.insertBefore(finProd,ibs.firstChild);}
 return {...previa,xml:new XMLSerializer().serializeToString(doc),somenteHomologacao:false};
}

/** Regras operacionais antes de assinar/transmitir; não se aplicam a downloads históricos. */
export function validarOperacaoProducaoSba(nota:any){
 validarDestinoSba(nota,true);
 const falhar=(s:string)=>{throw Object.assign(Error(s),{statusCode:422});};
 if((nota.ambienteEmissao||nota.empresaFiscal.ambiente)!=='PRODUCAO')falhar('Selecione produção na emissora SBA.');
 if(nota.payloadExtra?.testeHomologacao)falhar('Documento marcado para homologação não pode ser emitido em produção.');
 if(nota.payloadExtra?.sbaTesteProducao===true){validarTesteProducaoSba(nota);return;}
 const p=nota.proposta;
 if(!nota.propostaId||!p||p.propostaid!==nota.propostaId||p.empresaId!==nota.empresaId)falhar('Vincule uma proposta da SBA à nota antes de emitir em produção.');
 if(!nota.clienteId||p.clienteId!==nota.clienteId)falhar('O cliente da nota deve corresponder ao cliente da proposta.');
 if(['RECUSADA','CANCELADA'].includes(p.status)||p.planoRecebimento?.origemFaturamento==='EXTERNO')falhar('A proposta está recusada, cancelada ou faturada por nota externa.');
 const cents=(v:any)=>{const n=Number(v??0);if(!Number.isFinite(n)||n<0)falhar('Valor inválido na composição da nota.');return Math.round(n*100);};
 const total=cents(nota.valorTotal),servicos=cents(nota.valorServicos);
 if(total<=0||total!==servicos||total!==cents(Number(p.subtotal)+Number(p.frete||0)))falhar('O valor dos serviços e o total da nota devem corresponder ao total da proposta.');
 if(['valorProdutos','valorFrete','valorSeguro','valorOutrasDespesas','valorDesconto'].some(k=>cents(nota[k])!==0))falhar('A NFS-e direta deve conter somente serviços. Frete, despesas e descontos globais exigem composição fiscal específica.');
 // O mapeamento atual não envia valores de retenções federais; nunca descartá-los silenciosamente.
 if(Number(nota.aliquotaIss||0)>0)falhar('Alíquota específica de ISS exige composição fiscal própria; confira a apuração antes de transmitir.');
 if(cents(nota.valorRetencoes)!==0||nota.issRetido||['2','3'].includes(String(nota.payloadExtra?.tpRetISSQN)))falhar('Operação com retenções exige composição fiscal específica antes de transmitir.');
 if(!nota.itens?.length)falhar('Adicione os serviços da nota.');
 let soma=0;
 for(const i of nota.itens){
  const qtd=Number(i.quantidade),unit=Number(i.valorUnitario),bruto=cents(i.valorBruto),desconto=cents(i.valorDesconto);
  if(!String(i.descricao||'').trim()||!Number.isFinite(qtd)||qtd<=0||!Number.isFinite(unit)||unit<0||Math.round(qtd*unit*100)!==bruto||desconto>bruto)falhar('Confira descrição, quantidade, valor unitário e desconto de cada serviço.');
  soma+=bruto-desconto;
 }
 if(soma!==servicos)falhar('A soma dos serviços e descontos dos itens não corresponde ao valor da nota.');
 if(nota.destinatarioCnpj&&nota.destinatarioCpf)falhar('Informe apenas CPF ou CNPJ do tomador.');
}
