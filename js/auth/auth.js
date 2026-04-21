import { storage } from '../storage.js';
import { setSession } from './session.js';

export function login(loginValue, password) {
  const admins = storage.get(storage.keys.admins, []);
  const users = storage.get(storage.keys.users, []);

  const admin = admins.find(a => a.login === loginValue && a.password === password && a.active);
  if (admin) {
    const session = { id: admin.id, type: 'admin', name: admin.name, login: admin.login };
    setSession(session);
    return { ok: true, session };
  }

  const user = users.find(u => u.login === loginValue && u.password === password);
  if (!user) return { ok: false, message: 'Login ou senha inválidos.' };
  if (!user.active) return { ok: false, message: 'Cliente inativo. Acesso bloqueado.' };

  const role = user.role || user.type || 'user';
  const session = { id: user.id, type: role, name: user.fullName, storeName: user.storeName, login: user.login };
  setSession(session);
  return { ok: true, session };
}
