(() => {
  if (globalThis.__alongDiscoveryInstalled) return;
  globalThis.__alongDiscoveryInstalled = true;
  const D = globalThis.AlongDetection;
  let config = { enabled: false }, stableKey = '', stableSince = 0, pending = false, lastSent = '', lastSentAt = 0;
  let host = null, dismissed = new Set(), stopped = false;
  let mediaSequence = 0;
  const mediaIds = new WeakMap();
  const postSelector = 'article, [data-e2e="recommend-list-item-container"], ytd-reel-video-renderer, [data-along-post]';
  const visible = element => {
    if (!element || element.closest('[contenteditable], input, textarea, [role="textbox"]')) return false;
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0 && D.visibleArea(box, { width: innerWidth, height: innerHeight }) >= 100;
  };
  const text = (selector, root = document) => {
    const el = [...root.querySelectorAll(selector)].find(visible);
    return el ? D.text(el.textContent) : '';
  };
  function visibleMedia() {
    const viewport = { width: innerWidth, height: innerHeight };
    const videos = [...document.querySelectorAll('video')].filter(visible);
    const photoSelector = 'article img, [data-along-post] img, [data-e2e="recommend-list-item-container"] img, #landingImage, #imgTagWrapperId img';
    const photos = [...document.querySelectorAll(photoSelector)];
    // Instagram's single-post layout sometimes omits <article>. Never use a generic feed/body image sweep.
    if (location.hostname === 'www.instagram.com' && /^\/(p|reel)\//.test(location.pathname)) photos.push(...document.querySelectorAll('main img'));
    const candidates = videos.map(element => ({ element, kind: 'video', rect: element.getBoundingClientRect() }));
    for (const element of new Set(photos)) {
      if (!visible(element) || !element.complete || element.naturalWidth < 200 || element.naturalHeight < 200 || element.closest('header, nav, [role="navigation"]') || /avatar|profile|logo|icon|프로필/i.test(element.alt || '')) continue;
      const rect = element.getBoundingClientRect();
      // A video's poster is not a second independent photo.
      if (videos.some(video => D.intersects(rect, video.getBoundingClientRect()))) continue;
      candidates.push({ element, kind: 'photo', rect });
    }
    const selected = D.dominantMedia(candidates, viewport);
    if (!selected) return null;
    const { element, kind, rect } = selected;
    if (!mediaIds.has(element)) mediaIds.set(element, ++mediaSequence);
    let hash = 2166136261;
    for (const ch of element.currentSrc || element.src || '') hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
    return { element, container: element.closest(postSelector), kind, identity: `${mediaIds.get(element)}:${(hash >>> 0).toString(36)}`, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, viewport };
  }
  function observation() {
    let item = null;
    // Structured product data only: no page-body dump, form values, cookies or account data.
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      if (script.textContent.length > 150000) continue;
      try { item = D.productFromJsonLd(JSON.parse(script.textContent)); } catch { /* Invalid publisher data is ignored. */ }
      if (item) {
        const productHeading = text('h1, #productTitle, [data-along-product-title]').toLocaleLowerCase();
        if (productHeading && (productHeading.includes(item.title.toLocaleLowerCase().slice(0, 25)) || item.title.toLocaleLowerCase().includes(productHeading.slice(0, 25)))) break;
        item = null;
      }
    }
    if (!item) {
      const title = text('#productTitle, [data-along-product-title]');
      if (title) item = { title, text: text('#feature-bullets, [data-along-product-description]'), kind: 'product' };
    }
    let media = visibleMedia();
    if (!item) {
      // Select known public caption/title surfaces. Never read comments or private-message containers.
      const selector = '[data-along-post-caption], [data-e2e="video-desc"], [data-e2e="browse-video-desc"], article h1, article [data-testid="post-caption"], ytd-watch-metadata h1, ytd-reel-video-renderer[is-active] h2, ytd-shorts h2';
      const container = media?.container;
      const captions = [...(container || document).querySelectorAll(selector)].filter(visible);
      // Multiple visible post captions without a selected post are ambiguous.
      if (!container && captions.length > 1) return null;
      let caption = captions[0] ? D.text(captions[0].textContent) : '';
      if (!caption && media?.kind === 'photo') caption = D.text(media.element.alt, 240);
      const singlePost = /^\/(p|reel|shorts)\//.test(location.pathname) || location.pathname === '/watch' || /^\/@[^/]+\/(video|photo)\//.test(location.pathname);
      if (!caption && media && singlePost) caption = D.text(document.querySelector('meta[property="og:title"]')?.content, 240);
      if (caption.length > 3) item = { title: caption.slice(0, 240), text: caption, kind: media?.kind === 'video' ? 'video' : 'post' };
      else if (media && config.visual && config.visionAvailable) item = { title: media.kind === 'video' ? 'Visible video' : 'Visible photo', text: '', kind: media.kind === 'video' ? 'video' : 'post' };
    }
    if (!item) return null;
    return { observation: { ...item, pageUrl: location.href }, media };
  }
  function captureCheck(expected, mediaIdentity) {
    if (!config.enabled || !config.visual || !config.visionAvailable || document.visibilityState !== 'visible' || !document.hasFocus()) return null;
    const current = observation();
    if (!current?.media || current.media.identity !== mediaIdentity || !D.sameObservation(current.observation, expected)) return null;
    const r = current.media.rect;
    const region = { left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height };
    // Read geometry only. Never read input values. Any intersecting form/modal makes capture ineligible.
    for (const element of document.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"], [role="dialog"], dialog[open], [aria-modal="true"]')) {
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      if (style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && box.width > 0 && box.height > 0 && D.intersects(region, box)) return null;
    }
    // Reject occluded media, including non-dialog popovers. No pixels from an unrelated overlay are sent.
    const left = Math.max(0, region.left), top = Math.max(0, region.top), right = Math.min(innerWidth, region.right), bottom = Math.min(innerHeight, region.bottom);
    for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      const hit = document.elementFromPoint(left + (right - left) * fx, top + (bottom - top) * fy);
      if (!hit || !(hit === current.media.element || hit.contains(current.media.element))) return null;
    }
    const { kind, identity, rect, viewport } = current.media;
    return { kind, identity, rect, viewport };
  }
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (message.type === 'ALONG_CAPTURE_CHECK') { reply({ media: captureCheck(message.observation, message.mediaIdentity) }); return false; }
    if (message.type === 'ALONG_OBSERVATION_CHECK') { const current = observation(); reply({ same: config.enabled && document.visibilityState === 'visible' && D.sameObservation(current?.observation, message.observation) && (!message.mediaIdentity || current?.media?.identity === message.mediaIdentity) }); return false; }
    return false;
  });
  async function refresh() {
    if (stopped) return;
    try {
      config = await chrome.runtime.sendMessage({ type: 'ALONG_HELLO' });
      if (!config.enabled) { host?.remove(); host = null; stableKey = ''; }
    } catch { stopped = true; host?.remove(); }
  }
  function showChip(result) {
    if (!config.enabled || dismissed.has(result.observationId) || result.mode === 'demo' && !config.demo || !result.candidates?.length) return;
    host?.remove();
    host = document.createElement('div');
    host.dataset.alongCompanion = 'true';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `:host{all:initial;position:fixed;right:24px;bottom:24px;z-index:2147483646;font-family:system-ui,-apple-system,sans-serif;color:#17264a}*{box-sizing:border-box}.chip{display:flex;align-items:center;gap:11px;max-width:min(340px,calc(100vw - 32px));padding:12px 12px 12px 15px;background:#fff;border:1px solid #dfe6f5;border-radius:20px;box-shadow:0 8px 32px #173c7320}.open{display:flex;align-items:center;gap:12px;border:0;padding:0;background:none;text-align:left;color:inherit;cursor:pointer;font:inherit}.orb{width:29px;height:29px;flex-shrink:0;background:radial-gradient(circle at 33% 25%,#b3dcff,#347bfa 48%,#1241b0);border-radius:50%;box-shadow:inset -4px -5px 7px #062b8230}.label{font-size:13px;font-weight:650;line-height:1.4}.meta{display:block;font-size:10px;color:#617294;letter-spacing:.06em;margin-top:3px}.close{width:28px;height:28px;flex-shrink:0;border:0;border-radius:50%;background:#f3f6fb;color:#65718b;font-size:18px;cursor:pointer}.open:focus-visible,.close:focus-visible{outline:3px solid #6098ff;outline-offset:4px}@media(prefers-reduced-motion:no-preference){.chip{animation:arrive .25s ease-out}@keyframes arrive{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}}`;
    const chip = document.createElement('div'); chip.className = 'chip'; chip.setAttribute('role', 'status');
    const button = document.createElement('button'); button.className = 'open'; button.type = 'button';
    const orb = document.createElement('span'); orb.className = 'orb'; orb.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.className = 'label';
    const candidate = result.candidates[0];
    label.textContent = result.mode === 'demo' ? 'A demo discovery for you' : candidate.linkKind === 'search' ? 'Explore similar on Coupang' : candidate.match === 'exact' ? 'This is listed on Coupang' : 'Similar on Coupang';
    const meta = document.createElement('span'); meta.className = 'meta'; meta.textContent = result.mode === 'demo' ? 'ALONG · FIXTURE DATA' : 'ALONG · LIVE DISCOVERY';
    label.append(meta); button.append(orb, label);
    button.addEventListener('click', () => { chrome.runtime.sendMessage({ type: 'ALONG_OPEN_PANEL', observationId: result.observationId }).catch(() => {}); });
    const close = document.createElement('button'); close.type = 'button'; close.className = 'close'; close.textContent = '×'; close.setAttribute('aria-label', 'Dismiss this Along discovery');
    close.addEventListener('click', () => { dismissed.add(result.observationId); host?.remove(); host = null; });
    chip.append(button, close); shadow.append(style, chip); document.documentElement.append(host);
  }
  async function tick() {
    if (stopped || !config.enabled || !config.connected || pending || document.visibilityState !== 'visible' || !document.hasFocus()) { stableSince = 0; return; }
    const found = observation();
    if (!found) { stableKey = ''; stableSince = 0; return; }
    const key = JSON.stringify([found.observation, found.media?.identity]);
    const now = Date.now();
    if (key !== stableKey || !stableSince) { stableKey = key; stableSince = now; return; }
    const videoRetry = config.visual && config.visionAvailable && found.media?.kind === 'video' && now - lastSentAt >= 15000;
    if (now - stableSince < 5000 || now - lastSentAt < 10000 || lastSent === key && now - lastSentAt < 600000 && !videoRetry) return;
    pending = true;
    try {
      const media = found.media ? { kind: found.media.kind, identity: found.media.identity } : null;
      const response = await chrome.runtime.sendMessage({ type: 'ALONG_OBSERVE', observation: found.observation, media, dwellMs: now - stableSince, visible: true });
      lastSentAt = now;
      if (!response.skipped && !response.error) lastSent = key;
      if (response.result && key === stableKey && location.href === found.observation.pageUrl) showChip(response.result);
    } catch { stopped = true; } finally { pending = false; }
  }
  document.addEventListener('visibilitychange', () => { stableSince = 0; if (document.visibilityState === 'visible') refresh(); });
  window.addEventListener('focus', () => { stableSince = 0; refresh(); });
  window.addEventListener('blur', () => { stableSince = 0; });
  refresh();
  setInterval(refresh, 10000);
  setInterval(tick, 1000);
})();
