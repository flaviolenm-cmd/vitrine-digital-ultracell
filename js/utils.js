export const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function money(value) { return BRL.format(Number(value || 0)); }
export function onlyDigits(value = '') { return String(value).replace(/\D/g, ''); }
export function maskCPF(value='') {
  const v = onlyDigits(value).slice(0,11);
  return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
export function maskPhone(value='') {
  const v = onlyDigits(value).slice(0,11);
  return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}
export function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR');
}
export function makeId(prefix='id') {
  const hasRandomUUID = typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function';
  if (hasRandomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
export function slugId(prefix='id') {
  return makeId(prefix);
}
export function debounce(fn, wait=250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
export function escapeHtml(str='') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
export function downloadFile(filename, content, mime='application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export async function copyText(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'readonly');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return Boolean(ok);
  } catch {
    return false;
  }
}
