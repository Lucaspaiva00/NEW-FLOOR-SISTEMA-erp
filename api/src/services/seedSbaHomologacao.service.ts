import prisma from "../prisma";

/** Semente única de homologação da SBA. Não transmite e não fatura. */
const MARCADOR="SBA_SEFIN_HOMOLOGACAO_20261023_TESTE_NAO_EMITIR";
const AVISO="SERVIÇO FICTÍCIO PARA HOMOLOGAÇÃO DE DPS. NÃO PRESTADO. NÃO FATURAR OU ENVIAR AO CLIENTE.";
const DIG=(v:any)=>String(v||"").replace(/\D/g,"");
const NORMAL=(v:any)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();

export async function seedHomologacaoSba():Promise<{propostaId:number,numero:string,notaId:number,criado:boolean}> {
 return prisma.$transaction(async tx=>{
   const empresa=await tx.empresa.findUnique({where:{slug:"sba"},select:{empresaid:true,ativo:true}});
   if(!empresa?.ativo||empresa.empresaid!==2)throw Error("Seed SBA: empresa inesperada.");
   // Lock exclusivo somente deste trabalho. Evita duplicatas em reinicializações.
   await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(20261023, 2)::text AS locked");
   const existente=await tx.proposta.findFirst({where:{empresaId:2,origem:MARCADOR},
     select:{propostaid:true,numero:true}});
   if(existente){
     const nota=await tx.notaFiscal.findFirst({
       where:{empresaId:2,propostaId:existente.propostaid,referencia:MARCADOR},
       select:{notafiscalid:true}});
     if(!nota)throw Error("Seed parcial: exige inspeção, não altera registro.");
     return {propostaId:existente.propostaid,numero:existente.numero,notaId:nota.notafiscalid,criado:false};
   }
   const modelo=await tx.proposta.findFirst({where:{empresaId:2,propostaid:114,clienteId:50},include:{itens:true}});
   if(!modelo||modelo.numero!=="652"||modelo.titulo.trim()!=="Mahle Teste"||
      modelo.itens.length!==1||modelo.tipoProposta!=="SERVICOS")
      throw Error("Seed SBA: referência mudou.");
   const cliente=await tx.cliente.findFirst({where:{empresaId:2,clienteid:50}});
   const emissora=await tx.empresaFiscal.findFirst({where:{empresaId:2,empresafiscalid:5,ativo:true}});
   if(!cliente||!emissora||!emissora.certificadoCriptografado||
     emissora.padraoNfse!=="NACIONAL"||emissora.ambiente!=="HOMOLOGACAO"||
     emissora.provedor!=="PORTAL_NACIONAL_DIRETO")
     throw Error("Seed SBA: emissora e A1 precisam estar corretos.");
   if(DIG(cliente.cnpj).length!==14||DIG(cliente.cep).length!==8||
      !cliente.razaoSocial||!cliente.endereco||!cliente.numero||!cliente.bairro||
      NORMAL(cliente.cidade)!=="JAGUARIUNA"||NORMAL(cliente.estado)!=="SP")
     throw Error("Seed SBA: dados reais do tomador incompletos.");
   const existentes=await tx.proposta.findMany({where:{empresaId:2},select:{numero:true}});
   const numeros=new Set(existentes.map(p=>p.numero));
   let sequencia=661;
   while(numeros.has(String(sequencia)))sequencia++;
   if(sequencia>999999)throw Error("Seed SBA: numeração não disponível.");
   const titulo="[TESTE HOMOLOGAÇÃO SEFIN — NÃO EMITIR] DPS de laboratório";
   const descricao="TESTE DE HOMOLOGAÇÃO DPS — SERVIÇO FICTÍCIO NÃO EXECUTADO";
   const valor="1.00";
   const proposta=await tx.proposta.create({
     data:{
       empresaId:2,numero:String(sequencia),titulo,tipoProposta:"SERVICOS",
       descricao:AVISO,escopo:AVISO,observacoesInternas:AVISO,
       origem:MARCADOR,status:"RASCUNHO",subtotal:valor,
       clienteId:cliente.clienteid,
       itens:{create:[{codigo:"SBA-TESTE-DPS",descricao,detalhes:AVISO,
         unidade:"UN",quantidade:1,valorUnitario:valor,subtotal:valor,ordem:1}]}
     },select:{propostaid:true,numero:true}
   });
   const nota=await tx.notaFiscal.create({
     data:{
       empresaId:2,referencia:MARCADOR,tipo:"NFSE",status:"RASCUNHO",
       ambienteEmissao:"HOMOLOGACAO",padraoNfseEmissao:"NACIONAL",
       empresaFiscalId:emissora.empresafiscalid,clienteId:cliente.clienteid,
       propostaId:proposta.propostaid,
       dataEmissao:new Date(),serie:emissora.serieNfse||null,
       destinatarioNome:cliente.razaoSocial,destinatarioCnpj:DIG(cliente.cnpj),
       destinatarioIe:cliente.inscricaoEstadual||null,
       destinatarioCep:DIG(cliente.cep),destinatarioEndereco:cliente.endereco,
       destinatarioNumero:cliente.numero,destinatarioComplemento:cliente.complemento||null,
       destinatarioBairro:cliente.bairro,destinatarioCidade:cliente.cidade,
       destinatarioEstado:cliente.estado,
       destinatarioCodigoMunicipio:"3524709", // IBGE Jaguariúna/SP, fonte oficial
       destinatarioPais:"Brasil",valorServicos:valor,valorTotal:valor,
       informacoesAdicionais:AVISO,
       // Nunca inferir códigos ISS/IBS/CBS, NBS ou cTribNac a partir do CNAE.
       itemListaServico:null,
       payloadExtra:{testeHomologacao:true,marcador:MARCADOR,
         observacao:"Parâmetros tributários e classificação do serviço não confirmados; não emitir.",
         cLocPrestacao:emissora.codigoMunicipioIbge},
       itens:{create:[{codigo:"SBA-TESTE-DPS",descricao,unidade:"UN",
         quantidade:1,valorUnitario:valor,valorBruto:valor,valorDesconto:0,
         informacoesAdicionais:AVISO}]},
       eventos:{create:[{tipo:"CRIACAO_TESTE",status:"RASCUNHO",
         descricao:"Rascunho criado para ensaio de DPS em homologação; sem transmissão e sem financeiro."}]}
     },select:{notafiscalid:true}
   });
   return {propostaId:proposta.propostaid,numero:proposta.numero,notaId:nota.notafiscalid,criado:true};
 },{timeout:15000,maxWait:6000});
}
