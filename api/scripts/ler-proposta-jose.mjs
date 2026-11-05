import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>7100000)throw Error('Arquivo excede 5 MB');}
try{
 const data=Uint8Array.from(Buffer.from(input,'base64'));
 const task=getDocument({data,isEvalSupported:false,useSystemFonts:false,disableFontFace:true,stopAtErrors:true,verbosity:0});
 const doc=await task.promise;if(doc.numPages>60)throw Error('Use um PDF com até 60 páginas.');
 const linhas=[];
 for(let p=1;p<=doc.numPages;p++){
  const page=await doc.getPage(p),text=await page.getTextContent();const rows=[];
  for(const item of text.items){if(!('str' in item)||!item.str.trim())continue;
   const y=item.transform[5],x=item.transform[4];let row=rows.find(r=>Math.abs(r.y-y)<3);
   if(!row){row={y,c:[]};rows.push(row);}row.c.push({x,text:item.str.trim()});
  }
  rows.sort((a,b)=>b.y-a.y);for(const row of rows){row.c.sort((a,b)=>a.x-b.x);linhas.push({pagina:p,texto:row.c.map(c=>c.text).join(' | '),celulas:row.c});}
  if(JSON.stringify(linhas).length>1000000)throw Error('PDF contém dados demais para leitura automática.');page.cleanup();
 }
 await doc.destroy();process.stdout.write(JSON.stringify({paginas:doc.numPages,linhas}));
}catch(e){process.stdout.write(JSON.stringify({erro:e.name==='PasswordException'?'Envie um PDF sem senha.':String(e.message||'PDF não pôde ser lido.').slice(0,300)}));process.exitCode=1;}
