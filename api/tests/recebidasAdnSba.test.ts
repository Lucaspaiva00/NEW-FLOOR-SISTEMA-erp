import test from 'node:test';import assert from 'node:assert/strict';import {gzipSync} from 'node:zlib';
import {caminhoAdn,lerNotaRecebidaAdn,lerLoteAdn,conferirRecebidaAdn,consultarRecebidasAdn} from '../src/services/recebidasAdnSba.service';
const cnpj='08775345000129',chave='3'.repeat(50),empresa={empresafiscalid:2,empresaId:2,cnpj};
const xml=(toma=cnpj,emit='47051253000158')=>`<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS${chave}"><nNFSe>35</nNFSe><emit><CNPJ>${emit}</CNPJ><xNome>Fornecedor &amp; Cia</xNome></emit><DPS><infDPS><tpAmb>1</tpAmb><dhEmi>2026-11-06T09:00:00-03:00</dhEmi><toma><CNPJ>${toma}</CNPJ></toma><valores><vServ>123.45</vServ></valores></infDPS></DPS></infNFSe></NFSe>`;
const item=(conteudo=xml(),nsu=1)=>({NSU:nsu,TipoDocumento:'NFSE',ChaveAcesso:chave,ArquivoXml:gzipSync(conteudo).toString('base64')});
test('ADN lê somente NFS-e nacionais de produção recebidas pelo CNPJ autenticado',()=>{
 const nota=lerNotaRecebidaAdn(item(),cnpj)!;assert.equal(nota.valor,123.45);assert.equal(nota.emissor,'Fornecedor & Cia');assert.equal(nota.situacao,'recebida');assert.equal(lerNotaRecebidaAdn(item(xml('99999999000199')),cnpj),null);assert.equal(lerNotaRecebidaAdn(item(xml(cnpj,cnpj)),cnpj),null);
 assert.throws(()=>lerNotaRecebidaAdn(item(xml().replace('<tpAmb>1','<tpAmb>2')),cnpj));assert.throws(()=>lerNotaRecebidaAdn(item('<!DOCTYPE NFSe []>'+xml()),cnpj));assert.throws(()=>lerNotaRecebidaAdn({...item(),ChaveAcesso:'4'.repeat(50)},cnpj));
 assert.equal(caminhoAdn(cnpj,0),'/DFe/0?cnpjConsulta='+cnpj+'&lote=true');assert.throws(()=>caminhoAdn(cnpj,-1));
});
test('lote distingue término confirmado, rejeição e eventos sem inventar lista vazia nem avançar cursor inválido',()=>{
 const r=lerLoteAdn({httpStatus:200,data:{StatusProcessamento:'DOCUMENTOS_LOCALIZADOS',LoteDFe:[item(),{NSU:2,TipoDocumento:'EVENTO',ChaveAcesso:chave,TipoEvento:'CANCELAMENTO'}]}},cnpj,0);assert.equal(r.notas.length,1);assert.equal(r.nsu,2);assert.equal(r.eventos[0].situacao,'cancelada');
 assert.equal(lerLoteAdn({httpStatus:404,data:{StatusProcessamento:'NENHUM_DOCUMENTO_LOCALIZADO'}},cnpj,2).fim,true);
 for(const data of [{StatusProcessamento:'REJEICAO',LoteDFe:[]},{LoteDFe:[]},{LoteDFe:[{NSU:3,TipoDocumento:'DESCONHECIDO'}]}])assert.throws(()=>lerLoteAdn({httpStatus:200,data},cnpj,2));
 assert.throws(()=>lerLoteAdn({httpStatus:429,data:{}},cnpj,0),/limitou/);
});
test('gerar conta exige documento cacheado no mesmo tenant e consulta atual dos eventos; erro ou cancelamento bloqueia',async()=>{
 let sql='',chamadas=0;const db={$queryRaw:async(q:any)=>{sql=q.text;return [{dados:lerNotaRecebidaAdn(item(),cnpj)}];}};
 const semEventos=async(_e:any,p:string)=>{chamadas++;assert.equal(p,'/NFSe/'+chave+'/Eventos');return {httpStatus:200,data:[]};};
 const n=await conferirRecebidaAdn(db,empresa,chave,1,semEventos);assert.equal(n.situacao,'autorizada');assert.match(sql,/"empresaId"/);assert.equal(chamadas,1);
 await assert.rejects(conferirRecebidaAdn(db,empresa,chave,1,async()=>({httpStatus:200,data:[{TipoEvento:'CANCELAMENTO'}]})),/confirmar ausência/);
 await assert.rejects(conferirRecebidaAdn({$queryRaw:async()=>[]},empresa,chave,1,semEventos),/não encontrado/);assert.equal(chamadas,1);
});
test('consulta respeita lease/cooldown persistido e usa somente dados da emissora; sem emissão nem criação financeira',async()=>{
 const writes:any[]=[],queries:any[]=[];let rede=0;
 const db:any={$executeRaw:async(q:any)=>{writes.push(q);return 1;},$queryRaw:async(q:any)=>{queries.push(q);if(q.text.includes('RETURNING nsu'))return [];if(q.text.includes('COUNT(*)'))return [{total:1}];if(q.text.includes('SELECT nsu'))return [{nsu:1,proximaConsulta:new Date(Date.now()+3600000)}];return [{dados:lerNotaRecebidaAdn(item(),cnpj)}];}};
 const r=await consultarRecebidasAdn(db,empresa,0,async()=>{rede++;throw Error('Não deve consultar durante cooldown');});assert.equal(rede,0);assert.equal(r.documentos.length,1);assert.equal(r.fonte,'PORTAL_NACIONAL');assert.equal(r.temMais,false);assert.doesNotMatch(writes.map(q=>q.text||q.strings).join(' '),/LancamentoFinanceiro|NotaFiscal/);
 const tx:any={$executeRaw:async(q:any)=>{writes.push(q);return 1;}};db.$transaction=async(fn:any)=>fn(tx);const antigo=db.$queryRaw;db.$queryRaw=async(q:any)=>q.text.includes('RETURNING nsu')?[{nsu:0n}]:antigo(q);
 await consultarRecebidasAdn(db,empresa,0,async(_e:any,p:string)=>{rede++;assert.equal(p,caminhoAdn(cnpj,0));return {httpStatus:200,data:{LoteDFe:[item()]}};});assert.equal(rede,1);assert.ok(writes.some(q=>q.text?.includes('INSERT INTO "DocumentoRecebidoSba"')));
});
