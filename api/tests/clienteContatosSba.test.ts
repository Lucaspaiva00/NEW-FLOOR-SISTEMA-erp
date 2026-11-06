import test from 'node:test';
import assert from 'node:assert/strict';
import {contatosCliente,validarContatosAdicionais,destinatariosCliente} from '../src/services/clienteContatos.service';
import prisma from '../src/prisma';
import * as clientes from '../src/controller/ctcliente';
const extras=Array.from({length:11},(_,i)=>({email:`pessoa${i+5}@example.invalid`,nomeEmail:`Contato ${i+5}`,telefone:'1938525079',nomeTelefone:`Contato ${i+5}`}));
const cliente:any={clienteid:10,empresaId:2,contatosAdicionais:extras};for(let i=1;i<=4;i++){cliente['email'+i]=`pessoa${i}@example.invalid`;cliente['nomeEmail'+i]=`Contato ${i}`;}
function res(){return {code:200,body:null as any,status(n:number){this.code=n;return this;},json(b:any){this.body=b;return this;}};}
test('quinze contatos preservam legado, aceitam um, vários ou todos e removem destinatários duplicados',()=>{
 const dados=validarContatosAdicionais(extras);assert.equal(dados.length,11);const todos=contatosCliente(cliente).map(c=>c.email);assert.equal(todos.length,15);
 assert.equal(destinatariosCliente(cliente,todos).length,15);assert.deepEqual(destinatariosCliente(cliente,[todos[14]]),[todos[14]]);
 assert.deepEqual(destinatariosCliente(cliente,[todos[0],todos[14],todos[0].toUpperCase()]),[todos[0],todos[14]]);
 assert.throws(()=>destinatariosCliente(cliente,['outro@outraempresa.invalid']),/cadastrados/);
 assert.throws(()=>destinatariosCliente(cliente,[]),/Selecione/);
 assert.throws(()=>destinatariosCliente(cliente,['pessoa1@example.invalid\r\nBcc:x@y.invalid']),/cadastrados/);
 assert.throws(()=>validarContatosAdicionais(Array(47).fill({})),/50/);
 assert.throws(()=>validarContatosAdicionais([{email:'email-invalido'}]),/válido/);
});
test('edição salva contatos adicionais apenas na SBA e mantém isolamento por empresa; omissão não apaga contatos',async(t)=>{
 const writes:any[]=[],original={update:prisma.cliente.updateMany,find:prisma.cliente.findFirst};(prisma.cliente as any).updateMany=async(q:any)=>{writes.push(q);return {count:1};};(prisma.cliente as any).findFirst=async()=>cliente;t.after(()=>{(prisma.cliente as any).updateMany=original.update;(prisma.cliente as any).findFirst=original.find;});
 for(const [empresaId,perfil,body] of [[2,'SBA',{contatosAdicionais:extras}],[1,'NEW_FLOOR',{contatosAdicionais:extras}],[2,'SBA',{razaoSocial:'Empresa'}]] as any[]){const r=res();await clientes.update({empresaId,configuracaoSistema:{perfil},params:{id:'10'},body} as any,r as any);assert.equal(r.code,200);}
 assert.deepEqual(writes[0].where,{clienteid:10,empresaId:2});assert.equal(writes[0].data.contatosAdicionais.length,11);assert.equal(writes[1].data.contatosAdicionais,undefined);assert.equal(writes[2].data.contatosAdicionais,undefined);
 const r=res();await clientes.update({empresaId:2,configuracaoSistema:{perfil:'SBA'},params:{id:'10'},body:{contatosAdicionais:[{email:'invalido'}]}} as any,r as any);assert.equal(r.code,400);assert.equal(writes.length,3);
});
