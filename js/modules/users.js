import { storage } from '../storage.js';
import { onlyDigits, slugId } from '../utils.js';
import { remoteMutate } from '../api.js';

export function getUsers() { return storage.get(storage.keys.users, []); }
export function saveUsers(users) { storage.set(storage.keys.users, users); }
export function createUser(payload) {
  const users = getUsers();
  const contactDigits = onlyDigits(payload.contact);
  const user = {
    id: slugId('user'),
    type: payload.role || payload.type || 'user',
    active: true,
    creditUsed: 0,
    login: onlyDigits(payload.cpf),
    password: contactDigits.slice(-4),
    role: payload.role || payload.type || 'user',
    ...payload
  };
  users.unshift(user);
  saveUsers(users);
  storage.pushLog('user_created', { userId: user.id, name: user.fullName });
  remoteMutate('users', 'POST', {
    role: user.role, cpf: user.cpf, system_number: user.systemNumber, full_name: user.fullName, store_name: user.storeName,
    address: user.address, contact: user.contact, login: user.login, password: user.password, active: Number(user.active),
    credit_enabled: Number(user.creditEnabled), credit_limit: Number(user.creditLimit || 0), credit_used: Number(user.creditUsed || 0),
    photo_url: user.photo || ''
  });
  return user;
}
export function updateUser(id, patch) {
  const users = getUsers().map(u => u.id === id ? { ...u, ...patch } : u);
  saveUsers(users);
  storage.pushLog('user_updated', { userId: id, patch });
  const current = getUsers().find(u => u.id === id) || {};
  remoteMutate('users', 'PUT', { ...current, ...patch, full_name: (patch.fullName || current.fullName), store_name: (patch.storeName || current.storeName), system_number: (patch.systemNumber || current.systemNumber), credit_enabled: Number((patch.creditEnabled ?? current.creditEnabled) || 0), credit_limit: Number(patch.creditLimit ?? current.creditLimit ?? 0), credit_used: Number(patch.creditUsed ?? current.creditUsed ?? 0), photo_url: patch.photo || current.photo || '' }, id);
}
export function filterUsers(search='') {
  const term = search.toLowerCase();
  return getUsers().filter(u => !term || [u.fullName, u.storeName, u.cpf, u.contact, u.systemNumber].join(' ').toLowerCase().includes(term));
}
export function getUserById(id) { return getUsers().find(u => u.id === id); }
