(() => {
  const $ = id => document.getElementById(id);
  const sessao = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
  const token = sessao?.token;
  const role = sessao?.usuario?.role || sessao?.role;
  const admin = ["ADMIN", "SUPER_ADMIN"].includes(role);
  if (!token) { location.replace("login.html"); return; }
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const brl = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const estado = { obraId: null, arquivo: "", arquivoNome: "", previa: null, planilha: null, mapeamentos: {}, draft: new Map() };
  const status = (s, erro = false) => { $("pmStatus").textContent = s; $("pmStatus").classList.toggle("pm-erro", erro); };
  const api = async (rota, metodo = "GET", corpo) => {
    const resp = await fetch(API_URL + rota, {
      method: metodo, headers: { Authorization: "Bearer " + token, ...(corpo === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw Error(data.error || "Não foi possível concluir a operação.");
    return data;
  };
  const aguardar = async (fn, btn) => {
    if (btn) btn.disabled = true;
    try { await fn(); } catch (e) { status(e.message || "Erro de comunicação com servidor.", true); }
    finally { if (btn) btn.disabled = false; }
  };
  const arquivoBase64 = f => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(Error("Não foi possível ler o Excel."));
    reader.readAsDataURL(f);
  });
  async function carregarLista() {
    $("pmLista").textContent = "Carregando planilhas…";
    if (!estado.obraId) { $("pmLista").textContent = "Selecione uma obra."; return; }
    const registros = await api("/obras/planilhas?obraId=" + estado.obraId);
    $("pmLista").innerHTML = registros.length
      ? registros.map(p => '<article class="pm-arquivo"><div><strong>' + esc(p.nome) + '</strong><small>' +
        esc(p.arquivoNome) + ' · Atualizado em ' + new Date(p.updatedAt).toLocaleDateString("pt-BR") +
        '</small></div><button type="button" data-planilha="' + p.id + '">Abrir medições</button></article>').join("")
      : "<p>Nenhuma planilha importada para esta obra.</p>";
    $("pmLista").querySelectorAll("[data-planilha]").forEach(btn => btn.addEventListener("click", () =>
      aguardar(() => abrirPlanilha(Number(btn.dataset.planilha)), btn)));
  }
  function valorProgresso(aba, linha, num) {
    const chave = aba.indice + ":" + linha.linha + ":" + num;
    if (estado.draft.has(chave)) return estado.draft.get(chave);
    return Number(estado.planilha?.edicoes?.[chave] ?? linha.percentuais?.[String(num)] ?? 0);
  }
  function renderAbas() {
    const abas = estado.planilha.abas.filter(a => a.reconhecida);
    $("pmAba").innerHTML = abas.map(a => '<option value="' + a.indice + '">' + esc(a.nome) + '</option>').join("");
    renderMedicoes();
  }
  function abaAtual() { return estado.planilha.abas.find(a => a.indice === Number($("pmAba").value)); }
  function medicaoAtual() { return Number($("pmMedicao").value); }
  function renderMedicoes() {
    const aba = abaAtual();
    if (!aba) { $("pmLinhas").innerHTML = ""; return; }
    const anterior = Number($("pmMedicao").value);
    $("pmMedicao").innerHTML = aba.medicoes.map(m =>
      '<option value="' + m.numero + '">' + esc(m.titulo || ("Medição " + m.numero)) + '</option>').join("");
    if (aba.medicoes.some(m => m.numero === anterior)) $("pmMedicao").value = anterior;
    renderTabela();
  }
  function renderTabela() {
    const aba = abaAtual(), numero = medicaoAtual();
    if (!aba || !numero) return;
    $("pmLinhas").innerHTML = aba.itens.map(item => {
      const antes = aba.medicoes.filter(m => m.numero < numero)
        .reduce((sum, m) => sum + valorProgresso(aba, item, m.numero), 0);
      const atual = valorProgresso(aba, item, numero);
      return '<tr data-linha="' + item.linha + '"><td><strong>' + esc(item.item) +
        '</strong><small>' + esc(item.etapa) + '</small></td><td>' + esc(item.descricao) +
        '</td><td>' + brl(item.valor) + '</td><td>' + antes.toLocaleString("pt-BR") +
        '%</td><td><input type="number" min="0" max="100" step="0.01" inputmode="decimal" ' +
        'aria-label="Percentual medido do serviço ' + esc(item.item) + '" value="' + atual +
        '" data-progresso="' + item.linha + '"></td><td data-acumulado="' + item.linha +
        '">—</td><td data-valor="' + item.linha + '">—</td></tr>';
    }).join("");
    $("pmLinhas").querySelectorAll("[data-progresso]").forEach(inp =>
      inp.addEventListener("input", () => {
        const key = aba.indice + ":" + inp.dataset.progresso + ":" + numero;
        const valor = Number(inp.value);
        if (inp.value === "" || !Number.isFinite(valor)) estado.draft.set(key, NaN);
        else estado.draft.set(key, valor);
        calcular();
      }));
    calcular();
  }
  function calcular() {
    const aba = abaAtual(), n = medicaoAtual();
    if (!aba || !n) return;
    let valorTotal = 0, invalido = false;
    for (const item of aba.itens) {
      const atual = valorProgresso(aba, item, n);
      const acumulado = aba.medicoes.reduce((total, m) => total + valorProgresso(aba, item, m.numero), 0);
      const celula = $("pmLinhas").querySelector('[data-linha="' + item.linha + '"]');
      const estaInvalido = !Number.isFinite(atual) || atual < 0 || atual > 100 || acumulado > 100.00001;
      if (estaInvalido) invalido = true;
      if (celula) {
        celula.classList.toggle("pm-invalido", estaInvalido);
        celula.querySelector("[data-acumulado]").textContent = acumulado.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
        celula.querySelector("[data-valor]").textContent = brl(item.valor * atual / 100);
      }
      if (Number.isFinite(atual)) valorTotal += item.valor * atual / 100;
    }
    $("pmResumo").innerHTML = '<span>' + aba.itens.length + ' serviços reconhecidos</span><strong>Medição atual: ' +
      brl(valorTotal) + '</strong>' + (invalido ? '<em>Confira os percentuais: máximo acumulado de 100% por serviço.</em>' : "");
    $("pmSalvar").disabled = !admin || invalido;
  }
  async function abrirPlanilha(id) {
    estado.planilha = await api("/obras/planilhas/" + id);
    estado.draft.clear();
    $("pmEditor").hidden = false;
    $("pmTitulo").textContent = estado.planilha.nome;
    $("pmSalvar").hidden = !admin;
    renderAbas();
    $("pmEditor").scrollIntoView({ behavior: "smooth", block: "start" });
    status("Planilha carregada. Edite as porcentagens de cada medição e salve antes de exportar.");
  }
  async function iniciar() {
    const empresa = await api("/empresas/me");
    if (empresa.empresaid !== 5 || empresa.slug !== "construarty" ||
      empresa.configuracaoSistema?.modulos?.obras !== true) {
      status("Esta área é exclusiva do perfil José/Construarty.", true); return;
    }
    const obras = await api("/obras");
    $("pmPrincipal").hidden = false;
    $("pmImportador").hidden = !admin;
    $("pmObra").innerHTML = '<option value="">Selecione uma obra</option>' +
      obras.map(o => '<option value="' + o.id + '">' + esc(o.nome) + '</option>').join("");
    $("pmObra").addEventListener("change", () => aguardar(async () => {
      estado.obraId = Number($("pmObra").value) || null;
      estado.planilha = null; estado.previa = null; estado.mapeamentos = {}; estado.draft.clear();
      $("pmEditor").hidden = true; $("pmPrevia").hidden = true;
      await carregarLista();
    }));
    $("pmPrever").onclick = () => aguardar(async () => {
      const arquivo = $("pmArquivo").files[0];
      if (!estado.obraId) throw Error("Selecione a obra antes de importar.");
      if (!arquivo || !arquivo.name.toLowerCase().endsWith(".xlsx") || arquivo.size > 5_000_000) throw Error("Selecione um arquivo .xlsx de até 5 MB.");
      estado.arquivo = await arquivoBase64(arquivo);
      estado.arquivoNome = arquivo.name;
      estado.mapeamentos = {};
      estado.previa = await api("/obras/planilhas/previa", "POST", { arquivo: estado.arquivo });
      mostrarPrevia();
      status("Prévia carregada. Confira as abas e a quantidade de serviços antes de confirmar.");
    }, $("pmPrever"));
    $("pmAba").onchange = renderMedicoes;
    $("pmMedicao").onchange = renderTabela;
    $("pmSalvar").onclick = () => aguardar(async () => {
      const aba = abaAtual(), n = medicaoAtual();
      const itens = aba.itens.map(item => ({ linha: item.linha, percentual: valorProgresso(aba, item, n) }));
      const resultado = await api("/obras/planilhas/" + estado.planilha.id + "/medicao", "PUT",
        { aba: aba.indice, numeroMedicao: n, itens });
      estado.planilha.edicoes = resultado.edicoes;
      for (const item of itens) estado.draft.delete(aba.indice + ":" + item.linha + ":" + n);
      status("Evolução da medição salva com sucesso. Você pode exportar o Excel para a engenharia.");
      renderTabela();
    }, $("pmSalvar"));
    $("pmExcel").onclick = () => aguardar(async () => {
      if (estado.draft.size) throw Error("Salve as alterações pendentes antes de gerar o Excel.");
      const btn = $("pmExcel");
      const r = await fetch(API_URL + "/obras/planilhas/" + estado.planilha.id + "/excel", {
        headers: { Authorization: "Bearer " + token }
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw Error(d.error || "Não foi possível gerar o Excel.");
      }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "medicao-engenharia-" + estado.planilha.id + ".xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status("Excel gerado. Confira a planilha antes de encaminhar para aprovação e pagamento.");
    }, $("pmExcel"));
    status("Selecione uma obra para importar ou abrir as planilhas de medição.");
  }
  function mostrarPrevia() {
    const p = estado.previa;
    const reconhecidas = p.abas.filter(a => a.reconhecida).length;
    $("pmPrevia").hidden = false;
    const letra = n => {
      if (String(n ?? "").trim() === "0") return "0";
      if (/^[A-Z]{1,3}$/i.test(String(n ?? "").trim())) return String(n).trim().toUpperCase();
      let v = Number(n), output = "";
      while (v > 0) { v--; output = String.fromCharCode(65 + v % 26) + output; v = Math.floor(v / 26); }
      return output;
    };
    const campo = (key, label, valor) =>
      '<label>' + label + '<input type="text" data-pm-campo="' + key + '" value="' + esc(valor ?? "") + '"></label>';
    $("pmPrevia").innerHTML = '<h3>Prévia do Excel</h3><p><strong>' + reconhecidas +
      ' abas reconhecidas</strong> de ' + p.abas.length +
      '. Se a empresa utilizar outro modelo, confira e ajuste as colunas manualmente.</p>' +
      p.abas.map(a => {
        const m = estado.mapeamentos[String(a.indice)] || a.mapeamento || {};
        const manualAtivo = Boolean(estado.mapeamentos[String(a.indice)]);
        return '<div class="pm-previa-item"><div><strong>' + esc(a.nome) +
          '</strong><span>' + (a.reconhecida ? a.itens.length + ' serviços · ' +
            a.medicoes.length + ' medições' : esc(a.aviso || "Layout não reconhecido")) +
          '</span></div><details class="pm-mapa" data-pm-aba="' + a.indice + '"><summary>Conferir / ajustar colunas</summary>' +
          '<label class="pm-mapa-ativar"><input type="checkbox" data-pm-manual ' +
          (manualAtivo ? "checked" : "") + '> Usar este mapeamento na importação</label>' +
          '<div class="pm-mapa-grid">' +
          campo("cabecalho", "Linha de cabeçalho", m.cabecalho || a.cabecalho || 10) +
          campo("item", "Coluna do item (0 = não existe)", letra(m.item) || "C") +
          campo("etapa", "Coluna da etapa (0 = não existe)", letra(m.etapa) || "D") +
          campo("descricao", "Coluna da descrição", letra(m.descricao) || "E") +
          campo("unidade", "Coluna da unidade (0 = não existe)", letra(m.unidade) || "F") +
          campo("quantidade", "Coluna da quantidade (0 = não existe)", letra(m.quantidade) || "G") +
          campo("valor", "Coluna do valor do serviço", letra(m.valor) || "I") +
          '<label>Valor informado na coluna<select data-pm-campo="tipoValor">' +
          '<option value="unitario" ' + (m.tipoValor !== "total" ? "selected" : "") + '>Unitário (multiplicar pela quantidade)</option>' +
          '<option value="total" ' + (m.tipoValor === "total" ? "selected" : "") + '>Total da linha</option></select></label>' +
          campo("colunasMedicoes", "Colunas dos percentuais (ex.: L,P,T)", m.colunasMedicoes || a.medicoes.map(n => letra(n.coluna)).join(",") || "L,P,T") +
          '</div><p>Utilize as letras que aparecem no Excel. Cada coluna informada corresponde a uma medição. O sistema somente altera os percentuais dessas colunas.</p>' +
          '</details></div>';
      }).join("") +
      (p.avisos.length ? '<p class="pm-aviso">Abas não reconhecidas ficam intactas no arquivo. Ajuste as colunas apenas se desejar editá-las.</p>' : "") +
      '<button type="button" class="pm-secondary" id="pmRevisarMapa">Validar mapeamento das abas</button>' +
      '<label>Identificação desta planilha<input id="pmNome" maxlength="180" value="' +
      esc(estado.arquivoNome.replace(/\.xlsx$/i, "")) + '"></label>' +
      '<button type="button" id="pmConfirmar" ' + (!reconhecidas ? 'disabled' : '') +
      '>Confirmar importação desta planilha</button>';
    $("pmRevisarMapa").onclick = () => aguardar(async () => {
      const mapeamentos = {};
      $("pmPrevia").querySelectorAll("[data-pm-aba]").forEach(div => {
        if (!div.querySelector("[data-pm-manual]").checked) return;
        const config = {};
        div.querySelectorAll("[data-pm-campo]").forEach(c => { config[c.dataset.pmCampo] = c.value.trim(); });
        mapeamentos[String(div.dataset.pmAba)] = config;
      });
      const nomeDigitado = $("pmNome").value;
      estado.previa = await api("/obras/planilhas/previa", "POST", { arquivo: estado.arquivo, mapeamentos });
      estado.mapeamentos = mapeamentos;
      mostrarPrevia();
      $("pmNome").value = nomeDigitado;
      status("Mapeamento validado. Confira novamente os serviços e as medições antes de importar.");
    }, $("pmRevisarMapa"));
    $("pmConfirmar").onclick = () => aguardar(async () => {
      const nome = $("pmNome").value.trim();
      if (!nome) throw Error("Informe a identificação da planilha.");
      const resultado = await api("/obras/planilhas/importar", "POST", {
        obraId: estado.obraId, nome, arquivoNome: estado.arquivoNome,
        arquivo: estado.arquivo, hash: estado.previa.hash, mapeamentos: estado.mapeamentos
      });
      estado.arquivo = ""; estado.previa = null; estado.mapeamentos = {};
      $("pmPrevia").hidden = true; $("pmArquivo").value = "";
      await carregarLista(); await abrirPlanilha(resultado.id);
      status("Planilha importada para a obra. Os pagamentos não foram alterados.");
    }, $("pmConfirmar"));
  }
  iniciar().catch(e => status(e.message, true));
})();