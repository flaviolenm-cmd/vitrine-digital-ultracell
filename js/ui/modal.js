export function openModal(title, contentHtml) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="btn btn-secondary btn-small" data-close-modal>Fechar</button>
      </div>
      <div class="modal-content">${contentHtml}</div>
    </div>`;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close-modal]')) backdrop.remove();
  });
  document.body.appendChild(backdrop);
  return backdrop;
}
