import {DOMParser} from '@xmldom/xmldom';
import {gzipSync,gunzipSync} from 'node:zlib';
const NS='http://www.sped.fazenda.gov.br/nfse';
const falha=(s:string)=>Object.assign(Error(s),{statusCode:422});
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function validarMotivoCancelamentoSba(codigo:unknown,motivo:unknown){
 const c=String(codigo??''),x=typeof motivo==='string'?motivo.replace(/\s+/g,' ').trim():'';
 if(!['1','2','9'].includes(c))throw falha('Selecione o motivo do cancelamento.');
 if(x.length<15||x.length>255||/[\u0000-\u001f\u007f]/.test(x))throw falha('Informe uma justificativa entre 15 e 255 caracteres, sem caracteres de controle.');
 return {codigo:c,motivo:x};
}
export function montarCancelamentoSba(nota:any,codigo:unknown,motivo:unknown,agora=new Date()){
 const m=validarMotivoCancelamentoSba(codigo,motivo);
 const chave=String(nota.chave||''),cnpj=String(nota.empresaFiscal?.cnpj||'').replace(/\D/g,'');
 if(nota.empresaId!==2||nota.empresa?.slug!=='sba'||nota.tipo!=='NFSE'||nota.status!=='AUTORIZADA'||(nota.ambienteEmissao||nota.empresaFiscal?.ambiente)!=='PRODUCAO'||!/^\d{50}$/.test(chave)||!/^\d{14}$/.test(cnpj))throw falha('Selecione uma NFS-e da SBA autorizada em produção.');
 const id='PRE'+chave+'101101';
 const hora=new Date(agora.getTime()-10800000).toISOString().replace(/\.\d{3}Z$/,'-03:00');
 const xml='<?xml version="1.0" encoding="UTF-8"?>'+`<pedRegEvento xmlns="${NS}" versao="1.01"><infPedReg Id="${id}"><tpAmb>1</tpAmb><verAplic>PAIVA_TECH_1.0</verAplic><dhEvento>${hora}</dhEvento><CNPJAutor>${cnpj}</CNPJAutor><chNFSe>${chave}</chNFSe><e101101><xDesc>Cancelamento de NFS-e</xDesc><cMotivo>${m.codigo}</cMotivo><xMotivo>${escape(m.motivo)}</xMotivo></e101101></infPedReg></pedRegEvento>`;
 return {id,xml,...m};
}
export function compactarCancelamentoSba(xml:string){
 if(xml.length>300000||!xml.includes('<Signature')&&!xml.includes(':Signature'))throw falha('Evento deve estar assinado antes do envio.');
 return {pedidoRegistroEventoXmlGZipB64:gzipSync(Buffer.from(xml,'utf8')).toString('base64')};
}
export function lerCancelamentoSba(result:{httpStatus:number,data:any},chave:string,cnpj:string){
 const data=result.data||{};
 if(result.httpStatus>=200&&result.httpStatus<300&&typeof data.eventoXmlGZipB64==='string'){
  if(data.eventoXmlGZipB64.length>3000000)throw falha('Evento retornado excede o limite.');
  const xml=gunzipSync(Buffer.from(data.eventoXmlGZipB64,'base64'),{maxOutputLength:4000000}).toString('utf8');
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw falha('Evento retornado inválido.');
  const d=new DOMParser({onError:()=>{throw falha('Evento retornado malformado.');}}).parseFromString(xml,'application/xml');
  const all=(tag:string)=>d.getElementsByTagNameNS(NS,tag);
  const value=(tag:string)=>all(tag)[0]?.textContent?.trim();
  const inf=all('infEvento'),ped=all('infPedReg');
  if(d.documentElement?.localName!=='evento'||d.documentElement.namespaceURI!==NS||inf.length!==1||ped.length!==1||inf[0].getAttribute('Id')!=='EVT'+chave+'101101001'||ped[0].getAttribute('Id')!=='PRE'+chave+'101101'||all('chNFSe').length!==1||value('chNFSe')!==chave||value('tpAmb')!=='1'||value('CNPJAutor')!==cnpj.replace(/\D/g,'')||all('e101101').length!==1||!/^0{0,2}1$/.test(value('nSeqEvento')||'')||value('xDesc')!=='Cancelamento de NFS-e'||!value('dhProc')||!d.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#','Signature').length)throw falha('Evento de cancelamento não corresponde à nota, autor ou ambiente.');
  return {estado:'CONFIRMADO' as const,xml,data:value('dhProc')!,mensagem:'Cancelamento confirmado pelo Portal Nacional.'};
 }
 const erros=Array.isArray(data.erros)?data.erros:Array.isArray(data.erro)?data.erro:data.erro?[data.erro]:[];
 if(result.httpStatus>=400&&result.httpStatus<500&&erros.length)return {estado:'REJEITADO' as const,mensagem:erros.map((e:any)=>[e.Codigo||e.codigo,e.Descricao||e.descricao].filter(Boolean).join(' — ')).join('; ').slice(0,1800)||'Cancelamento rejeitado. A nota permanece autorizada.'};
 return {estado:'PENDENTE' as const,mensagem:'Cancelamento ainda não confirmado. Consulte o cancelamento antes de reenviar.'};
}
