import { storage } from '../storage.js';
import { onlyDigits, slugId } from '../utils.js';

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
  return user;
}
export function updateUser(id, patch) {
  const users = getUsers().map(u => u.id === id ? { ...u, ...patch } : u);
  saveUsers(users);
  storage.pushLog('user_updated', { userId: id, patch });
}
export function filterUsers(search='') {
  const term = search.toLowerCase();
  return getUsers().filter(u => !term || [u.fullName, u.storeName, u.cpf, u.contact, u.systemNumber].join(' ').toLowerCase().includes(term));
}
export function getUserById(id) { return getUsers().find(u => u.id === id); }
