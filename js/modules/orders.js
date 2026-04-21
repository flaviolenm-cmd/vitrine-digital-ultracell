import { storage } from '../storage.js';
import { slugId } from '../utils.js';
import { getProducts } from './products.js';
import { getUserById, updateUser } from './users.js';

export function getOrders() { return storage.get(storage.keys.orders, []); }
export function saveOrders(orders) { storage.set(storage.keys.orders, orders); }
export function getProductById(id) { return getProducts().find(p => p.id === id); }
export function createOrder(payload) {
  validateOrderAvailability(payload.items || []);
  const orders = getOrders();
  const order = { id: slugId('ord'), status:'aguardando_confirmacao', createdAt:new Date().toISOString(), ...payload };
  orders.unshift(order);
  saveOrders(orders);
  if (order.creditUsed > 0) {
    const user = getUserById(order.userId);
    if (user) updateUser(user.id, { creditUsed: Number(user.creditUsed || 0) + Number(order.creditUsed || 0) });
  }
  storage.pushLog('order_created', { orderId: order.id, total: order.total });
  return order;
}

function validateOrderAvailability(items) {
  items.forEach(item => {
    const product = getProductById(item.productId);
    if (!product || !product.active || product.availabilityStatus !== 'available') {
      throw new Error(`Produto indisponível para ${item.name || 'o item selecionado'}.`);
    }
  });
}

export function updateOrder(id, patch) {
  const orders = getOrders().map(o => o.id === id ? { ...o, ...patch } : o);
  saveOrders(orders);
  storage.pushLog('order_updated', { orderId: id, patch });
}
export function getOrdersByUser(userId) { return getOrders().filter(o => o.userId === userId); }
