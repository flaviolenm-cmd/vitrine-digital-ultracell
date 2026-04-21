import { ok } from '../../lib/response.js';

export async function onRequestGet(context) {
  const ping = await context.env.DB.prepare('SELECT 1 AS ok').first();
  return ok({ service: 'ultracell-api', database: ping?.ok === 1 ? 'connected' : 'unknown' });
}
