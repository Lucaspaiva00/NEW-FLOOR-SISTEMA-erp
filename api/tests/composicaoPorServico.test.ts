import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {calcularComposicao} from '../src/services/orcamentoSba.service';
import {gerarHtmlSba} from '../src/services/orcamentoSbaHtml.service';
const material=(descricao:string,quantidade:number,custoUnitario:number)=>({descricao,especificacao:'',quantidade,custoUnitario});
const labor=(descricao:string,horasDia:number,valorHora:number)=>({descricao,dias:1,pessoas:1,horasDia,valorHora});
const base=()=>({versao:2,margem:.6,imposto:.18,materiais:[],maoObra:[],servicos:[
 {descricao:'Instalação de portão',quantidade:1,unidade:'UN',materiais:[material('Aço',2,500)],maoObra:[labor('Montagem',5,100)],margem:.4,imposto:.1},
 {descricao:'Pintura de estrutura',quantidade:2,unidade:'UN',materiais:[material('Tinta',3,100)],maoObra:[labor('Pintor',4,100)],margem:.3,imposto:.18}
]});
test('Calcula custos e venda de cada serviço; consolida sem duplicar custos',()=>{
 const entrada=base();const c=calcularComposicao(entrada);
 assert.equal(c.servicos[0].custoMateriais,1000);assert.equal(c.servicos[0].custoMaoObra,500);
 assert.equal(c.servicos[0].subtotal,2500);assert.equal(c.servicos[0].lucro,750);
 assert.equal(c.servicos[1].valorUnitario,500);assert.equal(c.servicos[1].subtotal,1000);
 assert.equal(c.custoMateriais,1300);assert.equal(c.custoMaoObra,900);assert.equal(c.custoTotal,2200);
 assert.equal(c.preco,3500);assert.equal(c.valorImposto,430);assert.equal(c.lucro,870);
 assert.equal(c.materiais.length,2);assert.equal(c.maoObra.length,2);
 assert.deepEqual(calcularComposicao(c),c,'reabrir e salvar não altera cálculos');
 assert.deepEqual(entrada,base(),'não modifica a entrada');
 const alterado=base();alterado.servicos[1].materiais[0].custoUnitario=200;
 assert.deepEqual(calcularComposicao(alterado).servicos[0],c.servicos[0]);
});
test('Servidor ignora totalizadores e listas globais recebidos no v2',()=>{
 const c:any=base();c.materiais=[material('DUPLICADO',100,10000)];c.preco=1;c.lucro=999999;c.servicos[0].subtotal=1;c.servicos[0].custoTotal=1;c.servicos[0].valorUnitario=1;
 const resultado=calcularComposicao(c);assert.equal(resultado.preco,3500);assert.equal(resultado.custoTotal,2200);
});
test('Permite preço manual com prejuízo; preserva preço e composição antiga',()=>{
 const entrada:any=base();entrada.servicos[0].modoPreco='MANUAL';entrada.servicos[0].valorUnitario=500;
 const c=calcularComposicao(entrada);assert.equal(c.servicos[0].subtotal,500);assert.equal(c.servicos[0].lucro,-1050);
 assert.deepEqual(calcularComposicao(c),c);
 const legado=calcularComposicao({materiais:[material('Ferro',2,50)],maoObra:[],margem:.5,imposto:.18});
 assert.equal(legado.preco,200);assert.equal(legado.versao,undefined);
});
test('Valida custos, taxas, quantidade, modo e limites por serviço e proposta',()=>{
 const invalida=(fn:(c:any)=>void)=>{const c:any=base();fn(c);assert.throws(()=>calcularComposicao(c));};
 invalida(c=>c.servicos=[]);invalida(c=>c.servicos[0].materiais=null);
 invalida(c=>c.servicos[0].materiais[0].quantidade=-1);invalida(c=>c.servicos[0].maoObra[0].valorHora=Infinity);
 invalida(c=>c.servicos[0].margem=1);invalida(c=>c.servicos[0].imposto=1.1);
 invalida(c=>c.servicos[0].quantidade=0);invalida(c=>c.servicos[0].modoPreco='ERRADO');
 invalida(c=>c.servicos[0].materiais=Array(201).fill(material('Ferro',1,1)));
 invalida(c=>{c.servicos[0].materiais=Array(101).fill(material('Ferro',1,1));c.servicos[1].materiais=Array(101).fill(material('Ferro',1,1));});
});
test('Arredondamento de preço unitário mantém soma comercial e cálculo do navegador idênticos',()=>{
 const context:any={window:{}};vm.runInNewContext(fs.readFileSync('../web/js/composicao-servicos.js','utf8'),context);
 const entrada:any=base();entrada.servicos[0].quantidade=3;entrada.servicos[0].margem=.37;
 const c=calcularComposicao(entrada);
 for(let i=0;i<entrada.servicos.length;i++){
  const noBrowser=context.window.calcularServicoSba({...entrada.servicos[i],modoPreco:'AUTOMATICO'});
  for(const key of ['valorUnitario','subtotal','custoMateriais','custoMaoObra','custoTotal','valorImposto','lucro'])assert.equal(noBrowser[key],c.servicos[i][key],key);
 }
 assert.equal(c.preco,Math.round(c.servicos.reduce((n:number,s:any)=>n+s.subtotal,0)*100)/100);
});
test('PDF mantém itens comerciais e não revela materiais, equipe ou margem internos',()=>{
 const c=calcularComposicao(base());
 const itens=c.servicos.map((s:any)=>({descricao:s.descricao,quantidade:s.quantidade,unidade:s.unidade,valorUnitario:s.valorUnitario,subtotal:s.subtotal}));
 const html=gerarHtmlSba({numero:'777',createdAt:new Date(),subtotal:c.preco,composicaoCustos:c,empresa:{},escopo:''},{razaoSocial:'Cliente'},itens);
 assert.match(html,/Instalação de portão/);assert.match(html,/Pintura de estrutura/);assert.match(html,/3\.500,00/);
 assert.doesNotMatch(html,/Aço|Tinta|Montagem|Pintor|custoMateriais|Margem/);
});
