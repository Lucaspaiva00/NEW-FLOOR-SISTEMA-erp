import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/prisma';
import {dadosObraDaProposta,criarObraDaProposta} from '../src/services/obraPropostaJose.service';
import {editarCadastroEmpresa,filtrosLogs} from '../src/services/superadmin.service';
import {eventoDaRequisicao} from '../src/middlewares/auditoria';
import {somenteSuperAdmin} from '../src/controller/ctsuperadmin';
const proposta={propostaid:652,empresaId:5,titulo:'Cronograma Holambra',clienteId:7,subtotal:100000,frete:0,cliente:{endereco:'Rua A',numero:'15',cidade:'Pedreira',estado:'SP'},itens:[{descricao:'Fundação',subtotal:40000},{descricao:'Acabamento',subtotal:60000}]};
test('proposta preenche nome, cliente, contrato e etapas sem inventar rateio',()=>{
 const r=dadosObraDaProposta(proposta);assert.equal(r.nome,'Cronograma Holambra');assert.equal(r.clienteId,7);assert.equal(r.valorContrato,100000);assert.equal(r.etapas.length,2);assert.equal(r.etapas[1].valor,60000);assert.match(r.endereco,/Rua A, 15/);
 const total=dadosObraDaProposta({...proposta,itens:[]});assert.deepEqual(total.etapas,[{nome:proposta.titulo,valor:100000}]);
 assert.equal(dadosObraDaProposta({...proposta,frete:100}).etapas.length,1);
});
function obraDb(p:any=proposta,existente:any=null){const writes:any[]=[];return {writes,db:{$queryRaw:async()=>[],proposta:{findFirst:async(q:any)=>{assert.equal(q.where.empresaId,5);return p;}},obra:{findFirst:async()=>existente,create:async(q:any)=>{writes.push(q.data);return {id:10,...q.data};}},historicoObra:{create:async()=>({})}}};}
test('cria obra com valor do banco, ignora valor forjado e registra o vínculo',async()=>{
 const {db,writes}=obraDb();await criarObraDaProposta(db,5,{propostaId:652,nome:'Forjado',valorContrato:1,inicio:'2026-11-05',endereco:'Local real',responsavel:'José'},9);
 assert.equal(writes[0].valorContrato,100000);assert.equal(writes[0].nome,proposta.titulo);assert.equal(writes[0].propostaId,652);assert.equal(writes[0].clienteId,7);
});
test('proposta alheia e obra duplicada são barradas antes de gravar',async()=>{
 for(const [p,existing] of [[null,null],[proposta,{id:1,nome:'Existente'}]]){const {db,writes}=obraDb(p,existing);await assert.rejects(()=>criarObraDaProposta(db,5,{propostaId:652}),/não encontrada|já está vinculada/);assert.equal(writes.length,0);}
 await assert.rejects(()=>criarObraDaProposta({},2,{}),/José/);
});
test('edição de cadastro usa lista permitida, valida administradores e guarda alteração na mesma transação',async()=>{
 const updates:any[]=[],logs:any[]=[];
 const db:any={empresa:{findUnique:async()=>({empresaid:5,nome:'Antigo',emailContato:null,telefoneContato:null}),update:async(q:any)=>{updates.push(q);return {empresaid:5,...q.data};}},usuario:{findFirst:async(q:any)=>{assert.deepEqual(q.where,{usuarioid:8,empresaId:5,role:'ADMIN'});return {usuarioid:8,nome:'José antigo'};},update:async(q:any)=>updates.push(q)},$executeRawUnsafe:async(...a:any[])=>logs.push(a)};
 await editarCadastroEmpresa(db,5,{nome:'ConstruArty',slug:'sba',ativo:false,adminSenha:'segredo',administradores:[{id:8,nome:'José'}]},{id:1,role:'SUPER_ADMIN'});
 assert.deepEqual(updates[0].data,{nome:'ConstruArty',emailContato:null,telefoneContato:null});assert.deepEqual(updates[1].data,{nome:'José'});
 assert.equal(logs.length,1);assert.doesNotMatch(JSON.stringify(logs),/segredo|senha/);
 db.usuario.findFirst=async()=>null;updates.length=0;await assert.rejects(()=>editarCadastroEmpresa(db,5,{nome:'X',administradores:[{id:8,nome:'Y'}]},{id:1,role:'SUPER_ADMIN'}),/não pertence/);assert.equal(updates.length,0);
});
test('auditoria nunca captura token, senha, corpo ou querystring',()=>{
 const req:any={method:'POST',route:{path:'/usuarios/login'},usuario:{id:1,role:'ADMIN',empresaId:5},headers:{authorization:'Bearer secreto'},body:{senha:'senha'},query:{token:'token'},params:{},empresaId:5};
 const e=eventoDaRequisicao(req,{locals:{},statusCode:200} as any,Date.now());assert.equal(e?.empresaId,5);assert.equal(e?.acao,'LOGIN');assert.doesNotMatch(JSON.stringify(e),/secreto|senha|token/);
 assert.equal(eventoDaRequisicao({...req,method:'GET',route:{path:'/superadmin/logs'}},{locals:{},statusCode:200} as any,Date.now()),null);
});
test('filtros de logs limitam período e paginação e aceitam IDs somente inteiros',()=>{
 assert.throws(()=>filtrosLogs({pagina:'-1'}));assert.throws(()=>filtrosLogs({empresaId:'1 OR 1=1'}));assert.throws(()=>filtrosLogs({inicio:'2026-02-31'}));assert.throws(()=>filtrosLogs({inicio:'2020-01-01',fim:'2026-01-01'}));
 const f=filtrosLogs({empresaId:'5',inicio:'2026-11-05',fim:'2026-11-05'});assert.equal(f.empresaId,5);assert.equal(f.inicio.toISOString(),'2026-11-05T03:00:00.000Z');
});
test('superadmin exige papel atual no banco, não somente o papel antigo do token',async()=>{
 const original=prisma.usuario.findFirst;let status=0,next=false;const res:any={locals:{},status(n:number){status=n;return this;},json(){}};
 try{(prisma.usuario as any).findFirst=async()=>null;await somenteSuperAdmin({usuario:{id:1,role:'ADMIN'}} as any,res,()=>{next=true;});assert.equal(status,403);assert.equal(next,false);
 await somenteSuperAdmin({usuario:{id:1,role:'SUPER_ADMIN'}} as any,res,()=>{next=true;});assert.equal(next,false);
 (prisma.usuario as any).findFirst=async()=>({usuarioid:1,nome:'Lucas'});await somenteSuperAdmin({usuario:{id:1,role:'SUPER_ADMIN'}} as any,res,()=>{next=true;});assert.equal(next,true);
 }finally{prisma.usuario.findFirst=original;}
});
