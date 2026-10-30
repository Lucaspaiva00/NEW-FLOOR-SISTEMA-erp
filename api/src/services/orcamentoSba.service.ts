/** Composição interna SBA e discriminação comercial de serviços.
 * Orçamentos legados continuam usando custo/(1-margem) e 1 item no PDF.
 * Quando servicos[] está preenchido, o preço é a soma exata de suas linhas.
 */
export function calcularComposicao(c: any) {
 const num=(v:any)=>{const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e9)throw Error("Valor inválido na composição de custos.");return n};
 const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
 if(!c||!Array.isArray(c.materiais)||!Array.isArray(c.maoObra)||
    c.materiais.length>200||c.maoObra.length>100||
    (c.servicos!==undefined&&!Array.isArray(c.servicos))||
    (Array.isArray(c.servicos)&&c.servicos.length>100))throw Error("Composição inválida.");
 const materiais=c.materiais.map((m:any)=>({
   ...((Number.isInteger(m.servicoId)&&m.servicoId>0)?{servicoId:m.servicoId}:{}),
   descricao:String(m.descricao||"").slice(0,1000),
   especificacao:String(m.especificacao||"").slice(0,2000),
   quantidade:num(m.quantidade),custoUnitario:num(m.custoUnitario)
 }));
 const maoObra=c.maoObra.map((m:any)=>({
   descricao:String(m.descricao||"").slice(0,1000),dias:num(m.dias),
   pessoas:num(m.pessoas),horasDia:num(m.horasDia),valorHora:num(m.valorHora)
 }));
 const margem=num(c.margem),imposto=num(c.imposto);
 if(margem>=1||imposto>1)throw Error("Margem deve ser menor que 100%; imposto entre 0 e 100%.");
 // Valores por serviço são preços DE VENDA, não custos nem textos livres de observação.
 const servicos=(c.servicos||[]).map((s:any,index:number)=>{
   if(!s||typeof s!=="object"||Array.isArray(s))throw Error("Serviço "+(index+1)+" inválido.");
   const descricao=String(s.descricao||"").trim(),detalhes=String(s.detalhes||"").trim();
   if(!descricao||descricao.length>1000||detalhes.length>2000)throw Error("Preencha a descrição do serviço "+(index+1)+".");
   const quantidade=num(s.quantidade),valorUnitario=num(s.valorUnitario);
   if(quantidade<=0||quantidade>10000||valorUnitario<=0||valorUnitario>99999999)
     throw Error("O serviço "+(index+1)+" precisa de quantidade e valor unitário positivos.");
   const totalCentavos=Math.round(quantidade*valorUnitario*100);
   if(!Number.isSafeInteger(totalCentavos)||totalCentavos<=0||totalCentavos>9999999900)
     throw Error("Valor total inválido no serviço "+(index+1)+".");
   const unidade=String(s.unidade||"UN").trim().slice(0,20)||"UN";
   return {descricao,detalhes,unidade,quantidade,valorUnitario:round(valorUnitario),
     subtotal:totalCentavos/100};
 });
 const custoMateriais=round(materiais.reduce((s:number,m:any)=>s+m.quantidade*m.custoUnitario,0));
 const custoMaoObra=round(maoObra.reduce((s:number,m:any)=>s+m.dias*m.pessoas*m.horasDia*m.valorHora,0));
 const custoTotal=round(custoMateriais+custoMaoObra);
 const preco=servicos.length
   ?round(servicos.reduce((s:number,item:any)=>s+item.subtotal,0))
   :round(custoTotal/(1-margem));
 if(preco<=0||preco>99999999)throw Error("Preço do orçamento fora do limite.");
 const valorImposto=round(preco*imposto),receitaAposImposto=round(preco-valorImposto);
 const lucro=round(receitaAposImposto-custoTotal);
 const margemRealizada=preco>0?round((preco-custoTotal)/preco):0;
 return {materiais,maoObra,servicos,margem,imposto,custoMateriais,custoMaoObra,
   custoTotal,preco,valorImposto,receitaAposImposto,lucro,margemRealizada};
}
