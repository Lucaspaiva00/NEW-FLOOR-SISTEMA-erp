import {sincronizarFinanceiroNota} from './fiscalFinanceiro.service';
import {Prisma} from '@prisma/client';
import {gzipSync} from 'node:zlib';
import {lerNotaRecebidaAdn} from './recebidasAdnSba.service';
import {consultarNaFocus,parseFocusResult} from './focusNfe.service';
const erro=(m:string,statusCode=422)=>Object.assign(Error(m),{statusCode});
const dig=(v:any)=>String(v||'').replace(/\D/g,'');
function validarEmpresa(e:any){if(e?.empresaId!==1||e.provedor!=='FOCUS_NFE'||!e.tokenProducao||!/^\d{14}$/.test(dig(e.cnpj)))throw erro('Confira o token de produção da integração Focus desta empresa.');}
export async function lerFocusProducao(e:any,path:string,xml=false,fetcher:typeof fetch=fetch){
 validarEmpresa(e);if(!/^\/v2\/nfsens_recebidas(?:\?cnpj=\d{14}(?:&versao=\d{1,15})?|\/\d{50}\.(?:xml|json))$/.test(path))throw erro('Consulta Focus não permitida.');
 if(path.includes('?cnpj=')&&new URL('https://api.focusnfe.com.br'+path).searchParams.get('cnpj')!==dig(e.cnpj))throw erro('Consulta restrita ao CNPJ desta empresa.');
 const r=await fetcher('https://api.focusnfe.com.br'+path,{method:'GET',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Basic '+Buffer.from(e.tokenProducao+':').toString('base64'),Accept:xml?'application/xml':'application/json'}});
 if(!r.ok){let detalhe='';try{const d=await r.json() as any;detalhe=[d.codigo,d.mensagem].filter(v=>typeof v==='string').join(' — ').replaceAll(String(e.tokenProducao),'[credencial]').replace(/https?:\/\/\S+/g,'[endereço]').replace(/\b\d{11,50}\b/g,'[documento]').slice(0,220);}catch{}throw erro('A Focus não disponibilizou a consulta de recebidas (HTTP '+r.status+'). '+(detalhe?detalhe+' ':'')+'Confira a habilitação do produto de recebidas para este CNPJ na Focus. A emissão e as notas já salvas permanecem disponíveis.',r.status===429?429:502);}

 const chunks:Uint8Array[]=[];let size=0;for await(const chunk of r.body as any){size+=chunk.length;if(size>8000000)throw erro('Retorno Focus excedeu o limite de leitura.',502);chunks.push(chunk);}const text=Buffer.concat(chunks).toString('utf8');
 if(xml)return {data:text,maxVersao:0};let data;try{data=JSON.parse(text);}catch{throw erro('Retorno inválido da Focus.',502);}return {data,maxVersao:Number(r.headers.get('X-Max-Version')||0)};
}
export async function salvarEmitidasFocus(db:any,e:any){
 const notas=await db.notaFiscal.findMany({where:{empresaId:e.empresaId,empresaFiscalId:e.empresafiscalid,tipo:'NFSE',status:{in:['AUTORIZADA','CANCELADA']}},include:{empresaFiscal:{select:{ambiente:true}}}});
 for(const n of notas){const chave=n.chave||String(n.caminhoXml||n.retornoProvedor?.caminho_xml_nota_fiscal||'').match(/(?:^|\/)NFS(\d{50})-nfse\.xml$/i)?.[1];if((n.ambienteEmissao||n.empresaFiscal.ambiente)!=='PRODUCAO'||!/^\d{50}$/.test(chave||''))continue;
 const dados={tipo:'NFSE_NACIONAL',chave,versao:n.notafiscalid,direcao:'EMITIDA',fonte:'FOCUS_ERP',notaFiscalId:n.notafiscalid,numero:n.numero,documentoEmissor:dig(e.cnpj),emissor:e.razaoSocial||'New Floor',tomador:n.destinatarioNome,documentoTomador:dig(n.destinatarioCnpj||n.destinatarioCpf),cnpjTomador:dig(n.destinatarioCnpj||n.destinatarioCpf),dataEmissao:(n.dataEmissao||n.dataAutorizacao||n.createdAt).toISOString(),valor:Number(n.valorTotal),valorLiquido:Number(n.valorTotal)-Number(n.valorRetencoes||0),situacao:n.status==='CANCELADA'?'cancelada':'autorizada'};
 await db.$executeRaw(Prisma.sql`INSERT INTO "DocumentoRecebidoSba" ("empresaId","empresaFiscalId",chave,nsu,dados) VALUES (${e.empresaId},${e.empresafiscalid},${chave},${n.notafiscalid},${JSON.stringify(dados)}::jsonb) ON CONFLICT ("empresaFiscalId",chave) DO UPDATE SET dados="DocumentoRecebidoSba".dados || EXCLUDED.dados`);
 }
}
export async function sincronizarRecebidasFocus(db:any,e:any,ler=lerFocusProducao){
 validarEmpresa(e);await salvarEmitidasFocus(db,e);
 await db.$executeRaw`INSERT INTO "SincronizacaoRecebidasFocus" ("empresaId","empresaFiscalId") VALUES (${e.empresaId},${e.empresafiscalid}) ON CONFLICT ("empresaFiscalId") DO NOTHING`;
 const rows=await db.$queryRaw(Prisma.sql`SELECT versao FROM "SincronizacaoRecebidasFocus" WHERE "empresaId"=${e.empresaId} AND "empresaFiscalId"=${e.empresafiscalid}`),versao=Number(rows[0]?.versao||0);
 let consulta;try{consulta=await ler(e,'/v2/nfsens_recebidas?cnpj='+dig(e.cnpj)+(versao?'&versao='+versao:''));}catch(ex:any){return {continuar:false,aviso:ex.message,fonte:'FOCUS',falhaRecebidas:true};}
 if(!Array.isArray(consulta.data))throw erro('A Focus não retornou uma lista de notas recebidas válida.',502);
 const itens=consulta.data.filter((n:any)=>Number(n.versao)>versao).sort((a:any,b:any)=>Number(a.versao)-Number(b.versao)).slice(0,3);let ultimo=versao;
 for(const item of itens){const chave=String(item.chave_nfse||item.chave||''),v=Number(item.versao);if(!/^\d{50}$/.test(chave)||!Number.isSafeInteger(v)||v<=ultimo)throw erro('Chave ou versão inválida retornada pela Focus.',502);
 const xml=await ler(e,'/v2/nfsens_recebidas/'+chave+'.xml',true),arquivo=gzipSync(Buffer.from(xml.data)).toString('base64'),n=lerNotaRecebidaAdn({NSU:v,ChaveAcesso:chave,ArquivoXml:arquivo},dig(e.cnpj));
 if(!n)throw erro('A nota recebida da Focus não pertence ao CNPJ desta empresa.',502);
 const status=String(item.status||item.situacao||'').toLowerCase();n.situacao=status.includes('cancel')||item.cancelamento?'cancelada':status.includes('substit')?'substituida':'recebida';const dados={...n,fonte:'FOCUS_RECEBIDA'};
 await db.$transaction(async(tx:any)=>{await tx.$executeRaw(Prisma.sql`INSERT INTO "DocumentoRecebidoSba" ("empresaId","empresaFiscalId",chave,nsu,dados,"xmlCompactado") VALUES (${e.empresaId},${e.empresafiscalid},${chave},${v},${JSON.stringify(dados)}::jsonb,${arquivo}) ON CONFLICT ("empresaFiscalId",chave) DO UPDATE SET dados="DocumentoRecebidoSba".dados || EXCLUDED.dados,"xmlCompactado"=EXCLUDED."xmlCompactado",nsu=EXCLUDED.nsu`);await tx.$executeRaw(Prisma.sql`UPDATE "SincronizacaoRecebidasFocus" SET versao=GREATEST(versao,${v}) WHERE "empresaId"=${e.empresaId} AND "empresaFiscalId"=${e.empresafiscalid}`);});ultimo=v;
 }
 return {continuar:itens.length>0&&(consulta.data.length>itens.length||consulta.data.length===100),fonte:'FOCUS',aviso:'Notas emitidas pelo ERP e recebidas disponíveis na Focus salvas. O histórico de emitidas fora da integração não é listado por esta API. Recebidas podem ser conciliadas no financeiro.'};
}
export async function conferirSituacaoFocus(db:any,e:any,n:any,ler=lerFocusProducao){
 validarEmpresa(e);
 if(n.direcao==='EMITIDA'){
  const nota=await db.notaFiscal.findFirst({where:{empresaId:e.empresaId,empresaFiscalId:e.empresafiscalid,tipo:'NFSE',OR:[{chave:n.chave},...(n.notaFiscalId?[{notafiscalid:Number(n.notaFiscalId)}]:[])]},include:{empresaFiscal:true}});
  if(!nota||nota.status!=='AUTORIZADA'||(nota.ambienteEmissao||nota.empresaFiscal.ambiente)!=='PRODUCAO')return false;
  const r=await consultarNaFocus(nota),p=parseFocusResult(r.baseUrl,r.data);return p.status==='AUTORIZADA'&&(!p.chave||p.chave===n.chave);
 }
 const r=await ler(e,'/v2/nfsens_recebidas/'+n.chave+'.json');const d=r.data,status=String(d?.situacao||d?.status||'').toLowerCase();return ['autorizada','autorizado'].includes(status)&&!d.cancelamento&&(!d.chave_nfse||d.chave_nfse===n.chave);
}

export async function sincronizarFinanceiroEmitidaFocus(db:any,e:any,n:any){
 if(!await conferirSituacaoFocus(db,e,n))throw erro('Confira a situação atual desta nota emitida na Focus antes de gerar cobrança.');
 const nota=await db.notaFiscal.findFirst({where:{empresaId:e.empresaId,empresaFiscalId:e.empresafiscalid,notafiscalid:Number(n.notaFiscalId),status:'AUTORIZADA'},include:{empresaFiscal:true}});
 if(!nota)throw erro('Nota emitida não encontrada nesta empresa.');
 await db.$transaction((tx:any)=>sincronizarFinanceiroNota(nota,tx));
}
