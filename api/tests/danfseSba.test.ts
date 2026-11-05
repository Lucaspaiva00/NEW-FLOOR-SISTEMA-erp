import test from 'node:test';
import assert from 'node:assert/strict';
import {montarDanfseSba} from '../src/services/danfseSba.service';
import {pdfAutorizadoProducaoSba} from '../src/controller/ctproducaoSba';
import prisma from '../src/prisma';
const chave='2'.repeat(50);
const xml=`<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS${chave}"><nNFSe>25</nNFSe><cStat>100</cStat><dhProc>2026-11-04T20:30:48-03:00</dhProc><emit><CNPJ>12345678000195</CNPJ><xNome>Emitente &amp; Filhos</xNome><email>original@example.com</email></emit><valores><vLiq>1.00</vLiq></valores><IBSCBS><totCIBS><vTotNF>1.00</vTotNF><gCBS><vCBS>0.01</vCBS></gCBS></totCIBS></IBSCBS><DPS><infDPS><tpAmb>1</tpAmb><nDPS>11</nDPS><serie>42026</serie><dCompet>2026-11-04</dCompet><toma><xNome>Cliente Exemplo</xNome></toma><serv><cServ><cTribNac>141302</cTribNac><xDescServ>&lt;img src="https://evil.invalid"&gt;Teste de emissão</xDescServ><cNBS>101075000</cNBS></cServ></serv><valores><vServPrest><vServ>1.00</vServ></vServPrest><trib><totTrib><pTotTrib><pTotTribMun>4.28</pTotTribMun></pTotTrib></totTrib></trib></valores></infDPS></DPS></infNFSe></NFSe>`;
test('DANFSe usa somente XML autorizado, mantém centavos e fuso e escapa conteúdo',async()=>{
 const html=await montarDanfseSba(xml,chave);
 for(const s of ['DANFSe v2.0','Emitente &amp; Filhos','original@example.com','Cliente Exemplo','04/11/2026 20:30:48','42026','101075000','4,28%','R$','0,01',chave])assert.ok(html.includes(s),s);
 assert.ok(html.includes('&lt;img src=&quot;https://evil.invalid&quot;&gt;'));
 assert.equal(html.includes('<img src="https://evil.invalid"'),false);
 assert.equal(html.includes('nfse.gov.br/ConsultaPublica'),false); // QR gerado localmente, não imagem remota.
 assert.ok(html.includes('data:image/png;base64,'));
});
test('DANFSe recusa chave divergente, homologação, ausência de autorização e entidades',async()=>{
 await assert.rejects(montarDanfseSba(xml,'3'.repeat(50)),/chave/);
 await assert.rejects(montarDanfseSba(xml.replace('<tpAmb>1','<tpAmb>2'),chave),/produção/);
 await assert.rejects(montarDanfseSba(xml.replace('<cStat>100','<cStat>999'),chave),/autorizada/);
 await assert.rejects(montarDanfseSba('<!DOCTYPE x>'+xml,chave),/inválido/);
});
test('rota PDF impede acesso fora da SBA e nunca emite ou disponibiliza rascunho',async()=>{
 const old=prisma.notaFiscal.findFirst;let reads=0;
 const res=()=>({code:200,body:null,status(n:number){this.code=n;return this;},json(v:any){this.body=v;return this;}} as any);
 try{
  (prisma.notaFiscal as any).findFirst=async()=>{reads++;return {notafiscalid:11,empresaId:2,tipo:'NFSE',status:'RASCUNHO',empresa:{slug:'sba'},empresaFiscal:{empresaId:2,ambiente:'PRODUCAO',provedor:'PORTAL_NACIONAL_DIRETO',padraoNfse:'NACIONAL',serieNfse:'42026'},valorTotal:1,valorServicos:1,destinatarioCnpj:'47051253000158',itens:[{descricao:'Teste de emissão',quantidade:1,valorUnitario:1}],payloadExtra:{sbaTesteProducao:true}};};
  const req={empresaId:1,configuracaoSistema:{perfil:'NEWFLOOR'},params:{id:'11'}} as any;
  const other=res();await pdfAutorizadoProducaoSba(req,other);assert.equal(other.code,403);assert.equal(reads,0);
  req.empresaId=2;req.configuracaoSistema.perfil='SBA';const draft=res();await pdfAutorizadoProducaoSba(req,draft);assert.equal(draft.code,422);assert.match(draft.body.error,/ainda não autorizado/);
 }finally{(prisma.notaFiscal as any).findFirst=old;}
});

test('DANFSe cancelado identifica a situação e inclui marca CANCELADA sem alterar XML',async()=>{
 const html=await montarDanfseSba(xml,chave,true);assert.ok(html.includes('class="watermark">CANCELADA'));assert.ok(html.includes('NFS-e cancelada'));
 const normal=await montarDanfseSba(xml,chave);assert.equal(normal.includes('class="watermark">CANCELADA'),false);
});
