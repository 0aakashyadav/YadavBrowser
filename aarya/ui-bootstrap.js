(() => {
  function installAaryaButton() {
    if (document.getElementById('aarya-launcher')) return;

    const button = document.createElement('button');
    button.id = 'aarya-launcher';
    button.type = 'button';
    button.textContent = 'AARYA';
    button.title = 'Open AARYA';
    Object.assign(button.style, {
      position: 'fixed', right: '18px', top: '12px', zIndex: '2147483647',
      border: '1px solid #4b5563', borderRadius: '12px', padding: '8px 14px',
      background: '#111827', color: '#fff', cursor: 'pointer', fontWeight: '600',
      pointerEvents: 'auto'
    });

    button.addEventListener('click', () => {
      if (typeof window.aaryaUI?.toggle === 'function') {
        window.aaryaUI.toggle();
        return;
      }

      // ui.js may still be initializing; retry briefly instead of silently doing nothing.
      let attempts = 0;
      const retry = setInterval(() => {
        attempts += 1;
        if (typeof window.aaryaUI?.toggle === 'function') {
          clearInterval(retry);
          window.aaryaUI.toggle();
        } else if (attempts >= 20) {
          clearInterval(retry);
          console.error('AARYA UI is not initialized.');
        }
      }, 50);
    });

    document.body.appendChild(button);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAaryaButton, { once: true });
  } else {
    installAaryaButton();
  }
})();
