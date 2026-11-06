import {gunzipSync} from 'node:zlib';
import {DOMParser} from '@xmldom/xmldom';
// Confirmation events preserve validity. Cancellation, rejection, blocking or unknown events require review.
const confirmacoes=new Set(['202201','203202','204203','205204']);
const NS='http://www.sped.fazenda.gov.br/nfse';
export function situacaoEventosAdn(r:{httpStatus:number,data:any},chave:string){
 const d=r.data,status=String(d?.StatusProcessamento||'').replace(/_/g,'').toUpperCase();
 if(['NENHUMDOCUMENTOLOCALIZADO','NENHUMEVENTOLOCALIZADO'].includes(status)&&[200,404].includes(r.httpStatus))return true;
 if(r.httpStatus!==200||!/^\d{50}$/.test(chave))return false;
 const lista=Array.isArray(d)?d:Array.isArray(d?.Eventos)?d.Eventos:Array.isArray(d?.eventos)?d.eventos:Array.isArray(d?.LoteDFe)?d.LoteDFe:null;
 if(!lista||lista.length>100)return false;
 return lista.every((e:any)=>{
  const tipo=String(e?.TipoEvento||e?.tipoEvento||''),identidade=String(e?.ChaveAcesso||e?.chaveAcesso||'');
  if(confirmacoes.has(tipo)&&identidade===chave)return true;
  let arquivo=e?.ArquivoXml||e?.arquivoXml||e?.eventoXmlGZipB64;
  if(typeof arquivo!=='string'||arquivo.length>3000000)return false;
  try{
   let bytes=Buffer.from(arquivo,'base64');if(bytes[0]!==0x1f||bytes[1]!==0x8b)bytes=Buffer.from(bytes.toString('ascii').trim(),'base64');
   const xml=gunzipSync(bytes,{maxOutputLength:4000000}).toString('utf8');if(/<!DOCTYPE|<!ENTITY/i.test(xml))return false;
   const doc=new DOMParser({onError:()=>{throw Error('Evento inválido');}}).parseFromString(xml,'application/xml'),nodes=(n:string)=>doc.getElementsByTagNameNS(NS,n);
   if(!doc.documentElement||doc.documentElement.localName!=='evento'||doc.documentElement.namespaceURI!==NS||nodes('infEvento').length!==1||nodes('chNFSe').length!==1||nodes('chNFSe')[0].textContent?.trim()!==chave||nodes('tpAmb')[0]?.textContent?.trim()!=='1')return false;
   const codigos=Array.from(doc.getElementsByTagNameNS(NS,'*')).map(n=>n.localName||'').filter(n=>/^e\d{6}$/.test(n));
   return codigos.length===1&&confirmacoes.has(codigos[0].slice(1));
  }catch{return false;}
 });
}
