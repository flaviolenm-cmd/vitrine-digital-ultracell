import { storage } from '../storage.js';
import { slugId } from '../utils.js';

export function getReturns() { return storage.get(storage.keys.returns, []); }
export function createReturn(payload) {
  const returns = getReturns();
  const record = { id: slugId('ret'), status: 'registrada', createdAt:new Date().toISOString(), ...payload };
  returns.unshift(record);
  storage.set(storage.keys.returns, returns);
  storage.pushLog('return_created', { returnId: record.id, customerName: payload.customerName });
  return record;
}

export function updateReturn(id, patch) {
  const returns = getReturns().map(item => item.id === id ? { ...item, ...patch } : item);
  storage.set(storage.keys.returns, returns);
  storage.pushLog('return_updated', { returnId: id, patch });
}
