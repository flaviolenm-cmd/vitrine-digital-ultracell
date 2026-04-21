import { json } from '../lib/response.js';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return json({ ok: true });
  }
  return context.next();
}
