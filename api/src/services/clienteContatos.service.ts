// Os quatro contatos antigos são preservados; os demais ficam em uma lista expansível.
export const LIMITE_CONTATOS = 50;
export class ContatoInvalido extends Error { statusCode = 400; }
export const emailContatoValido = (v: string) => v.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(v);
export function contatosCliente(cliente: any): any[] {
 return [...Array.from({length:4},(_,i)=>({email:cliente?.[`email${i+1}`]||'',nomeEmail:cliente?.[`nomeEmail${i+1}`]||'',telefone:cliente?.[`telefone${i+1}`]||'',nomeTelefone:cliente?.[`nomeTelefone${i+1}`]||''})),...(Array.isArray(cliente?.contatosAdicionais)?cliente.contatosAdicionais:[])];
}
export function validarContatosAdicionais(valor: unknown) {
 if (!Array.isArray(valor) || valor.length > LIMITE_CONTATOS-4) throw new ContatoInvalido('Cadastre até 50 contatos por cliente.');
 return valor.map((c:any)=>{
  if(!c || typeof c!=='object' || Array.isArray(c))throw new ContatoInvalido('Contato inválido.');
  const result:Record<string,string>={};
  for(const [campo,max] of [['email',254],['nomeEmail',150],['telefone',30],['nomeTelefone',150]] as const){
   if(c[campo]!=null && typeof c[campo]!=='string')throw new ContatoInvalido('Contato inválido.');
   const v=(c[campo]||'').trim();if(v.length>max || /[\r\n]/.test(v))throw new ContatoInvalido('Confira o tamanho e os dados do contato.');result[campo]=v;
  }
  if(result.email && !emailContatoValido(result.email))throw new ContatoInvalido('Informe um e-mail válido em cada contato.');
  return result;
 });
}
export function destinatariosCliente(cliente:any,selecionados:unknown):string[] {
 if(!Array.isArray(selecionados) || !selecionados.length || selecionados.length>LIMITE_CONTATOS)throw new ContatoInvalido('Selecione de 1 a 50 e-mails do cliente.');
 const cadastrados=new Set(contatosCliente(cliente).map(c=>String(c.email).trim().toLowerCase()).filter(Boolean));
 const emails=selecionados.map(v=>typeof v==='string'?v.trim().toLowerCase():'');
 if(emails.some(v=>!emailContatoValido(v)||!cadastrados.has(v)))throw new ContatoInvalido('Selecione somente e-mails cadastrados neste cliente.');
 return [...new Set(emails)];
}
