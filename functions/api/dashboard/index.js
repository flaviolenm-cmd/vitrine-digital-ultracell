import { error, ok } from '../../../lib/response.js';

export async function onRequestGet(context) {
  try {
    const [products, users, orders] = await Promise.all([
      context.env.DB.prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN availability_status = "available" THEN 1 ELSE 0 END) AS available, SUM(CASE WHEN availability_status = "out_of_stock" THEN 1 ELSE 0 END) AS out_of_stock FROM products').first(),
      context.env.DB.prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active_users, SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) AS inactive_users FROM users WHERE role = "user"').first(),
      context.env.DB.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(total),0) AS revenue FROM orders').first()
    ]);

    const topCustomers = await context.env.DB.prepare(`
      SELECT customer_name, COUNT(*) AS order_count, COALESCE(SUM(total),0) AS total_spent
      FROM orders
      GROUP BY customer_name
      ORDER BY order_count DESC, total_spent DESC
      LIMIT 5
    `).all();

    return ok({
      products,
      users,
      orders,
      topCustomers: topCustomers.results || []
    });
  } catch (err) {
    return error('Falha ao carregar dashboard.', 500, String(err?.message || err));
  }
}
