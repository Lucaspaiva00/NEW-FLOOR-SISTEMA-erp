import {DOMParser} from '@xmldom/xmldom';
import QRCode from 'qrcode';
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const NS='http://www.sped.fazenda.gov.br/nfse';
const falha=(message:string)=>Object.assign(Error(message),{statusCode:422});
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const money=(v:string)=>v===''?'-':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pct=(v:string)=>v===''?'-':Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const date=(v:string)=>v.replace(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}:\d{2}).*)?$/,(_,y,m,d,t)=>`${d}/${m}/${y}${t?' '+t:''}`);
const doc=(v:string)=>v.length===14?v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):v.length===11?v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'):v;
const states:Record<string,string>={'11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO','21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL','28':'SE','29':'BA','31':'MG','32':'ES','33':'RJ','35':'SP','41':'PR','42':'SC','43':'RS','50':'MS','51':'MT','52':'GO','53':'DF'};

/** Modelo: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc/nt-008-se-cgnfse-danfse-20260505.pdf
 * DANFSe v2, NT 008/2026. Somente dados do XML autorizado; sem consultas ou emissão. */
export async function montarDanfseSba(xml:string,chaveEsperada:string,cancelada=false):Promise<string>{
 if(xml.length>4*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(xml))throw falha('XML da NFS-e inválido.');
 let invalid=false;
 const d=new DOMParser({onError:()=>{invalid=true;}}).parseFromString(xml,'application/xml');
 const roots=d.getElementsByTagNameNS(NS,'infNFSe');
 const root=roots[0];
 const chave=root?.getAttribute('Id')?.replace(/^NFS/,'');
 if(invalid||roots.length!==1||!/^\d{50}$/.test(chave||'')||chave!==chaveEsperada)throw falha('A chave do XML não corresponde à nota autorizada.');
 const child=(n:any,name:string):any=>Array.from(n?.childNodes||[]).find((e:any)=>e.nodeType===1&&e.namespaceURI===NS&&e.localName===name);
 const val=(p:string,n:any=root):string=>{for(const part of p.split('/'))n=child(n,part);return n?.textContent?.trim()||'';};
 const q=(p:string)=>val('DPS/infDPS/'+p);
 if(q('tpAmb')!=='1'||val('cStat')!=='100'||!val('nNFSe'))throw falha('PDF disponível somente para NFS-e autorizada em produção.');
 const qr=await QRCode.toDataURL('https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave='+chave,{errorCorrectionLevel:'M',margin:1,width:256});
 const logo=fs.readFileSync(path.join(__dirname,'../../public/fiscal/nfse-logo.png')).toString('base64');
 const cell=(label:string,v:string,span=1,cls='')=>`<div class="cell ${cls}" style="grid-column:span ${span}"><b>${esc(label)}</b><div>${esc(v||'-')}</div></div>`;
 const title=(s:string)=>`<div class="section">${esc(s)}</div>`;
 const row=(s:string)=>`<div class="row">${s}</div>`;
 const place=(code:string,name='')=>code?[name||[val('cLocIncid')===code?val('xLocIncid'):'',q('cLocEmi')===code?val('xLocEmi'):'',q('serv/locPrest/cLocPrestacao')===code?val('xLocPrestacao'):''].find(Boolean)||code,states[code.slice(0,2)]||''].filter(Boolean).join(' / '):'-';
 const party=(prefix:string,label:string,emit=false)=>{
  const p=(s:string)=>q(prefix+'/'+s)||(emit?val('emit/'+s):'');
  const addr=emit?'emit/enderNac':'DPS/infDPS/'+prefix+'/end';
  const a=(s:string)=>val(addr+'/'+s);
  const mun=emit?a('cMun'):a('endNac/cMun');
  const cep=emit?a('CEP'):a('endNac/CEP');
  return row(title(label)+cell('CNPJ / CPF / NIF',doc(p('CNPJ')||p('CPF')||p('NIF')))+cell('Indicador Municipal (Inscrição)',p('IM'))+cell('Telefone',p('fone'))
   +cell('Nome / Nome Empresarial',p('xNome'),2)+cell('Município / Sigla UF',place(mun))+cell('Código IBGE / CEP',[mun,cep.replace(/^(\d{5})(\d{3})$/,'$1-$2')].filter(Boolean).join(' / '))
   +cell('Endereço',['xLgr','nro','xCpl','xBairro'].map(a).filter(Boolean).join(', '),2)+cell('E-mail',p('email'),2)
   +(emit?cell('Simples Nacional na Data de Competência',({'1':'Não optante','2':'Optante - MEI','3':'Optante - ME/EPP'} as any)[q('prest/regTrib/opSimpNac')]||'-')+cell('Regime de Apuração Tributária pelo SN',({'1':'Tributos federais e municipal pelo Simples Nacional','2':'Federais pelo SN; ISSQN pela NFS-e','3':'Federais e municipal pela NFS-e'} as any)[q('prest/regTrib/regApTribSN')]||'-',3):''));
 };
 const n=(p:string)=>val(p);
 const ib=(p:string)=>n('IBSCBS/'+p);
 const totalTrib=['Fed','Est','Mun'].map((s,i)=>`${['Federais','Estaduais','Municipais'][i]}: ${pct(q('valores/trib/totTrib/pTotTrib/pTotTrib'+s))}`).join('; ');
 const c=(p:string)=>q('valores/trib/tribMun/'+p);
 const f=(p:string)=>q('valores/trib/tribFed/'+p);
 const disc=(p:string)=>q('valores/vDescCondIncond/'+p);
 const extra=[q('serv/infoCompl/xInfComp'),q('serv/obra/cObra')?'Cod. Obra: '+q('serv/obra/cObra'):'',q('IBSCBS/imovel/inscImobFisc')?'Insc. Imob.: '+q('IBSCBS/imovel/inscImobFisc'):'',n('xOutInf')].filter(Boolean).join(' | ');
 const sum=(...vs:string[])=>vs.some(Boolean)?vs.reduce((s,v)=>s+Number(v||0),0).toFixed(2):'';
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>DANFSe ${esc(n('nNFSe'))}</title><style>
 .watermark{position:fixed;top:45%;left:15%;transform:rotate(-35deg);font:60pt Arial;color:rgba(0,0,0,.35);z-index:10;pointer-events:none}@page{size:A4;margin:2mm}*{box-sizing:border-box}body{margin:0;color:#000;font:7pt 'Microsoft Sans Serif',Arial,sans-serif}main{border:1pt solid #000;min-height:292mm;padding:1mm}.head{display:grid;grid-template-columns:25% 50% 25%;background:#f2f2f2;border-bottom:.5pt solid #000;min-height:12mm;align-items:center}.head img{width:42mm;margin:1mm}.head h1{font:bold 9pt Arial;text-align:center;margin:0}.head aside{font-size:6pt}.head aside strong{font-size:8pt;font-weight:normal}.row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:.5pt solid #000}.cell{padding:.35mm 1mm;min-height:6.4mm;overflow-wrap:anywhere;white-space:pre-wrap}.cell b{display:block;font:bold 6pt Arial;margin-bottom:.15mm;white-space:normal}.section{font:bold 7pt Arial;background:#f2f2f2;padding:1mm;align-self:start;min-height:6.4mm}.identity{display:grid;grid-template-columns:75% 25%;border-bottom:.5pt solid #000}.identity .row{border:0;grid-template-columns:repeat(3,minmax(0,1fr))}.identity .cell b{font-size:7pt;text-transform:uppercase}.qr{text-align:center;padding:1mm 2mm;font-size:6pt}.qr img{width:19mm;height:19mm;display:block;margin:0 auto 1mm}.plain{padding:1mm;font:bold 7pt Arial;border-bottom:.5pt solid #000}.wide{grid-column:span 4}.description{min-height:24mm}.complement{min-height:25mm}.shade{background:#f2f2f2}.identity .shade{background:#f2f2f2}
 </style></head><body>${cancelada?'<div class="watermark">CANCELADA</div>':''}<main><header class="head"><img alt="NFS-e" src="data:image/png;base64,${logo}"><h1>DANFSe v2.0<br>Documento Auxiliar da NFS-e</h1><aside><strong>Município: ${esc(place(q('cLocEmi'),n('xLocEmi')))}</strong><br>Ambiente Gerador: ${n('ambGer')==='2'?'Sefin Nacional':esc(n('ambGer'))}<br>Tipo de Ambiente: Produção</aside></header>
 <div class="identity"><div>${row(cell('Chave de Acesso da NFS-e',chave!,3)+cell('Número da NFS-e',n('nNFSe'))+cell('Competência da NFS-e',date(q('dCompet')))+cell('Data e Hora da Emissão da NFS-e',date(n('dhProc')))+cell('Número da DPS',q('nDPS'))+cell('Série da DPS',q('serie'))+cell('Data e Hora da Emissão da DPS',date(q('dhEmi')))+cell('Emitente da NFS-e',({'1':'Prestador','2':'Tomador','3':'Intermediário'} as any)[q('tpEmit')]||'-',1,'shade')+cell('Situação da NFS-e',cancelada?'NFS-e cancelada':'NFS-e autorizada')+cell('Finalidade',q('IBSCBS/finNFSe')==='0'?'NFS-e regular':q('IBSCBS/finNFSe')))}</div><div class="qr"><img alt="Consulta de autenticidade" src="${qr}">A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e.</div></div>
 ${party('prest','PRESTADOR / FORNECEDOR',true)}${party('toma','TOMADOR / ADQUIRENTE')}
 <div class="plain">${q('IBSCBS/indDest')==='0'?'O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE DA OPERAÇÃO':'DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e'}</div>
 <div class="plain">INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e</div>
 ${row(title('SERVIÇO PRESTADO')+cell('Código de Tributação Nacional / Municipal',[q('serv/cServ/cTribNac'),q('serv/cServ/cTribMun')].filter(Boolean).join(' / '))+cell('Código da NBS',q('serv/cServ/cNBS'))+cell('Local da Prestação / Sigla UF / País',place(q('serv/locPrest/cLocPrestacao'),n('xLocPrestacao')))+cell('Descrição do Código de Tributação Nacional / Municipal',n('xTribMun')||n('xTribNac'),4)+cell('Descrição do Serviço',q('serv/cServ/xDescServ'),4,'description'))}
 ${row(title('TRIBUTAÇÃO MUNICIPAL (ISSQN)')+cell('Tipo de Tributação do ISSQN',({'1':'Operação tributável','2':'Imunidade','3':'Exportação de serviço','4':'Não incidência'} as any)[c('tribISSQN')]||'-')+cell('Município / Sigla UF / País de Incidência do ISSQN',place(n('cLocIncid'),n('xLocIncid')),2)+cell('Regime Especial de Tributação do ISSQN',q('prest/regTrib/regEspTrib')==='0'?'Nenhum':q('prest/regTrib/regEspTrib'))+cell('Tipo de Imunidade do ISSQN',c('tpImunidade'))+cell('Suspensão da Exigibilidade do ISSQN',c('exigSusp/tpSusp'))+cell('Número Processo Suspensão',c('exigSusp/nProcesso'))+cell('Benefício Municipal',n('valores/tpBM'))+cell('Cálculo do BM',money(n('valores/vCalcBM')))+cell('Total Deduções / Reduções',money(sum(n('valores/vCalcDR'),ib('valores/vCalcReeRepRes'))))+cell('Desconto Incondicionado',money(disc('vDescIncond')))+cell('BC ISSQN',money(n('valores/vBC')))+cell('Alíquota Aplicada',pct(n('valores/pAliqAplic')))+cell('Retenção do ISSQN',({'1':'Não retido','2':'Retido pelo tomador','3':'Retido pelo intermediário'} as any)[c('tpRetISSQN')]||'-')+cell('ISSQN Apurado',money(n('valores/vISSQN'))))}
 ${row(title('TRIBUTAÇÃO FEDERAL (EXCETO CBS)')+cell('IRRF',money(f('vRetIRRF')))+cell('Contribuição Previdenciária - Retida',money(f('vRetCP')))+cell('Contribuições Sociais - Retidas',money(f('vRetCSLL')))+cell('PIS - Débito Apuração Própria',money(f('piscofins/vPis')))+cell('COFINS - Débito Apuração Própria',money(f('piscofins/vCofins')))+cell('Descrição Contribuições Sociais - Retidas',f('piscofins/tpRetPisCofins'),2))}
 ${row(title('TRIBUTAÇÃO IBS / CBS')+cell('CST / cClassTrib',[q('IBSCBS/valores/trib/gIBSCBS/CST'),q('IBSCBS/valores/trib/gIBSCBS/cClassTrib')].filter(Boolean).join(' / '))+cell('Indicador de Operação / Código IBGE Incidência / Município / Sigla UF',[q('IBSCBS/cIndOp'),ib('cLocalidadeIncid'),place(ib('cLocalidadeIncid'),ib('xLocalidadeIncid'))].filter(Boolean).join(' / '),2)+cell('Exclusões e Reduções da Base de Cálculo',money(sum(disc('vDescIncond'),ib('valores/vCalcReeRepRes'),n('valores/vCalcDR'))))+cell('Base de Cálculo Após Exclusões e Reduções',money(ib('valores/vBC')))+cell('Redução Alíquota IBS / CBS',[pct(ib('valores/uf/pRedAliqUF')),pct(ib('valores/mun/pRedAliqMun')),pct(ib('valores/fed/pRedAliqCBS'))].join(' / '))+cell('Alíquota IBS UF / IBS Mun',[pct(ib('valores/uf/pIBSUF')),pct(ib('valores/mun/pIBSMun'))].join(' / '))+cell('Alíquota Efetiva Municipal - IBS',pct(ib('valores/mun/pAliqEfetMun')))+cell('Valor Apurado Municipal - IBS',money(ib('totCIBS/gIBS/gIBSMunTot/vIBSMun')))+cell('Alíquota Efetiva Estadual - IBS',pct(ib('valores/uf/pAliqEfetUF')))+cell('Valor Apurado Estadual - IBS',money(ib('totCIBS/gIBS/gIBSUFTot/vIBSUF')))+cell('Valor Total Apurado - IBS',money(ib('totCIBS/gIBS/vIBSTot')))+cell('Alíquota - CBS',pct(ib('valores/fed/pCBS')))+cell('Alíquota Efetiva - CBS',pct(ib('valores/fed/pAliqEfetCBS')))+cell('Valor Total Apurado - CBS',money(ib('totCIBS/gCBS/vCBS'))))}
 ${row(title('VALOR TOTAL DA NFS-e')+cell('VALOR DA OPERAÇÃO / SERVIÇO',money(q('valores/vServPrest/vServ')))+cell('Desconto Incondicionado',money(disc('vDescIncond')))+cell('Desconto Condicionado',money(disc('vDescCond')))+cell('Total das Retenções (ISSQN / Federais)',money(n('valores/vTotalRet')))+cell('VALOR LÍQUIDO DA NFS-e',money(n('valores/vLiq')))+cell('Total do IBS/CBS',money(sum(ib('totCIBS/gIBS/vIBSTot'),ib('totCIBS/gCBS/vCBS'))))+cell('VALOR LÍQUIDO DA NFS-e + IBS/CBS',money(ib('totCIBS/vTotNF')),1,'shade'))}
 <div class="section">INFORMAÇÕES COMPLEMENTARES</div><div class="cell complement">${esc(extra||'-')}<br><br>${esc('Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: '+totalTrib)}</div></main></body></html>`;
}
export async function gerarDanfseSba(xml:string,chave:string,cancelada=false):Promise<Buffer>{
 const html=await montarDanfseSba(xml,chave,cancelada);
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();
  await page.setViewport({width:778,height:1123});
  await page.emulateMediaType('print');
  await page.setJavaScriptEnabled(false);
  await page.setRequestInterception(true);
  page.on('request',r=>r.url().startsWith('data:')?r.continue():r.abort());
  await page.setContent(html,{waitUntil:'load',timeout:20000});
  // Nunca recortar silenciosamente conteúdo nem produzir um DANFSe com várias páginas.
  const height=await page.evaluate(()=>document.querySelector('main')!.getBoundingClientRect().height);
  if(height>1108)throw falha('Conteúdo excede uma página do DANFSe. Baixe o XML para conferência.');
  return Buffer.from(await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,timeout:20000}));
 }finally{await browser.close();}
}
