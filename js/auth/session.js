import { storage } from '../storage.js';
export function getSession() { return storage.get(storage.keys.session, null); }
export function setSession(session) { storage.set(storage.keys.session, session); }
export function clearSession() { storage.remove(storage.keys.session); }
