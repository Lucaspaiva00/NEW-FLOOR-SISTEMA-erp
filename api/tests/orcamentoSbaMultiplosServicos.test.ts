import test from "node:test";
import assert from "node:assert/strict";
import {calcularComposicao} from "../src/services/orcamentoSba.service";
import {gerarHtmlSba} from "../src/services/orcamentoSbaHtml.service";

const base=()=>({
 materiais:[{descricao:"Ferro",especificacao:"",quantidade:2,custoUnitario:50}],
 maoObra:[{descricao:"Montagem",dias:1,pessoas:1,horasDia:5,valorHora:20}],
 margem:.5,imposto:.18
});
test("SBA permite vários serviços com quantidade, valor unitário e soma",()=>{
 const c=calcularComposicao({...base(),servicos:[
  {descricao:"Instalação",detalhes:"Primeiro ambiente",quantidade:2,unidade:"UN",valorUnitario:500},
  {descricao:"Manutenção",quantidade:1,valorUnitario:200},
  {descricao:"Acabamento",quantidade:3,valorUnitario:50.50}
 ]});
 assert.equal(c.servicos.length,3);
 assert.deepEqual(c.servicos.map((s:any)=>s.subtotal),[1000,200,151.5]);
 assert.equal(c.preco,1351.5);
 assert.equal(c.custoTotal,200);
 assert.equal(c.valorImposto,243.27);
 assert.equal(c.lucro,908.23);
 assert.equal(c.servicos.reduce((s:number,item:any)=>s+item.subtotal,0),c.preco);
});
test("SBA mantém cálculo antigo de orçamento com somente materiais e mão de obra",()=>{
 const antigo=calcularComposicao(base());
 const vazio=calcularComposicao({...base(),servicos:[]});
 assert.equal(antigo.preco,400);
 assert.equal(vazio.preco,400);
 assert.deepEqual(antigo.servicos,[]);
});
test("SBA não aceita serviço sem preço, quantidade, descrição ou mais de 100 linhas",()=>{
 const valido={descricao:"Instalação",quantidade:1,valorUnitario:100};
 for(const linha of [
  {...valido,valorUnitario:0}, {...valido,quantidade:-1},
  {...valido,descricao:""}, {...valido,valorUnitario:Infinity}
 ])assert.throws(()=>calcularComposicao({...base(),servicos:[linha]}));
 assert.throws(()=>calcularComposicao({...base(),servicos:Array(101).fill(valido)}));
});
test("PDF SBA mostra separadamente cada serviço e somatória, escapando conteúdo",()=>{
 const comp=calcularComposicao({...base(),servicos:[
  {descricao:"Soldagem <externa>",detalhes:"Etapa A",quantidade:2,valorUnitario:125},
  {descricao:"Pintura",quantidade:1,valorUnitario:85}
 ]});
 const itens=comp.servicos.map((s:any,index:number)=>({...s,ordem:index+1}));
 const html=gerarHtmlSba({
  numero:"100",createdAt:new Date("2026-10-30T10:00:00Z"),
  dataValidade:new Date("2026-11-15T10:00:00Z"),
  subtotal:comp.preco,composicaoCustos:comp,empresa:{},escopo:"",itens
 },{razaoSocial:"Cliente de teste",clienteid:10},itens);
 assert.match(html,/Soldagem &lt;externa&gt;/);
 assert.match(html,/Pintura/);
 assert.match(html,/Total dos serviços \(2\)/);
 assert.match(html,/335,00/);
 assert.doesNotMatch(html,/Soldagem <externa>/);
});
