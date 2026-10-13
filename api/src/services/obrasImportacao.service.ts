import ExcelJS from 'exceljs';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {data,id,texto,numero,dinheiro} from './obras.service';
import {bloqueio,carregarObra,salvarPlanejamento,historico} from './obrasOperacao.service';
const normal=(v:any)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toUpperCase();
const valor=(c:any)=>{const v=c?.value;if(v&&typeof v==='object'&&!(v instanceof Date))return v.result??v.text??v.richText?.map((r:any)=>r.text).join('')??'';return v??'';};
const dia=(v:any)=>v instanceof Date?v.toISOString().slice(0,10):null;
export function extrairPlanilha(w:any,ano:number){
 if(!Number.isInteger(ano)||ano<2000||ano>2100)throw Error('Informe o ano dos cabeçalhos sem ano.');
 const colaboradores:any[]=[],presencas:any[]=[],planejamento:any[]=[],despesas:any[]=[],avisos:string[]=[];
 const quinzena=w.worksheets.find((s:any)=>normal(s.name)==='CONTROLE QUINZENAL'),cronograma=w.worksheets.find((s:any)=>normal(s.name)==='CRONOGRAMA'),gasolina=w.worksheets.find((s:any)=>normal(s.name)==='GASOLINA');
 if(!quinzena&&!cronograma&&!gasolina)throw Error('Arquivo sem as abas Controle Quinzenal, CRONOGRAMA ou GASOLINA.');
 if(quinzena){let anoAtual=ano,mesAnterior=0;const dias:Record<number,string>={};for(let c=4;c<=quinzena.columnCount;c++){const v=valor(quinzena.getCell(1,c));const m=String(v).match(/^(\d{1,2})\/(\d{1,2})$/);if(m){const mes=Number(m[2]);if(mesAnterior&&mes<mesAnterior)anoAtual++;mesAnterior=mes;dias[c]=data(`${anoAtual}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`).toISOString().slice(0,10);}else if(dia(v))dias[c]=dia(v)!;}
  for(let r=3;r<=quinzena.rowCount;r++){const nome=String(valor(quinzena.getCell(r,1))).trim(),funcao=String(valor(quinzena.getCell(r,2))).trim(),diaria=Number(valor(quinzena.getCell(r,3)));if(!nome||!funcao||!Number.isFinite(diaria)||diaria<=0)continue;
   colaboradores.push({origem:`Controle Quinzenal!A${r}`,nome,funcao,diaria});for(const [c,d] of Object.entries(dias)){const v=normal(valor(quinzena.getCell(r,Number(c))));if(['P','F'].includes(v))presencas.push({origem:`Controle Quinzenal!${quinzena.getCell(r,Number(c)).address}`,nome,data:d,fracao:v==='P'?1:0,diaria});else if(v)avisos.push(`Controle Quinzenal linha ${r}: presença '${v}' não reconhecida.`);}
  }
 }
 if(cronograma)for(let r=2;r<=cronograma.rowCount;r++){const d=dia(valor(cronograma.getCell(r,1)));if(!d)continue;for(let c=2;c<=cronograma.columnCount;c++){const obra=String(valor(cronograma.getCell(1,c))).trim(),v=String(valor(cronograma.getCell(r,c))).trim();if(!obra||!v||/^[-\s]+$/.test(v))continue;for(const nome of v.split(',').map((x:string)=>x.trim()).filter(Boolean))planejamento.push({origem:`CRONOGRAMA!${cronograma.getCell(r,c).address}:${nome}`,obra,nome,data:d,fracao:1});}}
 if(gasolina)for(let c=1;c<=gasolina.columnCount;c++)for(let cab=1;cab<=4;cab++){if(normal(valor(gasolina.getCell(cab,c)))!=='DATA'||normal(valor(gasolina.getCell(cab,c+1)))!=='VALOR')continue;for(let r=cab+1;r<=gasolina.rowCount;r++){const v=valor(gasolina.getCell(r,c+1));if(typeof v!=='number'||v<=0)continue;const d=dia(valor(gasolina.getCell(r,c))),nome=String(valor(gasolina.getCell(r,c+2))).trim();if(!d){avisos.push(`GASOLINA!${gasolina.getCell(r,c+1).address}: valor sem data, não importado.`);continue;}despesas.push({origem:`GASOLINA!${gasolina.getCell(r,c+1).address}`,data:d,nome,valor:v});}}
 if(colaboradores.length+presencas.length+planejamento.length+despesas.length>6000)throw Error('A planilha excede 6.000 registros. Divida o arquivo.');
 return {colaboradores,presencas,planejamento,despesas,avisos,nomes:[...new Set([...colaboradores,...presencas,...planejamento,...despesas].map(x=>x.nome).filter(Boolean))].sort(),obras:[...new Set(planejamento.map(x=>x.obra))].sort()};
}
export async function lerArquivo(base64:any,ano:any){
 if(typeof base64!=='string'||base64.length>7000000||!/^[A-Za-z0-9+/=]+$/.test(base64))throw Error('Envie um XLSX de até 5 MB.');const bytes=Buffer.from(base64,'base64');if(bytes.slice(0,2).toString()!=='PK')throw Error('Arquivo XLSX inválido.');const w=new ExcelJS.Workbook();await w.xlsx.load(bytes as any,{ignoreNodes:['drawing','picture','extLst','conditionalFormatting']});return {...extrairPlanilha(w,Number(ano)),hash:createHash('sha256').update(bytes).digest('hex')};
}
export function assinarPrevia(empresaId:number,hash:string,ano:number){return createHmac('sha256',String(process.env.JWT_SECRET||'')).update(`${empresaId}:${hash}:${ano}`).digest('hex');}
export async function importar(db:any,empresaId:number,preview:any,b:any,usuarioId?:number){
 const expected=Buffer.from(assinarPrevia(empresaId,preview.hash,Number(b.ano)),'hex'),received=Buffer.from(String(b.assinatura||''),'hex');if(received.length!==expected.length||!timingSafeEqual(received,expected))throw Error('Revise a prévia antes de importar.');
 await bloqueio(db,empresaId);const maps=b.nomes||{},mapsObras=b.obras||{},resultado={colaboradores:0,presencas:0,planejamento:0,despesas:0,jaImportados:0,ignorados:0};
 const registros=[...(b.importarColaboradores?preview.colaboradores.map((r:any)=>({...r,tipo:'colaborador'})):[]),...(b.importarPresencas?preview.presencas.map((r:any)=>({...r,tipo:'presenca'})):[]),...(b.importarPlanejamento?preview.planejamento.map((r:any)=>({...r,tipo:'planejamento'})):[]),...(b.importarDespesas?preview.despesas.map((r:any)=>({...r,tipo:'despesa'})):[])];
 if(!registros.length)throw Error('Escolha pelo menos um controle para importar.');
 const criados=new Map<string,number>();
 async function pessoa(nome:string,obrigatorio=true){const escolha=maps[nome];if(escolha==='ignorar'||(!escolha&&!obrigatorio))return null;if(!escolha)throw Error(`Vincule o colaborador '${nome}' ou escolha ignorar.`);
  if(String(escolha).startsWith('novo:')){const nomeNovo=String(escolha).slice(5),cad=preview.colaboradores.find((c:any)=>c.nome===nomeNovo);if(!cad)throw Error('Novo colaborador não existe na aba de cadastro.');if(criados.has(nomeNovo))return criados.get(nomeNovo)!;
   const existentes=await db.colaboradorObra.findMany({where:{empresaId,nome:{equals:cad.nome,mode:'insensitive'}}});if(existentes.length>1)throw Error('Nomes duplicados; escolha o cadastro existente.');const c=existentes[0]||await db.colaboradorObra.create({data:{empresaId,nome:cad.nome,funcao:cad.funcao,diaria:dinheiro(numero(cad.diaria,0.01))}});criados.set(nomeNovo,c.id);if(!existentes.length)resultado.colaboradores++;return c.id;
  }const colaboradorId=id(escolha);if(!await db.colaboradorObra.findFirst({where:{id:colaboradorId,empresaId,ativo:true}}))throw Error(`Colaborador '${nome}' não pertence à empresa ou está inativo.`);return colaboradorId;
 }
 for(const r of registros){const chave=`${empresaId}:${preview.hash}:${r.tipo}:${r.origem}`;if(await db.importacaoObra.findUnique({where:{chave}})){resultado.jaImportados++;continue;}
  if(r.tipo==='colaborador'){const escolha=maps[r.nome];if(!escolha||escolha==='ignorar'){resultado.ignorados++;continue;}const colaboradorId=await pessoa(r.nome);await db.importacaoObra.create({data:{empresaId,chave,dados:{colaboradorId,origem:r.origem}}});continue;}
  const escolhaObra=r.tipo==='planejamento'?mapsObras[r.obra]:(b.obrasLinhas?.[r.origem]||b.obraPadraoId);if(escolhaObra==='ignorar'){resultado.ignorados++;continue;}if(!escolhaObra)throw Error(`Vincule a obra de ${r.origem}.`);const obraId=id(escolhaObra);await carregarObra(db,empresaId,obraId);
  const colaboradorId=r.nome?await pessoa(r.nome,r.tipo!=='despesa'):null;if(!colaboradorId&&r.tipo!=='despesa'){resultado.ignorados++;continue;}if(r.tipo==='despesa'&&r.nome&&maps[r.nome]==='ignorar'){resultado.ignorados++;continue;}
  let registro:any;
  if(r.tipo==='planejamento'){const antigo=await db.planejamentoObra.findUnique({where:{empresaId_colaboradorId_data_obraId:{empresaId,colaboradorId:colaboradorId!,data:data(r.data),obraId}}});if(antigo)throw Error(`Já existe planejamento em ${r.origem}; revise antes de importar.`);registro=await salvarPlanejamento(db,empresaId,{obraId,colaboradorId,data:r.data,fracao:numero(b.fracoes?.[r.origem]??r.fracao,0.01,1),observacoes:'Importado de '+r.origem},usuarioId);resultado.planejamento++;}
  if(r.tipo==='presenca'){
   const dia=data(r.data),linhas=await db.apontamentoObra.findMany({where:{empresaId,colaboradorId,data:dia}});if(linhas.some((a:any)=>a.obraId===obraId))throw Error(`Já existe apontamento em ${r.origem}. A importação não sobrescreve registros.`);if(linhas.reduce((s:number,a:any)=>s+Number(a.fracao),r.fracao)>1.00001)throw Error('A presença importada excede uma diária.');
   registro=await db.apontamentoObra.create({data:{empresaId,obraId,colaboradorId,data:dia,fracao:r.fracao,diaria:r.diaria,observacoes:'Importado de '+r.origem}});resultado.presencas++;
  }
  if(r.tipo==='despesa'){
   const valor=dinheiro(numero(r.valor,0.01)),dia=data(r.data),l=await db.lancamentoFinanceiro.create({data:{empresaId,origem:'OBRA',tipo:'SAIDA',valor,descricao:`Combustível importado · ${r.nome||'sem colaborador'} · obra #${obraId}`,dataCompetencia:dia,dataVencimento:dia,chaveOrigem:'importacao:'+chave}});
   registro=await db.despesaObra.create({data:{empresaId,obraId,colaboradorId,categoria:'Combustível',descricao:`${r.nome||'Não informado'} · ${r.origem}`,data:dia,valor,lancamentoId:l.lancamentofinanceiroid}});resultado.despesas++;
  }
  await db.importacaoObra.create({data:{empresaId,chave,dados:{registroId:registro.id,tipo:r.tipo,origem:r.origem}}});
  if(r.tipo!=='planejamento')await historico(db,empresaId,obraId,usuarioId,'IMPORTAR_'+r.tipo.toUpperCase(),null,{id:registro.id,origem:r.origem});
 }return resultado;
}
