import {Prisma} from '@prisma/client';
const DIA=86400000;
export function filtrosNegocios(q:any){
 const empresaId=q.empresaId==null||q.empresaId===''?null:Number(q.empresaId);
 const pagina=q.pagina==null?1:Number(q.pagina);
 if(empresaId!==null&&(!Number.isSafeInteger(empresaId)||empresaId<=0||empresaId>2147483647)||!Number.isSafeInteger(pagina)||pagina<1||pagina>100000)throw Error('Filtro inválido.');
 const date=(v:any)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))throw Error('Data inválida.');const utc=new Date(v+'T00:00:00Z');if(!Number.isFinite(+utc)||utc.toISOString().slice(0,10)!==v||utc.getUTCFullYear()<2000||utc.getUTCFullYear()>2100)throw Error('Data inválida.');return new Date(v+'T00:00:00-03:00');};
 if(!!q.inicio!==!!q.fim)throw Error('Informe início e fim do período.');
 const inicio=q.inicio?date(q.inicio):null,fim=q.fim?new Date(+date(q.fim)+DIA):null;
 if(inicio&&fim&&inicio>=fim)throw Error('O início deve ser anterior ou igual ao fim.');
 return {empresaId,pagina,inicio,fim};
}
type Filtro=ReturnType<typeof filtrosNegocios>;
const tenant=(alias:string,f:Filtro)=>f.empresaId?Prisma.sql`AND ${Prisma.raw(alias+'."empresaId"')}=${f.empresaId}`:Prisma.empty;
const periodo=(col:string,f:Filtro)=>f.inicio?Prisma.sql`AND ${Prisma.raw(col)}>=${f.inicio} AND ${Prisma.raw(col)}<${f.fim}`:Prisma.empty;
// Não se presume que um nome de telefone e um nome de e-mail sejam a mesma pessoa.
// Cada canal é deduplicado por cliente. Os registros antigos continuam incluídos.
const canais=Prisma.sql`SELECT c."empresaId",c.clienteid,COALESCE(c."razaoSocial",c."nomeFantasia",'Cliente') AS cliente,
 x.tipo,x.valor FROM "Cliente" c CROSS JOIN LATERAL (
 SELECT 'email' AS tipo,lower(trim(e.valor)) AS valor FROM (
 SELECT unnest(ARRAY[c.email1,c.email2,c.email3,c.email4]) AS valor
 UNION ALL SELECT j->>'email' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c."contatosAdicionais")='array' THEN c."contatosAdicionais" ELSE '[]'::jsonb END) j
 ) e WHERE trim(COALESCE(e.valor,''))<>''
 UNION ALL
 SELECT 'telefone',regexp_replace(t.valor,'[^0-9]','','g') FROM (
 SELECT unnest(ARRAY[c.telefone1,c.telefone2,c.telefone3,c.telefone4]) AS valor
 UNION ALL SELECT j->>'telefone' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c."contatosAdicionais")='array' THEN c."contatosAdicionais" ELSE '[]'::jsonb END) j
 ) t WHERE regexp_replace(COALESCE(t.valor,''),'[^0-9]','','g')<>''
 ) x GROUP BY c."empresaId",c.clienteid,c."razaoSocial",c."nomeFantasia",x.tipo,x.valor`;
const custoConhecido=Prisma.sql`CASE WHEN jsonb_typeof(p."composicaoCustos"->'custoTotal')='number' THEN (p."composicaoCustos"->>'custoTotal')::numeric ELSE 0 END>0 AND jsonb_typeof(p."composicaoCustos"->'lucro')='number'`;
const lucro=Prisma.sql`CASE WHEN ${custoConhecido} THEN (p."composicaoCustos"->>'lucro')::numeric ELSE NULL END`;
function movimentos(f:Filtro){return Prisma.sql`
 SELECT pf.pagamentofinanceiroid AS id,l."empresaId",l.descricao,l.tipo,pf.valor,pf."dataPagamento" AS quando,'Pagamento' AS fonte
 FROM "PagamentoFinanceiro" pf JOIN "LancamentoFinanceiro" l ON l.lancamentofinanceiroid=pf."lancamentoId" AND l."empresaId"=pf."empresaId"
 WHERE pf."estornadoEm" IS NULL AND l.status<>'CANCELADO' ${tenant('l',f)} ${periodo('pf."dataPagamento"',f)}
 UNION ALL
 SELECT l.lancamentofinanceiroid,l."empresaId",l.descricao,l.tipo,l."valorPago",l."dataPagamento",'Baixa legada'
 FROM "LancamentoFinanceiro" l WHERE l.status<>'CANCELADO' AND l."valorPago">0 AND l."dataPagamento" IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM "PagamentoFinanceiro" pf WHERE pf."lancamentoId"=l.lancamentofinanceiroid)
 ${tenant('l',f)} ${periodo('l."dataPagamento"',f)}`;}
export function consolidarNegocios(empresas:any[],cadastros:any[],comercial:any[],saldos:any[],caixa:any[]){
 const nomes=['clientes','contatosEmail','telefones','orcamentos','valorOrcamentos','aprovadas','valorAprovadas','faturadas','valorFaturado','faturadasComCustos','semCustos','semDataFaturamento','aReceber','aPagar','recebido','pago'];
 const rows=empresas.map(e=>{const partes=[cadastros,comercial,saldos,caixa].map(xs=>xs.find(x=>x.empresaId===e.empresaid)||{}),r:any={empresaId:e.empresaid,nome:e.nome,ativo:e.ativo};for(const k of nomes)r[k]=Number(partes.find(p=>p[k]!=null)?.[k]||0);const valor=comercial.find(x=>x.empresaId===e.empresaid)?.lucroEstimado;r.lucroEstimado=valor==null?null:Number(valor);r.saldoCaixa=Math.round((r.recebido-r.pago)*100)/100;return r;});
 const total:any={};for(const k of nomes)total[k]=Math.round(rows.reduce((s,e)=>s+e[k],0)*100)/100;const comLucro=rows.filter(e=>e.lucroEstimado!=null);total.lucroEstimado=comLucro.length?Math.round(comLucro.reduce((s,e)=>s+e.lucroEstimado,0)*100)/100:null;total.saldoCaixa=Math.round((total.recebido-total.pago)*100)/100;return {empresas:rows,total};
}
export async function obterNegocios(db:any,f:Filtro){
 const [empresasDisponiveis,cadastros,comercial,saldos,caixa]=await Promise.all([
 db.empresa.findMany({select:{empresaid:true,nome:true,ativo:true},orderBy:{nome:'asc'}}),
 db.$queryRaw(Prisma.sql`WITH canais AS (${canais}),contatos AS (SELECT "empresaId",COUNT(*) FILTER(WHERE tipo='email')::integer AS "contatosEmail",COUNT(*) FILTER(WHERE tipo='telefone')::integer AS telefones FROM canais GROUP BY "empresaId") SELECT c."empresaId",COUNT(*)::integer AS clientes,COALESCE(MAX(t."contatosEmail"),0) AS "contatosEmail",COALESCE(MAX(t.telefones),0) AS telefones FROM "Cliente" c LEFT JOIN contatos t ON t."empresaId"=c."empresaId" WHERE true ${tenant('c',f)} GROUP BY c."empresaId"`),
 db.$queryRaw(Prisma.sql`SELECT p."empresaId",
 COUNT(*) FILTER(WHERE true ${periodo('p."createdAt"',f)})::integer AS orcamentos,
 COALESCE(SUM(p.subtotal+COALESCE(p.frete,0)) FILTER(WHERE true ${periodo('p."createdAt"',f)}),0) AS "valorOrcamentos",
 COUNT(*) FILTER(WHERE p.status IN ('APROVADA','EXECUTANDO','FATURADA') ${periodo('p."dataAprovacao"',f)})::integer AS aprovadas,
 COALESCE(SUM(p.subtotal+COALESCE(p.frete,0)) FILTER(WHERE p.status IN ('APROVADA','EXECUTANDO','FATURADA') ${periodo('p."dataAprovacao"',f)}),0) AS "valorAprovadas",
 COUNT(*) FILTER(WHERE p.status='FATURADA' ${periodo('p."dataFaturamento"',f)})::integer AS faturadas,
 COALESCE(SUM(p.subtotal+COALESCE(p.frete,0)) FILTER(WHERE p.status='FATURADA' ${periodo('p."dataFaturamento"',f)}),0) AS "valorFaturado",
 SUM(${lucro}) FILTER(WHERE p.status='FATURADA' ${periodo('p."dataFaturamento"',f)}) AS "lucroEstimado",
 COUNT(*) FILTER(WHERE p.status='FATURADA' AND (${lucro}) IS NOT NULL ${periodo('p."dataFaturamento"',f)})::integer AS "faturadasComCustos",
 COUNT(*) FILTER(WHERE p.status='FATURADA' AND (${lucro}) IS NULL ${periodo('p."dataFaturamento"',f)})::integer AS "semCustos",
 COUNT(*) FILTER(WHERE p.status='FATURADA' AND p."dataFaturamento" IS NULL)::integer AS "semDataFaturamento"
 FROM "Proposta" p WHERE true ${tenant('p',f)} GROUP BY p."empresaId"`),
 db.$queryRaw(Prisma.sql`SELECT l."empresaId",COALESCE(SUM(GREATEST(l.valor-l."valorPago",0)) FILTER(WHERE tipo='ENTRADA'),0) AS "aReceber",COALESCE(SUM(GREATEST(l.valor-l."valorPago",0)) FILTER(WHERE tipo='SAIDA'),0) AS "aPagar" FROM "LancamentoFinanceiro" l WHERE l.status='ABERTO' ${tenant('l',f)} GROUP BY l."empresaId"`),
 db.$queryRaw(Prisma.sql`WITH movimentos AS (${movimentos(f)}) SELECT "empresaId",COALESCE(SUM(valor) FILTER(WHERE tipo='ENTRADA'),0) AS recebido,COALESCE(SUM(valor) FILTER(WHERE tipo='SAIDA'),0) AS pago FROM movimentos GROUP BY "empresaId"`)
 ]);
 const empresas=empresasDisponiveis.filter((e:any)=>!f.empresaId||e.empresaid===f.empresaId);
 if(f.empresaId&&!empresas.length)throw Error('Empresa não encontrada.');
 return {...consolidarNegocios(empresas,cadastros,comercial,saldos,caixa),empresasDisponiveis,geradoEm:new Date(),filtros:{empresaId:f.empresaId,inicio:f.inicio,fimExclusivo:f.fim}};
}
export function baseDetalheNegocios(tipo:string,f:Filtro):Prisma.Sql{
 if(tipo==='clientes')return Prisma.sql`SELECT c.clienteid::text AS id,c."empresaId",COALESCE(c."razaoSocial",c."nomeFantasia",'Cliente') AS titulo,COALESCE(c.cidade,'') AS descricao,COALESCE(c."statusCliente",'Cadastrado') AS status,c."createdAt" AS quando,NULL::numeric AS valor FROM "Cliente" c WHERE true ${tenant('c',f)}`;
 if(tipo==='contatos')return Prisma.sql`WITH canais AS (${canais}) SELECT c.clienteid::text||':'||c.valor AS id,c."empresaId",c.cliente AS titulo,c.valor AS descricao,'E-mail' AS status,NULL::timestamp AS quando,NULL::numeric AS valor FROM canais c WHERE c.tipo='email' ${tenant('c',f)}`;
 if(['orcamentos','aprovadas','faturadas','lucro'].includes(tipo)){
  const col=tipo==='orcamentos'?'p."createdAt"':tipo==='aprovadas'?'p."dataAprovacao"':'p."dataFaturamento"';
  const status=tipo==='aprovadas'?Prisma.sql`AND p.status IN ('APROVADA','EXECUTANDO','FATURADA')`:tipo==='orcamentos'?Prisma.empty:Prisma.sql`AND p.status='FATURADA'`;
  return Prisma.sql`SELECT p.propostaid::text AS id,p."empresaId",'Orçamento '||p.numero AS titulo,p.titulo AS descricao,p.status::text AS status,${Prisma.raw(col)} AS quando,${tipo==='lucro'?lucro:Prisma.sql`p.subtotal+COALESCE(p.frete,0)`} AS valor FROM "Proposta" p WHERE true ${tenant('p',f)} ${status} ${periodo(col,f)} ${tipo==='lucro'?Prisma.sql`AND (${lucro}) IS NOT NULL`:Prisma.empty}`;
 }
 if(tipo==='recebido'||tipo==='pago')return Prisma.sql`WITH movimentos AS (${movimentos(f)}) SELECT fonte||':'||id AS id,"empresaId",descricao AS titulo,fonte AS descricao,tipo::text AS status,quando,valor FROM movimentos WHERE tipo=${tipo==='recebido'?'ENTRADA':'SAIDA'}`;
 if(tipo==='areceber')return Prisma.sql`SELECT l.lancamentofinanceiroid::text AS id,l."empresaId",l.descricao AS titulo,COALESCE(l.favorecido,'') AS descricao,l.status::text AS status,l."dataVencimento" AS quando,GREATEST(l.valor-l."valorPago",0) AS valor FROM "LancamentoFinanceiro" l WHERE l.tipo='ENTRADA' AND l.status='ABERTO' AND l.valor>l."valorPago" ${tenant('l',f)}`;
 throw Error('Indicador inválido.');
}
export async function detalhesNegocios(db:any,tipo:string,f:Filtro){const base=baseDetalheNegocios(tipo,f);const [rows,count]=await Promise.all([db.$queryRaw(Prisma.sql`SELECT * FROM (${base}) registros ORDER BY quando DESC NULLS LAST,"empresaId",id LIMIT 50 OFFSET ${(f.pagina-1)*50}`),db.$queryRaw(Prisma.sql`SELECT COUNT(*)::integer AS total FROM (${base}) registros`)]);const total=Number(count[0]?.total||0);return {linhas:rows.map((r:any)=>({...r,valor:r.valor==null?null:Number(r.valor)})),total,pagina:f.pagina,paginas:Math.max(1,Math.ceil(total/50))};}
