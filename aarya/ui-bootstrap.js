(() => {
  function showFallbackPanel() {
    let panel = document.getElementById('aarya-fallback-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
      return;
    }

    panel = document.createElement('section');
    panel.id = 'aarya-fallback-panel';
    Object.assign(panel.style, {
      position: 'fixed', right: '18px', bottom: '18px', width: '380px', height: '520px',
      zIndex: '2147483647', display: 'flex', flexDirection: 'column', background: '#111827',
      color: '#fff', border: '1px solid #4b5563', borderRadius: '18px',
      boxShadow: '0 18px 60px rgba(0,0,0,.5)', overflow: 'hidden', fontFamily: 'Arial,sans-serif'
    });

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:#171f2e">
        <strong style="font-size:18px">AARYA</strong>
        <button id="aarya-fallback-close" style="border:0;background:transparent;color:#aaa;font-size:22px;cursor:pointer">×</button>
      </div>
      <div id="aarya-fallback-messages" style="flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px">
        <div style="align-self:flex-start;background:#243044;padding:10px 12px;border-radius:14px">Hi. I'm AARYA. How can I help?</div>
      </div>
      <form id="aarya-fallback-form" style="display:flex;gap:8px;padding:12px;border-top:1px solid #374151">
        <textarea id="aarya-fallback-input" rows="2" placeholder="Ask AARYA..." style="flex:1;resize:none;border:1px solid #4b5563;border-radius:12px;padding:10px;background:#0f172a;color:#fff"></textarea>
        <button id="aarya-fallback-send" type="submit" style="width:72px;border:0;border-radius:12px;background:#2563eb;color:#fff;cursor:pointer">Send</button>
      </form>`;

    document.body.appendChild(panel);

    const messages = panel.querySelector('#aarya-fallback-messages');
    const input = panel.querySelector('#aarya-fallback-input');
    const send = panel.querySelector('#aarya-fallback-send');

    panel.querySelector('#aarya-fallback-close').onclick = () => { panel.style.display = 'none'; };

    panel.querySelector('#aarya-fallback-form').onsubmit = async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      const user = document.createElement('div');
      user.textContent = text;
      Object.assign(user.style, { alignSelf:'flex-end', background:'#2563eb', padding:'10px 12px', borderRadius:'14px' });
      messages.appendChild(user);
      input.value = '';
      send.disabled = true;

      try {
        if (!window.browserAPI?.aaryaAsk) throw new Error('AARYA bridge is not available.');
        const result = await window.browserAPI.aaryaAsk(text);
        const bot = document.createElement('div');
        bot.textContent = result?.text || 'AARYA returned no response.';
        Object.assign(bot.style, { alignSelf:'flex-start', background:'#243044', padding:'10px 12px', borderRadius:'14px', whiteSpace:'pre-wrap' });
        messages.appendChild(bot);
      } catch (error) {
        const bot = document.createElement('div');
        bot.textContent = `AARYA error: ${error?.message || error}`;
        Object.assign(bot.style, { alignSelf:'flex-start', background:'#7f1d1d', padding:'10px 12px', borderRadius:'14px', whiteSpace:'pre-wrap' });
        messages.appendChild(bot);
      } finally {
        send.disabled = false;
        input.focus();
        messages.scrollTop = messages.scrollHeight;
      }
    };

    input.focus();
  }

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
      } else {
        showFallbackPanel();
      }
    });

    document.body.appendChild(button);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAaryaButton, { once: true });
  } else {
    installAaryaButton();
  }
})();
