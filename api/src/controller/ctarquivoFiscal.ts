import {Request,Response} from 'express';
import prisma from '../prisma';
export function validarArquivoFiscal(value:any,tipo:'xml'|'pdf'){
 if(value==null)return null;
 const base64=String(value.base64||'');
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)||base64.length>4200000)throw Error('Arquivo inválido ou acima de 3 MB.');
 const bytes=Buffer.from(base64,'base64');if(!bytes.length||bytes.length>3*1024*1024)throw Error('Arquivo inválido ou acima de 3 MB.');
 if(tipo==='pdf'&&bytes.subarray(0,5).toString()!=='%PDF-')throw Error('O arquivo PDF não é válido.');
 if(tipo==='xml'){const xml=bytes.toString('utf8').trim();if(!xml.startsWith('<')||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('XML inválido.');}
 const nome=String(value.nome||'documento.'+tipo).replace(/[\\/\r\n\x00-\x1f]/g,'').slice(0,200);
 return {nome,base64:bytes.toString('base64')};
}
export async function listar(req:Request,res:Response){try{
 const pagina=Math.max(1,Math.min(100000,Math.floor(Number(req.query.pagina))||1));
 const where={empresaId:req.empresaId!};const [total,itens]=await Promise.all([prisma.arquivoFiscal.count({where}),prisma.arquivoFiscal.findMany({where,select:{arquivofiscalid:true,titulo:true,numero:true,createdAt:true,temXml:true,temPdf:true},orderBy:{createdAt:'desc'},skip:(pagina-1)*10,take:10})]);res.json({itens,total,pagina});
 }catch{res.status(500).json({error:'Não foi possível carregar o arquivo fiscal.'});}}
export async function criar(req:Request,res:Response){try{
 const titulo=String(req.body.titulo||'').trim().slice(0,500);if(!titulo)throw Error('Informe uma descrição para o documento.');
 const xml=validarArquivoFiscal(req.body.xml,'xml'),pdf=validarArquivoFiscal(req.body.pdf,'pdf');if(!xml&&!pdf)throw Error('Envie pelo menos um XML ou PDF.');
 const row=await prisma.arquivoFiscal.create({data:{empresaId:req.empresaId!,titulo,numero:String(req.body.numero||'').slice(0,100)||null,temXml:!!xml,temPdf:!!pdf,arquivos:{xml,pdf}},select:{arquivofiscalid:true,titulo:true,numero:true,temXml:true,temPdf:true}});res.status(201).json(row);
 }catch(e:any){res.status(400).json({error:e.message||'Não foi possível arquivar o documento.'});}}
export async function baixar(req:Request,res:Response){try{
 const tipo=String(req.params.tipo);if(!['xml','pdf'].includes(tipo)){res.status(400).json({error:'Formato inválido.'});return;}
 const row=await prisma.arquivoFiscal.findFirst({where:{arquivofiscalid:Number(req.params.id),empresaId:req.empresaId!}}),arquivo=(row?.arquivos as any)?.[tipo];
 if(!arquivo){res.status(404).json({error:'Arquivo não encontrado.'});return;}
 res.setHeader('Content-Type',tipo==='pdf'?'application/pdf':'application/xml');res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`);res.send(Buffer.from(arquivo.base64,'base64'));
 }catch{res.status(500).json({error:'Não foi possível baixar o arquivo.'});}}
