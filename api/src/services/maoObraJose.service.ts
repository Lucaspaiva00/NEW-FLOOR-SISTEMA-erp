import { data, id, numero, dinheiro } from './obras.service';
import { apontarDia, bloqueio, carregarObra } from './obrasOperacao.service';

// Chamado dentro de uma única transação serializável.
export async function apontarPeriodoJose(db:any, empresaId:number, b:any, usuarioId?:number) {
 if(empresaId!==5) throw Error('Lançamento por período disponível somente para José.');
 const obraId=id(b.obraId), inicio=data(b.inicio), fim=data(b.fim), fracao=numero(b.fracao,0.01,1);
 if(fim<inicio || (fim.getTime()-inicio.getTime())/86400000>30) throw Error('Selecione um período de até 31 dias.');
 if(!Array.isArray(b.colaboradorIds)||!b.colaboradorIds.length||b.colaboradorIds.length>20) throw Error('Selecione de 1 a 20 colaboradores.');
 const ids=b.colaboradorIds.map(id);
 if(new Set(ids).size!==ids.length) throw Error('Colaboradores repetidos.');
 const dias:Date[]=[];
 for(let d=new Date(inicio);d<=fim;d.setUTCDate(d.getUTCDate()+1)){
  if(b.somenteUteis===true && [0,6].includes(d.getUTCDay())) continue;
  dias.push(new Date(d));
 }
 if(!dias.length || dias.length*ids.length>400) throw Error('Selecione dias trabalhados válidos (máximo 400 lançamentos).');
 await bloqueio(db,empresaId);
 await carregarObra(db,empresaId,obraId);
 // Não sobrescrever apontamentos existentes; correções têm sua própria ação.
 for(const colaboradorId of ids){
  if(!await db.colaboradorObra.findFirst({where:{id:colaboradorId,empresaId,ativo:true}})) throw Error('Colaborador não encontrado ou inativo.');
  for(const dia of dias){
   const rows=await db.apontamentoObra.findMany({where:{empresaId,colaboradorId,data:dia}});
   if(rows.some((r:any)=>r.obraId===obraId)) throw Error('Já existe lançamento nesta obra para um dos dias. Use Corrigir ou ajuste o período.');
   if(rows.reduce((s:number,r:any)=>s+Number(r.fracao),fracao)>1.00001) throw Error('A alocação diária não pode exceder uma diária entre obras.');
  }
 }
 let total=0, registros=0;
 for(const colaboradorId of ids)for(const dia of dias){
  const r=await apontarDia(db,empresaId,{obraId,colaboradorId,data:dia.toISOString().slice(0,10),fracao,observacoes:b.observacoes},usuarioId);
  total+=dinheiro(Number(r.diaria)*Number(r.fracao));registros++;
 }
 return {registros,total:dinheiro(total)};
}
