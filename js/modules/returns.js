import { storage } from '../storage.js';
import { slugId } from '../utils.js';
import { remoteMutate } from '../api.js';

export function getReturns() { return storage.get(storage.keys.returns, []); }
export function createReturn(payload) {
  const returns = getReturns();
  const record = { id: slugId('ret'), status: 'registrada', createdAt:new Date().toISOString(), ...payload };
  returns.unshift(record);
  storage.set(storage.keys.returns, returns);
  storage.pushLog('return_created', { returnId: record.id, customerName: payload.customerName });
  remoteMutate('returns', 'POST', { order_id: record.orderId, user_id: record.userId, customer_name: record.customerName, product_name: record.productName, reason: record.reason, notes: record.notes, photos: record.photos || [], status: record.status });
  return record;
}

export function updateReturn(id, patch) {
  const returns = getReturns().map(item => item.id === id ? { ...item, ...patch } : item);
  storage.set(storage.keys.returns, returns);
  storage.pushLog('return_updated', { returnId: id, patch });
  const current = getReturns().find(item => item.id === id) || {};
  remoteMutate('returns', 'PUT', { ...current, ...patch, order_id: current.orderId, user_id: current.userId, customer_name: current.customerName, product_name: current.productName, photos: current.photos || [] }, id);
}
