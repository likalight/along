(() => {
  if (globalThis.__alongVideoReturn) return;
  globalThis.__alongVideoReturn = true;
  let host;
  async function update() {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'ALONG_VIDEO_CHECK' });
      if (!result?.ok) { host?.remove(); host = null; return; }
      if (host?.isConnected) return;
      host = document.createElement('div');
      host.setAttribute('data-along-video-return', '');
      host.style.cssText = 'position:fixed;bottom:24px;left:24px;z-index:2147483647';
      const root = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = 'button{font:600 15px system-ui;display:flex;gap:12px;align-items:center;border:1px solid #ffffff30;border-radius:999px;background:#faf8f0;color:#252b24;padding:14px 22px;box-shadow:0 8px 32px #0006;cursor:pointer}button:focus-visible{outline:3px solid #86c5ff;outline-offset:4px}span{width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 30% 25%,#dbf1ff,#6b85ff 55%,#482778)}small{display:block;font:11px system-ui;color:#4c554a;margin-top:3px}';
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Back to Along');
      const orb = document.createElement('span'); orb.setAttribute('aria-hidden', 'true');
      const text = document.createElement('div'); text.textContent = '← Back to Along';
      const caption = document.createElement('small'); caption.textContent = 'Same conversation · microphone paused';
      text.append(caption); button.append(orb, text);
      button.onclick = async () => {
        document.querySelectorAll('video').forEach(video => video.pause());
        button.disabled = true;
        try {
          const back = await chrome.runtime.sendMessage({ type: 'ALONG_VIDEO_BACK' });
          if (!back?.ok) throw new Error(back?.error || 'Return to your Along tab.');
        } catch (error) { caption.textContent = error.message; button.disabled = false; }
      };
      root.append(style, button); document.documentElement.append(host);
    } catch { host?.remove(); }
  }
  void update();
  document.addEventListener('yt-navigate-finish', update);
})();
