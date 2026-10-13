export function texto(v:any, nome:string, max=2000) {
 const s=String(v??'').trim(); if(!s || s.length>max) throw Error(`Informe ${nome} (até ${max} caracteres).`); return s;
}
export function numero(v:any,min=0,max=1000000000) {
 if(v===null||v===undefined||v==='')throw Error('Informe um valor numérico.');
 const n=Number(v); if(!Number.isFinite(n)||n<min||n>max)throw Error('Valor fora do intervalo permitido.');return n;
}
export function id(v:any){const n=numero(v,1);if(!Number.isSafeInteger(n))throw Error('Identificador inválido.');return n;}
export function data(v:any){const s=String(v??'');const d=new Date(s+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw Error('Data inválida.');return d;}
export function dinheiro(v:number){return Math.round((v+Number.EPSILON)*100)/100;}
export function valorMedicao(valor:number,anterior:number,atual:number){numero(anterior,0,100);numero(atual,anterior,100);return dinheiro(valor*(atual-anterior)/100);}
export function htmlSeguro(v:any){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
