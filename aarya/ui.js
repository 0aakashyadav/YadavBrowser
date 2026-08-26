(() => {
  const style = document.createElement('style');
  style.textContent = `
    #aarya-panel { position: fixed; right: 18px; bottom: 18px; width: 360px; height: 520px; z-index: 999999; display: none; flex-direction: column; background: #111827; color: #fff; border: 1px solid #374151; border-radius: 18px; box-shadow: 0 18px 60px rgba(0,0,0,.45); overflow: hidden; font-family: Arial, sans-serif; }
    #aarya-head { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; background:#171f2e; }
    #aarya-head strong { font-size:18px; }
    #aarya-close { border:0; background:transparent; color:#9ca3af; font-size:20px; cursor:pointer; }
    #aarya-messages { flex:1; overflow:auto; padding:14px; display:flex; flex-direction:column; gap:10px; }
    .aarya-msg { max-width:88%; padding:10px 12px; border-radius:14px; white-space:pre-wrap; line-height:1.4; font-size:14px; }
    .aarya-user { align-self:flex-end; background:#2563eb; }
    .aarya-bot { align-self:flex-start; background:#243044; }
    #aarya-form { display:flex; gap:8px; padding:12px; border-top:1px solid #374151; }
    #aarya-input { flex:1; min-width:0; resize:none; border:1px solid #4b5563; border-radius:12px; padding:10px; background:#0f172a; color:#fff; outline:none; }
    #aarya-send { width:72px; border:0; border-radius:12px; background:#2563eb; color:#fff; cursor:pointer; }
    #aarya-send:disabled { opacity:.5; cursor:wait; }
  `;
  document.head.appendChild(style);

  const panel = document.createElement('section');
  panel.id = 'aarya-panel';
  panel.innerHTML = `
    <div id="aarya-head"><strong>AARYA</strong><button id="aarya-close" aria-label="Close AARYA">×</button></div>
    <div id="aarya-messages"><div class="aarya-msg aarya-bot">Hi. I'm AARYA. How can I help?</div></div>
    <form id="aarya-form"><textarea id="aarya-input" rows="2" placeholder="Ask AARYA..."></textarea><button id="aarya-send" type="submit">Send</button></form>
  `;
  document.body.appendChild(panel);

  const messages = panel.querySelector('#aarya-messages');
  const input = panel.querySelector('#aarya-input');
  const send = panel.querySelector('#aarya-send');

  function addMessage(text, type) {
    const item = document.createElement('div');
    item.className = `aarya-msg aarya-${type}`;
    item.textContent = text;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }

  window.aaryaUI = {
    toggle() {
      panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
      if (panel.style.display === 'flex') input.focus();
    }
  };

  panel.querySelector('#aarya-close').addEventListener('click', () => { panel.style.display = 'none'; });

  panel.querySelector('#aarya-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !window.browserAPI?.aaryaAsk) return;

    addMessage(text, 'user');
    input.value = '';
    send.disabled = true;

    try {
      const result = await window.browserAPI.aaryaAsk(text);
      addMessage(result?.text || 'AARYA returned no response.', 'bot');
    } catch (error) {
      addMessage(`AARYA error: ${error?.message || error}`, 'bot');
    } finally {
      send.disabled = false;
      input.focus();
    }
  });
})();
