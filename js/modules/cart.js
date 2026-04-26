import { storage } from '../storage.js';
import { getProductById } from './orders.js';
import { getAvailableProductColors, hasManagedColors, isColorAvailable } from './products.js';

function normalizeText(value = '') {
  return String(value || '').trim();
}

function normalizeCartItem(item = {}) {
  return {
    productId: item.productId || item.product_id,
    quantity: Math.max(1, Number(item.quantity || 1)),
    color: normalizeText(item.color || item.selectedColor || item.productColor || '')
  };
}

function cartKey(productId, color = '') {
  return `${productId}::${normalizeText(color).toLowerCase()}`;
}

function resolveColor(product, requestedColor = '') {
  const wanted = normalizeText(requestedColor);
  if (!hasManagedColors(product)) return wanted;
  if (wanted && isColorAvailable(product, wanted)) return wanted;
  return getAvailableProductColors(product)[0]?.name || '';
}

function matchesCartTarget(item, productId, color = '') {
  const wantedColor = normalizeText(color);
  if (wantedColor) return cartKey(item.productId, item.color) === cartKey(productId, wantedColor);
  return item.productId === productId;
}

export function getCart(userId) {
  return storage.get(`${storage.keys.cartPrefix}${userId}`, []).map(normalizeCartItem).filter(item => item.productId);
}

export function saveCart(userId, cart) {
  storage.set(`${storage.keys.cartPrefix}${userId}`, cart.map(normalizeCartItem).filter(item => item.productId));
}

export function addToCart(userId, productId, quantity=1, color='') {
  const product = getProductById(productId);
  if (!product || !product.active || product.availabilityStatus !== 'available') return { ok:false, message:'Produto indisponível.' };

  const selectedColor = resolveColor(product, color);
  if (hasManagedColors(product) && !isColorAvailable(product, selectedColor)) {
    return { ok:false, message:'Selecione uma cor disponível para este produto.' };
  }

  const qtyToAdd = Math.max(1, Number(quantity || 1));
  const cart = getCart(userId);
  const found = cart.find(i => cartKey(i.productId, i.color) === cartKey(productId, selectedColor));
  if (found) found.quantity += qtyToAdd;
  else cart.push({ productId, quantity: qtyToAdd, color: selectedColor });
  saveCart(userId, cart);
  return { ok:true };
}

export function updateCartQty(userId, productId, quantity, color='') {
  const nextQty = Math.max(1, Number(quantity || 1));
  const cart = getCart(userId).map(i => matchesCartTarget(i, productId, color) ? { ...i, quantity: nextQty } : i);
  saveCart(userId, cart);
}

export function removeFromCart(userId, productId, color='') {
  saveCart(userId, getCart(userId).filter(i => !matchesCartTarget(i, productId, color)));
}

export function clearCart(userId) { saveCart(userId, []); }

export function getDetailedCart(userId) {
  return getCart(userId).map(item => {
    const p = getProductById(item.productId);
    if (!p) return null;
    const color = resolveColor(p, item.color);
    return {
      ...item,
      color,
      name: p.name,
      displayName: color ? `${p.name} - ${color}` : p.name,
      unitPrice: p.price,
      subtotal: p.price * item.quantity,
      availabilityStatus: p.availabilityStatus,
      active: p.active,
      colorAvailable: !hasManagedColors(p) || isColorAvailable(p, color)
    };
  }).filter(Boolean);
}
