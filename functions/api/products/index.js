import { error, ok } from '../../../lib/response.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const search = (url.searchParams.get('search') || '').toLowerCase();
    const brand = url.searchParams.get('brand') || '';
    const category = url.searchParams.get('category') || '';
    const model = url.searchParams.get('model') || '';
    const status = url.searchParams.get('status') || '';

    let sql = 'SELECT * FROM products WHERE 1=1';
    const bindings = [];

    if (search) {
      sql += ' AND LOWER(name || " " || brand || " " || category || " " || model || " " || COALESCE(internal_code, "")) LIKE ?';
      bindings.push(`%${search}%`);
    }
    if (brand) { sql += ' AND brand = ?'; bindings.push(brand); }
    if (category) { sql += ' AND category = ?'; bindings.push(category); }
    if (model) { sql += ' AND LOWER(model) LIKE ?'; bindings.push(`%${model.toLowerCase()}%`); }
    if (status) { sql += ' AND availability_status = ?'; bindings.push(status); }

    sql += ' ORDER BY created_at DESC';
    const { results } = await context.env.DB.prepare(sql).bind(...bindings).all();
    return ok({ products: results || [] });
  } catch (err) {
    return error('Falha ao listar produtos.', 500, String(err?.message || err));
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    if (!body.name || !body.brand || !body.category || !body.model) return error('Preencha nome, marca, categoria e modelo.', 422);
    const id = crypto.randomUUID();
    await context.env.DB.prepare(`
      INSERT INTO products (
        id, brand, category, model, name, price, internal_code, image_url, availability_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.brand,
      body.category,
      body.model,
      body.name,
      Number(body.price || 0),
      body.internal_code || null,
      body.image_url || null,
      body.availability_status || 'available'
    ).run();
    return ok({ id });
  } catch (err) {
    return error('Falha ao criar produto.', 500, String(err?.message || err));
  }
}
