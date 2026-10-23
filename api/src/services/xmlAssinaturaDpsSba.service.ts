import { createDecipheriv, hkdfSync } from "node:crypto";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { DOMParser } from "@xmldom/xmldom";
import { validarCertificadoA1Sba } from "./certificadoA1Sba.service";

/**
 * Assina apenas DPS em memória. O A1 só pode ser decifrado pelo servidor,
 * vinculado por GCM/AAD à empresa e à emissora autorizadas.
 * Esta função não transmite, não persiste e não homologa o XML.
 */
export function assinarDpsXmlSba(
  xml:string,envelope:string,empresaId:number,emissoraId:number
): {xmlAssinado:string;signatureVerificada:true; xsdHomologado:false} {
  if(typeof xml!=="string"||xml.length>300000||
    /<!DOCTYPE|<!ENTITY/i.test(xml)||!/^<\?xml version="1.0" encoding="UTF-8"\?>/.test(xml)) {
    throw Error("Prévia XML inválida para assinatura.");
  }
  if(!Number.isSafeInteger(empresaId)||empresaId<=0||!Number.isSafeInteger(emissoraId)||emissoraId<=0)
    throw Error("Identificação da SBA inválida.");
  const parser=new DOMParser({onError:(level,message)=>{
    if(level!=="warning")throw Error("XML malformado: "+String(message).slice(0,80));
  }});
  const doc=parser.parseFromString(xml,"application/xml");
  if(doc.documentElement?.localName!=="DPS"||
    doc.documentElement.namespaceURI!=="http://www.sped.fazenda.gov.br/nfse"||
    doc.getElementsByTagNameNS("http://www.sped.fazenda.gov.br/nfse","infDPS").length!==1) {
    throw Error("Somente DPS Nacional com infDPS único pode ser assinada.");
  }
  const inf=doc.getElementsByTagNameNS("http://www.sped.fazenda.gov.br/nfse","infDPS")[0];
  if(!/^DPS[0-9]{42}$/.test(inf.getAttribute("Id")||""))throw Error("Identificador Id da DPS inválido.");

  const segredo=process.env.CERTIFICADO_ENCRYPTION_KEY||process.env.JWT_SECRET;
  if(!segredo)throw Error("Chave de criptografia do servidor não configurada.");
  let pacote:any;
  let senha="";
  let buffer:Buffer|undefined;
  try {
    if(!envelope||envelope.length>2500000)throw Error();
    const obj=JSON.parse(envelope);
    if(obj.v!==1||![obj.iv,obj.tag,obj.data].every((v:unknown)=>typeof v==="string"))throw Error();
    const key=Buffer.from(hkdfSync("sha256",segredo,"sba-certificado-a1","fiscal-v1",32));
    const dec=createDecipheriv("aes-256-gcm",key,Buffer.from(obj.iv,"base64"));
    dec.setAAD(Buffer.from(empresaId+":"+emissoraId));
    dec.setAuthTag(Buffer.from(obj.tag,"base64"));
    buffer=Buffer.concat([dec.update(Buffer.from(obj.data,"base64")),dec.final()]);
    pacote=JSON.parse(buffer.toString("utf8"));
    buffer.fill(0);
    buffer=undefined;
    senha=pacote.senha;
  }catch {
    throw Error("A1 não pôde ser descriptografado para a emissora da SBA.");
  }
  let pfx:any;
  try {
    buffer=validarCertificadoA1Sba(pacote.arquivo,senha);
    pfx=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(buffer.toString("binary")),senha);
  } finally {
    buffer?.fill(0);pacote=null;senha="";
  }
  const bags=(oid:string):any[]=>(pfx.getBags({bagType:oid})[oid]||[]);
  const certs=bags(forge.pki.oids.certBag).map(b=>b.cert).filter(Boolean);
  const keys=[...bags(forge.pki.oids.pkcs8ShroudedKeyBag),...bags(forge.pki.oids.keyBag)]
    .map(b=>b.key).filter(Boolean);
  const pares:any[]=[];
  for(const cert of certs)for(const key of keys){
    if(key.n&&key.e&&cert.publicKey?.n&&cert.publicKey?.e&&
      key.n.toString(16)===cert.publicKey.n.toString(16)&&
      key.e.toString(16)===cert.publicKey.e.toString(16)&&
      cert.validity.notBefore<=new Date()&&cert.validity.notAfter>new Date()){
      pares.push({cert,key});
    }
  }
  if(pares.length!==1)throw Error("O A1 precisa ter exatamente um par de chave e certificado vigente.");
  const certificadoPem=forge.pki.certificateToPem(pares[0].cert);
  const chavePem=forge.pki.privateKeyToPem(pares[0].key);
  const assinatura=new SignedXml({
    privateKey:chavePem,publicCert:certificadoPem,
    signatureAlgorithm:"http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm:"http://www.w3.org/2001/10/xml-exc-c14n#",
    idAttribute:"Id",
  });
  assinatura.addReference({
    xpath:"/*[local-name()='DPS']/*[local-name()='infDPS']",
    transforms:[
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#"
    ],
    digestAlgorithm:"http://www.w3.org/2001/04/xmlenc#sha256",
  });
  assinatura.computeSignature(xml,{
    location:{reference:"/*[local-name()='DPS']",action:"append"}
  });
  const assinado=assinatura.getSignedXml();
  const verificador=new SignedXml({publicCert:certificadoPem});
  verificador.loadSignature(assinatura.getSignatureXml());
  if(!verificador.checkSignature(assinado))throw Error("A assinatura XMLDSig não passou na verificação local.");
  const referencias=verificador.getSignedReferences();
  if(referencias.length!==1 || !referencias[0].includes("<infDPS"))throw Error("Assinatura não cobre exclusivamente infDPS.");
  return {xmlAssinado:assinado,signatureVerificada:true,xsdHomologado:false};
}
