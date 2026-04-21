import { storage } from '../storage.js';
import { slugId } from '../utils.js';
import { getProducts } from './products.js';
import { getUserById, updateUser } from './users.js';
import { remoteMutate } from '../api.js';

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
  remoteMutate('orders', 'POST', {
    user_id: order.userId, customer_name: order.customerName, store_name: order.storeName, delivery_type: order.deliveryType,
    payment_method: order.paymentMethod, payment_status: order.paid ? 'paid' : (order.paymentStatus || 'pending'), order_status: order.status,
    total: Number(order.total || 0), need_change: Number(order.needChange || 0), change_for: Number(order.changeFor || 0),
    credit_used: Number(order.creditUsed || 0), notes: order.notes || '',
    items: (order.items || []).map(item => ({ product_id: item.productId || item.product_id, name: item.name, quantity: item.quantity, unit_price: item.unitPrice || item.unit_price, subtotal: item.subtotal }))
  });
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
  const current = getOrders().find(o => o.id === id) || {};
  remoteMutate('orders', 'PUT', { ...current, ...patch, user_id: current.userId, customer_name: current.customerName, store_name: current.storeName, delivery_type: current.deliveryType, payment_method: current.paymentMethod, payment_status: (patch.paid ?? current.paid) ? 'paid' : (patch.paymentStatus || current.paymentStatus || 'pending'), order_status: patch.status || current.status, total: Number(current.total || 0), need_change: Number(current.needChange || 0), change_for: Number(current.changeFor || 0), credit_used: Number(current.creditUsed || 0), notes: patch.notes || current.notes || '', items: (current.items || []).map(item => ({ product_id: item.productId || item.product_id, name: item.name, quantity: item.quantity, unit_price: item.unitPrice || item.unit_price, subtotal: item.subtotal })) }, id);
}
export function getOrdersByUser(userId) { return getOrders().filter(o => o.userId === userId); }
