import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/prisma';
import {conferirNotaFiscal} from '../src/services/fiscalValidacao.service';
import {buildFocusPayload,consultarNaFocus,parseFocusResult} from '../src/services/focusNfe.service';
import {emitirNota,aplicarRetorno,validarVinculosNota} from '../src/controller/ctfiscal';
const base=()=>({notafiscalid:1,empresaId:7,status:'RASCUNHO',referencia:'NF-TESTE',tipo:'NFE',valorTotal:100,valorProdutos:100,valorServicos:0,empresaFiscal:{ambiente:'PRODUCAO',ativo:true,cnpj:'12345678901234',razaoSocial:'Empresa',codigoMunicipioIbge:'3537107',regimeTributario:1,inscricaoEstadual:'123456789',endereco:'Rua',numero:'1',bairro:'Centro',estado:'SP',naturezaOperacaoNfe:'Venda',tokenProducao:'token-teste',tokenHomologacao:'teste-homolog'},destinatarioNome:'Cliente',destinatarioCnpj:'98765432109876',destinatarioCodigoMunicipio:'3537107',itens:[{descricao:'Produto',quantidade:1,valorUnitario:100,valorBruto:100,ncm:'73089010',cfop:'5102',icmsSituacaoTributaria:'102',pisSituacaoTributaria:'49',cofinsSituacaoTributaria:'49'}]});
const res=()=>{const r:any={code:200,status(n:number){r.code=n;return r;},json(d:any){r.body=d;return r;}};return r;};
test('Conferência fiscal verifica NCM, CFOP, token e valores, sem expor credenciais',()=>{
 assert.equal(conferirNotaFiscal(base()).podeEmitir,true);
 const n=base();n.itens[0].ncm='';n.valorTotal=99;n.empresaFiscal.tokenProducao='';const c=conferirNotaFiscal(n);assert.equal(c.podeEmitir,false);assert.ok(c.erros.some(e=>e.includes('NCM')));assert.ok(c.erros.some(e=>e.includes('total')));assert.ok(!JSON.stringify(c).includes('token-teste'));
});
test('NFS-e Nacional distingue CNAE e ISS, com retenção e apuração do Simples',()=>{
 const n:any={...base(),tipo:'NFSE',valorProdutos:0,valorServicos:100,issRetido:true,empresaFiscal:{...base().empresaFiscal,padraoNfse:'NACIONAL',itemListaServicoPadrao:'070701',regimeApuracaoSimples:2,optanteSimplesNacional:true}};
 const p=buildFocusPayload(n);assert.equal(p.tipo_retencao_iss,2);assert.equal(p.regime_tributario_simples_nacional,2);assert.equal(conferirNotaFiscal(n).podeEmitir,true);
 n.empresaFiscal.itemListaServicoPadrao='';n.empresaFiscal.cnae='2512800';assert.ok(conferirNotaFiscal(n).erros.some(e=>e.includes('CNAE')));
});
test('Consulta usa ambiente original mesmo após alterar a empresa emissora',async()=>{
 const original=global.fetch;global.fetch=(async(url:any,options:any)=>{assert.ok(String(url).startsWith('https://homologacao.focusnfe.com.br/'));assert.equal(options.headers.Authorization,'Basic '+Buffer.from('teste-homolog:').toString('base64'));return {ok:true,status:200,text:async()=>'{"status":"autorizado"}'};}) as any;
 try{await consultarNaFocus({...base(),ambienteEmissao:'HOMOLOGACAO'});}finally{global.fetch=original;}
});
test('Envios simultâneos usam um único POST e falha de rede conserva PROCESSANDO',async()=>{
 const original={find:prisma.notaFiscal.findFirst,update:prisma.notaFiscal.updateMany,event:prisma.eventoNotaFiscal.create,fetch:global.fetch};let estado:any=base(),posts=0;
 (prisma.notaFiscal as any).findFirst=async()=>({...estado});
 (prisma.notaFiscal as any).updateMany=async({where,data}:any)=>{assert.equal(where.empresaId,7);if(where.status?.in&&!where.status.in.includes(estado.status))return {count:0};if(typeof where.status==='string'&&estado.status!==where.status)return {count:0};Object.assign(estado,data);return {count:1};};
 (prisma.eventoNotaFiscal as any).create=async()=>({});global.fetch=(async()=>{posts++;throw Error('Timeout de teste');}) as any;
 try{const a=res(),b=res();await Promise.all([emitirNota({params:{id:'1'},empresaId:7} as any,a),emitirNota({params:{id:'1'},empresaId:7} as any,b)]);assert.equal(posts,1);assert.equal(estado.status,'PROCESSANDO');assert.ok([a.code,b.code].includes(409));}finally{prisma.notaFiscal.findFirst=original.find;prisma.notaFiscal.updateMany=original.update;prisma.eventoNotaFiscal.create=original.event;global.fetch=original.fetch;}
});
test('Homologação autorizada não fatura proposta; produção independe do perfil',async()=>{
 const original={update:prisma.notaFiscal.update,empresa:prisma.empresa.findUnique,transaction:prisma.$transaction};let calls=0;
 (prisma.notaFiscal as any).update=async()=>({propostaId:8,empresaId:7,ambienteEmissao:'HOMOLOGACAO',empresaFiscal:{ambiente:'PRODUCAO'}});(prisma as any).$transaction=async()=>{calls++;};
 try{await aplicarRetorno(1,'https://example.test',{status:'autorizado'});assert.equal(calls,0);
  (prisma.notaFiscal as any).update=async()=>({propostaId:8,empresaId:7,ambienteEmissao:'PRODUCAO',empresaFiscal:{ambiente:'PRODUCAO'}});
  for(const perfil of ['PADRAO','PERSONALIZADO','SBA']){(prisma.empresa as any).findUnique=async()=>({configuracaoSistema:{perfil}});await aplicarRetorno(1,'https://example.test',{status:'autorizado'});}assert.equal(calls,3);
 }finally{prisma.notaFiscal.update=original.update;prisma.empresa.findUnique=original.empresa;prisma.$transaction=original.transaction;}
});
test('Uma falha financeira posterior não troca AUTORIZADA por ERRO',async()=>{
 const original={find:prisma.notaFiscal.findFirst,many:prisma.notaFiscal.updateMany,update:prisma.notaFiscal.update,empresa:prisma.empresa.findUnique,transaction:prisma.$transaction,event:prisma.eventoNotaFiscal.create,fetch:global.fetch};let estado:any={...base(),propostaId:8};
 (prisma.notaFiscal as any).findFirst=async()=>({...estado});(prisma.notaFiscal as any).updateMany=async({where,data}:any)=>{if(typeof where.status==='string'&&where.status!==estado.status)return {count:0};Object.assign(estado,data);return {count:1};};(prisma.notaFiscal as any).update=async({data}:any)=>{Object.assign(estado,data);return estado;};(prisma.empresa as any).findUnique=async()=>({configuracaoSistema:{perfil:'PADRAO'}});(prisma as any).$transaction=async()=>{throw Error('Falha financeira de teste');};(prisma.eventoNotaFiscal as any).create=async()=>({});global.fetch=(async()=>({ok:true,status:200,text:async()=>'{"status":"autorizado"}'})) as any;
 try{await emitirNota({params:{id:'1'},empresaId:7} as any,res());assert.equal(estado.status,'AUTORIZADA');}finally{prisma.notaFiscal.findFirst=original.find;prisma.notaFiscal.updateMany=original.many;prisma.notaFiscal.update=original.update;prisma.empresa.findUnique=original.empresa;prisma.$transaction=original.transaction;prisma.eventoNotaFiscal.create=original.event;global.fetch=original.fetch;}
});
test('Vínculos fiscais não aceitam emissor ou proposta de outra empresa/cliente',async()=>{
 const original={empresa:prisma.empresaFiscal.findFirst,proposta:prisma.proposta.findFirst};(prisma.empresaFiscal as any).findFirst=async({where}:any)=>{assert.equal(where.empresaId,7);return {empresafiscalid:1};};(prisma.proposta as any).findFirst=async({where}:any)=>{assert.deepEqual(where,{propostaid:9,empresaId:7,clienteId:3});return null;};try{await assert.rejects(validarVinculosNota({empresaFiscalId:1,propostaId:9},7,3),/Proposta não encontrada/);}finally{prisma.empresaFiscal.findFirst=original.empresa;prisma.proposta.findFirst=original.proposta;}
});

test('Erro de cancelamento não altera uma nota autorizada para rejeitada',()=>{
 assert.equal(parseFocusResult('https://example.test',{status:'erro_cancelamento'}).status,'AUTORIZADA');
 assert.equal(parseFocusResult('https://example.test',{status:'erro_autorizacao'}).status,'REJEITADA');
});
