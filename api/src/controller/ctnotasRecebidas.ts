import {consultarRecebidasAdn,conferirRecebidaAdn} from "../services/recebidasAdnSba.service";
import { Request, Response } from "express";
import prisma from "../prisma";

const DIG = (v:unknown) => String(v??"").replace(/\D/g,"");
const FONTES = {
  NFE: "nfes_recebidas",
  NFSE_NACIONAL: "nfsens_recebidas",
} as const;
type TipoRecebida = keyof typeof FONTES;
const tipoValido = (v:unknown):v is TipoRecebida =>
  typeof v==="string" && Object.hasOwn(FONTES,v);
const dataValida = (v:unknown):v is string =>
  typeof v==="string" && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
const error = (message:string,statusCode=400)=>Object.assign(new Error(message),{statusCode});
async function emissora(req:Request,id:number,paraAcervo=false){
  if(!Number.isSafeInteger(id)||id<=0)throw error("Selecione a empresa receptora.");
  const empresa=await prisma.empresaFiscal.findFirst({
    where:{empresafiscalid:id,empresaId:req.empresaId as number,ativo:true},
    select:{empresafiscalid:true,empresaId:true,cnpj:true,ambiente:true,tokenProducao:true,provedor:true,padraoNfse:true,certificadoCriptografado:true}
  });
  if(!empresa)throw error("Empresa fiscal não encontrada neste acesso.",404);
  // Recebimento de notas reais usa o token de produção, mesmo quando
  // a emissão está em homologação. Nunca alterar o ambiente emissor.
  if(!paraAcervo&&req.configuracaoSistema?.perfil!=="SBA"&&!empresa.tokenProducao)throw error(
    "Configure o token Focus de PRODUÇÃO nesta empresa para consultar notas recebidas reais. A emissão pode continuar em HOMOLOGAÇÃO. Habilite também o produto de recebimento correspondente na Focus.",422);
  if(DIG(empresa.cnpj).length!==14)throw error("CNPJ da empresa receptora inválido.");
  return empresa;
}
async function consultarFocus(empresa:any,tipo:TipoRecebida,versao:number):Promise<{documentos:any[],maxVersion:number,total:number}>{
  if(!Number.isSafeInteger(versao)||versao<0||versao>Number.MAX_SAFE_INTEGER-1)
    throw error("Versão da consulta inválida.");
  const caminho=FONTES[tipo];
  const url=new URL("https://api.focusnfe.com.br/v2/"+caminho);
  url.searchParams.set("cnpj",DIG(empresa.cnpj));
  // Na primeira consulta, omitir versao: a documentação Focus mostra
  // o parâmetro apenas como cursor de paginação, não como versao=0.
  if(versao>0)url.searchParams.set("versao",String(versao));
  const resp=await fetch(url,{
    signal:AbortSignal.timeout(20000),
    headers:{
      Authorization:"Basic "+Buffer.from(empresa.tokenProducao+":").toString("base64"),
      Accept:"application/json"
    }
  });
  if(!resp.ok){
    // Nunca devolver dados completos, token ou corpo bruto do provedor.
    const raw=(await resp.text()).slice(0,1500);
    let codigo="";
    let mensagem="";
    try{
      const parsed=JSON.parse(raw);
      codigo=String(parsed.codigo||parsed.code||"").slice(0,60);
      mensagem=String(parsed.mensagem||parsed.message||parsed.erro||"").slice(0,250);
    }catch(_){}
    const safe=(v:string)=>v.replace(/https?:\/\/\S+/g,"[link]").replace(/\b\d{11,14}\b/g,"[documento]").replace(/[^\w\s\-().,;:áéíóúãõâêôçÁÉÍÓÚÃÕÂÊÔÇ]/g,"").slice(0,250);
    if([401,403].includes(resp.status))throw error(
      "A Focus não autorizou a consulta do CNPJ. Confirme token de produção, certificado e produto de notas recebidas habilitado.",422);
    if(resp.status===400)throw error("A Focus rejeitou a consulta (400). Verifique cadastro/habilitação do recebimento e parâmetros da conta."+
      (codigo||mensagem?" Detalhe: "+safe([codigo,mensagem].filter(Boolean).join(" - ")):""),422);
    if(resp.status===404)throw error("A Focus informou rota ou produto de recebimento indisponível (404). Confirme o serviço habilitado para esse CNPJ.",422);
    throw error("Consulta Focus indisponível (HTTP "+resp.status+").",502);
  }
  const dados=await resp.json();
  if(!Array.isArray(dados))throw error("A Focus retornou uma lista inválida de documentos.",502);
  return {documentos:dados.slice(0,100),maxVersion:Number(resp.headers.get("X-Max-Version")||0),total:Number(resp.headers.get("X-Total-Count")||dados.length)};
}
function normalizar(n:any,tipo:TipoRecebida,cnpj:string){
  const chave=String(n.chave_nfe||n.chave_nfse||n.chave||"").trim();
  const cnpjTomador=DIG(n.cnpj_destinatario||n.documento_tomador||n.cnpj_tomador||"");
  if(cnpjTomador && cnpjTomador!==cnpj) return null;
  if(!chave||chave.length>120) return null;
  const valor=Number(n.valor_total ?? n.valor_servicos ?? n.valor_nota);
  const versao=Number(n.versao);
  if(!Number.isFinite(valor)||valor<=0||!Number.isSafeInteger(versao)||versao<0) return null;
  return {
    tipo,chave,versao,cnpjTomador:cnpj,
    emissor: String(n.nome_emitente||n.nome_prestador||"Fornecedor").slice(0,240),
    documentoEmissor:DIG(n.documento_emitente||n.documento_prestador||""),
    dataEmissao:n.data_emissao||null,valor:Math.round(valor*100)/100,
    situacao:String(n.situacao||n.status||"").toLowerCase(),
    numero:String(n.numero||n.numero_nfse||"").slice(0,70),
  };
}
const respostaErro=(res:Response,e:any)=>{
  console.error("Consulta de notas recebidas:",e?.message);
  res.status(e?.statusCode||502).json({error:e?.message||"Falha ao consultar documentos recebidos."});
};
export const listar=async(req:Request,res:Response):Promise<void>=>{
 try{
  if(!tipoValido(req.query.tipo))throw error("Selecione o tipo de nota recebida.");
  const emp=await emissora(req,Number(req.query.empresaFiscalId));
  const versao=req.query.versao==null?0:Number(req.query.versao);
  const sba=req.configuracaoSistema?.perfil==='SBA';
  if(sba&&(req.empresaId!==2||req.query.tipo!=='NFSE_NACIONAL'))throw error('Na SBA, NFS-e recebidas são consultadas no Portal Nacional. NF-e de mercadorias permanecem na SIEG.',422);
  const consulta=sba?await consultarRecebidasAdn(prisma,emp,versao):await consultarFocus(emp,req.query.tipo,versao);
  const docs=sba?consulta.documentos:consulta.documentos.map((n:any)=>normalizar(n,req.query.tipo as TipoRecebida,DIG(emp.cnpj))).filter(Boolean);
  const chaves=docs.map((d:any)=>"RECEBIDA:"+emp.empresaId+":"+d.tipo+":"+d.chave);
  const existentes=chaves.length?await prisma.lancamentoFinanceiro.findMany({
    where:{empresaId:emp.empresaId,tipo:"SAIDA",chaveOrigem:{in:chaves}},
    select:{chaveOrigem:true,lancamentofinanceiroid:true,status:true}
  }):[];
  res.json({empresaFiscalId:emp.empresafiscalid,tipo:req.query.tipo,versao,proximaVersao:sba?(consulta as any).proximaVersao:Math.max(versao,(consulta as any).maxVersion,...docs.map((d:any)=>d.versao)),total:consulta.total,...(sba?{fonte:'PORTAL_NACIONAL',temMais:(consulta as any).temMais}:{}),
    documentos:docs.map((d:any)=>({...d,contaExistente:existentes.find(x=>x.chaveOrigem==="RECEBIDA:"+emp.empresaId+":"+d.tipo+":"+d.chave)||null})),
    aviso:sba?(consulta as any).aviso:"Somente consulta. A Focus deve ter o recebimento habilitado para o CNPJ; documentos cancelados não devem ser pagos. Uma nota recebida não é, por si só, uma dívida vencida."});
 }catch(e:any){respostaErro(res,e);}
};
export const importarParaPagar=async(req:Request,res:Response):Promise<void>=>{
 try{
  if(req.body?.confirmar!==true)throw error("Confirme a conferência da nota e a criação da conta a pagar.");
  if(!tipoValido(req.body?.tipo))throw error("Tipo de documento inválido.");
  const emp=await emissora(req,Number(req.body.empresaFiscalId));
  const chave=String(req.body?.chave||"").trim();
  const versao=Number(req.body?.versao);
  if(!chave||chave.length>120||!/^[\w-]+$/.test(chave)||!Number.isSafeInteger(versao)||versao<0)
    throw error("Chave ou versão fiscal inválida.");
  if(!dataValida(req.body?.vencimento))throw error("Informe o vencimento acordado com o fornecedor.");
  const sba=req.configuracaoSistema?.perfil==='SBA';
  if(sba&&(req.empresaId!==2||req.body.tipo!=='NFSE_NACIONAL'))throw error('Consulte NFS-e pelo Portal Nacional; mercadorias permanecem na SIEG.');
  const rows=sba?[]:(await consultarFocus(emp,req.body.tipo,Math.max(0,versao-1))).documentos;
  const documento=sba?await conferirRecebidaAdn(prisma,emp,chave,versao):rows.map(n=>normalizar(n,req.body.tipo,DIG(emp.cnpj))).find((d:any)=>d?.chave===chave&&d?.versao===versao);
  if(!documento)throw error("Nota não encontrada na consulta atual da Focus. Atualize a lista para conferir.",409);
  if(!["autorizada","autorizado"].includes(documento.situacao))
    throw error("Somente notas autorizadas podem ser lançadas para pagamento. Confira cancelamentos/substituições.");
  const empresaId=emp.empresaId;
  const origem="RECEBIDA:"+empresaId+":"+req.body.tipo+":"+chave;
  const categoria=await prisma.categoriaFinanceira.upsert({
    where:{empresaId_nome_tipo:{empresaId,nome:"Fornecedores",tipo:"SAIDA"}},
    update:{},create:{empresaId,nome:"Fornecedores",tipo:"SAIDA"}
  });
  const lancamento=await prisma.lancamentoFinanceiro.create({
    data:{
      empresaId,tipo:"SAIDA",status:"ABERTO",origem:"MANUAL",
      chaveOrigem:origem,categoriaFinanceiraId:categoria.categoriafinanceiraid,
      documento:documento.numero||chave,descricao:"Nota recebida "+req.body.tipo+" - "+documento.emissor,
      favorecido:documento.emissor,valor:documento.valor,
      dataCompetencia:documento.dataEmissao&&!Number.isNaN(Date.parse(documento.dataEmissao))?new Date(documento.dataEmissao):new Date(),
      dataVencimento:new Date(req.body.vencimento+"T15:00:00Z"),
      observacoes:"Documento fiscal recebido via "+(sba?"Portal Nacional (ADN)":"Focus NFe")+"; CNPJ emitente: "+documento.documentoEmissor+
        "; chave: "+chave+". Valor bruto. Revisar retenções, condições e quitação antes de baixar.",
    }
  });
  res.status(201).json({lancamentofinanceiroid:lancamento.lancamentofinanceiroid,mensagem:"Conta a pagar criada em aberto. Nenhum pagamento foi realizado."});
 }catch(e:any){
  if(e?.code==="P2002"){res.status(409).json({error:"Esta nota recebida já foi importada para contas a pagar."});return;}
  respostaErro(res,e);
 }
};

import {listarAcervo,sincronizarAcervo,conciliarAcervo} from '../services/acervoNacionalSba.service';
async function empresaAcervo(req:Request){
 if(!(req.empresaId===1||req.empresaId===2&&req.configuracaoSistema?.perfil==='SBA'))throw error('Acervo nacional não habilitado neste perfil.',403);
 return emissora(req,Number(req.query.empresaFiscalId||req.body?.empresaFiscalId),true);
}
export const acervo=async(req:Request,res:Response):Promise<void>=>{try{res.json(await listarAcervo(prisma,await empresaAcervo(req),req.query));}catch(e){respostaErro(res,e);}};
export const sincronizar=async(req:Request,res:Response):Promise<void>=>{try{const emp=await empresaAcervo(req);if(!emp.certificadoCriptografado)throw error('Cadastre o certificado A1 desta empresa no ERP para consultar o Portal Nacional. A emissão em produção pela Focus permanece disponível.',422);res.json(await sincronizarAcervo(prisma,emp));}catch(e){respostaErro(res,e);}};
export const conciliar=async(req:Request,res:Response):Promise<void>=>{try{res.json(await conciliarAcervo(prisma,await empresaAcervo(req),req.body));}catch(e:any){if(e?.code==='P2002'){res.status(409).json({error:'Documento já conciliado. Atualize a lista.'});return;}respostaErro(res,e);}};

export const xmlAcervo=async(req:Request,res:Response):Promise<void>=>{try{const emp=await empresaAcervo(req),chave=String(req.query.chave||'');if(!/^\d{50}$/.test(chave))throw error('Chave inválida.');const rows:any[]=await prisma.$queryRaw`SELECT "xmlCompactado" FROM "DocumentoRecebidoSba" WHERE "empresaId"=${emp.empresaId} AND "empresaFiscalId"=${emp.empresafiscalid} AND chave=${chave}`;if(!rows[0]?.xmlCompactado)throw error('XML ainda não sincronizado. Use Puxar notas.',404);const {gunzipSync}=await import('node:zlib');const xml=gunzipSync(Buffer.from(rows[0].xmlCompactado,'base64'),{maxOutputLength:4000000});res.setHeader('Content-Disposition','attachment; filename="NFSe-'+chave+'.xml"');res.setHeader('Content-Type','application/xml; charset=utf-8');res.setHeader('Cache-Control','no-store');res.send(xml);}catch(e){respostaErro(res,e);}};
