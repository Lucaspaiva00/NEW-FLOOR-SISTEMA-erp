import test from 'node:test';
import assert from 'node:assert/strict';
import { consultar } from '../src/controller/ctcnpj';
test('Consulta CNPJ é compartilhada entre empresas e perfis, com cache de dados públicos',async()=>{
 const original=global.fetch;let calls=0;
 global.fetch=async()=>{calls++;return {ok:true,json:async()=>({razao_social:'Empresa teste',nome_fantasia:'Teste',cnpj:'11444777000161'})} as any;};
 try{for(const [empresaId,perfil]of [[1,'PADRAO'],[2,'SBA'],[3,'PERSONALIZADO']]){let data:any;const res:any={json:(v:any)=>data=v,status:()=>res};await consultar({params:{cnpj:'11444777000161'},empresaId,configuracaoSistema:{perfil}} as any,res);assert.equal(data.razao_social,'Empresa teste');}assert.equal(calls,1);}finally{global.fetch=original;}
});
test('Segunda fonte preenche endereço, telefone adicional e inscrição estadual quando disponíveis',async()=>{
 const original=global.fetch,warning=console.warn;let calls=0;
 global.fetch=async()=>{calls++;if(calls===1)return{ok:false,status:503} as any;return {ok:true,json:async()=>({razao_social:'Empresa alternativa',estabelecimento:{cnpj:'47051253000158',tipo_logradouro:'Rua',logradouro:'Teste',cidade:{nome:'Pedreira'},estado:{sigla:'SP'},ddd1:'19',telefone1:'33334444',ddd2:'19',telefone2:'33335555',inscricoes_estaduais:[{ativo:true,estado:{sigla:'SP'},inscricao_estadual:'123'}]}})} as any;};console.warn=()=>{};
 try{let data:any;const res:any={json:(v:any)=>data=v,status:()=>res};await consultar({params:{cnpj:'47051253000158'}} as any,res);assert.equal(calls,2);assert.equal(data.logradouro,'Rua Teste');assert.equal(data.ddd_telefone_2,'1933335555');assert.equal(data.inscricao_estadual,'123');}finally{global.fetch=original;console.warn=warning;}
});
