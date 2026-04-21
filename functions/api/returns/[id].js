import { error, ok } from '../../../lib/response.js';

export async function onRequestPut(context) {
  try {
    const id = context.params.id;
    const body = await context.request.json();
    await context.env.DB.prepare(`UPDATE returns SET status=?, reason=?, notes=?, photos_json=? WHERE id=?`)
      .bind(body.status || 'registrada', body.reason || null, body.notes || null, JSON.stringify(body.photos || []), id)
      .run();
    return ok({ id });
  } catch (err) { return error('Falha ao atualizar devolução.', 500, String(err?.message || err)); }
}
