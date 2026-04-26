import { storage } from '../storage.js';
import { slugId } from '../utils.js';
import { getProducts, hasManagedColors, isColorAvailable } from './products.js';
import { getUserById, updateUser } from './users.js';
import { remoteMutate } from '../api.js';

function normalizeText(value = '') {
  return String(value || '').trim();
}

function itemDisplayName(item = {}) {
  const name = normalizeText(item.name);
  const color = normalizeText(item.color || item.selectedColor || item.productColor);
  if (!color) return name;
  if (name.toLowerCase().includes(`cor: ${color.toLowerCase()}`) || name.toLowerCase().endsWith(`- ${color.toLowerCase()}`)) return name;
  return `${name} - Cor: ${color}`;
}

function normalizeOrderItem(item = {}) {
  const quantity = Math.max(1, Number(item.quantity || 1));
  const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
  const color = normalizeText(item.color || item.selectedColor || item.productColor);
  return {
    ...item,
    productId: item.productId || item.product_id,
    product_id: item.product_id || item.productId,
    name: item.name,
    displayName: itemDisplayName(item),
    color,
    quantity,
    unitPrice,
    unit_price: unitPrice,
    subtotal: Number(item.subtotal ?? (unitPrice * quantity))
  };
}

export function getOrders() {
  return storage.get(storage.keys.orders, []).map(order => ({
    ...order,
    items: (order.items || []).map(normalizeOrderItem)
  }));
}
export function saveOrders(orders) { storage.set(storage.keys.orders, orders); }
export function getProductById(id) { return getProducts().find(p => p.id === id); }
export function createOrder(payload) {
  const items = (payload.items || []).map(normalizeOrderItem);
  validateOrderAvailability(items);
  const orders = getOrders();
  const order = { id: slugId('ord'), status:'aguardando_confirmacao', createdAt:new Date().toISOString(), ...payload, items };
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
    items: (order.items || []).map(item => ({
      product_id: item.productId || item.product_id,
      name: item.displayName || itemDisplayName(item),
      product_name: item.name,
      color: item.color || '',
      quantity: item.quantity,
      unit_price: item.unitPrice || item.unit_price,
      subtotal: item.subtotal
    }))
  });
  return order;
}

function validateOrderAvailability(items) {
  items.forEach(item => {
    const product = getProductById(item.productId || item.product_id);
    if (!product || !product.active || product.availabilityStatus !== 'available') {
      throw new Error(`Produto indisponível para ${item.name || 'o item selecionado'}.`);
    }
    if (hasManagedColors(product) && !isColorAvailable(product, item.color)) {
      throw new Error(`Cor indisponível para ${item.name || 'o item selecionado'}.`);
    }
  });
}

export function updateOrder(id, patch) {
  const normalizedPatch = patch.items ? { ...patch, items: patch.items.map(normalizeOrderItem) } : patch;
  const orders = getOrders().map(o => o.id === id ? { ...o, ...normalizedPatch } : o);
  saveOrders(orders);
  storage.pushLog('order_updated', { orderId: id, patch: normalizedPatch });
  const current = getOrders().find(o => o.id === id) || {};
  remoteMutate('orders', 'PUT', {
    ...current,
    ...normalizedPatch,
    user_id: current.userId,
    customer_name: current.customerName,
    store_name: current.storeName,
    delivery_type: current.deliveryType,
    payment_method: current.paymentMethod,
    payment_status: (normalizedPatch.paid ?? current.paid) ? 'paid' : (normalizedPatch.paymentStatus || current.paymentStatus || 'pending'),
    order_status: normalizedPatch.status || current.status,
    total: Number(current.total || 0),
    need_change: Number(current.needChange || 0),
    change_for: Number(current.changeFor || 0),
    credit_used: Number(current.creditUsed || 0),
    notes: normalizedPatch.notes || current.notes || '',
    items: (current.items || []).map(item => ({
      product_id: item.productId || item.product_id,
      name: item.displayName || itemDisplayName(item),
      product_name: item.name,
      color: item.color || '',
      quantity: item.quantity,
      unit_price: item.unitPrice || item.unit_price,
      subtotal: item.subtotal
    }))
  }, id);
}
export function getOrdersByUser(userId) { return getOrders().filter(o => o.userId === userId); }
