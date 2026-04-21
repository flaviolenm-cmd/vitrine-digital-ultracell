import { error, ok } from '../../../lib/response.js';
import { sha256 } from '../../../lib/auth.js';

export async function onRequestPut(context) {
  try {
    const id = context.params.id;
    const body = await context.request.json();
    const current = await context.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    if (!current) return error('Usuário não encontrado.', 404);
    const passwordHash = body.password ? await sha256(body.password) : current.password_hash;
    await context.env.DB.prepare(`UPDATE users SET role=?, cpf=?, system_number=?, full_name=?, store_name=?, address=?, contact=?, login=?, password_hash=?, active=?, credit_enabled=?, credit_limit=?, credit_used=?, photo_url=? WHERE id=?`)
      .bind(body.role || current.role, body.cpf || current.cpf, body.system_number || body.systemNumber || current.system_number, body.full_name || body.fullName || current.full_name, body.store_name || body.storeName || current.store_name, body.address || current.address, body.contact || current.contact, body.login || current.login, passwordHash, Number(body.active ?? current.active ?? 1), Number(body.credit_enabled ?? body.creditEnabled ?? current.credit_enabled ?? 0), Number(body.credit_limit ?? body.creditLimit ?? current.credit_limit ?? 0), Number(body.credit_used ?? body.creditUsed ?? current.credit_used ?? 0), body.photo_url || body.photo || current.photo_url, id)
      .run();
    return ok({ id });
  } catch (err) { return error('Falha ao atualizar usuário.', 500, String(err?.message || err)); }
}
