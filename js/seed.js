import { mockProducts, mockUsers, mockAdmins, mockOrders, mockReturns } from './data/mock-data.js';
import { storage } from './storage.js';
import { normalizeProduct } from './modules/products.js';

export function seedData() {
  if (storage.get(storage.keys.initialized)) {
    storage.set(storage.keys.products, storage.get(storage.keys.products, []).map(normalizeProduct));
    if (!storage.get(storage.keys.users)) storage.set(storage.keys.users, []);
    if (!storage.get(storage.keys.admins)) storage.set(storage.keys.admins, []);
    if (!storage.get(storage.keys.orders)) storage.set(storage.keys.orders, []);
    if (!storage.get(storage.keys.returns)) storage.set(storage.keys.returns, []);
    if (!storage.get(storage.keys.logs)) storage.set(storage.keys.logs, []);
    if (!storage.get(storage.keys.ui)) storage.set(storage.keys.ui, {});
    return;
  }

  storage.set(storage.keys.products, mockProducts.map(normalizeProduct));
  storage.set(storage.keys.users, mockUsers);
  storage.set(storage.keys.admins, mockAdmins);
  storage.set(storage.keys.orders, mockOrders);
  storage.set(storage.keys.returns, mockReturns);
  storage.set(storage.keys.logs, []);
  storage.set(storage.keys.ui, {});
  storage.set(storage.keys.initialized, true);
}
