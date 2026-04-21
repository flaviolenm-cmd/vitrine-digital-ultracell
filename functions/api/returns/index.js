import { error, ok } from '../../../lib/response.js';

export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare('SELECT * FROM returns ORDER BY created_at DESC').all();
    return ok({ returns: results || [] });
  } catch (err) {
    return error('Falha ao listar devoluções.', 500, String(err?.message || err));
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    if (!body.customer_name || !body.product_name) return error('Cliente e produto são obrigatórios.', 422);
    const id = crypto.randomUUID();
    await context.env.DB.prepare(`
      INSERT INTO returns (
        id, order_id, user_id, customer_name, product_name, reason, notes, photos_json, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.order_id || null,
      body.user_id || null,
      body.customer_name,
      body.product_name,
      body.reason || null,
      body.notes || null,
      JSON.stringify(body.photos || []),
      body.status || 'registrada'
    ).run();
    return ok({ id });
  } catch (err) {
    return error('Falha ao registrar devolução.', 500, String(err?.message || err));
  }
}
