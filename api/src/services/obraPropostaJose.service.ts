import {data,id,texto,dinheiro} from './obras.service';
import {bloqueio,historico} from './obrasOperacao.service';

export function dadosObraDaProposta(p:any){
 const total=dinheiro(Number(p.subtotal)+Number(p.frete||0));
 if(!Number.isFinite(total)||total<=0)throw Error('A proposta precisa ter valor confirmado maior que zero.');
 const itens=(p.itens||[]).filter((i:any)=>Number(i.subtotal)>0);
 const soma=dinheiro(itens.reduce((s:number,i:any)=>s+Number(i.subtotal),0));
 // Não ratear valores nem inventar quantidades quando o PDF contém apenas o total.
 const etapas=itens.length&&itens.length<=100&&Math.abs(soma-total)<0.009
  ?itens.map((i:any)=>({nome:String(i.descricao).slice(0,300),valor:dinheiro(Number(i.subtotal))}))
  :[{nome:String(p.titulo).slice(0,300),valor:total}];
 const c=p.cliente||{};
 return {propostaId:p.propostaid,clienteId:p.clienteId,nome:p.titulo,valorContrato:total,etapas,
  endereco:[c.endereco,c.numero,c.complemento,c.bairro,[c.cidade,c.estado].filter(Boolean).join('/')].filter(Boolean).join(', '),
  responsavel:p.responsavel||c.responsavel||'',prazoEntrega:p.prazoEntrega||''};
}
export async function criarObraDaProposta(db:any,empresaId:number,b:any,usuarioId?:number){
 if(empresaId!==5)throw Error('Disponível somente para José/Construarty.');
 const propostaId=id(b.propostaId);
 await bloqueio(db,empresaId);
 const p=await db.proposta.findFirst({where:{propostaid:propostaId,empresaId},include:{cliente:true,itens:{orderBy:{ordem:'asc'}}}});
 if(!p)throw Error('Proposta não encontrada nesta empresa.');
 const existente=await db.obra.findFirst({where:{empresaId,propostaId}});
 if(existente)throw Error('Esta proposta já está vinculada à obra '+existente.nome+'. Selecione essa obra.');
 const dados=dadosObraDaProposta(p),inicio=data(b.inicio),prazo=b.prazo?data(b.prazo):null;
 if(prazo&&prazo<inicio)throw Error('Prazo anterior ao início.');
 const criada=await db.obra.create({data:{empresaId,propostaId,clienteId:dados.clienteId,nome:texto(dados.nome,'nome da obra',300),
  endereco:texto(b.endereco,'endereço real da obra'),responsavel:texto(b.responsavel,'responsável',300),inicio,prazo,
  valorContrato:dados.valorContrato,etapas:{create:dados.etapas}},include:{etapas:true}});
 await historico(db,empresaId,criada.id,usuarioId,'CRIAR_DA_PROPOSTA',null,{propostaId,valorContrato:dados.valorContrato,etapas:dados.etapas});
 return criada;
}
