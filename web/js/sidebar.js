const SIDEBAR_STORAGE_KEY = "sidebarCollapsed";

const MENU_ICONS = {
  dashboard: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  clientes: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  vendedores: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect x="2" y="8" width="20" height="12" rx="2"/></svg>`,
  servicos: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  propostas: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  agenda: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  templates: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
  fiscal: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l3 3v17H6z"/><path d="M14 2v4h4"/><path d="M9 11h6"/><path d="M9 15h6"/><path d="M9 19h4"/></svg>`,
};

function menuKeyFromLink(link) {
  const href = (link.getAttribute("href") || "").toLowerCase();
  if (!href || href === "#" || href.includes("dashboard")) return "dashboard";
  const match = href.match(/([a-z]+)\.html/);
  return match ? match[1] : "dashboard";
}

function garantirLinkFiscal() {
  const menu = document.querySelector(".menu");
  if (!menu || menu.querySelector('a[href="fiscal.html"]')) return;

  const link = document.createElement("a");
  link.href = "fiscal.html";
  link.textContent = "Fiscal";

  const templates = menu.querySelector('a[href="templates.html"]');
  if (templates) menu.insertBefore(link, templates);
  else menu.appendChild(link);
}

function prepararItensMenu() {
  document.querySelectorAll(".menu a").forEach((link) => {
    if (link.querySelector(".menu-icon")) return;

    const label = link.textContent.trim();
    const key = menuKeyFromLink(link);
    const icon = MENU_ICONS[key] || MENU_ICONS.dashboard;

    link.innerHTML = `
      <span class="menu-icon" aria-hidden="true">${icon}</span>
      <span class="menu-label">${label}</span>
    `;
    link.setAttribute("title", label);
  });
}

function obterUsuarioLogado() {
  try {
    return JSON.parse(localStorage.getItem("usuarioLogado"));
  } catch {
    return null;
  }
}

function inicialDoNome(nome) {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  if (partes.length === 1) return partes[0][0].toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function carregarDadosUserBox() {
  const userBox = document.querySelector(".user-box");
  if (!userBox) return;

  const sessao = obterUsuarioLogado();
  const usuario = sessao?.usuario || sessao;
  const nomeCompleto = String(usuario?.nome || "Usuário").trim() || "Usuário";
  const nome = nomeCompleto.includes(" ")
    ? nomeCompleto.split(/\s+/)[0]
    : nomeCompleto;

  const avatar = userBox.querySelector(".avatar");
  if (avatar) {
    avatar.textContent = inicialDoNome(nome);
  }

  let info = userBox.querySelector(".user-info");
  if (!info) {
    info = userBox.querySelector("div:not(.avatar)");
    if (info) info.classList.add("user-info");
  }

  if (!info) return;

  let nomeEl = info.querySelector("strong");

  if (!nomeEl) {
    nomeEl = document.createElement("strong");
    info.appendChild(nomeEl);
  }

  nomeEl.textContent = nome;
}

function prepararUserBox() {
  const userBox = document.querySelector(".user-box");
  if (!userBox) return;

  carregarDadosUserBox();

  if (userBox.querySelector(".user-box-logout")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "user-box-logout";
  btn.setAttribute("aria-label", "Sair");
  btn.setAttribute("title", "Sair");
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  `;

  btn.addEventListener("click", () => {
    localStorage.removeItem("usuarioLogado");
    window.location.href = "login.html";
  });

  userBox.appendChild(btn);
}

function criarBotaoToggle(sidebar) {
  if (sidebar.querySelector(".sidebar-toggle")) return;

  const logo = sidebar.querySelector(".logo");
  if (!logo) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sidebar-toggle";
  btn.setAttribute("aria-label", "Recolher menu");
  btn.innerHTML = `
    <svg class="sidebar-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  `;

  logo.appendChild(btn);

  btn.addEventListener("click", () => {
    const collapsed = sidebar.classList.toggle("collapsed");
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "true" : "false");
    btn.setAttribute(
      "aria-label",
      collapsed ? "Expandir menu" : "Recolher menu",
    );
  });
}

function restaurarEstadoSidebar(sidebar) {
  if (window.innerWidth <= 900) return;

  const collapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  if (!collapsed) return;

  sidebar.classList.add("collapsed");
  const btn = sidebar.querySelector(".sidebar-toggle");
  if (btn) btn.setAttribute("aria-label", "Expandir menu");
}

document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  garantirLinkFiscal();
  prepararItensMenu();
  prepararUserBox();
  criarBotaoToggle(sidebar);
  // restaurarEstadoSidebar(sidebar);
});
