import test from 'node:test';import assert from 'node:assert/strict';import {dadosFornecedor} from '../src/controller/ctfornecedor';
test('cadastro mantém documento CPF, CNPJ e fornecedor sem documento',()=>{assert.equal(dadosFornecedor({nome:'Teste',cnpj:'123.456.789-09'},true).cnpj,'12345678909');assert.equal(dadosFornecedor({nome:'Teste',cnpj:'12.345.678/0001-95'}).cnpj,'12345678000195');assert.equal(dadosFornecedor({nome:'Teste'}).cnpj,null);assert.throws(()=>dadosFornecedor({nome:'Teste',cnpj:'123'}));});

test('outros perfis mantêm validação exclusiva de CNPJ',()=>{assert.throws(()=>dadosFornecedor({nome:'Teste',cnpj:'12345678909'}));});
