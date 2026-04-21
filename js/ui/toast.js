let stack;
export function showToast(message) {
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const el = document.getElementById('toast-template').content.firstElementChild.cloneNode(true);
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => { el.remove(); }, 3200);
}
