import test from 'node:test';
import assert from 'node:assert/strict';
import {erroTlsSefinSeguro} from '../src/services/conexaoSefinSba.service';
test('TLS distingue erro de PFX, rede e confiança sem divulgar mensagens privadas',()=>{
 assert.match(erroTlsSefinSeguro({message:'unsupported'}).message,/algoritmo legado/);
 assert.match(erroTlsSefinSeguro({code:'ECONNRESET',message:'segredo privado'}).message,/ECONNRESET/);
 assert.match(erroTlsSefinSeguro({code:'UNABLE_TO_VERIFY_LEAF_SIGNATURE'}).message,/identidade TLS/);
 assert.doesNotMatch(erroTlsSefinSeguro({code:'segredo privado',message:'senha arquivo privado'}).message,/segredo|senha|arquivo privado/);
});
