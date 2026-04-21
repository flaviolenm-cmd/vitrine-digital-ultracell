import { error, ok } from '../../../lib/response.js';
import { sha256, sanitizeUser } from '../../../lib/auth.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const login = String(body.login || '').trim();
    const password = String(body.password || '');
    if (!login || !password) return error('Login e senha são obrigatórios.', 422);

    const user = await context.env.DB
      .prepare('SELECT * FROM users WHERE login = ? LIMIT 1')
      .bind(login)
      .first();

    if (!user) return error('Usuário não encontrado.', 404);
    if (!Number(user.active)) return error('Usuário inativo.', 403);

    const passwordHash = await sha256(password);
    if (user.password_hash !== passwordHash) return error('Senha inválida.', 401);

    return ok({ session: sanitizeUser(user) });
  } catch (err) {
    return error('Falha ao realizar login.', 500, String(err?.message || err));
  }
}
