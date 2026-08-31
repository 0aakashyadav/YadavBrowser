class BrowserController {
  constructor(contents) {
    if (!contents) throw new Error('BrowserController requires Electron WebContents');
    this.contents = contents;
  }

  async observe() {
    const url = this.contents.getURL();
    const title = this.contents.getTitle();
    const data = await this.contents.executeJavaScript(`(() => ({
      url: location.href,
      title: document.title,
      text: (document.body?.innerText || '').slice(0, 12000),
      links: [...document.querySelectorAll('a[href]')].slice(0, 50).map(a => ({text: (a.innerText || a.textContent || '').trim().slice(0, 200), href: a.href})),
      buttons: [...document.querySelectorAll('button,[role="button"]')].slice(0, 50).map(b => (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 120))
    }))()`, true);
    return { ...data, url: data.url || url, title: data.title || title };
  }

  async navigate(url) {
    if (!/^https?:\/\//i.test(url)) throw new Error('Browser navigation only permits http(s) URLs');
    await this.contents.loadURL(url);
    return this.observe();
  }

  async click(selector) {
    const value = JSON.stringify(selector);
    return this.contents.executeJavaScript(`(() => { const el = document.querySelector(${value}); if (!el) throw new Error('Selector not found'); el.click(); return true; })()`, true);
  }

  async type(selector, text) {
    const s = JSON.stringify(selector);
    const t = JSON.stringify(text);
    return this.contents.executeJavaScript(`(() => { const el = document.querySelector(${s}); if (!el) throw new Error('Selector not found'); el.focus(); el.value = ${t}; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`, true);
  }

  async scroll(y = 700) {
    const amount = Math.max(-5000, Math.min(5000, Number(y) || 0));
    return this.contents.executeJavaScript(`window.scrollBy({top:${amount},behavior:'instant'}); ({x:window.scrollX,y:window.scrollY})`, true);
  }
}

module.exports = { BrowserController };
