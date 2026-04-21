import { storage } from './storage.js';
import { setSession } from './auth/session.js';

const state = { remoteEnabled: false, remoteChecked: false, syncPromise: null };

function dispatchUpdate() {
  window.dispatchEvent(new CustomEvent('udp:data-updated'));
}

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}

function mapProduct(product = {}) {
  return {
    id: product.id,
    brand: product.brand || '',
    category: product.category || '',
    model: product.model || '',
    name: product.name || '',
    price: Number(product.price || 0),
    code: product.internal_code || product.code || '',
    image: product.image_url || product.image || '',
    active: true,
    availabilityStatus: product.availability_status || product.availabilityStatus || 'available',
    inStock: (product.availability_status || product.availabilityStatus || 'available') === 'available'
  };
}

function mapUser(user = {}) {
  const role = user.role || user.type || 'user';
  return {
    id: user.id,
    type: role,
    role,
    cpf: user.cpf || '',
    systemNumber: user.system_number || user.systemNumber || '',
    fullName: user.full_name || user.fullName || '',
    storeName: user.store_name || user.storeName || '',
    address: user.address || '',
    contact: user.contact || '',
    active: Boolean(Number(user.active ?? 1)),
    creditEnabled: Boolean(Number(user.credit_enabled ?? user.creditEnabled ?? 0)),
    creditLimit: Number(user.credit_limit ?? user.creditLimit ?? 0),
    creditUsed: Number(user.credit_used ?? user.creditUsed ?? 0),
    login: user.login || user.cpf || '',
    photo: user.photo_url || user.photo || '',
  };
}

function mapOrder(order = {}) {
  const items = (order.items || []).map(item => ({
    id: item.id,
    productId: item.product_id || item.productId,
    product_id: item.product_id || item.productId,
    name: item.name,
    quantity: Number(item.quantity || 0),
    unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
    unit_price: Number(item.unit_price ?? item.unitPrice ?? 0),
    subtotal: Number(item.subtotal || 0)
  }));
  return {
    id: order.id,
    userId: order.user_id || order.userId,
    user_id: order.user_id || order.userId,
    customerName: order.customer_name || order.customerName || '',
    storeName: order.store_name || order.storeName || '',
    address: order.address || '',
    items,
    total: Number(order.total || 0),
    deliveryType: order.delivery_type || order.deliveryType || 'retirada',
    paymentMethod: order.payment_method || order.paymentMethod || 'pix',
    paymentStatus: order.payment_status || order.paymentStatus || 'pending',
    paid: ['paid','pago'].includes(String(order.payment_status || '').toLowerCase()) || Boolean(order.paid),
    needChange: Boolean(Number(order.need_change ?? order.needChange ?? 0)),
    changeFor: Number(order.change_for ?? order.changeFor ?? 0),
    creditUsed: Number(order.credit_used ?? order.creditUsed ?? 0),
    notes: order.notes || '',
    status: order.order_status || order.status || 'aguardando_confirmacao',
    createdAt: order.created_at || order.createdAt || new Date().toISOString(),
  };
}

function mapReturn(record = {}) {
  let photos = record.photos || [];
  if (!photos.length && record.photos_json) {
    try { photos = JSON.parse(record.photos_json); } catch { photos = []; }
  }
  return {
    id: record.id,
    orderId: record.order_id || record.orderId || null,
    userId: record.user_id || record.userId || null,
    customerName: record.customer_name || record.customerName || '',
    productName: record.product_name || record.productName || '',
    reason: record.reason || '',
    notes: record.notes || '',
    photos,
    status: record.status || 'registrada',
    createdAt: record.created_at || record.createdAt || new Date().toISOString(),
  };
}

function persistSnapshot(snapshot) {
  if (snapshot.products) storage.set(storage.keys.products, snapshot.products.map(mapProduct));
  if (snapshot.users) {
    const users = snapshot.users.map(mapUser);
    storage.set(storage.keys.users, users.filter(u => u.role !== 'admin'));
    storage.set(storage.keys.admins, users.filter(u => u.role === 'admin').map(u => ({ id: u.id, type: 'admin', name: u.fullName, login: u.login, active: u.active })));
  }
  if (snapshot.orders) storage.set(storage.keys.orders, snapshot.orders.map(mapOrder));
  if (snapshot.returns) storage.set(storage.keys.returns, snapshot.returns.map(mapReturn));
}

export async function detectRemoteEnabled() {
  if (state.remoteChecked) return state.remoteEnabled;
  state.remoteChecked = true;
  try {
    const data = await request('/api/health');
    state.remoteEnabled = data?.database === 'connected';
  } catch {
    state.remoteEnabled = false;
  }
  return state.remoteEnabled;
}

export function isRemoteEnabled() {
  return state.remoteEnabled;
}

export async function syncRemoteSnapshot() {
  if (state.syncPromise) return state.syncPromise;
  state.syncPromise = (async () => {
    const enabled = await detectRemoteEnabled();
    if (!enabled) return false;
    const [productsRes, usersRes, ordersRes, returnsRes] = await Promise.all([
      request('/api/products').catch(() => ({ products: [] })),
      request('/api/users').catch(() => ({ users: [] })),
      request('/api/orders').catch(() => ({ orders: [] })),
      request('/api/returns').catch(() => ({ returns: [] })),
    ]);
    persistSnapshot({
      products: productsRes.products,
      users: usersRes.users,
      orders: ordersRes.orders,
      returns: returnsRes.returns,
    });
    dispatchUpdate();
    return true;
  })().finally(() => { state.syncPromise = null; });
  return state.syncPromise;
}

export async function remoteLogin(login, password) {
  const enabled = await detectRemoteEnabled();
  if (!enabled) return { ok: false };
  try {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password })
    });
    const session = {
      id: data.session.id,
      type: data.session.role || data.session.type || 'user',
      name: data.session.full_name || data.session.fullName,
      storeName: data.session.store_name || data.session.storeName,
      login: data.session.login,
    };
    setSession(session);
    await syncRemoteSnapshot();
    return { ok: true, session };
  } catch (err) {
    return { ok: false, message: err.message || 'Falha no login online.' };
  }
}

export async function remoteMutate(entity, method, payload = {}, id = '') {
  const enabled = await detectRemoteEnabled();
  if (!enabled) return false;
  const path = id ? `/api/${entity}/${id}` : `/api/${entity}`;
  try {
    await request(path, { method, body: JSON.stringify(payload) });
    await syncRemoteSnapshot();
    return true;
  } catch (err) {
    console.error(`Falha ao sincronizar ${entity}`, err);
    return false;
  }
}

export async function remoteFetchDashboard() {
  const enabled = await detectRemoteEnabled();
  if (!enabled) return null;
  try {
    return await request('/api/dashboard');
  } catch {
    return null;
  }
}


export async function remoteResetSystem(payload = {}) {
  const enabled = await detectRemoteEnabled();
  if (!enabled) return false;
  try {
    await request('/api/admin/reset', { method: 'POST', body: JSON.stringify(payload) });
    await syncRemoteSnapshot();
    return true;
  } catch (err) {
    console.error('Falha ao resetar base remota', err);
    return false;
  }
}
