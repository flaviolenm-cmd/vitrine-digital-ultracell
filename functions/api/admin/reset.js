import { error, ok } from '../../../lib/response.js';
import { sha256 } from '../../../lib/auth.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    await context.env.DB.prepare('DELETE FROM order_items').run();
    await context.env.DB.prepare('DELETE FROM orders').run();
    await context.env.DB.prepare('DELETE FROM returns').run();
    await context.env.DB.prepare('DELETE FROM products').run();
    await context.env.DB.prepare('DELETE FROM users').run();

    if (body?.preserve_admin && body?.admin?.login && body?.admin?.password) {
      const admin = body.admin;
      const passwordHash = await sha256(admin.password);
      await context.env.DB.prepare(`
        INSERT INTO users (
          id, role, cpf, system_number, full_name, store_name, address, contact,
          login, password_hash, active, credit_enabled, credit_limit, credit_used, photo_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        'admin',
        admin.cpf || null,
        admin.system_number || null,
        admin.full_name || admin.name || 'Administrador',
        admin.store_name || null,
        admin.address || null,
        admin.contact || null,
        admin.login,
        passwordHash,
        1,
        0,
        0,
        0,
        admin.photo_url || null
      ).run();
    }

    return ok({ ok: true, reset: true });
  } catch (err) {
    return error('Falha ao resetar os dados.', 500, String(err?.message || err));
  }
}
