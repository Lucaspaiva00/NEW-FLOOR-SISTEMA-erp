import { Request, Response } from "express";
import prisma from "../prisma";

const DIG = (v:unknown) => String(v??"").replace(/\D/g,"");
const FONTES = {
  NFE: "nfes_recebidas",
  NFSE_NACIONAL: "nfsens_recebidas",
  NFSE_MUNICIPAL: "nfses_recebidas",
} as const;
type TipoRecebida = keyof typeof FONTES;
const tipoValido = (v:unknown):v is TipoRecebida =>
  typeof v==="string" && Object.hasOwn(FONTES,v);
const dataValida = (v:unknown):v is string =>
  typeof v==="string" && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
const error = (message:string,statusCode=400)=>Object.assign(new Error(message),{statusCode});
async function emissora(req:Request,id:number){
  if(!Number.isSafeInteger(id)||id<=0)throw error("Selecione a empresa receptora.");
  const empresa=await prisma.empresaFiscal.findFirst({
    where:{empresafiscalid:id,empresaId:req.empresaId as number,ativo:true},
    select:{empresafiscalid:true,empresaId:true,cnpj:true,ambiente:true,tokenProducao:true}
  });
  if(!empresa)throw error("Empresa fiscal não encontrada neste acesso.",404);
  // Recebimento de notas reais usa o token de produção, mesmo quando
  // a emissão está em homologação. Nunca alterar o ambiente emissor.
  if(!empresa.tokenProducao)throw error(
    "Configure o token Focus de PRODUÇÃO nesta empresa para consultar notas recebidas reais. A emissão pode continuar em HOMOLOGAÇÃO. Habilite também o produto de recebimento correspondente na Focus.",422);
  if(DIG(empresa.cnpj).length!==14)throw error("CNPJ da empresa receptora inválido.");
  return empresa;
}
async function consultarFocus(empresa:any,tipo:TipoRecebida,versao:number):Promise<any[]>{
  if(!Number.isSafeInteger(versao)||versao<0||versao>Number.MAX_SAFE_INTEGER-1)
    throw error("Versão da consulta inválida.");
  const caminho=FONTES[tipo];
  const url=new URL("https://api.focusnfe.com.br/v2/"+caminho);
  url.searchParams.set("cnpj",DIG(empresa.cnpj));
  url.searchParams.set("versao",String(versao));
  const resp=await fetch(url,{
    signal:AbortSignal.timeout(20000),
    headers:{
      Authorization:"Basic "+Buffer.from(empresa.tokenProducao+":").toString("base64"),
      Accept:"application/json"
    }
  });
  if(!resp.ok){
    if([401,403].includes(resp.status))throw error(
      "A Focus não autorizou a consulta de notas recebidas para este CNPJ. Verifique a habilitação do produto e o certificado/token do ambiente de produção.",422);
    throw error("Não foi possível consultar a Focus (HTTP "+resp.status+"). Tente novamente.",502);
  }
  const dados=await resp.json();
  if(!Array.isArray(dados))throw error("A Focus retornou uma lista inválida de documentos.",502);
  return dados.slice(0,100);
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
  const docs=(await consultarFocus(emp,req.query.tipo,versao))
    .map(n=>normalizar(n,req.query.tipo as TipoRecebida,DIG(emp.cnpj))).filter(Boolean);
  const chaves=docs.map((d:any)=>"RECEBIDA:"+emp.empresaId+":"+d.tipo+":"+d.chave);
  const existentes=chaves.length?await prisma.lancamentoFinanceiro.findMany({
    where:{empresaId:emp.empresaId,tipo:"SAIDA",chaveOrigem:{in:chaves}},
    select:{chaveOrigem:true,lancamentofinanceiroid:true,status:true}
  }):[];
  res.json({empresaFiscalId:emp.empresafiscalid,tipo:req.query.tipo,versao,proximaVersao:Math.max(versao,...docs.map((d:any)=>d.versao)),
    documentos:docs.map((d:any)=>({...d,contaExistente:existentes.find(x=>x.chaveOrigem==="RECEBIDA:"+emp.empresaId+":"+d.tipo+":"+d.chave)||null})),
    aviso:"Somente consulta. A Focus deve ter o recebimento habilitado para o CNPJ; documentos cancelados não devem ser pagos. Uma nota recebida não é, por si só, uma dívida vencida."});
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
  const rows=await consultarFocus(emp,req.body.tipo,Math.max(0,versao-1));
  const documento=rows.map(n=>normalizar(n,req.body.tipo,DIG(emp.cnpj))).find((d:any)=>d?.chave===chave&&d?.versao===versao);
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
      observacoes:"Documento fiscal recebido via Focus NFe; CNPJ emitente: "+documento.documentoEmissor+
        "; chave: "+chave+". Valor bruto. Revisar retenções, condições e quitação antes de baixar.",
    }
  });
  res.status(201).json({lancamentofinanceiroid:lancamento.lancamentofinanceiroid,mensagem:"Conta a pagar criada em aberto. Nenhum pagamento foi realizado."});
 }catch(e:any){
  if(e?.code==="P2002"){res.status(409).json({error:"Esta nota recebida já foi importada para contas a pagar."});return;}
  respostaErro(res,e);
 }
};
