import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
export const EMPRESA_JOSE=5;
export type LinhaPdf={pagina:number,texto:string,celulas:{x:number,text:string}[]};
export function validarPdfJose(base64:unknown,nome:unknown){
 if(typeof base64!=='string'||base64.length>7_000_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw Error('Envie um PDF de até 5 MB.');
 const bytes=Buffer.from(base64,'base64');
 if(bytes.length>5*1024*1024||bytes.subarray(0,5).toString()!=='%PDF-'||!bytes.subarray(-2048).includes(Buffer.from('%%EOF')))throw Error('Arquivo PDF inválido ou acima de 5 MB.');
 const arquivoNome=String(nome||'proposta.pdf').replace(/[\\/\x00-\x1f\x7f]/g,'_').slice(0,180);
 return {bytes,arquivoNome,hash:createHash('sha256').update(bytes).digest('hex')};
}
export function decimalPt(texto:string){
 let s=texto.replace(/R\$|\s/g,'');if(!/^\d+(?:[.,]\d+)*$/.test(s))return NaN;
 if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
 else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
 return Number(s);
}
const normal=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function interpretarPropostaJose(linhas:LinhaPdf[],clientes:any[],nome:string){
 const avisos:string[]=[];const texto=linhas.map(l=>l.texto).join('\n');
 const titulo=nome.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ').slice(0,250);
 const identificados=clientes.filter(c=>{
  const documento=String(c.cnpj||c.cpf||'').replace(/\D/g,'');
  return documento.length>=11&&texto.replace(/[^\d\n]/g,'').includes(documento)||linhas.some(l=>/cliente|contratante|tomador/i.test(l.texto)&&[c.razaoSocial,c.nomeFantasia].some(n=>n&&normal(n).length>4&&normal(l.texto).includes(normal(n))));
 });
 const totais=linhas.map(l=>({...l,texto:l.texto.replace(/\s*\|\s*/g,' ')})).filter(l=>/\b(total\s*(?:geral|da proposta|do or[cç]amento|dos servi[cç]os)|valor\s*(?:total|global)|investimento\s*total)\b|^\s*total\s*[:\s]/i.test(l.texto))
 .map(l=>{const valores=l.texto.match(/(?:R\$\s*)?\d[\d.]*,\d{2}\b/g);return valores?.length?decimalPt(valores[valores.length-1]):NaN;}).filter(v=>v>0&&v<1e8);
 const unicos=[...new Set(totais)];const valorTotal=unicos.length===1?unicos[0]:null;
 if(valorTotal===null)avisos.push(unicos.length>1?'Há mais de um total no PDF. Confira o valor total.':'Não foi possível identificar o valor total. Informe-o para o quadro.');
 if(identificados.length!==1)avisos.push('Selecione o cliente cadastrado ao qual esta proposta pertence.');
 // Só reconhecer linhas com unidade, quantidade e dois preços; jamais inferir metragem pelo total.
 const itens:any[]=[];
 for(const l of linhas){
  const s=l.texto.replace(/\s*\|\s*/g,' ').replace(/m²/gi,'m2').replace(/m³/gi,'m3');
  const m=s.match(/^(.{3,300}?)\s+(m2|m3|m|un|und|kg|h|ha|vb)\s+([\d.,]+)\s+(?:R\$\s*)?([\d.,]+)\s+(?:R\$\s*)?([\d.,]+)\s*$/i)
    ||s.match(/^(.{3,300}?)\s+([\d.,]+)\s+(m2|m3|m|un|und|kg|h|ha|vb)\s+(?:R\$\s*)?([\d.,]+)\s+(?:R\$\s*)?([\d.,]+)\s*$/i)?.map((v,i,a)=>i===2?a[3]:i===3?a[2]:v);
  if(!m)continue;
  const quantidade=decimalPt(m[3]),valorUnitario=decimalPt(m[4]),subtotal=decimalPt(m[5]);
  if(![quantidade,valorUnitario,subtotal].every(v=>Number.isFinite(v)&&v>0&&v<1e8)||Math.abs(quantidade*valorUnitario-subtotal)>Math.max(0.05,quantidade*0.005))continue;
  itens.push({descricao:m[1].trim(),unidade:m[2].toUpperCase(),quantidade,valorUnitario,subtotal,pagina:l.pagina});if(itens.length===200)break;
 }
 if(!itens.length)avisos.push('Metragens e preços unitários não foram reconhecidos com segurança. O PDF original será preservado.');
 else avisos.push('Confira as metragens e preços identificados antes de salvar.');
 return {titulo,clienteId:identificados.length===1?identificados[0].clienteid:null,valorTotal,itens,avisos,texto: texto.slice(0,100000)};
}
export function lerPdfJose(bytes:Buffer):Promise<{paginas:number,linhas:LinhaPdf[]}>{
 return new Promise((resolvePromise,reject)=>{
 const child=spawn(process.execPath,['--max-old-space-size=256',resolve(process.cwd(),'scripts/ler-proposta-jose.mjs')],{stdio:['pipe','pipe','pipe'],env:{PATH:process.env.PATH}});
 let out='',done=false;const end=(err?:Error,value?:any)=>{if(done)return;done=true;clearTimeout(timer);child.kill();err?reject(err):resolvePromise(value);};
 const timer=setTimeout(()=>end(Error('A leitura excedeu o tempo limite. Tente um PDF menor.')),25000);
 child.stdout.setEncoding('utf8');child.stdout.on('data',c=>{out+=c;if(out.length>1_100_000)end(Error('PDF excede o limite de leitura.'));});child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
 child.on('error',()=>end(Error('Leitor de PDF indisponível.')));child.on('close',()=>{try{const d=JSON.parse(out.slice(out.indexOf('{')));if(d.erro)throw Error(d.erro);if(!Array.isArray(d.linhas))throw Error();end(undefined,d);}catch(e:any){end(Error(e.message||'Não foi possível ler este PDF.'));}});child.stdin.end(bytes.toString('base64'));
 });
}
export function validarConferenciaJose(body:any){
 const titulo=String(body.titulo||'').trim();const clienteId=Number(body.clienteId),total=Number(body.valorTotal);
 if(!titulo||titulo.length>250)throw Error('Confira o título da proposta.');
 if(!Number.isSafeInteger(clienteId)||clienteId<1)throw Error('Selecione o cliente.');
 if(body.valorTotal==null||body.valorTotal===''||!Number.isFinite(total)||total<=0||total>=1e8||Math.abs(total*100-Math.round(total*100))>0.001)throw Error('Confira o valor total da proposta.');
 const entrada=body.itens??[];if(!Array.isArray(entrada)||entrada.length>200)throw Error('Lista de itens inválida.');
 const itens=entrada.map((i:any,index:number)=>{const descricao=String(i.descricao||'').trim(),unidade=String(i.unidade||'UN').trim().slice(0,10),quantidade=Number(i.quantidade),valorUnitario=Number(i.valorUnitario);
 if(!descricao||descricao.length>500||![quantidade,valorUnitario].every(v=>Number.isFinite(v)&&v>0&&v<1e8&&Math.abs(v*100-Math.round(v*100))<0.001))throw Error('Confira a descrição, quantidade e valor dos itens.');
 const subtotal=Math.round(quantidade*valorUnitario*100)/100;if(subtotal>=1e8)throw Error('Valor de item acima do limite.');return {descricao,unidade,quantidade,valorUnitario,subtotal,ordem:index+1};});
 if(itens.length&&Math.abs(itens.reduce((s,i)=>s+i.subtotal,0)-total)>0.02)throw Error('A soma dos itens difere do total. Corrija os itens ou guarde somente o total do PDF.');
 return {titulo,clienteId,total,itens};
}
