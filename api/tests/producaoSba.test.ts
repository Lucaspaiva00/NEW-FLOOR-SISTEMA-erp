import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createCipheriv,hkdfSync} from 'node:crypto';
import forge from 'node-forge';
import {montarDpsProducaoSba} from '../src/services/dpsProducaoSba.service';
import {validarDestinoSba} from '../src/services/sefinTransmissaoSba.service';
import {validarDpsProducaoSba} from '../src/services/validacaoXsdProducaoSba.service';
import {assinarDpsXmlSba} from '../src/services/xmlAssinaturaDpsSba.service';
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

const nota=()=>({empresaId:2,empresa:{slug:'sba'},empresaFiscalId:9,notafiscalid:8,tipo:'NFSE',status:'RASCUNHO',propostaId:null,
 empresaFiscal:{empresaId:2,ativo:true,cnpj:'08775345000129',razaoSocial:'SBA LABORATORIO',inscricaoMunicipal:'14000008175',codigoMunicipioIbge:'3537107',certificadoCriptografado:'SIM',serieNfse:'42026',provedor:'PORTAL_NACIONAL_DIRETO',padraoNfse:'NACIONAL',ambiente:'PRODUCAO',optanteSimplesNacional:true,regimeApuracaoSimples:1,itemListaServicoPadrao:'14.13'},
 destinatarioNome:'LUCAS PAIVA TECH SOLUTIONS',destinatarioCnpj:'47051253000158',destinatarioCodigoMunicipio:'3537107',destinatarioCep:'13928232',destinatarioEndereco:'Rua Mario Zarpelom',destinatarioNumero:'195',destinatarioComplemento:'Casa',destinatarioBairro:'Jardim Triunfo',
 valorServicos:1,valorTotal:1,itens:[{descricao:'Teste de emissão',quantidade:1,valorUnitario:1}],
 payloadExtra:{sbaTesteProducao:true,cTribNac:'141302',cNBS:'101075000',opSimpNac:'3',regEspTrib:'0',tribISSQN:'1',tpRetISSQN:'1',indTotTrib:'PERCENTUAL',pTotTribFed:'0',pTotTribEst:'0',pTotTribMun:'4.28',cLocPrestacao:'3537107',ibsCbsCst:'000',ibsCbsClassTrib:'000001',ibsCbsIndOp:'050101',ibsCbsIndDest:'0'}});
test('Produção limitada ao ensaio aprovado; rota de homologação continua recusando produção',()=>{
 const n=nota();assert.throws(()=>validarDestinoSba(n),/somente em homologação/);assert.doesNotThrow(()=>validarDestinoSba(n,true));
 for(const alteracao of [{valorTotal:2},{destinatarioCnpj:'20985558000180'},{empresaId:1},{payloadExtra:{}},{propostaId:137},{itens:[{descricao:'SERVIÇO FICTÍCIO',quantidade:1,valorUnitario:1}]}])assert.throws(()=>validarDestinoSba({...n,...alteracao},true));
 assert.throws(()=>validarDestinoSba({...n,empresaFiscal:{...n.empresaFiscal,serieNfse:'70000'}},true),/série/);
});
test('DPS de produção é assinada e validada exclusivamente contra o XSD oficial de produção',async()=>{
 const segredo=process.env.CERTIFICADO_ENCRYPTION_KEY;
 try{
 process.env.CERTIFICADO_ENCRYPTION_KEY='laboratorio-producao-sba';
 const previa=montarDpsProducaoSba(nota(),new Date('2026-11-04T23:00:00Z'));
 assert.deepEqual(previa.pendencias,[]);assert.match(previa.xml,/<tpAmb>1<\/tpAmb>/);
 assert.match(previa.xml,/<IBSCBS><finNFSe>0<\/finNFSe>/);
 assert.match(previa.xml,/<xDescServ>Teste de emissão<\/xDescServ><cNBS>101075000<\/cNBS>/);
 const c=certificadoTeste();const assinada=assinarDpsXmlSba(previa.xml,envelopeTeste(c.arquivo,c.senha),2,9);
 const resultado=await validarDpsProducaoSba(assinada.xmlAssinado);
 assert.equal(resultado.valido,true,String(resultado.erro));assert.equal(resultado.versao,'PROD-v1.01-20260209');
 }finally{if(segredo===undefined)delete process.env.CERTIFICADO_ENCRYPTION_KEY;else process.env.CERTIFICADO_ENCRYPTION_KEY=segredo;}
});
