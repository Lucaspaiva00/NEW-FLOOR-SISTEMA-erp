import {createDecipheriv,hkdfSync} from 'node:crypto';
import {request} from 'node:https';
import {gunzipSync} from 'node:zlib';
import {DOMParser} from '@xmldom/xmldom';
import forge from 'node-forge';
import {validarCertificadoA1Sba} from './certificadoA1Sba.service';

export const SEFIN_RESTRITA_BASE='https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional';
import {prepararPfxTlsSba} from './pfxTlsSba.service';
const NS='http://www.sped.fazenda.gov.br/nfse';
const erro=(message:string,statusCode=422)=>Object.assign(Error(message),{statusCode});

/** Transporte exclusivo da SBA. Nunca aceita URL/host vindo do cliente. */
export function validarDestinoSba(nota:any,permitirProducao=false){
 if(nota?.empresa?.slug!=='sba'||nota.empresaId!==2||nota.tipo!=='NFSE'||
    nota.empresaFiscal?.empresaId!==nota.empresaId||nota.empresaFiscal?.provedor!=='PORTAL_NACIONAL_DIRETO'||
    nota.empresaFiscal?.padraoNfse!=='NACIONAL')throw erro('Transmissão direta exclusiva da NFS-e Nacional da SBA.',403);
 const ambiente=nota.ambienteEmissao||nota.empresaFiscal.ambiente;
 if(ambiente==='PRODUCAO'&&permitirProducao){
  const serie=Number(nota.empresaFiscal?.serieNfse);
  if(!Number.isInteger(serie)||serie<1||serie>49999)throw erro('Informe uma série DPS da faixa de aplicativo próprio (1 a 49999).');
  return;
 }
 if(ambiente!=='HOMOLOGACAO')throw erro('A transmissão da SBA está disponível somente em homologação.');
}

/** Liberação inicial de produção limitada ao ensaio aprovado pelo administrador. */
export function validarTesteProducaoSba(nota:any){
 if(nota.empresaId!==2||nota.empresa?.slug!=='sba'||nota.tipo!=='NFSE'||nota.propostaId||
    nota.payloadExtra?.sbaTesteProducao!==true||nota.payloadExtra?.testeHomologacao||
    String(nota.destinatarioCnpj||'').replace(/\D/g,'')!=='47051253000158'||
    Number(nota.valorServicos)!==1||Number(nota.valorTotal)!==1||
    nota.itens?.length!==1||nota.itens[0].descricao!=='Teste de emissão'||
    Number(nota.itens[0].quantidade)!==1||Number(nota.itens[0].valorUnitario)!==1)
  throw erro('Produção SBA liberada apenas para o teste aprovado de R$ 1,00, sem proposta e para o tomador autorizado.');
 const serie=Number(nota.empresaFiscal?.serieNfse);
 if(!Number.isInteger(serie)||serie<1||serie>49999)throw erro('Informe uma série DPS da faixa de aplicativo próprio (1 a 49999).');
}

/** PFX permanece em memória e nunca integra retorno, logs ou banco de auditoria. */
export async function comA1Sba<T>(nota:any,usar:(pfx:Buffer,senha:string)=>Promise<T>,apenasConsulta=false):Promise<T>{
 if(apenasConsulta){if(nota?.empresaId!==2||nota.empresa?.slug!=='sba'||nota.empresaFiscal?.empresaId!==2||nota.empresaFiscal?.provedor!=='PORTAL_NACIONAL_DIRETO'||nota.empresaFiscal?.padraoNfse!=='NACIONAL')throw erro('Consulta direta exclusiva da SBA.',403);}
 else validarDestinoSba(nota,true);
 const segredo=process.env.CERTIFICADO_ENCRYPTION_KEY||process.env.JWT_SECRET;
 if(!segredo)throw erro('Chave de criptografia do A1 indisponível no servidor.');
 let claro:Buffer|undefined,pfx:Buffer|undefined,pfxTls:Buffer|undefined,senha='';
 try{
  try{
   const env=JSON.parse(nota.empresaFiscal.certificadoCriptografado||'');
   if(env.v!==1||![env.iv,env.tag,env.data].every(v=>typeof v==='string'))throw Error();
   const key=Buffer.from(hkdfSync('sha256',segredo,'sba-certificado-a1','fiscal-v1',32));
   const dec=createDecipheriv('aes-256-gcm',key,Buffer.from(env.iv,'base64'));
   dec.setAAD(Buffer.from(nota.empresaId+':'+nota.empresaFiscalId));
   dec.setAuthTag(Buffer.from(env.tag,'base64'));
   claro=Buffer.concat([dec.update(Buffer.from(env.data,'base64')),dec.final()]);
   const pacote=JSON.parse(claro.toString('utf8'));senha=pacote.senha;
   pfx=validarCertificadoA1Sba(pacote.arquivo,senha);
   const pkcs=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfx.toString('binary')),senha);
   const certs=(pkcs.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[]).map(b=>b.cert).filter(Boolean);
   const cnpj=String(nota.empresaFiscal.cnpj).replace(/\D/g,'');
   // e-CNPJ ICP-Brasil: CNPJ no CN ou no otherName 2.16.76.1.3.3.
   const pertence=certs.some((cert:any)=>{
    if(cert.subject.attributes.some((a:any)=>a.name==='commonName'&&new RegExp('(?:^|:)'+cnpj+'$').test(String(a.value))))return true;
    const san=cert.extensions.find((e:any)=>e.id==='2.5.29.17');
    if(!san?.value)return false;
    try{
     const root=forge.asn1.fromDer(san.value);
     return (Array.isArray(root.value)?root.value:[]).some((entry:any)=>{
      const parts=Array.isArray(entry.value)?entry.value:[];
      if(!parts[0]||forge.asn1.derToOid(parts[0].value)!=='2.16.76.1.3.3')return false;
      const strings=(v:any):string=>Array.isArray(v.value)?v.value.map(strings).join(''):typeof v.value==='string'?v.value:'';
      return strings(entry).includes(cnpj);
     });
    }catch{return false;}
   });
   if(!pertence)throw erro('O CNPJ titular do A1 não corresponde à emissora SBA.');
  }catch(e:any){
   if(e.message==='O CNPJ titular do A1 não corresponde à emissora SBA.')throw e;
   throw erro('Não foi possível validar o A1 armazenado da emissora SBA. Confira validade, senha e vínculo.');
  }
  pfxTls=prepararPfxTlsSba(pfx!,senha);
  return await usar(pfxTls,senha);
 }finally{claro?.fill(0);pfxTls?.fill(0);pfx?.fill(0);senha='';}
}

export async function solicitarSefinSba(nota:any,method:'GET'|'POST',path:string,body?:any):Promise<{httpStatus:number,data:any}>{
 validarDestinoSba(nota,true);
 if(!((method==='POST'&&(path==='/nfse'||/^\/nfse\/\d{50}\/eventos$/.test(path)))||(method==='GET'&&/^\/(?:dps\/DPS\d{42}|nfse\/\d{50}(?:\/eventos\/101101\/1)?)$/.test(path))))throw erro('Operação SEFIN não permitida.');
 return comA1Sba(nota,(pfx,senha)=>new Promise((resolve,reject)=>{
  const texto=body===undefined?undefined:JSON.stringify(body);
  const base=(nota.ambienteEmissao||nota.empresaFiscal.ambiente)==='PRODUCAO'?'https://sefin.nfse.gov.br/SefinNacional':SEFIN_RESTRITA_BASE;
  const req=request(base+path,{
   method,pfx,passphrase:senha,minVersion:'TLSv1.2',rejectUnauthorized:true,
   headers:{Accept:'application/json',...(texto?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(texto)}:{})}
  },res=>{
   const chunks:Buffer[]=[];let size=0;
   res.on('data',chunk=>{size+=chunk.length;if(size>4_000_000){req.destroy(erro('Retorno SEFIN excedeu o limite permitido.',502));return;}chunks.push(chunk);});
   res.on('error',()=>reject(erro('Conexão interrompida durante o retorno SEFIN. Consulte a DPS antes de reenviar.',502)));
   res.on('end',()=>{
    try{resolve({httpStatus:res.statusCode||502,data:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}
    catch{reject(erro('A SEFIN não retornou JSON válido. Consulte a DPS antes de reenviar.',502));}
   });
  });
  const deadline=setTimeout(()=>req.destroy(erro('Tempo esgotado na SEFIN. Consulte a DPS antes de reenviar.',504)),20000);
  req.on('close',()=>clearTimeout(deadline));
  req.on('error',()=>reject(erro('Não foi possível concluir a comunicação SEFIN. Consulte a DPS antes de reenviar.',502)));
  req.end(texto);
 }));
}

export function lerRetornoSefinSba(result:{httpStatus:number,data:any},idDps:string,ambiente='HOMOLOGACAO'){
 const data=result.data||{};
 const erros=Array.isArray(data.erros)?data.erros:[];
 const mensagem=erros.map((e:any)=>[e.Codigo||e.codigo,e.Descricao||e.descricao,e.Complemento||e.complemento].filter(Boolean).join(' — ')).join('; ').slice(0,1800);
 // Só uma rejeição explícita em resposta HTTP de cliente permite editar e reenviar.
 if(result.httpStatus>=400&&result.httpStatus<500&&erros.length)return {status:'REJEITADA' as const,mensagem:mensagem||'DPS rejeitada pela SEFIN.'};
 if(result.httpStatus<200||result.httpStatus>=300||!data.nfseXmlGZipB64)return {status:'PROCESSANDO' as const,mensagem:'Resultado ainda não confirmado. Consulte a DPS antes de qualquer reenvio.'};
 if(typeof data.nfseXmlGZipB64!=='string'||data.nfseXmlGZipB64.length>3_000_000)throw erro('XML da NFS-e retornada excedeu o limite.',502);
 const xml=gunzipSync(Buffer.from(data.nfseXmlGZipB64,'base64'),{maxOutputLength:4_000_000}).toString('utf8');
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw erro('XML da NFS-e retornada inválido.',502);
 const doc=new DOMParser({onError:()=>{throw erro('XML da NFS-e retornada inválido.',502);}}).parseFromString(xml,'application/xml');
 const infs=doc.getElementsByTagNameNS(NS,'infNFSe'),dpss=doc.getElementsByTagNameNS(NS,'infDPS');
 const chave=String(data.chaveAcesso||'');
 if(doc.documentElement?.localName!=='NFSe'||infs.length!==1||dpss.length!==1||
    dpss[0].getAttribute('Id')!==idDps||!/^\d{50}$/.test(chave)||infs[0].getAttribute('Id')!=='NFS'+chave||
    doc.getElementsByTagNameNS(NS,'tpAmb')[0]?.textContent!==(ambiente==='PRODUCAO'?'1':'2'))throw erro('A NFS-e retornada não corresponde à DPS de homologação enviada.',502);
 const numero=doc.getElementsByTagNameNS(NS,'nNFSe')[0]?.textContent||undefined;
 if(!/^\d+$/.test(numero||''))throw erro('Número da NFS-e retornada inválido.',502);
 return {status:'AUTORIZADA' as const,chave,numero,xml,mensagem:ambiente==='PRODUCAO'?'NFS-e autorizada em produção.':'NFS-e autorizada em homologação, sem faturamento financeiro.'};
}
