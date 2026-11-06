import {request} from 'node:https';
import {randomUUID} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {DOMParser} from '@xmldom/xmldom';
import {Prisma} from '@prisma/client';
import {situacaoEventosAdn} from './situacaoEventosAdn.service';
import {comA1ConsultaNacional} from './sefinTransmissaoSba.service';
const NS='http://www.sped.fazenda.gov.br/nfse';
const falha=(message:string,statusCode=422)=>Object.assign(Error(message),{statusCode});
export const validarNsu=(v:any)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<0||!/^\d{1,15}$/.test(String(v)))throw falha('NSU da consulta inválido.');return n;};
export function caminhoAdn(cnpj:string,nsu:number){if(!/^\d{14}$/.test(cnpj))throw falha('CNPJ destinatário inválido.');return '/DFe/'+validarNsu(nsu)+'?cnpjConsulta='+cnpj+'&lote=true';}
export async function solicitarAdnSba(empresa:any,path:string){
 if(!(/^\/DFe\/\d{1,15}\?cnpjConsulta=\d{14}&lote=true$/.test(path)||/^\/NFSe\/\d{50}\/Eventos$/.test(path)))throw falha('Consulta ADN não permitida.');
 return comA1ConsultaNacional(empresa,(pfx,senha)=>new Promise<{httpStatus:number,data:any}>((resolve,reject)=>{
  const req=request('https://adn.nfse.gov.br/contribuintes'+path,{method:'GET',pfx,passphrase:senha,minVersion:'TLSv1.2',rejectUnauthorized:true,headers:{Accept:'application/json'}},res=>{
   const chunks:Buffer[]=[];let tamanho=0;res.on('data',b=>{tamanho+=b.length;if(tamanho>8_000_000){req.destroy(falha('Retorno do Portal Nacional excedeu o limite de leitura.',502));return;}chunks.push(b);});
   res.on('error',()=>reject(falha('Consulta interrompida pelo Portal Nacional. Tente novamente mais tarde.',502)));
   res.on('end',()=>{try{resolve({httpStatus:res.statusCode||502,data:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}catch{reject(falha('Portal Nacional indisponível ou sem resposta válida. Tente novamente mais tarde.',502));}});
  });const timer=setTimeout(()=>req.destroy(falha('O Portal Nacional não respondeu no prazo. Tente novamente mais tarde.',504)),20000);req.on('close',()=>clearTimeout(timer));req.on('error',()=>reject(falha('Não foi possível consultar o Portal Nacional com o A1 desta empresa. Confira a validade do certificado e tente novamente mais tarde.',502)));req.end();
 }));
}
function xmlDocumento(arquivo:any){
 if(typeof arquivo!=='string'||arquivo.length>6_000_000||!/^[A-Za-z0-9+/=\r\n]+$/.test(arquivo))throw falha('Documento recebido do ADN tem formato inválido.',502);
 let xml:string;try{xml=gunzipSync(Buffer.from(arquivo,'base64'),{maxOutputLength:4_000_000}).toString('utf8');}catch{throw falha('Não foi possível ler o documento recebido do ADN.',502);}
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw falha('XML recebido inválido.',502);
 return new DOMParser({onError:()=>{throw falha('XML recebido inválido.',502);}}).parseFromString(xml,'application/xml');
}
export function lerNotaRecebidaAdn(item:any,cnpj:string,incluirEmitidas=false){
 const nsu=validarNsu(item.NSU);const doc=xmlDocumento(item.ArquivoXml);
 const nodes=(parent:any,nome:string)=>parent.getElementsByTagNameNS(NS,nome),text=(parent:any,nome:string)=>String(nodes(parent,nome)[0]?.textContent||'').trim();
 if(doc.documentElement?.localName!=='NFSe'||doc.documentElement.namespaceURI!==NS||nodes(doc,'infNFSe').length!==1||nodes(doc,'infDPS').length!==1||text(doc,'tpAmb')!=='1')throw falha('O ADN retornou um documento fora do padrão nacional de produção.',502);
 const inf=nodes(doc,'infNFSe')[0],chave=String(inf.getAttribute('Id')||'').replace(/^NFS/,'');
 if(!/^\d{50}$/.test(chave)||(item.ChaveAcesso&&item.ChaveAcesso!==chave))throw falha('Chave do documento recebido não confere.',502);
 const toma=nodes(doc,'toma'),destinatario=toma[0];const cnpjTomador=destinatario?text(destinatario,'CNPJ')||text(destinatario,'CPF'):'';
 const emit=nodes(doc,'emit')[0]||nodes(doc,'prest')[0],documentoEmissor=emit?text(emit,'CNPJ')||text(emit,'CPF'):'';
 const direcao=documentoEmissor===cnpj?'EMITIDA':'RECEBIDA';if(direcao==='EMITIDA'?!incluirEmitidas:cnpjTomador!==cnpj)return null;
 const valor=Number(text(doc,'vServ'));if(!Number.isFinite(valor)||valor<=0||valor>=1e12)throw falha('Valor inválido no documento recebido.',502);
 const dataEmissao=text(doc,'dhEmi');if(!Number.isFinite(Date.parse(dataEmissao)))throw falha('Data inválida no documento recebido.',502);
 if(!/^\d{11}(?:\d{3})?$/.test(documentoEmissor)||!/^\d+$/.test(text(doc,'nNFSe')))throw falha('Identificação do emitente ou número da NFS-e inválido.',502);
 const liquidoTexto=text(doc,'vLiq'),valorLiquido=liquidoTexto===''?null:Number(liquidoTexto);if(valorLiquido!==null&&(!Number.isFinite(valorLiquido)||valorLiquido<0||valorLiquido>valor))throw falha('Valor líquido inválido no documento recebido.',502);
 return {tipo:'NFSE_NACIONAL',chave,versao:nsu,direcao,valorLiquido,cnpjTomador,tomador:destinatario?text(destinatario,'xNome')||'Tomador não identificado':'Tomador não identificado',documentoTomador:cnpjTomador,emissor:(emit?text(emit,'xNome'):'')||'Fornecedor',documentoEmissor,dataEmissao,valor:Math.round(valor*100)/100,situacao:'recebida',numero:text(doc,'nNFSe')};
}
export function lerLoteAdn(r:{httpStatus:number,data:any},cnpj:string,ultimoNsu:number,incluirEmitidas=false){
 const d=r.data||{},status=String(d.StatusProcessamento||'').replace(/_/g,'').toUpperCase();
 if(status==='NENHUMDOCUMENTOLOCALIZADO'&&[200,404].includes(r.httpStatus))return {notas:[],eventos:[],arquivos:{} as Record<string,string>,nsu:ultimoNsu,fim:true};
 if(r.httpStatus===429)throw falha('O Portal Nacional limitou as consultas. Aguarde antes de consultar novamente.',429);
 if(r.httpStatus<200||r.httpStatus>=300||status.includes('REJEI')||!Array.isArray(d.LoteDFe))throw falha('O Portal Nacional não autorizou ou não concluiu a distribuição de NFS-e (HTTP '+r.httpStatus+'). Nenhuma nota foi marcada como recebida.',502);
 if(d.LoteDFe.length>200)throw falha('Lote ADN excedeu o limite de leitura.',502);
 if(!d.LoteDFe.length)throw falha('O Portal Nacional retornou uma distribuição sem confirmação de término. Tente novamente mais tarde.',502);
 let nsu=ultimoNsu;const notas:any[]=[],eventos:any[]=[],arquivos:Record<string,string>={};
 for(const item of d.LoteDFe){const atual=validarNsu(item.NSU);if(atual<=ultimoNsu)continue;nsu=Math.max(nsu,atual);const tipo=String(item.TipoDocumento||'').toUpperCase();
  if(tipo==='NFSE'){const nota=lerNotaRecebidaAdn(item,cnpj,incluirEmitidas);if(nota){notas.push(nota);arquivos[nota.chave]=item.ArquivoXml;}}
  else if(tipo==='EVENTO'){if(!/^\d{50}$/.test(String(item.ChaveAcesso||'')))throw falha('Evento ADN com chave inválida.',502);const tipoEvento=String(item.TipoEvento||'').toUpperCase();if(!['202201','203202','204203','205204'].includes(tipoEvento))eventos.push({chave:item.ChaveAcesso,situacao:tipoEvento==='105102'||tipoEvento.includes('SUBSTIT')?'substituida':['101101','105104','305101'].includes(tipoEvento)||tipoEvento.includes('CANCEL')?'cancelada':'revisar_eventos'});}
  else throw falha('Tipo de documento ADN ainda não reconhecido. A consulta não avançou.',502);
 }
 if(nsu<=ultimoNsu)throw falha('O ADN não avançou o NSU da consulta. Aguarde para consultar novamente.',502);
 return {notas,eventos,arquivos,nsu,fim:false};
}
export async function consultarRecebidasAdn(db:any,empresa:any,versao=0,solicitar=solicitarAdnSba){
 validarNsu(versao);const id=empresa.empresafiscalid,tenant=empresa.empresaId,token=randomUUID();
 await db.$executeRaw`INSERT INTO "SincronizacaoRecebidasSba" ("empresaFiscalId","empresaId","versaoAcervo") VALUES (${id},${tenant},1) ON CONFLICT ("empresaFiscalId") DO NOTHING`;
 const lease=await db.$queryRaw(Prisma.sql`UPDATE "SincronizacaoRecebidasSba" SET "leaseToken"=${token},"leaseAte"=CURRENT_TIMESTAMP+INTERVAL '60 seconds' WHERE "empresaFiscalId"=${id} AND "empresaId"=${tenant} AND ("leaseAte" IS NULL OR "leaseAte"<CURRENT_TIMESTAMP) AND ("proximaConsulta" IS NULL OR "proximaConsulta"<=CURRENT_TIMESTAMP) RETURNING nsu`);
 if(lease.length){try{
  const ultimo=Number(lease[0].nsu),lote=lerLoteAdn(await solicitar(empresa,caminhoAdn(String(empresa.cnpj).replace(/\D/g,''),ultimo)),String(empresa.cnpj).replace(/\D/g,''),ultimo,true);
  await db.$transaction(async(tx:any)=>{
   for(const n of lote.notas)await tx.$executeRaw(Prisma.sql`INSERT INTO "DocumentoRecebidoSba" ("empresaId","empresaFiscalId",chave,nsu,dados,"xmlCompactado") VALUES (${tenant},${id},${n.chave},${n.versao},${JSON.stringify(n)}::jsonb,${lote.arquivos[n.chave]}) ON CONFLICT ("empresaFiscalId",chave) DO UPDATE SET "xmlCompactado"=EXCLUDED."xmlCompactado",dados="DocumentoRecebidoSba".dados || jsonb_build_object('valorLiquido',EXCLUDED.dados->'valorLiquido')`);
   for(const e of lote.eventos)await tx.$executeRaw(Prisma.sql`UPDATE "DocumentoRecebidoSba" SET dados=jsonb_set(dados,'{situacao}',${JSON.stringify(e.situacao)}::jsonb) WHERE "empresaId"=${tenant} AND "empresaFiscalId"=${id} AND chave=${e.chave}`);
   await tx.$executeRaw(Prisma.sql`UPDATE "SincronizacaoRecebidasSba" SET nsu=${lote.nsu},"proximaConsulta"=CURRENT_TIMESTAMP+${lote.fim?'60 minutes':'1 second'}::interval,"leaseAte"=NULL,"leaseToken"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "empresaFiscalId"=${id} AND "empresaId"=${tenant} AND "leaseToken"=${token}`);
  });
 }catch(e:any){await db.$executeRaw(Prisma.sql`UPDATE "SincronizacaoRecebidasSba" SET "leaseAte"=NULL,"leaseToken"=NULL,"proximaConsulta"=CURRENT_TIMESTAMP+${e?.statusCode===429?'60 minutes':'1 minute'}::interval WHERE "empresaFiscalId"=${id} AND "empresaId"=${tenant} AND "leaseToken"=${token}`);throw e;}}
 const [rows,total,sync]=await Promise.all([
  db.$queryRaw(Prisma.sql`SELECT dados FROM "DocumentoRecebidoSba" WHERE "empresaId"=${tenant} AND "empresaFiscalId"=${id} AND nsu>${versao} ORDER BY nsu LIMIT 50`),
  db.$queryRaw(Prisma.sql`SELECT COUNT(*)::integer AS total FROM "DocumentoRecebidoSba" WHERE "empresaId"=${tenant} AND "empresaFiscalId"=${id}`),
  db.$queryRaw(Prisma.sql`SELECT nsu,"proximaConsulta","leaseAte" FROM "SincronizacaoRecebidasSba" WHERE "empresaId"=${tenant} AND "empresaFiscalId"=${id}`)
 ]);
 const documentos=rows.map((r:any)=>r.dados),proximaVersao=Math.max(versao,...documentos.map((n:any)=>n.versao)),meta=sync[0];
 const aguardando=meta?.proximaConsulta&&+new Date(meta.proximaConsulta)>Date.now()+5000;
 return {documentos,proximaVersao,total:Number(total[0]?.total||0),temMais:documentos.length===50||!aguardando,fonte:'PORTAL_NACIONAL',aviso:'NFS-e emitidas e recebidas pelo Portal Nacional (ADN), em produção, com o A1 desta empresa. '+(aguardando?'Exibindo documentos já consultados; próxima atualização a partir de '+new Date(meta.proximaConsulta).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+'. ':'Use Próximos documentos para continuar a consulta. ')+'A consulta não gera pagamentos. A situação fiscal será conferida antes de criar uma conta a pagar.'};
}
export async function conferirRecebidaAdn(db:any,empresa:any,chave:string,versao:number,solicitar=solicitarAdnSba){
 const rows=await db.$queryRaw(Prisma.sql`SELECT dados FROM "DocumentoRecebidoSba" WHERE "empresaId"=${empresa.empresaId} AND "empresaFiscalId"=${empresa.empresafiscalid} AND chave=${chave} AND nsu=${validarNsu(versao)}`);const n=rows[0]?.dados;
 if(!n||n.cnpjTomador!==String(empresa.cnpj).replace(/\D/g,''))throw falha('Documento não encontrado na consulta desta empresa.',404);
 if(n.situacao!=='recebida')throw falha('Documento com evento fiscal. Confira cancelamentos ou substituições no Portal Nacional.');
 const r=await solicitar(empresa,'/NFSe/'+chave+'/Eventos');
 if(!situacaoEventosAdn(r,chave))throw falha('Não foi possível confirmar ausência de cancelamento ou substituição. Confira a nota no Portal Nacional antes de lançar a conta.');
 return {...n,situacao:'autorizada'};
}
