import { centavos } from './pagamentos.service';
export function validarPlanoRecebimento(plano:any){
 if(plano==null)return null;
 const parcelas=Number(plano.parcelas),intervaloDias=Number(plano.intervaloDias||30);
 const data=String(plano.primeiroVencimento||'');
 if(!Number.isInteger(parcelas)||parcelas<1||parcelas>120)throw new Error('Informe de 1 a 120 parcelas.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||Number.isNaN(new Date(data).getTime())||new Date(data).toISOString().slice(0,10)!==data)throw new Error('Informe um primeiro vencimento válido.');
 if(!['MENSAL','DIAS'].includes(plano.frequencia)||!Number.isInteger(intervaloDias)||intervaloDias<1||intervaloDias>3650)throw new Error('Informe uma frequência e intervalo válidos.');
 return {parcelas,primeiroVencimento:data,frequencia:plano.frequencia,intervaloDias};
}
export function parcelasRecebimento(valor:number,plano:any){
 const p=validarPlanoRecebimento(plano),total=centavos(valor),quantidade=p?.parcelas||1;
 if(total<quantidade)throw new Error('Cada parcela precisa ter ao menos um centavo.');
 return Array.from({length:quantidade},(_,i)=>{
  let vencimento:Date|null=null;
  if(p){const inicio=new Date(p.primeiroVencimento+'T15:00:00Z');vencimento=new Date(inicio);
   if(p.frequencia==='MENSAL'){const mes=inicio.getUTCMonth()+i,ano=inicio.getUTCFullYear(),ultimo=new Date(Date.UTC(ano,mes+1,0)).getUTCDate();vencimento=new Date(Date.UTC(ano,mes,Math.min(inicio.getUTCDate(),ultimo),15));}
   else vencimento.setUTCDate(inicio.getUTCDate()+i*p.intervaloDias);
  }
  const base=Math.floor(total/quantidade);return {numero:i+1,quantidade,valor:(i===quantidade-1?total-base*(quantidade-1):base)/100,vencimento};
 });
}
