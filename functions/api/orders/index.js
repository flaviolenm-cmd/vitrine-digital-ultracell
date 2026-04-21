import { error, ok } from '../../../lib/response.js';

async function ensureProductsAvailable(DB, items) {
  for (const item of items || []) {
    const product = await DB.prepare('SELECT id, name, availability_status FROM products WHERE id = ? LIMIT 1').bind(item.product_id).first();
    if (!product || product.availability_status !== 'available') {
      throw new Error(`Produto indisponível: ${item.name || item.product_id}`);
    }
  }
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const userId = url.searchParams.get('user_id');
    let sql = 'SELECT * FROM orders';
    const binds = [];
    if (userId) {
      sql += ' WHERE user_id = ?';
      binds.push(userId);
    }
    sql += ' ORDER BY created_at DESC';
    const { results } = await context.env.DB.prepare(sql).bind(...binds).all();
    const orders = [];
    for (const order of results || []) {
      const items = await context.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(order.id).all();
      orders.push({ ...order, items: items.results || [] });
    }
    return ok({ orders });
  } catch (err) {
    return error('Falha ao listar pedidos.', 500, String(err?.message || err));
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const items = body.items || [];
    if (!body.user_id || !items.length) return error('Pedido inválido.', 422);
    await ensureProductsAvailable(context.env.DB, items);

    const orderId = crypto.randomUUID();
    await context.env.DB.prepare(`
      INSERT INTO orders (
        id, user_id, customer_name, store_name, delivery_type, payment_method, payment_status,
        order_status, total, need_change, change_for, credit_used, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId,
      body.user_id,
      body.customer_name || null,
      body.store_name || null,
      body.delivery_type || 'pickup',
      body.payment_method || 'pix',
      body.payment_status || 'pending',
      body.order_status || 'aguardando_confirmacao',
      Number(body.total || 0),
      Number(body.need_change || 0),
      Number(body.change_for || 0),
      Number(body.credit_used || 0),
      body.notes || null
    ).run();

    for (const item of items) {
      await context.env.DB.prepare(`
        INSERT INTO order_items (id, order_id, product_id, name, quantity, unit_price, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        orderId,
        item.product_id,
        item.name,
        Number(item.quantity || 1),
        Number(item.unit_price || 0),
        Number(item.subtotal || 0)
      ).run();
    }

    if (Number(body.credit_used || 0) > 0) {
      await context.env.DB.prepare(`
        UPDATE users SET credit_used = COALESCE(credit_used, 0) + ? WHERE id = ?
      `).bind(Number(body.credit_used || 0), body.user_id).run();
    }

    return ok({ id: orderId });
  } catch (err) {
    return error('Falha ao criar pedido.', 500, String(err?.message || err));
  }
}
