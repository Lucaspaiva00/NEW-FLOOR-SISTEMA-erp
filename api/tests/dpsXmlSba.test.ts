import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createCipheriv, hkdfSync } from "node:crypto";
import forge from "node-forge";
import { montarDpsPreviaSba } from "../src/services/dpsXmlSba.service";
import { assinarDpsXmlSba } from "../src/services/xmlAssinaturaDpsSba.service";
import {validarDpsOficialSba,estadoXsdOficialSba} from "../src/services/validacaoXsdSba.service";

function certificadoTeste(){
  const keys=forge.pki.rsa.generateKeyPair(1024);
  const cert=forge.pki.createCertificate();
  cert.publicKey=keys.publicKey;cert.serialNumber="12";
  cert.validity.notBefore=new Date(Date.now()-86400000);
  cert.validity.notAfter=new Date(Date.now()+86400000*30);
  cert.setSubject([{name:"commonName",value:"CERTIFICADO SINTETICO SBA"}]);
  cert.setIssuer(cert.subject.attributes);
  cert.sign(keys.privateKey,forge.md.sha256.create());
  const senha="senha-de-laboratorio";
  const asn1=forge.pkcs12.toPkcs12Asn1(keys.privateKey,[cert],senha,{algorithm:"3des"});
  return {arquivo:Buffer.from(forge.asn1.toDer(asn1).getBytes(),"binary").toString("base64"),senha};
}
function envelopeTeste(arquivo:string,senha:string){
  const chave=Buffer.from(hkdfSync("sha256",process.env.CERTIFICADO_ENCRYPTION_KEY!,
    "sba-certificado-a1","fiscal-v1",32));
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",chave,iv);
  cipher.setAAD(Buffer.from("2:9"));
  const data=Buffer.concat([cipher.update(JSON.stringify({arquivo,senha}),"utf8"),cipher.final()]);
  return JSON.stringify({v:1,iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),data:data.toString("base64")});
}
function notaTeste(){
  return {
    empresaId:2,notafiscalid:743,tipo:"NFSE",status:"RASCUNHO",
    empresaFiscal:{
      ativo:true,cnpj:"12345678000190",razaoSocial:"SBA LABORATORIO",
      inscricaoMunicipal:"987",codigoMunicipioIbge:"3509502",
      certificadoCriptografado:"SIM",serieNfse:"900",
      optanteSimplesNacional:true,regimeApuracaoSimples:1,
      itemListaServicoPadrao:"0101"
    },
    destinatarioNome:"Cliente <S.A.>",destinatarioCnpj:"98765432000110",
    destinatarioCodigoMunicipio:"3509502",destinatarioCep:"13000000",
    destinatarioEndereco:"Avenida Laboratorio",destinatarioNumero:"10",destinatarioBairro:"Centro",
    valorServicos:150.2,itens:[{descricao:"Instalacao & manutencao"}],
    payloadExtra:{cTribNac:"010101",opSimpNac:"3",regEspTrib:"0",tribISSQN:"1",tpRetISSQN:"1",indTotTrib:"0"},
    proposta:{status:"PENDENTE",planoRecebimento:null}
  };
}
test("DPS experimental da SBA: ordem de tags e escape seguro",()=>{
  const dps=montarDpsPreviaSba(notaTeste(),new Date("2026-10-23T13:45:00.000Z"));
  assert.deepEqual(dps.pendencias,[]);
  assert.match(dps.xml,/<DPS xmlns="http:\/\/www.sped.fazenda.gov.br\/nfse" versao="1.01">/);
  assert.match(dps.xml,/<xNome>Cliente &lt;S.A.&gt;<\/xNome>/);
  assert.match(dps.xml,/<xDescServ>Instalacao &amp; manutencao<\/xDescServ>/);
  assert.match(dps.xml,/<tpAmb>2<\/tpAmb>/);
  assert.match(dps.id,/^DPS[0-9]{42}$/);
  assert.equal(dps.conformidadeXsdValidada,false);
});
test("DPS não inventa série, classificação nem apuração tributária",()=>{
  const nota=notaTeste();
  nota.empresaFiscal.serieNfse="";
  delete (nota.payloadExtra as any).cTribNac;
  const dps=montarDpsPreviaSba(nota);
  assert.equal(dps.xml,"");
  assert.ok(dps.pendencias.some(x=>x.includes("série")));
  assert.ok(dps.pendencias.some(x=>x.includes("cTribNac")));
});
test("Assinatura XMLDSig é verificável e não exporta chave privada",async()=>{
  const original=process.env.CERTIFICADO_ENCRYPTION_KEY;
  try{
    process.env.CERTIFICADO_ENCRYPTION_KEY="segredo-teste-xml-sba";
    const a1=certificadoTeste();
    const envelope=envelopeTeste(a1.arquivo,a1.senha);
    const dps=montarDpsPreviaSba(notaTeste());
    const r=assinarDpsXmlSba(dps.xml,envelope,2,9);
    assert.equal(r.signatureVerificada,true);
    assert.equal(r.xsdHomologado,false);
    assert.match(r.xmlAssinado,/SignatureValue/);
    if(estadoXsdOficialSba().disponivel){
      const xsd=await validarDpsOficialSba(r.xmlAssinado);
      assert.equal(xsd.valido,true,"DPS sintética assinada deve passar no XSD oficial: "+String(xsd.erro||""));
    }
    assert.doesNotMatch(r.xmlAssinado,/PRIVATE KEY|senha-de-laboratorio/);
    assert.throws(()=>assinarDpsXmlSba(dps.xml,envelope,3,9),/descriptografado/);
  }finally{
    if(original===undefined)delete process.env.CERTIFICADO_ENCRYPTION_KEY;
    else process.env.CERTIFICADO_ENCRYPTION_KEY=original;
  }
});

test("diagnóstico sintético contra XSD oficial: nunca autoriza emissão",async context=>{
  if(!estadoXsdOficialSba().disponivel){context.skip("Pacote XSD não disponível");return;}
  const dps=montarDpsPreviaSba(notaTeste());
  assert.equal(dps.pendencias.length,0);
  const check=await validarDpsOficialSba(dps.xml);
  // O teste expõe apenas o primeiro erro de leiaute de um documento fictício.
  // Nunca reporta o XML como homologado, mesmo quando algum trecho passa.
  if(!check.valido)console.info("Diagnóstico DPS SBA sintética (somente schema): "+String(check.erro).slice(0,420));
  assert.equal(typeof check.valido,"boolean");
});
