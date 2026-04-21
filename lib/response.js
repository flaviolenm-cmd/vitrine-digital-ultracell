export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
  headers.set('access-control-allow-headers', 'Content-Type');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error(message, status = 400, details = null) {
  return json({ ok: false, message, details }, { status });
}

export function ok(data = {}) {
  return json({ ok: true, ...data });
}
