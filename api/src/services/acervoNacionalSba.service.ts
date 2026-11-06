import {Prisma} from '@prisma/client';
import {consultarRecebidasAdn,solicitarAdnSba} from './recebidasAdnSba.service';
import {movimentarConta} from './pagamentos.service';
const erro=(m:string)=>Object.assign(Error(m),{statusCode:422});
export const chaveFinanceira=(empresaId:number,n:any)=>(n.direcao==='EMITIDA'?'EMITIDA:':'RECEBIDA:')+empresaId+':NFSE_NACIONAL:'+n.chave;
export function situacaoFinanceira(contas:any[]){
 const ativas=contas.filter(l=>l.status!=='CANCELADO');
 if(!ativas.length)return contas.length?'CANCELADO':'NAO_CONCILIADA';
 if(ativas.every(l=>l.status==='PAGO'))return 'PAGO';
 return ativas.some(l=>Number(l.valorPago)>0)?'PARCIAL':'ABERTO';
}
// Only exact fiscal identifiers and explicit user links: never infer payment from age or matching amount.
export async function contasDoDocumento(db:any,empresaId:number,n:any){
 const notas=await db.notaFiscal.findMany({where:{empresaId,chave:n.chave},select:{notafiscalid:true,propostaId:true}});
 const conditions:any[]=[{chaveOrigem:chaveFinanceira(empresaId,n)}];
 if(n.lancamentoVinculado)conditions.push({lancamentofinanceiroid:Number(n.lancamentoVinculado)});
 if(notas.length){conditions.push({notaFiscalId:{in:notas.map((x:any)=>x.notafiscalid)}});const propostas=notas.map((x:any)=>x.propostaId).filter(Boolean);if(propostas.length)conditions.push({propostaId:{in:propostas}});}
 return db.lancamentoFinanceiro.findMany({where:{empresaId,tipo:n.direcao==='EMITIDA'?'ENTRADA':'SAIDA',OR:conditions},select:{lancamentofinanceiroid:true,status:true,valor:true,valorPago:true,dataVencimento:true,dataPagamento:true,descricao:true}});
}
export function validarFiltros(b:any){
 const pagina=Number(b.pagina||1),tamanho=25;
 if(!Number.isSafeInteger(pagina)||pagina<1||pagina>100000)throw erro('Página inválida.');
 const direcao=String(b.direcao||''),situacao=String(b.situacao||'');
 if(!['','EMITIDA','RECEBIDA'].includes(direcao)||!['','PAGO','ABERTO','PARCIAL','NAO_CONCILIADA','CANCELADO'].includes(situacao))throw erro('Filtro inválido.');
 return {pagina,tamanho,direcao,situacao,busca:String(b.busca||'').trim().slice(0,120)};
}
export async function listarAcervo(db:any,empresa:any,b:any){
 const f=validarFiltros(b),tenant=empresa.empresaId,id=empresa.empresafiscalid;
 // Financial status must be resolved before pagination to keep totals and payment filters consistent.
 const rows=await db.$queryRaw(Prisma.sql`SELECT dados,("xmlCompactado" IS NOT NULL) AS "temXml" FROM "DocumentoRecebidoSba" WHERE "empresaId"=${tenant} AND "empresaFiscalId"=${id} ORDER BY COALESCE(dados->>'dataEmissao','') DESC,chave DESC`);
 const filtradas=rows.map((r:any)=>({...r.dados,temXml:!!r.temXml,direcao:r.dados.direcao||'RECEBIDA'})).filter((n:any)=>(!f.direcao||n.direcao===f.direcao)&&(!f.busca||[n.emissor,n.tomador,n.numero,n.chave,n.documentoEmissor,n.documentoTomador].join(' ').toLowerCase().includes(f.busca.toLowerCase())));
 // Batched exact links avoid one database request per document.
 const notas=await db.notaFiscal.findMany({where:{empresaId:tenant,chave:{in:filtradas.map((n:any)=>n.chave)}},select:{chave:true,notafiscalid:true,propostaId:true}});
 const chaves=filtradas.map((n:any)=>chaveFinanceira(tenant,n)),vinculos=filtradas.map((n:any)=>Number(n.lancamentoVinculado)).filter(Number.isSafeInteger);
 const contas=filtradas.length?await db.lancamentoFinanceiro.findMany({where:{empresaId:tenant,OR:[{chaveOrigem:{in:chaves}},{lancamentofinanceiroid:{in:vinculos}},{notaFiscalId:{in:notas.map((n:any)=>n.notafiscalid)}},{propostaId:{in:notas.map((n:any)=>n.propostaId).filter(Boolean)}}]},select:{lancamentofinanceiroid:true,chaveOrigem:true,notaFiscalId:true,propostaId:true,tipo:true,status:true,valor:true,valorPago:true,dataVencimento:true,dataPagamento:true,descricao:true}}):[];
 const documentos=filtradas.map((n:any)=>{const internas=notas.filter((x:any)=>x.chave===n.chave);const vinculadas=contas.filter((l:any)=>l.tipo===(n.direcao==='EMITIDA'?'ENTRADA':'SAIDA')&&(l.chaveOrigem===chaveFinanceira(tenant,n)||l.lancamentofinanceiroid===n.lancamentoVinculado||internas.some((x:any)=>l.notaFiscalId===x.notafiscalid||x.propostaId&&l.propostaId===x.propostaId)));return {...n,contas:vinculadas,situacaoFinanceira:situacaoFinanceira(vinculadas)};}).filter((n:any)=>!f.situacao||n.situacaoFinanceira===f.situacao);
 const total=documentos.length,paginas=Math.max(1,Math.ceil(total/f.tamanho)),pagina=Math.min(f.pagina,paginas);
 return {documentos:documentos.slice((pagina-1)*f.tamanho,pagina*f.tamanho),total,pagina,paginas,tamanho:f.tamanho};
}
export async function sincronizarAcervo(db:any,empresa:any){
 const r=await consultarRecebidasAdn(db,empresa,0);
 const rows=await db.$queryRaw(Prisma.sql`SELECT nsu,"proximaConsulta","updatedAt" FROM "SincronizacaoRecebidasSba" WHERE "empresaId"=${empresa.empresaId} AND "empresaFiscalId"=${empresa.empresafiscalid}`);
 const s=rows[0];return {nsu:Number(s?.nsu||0),continuar:!!s&&(!s.proximaConsulta||+new Date(s.proximaConsulta)<Date.now()+5000),aviso:r.aviso};
}
export async function conciliarAcervo(db:any,empresa:any,b:any,solicitar=solicitarAdnSba){
 if(b.confirmar!==true||!/^\d{50}$/.test(String(b.chave||'')))throw erro('Confirme a conciliação da nota.');
 if(!['ABERTO','PAGO','VINCULAR'].includes(b.acao))throw erro('Escolha como conciliar a nota.');
 const data=(v:any)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(b.acao!=='VINCULAR'&&!data(b.vencimento))throw erro('Informe o vencimento real da conta.');
 if(b.acao==='PAGO'&&(!data(b.dataPagamento)||!Number.isSafeInteger(Number(b.contaFinanceiraId))||Number(b.contaFinanceiraId)<=0))throw erro('Informe a data e a conta do pagamento/recebimento já realizado.');
 return db.$transaction(async(tx:any)=>{
 const rows=await tx.$queryRaw(Prisma.sql`SELECT dados FROM "DocumentoRecebidoSba" WHERE "empresaId"=${empresa.empresaId} AND "empresaFiscalId"=${empresa.empresafiscalid} AND chave=${b.chave} FOR UPDATE`);
 const n=rows[0]?.dados;if(!n)throw erro('Nota não encontrada no acervo desta empresa.');n.direcao=n.direcao||'RECEBIDA';
 const contas=await contasDoDocumento(tx,empresa.empresaId,n);
 if(contas.length)throw erro('Esta nota já está conciliada. Use o financeiro para registrar ou estornar pagamentos.');
 if(b.acao==='VINCULAR'){
  const id=Number(b.lancamentoId);if(!Number.isSafeInteger(id)||id<=0)throw erro('Selecione uma conta financeira existente.');
  await tx.$queryRaw`SELECT "lancamentofinanceiroid" FROM "LancamentoFinanceiro" WHERE "empresaId"=${empresa.empresaId} AND "lancamentofinanceiroid"=${id} FOR UPDATE`;
  const l=await tx.lancamentoFinanceiro.findFirst({where:{empresaId:empresa.empresaId,lancamentofinanceiroid:id,tipo:n.direcao==='EMITIDA'?'ENTRADA':'SAIDA'}});
  if(!l||l.status==='CANCELADO'||Math.round(Number(l.valor)*100)!==Math.round(n.valor*100))throw erro('A conta deve pertencer à SBA, ter o mesmo valor e o mesmo tipo da nota.');
  if(l.chaveOrigem?.startsWith('RECEBIDA:')||l.chaveOrigem?.startsWith('EMITIDA:')||l.notaFiscalId)throw erro('Esta conta já tem vínculo fiscal. Confira pelo financeiro.');
  const outros=await tx.$queryRaw(Prisma.sql`SELECT chave FROM "DocumentoRecebidoSba" WHERE "empresaId"=${empresa.empresaId} AND dados->>'lancamentoVinculado'=${String(id)} LIMIT 1`);if(outros.length)throw erro('Conta já vinculada a outra nota.');
  await tx.$executeRaw(Prisma.sql`UPDATE "DocumentoRecebidoSba" SET dados=jsonb_set(dados,'{lancamentoVinculado}',${String(id)}::jsonb) WHERE "empresaId"=${empresa.empresaId} AND "empresaFiscalId"=${empresa.empresafiscalid} AND chave=${n.chave}`);return {mensagem:'Conta existente vinculada. Seu pagamento foi preservado.'};
 }
 if(!['recebida','autorizada'].includes(n.situacao))throw erro('Nota com evento fiscal: confira cancelamento ou substituição antes de conciliar.');
 const r=await solicitar(empresa,'/NFSe/'+n.chave+'/Eventos'),d=r.data,status=String(d?.StatusProcessamento||'').replace(/_/g,'').toUpperCase();
 const lista=Array.isArray(d)?d:Array.isArray(d?.Eventos)?d.Eventos:Array.isArray(d?.LoteDFe)?d.LoteDFe:null;
 if(!(status==='NENHUMDOCUMENTOLOCALIZADO'&&[200,404].includes(r.httpStatus)||r.httpStatus===200&&lista!==null&&lista.length===0))throw erro('Não foi possível confirmar a situação atual da nota no Portal Nacional. Nenhuma conta foi criada.');
 const tipo=n.direcao==='EMITIDA'?'ENTRADA':'SAIDA',nome=tipo==='ENTRADA'?'Receitas de NFS-e':'Fornecedores',favorecido=tipo==='ENTRADA'?n.tomador:n.emissor;
 const categoria=await tx.categoriaFinanceira.upsert({where:{empresaId_nome_tipo:{empresaId:empresa.empresaId,nome,tipo}},update:{},create:{empresaId:empresa.empresaId,nome,tipo}});
 const l=await tx.lancamentoFinanceiro.create({data:{empresaId:empresa.empresaId,tipo,status:'ABERTO',origem:'MANUAL',chaveOrigem:chaveFinanceira(empresa.empresaId,n),categoriaFinanceiraId:categoria.categoriafinanceiraid,descricao:'NFS-e '+(n.numero||'')+' · '+favorecido,documento:n.numero||n.chave,favorecido,valor:n.valor,dataCompetencia:new Date(n.dataEmissao),dataVencimento:new Date(b.vencimento+'T15:00:00Z'),observacoes:'Conciliada com acervo Portal Nacional. Chave: '+n.chave+'. Valor bruto conferido pelo usuário.'}});
 if(b.acao==='PAGO')await movimentarConta(l.lancamentofinanceiroid,empresa.empresaId,{valorPago:n.valor,dataPagamento:b.dataPagamento,contaFinanceiraId:Number(b.contaFinanceiraId),formaPagamento:'Conciliação histórica'},false,{$transaction:(fn:any)=>fn(tx)});
 return {lancamentofinanceiroid:l.lancamentofinanceiroid,mensagem:b.acao==='PAGO'?'Quitação já realizada registrada no financeiro. Nenhum pagamento bancário foi enviado.':'Conta registrada em aberto no financeiro.'};
 },{timeout:30000});
}
