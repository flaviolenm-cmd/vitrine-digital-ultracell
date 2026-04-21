import { error, ok } from '../../../lib/response.js';

export async function onRequestPut(context) {
  try {
    const id = context.params.id;
    const body = await context.request.json();
    await context.env.DB.prepare(`UPDATE orders SET payment_status=?, order_status=?, notes=? WHERE id=?`)
      .bind(body.payment_status || (body.paid ? 'paid' : 'pending'), body.order_status || body.status || 'aguardando_confirmacao', body.notes || null, id)
      .run();
    return ok({ id });
  } catch (err) { return error('Falha ao atualizar pedido.', 500, String(err?.message || err)); }
}
