const token = JSON.parse(
    localStorage.getItem("usuarioLogado")
)?.token;

if (!token) {
    window.location.href = "login.html";
}

const listaEmpresas = document.getElementById("listaEmpresas");
const formEmpresa = document.getElementById("formEmpresa");

let empresasCache = [];

async function carregarEmpresas() {

    try {

        const response = await fetch(`${API_URL}/empresas`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {

            if (response.status === 403) {
                alert("Sua conta não tem permissão de SUPER_ADMIN para acessar isso.");
                window.location.href = "dashboard.html";
                return;
            }

            alert("Erro ao carregar empresas.");
            return;
        }

        const empresas = await response.json();

        empresasCache = Array.isArray(empresas) ? empresas : [];

        atualizarKpis(empresasCache);
        renderizarEmpresas(empresasCache);

    } catch (error) {
        console.log(error);
        alert("Erro de conexão ao carregar empresas.");
    }
}

function atualizarKpis(empresas) {
    document.getElementById("kpiTotal").innerText = empresas.length;
    document.getElementById("kpiAtivas").innerText = empresas.filter(e => e.ativo).length;
    document.getElementById("kpiInativas").innerText = empresas.filter(e => !e.ativo).length;
}

function renderizarStatus(ativo) {
    if (ativo) {
        return `<span class="status-badge status-ativo">Ativa</span>`;
    }
    return `<span class="status-badge status-inativo">Inativa</span>`;
}

function renderizarEmpresas(empresas) {

    listaEmpresas.innerHTML = "";

    if (!empresas || empresas.length === 0) {
        listaEmpresas.innerHTML = `
            <div class="empty-state">
                <h3>Nenhuma empresa cadastrada</h3>
                <p>Cadastre a primeira empresa (tenant) do sistema.</p>
            </div>
        `;
        return;
    }

    empresas.forEach(empresa => {
        listaEmpresas.innerHTML += `
            <div class="cliente-card">

                <div class="cliente-header">

                    <div class="cliente-avatar">
                        ${textoSeguro(empresa.nome?.charAt(0)?.toUpperCase())}
                    </div>

                    <div class="cliente-header-info">
                        <h3>${textoSeguro(empresa.nome)}</h3>
                        <p>${textoSeguro(empresa.slug)}</p>
                    </div>

                    ${renderizarStatus(empresa.ativo)}
<button type="button" onclick="configurarSistema(${empresa.empresaid})">Configurar sistema</button>

                </div>

                <div class="cliente-body">

                    <div class="cliente-item">
                        <span>Contato</span>
                        <strong>${textoSeguro(empresa.emailContato) || "—"}</strong>
                    </div>

                    <div class="cliente-item">
                        <span>Telefone</span>
                        <strong>${textoSeguro(empresa.telefoneContato) || "—"}</strong>
                    </div>

                    <div class="cliente-item">
                        <span>Status</span>
                        <strong>${empresa.ativo ? "Ativa" : "Inativa"}</strong>
                    </div>

                </div>

            </div>
        `;
    });
}

formEmpresa.addEventListener("submit", async (e) => {

    e.preventDefault();

    try {

        const body = {
            nome: pegarValor("nome"),
            slug: pegarValor("slug")?.toLowerCase(),
            adminNome: pegarValor("adminNome"),
            adminEmail: pegarValor("adminEmail"),
            adminSenha: pegarValor("adminSenha"),
        };

        if (!body.nome || !body.slug || !body.adminNome || !body.adminEmail || !body.adminSenha) {
            alert("Preencha todos os campos.");
            return;
        }

        const response = await fetch(`${API_URL}/empresas`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        const resposta = await response.json();

        if (!response.ok) {
            alert(resposta.error || "Erro ao criar empresa.");
            return;
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById("modalEmpresa"));
        if (modal) modal.hide();

        formEmpresa.reset();
        alert(`Empresa "${body.nome}" criada. Admin: ${body.adminEmail}`);
        carregarEmpresas();

    } catch (error) {
        console.log(error);
        alert("Erro de conexão ao criar empresa.");
    }
});

carregarEmpresas();

function configurarSistema(id) {
 const empresa=empresasCache.find(e=>e.empresaid===id);if(!empresa)return;
 const c=empresa.configuracaoSistema||{perfil:"PADRAO"};
 const dialog=document.createElement("dialog");dialog.style.cssText="max-width:700px;width:95%;border:0;border-radius:16px;padding:24px";
 dialog.innerHTML='<form method="dialog"><h2>Configuração do sistema</h2><label>Perfil <select id="configPerfil"><option>PADRAO</option><option>SBA</option><option>PERSONALIZADO</option></select></label><p>Cada usuário herda as opções da empresa. As permissões de acesso continuam por função.</p><fieldset id="configModulos"><legend>Módulos</legend></fieldset><fieldset id="configCampos"><legend>Campos do orçamento</legend></fieldset><fieldset id="configFlags"><legend>Recursos</legend></fieldset><label>Escopo padrão<textarea id="configEscopo" rows="5" style="width:100%"></textarea></label><p id="configErro"></p><button type="button" id="salvarConfig">Salvar</button> <button>Cancelar</button></form>';
 document.body.append(dialog);
 const defaults=p=>({perfil:p,modulos:Object.fromEntries(["dashboard","clientes","servicos","propostas","vendedores","agenda","templates","financeiro","fiscal"].map(k=>[k,true])),camposProposta:Object.fromEntries(["prioridade","origem","frete","validadeDias"].map(k=>[k,p!=="SBA"])),reformaTributaria:p==="SBA",selecionarDestinatario:p==="SBA",certificadoA1:p==="SBA",composicaoCustos:p==="SBA",ocultarEscopoVazio:p==="SBA",textoEscopo:p==="SBA"?"NAO INCLUI - ART E QUAISQUER OUTRAS PECAS E SERVICOS QUE NAO ESTEJAM RELACIONADOS NESTE ORCAMENTO.\nPRAZO DE ENTREGA - A COMBINAR\nIPI ISENTO":""});
 function preencher(v){const d=defaults(v.perfil);const cfg={...d,...v,modulos:{...d.modulos,...v.modulos},camposProposta:{...d.camposProposta,...v.camposProposta}};dialog.querySelector("#configPerfil").value=cfg.perfil;for(const [fieldset,values] of [["configModulos",cfg.modulos],["configCampos",cfg.camposProposta],["configFlags",Object.fromEntries(["reformaTributaria","selecionarDestinatario","certificadoA1","composicaoCustos","ocultarEscopoVazio"].map(k=>[k,cfg[k]]))]]){const el=dialog.querySelector("#"+fieldset);el.querySelectorAll("label").forEach(e=>e.remove());for(const [k,v] of Object.entries(values)){const label=document.createElement("label");label.style.cssText="display:inline-block;margin:8px";const input=document.createElement("input");input.type="checkbox";input.checked=v;input.dataset.key=k;label.append(input,document.createTextNode(" "+k));el.append(label);}}dialog.querySelector("#configEscopo").value=cfg.textoEscopo;}
 preencher(c);dialog.querySelector("#configPerfil").onchange=e=>preencher(defaults(e.target.value));
 dialog.querySelector("#salvarConfig").onclick=async()=>{const read=id=>Object.fromEntries([...dialog.querySelectorAll("#"+id+" input")].map(i=>[i.dataset.key,i.checked]));const config={perfil:dialog.querySelector("#configPerfil").value,modulos:read("configModulos"),camposProposta:read("configCampos"),...read("configFlags"),textoEscopo:dialog.querySelector("#configEscopo").value};try{const res=await fetch(`${API_URL}/empresas/${id}`,{method:"PUT",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({configuracaoSistema:config})});const data=await res.json();if(!res.ok)throw new Error(data.message||data.error);dialog.close();carregarEmpresas();}catch(e){dialog.querySelector("#configErro").textContent=e.message;}};
 dialog.onclose=()=>dialog.remove();dialog.showModal();
}
