import test from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, hkdfSync, randomBytes } from "node:crypto";
import forge from "node-forge";
import { testarAssinaturaA1ArmazenadoSba } from "../src/services/assinaturaA1Sba.service";
import { verificarCamposDpsSba, compactarDpsXmlAssinado, descompactarXmlDeTeste } from "../src/services/dpsNacionalSba.service";

function gerarCertificadoFicticio(): { arquivo:string; senha:string } {
  const par=forge.pki.rsa.generateKeyPair(1024);
  const cert=forge.pki.createCertificate();
  cert.publicKey=par.publicKey;
  cert.serialNumber="01";
  cert.validity.notBefore=new Date(Date.now()-86400000);
  cert.validity.notAfter=new Date(Date.now()+86400000*10);
  cert.setSubject([{name:"commonName",value:"SBA TESTE FICTICIO"}]);
  cert.setIssuer(cert.subject.attributes);
  cert.sign(par.privateKey,forge.md.sha256.create());
  const senha="Senha-de-teste";
  const asn=forge.pkcs12.toPkcs12Asn1(par.privateKey,[cert],senha,{algorithm:"3des"});
  return { arquivo:Buffer.from(forge.asn1.toDer(asn).getBytes(),"binary").toString("base64"),senha };
}
function cifrar(arquivo:string,senha:string,empresaId:number,id:number):string {
  const segredo=process.env.CERTIFICADO_ENCRYPTION_KEY!;
  const chave=Buffer.from(hkdfSync("sha256",segredo,"sba-certificado-a1","fiscal-v1",32));
  const iv=randomBytes(12);
  const enc=createCipheriv("aes-256-gcm",chave,iv);
  enc.setAAD(Buffer.from(empresaId+":"+id));
  const data=Buffer.concat([enc.update(JSON.stringify({arquivo,senha}),"utf8"),enc.final()]);
  return JSON.stringify({v:1,iv:iv.toString("base64"),tag:enc.getAuthTag().toString("base64"),data:data.toString("base64")});
}
test("A1 fictício armazenado assina desafio e retorna apenas metadados públicos",()=>{
  const antiga=process.env.CERTIFICADO_ENCRYPTION_KEY;
  try{
    process.env.CERTIFICADO_ENCRYPTION_KEY="segredo-ficticio-assinatura-sba-teste";
    const {arquivo,senha}=gerarCertificadoFicticio();
    const envelope=cifrar(arquivo,senha,2,45);
    const r=testarAssinaturaA1ArmazenadoSba(envelope,2,45);
    assert.equal(r.assinaturaTestada,true);
    assert.equal(r.identidadeFiscalConferida,false);
    assert.match(r.certificadoValidoAte,/^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!JSON.stringify(r).includes("PRIVATE KEY"));
    assert.throws(()=>testarAssinaturaA1ArmazenadoSba(envelope,3,45),/descriptografar/);
    assert.throws(()=>testarAssinaturaA1ArmazenadoSba(envelope,2,46),/descriptografar/);
  }finally{
    if(antiga===undefined)delete process.env.CERTIFICADO_ENCRYPTION_KEY;
    else process.env.CERTIFICADO_ENCRYPTION_KEY=antiga;
  }
});
test("pré-validação da nota exige dados da SBA e não emite por engano",()=>{
  const nota={tipo:"NFSE",status:"RASCUNHO",empresaFiscal:{
    ativo:true,cnpj:"12345678000190",razaoSocial:"SBA Teste",inscricaoMunicipal:"1234",
    codigoMunicipioIbge:"3509502",certificadoCriptografado:"fake",
    itemListaServicoPadrao:"1.01"
  },destinatarioNome:"Cliente",destinatarioCnpj:"11444777000161",
    destinatarioCodigoMunicipio:"3509502",valorServicos:200,
    itens:[{descricao:"Serviço fictício"}]};
  const resultado=verificarCamposDpsSba(nota);
  assert.deepEqual(resultado.pendencias,[]);
  assert.ok(resultado.avisos.some(x=>x.includes("XSD")));
  const ruim={...nota,destinatarioCodigoMunicipio:"",status:"AUTORIZADA"};
  assert.ok(verificarCamposDpsSba(ruim).pendencias.length>=2);
  assert.ok(verificarCamposDpsSba({...nota,tipo:"NFE"}).pendencias.length>0);
});
test("compactação DPS é somente preparação, nunca transmissão",()=>{
  const xml='<DPS xmlns="http://www.sped.fazenda.gov.br/nfse"><infDPS Id="DPS123"></infDPS><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"></Signature></DPS>';
  const data=compactarDpsXmlAssinado(xml);
  assert.equal(descompactarXmlDeTeste(data.dpsXmlGZipB64),xml);
  assert.throws(()=>compactarDpsXmlAssinado('<DPS></DPS>'),/assinada/);
});
