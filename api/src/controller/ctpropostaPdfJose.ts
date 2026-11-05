import {Request,Response,NextFunction} from 'express';
import prisma from '../prisma';
import {validarPdfJose,lerPdfJose,interpretarPropostaJose,validarConferenciaJose} from '../services/propostaPdfJose.service';
export async function somenteJose(req:Request,res:Response,next:NextFunction){
 if(req.empresaId!==5||req.configuracaoSistema?.modulos.propostas!==true){res.status(403).json({error:'Importação de propostas disponível somente para José/Construarty.'});return;}
 const e=await prisma.empresa.findFirst({where:{empresaid:5,slug:'construarty',ativo:true},select:{empresaid:true}});
 if(!e){res.status(403).json({error:'Empresa não autorizada.'});return;}next();
}
let preparando:Promise<void>|undefined;
export function prepararTabelaPdfJose(){
 if(!preparando)preparando=(async()=>{
 await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PropostaPdfJose" ("propostaId" INTEGER PRIMARY KEY REFERENCES "Proposta"("propostaid") ON DELETE CASCADE,"empresaId" INTEGER NOT NULL REFERENCES "Empresa"("empresaid"),"arquivoNome" TEXT NOT NULL,"hash" TEXT NOT NULL,"conteudo" BYTEA NOT NULL,"leitura" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "PropostaPdfJose_somente_jose" CHECK ("empresaId"=5))`);
 await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "PropostaPdfJose_empresa_hash" ON "PropostaPdfJose"("empresaId","hash")');
 })().catch(e=>{preparando=undefined;throw e;});return preparando;
}
const handle=(fn:(req:Request,res:Response)=>Promise<void>)=>async(req:Request,res:Response)=>{try{await fn(req,res);}catch(e:any){res.status(e.code==='P2002'||e.code==='P2010'&&e.meta?.code==='23505'?409:400).json({error:e.code==='P2002'||e.meta?.code==='23505'?'Este PDF já foi importado. Localize a proposta no quadro.':e.message||'Não foi possível importar a proposta.'});}};
export const etapasPdfJose={ler:lerPdfJose};
export const previa=handle(async(req,res)=>{
 const file=validarPdfJose(req.body.arquivo,req.body.nome);const pdf=await etapasPdfJose.ler(file.bytes);
 const clientes=await prisma.cliente.findMany({where:{empresaId:5},select:{clienteid:true,razaoSocial:true,nomeFantasia:true,cnpj:true,cpf:true}});
 const leitura=interpretarPropostaJose(pdf.linhas,clientes,file.arquivoNome);
 res.json({...leitura,hash:file.hash,paginas:pdf.paginas,arquivoNome:file.arquivoNome,clientes,texto:leitura.texto});
});
export const importar=handle(async(req,res)=>{
 if(req.body.confirmado!==true)throw Error('Confira os dados extraídos antes de salvar.');
 const file=validarPdfJose(req.body.arquivo,req.body.nome);if(req.body.hash!==file.hash)throw Error('O arquivo mudou. Faça a leitura novamente.');
 const dados=validarConferenciaJose(req.body);
 if(!await prisma.cliente.findFirst({where:{clienteid:dados.clienteId,empresaId:5},select:{clienteid:true}}))throw Error('Cliente não encontrado nesta empresa.');
 // Validar também no salvamento: a prévia não é autorização para gravar bytes arbitrários.
 const pdf=await etapasPdfJose.ler(file.bytes);const leitura=interpretarPropostaJose(pdf.linhas,[],file.arquivoNome);
 await prepararTabelaPdfJose();
 const proposta=await prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT true FROM pg_advisory_xact_lock(5, 1105)`;
 const duplicada:any[]=await tx.$queryRaw`SELECT "propostaId" FROM "PropostaPdfJose" WHERE "empresaId"=5 AND "hash"=${file.hash}`;
 if(duplicada.length)throw Error('Este PDF já está no quadro, na proposta '+duplicada[0].propostaId+'.');
 const existentes=await tx.proposta.findMany({where:{empresaId:5},select:{numero:true}});
 const numero=String(existentes.reduce((n,p)=>/^\d+$/.test(p.numero)?Math.max(n,Number(p.numero)):n,650)+1);
 const itens=dados.itens.length?dados.itens:[{descricao:dados.titulo,unidade:'UN',quantidade:1,valorUnitario:dados.total,subtotal:dados.total,ordem:1}];
 const criada=await tx.proposta.create({data:{empresaId:5,numero,titulo:dados.titulo,clienteId:dados.clienteId,tipoProposta:'SERVICOS',status:'RASCUNHO',subtotal:dados.total,origem:'PDF_JOSE',descricao:'Proposta importada de PDF. Documento original preservado.',itens:{create:itens}},include:{cliente:true,itens:true}});
 await tx.$executeRaw`INSERT INTO "PropostaPdfJose" ("propostaId","empresaId","arquivoNome","hash","conteudo","leitura") VALUES (${criada.propostaid},5,${file.arquivoNome},${file.hash},${file.bytes},${JSON.stringify({...leitura,conferencia:dados,paginas:pdf.paginas})}::jsonb)`;
 return criada;
 },{timeout:15000});res.status(201).json(proposta);
});
/** Guardar o original no banco evita perder arquivos em redeploys. Nenhum acesso público. */
export async function enviarOriginalJose(req:Request,res:Response,inline:boolean):Promise<boolean>{
 if(req.empresaId!==5)return false;
 const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return false;
 const p=await prisma.proposta.findFirst({where:{propostaid:id,empresaId:5},select:{origem:true}});
 if(p?.origem!=='PDF_JOSE')return false;
 await prepararTabelaPdfJose();
 const rows:any[]=await prisma.$queryRaw`SELECT "arquivoNome","conteudo" FROM "PropostaPdfJose" WHERE "propostaId"=${id} AND "empresaId"=5`;
 if(!rows.length){res.status(404).json({error:'PDF original não encontrado. Não será substituído por um PDF gerado.'});return true;}
 res.setHeader('Content-Type','application/pdf');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const nome=rows[0].arquivoNome;res.setHeader('Content-Disposition',`${inline?'inline':'attachment'}; filename="proposta-${id}.pdf"; filename*=UTF-8''${encodeURIComponent(nome)}`);
 res.send(Buffer.from(rows[0].conteudo));return true;
}
export const editar=handle(async(req,res)=>{
 const id=Number(req.params.id),titulo=String(req.body.titulo||'').trim();
 if(!Number.isSafeInteger(id)||id<1||!titulo||titulo.length>250)throw Error('Título ou proposta inválida.');
 const p=await prisma.proposta.findFirst({where:{propostaid:id,empresaId:5}});if(!p||p.origem!=='PDF_JOSE')throw Error('Proposta PDF não encontrada.');
 // Correção do título não altera o orçamento original, o cliente nem o financeiro.
 await prisma.proposta.update({where:{propostaid:id},data:{titulo}});res.json({ok:true});
});
