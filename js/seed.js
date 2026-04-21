import { mockProducts, mockUsers, mockAdmins, mockOrders, mockReturns } from './data/mock-data.js';
import { storage } from './storage.js';
import { normalizeProduct } from './modules/products.js';

export function seedData() {
  if (!storage.get(storage.keys.products)) storage.set(storage.keys.products, mockProducts.map(normalizeProduct));
  else storage.set(storage.keys.products, storage.get(storage.keys.products, []).map(normalizeProduct));
  if (!storage.get(storage.keys.users)) storage.set(storage.keys.users, mockUsers);
  if (!storage.get(storage.keys.admins)) storage.set(storage.keys.admins, mockAdmins);
  if (!storage.get(storage.keys.orders)) storage.set(storage.keys.orders, mockOrders);
  if (!storage.get(storage.keys.returns)) storage.set(storage.keys.returns, mockReturns);
  if (!storage.get(storage.keys.logs)) storage.set(storage.keys.logs, []);
}
