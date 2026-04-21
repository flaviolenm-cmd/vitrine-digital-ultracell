import { seedData } from './seed.js';
import { login } from './auth/auth.js';
import { getSession, clearSession } from './auth/session.js';
import { storage } from './storage.js';
import { money, maskCPF, maskPhone, onlyDigits, formatDateTime, escapeHtml, downloadFile, copyText, compressImageFile } from './utils.js';
import { getProducts, filterProducts, createProduct, updateProduct, deleteProduct, duplicateProduct, getProductAutocomplete } from './modules/products.js';
import { getUsers, createUser, updateUser, filterUsers, getUserById } from './modules/users.js';
import { addToCart, getDetailedCart, updateCartQty, removeFromCart, clearCart } from './modules/cart.js';
import { getOrders, createOrder, updateOrder } from './modules/orders.js';
import { getReturns, createReturn, updateReturn } from './modules/returns.js';
import { getDashboardData } from './modules/dashboard.js';
import { openModal } from './ui/modal.js';
import { showToast } from './ui/toast.js';
import { defaultPixKey } from './data/mock-data.js';
import { detectRemoteEnabled, syncRemoteSnapshot, remoteLogin, isRemoteEnabled, remoteResetSystem } from './api.js';

seedData();
detectRemoteEnabled().then((enabled) => { state.connection.remote = Boolean(enabled); if (enabled) syncRemoteSnapshot(); renderConnectionIndicator(); });
window.addEventListener('udp:data-updated', () => render());
window.addEventListener('online', () => { state.connection.online = true; renderConnectionIndicator(); });
window.addEventListener('offline', () => { state.connection.online = false; renderConnectionIndicator(); });

function saveUiState() {
  storage.set(storage.keys.ui, {
    adminSidebarCollapsed: state.adminSidebarCollapsed,
    storeSidebarCollapsed: state.storeSidebarCollapsed
  });
}

function renderConnectionIndicator() {
  const indicator = document.getElementById('sync-indicator');
  if (!indicator) return;
  const online = state.connection.online;
  indicator.classList.toggle('is-online', online);
  indicator.classList.toggle('is-offline', !online);
  indicator.setAttribute('title', online ? (state.connection.remote ? 'Online e sincronizando' : 'Online') : 'Offline');
  indicator.innerHTML = online ? '<span class="sync-dot"></span><span class="sync-wheel">↻</span>' : '<span class="sync-dot"></span><span class="sync-x">✕</span>';
}


const app = document.getElementById('app');
const persistedUi = storage.get(storage.keys.ui, {});
const state = {
  session: getSession(),
  route: 'dashboard',
  filters: { search:'', brand:'', category:'', model:'', status:'' },
  userSearch: '',
  productSearch: '',
  orderSearch: '',
  orderStatusFilter: '',
  productQtys: {},
  userFavoriteFilter: false,
  adminSidebarCollapsed: Boolean(persistedUi.adminSidebarCollapsed ?? true),
  storeSidebarCollapsed: Boolean(persistedUi.storeSidebarCollapsed ?? false),
  connection: { online: navigator.onLine, remote: false }
};

const adminRoutes = {
  dashboard: 'Dashboard',
  products: 'Produtos',
  users: 'Usuários',
  orders: 'Pedidos',
  deliveries: 'Entregas',
  returns: 'Devoluções',
};

const adminRouteDescriptions = {
  dashboard: 'Indicadores principais, ranking e desempenho.',
  products: 'Cadastro e disponibilidade dos produtos.',
  users: 'Clientes, crédito e histórico comercial.',
  orders: 'Operação por status e prioridade.',
  deliveries: 'Fila de entregas e confirmação de pagamento.',
  returns: 'Registro de devoluções com fotos.',
};

function getAvailableAdminRoutes() {
  if (state.session?.type === 'deliverer') {
    return { deliveries: 'Entregas', returns: 'Devoluções' };
  }
  return adminRoutes;
}

function getAdminLandingRoute() {
  return state.session?.type === 'deliverer' ? 'deliveries' : 'dashboard';
}

function normalizeAdminRoute() {
  const routes = getAvailableAdminRoutes();
  if (!routes[state.route]) state.route = getAdminLandingRoute();
}

const FAVORITES_PREFIX = 'udp_favorites_';

function favoriteKey(userId) { return `${FAVORITES_PREFIX}${userId}`; }
function getFavoriteIds(userId = state.session?.id) { return storage.get(favoriteKey(userId), []); }
function saveFavoriteIds(list, userId = state.session?.id) { storage.set(favoriteKey(userId), [...new Set(list)]); }
function toggleFavorite(productId, userId = state.session?.id) {
  const current = getFavoriteIds(userId);
  saveFavoriteIds(current.includes(productId) ? current.filter(id => id !== productId) : [...current, productId], userId);
}
function isFavorite(productId, userId = state.session?.id) { return getFavoriteIds(userId).includes(productId); }
function getRecentOrdersForUser(userId) { return getOrders().filter(o => o.userId === userId).slice(0, 5); }
function getRecentProductIds(userId) {
  const seen = new Set();
  const ids = [];
  getRecentOrdersForUser(userId).forEach(order => (order.items || []).forEach(item => {
    if (!seen.has(item.productId)) { seen.add(item.productId); ids.push(item.productId); }
  }));
  return ids;
}
function getOrderProgressSteps(order) {
  const steps = [
    ['aguardando_confirmacao', 'Recebido'],
    ['em_separacao', 'Separando'],
    [order.deliveryType === 'retirada' ? 'pronto_retirada' : 'saiu_entrega', order.deliveryType === 'retirada' ? 'Retirada' : 'Em rota'],
    ['concluido', 'Concluído']
  ];
  const statusMap = { aguardando_confirmacao:0, em_separacao:1, pronto_retirada:2, saiu_entrega:2, entregue:3, concluido:3, cancelado:-1 };
  const current = statusMap[order.status] ?? 0;
  return steps.map((step, index) => ({ label: step[1], done: current >= index, current: current === index, cancelled: order.status === 'cancelado' }));
}
function renderOrderTimeline(order) {
  const steps = getOrderProgressSteps(order);
  return `<div class="order-timeline ${order.status === 'cancelado' ? 'is-cancelled' : ''}">${steps.map(step => `<div class="timeline-step ${step.done ? 'done' : ''} ${step.current ? 'current' : ''}"><span></span><small>${escapeHtml(step.label)}</small></div>`).join('')}</div>`;
}
function getOrderSummaryText(order) {
  return `Pedido ${order.id}\nCliente: ${order.customerName}\nLoja: ${order.storeName || '-'}\nData: ${formatDateTime(order.createdAt)}\nItens: ${(order.items || []).map(i => `${i.name} x${i.quantity}`).join(', ')}\nTotal: ${money(order.total)}\nRecebimento: ${order.deliveryType}\nPagamento: ${order.paymentMethod}\nStatus: ${getUserFacingOrderMessage(order)}`;
}
function getClientMetrics(userId) {
  const user = getUserById(userId);
  const orders = getOrders().filter(o => o.userId === userId);
  const totalSpent = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const availableCredit = Math.max(0, Number(user?.creditLimit || 0) - Number(user?.creditUsed || 0));
  return {
    totalSpent,
    orderCount: orders.length,
    lastOrder: orders[0] || null,
    availableCredit,
    usedCredit: Number(user?.creditUsed || 0),
    limitCredit: Number(user?.creditLimit || 0),
  };
}

function render() {
  state.session = getSession();
  if (!state.session) return renderLogin();
  if (state.session.type === 'admin' || state.session.type === 'deliverer') return renderAdmin();
  return renderStore();
}

function renderLogin() {
  app.innerHTML = `
  <div class="auth-shell">
    <div class="auth-card">
      <div class="brand-lockup"><h1>ULTRACELL</h1><span>peças</span></div>
      <form id="login-form" class="auth-grid">
        <div class="field"><label>Login</label><input class="input" name="login" placeholder="Login" inputmode="numeric" pattern="[0-9]*" required></div>
        <div class="field"><label>Senha</label><input class="input" name="password" type="password" placeholder="Digite sua senha" required></div>
        <div class="auth-actions">
          <button class="btn btn-primary" type="submit">Entrar</button>
        </div>
      </form>
    </div>
  </div>`;

  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const loginValue = String(fd.get('login') || '').trim();
    const password = String(fd.get('password') || '').trim();
    let result = await remoteLogin(loginValue, password);
    if (!result.ok) result = login(loginValue, password);
    if (!result.ok) return showToast(result.message || 'Login ou senha inválidos.');
    state.route = (result.session.type === 'admin' || result.session.type === 'deliverer') ? getAdminLandingRoute() : 'store';
    render();
  };
}


function shell(inner, sidebar, options = {}) {
  const {
    showDataActions = false,
    floating = '',
    sidebarMode = 'admin',
    sidebarCollapsed = false,
    bottomTools = ''
  } = options;
  const userLabel = state.session.storeName ? `${escapeHtml(state.session.name)} · ${escapeHtml(state.session.storeName)}` : escapeHtml(state.session.name);
  const toggleId = sidebarMode === 'store' ? 'store-sidebar-toggle' : 'admin-sidebar-toggle';
  const collapsedClass = sidebarCollapsed ? 'is-collapsed' : '';
  return `
  <div class="app-shell shell-${sidebarMode}">
    <header class="brand-bar premium-bar">
      <div class="brand-meta brand-meta-left">
        <div class="user-chip">${userLabel}</div>
      </div>
      <div class="brand-center">
        <div class="brand-stack brand-stack-centered"><h1>ULTRACELL</h1><span>Peças</span></div>
      </div>
      <div class="actions-row brand-actions">
        ${showDataActions ? `<button class="btn btn-secondary btn-small" id="backup-btn">Backup JSON</button>
        <label class="btn btn-secondary btn-small" for="restore-input">Restaurar</label>
        <input id="restore-input" type="file" accept="application/json" class="hidden">` : ''}
        <button class="sync-indicator ${state.connection.online ? 'is-online' : 'is-offline'}" id="sync-indicator" type="button" aria-label="Indicador de conexão"></button>
        <button class="btn btn-primary btn-small" id="logout-btn">Sair</button>
      </div>
    </header>
    <div class="main-shell ${sidebarMode}-layout ${collapsedClass}">
      <aside class="sidebar ${sidebarMode}-sidebar ${collapsedClass}">
        <button class="sidebar-toggle" id="${toggleId}" type="button" aria-label="Recolher ou expandir painel">
          <span class="toggle-icon">${sidebarCollapsed ? '»' : '«'}</span>
          <span class="toggle-label">${sidebarCollapsed ? 'Abrir' : 'Recolher'}</span>
        </button>
        <div class="sidebar-scroll">${sidebar}</div>
      </aside>
      <main class="content">${inner}${bottomTools}</main>
    </div>
    ${floating}
  </div>`;
}
function renderStore() {
  const session = state.session;
  const user = getUserById(session.id);
  let products = filterProducts(state.filters);
  if (state.userFavoriteFilter) products = products.filter(product => isFavorite(product.id, session.id));
  const cart = getDetailedCart(session.id);
  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const brands = uniq(getProducts().map(p => p.brand));
  const categories = uniq(getProducts().map(p => p.category));
  const autocomplete = getProductAutocomplete(state.filters.search);
  const userOrders = getOrders().filter(o => o.userId === session.id);
  const openOrders = userOrders.filter(order => !['entregue', 'concluido', 'cancelado'].includes(order.status)).length;
  const metrics = getClientMetrics(session.id);
  const favoriteIds = getFavoriteIds(session.id);
  const recentProductIds = getRecentProductIds(session.id);

  app.innerHTML = shell(`
    <section class="section">
      <div class="panel panel-hero">
        <div class="section-title"><div><h2>Vitrine Digital</h2><div class="inline-note">Catálogo premium com filtros rápidos, carrinho flutuante, favoritos, recompra e pedidos organizados por status.</div></div><div class="pill">${cart.reduce((a,i)=>a+i.quantity,0)} item(ns) no carrinho</div></div>
        <div class="quick-insights">
          <div class="mini-stat"><span>Crédito disponível</span><strong>${user?.creditEnabled ? money(metrics.availableCredit) : 'Desativado'}</strong></div>
          <div class="mini-stat"><span>Pedidos em aberto</span><strong>${openOrders}</strong></div>
          <div class="mini-stat"><span>Total comprado</span><strong>${money(metrics.totalSpent)}</strong></div>
          <button class="mini-stat interactive ${state.userFavoriteFilter ? 'is-active' : ''}" id="favorite-filter-btn"><span>Favoritos</span><strong>${favoriteIds.length}</strong></button>
        </div>
        <div class="top-toolbar filter-toolbar">
          <div class="field field-search"><label>Pesquisar</label><input id="store-search" class="input" list="products-list" value="${escapeHtml(state.filters.search)}" placeholder="Nome, modelo, categoria ou código"></div>
          <datalist id="products-list">${autocomplete.map(v => `<option value="${escapeHtml(v)}"></option>`).join('')}</datalist>
          <div class="field"><label>Marca</label><select id="filter-brand" class="select"><option value="">Todas</option>${brands.map(v => `<option value="${escapeHtml(v)}" ${state.filters.brand===v?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></div>
          <div class="field"><label>Categoria</label><select id="filter-category" class="select"><option value="">Todas</option>${categories.map(v => `<option value="${escapeHtml(v)}" ${state.filters.category===v?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></div>
          <div class="field"><label>Modelo</label><input id="filter-model" class="input" value="${escapeHtml(state.filters.model)}" placeholder="Ex.: A10"></div>
          <div class="field"><label>Status</label><select id="filter-status" class="select"><option value="">Todos</option><option value="available" ${state.filters.status==='available'?'selected':''}>Disponível</option><option value="out_of_stock" ${state.filters.status==='out_of_stock'?'selected':''}>Sem estoque</option></select></div>
        </div>
      </div>

      ${recentProductIds.length ? `<div class="panel recent-panel"><div class="section-title"><h3>Compre de novo</h3><div class="inline-note">Atalhos com base nos seus pedidos recentes.</div></div><div class="recent-strip">${recentProductIds.map(id => { const product = getProducts().find(p => p.id === id); return product ? recentProductPill(product) : ''; }).join('')}</div></div>` : ''}
      <div class="catalog-grid store-catalog-grid">${products.map(productCard).join('') || '<div class="empty-state">Nenhum produto encontrado.</div>'}</div>
    </section>
  `, `
    <div class="profile-toggle-card soft-card ${state.storeSidebarCollapsed ? 'is-collapsed' : ''}">
      <button class="profile-collapse-btn" id="profile-panel-toggle" type="button">
        <span>Perfil</span>
        <strong>${state.storeSidebarCollapsed ? 'Abrir' : 'Recolher'}</strong>
      </button>
      <div class="profile-panel soft-card">
        <div class="profile-panel-top profile-panel-hero">
          ${renderImageFrame(user?.photo, user?.fullName || 'Cliente', initialsFromName(user?.fullName || 'Cliente'), 'user')}
          <div class="profile-meta profile-meta-centered">
            <strong>${escapeHtml(user?.fullName || state.session.name)}</strong>
            <span>${escapeHtml(user?.storeName || 'Cliente Ultracell')}</span>
            <span>${escapeHtml(maskPhone(user?.contact || ''))}</span>
          </div>
        </div>
        <div class="profile-subdata small-text">CPF: ${escapeHtml(maskCPF(user?.cpf || ''))}</div>
        <div class="profile-credit-panel">
          <div><span>Limite</span><strong>${user?.creditEnabled ? money(metrics.limitCredit) : 'Desativado'}</strong></div>
          <div><span>Usado</span><strong>${user?.creditEnabled ? money(metrics.usedCredit) : '-'}</strong></div>
          <div><span>Disponível</span><strong>${user?.creditEnabled ? money(metrics.availableCredit) : '-'}</strong></div>
        </div>
        <div class="profile-subdata small-text">Último pedido: ${metrics.lastOrder ? formatDateTime(metrics.lastOrder.createdAt) : 'Sem pedidos'}</div>
        <button class="btn btn-secondary btn-small" id="edit-profile-btn">Editar perfil</button>
      </div>
    </div>
    <button class="btn side-btn active">Catálogo</button>
    <button class="btn side-btn" id="my-orders-btn">Meus pedidos <span class="side-counter">${userOrders.length}</span></button>
    <button class="btn side-btn" id="favorite-filter-sidebar">Favoritos <span class="side-counter">${favoriteIds.length}</span></button>
  `, {
    showDataActions: false,
    sidebarMode: 'store',
    sidebarCollapsed: state.storeSidebarCollapsed,
    floating: `<button class="floating-cart-btn" id="floating-cart-btn" aria-label="Abrir carrinho"><span class="floating-cart-count">${cart.reduce((a,i)=>a+i.quantity,0)}</span><div><strong>Carrinho</strong><small>${money(total)} · ${openOrders} pedido(s) em aberto</small></div></button>`
  });

  bindGlobalShell();
  bindStoreEvents();
}
function renderAdmin() {
  normalizeAdminRoute();
  const dashboard = getDashboardData();
  const products = filterProducts({ search: state.productSearch, status: state.filters.status });
  const users = filterUsers(state.userSearch);
  const orders = getOrders();
  const deliveries = orders.filter(o => o.deliveryType === 'entrega');
  const returns = getReturns();
  const availableRoutes = getAvailableAdminRoutes();
  const panelTitle = state.session?.type === 'deliverer' ? 'Painel Entregador' : 'Painel ADM';

  const contentByRoute = {
    dashboard: renderDashboard(dashboard),
    products: renderProductsAdmin(products),
    users: renderUsersAdmin(users),
    orders: renderOrdersAdmin(orders),
    deliveries: renderDeliveriesAdmin(deliveries),
    returns: renderReturnsAdmin(returns),
  };

  const sidebar = `
    <div class="side-brand-card">
      <div class="side-kicker">${state.session?.type === 'deliverer' ? 'Operação externa' : 'Painel administrativo'}</div>
      <h3>${panelTitle}</h3>
      <p>${adminRouteDescriptions[state.route] || ''}</p>
    </div>
    <div class="side-section-label">Operação</div>
    ${Object.entries(availableRoutes).map(([key, label]) => `
      <button class="btn side-btn ${state.route === key ? 'active' : ''}" data-route="${key}">
        <span>${label}</span>
        <small>${adminRouteDescriptions[key]}</small>
      </button>
    `).join('')}
  `;

  const bottomTools = state.session?.type === 'deliverer' ? '' : `
    <section class="section admin-bottom-tools">
      <div class="panel panel-tools">
        <div class="section-title"><div><h3>Ferramentas e manutenção</h3><div class="inline-note">Ações secundárias, backup e reset seguro do projeto.</div></div></div>
        <div class="admin-tools-grid">
          <button class="btn btn-secondary" id="backup-btn">Backup JSON</button>
          <label class="btn btn-secondary" for="restore-input">Restaurar</label>
          <input id="restore-input" type="file" accept="application/json" class="hidden">
          <button class="btn btn-danger" id="system-reset-btn">Reset total do sistema</button>
        </div>
      </div>
    </section>`;
  app.innerHTML = shell(contentByRoute[state.route] || contentByRoute[getAdminLandingRoute()], sidebar, {
    showDataActions: false,
    sidebarMode: 'admin',
    sidebarCollapsed: state.adminSidebarCollapsed,
    bottomTools
  });
  bindGlobalShell();
  bindAdminEvents();
}

function renderDashboard(data) {
  return `
    <section class="section">
      <div class="panel panel-hero dashboard-elegant">
        <div class="section-title">
          <div>
            <h2>Dashboard</h2>
            <div class="inline-note">Central operacional mais limpa, com foco no que precisa de ação agora.</div>
          </div>
          <div class="pill">${data.openOrders} pedido(s) em aberto</div>
        </div>
        <div class="dashboard-focus-grid">
          <button class="dashboard-focus-card" type="button" data-dashboard-route="orders">
            <span>Pedidos urgentes</span>
            <strong>${data.urgentOrders.length}</strong>
            <small>Ver fluxo operacional</small>
          </button>
          <button class="dashboard-focus-card" type="button" data-dashboard-route="deliveries">
            <span>Fila de entregas</span>
            <strong>${data.deliveryOrders}</strong>
            <small>Rota e pagamentos</small>
          </button>
          <button class="dashboard-focus-card" type="button" data-dashboard-route="products">
            <span>Sem estoque</span>
            <strong>${data.outOfStockProducts}</strong>
            <small>Ajustar disponibilidade</small>
          </button>
          <button class="dashboard-focus-card" type="button" data-dashboard-route="users">
            <span>Clientes ativos</span>
            <strong>${data.activeUsers}</strong>
            <small>Cadastro e crédito</small>
          </button>
        </div>
      </div>
      <div class="grid grid-2 dashboard-panels">
        <div class="panel dashboard-panel-list">
          <div class="section-title"><h3>Pedidos urgentes</h3><button class="btn btn-secondary btn-small" type="button" data-dashboard-route="orders">Abrir pedidos</button></div>
          <div class="list">${data.urgentOrders.map(order => `<button class="soft-card dashboard-list-card" type="button" data-dashboard-route="orders"><strong>${escapeHtml(order.customerName)}</strong><div class="small-text">${formatDateTime(order.createdAt)} · ${escapeHtml(order.deliveryType)} · ${money(order.total)}</div><div class="status ${statusTone(order.status)}">${escapeHtml(statusLabel(order.status))}</div></button>`).join('') || '<div class="empty-state">Nenhum pedido urgente no momento.</div>'}</div>
        </div>
        <div class="panel dashboard-panel-list">
          <div class="section-title"><h3>Produtos sem estoque</h3><button class="btn btn-secondary btn-small" type="button" data-dashboard-route="products">Abrir produtos</button></div>
          <div class="list">${data.outOfStockList.map(product => `<button class="soft-card dashboard-list-card" type="button" data-dashboard-route="products"><strong>${escapeHtml(product.name)}</strong><div class="small-text">${escapeHtml(product.brand)} · ${escapeHtml(product.category)} · ${escapeHtml(product.model)}</div><div class="status danger">Sem estoque</div></button>`).join('') || '<div class="empty-state">Todos os produtos estão disponíveis.</div>'}</div>
        </div>
        <div class="panel">
          <h3>Top 5 peças por categoria</h3>
          <div class="list">
            ${data.rankedByCategory.map(group => `<div class="soft-card"><strong>${escapeHtml(group.category)}</strong><div class="small-text">${group.items.map(([name, qty]) => `${escapeHtml(name)} (${qty})`).join(' · ') || 'Sem pedidos ainda.'}</div></div>`).join('') || '<div class="empty-state">Sem dados ainda.</div>'}
          </div>
        </div>
        <div class="panel">
          <h3>Clientes que mais pedem</h3>
          <div class="list">
            ${data.topClients.map(([name, total]) => `<div class="line-row soft-card"><strong>${escapeHtml(name)}</strong><span>${money(total)}</span></div>`).join('') || '<div class="empty-state">Sem dados ainda.</div>'}
          </div>
        </div>
      </div>
    </section>`;
}

function renderProductsAdmin(products) {
  return `
    <section class="section">
      <div class="panel panel-hero">
        <div class="section-title"><div><h2>Produtos</h2><div class="inline-note">Controle simplificado por disponibilidade: disponível ou sem estoque.</div></div><button class="btn btn-primary" id="new-product-btn">Novo produto</button></div>
        <div class="top-toolbar">
          <div class="field field-search"><label>Pesquisar produto</label><input id="product-search" class="input" value="${escapeHtml(state.productSearch)}" placeholder="Nome, código, modelo..."></div>
          <div class="field"><label>Status</label><select id="admin-product-status" class="select"><option value="">Todos</option><option value="available" ${state.filters.status==='available'?'selected':''}>Disponível</option><option value="out_of_stock" ${state.filters.status==='out_of_stock'?'selected':''}>Sem estoque</option></select></div>
        </div>
      </div>
      <div class="section-title section-mini-head"><h3>Catálogo administrativo</h3><div class="inline-note">Edite preço, disponibilidade e identificação sem usar quantidade numérica.</div></div>
      <div class="catalog-grid admin-cards">${products.map(adminProductCard).join('') || '<div class="empty-state">Nenhum produto encontrado.</div>'}</div>
    </section>`;
}

function renderUsersAdmin(users) {
  return `
    <section class="section">
      <div class="panel panel-hero">
        <div class="section-title"><div><h2>Usuários</h2><div class="inline-note">Controle de cadastro, status do cliente e crédito.</div></div><button class="btn btn-primary" id="new-user-btn">Novo usuário</button></div>
        <div class="top-toolbar"><div class="field field-search"><label>Pesquisar usuário</label><input id="user-search" class="input" value="${escapeHtml(state.userSearch)}" placeholder="Nome, CPF, loja ou contato"></div></div>
      </div>
      <div class="grid grid-2">${users.map(userCard).join('') || '<div class="empty-state">Nenhum usuário encontrado.</div>'}</div>
    </section>`;
}

function renderOrdersAdmin(orders) {
  const columns = {
    aguardando_confirmacao: 'Aguardando confirmação',
    em_separacao: 'Em separação',
    pronto_retirada: 'Pronto para retirada',
    saiu_entrega: 'Saiu para entrega',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
  };
  const term = String(state.orderSearch || '').toLowerCase();
  const filteredOrders = orders.filter(order => {
    const okSearch = !term || [order.id, order.customerName, order.storeName, order.address, order.paymentMethod, order.deliveryType, ...(order.items || []).map(item => item.name)].join(' ').toLowerCase().includes(term);
    const okStatus = !state.orderStatusFilter || order.status === state.orderStatusFilter;
    return okSearch && okStatus;
  });
  const counts = Object.keys(columns).map(k => ({ key:k, label:columns[k], total: filteredOrders.filter(o => o.status === k).length }));
  return `
  <section class="section">
    <div class="panel panel-hero">
      <div class="section-title"><div><h2>Pedidos</h2><div class="inline-note">Fluxo visual por status para operação rápida, com linha do tempo, cópia rápida e filtros.</div></div></div>
      <div class="top-toolbar">
        <div class="field field-search"><label>Pesquisar pedido</label><input id="order-search" class="input" value="${escapeHtml(state.orderSearch)}" placeholder="Cliente, ID, item, endereço..."></div>
        <div class="field"><label>Status</label><select id="order-status-filter" class="select"><option value="">Todos</option>${Object.entries(columns).map(([key,label]) => `<option value="${key}" ${state.orderStatusFilter===key?'selected':''}>${label}</option>`).join('')}</select></div>
      </div>
      <div class="status-summary-row">${counts.map(item => `<div class="mini-status-card"><span>${item.label}</span><strong>${item.total}</strong></div>`).join('')}</div>
    </div>
    <div class="order-board">
      ${Object.entries(columns).map(([status, label]) => `
        <div class="status-column">
          <div class="status-column-head">${label}</div>
          <div class="list">
            ${filteredOrders.filter(o => o.status === status).map(orderCard).join('') || '<div class="empty-state compact-empty">Sem pedidos</div>'}
          </div>
        </div>
      `).join('')}
    </div>
  </section>`;
}

function renderDeliveriesAdmin(deliveries) {
  return `
    <section class="section">
      <div class="panel panel-hero"><div class="section-title"><div><h2>Entregas</h2><div class="inline-note">Central de rota do dia, com pagamento, troco, cópia de endereço e confirmação rápida.</div></div><div class="pill">${deliveries.filter(order => !['concluido','entregue','cancelado'].includes(order.status)).length} pendente(s)</div></div></div>
      <div class="grid grid-2">${deliveries.map(deliveryCard).join('') || '<div class="empty-state">Nenhuma entrega cadastrada.</div>'}</div>
    </section>`;
}

function renderReturnsAdmin(returns) {
  return `
    <section class="section">
      <div class="panel panel-hero"><div class="section-title"><div><h2>Devoluções</h2><div class="inline-note">Fluxo com status de análise, aprovação e conclusão. Fotos continuam obrigatórias.</div></div><button class="btn btn-primary" id="new-return-btn">Nova devolução</button></div></div>
      <div class="grid grid-2">${returns.map(returnCard).join('') || '<div class="empty-state">Nenhuma devolução registrada.</div>'}</div>
    </section>`;
}


function initialsFromName(value = '') {
  const parts = String(value).trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map(part => part[0]?.toUpperCase() || '').join('') || 'UP';
}

function normalizeImageValue(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.startsWith('data:image/') ? raw.replace(/\s+/g, '') : raw;
}

function attachPreviewImage(container, value, altText, fallbackHtml) {
  const src = normalizeImageValue(value);
  container.classList.toggle('is-empty', !src);
  if (!src) {
    container.innerHTML = fallbackHtml;
    return;
  }
  container.innerHTML = '';
  const img = document.createElement('img');
  img.alt = altText;
  img.src = src;
  img.onerror = () => {
    container.classList.add('is-empty');
    container.innerHTML = fallbackHtml;
  };
  container.appendChild(img);
}

function renderImageFrame(image, alt, fallback, kind = 'product') {
  const cls = kind === 'user' ? 'user-photo-frame' : 'product-photo';
  const src = normalizeImageValue(image);
  if (src) {
    return `<div class="${cls}"><img src="${src}" alt="${escapeHtml(alt)}"></div>`;
  }
  return `<div class="${cls} fallback"><span>${escapeHtml(fallback)}</span></div>`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    reader.readAsDataURL(file);
  });
}

function productCard(product) {
  const unavailable = !product.active || product.availabilityStatus !== 'available';
  const qty = Math.max(1, Number(state.productQtys[product.id] || 1));
  return `
    <article class="product-card premium-card ${unavailable ? 'disabled-card' : ''}">
      ${renderImageFrame(product.image, product.name, product.brand, 'product')}
      <div class="product-body">
        <div class="card-title"><h3>${escapeHtml(product.name)}</h3><div class="product-title-actions">${statusBadge(product.active ? 'ativo' : 'inativo')}<button class="favorite-btn ${isFavorite(product.id) ? 'is-active' : ''}" type="button" data-favorite-toggle="${product.id}" aria-label="Favoritar produto">★</button></div></div>
        <div class="product-meta"><span class="tag">${escapeHtml(product.brand)}</span><span class="tag">${escapeHtml(product.category)}</span><span class="tag">${escapeHtml(product.model)}</span></div>
        <div class="status ${product.availabilityStatus === 'available' ? 'ok' : 'danger'}">${product.availabilityStatus === 'available' ? 'Disponível' : 'Sem estoque'}</div>
        <div class="small-text">Código: ${escapeHtml(product.code || '-')}</div>
        <div class="price">${money(product.price)}</div>
        <div class="qty-inline-card ${unavailable ? 'is-disabled' : ''}">
          <span class="small-text">Quantidade</span>
          <div class="qty-stepper">
            <button class="btn btn-secondary btn-small" type="button" data-qty-step="${product.id}|-1" ${unavailable ? 'disabled' : ''}>−</button>
            <input class="input qty-inline-input" type="number" min="1" value="${qty}" inputmode="numeric" pattern="[0-9]*" data-card-qty="${product.id}" ${unavailable ? 'disabled' : ''}>
            <button class="btn btn-secondary btn-small" type="button" data-qty-step="${product.id}|1" ${unavailable ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <div class="actions-row">
          <button class="btn ${unavailable ? 'btn-secondary' : 'btn-primary'} btn-small" data-order-now="${product.id}" ${unavailable ? 'disabled' : ''}>${unavailable ? 'Sem estoque' : 'Fazer pedido'}</button>
          <button class="btn btn-secondary btn-small" data-add-cart="${product.id}" ${unavailable ? 'disabled' : ''}>Adicionar ao carrinho</button>
        </div>
      </div>
    </article>`;
}
function recentProductPill(product) {
  return `<button class="recent-pill" type="button" data-order-now="${product.id}">${escapeHtml(product.name)}</button>`;
}

function adminProductCard(product) {
  return `
    <article class="product-card premium-card">
      <div class="product-body">
        <div class="card-title"><h3>${escapeHtml(product.name)}</h3>${statusBadge(product.availabilityStatus === 'available' ? 'disponível' : 'sem_estoque')}</div>
        <div class="product-meta"><span class="tag">${escapeHtml(product.brand)}</span><span class="tag">${escapeHtml(product.category)}</span><span class="tag">${escapeHtml(product.model)}</span></div>
        <div class="line-row"><span class="small-text">Código</span><strong>${escapeHtml(product.code || '-')}</strong></div>
        <div class="line-row"><span class="small-text">Preço</span><strong>${money(product.price)}</strong></div>
        <div class="line-row"><span class="small-text">Ativo</span><strong>${product.active ? 'Sim' : 'Não'}</strong></div>
        <div class="actions-row">
          <button class="btn btn-secondary btn-small" data-edit-product="${product.id}">Editar</button>
          <button class="btn btn-secondary btn-small" data-duplicate-product="${product.id}">Duplicar</button>
          <button class="btn btn-danger btn-small" data-delete-product="${product.id}">Excluir</button>
        </div>
      </div>
    </article>`;
}

function userCard(user) {
  const availableCredit = Math.max(0, Number(user.creditLimit || 0) - Number(user.creditUsed || 0));
  return `
    <article class="user-card premium-card">
      <div class="user-card-top">
        ${renderImageFrame(user.photo, user.fullName, initialsFromName(user.fullName), 'user')}
        <div class="user-card-heading">
          <div class="card-title"><h3>${escapeHtml(user.fullName)}</h3>${statusBadge(user.active ? 'ativo' : 'inativo')}</div>
          <div class="small-text">${escapeHtml(user.storeName)}</div>
        </div>
      </div>
      <div class="line-row"><span>CPF</span><strong>${escapeHtml(maskCPF(user.cpf))}</strong></div>
      <div class="line-row"><span>Contato</span><strong>${escapeHtml(maskPhone(user.contact))}</strong></div>
      <div class="line-row"><span>Perfil</span><strong>${escapeHtml((user.role === 'admin' || user.type === 'admin') ? 'ADM' : ((user.role === 'deliverer' || user.type === 'deliverer') ? 'Entregador' : 'Usuário'))}</strong></div>
      <div class="credit-mini-grid"><div><span>Disponível</span><strong>${user.creditEnabled ? money(availableCredit) : 'Desativado'}</strong></div><div><span>Usado</span><strong>${user.creditEnabled ? money(user.creditUsed || 0) : '-'}</strong></div></div>
      <div class="actions-row">
        <button class="btn btn-secondary btn-small" data-edit-user="${user.id}">Editar</button>
        <button class="btn btn-secondary btn-small" data-user-history="${user.id}">Meus pedidos</button>
        <button class="btn btn-secondary btn-small" data-toggle-user="${user.id}">${user.active ? 'Desativar' : 'Ativar'}</button>
      </div>
    </article>`;
}

function orderCard(order) {
  return `
    <article class="order-card premium-card">
      <div class="card-title"><h3>${escapeHtml(order.customerName)}</h3>${statusBadge(order.status)}</div>
      <div class="small-text">${escapeHtml(order.storeName || '')}</div>
      <div class="small-text">${formatDateTime(order.createdAt)}</div>
      ${renderOrderTimeline(order)}
      <div class="order-item-list">${order.items.map(i => `<span class="order-item-chip">${escapeHtml(i.name)} (${i.quantity})</span>`).join('')}</div>
      <div class="line-row"><span>Total</span><strong>${money(order.total)}</strong></div>
      <div class="line-row"><span>Recebimento</span><strong>${escapeHtml(order.deliveryType)}</strong></div>
      <div class="line-row"><span>Pagamento</span><strong>${escapeHtml(order.paymentMethod)}</strong></div>
      <div class="actions-row">${orderActions(order)}<button class="btn btn-secondary btn-small" data-copy-order="${order.id}">Copiar resumo</button></div>
    </article>`;
}

function deliveryCard(order) {
  return `
    <article class="delivery-card premium-card ${!order.paid ? 'delivery-attention' : ''}">
      <div class="card-title"><h3>${escapeHtml(order.customerName)}</h3>${statusBadge(order.status)}</div>
      ${renderOrderTimeline(order)}
      <div class="small-text">${escapeHtml(order.address || '-')}</div>
      <div class="delivery-flags">${!order.paid ? '<span class="pill danger">Pagamento pendente</span>' : '<span class="pill neutral">Pago</span>'}${order.needChange ? `<span class="pill neutral">Troco: ${money(order.changeFor || 0)}</span>` : ''}</div>
      <div class="line-row"><span>Horário</span><strong>${formatDateTime(order.createdAt)}</strong></div>
      <div class="line-row"><span>Pagamento</span><strong>${order.paid ? 'Pago' : 'Acertar na entrega'}</strong></div>
      <div class="line-row"><span>Troco</span><strong>${order.needChange ? money(order.changeFor || 0) : 'Não'}</strong></div>
      <div class="line-row"><span>Total</span><strong>${money(order.total)}</strong></div>
      <div class="small-text">${escapeHtml(order.notes || 'Sem observações.')}</div>
      <div class="actions-row">
        <button class="btn btn-secondary btn-small" data-order-status="${order.id}|saiu_entrega">Saiu para entrega</button>
        <button class="btn btn-success btn-small" data-order-status="${order.id}|entregue">Entregue</button>
        ${order.paid ? '' : `<button class="btn btn-primary btn-small" data-mark-paid="${order.id}">Confirmar pagamento</button>`}
        <button class="btn btn-secondary btn-small" data-delivery-note="${order.id}">Observação</button>
        <button class="btn btn-secondary btn-small" data-copy-address="${order.id}">Copiar endereço</button>
      </div>
    </article>`;
}

function returnCard(record) {
  return `
    <article class="return-card premium-card">
      <div class="card-title"><h3>${escapeHtml(record.customerName)}</h3>${statusBadge(record.status || 'registrada')}</div>
      <div class="line-row"><span>Produto</span><strong>${escapeHtml(record.productName)}</strong></div>
      <div class="small-text">${escapeHtml(record.reason)}</div>
      <div class="small-text">${escapeHtml(record.notes || 'Sem observações.')}</div>
      <div class="small-text">Fotos: ${Array.isArray(record.photos) ? record.photos.length : 0}</div>
      <div class="small-text">${formatDateTime(record.createdAt)}</div>
      <div class="actions-row">
        <button class="btn btn-secondary btn-small" data-return-status="${record.id}|em_analise">Em análise</button>
        <button class="btn btn-secondary btn-small" data-return-status="${record.id}|aprovada">Aprovada</button>
        <button class="btn btn-success btn-small" data-return-status="${record.id}|concluida">Concluir</button>
      </div>
    </article>`;
}

function statusLabel(status) {
  const map = {
    aguardando_confirmacao: 'Aguardando confirmação',
    em_separacao: 'Em separação',
    pronto_retirada: 'Pronto para retirada',
    saiu_entrega: 'Em rota',
    entregue: 'Entregue',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
    registrada: 'Registrada',
    em_analise: 'Em análise',
    aprovada: 'Aprovada',
    concluida: 'Concluída'
  };
  return map[status] || status;
}

function statusTone(status) {
  if (['ativo','disponível','entregue','concluido','aprovada','concluida'].includes(status)) return 'ok';
  if (['aguardando_confirmacao','registrada'].includes(status)) return 'warn';
  if (['em_separacao','saiu_entrega','em_analise'].includes(status)) return 'info';
  if (['pronto_retirada'].includes(status)) return 'info-dark';
  if (['inativo','sem_estoque','cancelado'].includes(status)) return 'danger';
  return 'neutral';
}

function statCard(label, value) {
  return `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`;
}

function statusBadge(status) {
  const map = {
    ativo: ['ok', 'Ativo'],
    inativo: ['danger', 'Inativo'],
    disponível: ['ok', 'Disponível'],
    sem_estoque: ['danger', 'Sem estoque'],
    aguardando_confirmacao: ['warn', 'Aguardando'],
    em_separacao: ['info', 'Em separação'],
    pronto_retirada: ['info-dark', 'Pronto retirada'],
    saiu_entrega: ['info', 'Saiu entrega'],
    entregue: ['ok', 'Entregue'],
    concluido: ['ok', 'Concluído'],
    cancelado: ['danger', 'Cancelado'],
    registrada: ['neutral', 'Registrada'],
    em_analise: ['warn', 'Em análise'],
    aprovada: ['info-dark', 'Aprovada'],
    concluida: ['ok', 'Concluída'],
  };
  const [klass, label] = map[status] || ['neutral', status];
  return `<span class="status ${klass}">${label}</span>`;
}

function orderActions(order) {
  const buttons = [];
  if (order.status === 'aguardando_confirmacao') buttons.push(actionButton(order.id, 'em_separacao', 'Confirmar estoque'));
  if (order.status === 'em_separacao' && order.deliveryType === 'retirada') buttons.push(actionButton(order.id, 'pronto_retirada', 'Marcar pronto'));
  if (order.status === 'em_separacao' && order.deliveryType === 'entrega') buttons.push(actionButton(order.id, 'saiu_entrega', 'Encaminhar entrega'));
  if (['pronto_retirada','saiu_entrega','entregue'].includes(order.status)) buttons.push(actionButton(order.id, 'concluido', 'Concluir'));
  if (!['concluido','cancelado'].includes(order.status)) buttons.push(actionButton(order.id, 'cancelado', 'Cancelar', 'btn-danger'));
  return buttons.join('');
}
function actionButton(id, status, label, klass='btn-secondary') {
  return `<button class="btn ${klass} btn-small" data-order-status="${id}|${status}">${label}</button>`;
}


function bindGlobalShell() {
  document.getElementById('logout-btn').onclick = () => { clearSession(); render(); };
  const backupBtn = document.getElementById('backup-btn');
  const restoreInput = document.getElementById('restore-input');
  if (backupBtn) {
    backupBtn.onclick = () => {
      downloadFile('backup-ultracell.json', JSON.stringify(storage.exportBackup(), null, 2));
      showToast('Backup exportado.');
    };
  }
  if (restoreInput) {
    restoreInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const content = await file.text();
      const parsed = JSON.parse(content);
      storage.restoreBackup(parsed);
      showToast('Backup restaurado.');
      render();
    };
  }

  const adminToggle = document.getElementById('admin-sidebar-toggle');
  if (adminToggle) {
    adminToggle.onclick = () => {
      state.adminSidebarCollapsed = !state.adminSidebarCollapsed;
      saveUiState();
      renderAdmin();
    };
  }

  const storeToggle = document.getElementById('store-sidebar-toggle');
  if (storeToggle) {
    storeToggle.onclick = () => {
      state.storeSidebarCollapsed = !state.storeSidebarCollapsed;
      saveUiState();
      renderStore();
    };
  }

  const profileToggle = document.getElementById('profile-panel-toggle');
  if (profileToggle) {
    profileToggle.onclick = () => {
      state.storeSidebarCollapsed = !state.storeSidebarCollapsed;
      saveUiState();
      renderStore();
    };
  }

  const resetBtn = document.getElementById('system-reset-btn');
  if (resetBtn) {
    resetBtn.onclick = async () => {
      const confirmText = window.prompt('Digite RESETAR para apagar os dados e iniciar o projeto do zero.');
      if (confirmText !== 'RESETAR') return showToast('Reset cancelado.');
      let preservedAdmin = null;
      const admins = storage.get(storage.keys.admins, []);
      if (state.session?.type === 'admin') {
        preservedAdmin = admins.find(admin => admin.login === state.session.login) || null;
      }
      const remotePayload = preservedAdmin ? {
        preserve_admin: true,
        admin: {
          login: preservedAdmin.login,
          password: preservedAdmin.password,
          name: preservedAdmin.name,
          full_name: preservedAdmin.name
        }
      } : {};
      if (isRemoteEnabled()) await remoteResetSystem(remotePayload);
      await storage.resetAllData({ preserveAdmin: preservedAdmin });
      showToast('Sistema resetado. Base limpa para novo cliente.');
      render();
    };
  }

  renderConnectionIndicator();
}
function bindStoreEvents() {
  document.getElementById('store-search').oninput = e => { state.filters.search = e.target.value; renderStore(); };
  document.getElementById('filter-brand').onchange = e => { state.filters.brand = e.target.value; renderStore(); };
  document.getElementById('filter-category').onchange = e => { state.filters.category = e.target.value; renderStore(); };
  document.getElementById('filter-model').oninput = e => { state.filters.model = e.target.value; renderStore(); };
  document.getElementById('filter-status').onchange = e => { state.filters.status = e.target.value; renderStore(); };

  document.querySelectorAll('[data-card-qty]').forEach(input => input.oninput = () => {
    state.productQtys[input.dataset.cardQty] = Math.max(1, Number(input.value || 1));
  });
  document.querySelectorAll('[data-qty-step]').forEach(btn => btn.onclick = () => {
    const [id, delta] = btn.dataset.qtyStep.split('|');
    const current = Math.max(1, Number(state.productQtys[id] || document.querySelector(`[data-card-qty="${id}"]`)?.value || 1));
    state.productQtys[id] = Math.max(1, current + Number(delta));
    renderStore();
  });

  document.querySelectorAll('[data-add-cart]').forEach(btn => btn.onclick = () => {
    const qty = Math.max(1, Number(state.productQtys[btn.dataset.addCart] || 1));
    const result = addToCart(state.session.id, btn.dataset.addCart, qty);
    showToast(result.ok ? 'Item adicionado ao carrinho.' : result.message);
    if (result.ok) renderStore();
  });
  document.querySelectorAll('[data-order-now]').forEach(btn => btn.onclick = () => openCheckoutModal(btn.dataset.orderNow, Math.max(1, Number(state.productQtys[btn.dataset.orderNow] || 1))));

  document.querySelectorAll('[data-favorite-toggle]').forEach(btn => btn.onclick = () => { toggleFavorite(btn.dataset.favoriteToggle); renderStore(); });
  document.getElementById('favorite-filter-btn').onclick = () => { state.userFavoriteFilter = !state.userFavoriteFilter; renderStore(); };
  document.getElementById('favorite-filter-sidebar')?.addEventListener('click', () => { state.userFavoriteFilter = !state.userFavoriteFilter; renderStore(); });
  document.getElementById('floating-cart-btn').onclick = () => openCartModal();
  document.getElementById('my-orders-btn')?.addEventListener('click', () => openMyOrdersModal());
  document.getElementById('edit-profile-btn')?.addEventListener('click', () => openProfileModal());
}
function openCheckoutModal(singleProductId = null, singleQty = 1) {
  const user = getUserById(state.session.id);
  const cart = singleProductId
    ? [{ productId: singleProductId, quantity: Math.max(1, Number(singleQty || 1)) }].map(i => {
        const p = getProducts().find(x => x.id === i.productId);
        return p ? { ...i, name: p.name, unitPrice: p.price, subtotal: p.price } : null;
      }).filter(Boolean)
    : getDetailedCart(state.session.id);

  if (!cart.length) return showToast('Nenhum item selecionado.');
  if (cart.some(item => item.availabilityStatus !== 'available')) return showToast('Remova do carrinho os itens sem estoque.');
  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const availableCredit = Math.max(0, Number(user.creditLimit || 0) - Number(user.creditUsed || 0));

  const modal = openModal('Fechar pedido', `
    <form id="checkout-form" class="grid grid-2">
      <div class="panel" style="grid-column:1/-1">
        <strong>Itens do pedido</strong>
        <div class="small-text">${cart.map(i => `${escapeHtml(i.name)} (${i.quantity})`).join(' · ')}</div>
        <div class="price" style="margin-top:8px">${money(total)}</div>
      </div>
      <div class="field"><label>Recebimento</label><select class="select" name="deliveryType"><option value="retirada">Retirada</option><option value="entrega">Entrega</option></select></div>
      <div class="field"><label>Pagamento</label><select class="select" name="paymentMethod" id="payment-method"><option value="dinheiro">Dinheiro</option><option value="pix">Pix</option><option value="debito">Débito</option><option value="credito">Crédito</option>${user.creditEnabled ? '<option value="nota">Pagar na nota</option>' : ''}</select></div>
      <div class="field hidden" id="change-field"><label>Troco para</label><input class="input" type="number" step="0.01" min="0" inputmode="decimal" name="changeFor" inputmode="decimal"></div>
      <div class="field hidden" id="pix-field"><label>Chave Pix</label><div class="actions-row"><input class="input" value="${defaultPixKey}" readonly><button class="btn btn-secondary btn-small" type="button" id="copy-pix">Copiar chave</button></div></div>
      <div class="field"><label>Observações</label><textarea class="textarea" name="notes" placeholder="Entrega, referência, urgência..."></textarea></div>
      <div class="field"><label>Endereço</label><input class="input" name="address" value="${escapeHtml(user.address || '')}"></div>
      <div class="inline-note" style="grid-column:1/-1">Crédito disponível: <strong>${user.creditEnabled ? money(availableCredit) : 'Indisponível'}</strong>. Em crédito parcelado, consulte taxa com o entregador.</div>
      <div class="footer-actions" style="grid-column:1/-1"><button class="btn btn-primary" type="submit">Confirmar pedido</button></div>
    </form>`);

  const paymentMethod = modal.querySelector('#payment-method');
  const changeField = modal.querySelector('#change-field');
  const pixField = modal.querySelector('#pix-field');
  const syncPayment = () => {
    changeField.classList.toggle('hidden', paymentMethod.value !== 'dinheiro');
    pixField.classList.toggle('hidden', paymentMethod.value !== 'pix');
  };
  syncPayment();
  paymentMethod.onchange = syncPayment;
  modal.querySelector('#copy-pix')?.addEventListener('click', async () => showToast(await copyText(defaultPixKey) ? 'Chave Pix copiada.' : 'Não foi possível copiar.'));

  modal.querySelector('#checkout-form').onsubmit = (e) => {
    e.preventDefault();
    try {
      const fd = new FormData(e.currentTarget);
      const payment = String(fd.get('paymentMethod'));
      const changeFor = Number(fd.get('changeFor') || 0);
      const creditUsed = payment === 'nota' ? total : 0;
      if (payment === 'nota' && (!user.creditEnabled || total > availableCredit)) return showToast('Limite de crédito insuficiente.');
      createOrder({
        userId: user.id,
        customerName: user.fullName,
        storeName: user.storeName,
        address: String(fd.get('address') || user.address || ''),
        items: cart.map(i => ({ productId: i.productId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal })),
        total,
        deliveryType: String(fd.get('deliveryType')),
        paymentMethod: payment,
        paid: payment === 'pix' || payment === 'debito' || payment === 'credito',
        needChange: payment === 'dinheiro' && changeFor > 0,
        changeFor,
        changeValue: payment === 'dinheiro' && changeFor > 0 ? Math.max(0, changeFor - total) : 0,
        creditUsed,
        notes: String(fd.get('notes') || ''),
      });
      if (!singleProductId) clearCart(user.id);
      modal.remove();
      openOrderSubmittedModal();
      renderStore();
    } catch (error) {
      showToast(error.message || 'Não foi possível concluir o pedido.');
    }
  };
}

function openCartModal() {
  const user = getUserById(state.session.id);
  const cart = getDetailedCart(state.session.id);
  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const modal = openModal('Meu carrinho', `
    <div class="grid cart-modal-grid">
      <div class="list">
        ${cart.length ? cart.map(item => `
          <div class="cart-item">
            <div class="item-row"><strong>${escapeHtml(item.name)}</strong><span>${money(item.subtotal)}</span></div>
            <div class="small-text">${money(item.unitPrice)} cada · ${item.availabilityStatus === 'available' ? 'Disponível' : 'Sem estoque'}</div>
            <div class="actions-row" style="margin-top:10px;">
              <input class="input compact-input" type="number" min="1" data-modal-cart-qty="${item.productId}" value="${item.quantity}">
              <button class="btn btn-secondary btn-small" data-modal-remove-cart="${item.productId}">Remover</button>
            </div>
          </div>`).join('') : '<div class="empty-state">Seu carrinho está vazio.</div>'}
      </div>
      <div class="panel summary-panel modal-summary-panel">
        <h2>Resumo do pedido</h2>
        <div class="line-row"><span>Total de itens</span><strong>${cart.reduce((a,i)=>a+i.quantity,0)}</strong></div>
        <div class="line-row"><span>Total geral</span><strong>${money(total)}</strong></div>
        <div class="line-row"><span>Crédito disponível</span><strong>${user.creditEnabled ? money(Math.max(0, Number(user.creditLimit || 0) - Number(user.creditUsed || 0))) : 'Indisponível'}</strong></div>
        <div class="footer-actions">
          <button class="btn btn-secondary" id="modal-clear-cart-btn">Limpar carrinho</button>
          <button class="btn btn-primary" id="modal-checkout-btn" ${cart.length ? '' : 'disabled'}>Finalizar pedido</button>
        </div>
      </div>
    </div>`);
  modal.querySelectorAll('[data-modal-cart-qty]').forEach(input => input.onchange = () => { updateCartQty(state.session.id, input.dataset.modalCartQty, input.value); modal.remove(); openCartModal(); renderStore(); });
  modal.querySelectorAll('[data-modal-remove-cart]').forEach(btn => btn.onclick = () => { removeFromCart(state.session.id, btn.dataset.modalRemoveCart); modal.remove(); openCartModal(); renderStore(); });
  modal.querySelector('#modal-clear-cart-btn').onclick = () => { clearCart(state.session.id); showToast('Carrinho limpo.'); modal.remove(); renderStore(); };
  modal.querySelector('#modal-checkout-btn')?.addEventListener('click', () => { modal.remove(); openCheckoutModal(); });
}

function getUserOrderGroups(userId) {
  const orders = getOrders().filter(o => o.userId === userId);
  return {
    em_aberto: orders.filter(o => ['aguardando_confirmacao','em_separacao','pronto_retirada'].includes(o.status)),
    em_rota: orders.filter(o => ['saiu_entrega'].includes(o.status)),
    entregue: orders.filter(o => ['entregue','concluido'].includes(o.status)),
  };
}

function getUserFacingOrderMessage(order) {
  if (order.status === 'aguardando_confirmacao') return 'Aguarde confirmação do fornecedor';
  if (order.status === 'em_separacao') return 'Pedido confirmado e sendo separado';
  if (order.status === 'pronto_retirada') return 'Pedido confirmado e pronto para retirada';
  if (order.status === 'saiu_entrega') return 'Pedido em rota de entrega';
  if (['entregue','concluido'].includes(order.status)) return 'Pedido entregue';
  if (order.status === 'cancelado') return 'Pedido cancelado';
  return 'Pedido em andamento';
}

function userOrderCard(order) {
  return `
    <article class="order-card premium-card">
      <div class="card-title"><h3>${escapeHtml(order.id)}</h3>${statusBadge(order.status)}</div>
      <div class="small-text">${formatDateTime(order.createdAt)}</div>
      ${renderOrderTimeline(order)}
      <div class="order-item-list">${order.items.map(i => `<span class="order-item-chip">${escapeHtml(i.name)} · ${i.quantity}un</span>`).join('')}</div>
      <div class="line-row"><span>Total</span><strong>${money(order.total)}</strong></div>
      <div class="line-row"><span>Recebimento</span><strong>${escapeHtml(order.deliveryType)}</strong></div>
      <div class="line-row"><span>Status atual</span><strong>${getUserFacingOrderMessage(order)}</strong></div>
      <div class="actions-row"><button class="btn btn-secondary btn-small" data-repeat-order="${order.id}">Pedir novamente</button></div>
    </article>`;
}

function openMyOrdersModal() {
  const groups = getUserOrderGroups(state.session.id);
  const modal = openModal('Meus pedidos', `
    <div class="grid">
      <div class="orders-group-block">
        <div class="section-title"><h3>Em aberto</h3><span class="pill neutral">${groups.em_aberto.length}</span></div>
        <div class="list">${groups.em_aberto.map(userOrderCard).join('') || '<div class="empty-state compact-empty">Nenhum pedido em aberto.</div>'}</div>
      </div>
      <div class="orders-group-block">
        <div class="section-title"><h3>Em rota</h3><span class="pill neutral">${groups.em_rota.length}</span></div>
        <div class="list">${groups.em_rota.map(userOrderCard).join('') || '<div class="empty-state compact-empty">Nenhum pedido em rota.</div>'}</div>
      </div>
      <div class="orders-group-block">
        <div class="section-title"><h3>Entregue</h3><span class="pill neutral">${groups.entregue.length}</span></div>
        <div class="list">${groups.entregue.map(userOrderCard).join('') || '<div class="empty-state compact-empty">Nenhum pedido entregue.</div>'}</div>
      </div>
    </div>`);
  modal.querySelectorAll('[data-repeat-order]').forEach(btn => btn.onclick = () => { repeatOrderToCart(btn.dataset.repeatOrder); modal.remove(); });
  return modal;
}

function repeatOrderToCart(orderId) {
  const order = getOrders().find(item => item.id === orderId && item.userId === state.session.id);
  if (!order) return showToast('Pedido não encontrado.');
  const unavailable = (order.items || []).filter(item => { const product = getProducts().find(p => p.id === item.productId); return !product || product.availabilityStatus !== 'available' || !product.active; });
  if (unavailable.length) {
    showToast('Alguns itens não estão disponíveis. Adicionados apenas os disponíveis.');
  }
  (order.items || []).forEach(item => {
    const product = getProducts().find(p => p.id === item.productId);
    if (product && product.active && product.availabilityStatus === 'available') addToCart(state.session.id, item.productId, item.quantity);
  });
  renderStore();
  showToast('Itens enviados para o carrinho.');
}


function openOrderSubmittedModal() {
  const modal = openModal('Pedido enviado', `
    <div class="grid">
      <div class="soft-card order-feedback-card">
        <strong>Aguarde confirmação do fornecedor</strong>
        <div class="small-text">Quando o fornecedor confirmar, o status será atualizado para:</div>
        <div class="status info" style="margin-top:10px; width:max-content;">Pedido confirmado e sendo separado</div>
      </div>
      <div class="footer-actions"><button class="btn btn-primary" id="open-orders-after-submit">Ver meus pedidos</button></div>
    </div>`);
  modal.querySelector('#open-orders-after-submit').onclick = () => { modal.remove(); openMyOrdersModal(); };
}

function openProfileModal() {
  const user = getUserById(state.session.id);
  const modal = openModal('Meu perfil', `
    <form id="profile-form" class="grid grid-2">
      <div class="field"><label>Nome completo</label><input class="input" name="fullName" value="${escapeHtml(user?.fullName || '')}" required></div>
      <div class="field"><label>Nome da loja</label><input class="input" name="storeName" value="${escapeHtml(user?.storeName || '')}" required></div>
      <div class="field"><label>Endereço</label><input class="input" name="address" value="${escapeHtml(user?.address || '')}" required></div>
      <div class="field"><label>Contato</label><input class="input" id="profile-phone-mask" name="contact" value="${escapeHtml(user?.contact || '')}" required></div>
      <div class="field field-media" style="grid-column:1/-1">
        <label>Foto do perfil</label>
        <div class="media-picker-row">
          <button class="btn btn-secondary" type="button" id="profile-photo-trigger">Abrir câmera / escolher arquivo</button>
          <input class="hidden" type="file" id="profile-photo-file" accept="image/*" capture="environment">
          <input class="input" name="photo" id="profile-photo-value" value="${escapeHtml(user?.photo || '')}" placeholder="URL da foto ou imagem capturada/carregada automaticamente">
        </div>
        <div class="media-preview-card avatar-preview ${user?.photo ? '' : 'is-empty'}" id="profile-photo-preview">${user?.photo ? `<img src="${escapeHtml(user.photo)}" alt="Prévia do perfil">` : `<span>${escapeHtml(initialsFromName(user?.fullName || 'Cliente'))}</span>`}</div>
      </div>
      <div class="footer-actions" style="grid-column:1/-1"><button class="btn btn-primary" type="submit">Salvar perfil</button></div>
    </form>`);
  const phoneMask = modal.querySelector('#profile-phone-mask');
  const photoTrigger = modal.querySelector('#profile-photo-trigger');
  const photoFile = modal.querySelector('#profile-photo-file');
  const photoValue = modal.querySelector('#profile-photo-value');
  const photoPreview = modal.querySelector('#profile-photo-preview');
  phoneMask.oninput = () => phoneMask.value = maskPhone(phoneMask.value);
  const syncPreview = () => {
    const value = String(photoValue.value || '').trim();
    const name = modal.querySelector('[name="fullName"]').value || 'Cliente';
    photoPreview.classList.toggle('is-empty', !value);
    photoPreview.innerHTML = value ? `<img src="${escapeHtml(value)}" alt="Prévia do perfil">` : `<span>${escapeHtml(initialsFromName(name))}</span>`;
  };
  modal.querySelector('[name="fullName"]').oninput = syncPreview;
  photoTrigger.onclick = () => photoFile.click();
  photoFile.onchange = async () => {
    const file = photoFile.files?.[0];
    if (!file) return;
    const dataUrl = await compressImageFile(file, { maxWidth: 960, maxHeight: 960, quality: 0.8 });
    photoValue.value = dataUrl;
    syncPreview();
  };
  syncPreview();
  modal.querySelector('#profile-form').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    payload.contact = onlyDigits(payload.contact);
    updateUser(user.id, payload);
    modal.remove();
    showToast('Perfil atualizado.');
    renderStore();
  };
}

function bindAdminEvents() {
  document.querySelectorAll('[data-route]').forEach(btn => btn.onclick = () => { state.route = btn.dataset.route; renderAdmin(); });
  document.querySelectorAll('[data-dashboard-route]').forEach(btn => btn.onclick = () => { state.route = btn.dataset.dashboardRoute; renderAdmin(); });

  if (state.route === 'products') {
    document.getElementById('new-product-btn').onclick = () => openProductModal();
    document.getElementById('product-search').oninput = e => { state.productSearch = e.target.value; renderAdmin(); };
    document.getElementById('admin-product-status').onchange = e => { state.filters.status = e.target.value; renderAdmin(); };
    document.querySelectorAll('[data-edit-product]').forEach(btn => btn.onclick = () => openProductModal(btn.dataset.editProduct));
    document.querySelectorAll('[data-duplicate-product]').forEach(btn => btn.onclick = () => { duplicateProduct(btn.dataset.duplicateProduct); showToast('Produto duplicado.'); renderAdmin(); });
    document.querySelectorAll('[data-delete-product]').forEach(btn => btn.onclick = () => { deleteProduct(btn.dataset.deleteProduct); showToast('Produto excluído.'); renderAdmin(); });
  }

  if (state.route === 'users') {
    document.getElementById('new-user-btn').onclick = () => openUserModal();
    document.getElementById('user-search').oninput = e => { state.userSearch = e.target.value; renderAdmin(); };
    document.querySelectorAll('[data-edit-user]').forEach(btn => btn.onclick = () => openUserModal(btn.dataset.editUser));
    document.querySelectorAll('[data-toggle-user]').forEach(btn => btn.onclick = () => {
      const user = getUserById(btn.dataset.toggleUser);
      updateUser(user.id, { active: !user.active });
      showToast(`Cliente ${user.active ? 'desativado' : 'ativado'}.`);
      renderAdmin();
    });
    document.querySelectorAll('[data-user-history]').forEach(btn => btn.onclick = () => openUserHistory(btn.dataset.userHistory));
  }

  if (state.route === 'orders' || state.route === 'deliveries') {
    document.querySelectorAll('[data-order-status]').forEach(btn => btn.onclick = () => {
      const [id, status] = btn.dataset.orderStatus.split('|');
      updateOrder(id, { status });
      showToast('Status atualizado.');
      renderAdmin();
    });
    document.querySelectorAll('[data-mark-paid]').forEach(btn => btn.onclick = () => {
      updateOrder(btn.dataset.markPaid, { paid: true });
      showToast('Pagamento confirmado.');
      renderAdmin();
    });
    document.getElementById('order-search')?.addEventListener('input', (e) => { state.orderSearch = e.target.value; renderAdmin(); });
    document.getElementById('order-status-filter')?.addEventListener('change', (e) => { state.orderStatusFilter = e.target.value; renderAdmin(); });
    document.querySelectorAll('[data-copy-order]').forEach(btn => btn.onclick = async () => { const order = getOrders().find(item => item.id === btn.dataset.copyOrder); showToast(await copyText(getOrderSummaryText(order)) ? 'Resumo copiado.' : 'Não foi possível copiar.'); });
    document.querySelectorAll('[data-copy-address]').forEach(btn => btn.onclick = async () => { const order = getOrders().find(item => item.id === btn.dataset.copyAddress); showToast(await copyText(order?.address || '') ? 'Endereço copiado.' : 'Não foi possível copiar.'); });
  }

  document.querySelectorAll('[data-delivery-note]').forEach(btn => btn.onclick = () => {
    const id = btn.dataset.deliveryNote;
    const order = getOrders().find(o => o.id === id);
    const text = window.prompt('Observação da entrega:', order?.notes || '');
    if (text === null) return;
    updateOrder(id, { notes: text });
    showToast('Observação da entrega atualizada.');
    renderAdmin();
  });

  if (state.route === 'returns') {
    document.getElementById('new-return-btn').onclick = openReturnModal;
    document.querySelectorAll('[data-return-status]').forEach(btn => btn.onclick = () => { const [id, status] = btn.dataset.returnStatus.split('|'); updateReturn(id, { status }); showToast('Status da devolução atualizado.'); renderAdmin(); });
  }
}

function openProductModal(id = null) {
  const product = id ? getProducts().find(p => p.id === id) : null;
  const modal = openModal(product ? 'Editar produto' : 'Novo produto', `
    <form id="product-form" class="grid grid-2">
      <div class="field"><label>Marca</label><input class="input" name="brand" value="${escapeHtml(product?.brand || '')}" required></div>
      <div class="field"><label>Categoria</label><input class="input" name="category" value="${escapeHtml(product?.category || '')}" required></div>
      <div class="field"><label>Modelo</label><input class="input" name="model" value="${escapeHtml(product?.model || '')}" required></div>
      <div class="field"><label>Nome</label><input class="input" name="name" value="${escapeHtml(product?.name || '')}" required></div>
      <div class="field"><label>Preço</label><input class="input" type="number" step="0.01" min="0" inputmode="decimal" name="price" inputmode="decimal" value="${product?.price ?? ''}" required></div>
      <div class="field"><label>Código interno</label><input class="input" name="code" value="${escapeHtml(product?.code || '')}" required></div>
      <div class="field field-media" style="grid-column:1/-1">
        <label>Imagem do produto</label>
        <div class="media-picker-row">
          <button class="btn btn-secondary" type="button" id="product-image-trigger">Abrir câmera / escolher arquivo</button>
          <input class="hidden" type="file" id="product-image-file" accept="image/*" capture="environment">
          <input class="input" name="image" id="product-image-value" value="${escapeHtml(product?.image || '')}" placeholder="URL da imagem ou imagem capturada/carregada automaticamente">
        </div>
        <div class="inline-note">No mobile, o botão pode abrir a câmera. No computador, abre o seletor de arquivos.</div>
        <div class="media-preview-card ${product?.image ? '' : 'is-empty'}" id="product-image-preview">${product?.image ? `<img src="${escapeHtml(product.image)}" alt="Prévia do produto">` : '<span>Prévia da imagem do produto</span>'}</div>
      </div>
      <div class="field"><label>Ativo</label><select class="select" name="active"><option value="true" ${product?.active !== false ? 'selected' : ''}>Sim</option><option value="false" ${product?.active === false ? 'selected' : ''}>Não</option></select></div>
      <div class="field"><label>Disponibilidade</label><select class="select" name="availabilityStatus"><option value="available" ${product?.availabilityStatus !== 'out_of_stock' ? 'selected' : ''}>Disponível</option><option value="out_of_stock" ${product?.availabilityStatus === 'out_of_stock' ? 'selected' : ''}>Sem estoque</option></select></div>
      <div class="footer-actions" style="grid-column:1/-1"><button class="btn btn-primary" type="submit">Salvar</button></div>
    </form>`);

  const productImageTrigger = modal.querySelector('#product-image-trigger');
  const productImageFile = modal.querySelector('#product-image-file');
  const productImageValue = modal.querySelector('#product-image-value');
  const productImagePreview = modal.querySelector('#product-image-preview');

  const syncProductPreview = () => {
    productImageValue.value = normalizeImageValue(productImageValue.value);
    attachPreviewImage(productImagePreview, productImageValue.value, 'Prévia do produto', '<span>Prévia da imagem do produto</span>');
  };

  productImageTrigger.onclick = () => productImageFile.click();
  productImageValue.oninput = syncProductPreview;
  productImageFile.onchange = async () => {
    const file = productImageFile.files?.[0];
    if (!file) return;
    const dataUrl = await compressImageFile(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.78 });
    productImageValue.value = normalizeImageValue(dataUrl);
    syncProductPreview();
    showToast('Imagem do produto otimizada e carregada.');
  };
  syncProductPreview();

  modal.querySelector('#product-form').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    payload.price = Number(payload.price || 0);
    payload.active = payload.active === 'true';
    payload.image = normalizeImageValue(payload.image);
    if (id) updateProduct(id, payload); else createProduct(payload);
    modal.remove();
    showToast('Produto salvo.');
    renderAdmin();
  };
}

function openUserModal(id = null) {
  const user = id ? getUserById(id) : null;
  const modal = openModal(user ? 'Editar usuário' : 'Novo usuário', `
    <form id="user-form" class="grid grid-2">
      <div class="field"><label>CPF</label><input class="input" id="cpf-mask" name="cpf" value="${escapeHtml(user?.cpf || '')}" inputmode="numeric" pattern="[0-9]*" required></div>
      <div class="field"><label>Número do sistema</label><input class="input" name="systemNumber" value="${escapeHtml(user?.systemNumber || '')}" inputmode="numeric" pattern="[0-9]*"></div>
      <div class="field"><label>Nome completo</label><input class="input" name="fullName" value="${escapeHtml(user?.fullName || '')}" required></div>
      <div class="field"><label>Nome da loja</label><input class="input" name="storeName" value="${escapeHtml(user?.storeName || '')}" required></div>
      <div class="field"><label>Endereço</label><input class="input" name="address" value="${escapeHtml(user?.address || '')}" required></div>
      <div class="field"><label>Contato</label><input class="input" id="phone-mask" name="contact" value="${escapeHtml(user?.contact || '')}" inputmode="tel" pattern="[0-9]*" required></div>
      <div class="field"><label>Perfil de acesso</label><select class="select" name="role"><option value="user" ${(user?.role || user?.type || 'user') === 'user' ? 'selected' : ''}>Usuário</option><option value="admin" ${(user?.role || user?.type) === 'admin' ? 'selected' : ''}>ADM</option><option value="deliverer" ${(user?.role || user?.type) === 'deliverer' ? 'selected' : ''}>Entregador</option></select></div>
      <div class="field field-media" style="grid-column:1/-1">
        <label>Foto do usuário</label>
        <div class="media-picker-row">
          <button class="btn btn-secondary" type="button" id="user-photo-trigger">Abrir câmera / escolher arquivo</button>
          <input class="hidden" type="file" id="user-photo-file" accept="image/*" capture="environment">
          <input class="input" name="photo" id="user-photo-value" value="${escapeHtml(user?.photo || '')}" placeholder="URL da foto ou imagem capturada/carregada automaticamente">
        </div>
        <div class="inline-note">A foto fica mais leve nos cards da versão web e melhor adaptada ao mobile.</div>
        <div class="media-preview-card avatar-preview ${user?.photo ? '' : 'is-empty'}" id="user-photo-preview">${user?.photo ? `<img src="${escapeHtml(user.photo)}" alt="Prévia do usuário">` : `<span>${escapeHtml(initialsFromName(user?.fullName || 'Usuário'))}</span>`}</div>
      </div>
      <div class="field"><label>Crédito ativo</label><select class="select" id="credit-toggle" name="creditEnabled"><option value="true" ${user?.creditEnabled ? 'selected' : ''}>Sim</option><option value="false" ${!user?.creditEnabled ? 'selected' : ''}>Não</option></select></div>
      <div class="field" id="credit-limit-field"><label>Limite de crédito</label><input class="input" type="number" step="0.01" min="0" inputmode="decimal" name="creditLimit" inputmode="decimal" value="${user?.creditLimit ?? 0}"></div>
      <div class="field"><label>Ativo</label><select class="select" name="active"><option value="true" ${user?.active !== false ? 'selected' : ''}>Sim</option><option value="false" ${user?.active === false ? 'selected' : ''}>Não</option></select></div>
      <div class="footer-actions" style="grid-column:1/-1"><button class="btn btn-primary" type="submit">Salvar</button></div>
    </form>`);

  const cpfMask = modal.querySelector('#cpf-mask');
  const phoneMask = modal.querySelector('#phone-mask');
  const creditToggle = modal.querySelector('#credit-toggle');
  const creditLimitField = modal.querySelector('#credit-limit-field');
  const userPhotoTrigger = modal.querySelector('#user-photo-trigger');
  const userPhotoFile = modal.querySelector('#user-photo-file');
  const userPhotoValue = modal.querySelector('#user-photo-value');
  const userPhotoPreview = modal.querySelector('#user-photo-preview');
  cpfMask.oninput = () => cpfMask.value = maskCPF(cpfMask.value);
  phoneMask.oninput = () => phoneMask.value = maskPhone(phoneMask.value);
  const syncCredit = () => creditLimitField.classList.toggle('hidden', creditToggle.value !== 'true');
  const syncUserPreview = () => {
    const value = String(userPhotoValue.value || '').trim();
    const fallback = initialsFromName(modal.querySelector('[name="fullName"]').value || 'Usuário');
    userPhotoPreview.classList.toggle('is-empty', !value);
    userPhotoPreview.innerHTML = value ? `<img src="${escapeHtml(value)}" alt="Prévia do usuário">` : `<span>${escapeHtml(fallback)}</span>`;
  };
  userPhotoTrigger.onclick = () => userPhotoFile.click();
  userPhotoFile.onchange = async () => {
    const file = userPhotoFile.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    userPhotoValue.value = dataUrl;
    syncUserPreview();
    showToast('Foto do usuário otimizada e carregada.');
  };
  modal.querySelector('[name="fullName"]').oninput = syncUserPreview;
  syncCredit();
  syncUserPreview();
  creditToggle.onchange = syncCredit;

  modal.querySelector('#user-form').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    payload.cpf = onlyDigits(payload.cpf);
    payload.contact = onlyDigits(payload.contact);
    payload.creditEnabled = payload.creditEnabled === 'true';
    payload.creditLimit = payload.creditEnabled ? Number(payload.creditLimit || 0) : 0;
    payload.active = payload.active === 'true';
    payload.role = payload.role || 'user';
    payload.type = payload.role;
    payload.login = payload.cpf;
    payload.password = payload.contact.slice(-4);
    if (id) updateUser(id, payload); else createUser(payload);
    modal.remove();
    showToast('Usuário salvo.');
    renderAdmin();
  };
}

function openUserHistory(id) {
  const user = getUserById(id);
  const orders = getOrders().filter(o => o.userId === id);
  const returns = getReturns().filter(r => r.userId === id || r.customerName === user.fullName);
  openModal(`Histórico · ${escapeHtml(user.fullName)}`, `
    <div class="grid grid-2">
      <div class="panel">
        <h3>Dados do cliente</h3>
        <div class="line-row"><span>Loja</span><strong>${escapeHtml(user.storeName)}</strong></div>
        <div class="line-row"><span>Status</span><strong>${user.active ? 'Ativo' : 'Inativo'}</strong></div>
        <div class="line-row"><span>Perfil</span><strong>${(user.role === 'admin' || user.type === 'admin') ? 'ADM' : ((user.role === 'deliverer' || user.type === 'deliverer') ? 'Entregador' : 'Usuário')}</strong></div>
        <div class="line-row"><span>Crédito</span><strong>${user.creditEnabled ? 'Ativo' : 'Desativado'}</strong></div>
        <div class="line-row"><span>Limite</span><strong>${money(user.creditLimit || 0)}</strong></div>
        <div class="line-row"><span>Usado</span><strong>${money(user.creditUsed || 0)}</strong></div>
      </div>
      <div class="panel">
        <h3>Resumo</h3>
        <div class="line-row"><span>Pedidos</span><strong>${orders.length}</strong></div>
        <div class="line-row"><span>Devoluções</span><strong>${returns.length}</strong></div>
        <div class="line-row"><span>Total comprado</span><strong>${money(orders.reduce((s, o) => s + Number(o.total || 0), 0))}</strong></div>
      </div>
      <div class="panel" style="grid-column:1/-1"><h3>Pedidos</h3>${orders.map(o => `<div class="soft-card small-text">${formatDateTime(o.createdAt)} · ${escapeHtml(o.status)} · ${money(o.total)}</div>`).join('') || '<div class="empty-state">Sem pedidos.</div>'}</div>
      <div class="panel" style="grid-column:1/-1"><h3>Devoluções</h3>${returns.map(r => `<div class="soft-card small-text">${formatDateTime(r.createdAt)} · ${escapeHtml(r.productName)} · ${escapeHtml(r.reason)}</div>`).join('') || '<div class="empty-state">Sem devoluções.</div>'}</div>
    </div>`);
}

function openReturnModal() {
  const users = getUsers();
  const products = getProducts();
  const modal = openModal('Nova devolução', `
    <form id="return-form" class="grid grid-2">
      <div class="field"><label>Cliente</label><select class="select" name="userId" id="return-user"><option value="">Selecione</option>${users.map(u => `<option value="${u.id}">${escapeHtml(u.fullName)} · ${escapeHtml(u.storeName)}</option>`).join('')}</select></div>
      <div class="field"><label>Produto</label><select class="select" name="productName"><option value="">Selecione</option>${products.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Motivo</label><select class="select" name="reason" required><option value="Peça com defeito">Peça com defeito</option><option value="Peça incorreta">Peça incorreta</option><option value="Avaria no transporte">Avaria no transporte</option><option value="Outro">Outro</option></select></div>
      <div class="field"><label>Fotos da devolução</label><input class="input" type="file" name="photos" id="return-photos" multiple required></div>
      <div class="field" style="grid-column:1/-1"><label>Observação</label><textarea class="textarea" name="notes"></textarea></div>
      <div class="inline-note" style="grid-column:1/-1">As fotos são obrigatórias para salvar a devolução.</div>
      <div class="footer-actions" style="grid-column:1/-1"><button class="btn btn-primary" type="submit">Salvar devolução</button></div>
    </form>`);

  modal.querySelector('#return-form').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const photos = modal.querySelector('#return-photos').files;
    if (!photos.length) return showToast('Adicione ao menos uma foto.');
    const user = getUserById(fd.get('userId'));
    createReturn({
      userId: user?.id || '',
      customerName: user?.fullName || 'Cliente não identificado',
      productName: String(fd.get('productName') || ''),
      reason: String(fd.get('reason') || ''),
      notes: String(fd.get('notes') || ''),
      photos: Array.from(photos).map(f => f.name),
      status: 'registrada'
    });
    modal.remove();
    showToast('Devolução registrada.');
    renderAdmin();
  };
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b), 'pt-BR'));
}

render();
