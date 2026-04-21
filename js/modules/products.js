import { storage } from '../storage.js';
import { slugId } from '../utils.js';

function normalizeAvailability(payload = {}) {
  const status = payload.availabilityStatus
    || (payload.inStock === false || Number(payload.stockQty || 0) <= 0 ? 'out_of_stock' : 'available');
  return {
    ...payload,
    availabilityStatus: status,
    inStock: status === 'available'
  };
}

export function normalizeProduct(product = {}) {
  const normalized = normalizeAvailability(product);
  delete normalized.stockQty;
  return normalized;
}

export function getProducts() {
  return storage.get(storage.keys.products, []).map(normalizeProduct);
}
export function saveProducts(products) {
  storage.set(storage.keys.products, products.map(normalizeProduct));
}
export function createProduct(payload) {
  const products = getProducts();
  const product = normalizeProduct({ id: slugId('prod'), active: true, ...payload });
  products.unshift(product);
  saveProducts(products);
  storage.pushLog('product_created', { productId: product.id, name: product.name });
  return product;
}
export function updateProduct(id, patch) {
  const products = getProducts().map(p => p.id === id ? normalizeProduct({ ...p, ...patch }) : p);
  saveProducts(products);
  storage.pushLog('product_updated', { productId: id, patch: normalizeProduct(patch) });
}
export function deleteProduct(id) {
  const products = getProducts().filter(p => p.id !== id);
  saveProducts(products);
  storage.pushLog('product_deleted', { productId: id });
}
export function duplicateProduct(id) {
  const source = getProducts().find(p => p.id === id);
  if (!source) return null;
  return createProduct({ ...source, id: undefined, code: `${source.code}-COPY`, name: `${source.name} (Cópia)` });
}
export function filterProducts({ search='', brand='', category='', model='', status='' } = {}) {
  const term = search.toLowerCase();
  return getProducts().filter(p => {
    const okSearch = !term || [p.name,p.brand,p.category,p.model,p.code].join(' ').toLowerCase().includes(term);
    const okBrand = !brand || p.brand === brand;
    const okCategory = !category || p.category === category;
    const okModel = !model || p.model.toLowerCase().includes(model.toLowerCase());
    const okStatus = !status || p.availabilityStatus === status;
    return okSearch && okBrand && okCategory && okModel && okStatus;
  });
}
export function getProductAutocomplete(term='') {
  const lower = term.toLowerCase();
  if (!lower) return [];
  return getProducts()
    .filter(p => p.name.toLowerCase().includes(lower) || p.model.toLowerCase().includes(lower) || p.code.toLowerCase().includes(lower))
    .slice(0, 6)
    .map(p => p.name);
}
