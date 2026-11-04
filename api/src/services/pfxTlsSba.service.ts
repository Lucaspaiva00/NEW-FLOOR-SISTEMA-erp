import forge from 'node-forge';
import {createSecureContext} from 'node:tls';

/** Reempacota em memória o mesmo par/chave e cadeia em PKCS#12 AES-256.
 * Evita formatos legados do PFX sem habilitar legacy provider, alterar o
 * arquivo armazenado ou enfraquecer a validação do servidor remoto.
 * O chamador deve zerar o Buffer ao concluir a negociação TLS.
 */
export function prepararPfxTlsSba(original:Buffer,senha:string):Buffer{
 let saida:Buffer|undefined;
 try{
  const pkcs=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(original.toString('binary')),senha);
  const bags=(oid:string):any[]=>(pkcs.getBags({bagType:oid})[oid]||[]);
  const certs=bags(forge.pki.oids.certBag).map(b=>b.cert).filter(Boolean);
  const keys=[...bags(forge.pki.oids.pkcs8ShroudedKeyBag),...bags(forge.pki.oids.keyBag)].map(b=>b.key).filter(Boolean);
  const agora=new Date();
  const pares:any[]=[];
  for(const cert of certs)for(const key of keys){
   if(key.n&&key.e&&cert.publicKey?.n&&cert.publicKey?.e&&key.n.equals(cert.publicKey.n)&&key.e.equals(cert.publicKey.e)&&cert.validity.notBefore<=agora&&cert.validity.notAfter>agora)
    pares.push({cert,key});
  }
  if(pares.length!==1)throw Error();
  const {cert,key}=pares[0];
  const cadeia=[cert,...certs.filter(c=>c!==cert)];
  const p12=forge.pkcs12.toPkcs12Asn1(key,cadeia,senha,{algorithm:'aes256',count:100000,useMac:true});
  saida=Buffer.from(forge.asn1.toDer(p12).getBytes(),'binary');
  // Confirma compatibilidade com o OpenSSL desta instalação, sem rede.
  createSecureContext({pfx:saida,passphrase:senha,minVersion:'TLSv1.2'});
  return saida;
 }catch{
  saida?.fill(0);
  throw Error('Não foi possível preparar o A1 para o canal TLS com o formato compatível.');
 }
}
