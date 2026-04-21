import { error, ok } from '../../../lib/response.js';

export async function onRequestPut(context) {
  try {
    const id = context.params.id;
    const body = await context.request.json();
    await context.env.DB.prepare(`UPDATE products SET brand = ?, category = ?, model = ?, name = ?, price = ?, internal_code = ?, image_url = ?, availability_status = ? WHERE id = ?`)
      .bind(body.brand, body.category, body.model, body.name, Number(body.price || 0), body.internal_code || body.code || null, body.image_url || body.image || null, body.availability_status || body.availabilityStatus || 'available', id)
      .run();
    return ok({ id });
  } catch (err) { return error('Falha ao atualizar produto.', 500, String(err?.message || err)); }
}
export async function onRequestDelete(context) {
  try {
    const id = context.params.id;
    await context.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
    return ok({ id });
  } catch (err) { return error('Falha ao excluir produto.', 500, String(err?.message || err)); }
}
