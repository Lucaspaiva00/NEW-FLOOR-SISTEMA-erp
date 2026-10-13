import {data,id,numero,texto,dinheiro,valorMedicao} from './obras.service';
export const json=(v:any)=>JSON.parse(JSON.stringify(v,(k,v)=>k==='fotos'&&Array.isArray(v)?{quantidade:v.length}:v));
export async function carregarObra(db:any,empresaId:number,obraId:number){const o=await db.obra.findFirst({where:{id:obraId,empresaId},include:{etapas:true}});if(!o)throw Error('Obra não encontrada.');return o;}
export async function historico(db:any,empresaId:number,obraId:number,usuarioId:number|undefined,acao:string,antes:any,depois:any){return db.historicoObra.create({data:{empresaId,obraId,usuarioId,acao,antes:json(antes),depois:json(depois)}});}
export async function bloqueio(db:any,empresaId:number){await db.$queryRaw`SELECT pg_advisory_xact_lock(${empresaId}, 0)::text`;}
export async function apontarDia(db:any,empresaId:number,b:any,usuarioId?:number){
 await bloqueio(db,empresaId);const obraId=id(b.obraId),colaboradorId=id(b.colaboradorId),dia=data(b.data),fracao=numero(b.fracao,0,1);await carregarObra(db,empresaId,obraId);
 const c=await db.colaboradorObra.findFirst({where:{id:colaboradorId,empresaId,ativo:true}});if(!c)throw Error('Colaborador não encontrado ou inativo.');
 const rows=await db.apontamentoObra.findMany({where:{empresaId,colaboradorId,data:dia}}),antes=rows.find((r:any)=>r.obraId===obraId);if(antes?.lancamentoId)throw Error('Apontamento já fechado no financeiro.');
 if(rows.filter((r:any)=>r.obraId!==obraId).reduce((s:number,r:any)=>s+Number(r.fracao),fracao)>1.00001)throw Error('A alocação diária não pode exceder uma diária.');
 const d={fracao,diaria:antes?.diaria??c.diaria,observacoes:String(b.observacoes||'').slice(0,2000)};
 const depois=await db.apontamentoObra.upsert({where:{empresaId_colaboradorId_data_obraId:{empresaId,colaboradorId,data:dia,obraId}},create:{empresaId,obraId,colaboradorId,data:dia,...d},update:d});await historico(db,empresaId,obraId,usuarioId,'APONTAR_DIA',antes||null,depois);return depois;
}
export async function fecharDiarias(db:any,empresaId:number,b:any,usuarioId?:number){
 await bloqueio(db,empresaId);const inicio=data(b.inicio),fim=data(b.fim),vencimento=data(b.vencimento);if(fim<inicio)throw Error('Período inválido.');
 const rows=await db.apontamentoObra.findMany({where:{empresaId,data:{gte:inicio,lte:fim},lancamentoId:null,...(b.obraId?{obraId:id(b.obraId)}:{})},include:{colaborador:true,obra:true}});if(!rows.length)throw Error('Nenhum apontamento pendente no período.');
 const grupos=new Map<string,any[]>();for(const r of rows){const chave=r.colaboradorId+':'+r.obraId;grupos.set(chave,[...(grupos.get(chave)||[]),r]);}
 let total=0;for(const g of grupos.values()){const valor=dinheiro(g.reduce((s:number,a:any)=>s+dinheiro(Number(a.diaria)*Number(a.fracao)),0));if(valor<=0)continue;
  const l=await db.lancamentoFinanceiro.create({data:{empresaId,origem:'OBRA',tipo:'SAIDA',descricao:`Diárias · ${g[0].colaborador.nome} · ${g[0].obra.nome}`,favorecido:g[0].colaborador.nome,valor,dataCompetencia:fim,dataVencimento:vencimento}});
  await db.apontamentoObra.updateMany({where:{empresaId,id:{in:g.map(a=>a.id)},lancamentoId:null},data:{lancamentoId:l.lancamentofinanceiroid}});await historico(db,empresaId,g[0].obraId,usuarioId,'FECHAR_DIARIAS',g,{lancamentoId:l.lancamentofinanceiroid,valor});total+=valor;
 }return {total:dinheiro(total)};
}
export async function editarObra(db:any,empresaId:number,obraId:number,b:any,usuarioId?:number){
 await bloqueio(db,empresaId);const o=await carregarObra(db,empresaId,obraId);
 const clienteId=id(b.clienteId),propostaId=b.propostaId?id(b.propostaId):null;
 if(!await db.cliente.findFirst({where:{clienteid:clienteId,empresaId}}))throw Error('Cliente não pertence à empresa.');
 if(propostaId&&!await db.proposta.findFirst({where:{propostaid:propostaId,empresaId,clienteId}}))throw Error('Proposta não pertence ao cliente.');
 const medicoes=await db.medicaoObra.findMany({where:{empresaId,obraId,status:{not:'CANCELADA'}},include:{itens:true}});
 if(medicoes.length&&(clienteId!==o.clienteId||propostaId!==o.propostaId))throw Error('Cliente e proposta não podem mudar após uma medição.');
 const inicio=data(b.inicio),prazo=b.prazo?data(b.prazo):null;if(prazo&&prazo<inicio)throw Error('Prazo anterior ao início.');
 const etapas=(Array.isArray(b.etapas)?b.etapas:[]).map((e:any)=>({id:e.id?id(e.id):null,nome:texto(e.nome,'etapa',300),valor:dinheiro(numero(e.valor,0.01))}));
 if(!etapas.length||etapas.length>100||new Set(etapas.filter((e:any)=>e.id).map((e:any)=>e.id)).size!==etapas.filter((e:any)=>e.id).length)throw Error('Informe etapas únicas.');
 const valorContrato=dinheiro(numero(b.valorContrato,0.01));if(Math.abs(etapas.reduce((s:number,e:any)=>s+e.valor,0)-valorContrato)>0.009)throw Error('A soma das etapas deve corresponder ao contrato.');
 for(const e of etapas)if(e.id&&!o.etapas.some((x:any)=>x.id===e.id))throw Error('Etapa não pertence à obra.');
 for(const e of o.etapas){
  const nova=etapas.find((n:any)=>n.id===e.id),usada=await db.itemMedicaoObra.count({where:{etapaId:e.id}});
  if(usada&&(!nova||nova.nome!==e.nome||nova.valor!==Number(e.valor)))throw Error('Etapas com histórico de medição são preservadas. Cadastre uma nova etapa para o aditivo.');
  if(!nova)await db.etapaObra.delete({where:{id:e.id}});
 }
 for(const e of etapas)if(e.id)await db.etapaObra.update({where:{id:e.id},data:{nome:e.nome,valor:e.valor}});else await db.etapaObra.create({data:{obraId,nome:e.nome,valor:e.valor}});
 const status=String(b.status||o.status);if(!['EM_ANDAMENTO','PAUSADA','CONCLUIDA','CANCELADA'].includes(status))throw Error('Status inválido.');
 const atual=await db.obra.update({where:{id:obraId},data:{nome:texto(b.nome,'nome da obra',300),clienteId,propostaId,endereco:texto(b.endereco,'endereço'),responsavel:texto(b.responsavel,'responsável',300),inicio,prazo,valorContrato,status},include:{etapas:true}});
 await historico(db,empresaId,obraId,usuarioId,'EDITAR_OBRA',o,atual);return atual;
}
export async function salvarPlanejamento(db:any,empresaId:number,b:any,usuarioId?:number){
 await bloqueio(db,empresaId);const obraId=id(b.obraId),colaboradorId=id(b.colaboradorId),dia=data(b.data),fracao=numero(b.fracao,0.01,1);await carregarObra(db,empresaId,obraId);
 if(!await db.colaboradorObra.findFirst({where:{id:colaboradorId,empresaId,ativo:true}}))throw Error('Colaborador não pertence à empresa ou está inativo.');
 const linhas=await db.planejamentoObra.findMany({where:{empresaId,colaboradorId,data:dia}});if(linhas.filter((l:any)=>l.obraId!==obraId).reduce((s:number,l:any)=>s+Number(l.fracao),fracao)>1.00001)throw Error('O planejamento excede uma diária por pessoa e dia.');
 const antes=linhas.find((l:any)=>l.obraId===obraId)||null;
 const depois=await db.planejamentoObra.upsert({where:{empresaId_colaboradorId_data_obraId:{empresaId,colaboradorId,data:dia,obraId}},create:{empresaId,colaboradorId,data:dia,obraId,fracao,observacoes:String(b.observacoes||'').slice(0,2000)},update:{fracao,observacoes:String(b.observacoes||'').slice(0,2000)}});
 await historico(db,empresaId,obraId,usuarioId,'PLANEJAR',antes,depois);return depois;
}
export function validarFotos(v:any){const fotos=Array.isArray(v)?v:[];if(fotos.length>12||fotos.some((f:any)=>typeof f!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(f)||f.length>500000))throw Error('Use até 12 fotos JPG, PNG ou WebP de até 375 KB.');return fotos;}
export async function editarMedicao(db:any,empresaId:number,medicaoId:number,b:any,usuarioId?:number){
 await bloqueio(db,empresaId);const m=await db.medicaoObra.findFirst({where:{id:medicaoId,empresaId},include:{itens:true}});if(!m||m.status!=='RASCUNHO')throw Error('Apenas medições em rascunho podem ser corrigidas.');
 const o=await carregarObra(db,empresaId,m.obraId),inicio=data(b.inicio),fim=data(b.fim),vencimento=data(b.vencimento);if(fim<inicio)throw Error('Período inválido.');
 const prev=await db.medicaoObra.findFirst({where:{empresaId,obraId:m.obraId,status:'APROVADA'},orderBy:{fim:'desc'}});if(prev&&inicio<=prev.fim)throw Error('Período anterior à última medição aprovada.');
 if(!Array.isArray(b.itens)||b.itens.length!==o.etapas.length||new Set(b.itens.map((i:any)=>id(i.etapaId))).size!==o.etapas.length)throw Error('Informe todas as etapas uma única vez.');
 const itens=[];for(const e of o.etapas){const p=await db.itemMedicaoObra.findFirst({where:{etapaId:e.id,medicao:{empresaId,obraId:m.obraId,status:'APROVADA'}},orderBy:{id:'desc'}});const anterior=Number(p?.atual||0),atual=numero(b.itens.find((i:any)=>id(i.etapaId)===e.id)?.atual,anterior,100);itens.push({etapaId:e.id,anterior,atual,valor:valorMedicao(Number(e.valor),anterior,atual)});}
 const valor=dinheiro(itens.reduce((s,i)=>s+i.valor,0));if(valor<=0)throw Error('A medição deve ter evolução positiva.');
 await db.itemMedicaoObra.deleteMany({where:{medicaoId:m.id}});
 const depois=await db.medicaoObra.update({where:{id:m.id},data:{inicio,fim,vencimento,valor,observacoes:String(b.observacoes||'').slice(0,10000),fotos:validarFotos(b.fotos),itens:{create:itens}},include:{itens:true}});await historico(db,empresaId,m.obraId,usuarioId,'CORRIGIR_MEDICAO',m,depois);return depois;
}
export async function cancelarMedicao(db:any,empresaId:number,medicaoId:number,motivo:any,usuarioId?:number){
 await bloqueio(db,empresaId);const m=await db.medicaoObra.findFirst({where:{id:medicaoId,empresaId},include:{itens:true}});if(!m)throw Error('Medição não encontrada.');if(m.status==='CANCELADA')return m;
 const justificativa=texto(motivo,'motivo do cancelamento');
 if(m.status==='APROVADA'&&await db.medicaoObra.findFirst({where:{empresaId,obraId:m.obraId,id:{gt:m.id},status:{not:'CANCELADA'}}}))throw Error('Cancele primeiro as medições posteriores que dependem desta evolução.');
 if(m.lancamentoId){
  await db.$queryRaw`SELECT "lancamentofinanceiroid" FROM "LancamentoFinanceiro" WHERE "lancamentofinanceiroid"=${m.lancamentoId} AND "empresaId"=${empresaId} FOR UPDATE`;
  const l=await db.lancamentoFinanceiro.findFirst({where:{lancamentofinanceiroid:m.lancamentoId,empresaId}});if(!l)throw Error('Cobrança vinculada não encontrada.');
  if(Number(l.valorPago)>0||await db.pagamentoFinanceiro.count({where:{empresaId,lancamentoId:m.lancamentoId,estornadoEm:null}}))throw Error('Estorne os recebimentos no financeiro antes de cancelar a medição.');
  await db.lancamentoFinanceiro.update({where:{lancamentofinanceiroid:m.lancamentoId},data:{status:'CANCELADO'}});
 }
 const depois=await db.medicaoObra.update({where:{id:m.id},data:{status:'CANCELADA',motivoCancelamento:justificativa,canceladoEm:new Date()}});await historico(db,empresaId,m.obraId,usuarioId,'CANCELAR_MEDICAO',m,depois);return depois;
}

export async function aprovarMedicao(db:any,empresaId:number,medicaoId:number,usuarioId?:number){
 await bloqueio(db,empresaId);const m=await db.medicaoObra.findFirst({where:{id:medicaoId,empresaId},include:{obra:true}});if(!m)throw Error('Medição não encontrada.');if(m.status==='APROVADA')return m;if(m.status!=='RASCUNHO')throw Error('Medição cancelada não pode ser aprovada.');
 const l=await db.lancamentoFinanceiro.create({data:{empresaId,origem:'OBRA',tipo:'ENTRADA',descricao:`Medição #${m.id} · ${m.obra.nome}`,valor:m.valor,clienteId:m.obra.clienteId,dataCompetencia:m.fim,dataVencimento:m.vencimento,chaveOrigem:`obra-medicao:${empresaId}:${m.id}`}});
 const depois=await db.medicaoObra.update({where:{id:m.id},data:{status:'APROVADA',lancamentoId:l.lancamentofinanceiroid}});await historico(db,empresaId,m.obraId,usuarioId,'APROVAR_MEDICAO',m,depois);return depois;
}
export async function cancelarDespesa(db:any,empresaId:number,despesaId:number,motivo:any,usuarioId?:number){
 await bloqueio(db,empresaId);const d=await db.despesaObra.findFirst({where:{id:despesaId,empresaId}});if(!d)throw Error('Despesa não encontrada.');if(d.canceladoEm)return d;const justificativa=texto(motivo,'motivo');
 await db.$queryRaw`SELECT "lancamentofinanceiroid" FROM "LancamentoFinanceiro" WHERE "lancamentofinanceiroid"=${d.lancamentoId} AND "empresaId"=${empresaId} FOR UPDATE`;
 const l=await db.lancamentoFinanceiro.findFirst({where:{lancamentofinanceiroid:d.lancamentoId,empresaId}});if(!l||Number(l.valorPago)>0)throw Error('Estorne o pagamento antes de cancelar a despesa.');
 await db.lancamentoFinanceiro.update({where:{lancamentofinanceiroid:d.lancamentoId},data:{status:'CANCELADO'}});const depois=await db.despesaObra.update({where:{id:d.id},data:{canceladoEm:new Date(),motivoCancelamento:justificativa}});await historico(db,empresaId,d.obraId,usuarioId,'CANCELAR_DESPESA',d,depois);return depois;
}
export function filtrosConsulta(q:any){const inicio=q.inicio?data(q.inicio):undefined,fim=q.fim?data(q.fim):undefined;if(inicio&&fim&&fim<inicio)throw Error('Período inválido.');const pagina=q.pagina? id(q.pagina):1,tamanho=q.tamanho? id(q.tamanho):15;if(tamanho>100)throw Error('Máximo de 100 registros por página.');return {inicio,fim,pagina,tamanho,busca:String(q.busca||'').trim().slice(0,200)};}
