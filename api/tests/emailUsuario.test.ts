import test from "node:test";
import assert from "node:assert/strict";
import {cifrarSmtp,decifrarSmtp,validarContaSmtp} from "../src/services/emailUsuario.service";
test("Credencial SMTP é cifrada e não aceita chave incorreta nem alteração",()=>{
 const dados={email:"luis@example.invalid",senha:"segredo-smtp"}, segredo="chave-de-teste";
 const texto=cifrarSmtp(dados,segredo);
 assert.ok(!texto.includes(dados.senha));assert.deepEqual(decifrarSmtp(texto,segredo),dados);
 assert.notEqual(cifrarSmtp(dados,segredo),texto);
 assert.throws(()=>decifrarSmtp(texto,"outra-chave"));
 const partes=texto.split(".");partes[3]=Buffer.from("alterado").toString("base64");
 assert.throws(()=>decifrarSmtp(partes.join("."),segredo));
});
test("SMTP aceita somente servidor público e portas TLS",()=>{
 assert.deepEqual(validarContaSmtp(" SMTP.PROVEDOR.COM.BR ",587),{host:"smtp.provedor.com.br",port:587});
 for(const host of ["localhost","127.0.0.1","smtp.local","10.0.0.1"]){assert.throws(()=>validarContaSmtp(host,465));}
 assert.throws(()=>validarContaSmtp("smtp.provedor.com.br",25));
});
