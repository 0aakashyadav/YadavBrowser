(() => {
  function installAaryaButton() {
    if (document.getElementById('aarya-launcher')) return;
    const button = document.createElement('button');
    button.id = 'aarya-launcher';
    button.type = 'button';
    button.textContent = 'AARYA';
    button.title = 'Open AARYA';
    Object.assign(button.style, {
      position: 'fixed', right: '18px', top: '12px', zIndex: '999998',
      border: '1px solid #4b5563', borderRadius: '12px', padding: '8px 14px',
      background: '#111827', color: '#fff', cursor: 'pointer', fontWeight: '600'
    });
    button.addEventListener('click', () => window.aaryaUI?.toggle());
    document.body.appendChild(button);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installAaryaButton, { once: true });
  else installAaryaButton();
})();
