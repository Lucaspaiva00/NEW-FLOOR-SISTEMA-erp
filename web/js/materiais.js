(()=>{
const $=id=>document.getElementById(id),token=JSON.parse(localStorage.getItem("usuarioLogado")||"null")?.token;
const keys="codigo nome classificacao tipo codigoBarras codigoFabricante fabricante fornecedor unidade unidadeCompra grupo secao centroCusto ncm cest nbs regraFiscal origem custo estoqueFisico estoqueFiscal preFaturado disponivel especificacao observacoes".split(" ");let fotos=[], catalogo=[];
const modal = new bootstrap.Modal($("modalMaterial"));
$("modalMaterial").addEventListener("shown.bs.modal",()=>$("nome").focus());
async function api(path,method="GET",body){const res=await fetch(API_URL+path,{method,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});const data=await res.json();if(!res.ok)throw Error(data.error||"Erro ao salvar");return data;}
function preview(){ $("previewFotos").replaceChildren();fotos.forEach((src,index)=>{const tile=document.createElement("div");tile.className="photo-tile";const img=document.createElement("img");img.src=src;img.alt="Foto do material "+(index+1);const btn=document.createElement("button");btn.type="button";btn.textContent="Remover";btn.onclick=()=>{fotos.splice(index,1);preview();};tile.append(img,btn);$("previewFotos").append(tile);});}
function novo(){ $("formMaterial").reset();$("materialId").value="";$("tituloFormulario").textContent="Cadastrar material";$("mensagem").textContent="";fotos=[];preview();tabelas.forEach(k=>modos[k]="margem");atualizarResumos(false);}
function editar(s){novo();$("materialId").value=s.servicoid;$("tituloFormulario").textContent="Editar material";const d={...s.dadosMaterial,...s};keys.forEach(k=>$(k).value=d[k]??"");$("ativo").checked=s.ativo;for(const k of ["vista","28","35","padrao"]){$("margem"+k).value=s.dadosMaterial.precos?.[k]?.margem??"";$("preco"+k).value=s.dadosMaterial.precos?.[k]?.valor??"";}fotos=[...(s.dadosMaterial.fotos||[])];preview();tabelas.forEach(k=>modos[k]=$("preco"+k).value!==""?"preco":"margem");atualizarResumos(false);modal.show();}
function renderizar(){
 const termo=$("buscaMaterial").value.trim().toLocaleLowerCase("pt-BR");const lista=catalogo.filter(s=>[s.nome,s.codigo,s.dadosMaterial.fornecedor].some(v=>String(v||"").toLocaleLowerCase("pt-BR").includes(termo)));$("listaMateriais").replaceChildren();
 if(!lista.length){const empty=document.createElement("div");empty.className="catalog-empty";const title=document.createElement("strong");title.textContent=termo?"Nenhum resultado encontrado":"Seu catálogo começa aqui";empty.append(title,document.createTextNode(termo?"Tente outro nome, código ou fornecedor.":"Cadastre o primeiro material para usá-lo nos orçamentos."));$("listaMateriais").append(empty);return;}
 for(const s of lista){const row=document.createElement("div");row.className="material-list-row";let thumb;if(s.dadosMaterial.fotos?.[0]){thumb=document.createElement("img");thumb.src=s.dadosMaterial.fotos[0];thumb.alt="Foto de "+s.nome;}else{thumb=document.createElement("div");thumb.textContent=String(s.nome).charAt(0).toUpperCase();}thumb.className="material-thumb";const info=document.createElement("div");const name=document.createElement("div");name.className="material-name";name.textContent=s.nome;const meta=document.createElement("div");meta.className="material-meta";meta.textContent=[s.codigo,s.dadosMaterial.fornecedor,s.unidade].filter(Boolean).join(" · ")||"Sem código informado";info.append(name,meta);const cost=document.createElement("div");cost.className="material-cost";const label=document.createElement("small");label.textContent="Custo unitário";cost.append(label,document.createTextNode(Number(s.custo||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})));const status=document.createElement("span");status.className="material-status"+(s.ativo?"":" inactive");status.textContent=s.ativo?"Ativo":"Inativo";const btn=document.createElement("button");btn.type="button";btn.className="material-edit";btn.textContent="Editar";btn.setAttribute("aria-label","Editar "+s.nome);btn.onclick=()=>editar(s);row.append(thumb,info,cost,status,btn);$("listaMateriais").append(row);}
}
async function listar(){const data=await api("/servicos");catalogo=data.filter(s=>s.dadosMaterial);$("totalMateriais").textContent=catalogo.length;$("totalAtivos").textContent=catalogo.filter(s=>s.ativo).length;$("totalComCusto").textContent=catalogo.filter(s=>Number(s.custo)>0).length;renderizar();}
$("buscaMaterial").oninput=renderizar;$("novoTopo").onclick=()=>{novo();modal.show();};
const tabelas=["vista","28","35","padrao"];
const modos=Object.fromEntries(tabelas.map(k=>[k,"margem"]));
const moeda=v=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const percentual=v=>Number.isFinite(v)?v.toLocaleString("pt-BR",{maximumFractionDigits:2})+"%":"—";
function atualizarPreco(k,recalcular=true){
 const custoCampo=$("custo"),margemCampo=$("margem"+k),precoCampo=$("preco"+k),resumo=$("resumoPreco"+k);
 const custo=Number(custoCampo.value),margem=Number(margemCampo.value);
 margemCampo.setCustomValidity("");
 const custoValido=custoCampo.value!==""&&Number.isFinite(custo)&&custo>=0;
 if(recalcular&&custoValido){
  if(modos[k]==="margem"&&margemCampo.value!==""){
   if(Number.isFinite(margem)&&margem<100){const preco=custo/(1-margem/100);if(Number.isFinite(preco))precoCampo.value=preco.toFixed(2);}
   else margemCampo.setCustomValidity("Para calcular o preço, informe uma margem menor que 100%.");
  }else if(modos[k]==="preco"&&precoCampo.value!==""){
   const preco=Number(precoCampo.value);margemCampo.value=preco>0?((preco-custo)/preco*100).toFixed(2):"";
  }
 }
 resumo.replaceChildren();resumo.classList.remove("loss");
 const preco=Number(precoCampo.value);
 if(!custoValido||precoCampo.value===""||!Number.isFinite(preco)||preco<0||!margemCampo.checkValidity()){
  resumo.textContent="Informe custo e preço ou margem para visualizar o resultado.";return;
 }
 const ganho=Math.round((preco-custo)*100)/100;
 const valores=[["Custo por unidade",moeda(custo)],["Ganho bruto estimado",moeda(ganho)],["Margem sobre a venda",percentual(preco>0?(preco-custo)/preco*100:NaN)],["Acréscimo sobre o custo",percentual(custo>0?(preco-custo)/custo*100:NaN)]];
 for(const [nome,valor] of valores){const linha=document.createElement("div");const label=document.createElement("span");label.textContent=nome;const total=document.createElement("strong");total.textContent=valor;linha.append(label,total);resumo.append(linha);}
 if(ganho<0){resumo.classList.add("loss");const aviso=document.createElement("p");aviso.textContent="Preço abaixo do custo: perda estimada de "+moeda(-ganho)+" por unidade.";resumo.append(aviso);}
}
function atualizarResumos(recalcular=true){tabelas.forEach(k=>atualizarPreco(k,recalcular));}
for(const k of tabelas){$("margem"+k).oninput=()=>{modos[k]="margem";atualizarPreco(k);};$("preco"+k).oninput=()=>{modos[k]="preco";atualizarPreco(k);};}
$("custo").addEventListener("input",()=>atualizarResumos());
atualizarResumos(false);
$("fotos").onchange=async()=>{try{for(const file of $("fotos").files){if(fotos.length>=10)throw Error("Limite de 10 fotos");if(file.size>10*1024*1024)throw Error("Foto maior que 10 MB");const image=await createImageBitmap(file);const factor=Math.min(1,500/Math.max(image.width,image.height));const canvas=document.createElement("canvas");canvas.width=image.width*factor;canvas.height=image.height*factor;canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);fotos.push(canvas.toDataURL("image/jpeg",0.8));image.close();}preview();}catch(e){$("mensagem").textContent=e.message;}};
$("novo").onclick=novo;$("formMaterial").onsubmit=async e=>{e.preventDefault();$("salvarMaterial").disabled=true;$("salvarMaterial").textContent="Salvando…";try{const d=Object.fromEntries(keys.map(k=>[k,$(k).type==="number"?Number($(k).value):$(k).value]));d.fotos=fotos;d.precos=Object.fromEntries(["vista","28","35","padrao"].map(k=>[k,{margem:Number($("margem"+k).value),valor:Number($("preco"+k).value)}]));const body={codigo:d.codigo||null,nome:d.nome,unidade:d.unidade,custo:d.custo,descricao:d.especificacao,observacoes:d.observacoes,ativo:$("ativo").checked,dadosMaterial:d};const id=$("materialId").value;const s=await api("/servicos"+(id?"/"+id:""),id?"PUT":"POST",body);$("materialId").value=s.servicoid;$("tituloFormulario").textContent="Editar material";$("mensagem").textContent="Material salvo com sucesso.";await listar();modal.hide();}catch(e){$("mensagem").textContent=e.message;}finally{$("salvarMaterial").disabled=false;$("salvarMaterial").textContent="Salvar material";}};
window.addEventListener("configuracao-sistema",async({detail:c})=>{if(!c.composicaoCustos){location.replace("perfil.html");return;}try{await listar();}catch(e){$("mensagem").textContent=e.message;}});
})();
