import test from "node:test";
import assert from "node:assert/strict";
import {contaEmailGerenciada} from "../src/services/emailUsuario.service";
const usuario={email:"luis@sba.example.com",nome:"Luis"};
const env={SMTP_EMPRESA_2_HOST:"smtp.example.com",SMTP_EMPRESA_2_USER:usuario.email,SMTP_EMPRESA_2_PASS:"credencial-de-teste",SMTP_EMPRESA_2_PORT:"587",SMTP_USER:"atendimento@newfloor.example.com"};
test("Conta gerenciada usa credenciais da empresa e remetente exato do usuário",()=>{
 assert.deepEqual(contaEmailGerenciada(usuario,2,env),{email:usuario.email,nome:"Luis",host:"smtp.example.com",port:587,senha:env.SMTP_EMPRESA_2_PASS});
});
test("Não reutiliza credenciais globais nem de outro tenant",()=>{
 assert.equal(contaEmailGerenciada(usuario,3,env),undefined);
 assert.equal(contaEmailGerenciada(usuario,2,{SMTP_USER:env.SMTP_USER,SMTP_PASS:"outra"}),undefined);
});
test("Bloqueia remetente não autorizado e configuração incompleta",()=>{
 assert.throws(()=>contaEmailGerenciada({...usuario,email:"outra@example.com"},2,env),/não foi autorizado/);
 assert.throws(()=>contaEmailGerenciada(usuario,2,{...env,SMTP_EMPRESA_2_PASS:""}),/administração/);
 assert.throws(()=>contaEmailGerenciada(usuario,2,{...env,SMTP_EMPRESA_2_PORT:"25"}),/porta/);
});
