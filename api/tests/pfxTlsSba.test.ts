import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createSecureContext} from 'node:tls';
import forge from 'node-forge';
import {prepararPfxTlsSba} from '../src/services/pfxTlsSba.service';
test('PFX legado recusado no OpenSSL é convertido sem trocar identidade, chave ou cadeia',()=>{
 const dir=mkdtempSync(join(tmpdir(),'sba-pfx-sintetico-'));
 let original:Buffer|undefined,moderno:Buffer|undefined;
 try{
  const keys=forge.pki.rsa.generateKeyPair(2048);
  const cert=forge.pki.createCertificate();cert.publicKey=keys.publicKey;cert.serialNumber='01';
  cert.validity.notBefore=new Date(Date.now()-86400000);cert.validity.notAfter=new Date(Date.now()+86400000);
  cert.setSubject([{name:'commonName',value:'SBA TESTE SINTETICO:12345678000190'}]);cert.setIssuer(cert.subject.attributes);
  cert.sign(keys.privateKey,forge.md.sha256.create());
  writeFileSync(join(dir,'cert.pem'),forge.pki.certificateToPem(cert),{mode:0o600});
  writeFileSync(join(dir,'key.pem'),forge.pki.privateKeyToPem(keys.privateKey),{mode:0o600});
  const proc=spawnSync('openssl',['pkcs12','-export','-legacy','-keypbe','PBE-SHA1-3DES','-certpbe','PBE-SHA1-RC2-40','-in',join(dir,'cert.pem'),'-inkey',join(dir,'key.pem'),'-out',join(dir,'legacy.pfx'),'-passout','pass:teste-sintetico'],{encoding:'utf8'});
  assert.equal(proc.status,0,'OpenSSL precisa gerar o PFX sintético legado');
  original=readFileSync(join(dir,'legacy.pfx'));
  const copia=Buffer.from(original);
  assert.throws(()=>createSecureContext({pfx:original,passphrase:'teste-sintetico'}));
  moderno=prepararPfxTlsSba(original,'teste-sintetico');
  assert.doesNotThrow(()=>createSecureContext({pfx:moderno,passphrase:'teste-sintetico'}));
  assert.deepEqual(original,copia,'O arquivo original não pode ser alterado');
  const pkcs=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(moderno.toString('binary')),'teste-sintetico');
  const leaf=pkcs.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]![0].cert!;
  assert.equal(forge.pki.certificateToPem(leaf),forge.pki.certificateToPem(cert));
  assert.throws(()=>prepararPfxTlsSba(original!,'senha-incorreta'),/Não foi possível preparar/);
 }finally{original?.fill(0);moderno?.fill(0);rmSync(dir,{recursive:true,force:true});}
});
