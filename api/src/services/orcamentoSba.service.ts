export function calcularComposicao(c: any) {
 const num = (v:any) => { const n=Number(v); if(!Number.isFinite(n)||n<0||n>1e9) throw new Error("Valor inválido na composição de custos"); return n; };
 const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
 if(!c || !Array.isArray(c.materiais) || !Array.isArray(c.maoObra) || c.materiais.length>200 || c.maoObra.length>100) throw new Error("Composição inválida");
 const materiais=c.materiais.map((m:any)=>({descricao:String(m.descricao||"").slice(0,1000),especificacao:String(m.especificacao||"").slice(0,2000),quantidade:num(m.quantidade),custoUnitario:num(m.custoUnitario)}));
 const maoObra=c.maoObra.map((m:any)=>({descricao:String(m.descricao||"").slice(0,1000),dias:num(m.dias),pessoas:num(m.pessoas),horasDia:num(m.horasDia),valorHora:num(m.valorHora)}));
 const margem=num(c.margem), imposto=num(c.imposto);
 if(margem>=1 || imposto>1) throw new Error("Margem deve ser menor que 100%; imposto entre 0 e 100%.");
 const custoMateriais=round(materiais.reduce((s:number,m:any)=>s+m.quantidade*m.custoUnitario,0));
 const custoMaoObra=round(maoObra.reduce((s:number,m:any)=>s+m.dias*m.pessoas*m.horasDia*m.valorHora,0));
 const custoTotal=round(custoMateriais+custoMaoObra), preco=round(custoTotal/(1-margem));
 if(preco<=0 || preco>99999999) throw new Error("Preço da composição fora do limite");
 const valorImposto=round(preco*imposto), receitaAposImposto=round(preco-valorImposto), lucro=round(receitaAposImposto-custoTotal);
 return {materiais,maoObra,margem,imposto,custoMateriais,custoMaoObra,custoTotal,preco,valorImposto,receitaAposImposto,lucro};
}
