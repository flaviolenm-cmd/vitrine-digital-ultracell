import { getProducts } from './products.js';
import { getUsers } from './users.js';
import { getOrders } from './orders.js';

export function getDashboardData() {
  const products = getProducts();
  const users = getUsers();
  const orders = getOrders();
  const today = new Date().toDateString();
  const closedStatuses = ['concluido', 'entregue'];

  const totalSold = orders.reduce((acc, o) => acc + Number(o.total || 0), 0);
  const perCategory = {};
  const perClient = {};

  orders.forEach(order => {
    perClient[order.customerName] = (perClient[order.customerName] || 0) + Number(order.total || 0);
    order.items.forEach(item => {
      const category = inferCategory(item.name);
      perCategory[category] ||= {};
      perCategory[category][item.name] = (perCategory[category][item.name] || 0) + Number(item.quantity || 0);
    });
  });

  return {
    totalProducts: products.length,
    availableProducts: products.filter(p => p.active && p.availabilityStatus === 'available').length,
    outOfStockProducts: products.filter(p => p.availabilityStatus === 'out_of_stock').length,
    totalUsers: users.length,
    activeUsers: users.filter(u => u.active).length,
    inactiveUsers: users.filter(u => !u.active).length,
    totalOrders: orders.length,
    ordersToday: orders.filter(o => new Date(o.createdAt).toDateString() === today).length,
    deliveryOrders: orders.filter(o => o.deliveryType === 'entrega').length,
    pickupOrders: orders.filter(o => o.deliveryType === 'retirada').length,
    totalSold,
    ticketAverage: orders.length ? totalSold / orders.length : 0,
    openOrders: orders.filter(o => !closedStatuses.includes(o.status)).length,
    rankedByCategory: buildRankByCategory(perCategory),
    topClients: Object.entries(perClient).sort((a,b) => b[1]-a[1]).slice(0,5),
    urgentOrders: orders.filter(o => ['aguardando_confirmacao','em_separacao','saiu_entrega'].includes(o.status)).slice(0,5),
    outOfStockList: products.filter(p => p.availabilityStatus === 'out_of_stock').slice(0,5),
  };
}
function inferCategory(name='') {
  const lower = name.toLowerCase();
  if (lower.includes('bateria')) return 'Bateria';
  if (lower.includes('módulo') || lower.includes('modulo')) return 'Módulo';
  if (lower.includes('placa')) return 'Placa de carga';
  if (lower.includes('tampa')) return 'Tampa';
  if (lower.includes('flex')) return 'Flex power';
  return 'Outros';
}
function buildRankByCategory(perCategory) {
  return Object.entries(perCategory).map(([category, items]) => ({
    category,
    items: Object.entries(items).sort((a,b) => b[1]-a[1]).slice(0,5)
  }));
}
