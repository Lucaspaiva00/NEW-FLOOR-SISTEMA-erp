import test from "node:test";
import assert from "node:assert/strict";
import forge from "node-forge";
import {validarCertificadoA1Sba} from "../src/services/certificadoA1Sba.service";

// Certificados fictícios de laboratório; nenhuma credencial real ou CNPJ.
function exemplo(options: { vencido?:boolean; semChave?:boolean } = {}): string {
  const keys=forge.pki.rsa.generateKeyPair(1024);
  const cert=forge.pki.createCertificate();
  cert.publicKey=keys.publicKey;
  cert.serialNumber="01";
  cert.validity.notBefore=new Date(Date.now()-(options.vencido?86400000*90:86400000));
  cert.validity.notAfter=new Date(Date.now()+(options.vencido?-86400000:86400000*30));
  cert.setSubject([{name:"commonName",value:"Teste A1 SBA Ficticio"}]);
  cert.setIssuer(cert.subject.attributes);
  cert.sign(keys.privateKey,forge.md.sha256.create());
  const asn1=forge.pkcs12.toPkcs12Asn1(
    options.semChave?null:keys.privateKey,[cert],"senha-ficticia",
    {algorithm:"3des"}
  );
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(),"binary").toString("base64");
}
test("SBA aceita PFX de teste vigente com chave privada correspondente",()=>{
  const cert=exemplo();
  assert.ok(validarCertificadoA1Sba(cert,"senha-ficticia").length>0);
});
test("SBA informa senha incorreta sem exibir credenciais",()=>{
  assert.throws(()=>validarCertificadoA1Sba(exemplo(),"outra-senha"),/senha|abrir o PFX/i);
});
test("SBA distingue PFX sem chave privada",()=>{
  assert.throws(()=>validarCertificadoA1Sba(exemplo({semChave:true}),"senha-ficticia"),/não contém chave privada/i);
});
test("SBA distingue certificado vencido",()=>{
  assert.throws(()=>validarCertificadoA1Sba(exemplo({vencido:true}),"senha-ficticia"),/vencido/i);
});
test("SBA rejeita conteúdo inválido e arquivo maior que 1 MB",()=>{
  assert.throws(()=>validarCertificadoA1Sba("YWJj","senha-ficticia"),/PFX\/P12 válido/);
  assert.throws(()=>validarCertificadoA1Sba("A".repeat(1_400_004),"senha-ficticia"),/maior que 1 MB/);
});
