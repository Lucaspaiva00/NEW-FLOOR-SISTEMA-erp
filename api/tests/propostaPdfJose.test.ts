import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import prisma from '../src/prisma';
import {validarPdfJose,interpretarPropostaJose,validarConferenciaJose,lerPdfJose,decimalPt} from '../src/services/propostaPdfJose.service';
import {somenteJose,importar,enviarOriginalJose,etapasPdfJose} from '../src/controller/ctpropostaPdfJose';
// Documento sintético sem cliente real; cobre a extração de um PDF, não apenas strings simuladas.
function pdfTeste(){
 const content='BT /F1 12 Tf 50 750 Td (Cliente: Cliente de Teste) Tj 0 -25 Td (Pintura m2 100,00 20,00 2.000,00) Tj 0 -25 Td (VALOR TOTAL R$ 2.000,00) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
 let s='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(s));s+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const x=Buffer.byteLength(s);s+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('');s+=`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;return Buffer.from(s);
}
const linha=(texto:string)=>({pagina:1,texto,celulas:[]});
const resposta=()=>({code:200,body:null as any,headers:{} as any,status(n:number){this.code=n;return this;},json(d:any){this.body=d;return this;},setHeader(k:string,v:any){this.headers[k]=v;return this;},send(d:any){this.body=d;return this;}} as any);
const cliente={clienteid:15,razaoSocial:'Cliente de Teste',cnpj:'12.345.678/0001-99'};
test('valida formato, integridade, tamanho e nome do PDF original',()=>{
 const file=validarPdfJose(pdfTeste().toString('base64'),'../../teste\r\n.pdf');assert.ok(file.bytes.equals(pdfTeste()));assert.equal(file.hash.length,64);assert.ok(!/[\r\n/]/.test(file.arquivoNome));
 for(const b of ['abc','PHNjcmlwdD4=',Buffer.from('%PDF-1.4 sem final').toString('base64'),'A'.repeat(7000001)])assert.throws(()=>validarPdfJose(b,'a.pdf'));
});
test('lê PDF real e identifica total, cliente, metragem e preço, sem serviço pago',async()=>{
 const pdf=await lerPdfJose(pdfTeste());const leitura=interpretarPropostaJose(pdf.linhas,[cliente],'Orcamento obra.pdf');
 assert.equal(pdf.paginas,1);assert.equal(leitura.valorTotal,2000);assert.equal(leitura.clienteId,15);assert.equal(leitura.itens.length,1);assert.equal(leitura.itens[0].quantidade,100);assert.equal(leitura.itens[0].valorUnitario,20);assert.equal(leitura.itens[0].unidade,'M2');
});
test('não inventa total, cliente ou metragem diante de documento ambíguo ou digitalizado',()=>{
 const a=interpretarPropostaJose([linha('VALOR TOTAL 1.000,00'),linha('TOTAL GERAL 2.000,00')],[cliente],'proposta.pdf');assert.equal(a.valorTotal,null);assert.equal(a.clienteId,null);
 const b=interpretarPropostaJose([],[],'imagem.pdf');assert.equal(b.valorTotal,null);assert.deepEqual(b.itens,[]);assert.ok(b.avisos.length>=3);
 const c=interpretarPropostaJose([linha('Serviço m2 100 10,00 5.000,00')],[],'a.pdf');assert.equal(c.itens.length,0);
 assert.equal(decimalPt('1.234,56'),1234.56);assert.equal(decimalPt('100.50'),100.5);
});
test('reconhece tabela com quantidade antes da unidade e não usa total errado',()=>{
 const a=interpretarPropostaJose([linha('Pintura 100,00 m² 20,00 2.000,00'),linha('Valor global: R$ 2.000,00')],[],'a.pdf');assert.equal(a.itens[0].quantidade,100);assert.equal(a.itens[0].unidade,'M2');assert.equal(a.valorTotal,2000);
});
test('conferência exige cliente e total e rejeita itens que não somam o orçamento',()=>{
 const ok={titulo:'Obra',clienteId:15,valorTotal:2000,itens:[{descricao:'Pintura',unidade:'M2',quantidade:100,valorUnitario:20}]};
 assert.equal(validarConferenciaJose(ok).itens[0].subtotal,2000);
 for(const b of [{...ok,clienteId:0},{...ok,valorTotal:1000},{...ok,valorTotal:null},{...ok,itens:[{descricao:'Pintura',quantidade:-1,valorUnitario:20}]}])assert.throws(()=>validarConferenciaJose(b));
 assert.equal(validarConferenciaJose({...ok,itens:[]}).total,2000);
});
test('guarda somente no tenant José; SBA e New Floor são barrados antes de qualquer consulta',async()=>{
 const old=prisma.empresa.findFirst;let chamadas=0;
 try{(prisma.empresa as any).findFirst=async()=>{chamadas++;return {empresaid:5};};
 for(const empresaId of [1,2,3,null]){const r=resposta();await somenteJose({empresaId,configuracaoSistema:{modulos:{propostas:true}}} as any,r,()=>assert.fail());assert.equal(r.code,403);}
 assert.equal(chamadas,0);let next=false;await somenteJose({empresaId:5,configuracaoSistema:{modulos:{propostas:true}}} as any,resposta(),()=>{next=true;});assert.equal(next,true);assert.equal(chamadas,1);
 }finally{(prisma.empresa as any).findFirst=old;}
});
test('prévia não salva; importação é atômica, preserva bytes e não fatura automaticamente',async()=>{
 const old={find:prisma.cliente.findFirst,many:prisma.cliente.findMany,tx:prisma.$transaction,ddl:prisma.$executeRawUnsafe,ler:etapasPdfJose.ler};
 const writes:any[]=[];let data:any;
 try{
 (prisma.cliente as any).findFirst=async()=>cliente;(prisma.cliente as any).findMany=async()=>[cliente];(prisma as any).$executeRawUnsafe=async()=>0;
 etapasPdfJose.ler=async()=>({paginas:1,linhas:[linha('VALOR TOTAL 2.000,00')]});
 (prisma as any).$transaction=async(fn:any)=>fn({$queryRaw:async()=>[],proposta:{findMany:async()=>[{numero:'699'}],create:async(args:any)=>{data=args.data;return {propostaid:700,...data};}},$executeRaw:async(...args:any[])=>{writes.push(args);return 1;}});
 const f=validarPdfJose(pdfTeste().toString('base64'),'a.pdf');const req={empresaId:5,body:{arquivo:f.bytes.toString('base64'),nome:'a.pdf',hash:f.hash,titulo:'Obra',clienteId:15,valorTotal:2000,itens:[],confirmado:true}};
 const r=resposta();await importar(req as any,r);assert.equal(r.code,201);assert.equal(data.status,'RASCUNHO');assert.equal(data.origem,'PDF_JOSE');assert.equal(data.subtotal,2000);assert.equal(data.numero,'700');assert.equal(data.empresaId,5);assert.equal(writes.length,1);assert.ok(writes[0].some((v:any)=>Buffer.isBuffer(v)&&v.equals(f.bytes)));
 req.body.hash='outro';const bad=resposta();await importar(req as any,bad);assert.equal(bad.code,400);assert.equal(writes.length,1);
 }finally{(prisma.cliente as any).findFirst=old.find;(prisma.cliente as any).findMany=old.many;(prisma as any).$transaction=old.tx;(prisma as any).$executeRawUnsafe=old.ddl;etapasPdfJose.ler=old.ler;}
});
test('visualização e download devolvem o mesmo PDF privado sem regenerar; outros perfis não consultam',async()=>{
 const old={find:prisma.proposta.findFirst,raw:prisma.$queryRaw};let count=0;
 try{(prisma.proposta as any).findFirst=async()=>{count++;return {origem:'PDF_JOSE'};};(prisma as any).$queryRaw=async()=>[{arquivoNome:'a.pdf',conteudo:pdfTeste()}];
 for(const empresaId of [1,2])assert.equal(await enviarOriginalJose({empresaId,params:{id:'700'}} as any,resposta(),true),false);assert.equal(count,0);
 for(const inline of [true,false]){const r=resposta();assert.equal(await enviarOriginalJose({empresaId:5,params:{id:'700'}} as any,r,inline),true);assert.ok(r.body.equals(pdfTeste()));assert.match(r.headers['Content-Disposition'],inline?/^inline/:/^attachment/);assert.equal(r.headers['Cache-Control'],'private, no-store');}
 }finally{(prisma.proposta as any).findFirst=old.find;(prisma as any).$queryRaw=old.raw;}
});
test('UI exclusiva mantém Kanban, usa PDF original e impede abertura do formulário antigo',()=>{
 const ui=readFileSync(''+__dirname+'/../../web/js/propostas-jose-pdf.js','utf8');
 assert.match(ui,/empresa.empresaid!==5\|\|empresa.slug!=='construarty'/);assert.match(ui,/show.bs.modal/);assert.match(ui,/e.preventDefault\(\);adicionar/);assert.match(ui,/await carregarPropostas/);assert.match(ui,/previsualizarProposta/);assert.match(ui,/visualizarPdfProposta/);assert.ok(!ui.includes('new Sortable'));
 const ct=readFileSync(__dirname+'/../src/controller/ctproposta.ts','utf8');
 const read=ct.slice(ct.indexOf('export const readOne'),ct.indexOf('export const duplicar'));
 assert.ok(!read.includes('enviarOriginalJose'));
 for(const name of ['downloadPdf','visualizarPdf']){const chunk=ct.slice(ct.indexOf('export const '+name));assert.ok(chunk.indexOf('enviarOriginalJose')<chunk.indexOf('gerarPdfInterno'));}
});
