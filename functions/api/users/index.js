import { error, ok } from '../../../lib/response.js';
import { sha256, sanitizeUser } from '../../../lib/auth.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const search = (url.searchParams.get('search') || '').toLowerCase();
    let sql = 'SELECT * FROM users WHERE 1=1';
    const bindings = [];
    if (search) {
      sql += ' AND LOWER(full_name || " " || COALESCE(store_name, "") || " " || COALESCE(cpf, "") || " " || COALESCE(contact, "")) LIKE ?';
      bindings.push(`%${search}%`);
    }
    sql += ' ORDER BY created_at DESC';
    const { results } = await context.env.DB.prepare(sql).bind(...bindings).all();
    return ok({ users: (results || []).map(sanitizeUser) });
  } catch (err) {
    return error('Falha ao listar usuários.', 500, String(err?.message || err));
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    if (!body.full_name || !body.login || !body.password) return error('Nome, login e senha são obrigatórios.', 422);
    const id = crypto.randomUUID();
    const passwordHash = await sha256(body.password);
    await context.env.DB.prepare(`
      INSERT INTO users (
        id, role, cpf, system_number, full_name, store_name, address, contact,
        login, password_hash, active, credit_enabled, credit_limit, credit_used, photo_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.role || 'user',
      body.cpf || null,
      body.system_number || null,
      body.full_name,
      body.store_name || null,
      body.address || null,
      body.contact || null,
      body.login,
      passwordHash,
      Number(body.active ?? 1),
      Number(body.credit_enabled ?? 0),
      Number(body.credit_limit || 0),
      Number(body.credit_used || 0),
      body.photo_url || null
    ).run();
    const created = await context.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    return ok({ user: sanitizeUser(created) });
  } catch (err) {
    return error('Falha ao criar usuário.', 500, String(err?.message || err));
  }
}
