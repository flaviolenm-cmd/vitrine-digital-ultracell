import { storage } from '../storage.js';
import { slugId } from '../utils.js';
import { remoteMutate } from '../api.js';

const AVAILABLE = 'available';
const OUT_OF_STOCK = 'out_of_stock';

function normalizeText(value = '') {
  return String(value || '').trim();
}

function normalizeStatus(value, fallback = AVAILABLE) {
  const raw = String(value ?? fallback).trim().toLowerCase();
  if (!raw) return fallback;
  if (['out_of_stock', 'sem_estoque', 'sem estoque', 'indisponivel', 'indisponível', 'unavailable', 'inactive'].includes(raw)) return OUT_OF_STOCK;
  if (raw.includes('sem estoque') || raw.includes('indispon')) return OUT_OF_STOCK;
  return AVAILABLE;
}

function normalizeActive(value) {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value === 'boolean') return value;
  const raw = String(value).trim().toLowerCase();
  return !['0', 'false', 'inactive', 'inativo', 'no', 'não', 'nao'].includes(raw);
}

function parseColorLine(line = '') {
  const raw = normalizeText(line);
  if (!raw) return null;
  const [namePart, statusPart] = raw.split(/\s*(?:=|:)\s*/);
  const name = normalizeText(namePart);
  if (!name) return null;
  return {
    name,
    availabilityStatus: normalizeStatus(statusPart || (raw.toLowerCase().includes('sem estoque') ? OUT_OF_STOCK : AVAILABLE))
  };
}

export function normalizeProductColors(product = {}) {
  const source = product.colors ?? product.colorOptions ?? product.colors_json ?? product.colorsJson ?? product.color_list ?? product.colorList ?? '';
  let parsed = [];

  if (Array.isArray(source)) {
    parsed = source.map((item) => {
      if (typeof item === 'string') return parseColorLine(item);
      const name = normalizeText(item?.name ?? item?.color ?? item?.label);
      if (!name) return null;
      const rawStatus = item?.availabilityStatus ?? item?.availability_status ?? item?.status ?? (item?.inStock === false || item?.available === false ? OUT_OF_STOCK : AVAILABLE);
      return { name, availabilityStatus: normalizeStatus(rawStatus) };
    });
  } else if (typeof source === 'string' && source.trim()) {
    try {
      const json = JSON.parse(source);
      parsed = normalizeProductColors({ colors: json });
    } catch {
      parsed = source.split(/[\n;,]+/).map(parseColorLine);
    }
  }

  const seen = new Set();
  return parsed
    .filter(Boolean)
    .filter((item) => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function hasManagedColors(product = {}) {
  return normalizeProductColors(product).length > 0;
}

export function getAvailableProductColors(product = {}) {
  return normalizeProductColors(product).filter(color => color.availabilityStatus === AVAILABLE);
}

export function isColorAvailable(product = {}, colorName = '') {
  const colors = normalizeProductColors(product);
  if (!colors.length) return true;
  const wanted = normalizeText(colorName).toLowerCase();
  if (!wanted) return false;
  return colors.some(color => color.name.toLowerCase() === wanted && color.availabilityStatus === AVAILABLE);
}

function normalizeAvailability(payload = {}) {
  const colors = normalizeProductColors(payload);
  const fallbackStatus = payload.availabilityStatus
    || payload.availability_status
    || (payload.inStock === false || Number(payload.stockQty || 0) <= 0 ? OUT_OF_STOCK : AVAILABLE);
  const status = colors.length
    ? (colors.some(color => color.availabilityStatus === AVAILABLE) ? AVAILABLE : OUT_OF_STOCK)
    : normalizeStatus(fallbackStatus);

  return {
    ...payload,
    active: normalizeActive(payload.active),
    colors,
    availabilityStatus: status,
    inStock: status === AVAILABLE
  };
}

export function normalizeProduct(product = {}) {
  const normalized = normalizeAvailability(product);
  delete normalized.stockQty;
  delete normalized.availability_status;
  delete normalized.colors_json;
  delete normalized.colorsJson;
  return normalized;
}

export function getProducts() {
  return storage.get(storage.keys.products, []).map(normalizeProduct);
}

export function saveProducts(products) {
  storage.set(storage.keys.products, products.map(normalizeProduct));
}

function productPayloadForRemote(product) {
  return {
    brand: product.brand,
    category: product.category,
    model: product.model,
    name: product.name,
    price: Number(product.price || 0),
    internal_code: product.code || product.internal_code || '',
    image_url: product.image || product.image_url || '',
    availability_status: product.availabilityStatus || AVAILABLE
  };
}

export function createProduct(payload) {
  const products = getProducts();
  const product = normalizeProduct({ id: slugId('prod'), active: true, ...payload });
  products.unshift(product);
  saveProducts(products);
  storage.pushLog('product_created', { productId: product.id, name: product.name });
  remoteMutate('products', 'POST', productPayloadForRemote(product));
  return product;
}

export function updateProduct(id, patch) {
  const products = getProducts().map(p => p.id === id ? normalizeProduct({ ...p, ...patch }) : p);
  saveProducts(products);
  const current = products.find(p => p.id === id);
  storage.pushLog('product_updated', { productId: id, patch: normalizeProduct(patch) });
  if (current) remoteMutate('products', 'PUT', productPayloadForRemote(current), id);
}

export function deleteProduct(id) {
  const products = getProducts().filter(p => p.id !== id);
  saveProducts(products);
  storage.pushLog('product_deleted', { productId: id });
  remoteMutate('products', 'DELETE', {}, id);
}

export function duplicateProduct(id) {
  const source = getProducts().find(p => p.id === id);
  if (!source) return null;
  return createProduct({ ...source, id: undefined, code: `${source.code || source.internal_code || 'COD'}-COPY`, name: `${source.name} (Cópia)` });
}

export function filterProducts({ search='', brand='', category='', model='', status='', includeInactive=false } = {}) {
  const term = String(search || '').toLowerCase();
  return getProducts().filter(p => {
    const okActive = includeInactive || p.active !== false;
    const okSearch = !term || [p.name,p.brand,p.category,p.model,p.code,p.internal_code].join(' ').toLowerCase().includes(term);
    const okBrand = !brand || p.brand === brand;
    const okCategory = !category || p.category === category;
    const okModel = !model || String(p.model || '').toLowerCase().includes(String(model || '').toLowerCase());
    const okStatus = !status || p.availabilityStatus === status;
    return okActive && okSearch && okBrand && okCategory && okModel && okStatus;
  });
}

export function getProductAutocomplete(term='') {
  const lower = String(term || '').toLowerCase();
  if (!lower) return [];
  return filterProducts({ includeInactive: false })
    .filter(p => String(p.name || '').toLowerCase().includes(lower) || String(p.model || '').toLowerCase().includes(lower) || String(p.code || p.internal_code || '').toLowerCase().includes(lower))
    .slice(0, 6)
    .map(p => p.name);
}
