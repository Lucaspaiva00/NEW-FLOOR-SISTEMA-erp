import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import forge from 'node-forge';
import prisma from '../src/prisma';
import auth from '../src/middlewares/auth';
import {resolverConfiguracao,prepararCampos,validarConfiguracao,TEXTO_SBA} from '../src/services/configuracaoSistema.service';
import {calcularComposicao} from '../src/services/orcamentoSba.service';
import {gerarHtmlSba} from '../src/services/orcamentoSbaHtml.service';
import {gerarHtmlProposta} from '../src/services/propostaHtml.service';
import {validarCertificado,criptografarCertificado} from '../src/controller/ctcertificado';
import {createDecipheriv,hkdfSync} from 'crypto';
test('PADRAO preserva campos e SBA tem configuração independente',()=>{
 const normal=resolverConfiguracao(null),sba=resolverConfiguracao({perfil:'SBA'});
 assert.equal(normal.camposProposta.frete,true);assert.equal(normal.composicaoCustos,false);assert.equal(sba.composicaoCustos,true);
 assert.equal(sba.camposProposta.frete,false);sba.modulos.clientes=false;assert.equal(normal.modulos.clientes,true);assert.equal(resolverConfiguracao({perfil:'SBA'}).textoEscopo,TEXTO_SBA);
});
test('Servidor descarta campos desabilitados e valida dependências',()=>{
 const config=resolverConfiguracao({perfil:'SBA'});assert.deepEqual(prepararCampos({prioridade:'Alta',origem:'Web',frete:400,validadeDias:60},config),{prioridade:null,origem:null,frete:0,validadeDias:null});
 assert.throws(()=>validarConfiguracao(resolverConfiguracao({modulos:{clientes:false}})));assert.equal(resolverConfiguracao({modulos:{clientes:'false'}}).modulos.clientes,true);
});
test('Preço e lucro calculados corretamente e valores inválidos rejeitados',()=>{
 const c={materiais:[{quantidade:2,custoUnitario:100}],maoObra:[{dias:1,pessoas:2,horasDia:8,valorHora:37.5}],margem:.6,imposto:.18};
 const d=calcularComposicao(c);assert.equal(d.custoTotal,800);assert.equal(d.preco,2000);assert.equal(d.valorImposto,360);assert.equal(d.lucro,840);
 assert.throws(()=>calcularComposicao({...c,margem:1}));assert.throws(()=>calcularComposicao({...c,materiais:[{quantidade:-1,custoUnitario:100}]}));
});
test('Token define empresa e módulo desabilitado é bloqueado',async()=>{
 process.env.JWT_SECRET='teste-local';const original=prisma.empresa.findUnique;
 (prisma.empresa as any).findUnique=async({where}:any)=>{assert.equal(where.empresaid,7);return {configuracaoSistema:{modulos:{financeiro:false}}};};
 try {const req:any={headers:{authorization:'Bearer '+jwt.sign({id:1,empresaId:7,role:'ADMIN'},process.env.JWT_SECRET),'x-empresa-id':'9'},query:{},path:'/financeiro/dashboard'};let status=0;let next=false;const res:any={status:(s:number)=>{status=s;return res;},json:()=>res};await auth(req,res,()=>{next=true;});assert.equal(req.empresaId,7);assert.equal(status,403);assert.equal(next,false);}finally{prisma.empresa.findUnique=original;}
});
test('PDF SBA omite custos e escopo vazio e mantém notas exatas',()=>{
 const p:any={numero:3706,subtotal:4250,empresa:{nome:'SBA'},composicaoCustos:{segredo:'CUSTO-INTERNO'},emailDestinatario:'comprador@teste',contatoDestinatario:'Luiz'};
 const html=gerarHtmlSba(p,{razaoSocial:'Cliente'},[{descricao:'Serviço',quantidade:1,subtotal:4250,valorUnitario:4250}]);
 assert.ok(html.includes(TEXTO_SBA));assert.ok(html.includes('0003706'));assert.ok(html.includes('comprador@teste'));assert.ok(!html.includes('CUSTO-INTERNO'));assert.ok(!html.includes('Frete'));assert.ok(!gerarHtmlSba({...p,escopo:''},{},[]).includes('IPI ISENTO'));
});
test('Modelo padrão não recebe documento SBA',async()=>{
 const html=await gerarHtmlProposta({proposta:{numero:'1',titulo:'Teste',subtotal:10,empresa:{nome:'NEW FLOOR'}},cliente:{razaoSocial:'Cliente'},itens:[],template:{exibirLogo:false}});assert.ok(!html.includes('SERRALHERIA SBA'));assert.ok(!html.includes(TEXTO_SBA));
});
test('A1 valida senha e criptografia vincula o arquivo à empresa emissora',()=>{
 const keys=forge.pki.rsa.generateKeyPair(1024),cert=forge.pki.createCertificate();cert.publicKey=keys.publicKey;cert.serialNumber='01';cert.validity.notBefore=new Date(Date.now()-1000);cert.validity.notAfter=new Date(Date.now()+86400000);cert.setSubject([{name:'commonName',value:'Teste'}]);cert.setIssuer(cert.subject.attributes);cert.sign(keys.privateKey);
 const pfx=forge.pkcs12.toPkcs12Asn1(keys.privateKey,[cert],'senha');const arquivo=Buffer.from(forge.asn1.toDer(pfx).getBytes(),'binary').toString('base64');assert.ok(validarCertificado(arquivo,'senha'));assert.throws(()=>validarCertificado(arquivo,'errada'));
 const enc=JSON.parse(criptografarCertificado(arquivo,'senha',7,3));assert.ok(!enc.data.includes('senha'));
 const key=Buffer.from(hkdfSync('sha256',process.env.JWT_SECRET!,'sba-certificado-a1','fiscal-v1',32));const decrypt=(tenant:string)=>{const d=createDecipheriv('aes-256-gcm',key,Buffer.from(enc.iv,'base64'));d.setAAD(Buffer.from(tenant));d.setAuthTag(Buffer.from(enc.tag,'base64'));return Buffer.concat([d.update(Buffer.from(enc.data,'base64')),d.final()]).toString();};assert.equal(JSON.parse(decrypt('7:3')).arquivo,arquivo);assert.throws(()=>decrypt('8:3'));
});
