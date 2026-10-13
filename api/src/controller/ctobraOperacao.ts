import {Request,Response} from 'express';
import prisma from '../prisma';
import {id,data,texto} from '../services/obras.service';
import {editarObra,salvarPlanejamento,editarMedicao,cancelarMedicao,cancelarDespesa,bloqueio,historico,carregarObra,filtrosConsulta} from '../services/obrasOperacao.service';
import {consolidarObra,relatorioHtml,emitirPdf} from '../services/obrasRelatorio.service';
const executar=(f:(req:Request,res:Response)=>Promise<void>)=>async(req:Request,res:Response)=>{try{await f(req,res);}catch(e:any){res.status(400).json({error:e.message||'Falha na operação.'});}};
const transacao=(fn:(db:any)=>Promise<any>)=>prisma.$transaction(fn,{isolationLevel:'Serializable',timeout:60000});
export const editar=executar(async(req,res)=>{res.json(await transacao(db=>editarObra(db,req.empresaId!,id(req.params.id),req.body,req.usuario?.id)));});
export const planejar=executar(async(req,res)=>{res.json(await transacao(db=>salvarPlanejamento(db,req.empresaId!,req.body,req.usuario?.id)));});
export const removerPlanejamento=executar(async(req,res)=>{res.json(await transacao(async db=>{await bloqueio(db,req.empresaId!);const p=await db.planejamentoObra.findFirst({where:{id:id(req.params.id),empresaId:req.empresaId!}});if(!p)throw Error('Planejamento não encontrado.');await db.planejamentoObra.delete({where:{id:p.id}});await historico(db,req.empresaId!,p.obraId,req.usuario?.id,'REMOVER_PLANEJAMENTO',p,null);return {ok:true};}));});
export const corrigirMedicao=executar(async(req,res)=>{res.json(await transacao(db=>editarMedicao(db,req.empresaId!,id(req.params.id),req.body,req.usuario?.id)));});
export const cancelar=executar(async(req,res)=>{res.json(await transacao(db=>cancelarMedicao(db,req.empresaId!,id(req.params.id),req.body.motivo,req.usuario?.id)));});
export const cancelarGasto=executar(async(req,res)=>{res.json(await transacao(db=>cancelarDespesa(db,req.empresaId!,id(req.params.id),req.body.motivo,req.usuario?.id)));});
export const medicao=executar(async(req,res)=>{const m=await prisma.medicaoObra.findFirst({where:{id:id(req.params.id),empresaId:req.empresaId!},include:{itens:true}});if(!m)throw Error('Medição não encontrada.');res.json(m);});
export const reabrirFechamento=executar(async(req,res)=>{const empresaId=req.empresaId!,lancamentoId=id(req.params.id);res.json(await transacao(async db=>{
 await bloqueio(db,empresaId);const rows=await db.apontamentoObra.findMany({where:{empresaId,lancamentoId}});if(!rows.length)throw Error('Fechamento não encontrado.');const motivo=texto(req.body.motivo,'motivo da reabertura');
 await db.$queryRaw`SELECT "lancamentofinanceiroid" FROM "LancamentoFinanceiro" WHERE "lancamentofinanceiroid"=${lancamentoId} AND "empresaId"=${empresaId} FOR UPDATE`;
 const l=await db.lancamentoFinanceiro.findFirst({where:{empresaId,lancamentofinanceiroid:lancamentoId}});if(!l||Number(l.valorPago)>0)throw Error('Estorne os pagamentos antes de reabrir o fechamento.');
 await db.lancamentoFinanceiro.update({where:{lancamentofinanceiroid:lancamentoId},data:{status:'CANCELADO'}});await db.apontamentoObra.updateMany({where:{empresaId,lancamentoId},data:{lancamentoId:null}});
 for(const obraId of new Set<number>(rows.map((a:any)=>a.obraId)))await historico(db,empresaId,obraId,req.usuario?.id,'REABRIR_DIARIAS',rows,{motivo,lancamentoId});return {ok:true};
 }));});
export const consulta=executar(async(req,res)=>{
 const empresaId=req.empresaId!,obraId=id(req.params.id),f=filtrosConsulta(req.query);await carregarObra(prisma,empresaId,obraId);const tipo=String(req.query.tipo||'apontamentos'),periodo={...(f.inicio?{gte:f.inicio}:{}),...(f.fim?{lte:f.fim}:{})};
 const models:any={apontamentos:prisma.apontamentoObra,planejamento:prisma.planejamentoObra,despesas:prisma.despesaObra,medicoes:prisma.medicaoObra,historico:prisma.historicoObra};const model=models[tipo];if(!model)throw Error('Consulta inválida.');
 const where:any={empresaId,obraId};if(f.inicio||f.fim)where[tipo==='medicoes'?'fim':tipo==='historico'?'createdAt':'data']=tipo==='historico'?{...(f.inicio?{gte:f.inicio}:{}),...(f.fim?{lt:new Date(f.fim.getTime()+86400000)}:{})}:periodo;
 if(req.query.status&&tipo==='medicoes'){if(!['RASCUNHO','APROVADA','CANCELADA'].includes(String(req.query.status)))throw Error('Status inválido.');where.status=req.query.status;}
 if(req.query.colaboradorId&&['apontamentos','planejamento','despesas'].includes(tipo))where.colaboradorId=id(req.query.colaboradorId);
 if(f.busca){const contains={contains:f.busca,mode:'insensitive'};if(tipo==='apontamentos')where.OR=[{observacoes:contains},{colaborador:{nome:contains}}];else if(tipo==='despesas')where.OR=[{descricao:contains},{categoria:contains}];else if(tipo==='historico')where.acao=contains;else where.observacoes=contains;}
 const opts:any={where,skip:(f.pagina-1)*f.tamanho,take:f.tamanho,orderBy:{id:'desc'}};if(tipo==='apontamentos')opts.include={colaborador:true};if(tipo==='medicoes')opts.select={id:true,inicio:true,fim:true,valor:true,status:true,motivoCancelamento:true,lancamentoId:true,itens:{include:{etapa:true}}};
 const [itens,total]=await Promise.all([model.findMany(opts),model.count({where})]);if(['planejamento','despesas'].includes(tipo)){const ids=itens.map((i:any)=>i.colaboradorId).filter(Boolean),pessoas=await prisma.colaboradorObra.findMany({where:{empresaId,id:{in:ids}}});for(const i of itens)i.colaborador=pessoas.find(c=>c.id===i.colaboradorId)||null;}
 res.json({itens,total,pagina:f.pagina,tamanho:f.tamanho,paginas:Math.max(1,Math.ceil(total/f.tamanho))});
});
export const relatorio=executar(async(req,res)=>{const f=filtrosConsulta(req.query),d=await consolidarObra(prisma,req.empresaId!,id(req.params.id),f.inicio,f.fim);if(req.query.formato==='json'){res.json(d);return;}const bytes=await emitirPdf(relatorioHtml(d));res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="obra-${d.obra.id}-consolidado.pdf"`);res.send(bytes);});
