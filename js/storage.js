import { makeId } from './utils.js';

const KEYS = {
  products: 'udp_products',
  users: 'udp_users',
  admins: 'udp_admins',
  orders: 'udp_orders',
  returns: 'udp_returns',
  session: 'udp_session',
  cartPrefix: 'udp_cart_',
  logs: 'udp_logs'
};

export const storage = {
  keys: KEYS,
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem(key);
  },
  pushLog(action, details = {}) {
    const logs = this.get(KEYS.logs, []);
    logs.unshift({ id: makeId('log'), action, details, createdAt: new Date().toISOString() });
    this.set(KEYS.logs, logs.slice(0, 200));
  },
  exportBackup() {
    return {
      products: this.get(KEYS.products, []),
      users: this.get(KEYS.users, []),
      admins: this.get(KEYS.admins, []),
      orders: this.get(KEYS.orders, []),
      returns: this.get(KEYS.returns, []),
      logs: this.get(KEYS.logs, []),
      exportedAt: new Date().toISOString()
    };
  },
  restoreBackup(data) {
    if (!data) return false;
    ['products','users','admins','orders','returns','logs'].forEach((k) => {
      if (data[k]) this.set(KEYS[k], data[k]);
    });
    return true;
  }
};
