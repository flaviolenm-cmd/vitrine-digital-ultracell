import { error, ok } from '../../../lib/response.js';

export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(`
      SELECT * FROM orders WHERE delivery_type = 'delivery' ORDER BY created_at DESC
    `).all();
    return ok({ deliveries: results || [] });
  } catch (err) {
    return error('Falha ao listar entregas.', 500, String(err?.message || err));
  }
}
