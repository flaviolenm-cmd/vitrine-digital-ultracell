import { storage } from '../storage.js';
import { getProductById } from './orders.js';

export function getCart(userId) {
  return storage.get(`${storage.keys.cartPrefix}${userId}`, []);
}
export function saveCart(userId, cart) {
  storage.set(`${storage.keys.cartPrefix}${userId}`, cart);
}
export function addToCart(userId, productId, quantity=1) {
  const product = getProductById(productId);
  if (!product || !product.active || product.availabilityStatus !== 'available') return { ok:false, message:'Produto indisponível.' };
  const qtyToAdd = Math.max(1, Number(quantity || 1));
  const cart = getCart(userId);
  const found = cart.find(i => i.productId === productId);
  if (found) found.quantity += qtyToAdd;
  else cart.push({ productId, quantity: qtyToAdd });
  saveCart(userId, cart);
  return { ok:true };
}
export function updateCartQty(userId, productId, quantity) {
  const nextQty = Math.max(1, Number(quantity || 1));
  const cart = getCart(userId).map(i => i.productId === productId ? { ...i, quantity: nextQty } : i);
  saveCart(userId, cart);
}
export function removeFromCart(userId, productId) {
  saveCart(userId, getCart(userId).filter(i => i.productId !== productId));
}
export function clearCart(userId) { saveCart(userId, []); }
export function getDetailedCart(userId) {
  return getCart(userId).map(item => {
    const p = getProductById(item.productId);
    if (!p) return null;
    return { ...item, name: p.name, unitPrice: p.price, subtotal: p.price * item.quantity, availabilityStatus: p.availabilityStatus, active: p.active };
  }).filter(Boolean);
}
