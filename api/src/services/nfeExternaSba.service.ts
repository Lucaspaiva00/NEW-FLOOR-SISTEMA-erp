import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {SignedXml} from 'xml-crypto';
import {createHash} from 'node:crypto';
import {sincronizarFinanceiroNota} from './fiscalFinanceiro.service';
import {validarPlanoRecebimento} from './planoRecebimento.service';
const NS='http://www.portalfiscal.inf.br/nfe',DS='http://www.w3.org/2000/09/xmldsig#';
export const dig=(v:unknown)=>String(v??'').replace(/\D/g,'');
export const erroNfe=(s:string,statusCode=400)=>Object.assign(Error(s),{statusCode});
export function lerNfeExterna(xml:string){
 if(typeof xml!=='string'||!xml.trim()||Buffer.byteLength(xml)>3*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(xml))throw erroNfe('Envie um XML de NF-e de até 3 MB, sem entidades externas.');
 let doc;try{doc=new DOMParser({onError:()=>{throw Error('XML inválido');}}).parseFromString(xml,'text/xml');}catch{throw erroNfe('XML malformado. Exporte novamente a nota autorizada.');}
 const root=doc.documentElement;
 const filhos=(e:any,n:string,ns=NS):any[]=>Array.from(e?.childNodes||[]).filter((v:any)=>v.nodeType===1&&v.localName===n&&v.namespaceURI===ns);
 const um=(e:any,n:string)=>{const a=filhos(e,n);if(a.length!==1)throw erroNfe('XML incompleto ou ambíguo: '+n+'.');return a[0];};
 const txt=(e:any,n:string)=>filhos(e,n)[0]?.textContent?.trim()||'';
 const num=(e:any,n:string)=>{const v=txt(e,n);if(!/^\d+(\.\d+)?$/.test(v)||!Number.isFinite(Number(v)))throw erroNfe('Valor inválido no XML: '+n);return Number(v);};
 if(!root||root.localName!=='nfeProc'||root.namespaceURI!==NS||root.getAttribute('versao')!=='4.00')throw erroNfe('Selecione o XML processado da NF-e 4.00 (nfeProc), com protocolo de autorização.');
 const nfe=um(root,'NFe'),inf=um(nfe,'infNFe'),ide=um(inf,'ide'),emit=um(inf,'emit'),dest=um(inf,'dest'),total=um(um(inf,'total'),'ICMSTot'),prot=um(um(root,'protNFe'),'infProt');
 if(doc.getElementsByTagNameNS(NS,'infNFe').length!==1||doc.getElementsByTagNameNS(NS,'infProt').length!==1)throw erroNfe('XML contém documentos repetidos.');
 const chave=txt(prot,'chNFe');let soma=0,peso=2;for(let i=42;i>=0;i--){soma+=Number(chave[i])*peso;peso=peso===9?2:peso+1;}const resto=soma%11,dv=resto<2?0:11-resto;
 if(!/^\d{44}$/.test(chave)||Number(chave[43])!==dv||inf.getAttribute('Id')!=='NFe'+chave)throw erroNfe('Chave de acesso inválida ou diferente do documento.');
 if(txt(ide,'mod')!=='55'||txt(ide,'tpNF')!=='1'||txt(ide,'tpAmb')!=='1'||txt(prot,'tpAmb')!=='1'||!['100','150'].includes(txt(prot,'cStat')))throw erroNfe('Importe somente NF-e de saída modelo 55 autorizada em produção.');
 if(txt(ide,'finNFe')!=='1')throw erroNfe('Devoluções, complementos e ajustes não geram faturamento por esta importação.');
 const emitente=dig(txt(emit,'CNPJ')),documento=dig(txt(dest,'CNPJ')||txt(dest,'CPF'));
 if(emitente!=='08775345000129'||chave.slice(6,20)!==emitente||chave.slice(20,22)!=='55'||Number(chave.slice(22,25))!==Number(txt(ide,'serie'))||Number(chave.slice(25,34))!==Number(txt(ide,'nNF')))throw erroNfe('A NF-e deve pertencer à SBA e seus dados devem coincidir com a chave.');
 if(![11,14].includes(documento.length)||!txt(dest,'xNome'))throw erroNfe('Destinatário incompleto no XML.');
 const assinatura=filhos(nfe,'Signature',DS);if(assinatura.length!==1)throw erroNfe('XML sem assinatura digital da NF-e.');
 try{const verificador=new SignedXml({getCertFromKeyInfo:SignedXml.getCertFromKeyInfo});verificador.loadSignature(new XMLSerializer().serializeToString(assinatura[0]));if(verificador.getReferences().length!==1||verificador.getReferences()[0]!.uri!=='#NFe'+chave||!verificador.checkSignature(xml))throw Error('Assinatura inválida');}catch{throw erroNfe('A assinatura do XML não confere. Exporte o XML original, sem editar.');}
 const dataEmissao=new Date(txt(ide,'dhEmi')),dataAutorizacao=new Date(txt(prot,'dhRecbto')),protocolo=txt(prot,'nProt');
 if(!/^\d{15}$/.test(protocolo)||!Number.isFinite(dataEmissao.getTime())||!Number.isFinite(dataAutorizacao.getTime()))throw erroNfe('Protocolo ou datas de autorização inválidos.');
 const itens=filhos(inf,'det').map(d=>{const p=um(d,'prod'),cfop=txt(p,'CFOP');if(!['5101','5102','6101','6102'].includes(cfop))throw erroNfe('Esta primeira importação fatura somente vendas CFOP 5101, 5102, 6101 ou 6102. Remessas e outras operações precisam de conferência específica.');return {codigo:txt(p,'cProd'),descricao:txt(p,'xProd'),ncm:txt(p,'NCM'),cfop,unidade:txt(p,'uCom'),quantidade:num(p,'qCom'),valorUnitario:num(p,'vUnCom'),valorBruto:num(p,'vProd'),valorDesconto:txt(p,'vDesc')?num(p,'vDesc'):0};});
 const valorTotal=num(total,'vNF');if(!itens.length||itens.length>500||valorTotal<=0||itens.some(i=>!i.descricao||!i.unidade||i.quantidade<=0))throw erroNfe('Itens ou valor total inválidos.');
 const valorRetencoes=filhos(um(inf,'total'),'retTrib').reduce((s,r)=>s+['vRetPIS','vRetCOFINS','vRetCSLL','vIRRF','vRetPrev'].reduce((t,n)=>t+(txt(r,n)?num(r,n):0),0),0);
 if(valorRetencoes)throw erroNfe('XML com retenções exige conferência financeira específica.');
 return {chave,emitente,documento,destinatarioNome:txt(dest,'xNome'),numero:txt(ide,'nNF'),serie:txt(ide,'serie'),naturezaOperacao:txt(ide,'natOp'),protocolo,dataEmissao,dataAutorizacao,valorTotal,valorProdutos:num(total,'vProd'),valorFrete:txt(total,'vFrete')?num(total,'vFrete'):0,valorDesconto:txt(total,'vDesc')?num(total,'vDesc'):0,itens,hash:createHash('sha256').update(xml).digest('hex')};
}
export async function importarNfeExterna(db:any,empresaId:number,dados:{xml:string,propostaId:number,primeiroVencimento?:string,pdf?:string}){
 if(empresaId!==2)throw erroNfe('Importação exclusiva da SBA.',403);
 const n=lerNfeExterna(dados.xml);
 await db.$queryRaw`SELECT pg_advisory_xact_lock(${empresaId}, hashtext(${n.chave}))`;
 const existente=await db.notaFiscal.findFirst({where:{empresaId,chave:n.chave}});
 if(existente){if(existente.propostaId!==dados.propostaId)throw erroNfe('Esta chave já está vinculada a outra proposta.',409);return {id:existente.notafiscalid,jaImportada:true};}
 await db.$queryRaw`SELECT propostaid FROM "Proposta" WHERE propostaid=${dados.propostaId} AND "empresaId"=${empresaId} FOR UPDATE`;
 const p=await db.proposta.findFirst({where:{propostaid:dados.propostaId,empresaId},include:{cliente:true}});
 if(!p||dig(p.cliente.cnpj||p.cliente.cpf)!==n.documento)throw erroNfe('A proposta deve pertencer ao destinatário do XML nesta empresa.');
 if(!['APROVADA','FATURADA'].includes(p.status))throw erroNfe('Aprove a proposta antes de importar a nota e faturar.');
 if(Math.round((Number(p.subtotal)+Number(p.frete||0))*100)!==Math.round(n.valorTotal*100)||p.valorLiquidoFinanceiro!=null&&Math.round(Number(p.valorLiquidoFinanceiro)*100)!==Math.round(n.valorTotal*100))throw erroNfe('O total da nota deve ser igual ao total e ao líquido da proposta. Faturamento parcial ou divergente exige conferência.');
 if(await db.notaFiscal.findFirst({where:{empresaId,propostaId:p.propostaid,status:{in:['AUTORIZADA','PROCESSANDO']}}}))throw erroNfe('Esta proposta já possui uma nota autorizada ou em processamento. Confira antes de importar outra.',409);
 const emp=await db.empresaFiscal.findMany({where:{empresaId,ativo:true}}),ef=emp.find((e:any)=>dig(e.cnpj)===n.emitente);if(!ef)throw erroNfe('Cadastre uma emissora SBA ativa com o CNPJ do XML.');
 const cobrancas=await db.lancamentoFinanceiro.findMany({where:{empresaId,propostaId:p.propostaid,origem:'PROPOSTA',status:{not:'CANCELADO'}}});
 if(cobrancas.length){if(cobrancas.reduce((s:number,l:any)=>s+Math.round(Number(l.valor)*100),0)!==Math.round(n.valorTotal*100)||cobrancas.some((l:any)=>l.clienteId!==p.clienteId))throw erroNfe('A cobrança existente diverge da nota. Confira o financeiro antes de importar.');}
 else if(await db.lancamentoFinanceiro.findFirst({where:{empresaId,propostaId:p.propostaid,origem:'PROPOSTA',status:'CANCELADO'}}))throw erroNfe('Há cobranças canceladas nesta proposta. Concilie o financeiro antes de importar.');
 else if(!p.planoRecebimento){const plano=validarPlanoRecebimento({parcelas:1,frequencia:'MENSAL',primeiroVencimento:dados.primeiroVencimento});await db.proposta.update({where:{propostaid:p.propostaid},data:{planoRecebimento:plano}});}
 if(dados.pdf&&(!/^[A-Za-z0-9+/]+={0,2}$/.test(dados.pdf)||Buffer.from(dados.pdf,'base64').length>3*1024*1024||Buffer.from(dados.pdf,'base64').subarray(0,5).toString()!=='%PDF-'))throw erroNfe('DANFE PDF inválido ou acima de 3 MB.');
 const {itens,hash,emitente,documento,...fiscais}=n;
 const nota=await db.notaFiscal.create({data:{...fiscais,empresaId,empresaFiscalId:ef.empresafiscalid,clienteId:p.clienteId,propostaId:p.propostaid,tipo:'NFE',valorRetencoes:0,status:'AUTORIZADA',ambienteEmissao:'PRODUCAO',referencia:'EXTERNA_NFE_'+n.chave,...(n.documento.length===14?{destinatarioCnpj:n.documento}:{destinatarioCpf:n.documento}),payloadExtra:{origem:'XML_EXTERNO_SBA',hash,xmlBase64:Buffer.from(dados.xml).toString('base64'),...(dados.pdf?{pdfBase64:dados.pdf}:{})},mensagemRetorno:'NF-e emitida fora do ERP. Autorização informada no XML importado; sem consulta online à SEFAZ. Cancelamento e correções no emissor de origem.',itens:{create:itens},eventos:{create:{tipo:'IMPORTACAO_XML_EXTERNO',status:'AUTORIZADA',protocolo:n.protocolo,descricao:'XML original importado e assinatura conferida localmente. Sem transmissão ou consulta à SEFAZ.'}}},include:{empresaFiscal:true}});
 // Preserva recebimentos, vencimentos e parcelas já existentes. Não cria uma segunda receita da nota.
 if(cobrancas.length){await db.proposta.update({where:{propostaid:p.propostaid},data:{status:'FATURADA',colunaKanbanId:null,dataFaturamento:p.dataFaturamento||n.dataAutorizacao}});}
 else await sincronizarFinanceiroNota(nota,db);
 return {id:nota.notafiscalid,jaImportada:false};
}
