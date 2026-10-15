import test from 'node:test';
import assert from 'node:assert/strict';
import { consultar, cnpjValido } from '../src/controller/ctcnpj';
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

test('CNPJ: informa digitos invalidos sem consultar provedores', async () => {
 assert.equal(cnpjValido('01.011.976/0001-75'), false);
 assert.equal(cnpjValido('03.691.432/0001-84'), true);
 assert.equal(cnpjValido('11.444.777/0001-61'), true);
 const original=global.fetch;let chamadas=0, codigo=0, data:any;
 global.fetch=async()=>{chamadas++;throw Error('Consulta nao deveria ocorrer');};
 const res:any={status(n:number){codigo=n;return res;},json(v:any){data=v;return res;}};
 try{await consultar({params:{cnpj:'01011976000175'}} as any,res);
 assert.equal(codigo,400);assert.match(data.error,/dígitos verificadores/);
 assert.equal(chamadas,0);}finally{global.fetch=original;}
});
test('CNPJ: contorna bloqueio 403 com User-Agent e consulta fonte adicional sem misturar perfis',async()=>{
 const original=global.fetch,warning=console.warn;
 const requisicoes:{url:string;userAgent:string}[]=[];
 global.fetch=async(url:any,options:any)=>{
  requisicoes.push({url:String(url),userAgent:String(options?.headers?.['User-Agent'])});
  if(requisicoes.length===1)return{ok:false,status:403} as any;
  if(requisicoes.length===2)return{ok:false,status:429} as any;
  return{ok:true,status:200,json:async()=>({cnpj:'03691432000184',razao_social:'MOINHO GUACU MIRIM LTDA',municipio:'MOGI GUACU',uf:'SP'})} as any;
 };
 console.warn=()=>{};
 const respostas:any[]=[];
 try{
  for(const perfil of ['SBA','PADRAO','PERSONALIZADO']){
   const res:any={status(n:number){throw Error('Erro HTTP '+n);},json(v:any){respostas.push(v);return res;}};
   await consultar({params:{cnpj:'03691432000184'},configuracaoSistema:{perfil}} as any,res);
  }
  assert.equal(requisicoes.length,3);
  assert.ok(requisicoes.every(r=>r.userAgent.startsWith('PaivaTechERP/')));
  assert.match(requisicoes[2].url,/minhareceita\.org/);
  assert.ok(respostas.every(r=>r.razao_social==='MOINHO GUACU MIRIM LTDA'));
 }finally{global.fetch=original;console.warn=warning;}
});
