export const DEFAULTS = Object.freeze({
  backendOrigin: 'http://127.0.0.1:4339', enabledOrigins: [], paused: false,
  demo: false, visual: false, consentVersion: 0,
});
export const SITES = Object.freeze([
  { name: 'Amazon', origin: 'https://www.amazon.com', detail: 'Product pages' },
  { name: 'Amazon Singapore', origin: 'https://www.amazon.sg', detail: 'Product pages' },
  { name: 'TikTok', origin: 'https://www.tiktok.com', detail: 'Public posts and visible videos' },
  { name: 'Instagram', origin: 'https://www.instagram.com', detail: 'Public posts, photos and videos' },
  { name: 'YouTube', origin: 'https://www.youtube.com', detail: 'Video titles and visible videos' },
]);
export const DWELL_MS = 5000;
export const COOLDOWN_MS = 45000;
export const VISUAL_INTERVAL_MS = 15000;
export const MAX_TEXT = 1800;
export function createSerialQueue() {
  let tail = Promise.resolve();
  return task => {
    const pending = tail.then(task, task);
    tail = pending.catch(() => {});
    return pending;
  };
}
export function backendOrigin(value) {
  const url = new URL(value);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))) throw new Error('Use an HTTPS Along address or local localhost address.');
  return url.origin;
}
export function hostPattern(origin) { const url = new URL(origin); return `${url.protocol}//${url.hostname}/*`; }
export function safeUrl(value, { images = false } = {}) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && (!images || !u.hash) ? u.href : null; } catch { return null; }
}
export function sourceAllowed(value, settings) {
  try {
    const url = new URL(value);
    if (!settings.enabledOrigins.includes(url.origin)) return false;
    if (url.origin === settings.backendOrigin) return settings.demo && url.pathname === '/extension-demo';
    if (!SITES.some(site => site.origin === url.origin)) return false;
    // Never observe private messaging, accounts, checkout or search input surfaces.
    if (/\/(direct|inbox|messages|accounts|account|settings|checkout|cart|ap\/signin|signin|login|upload|creator-center)(\/|$)/i.test(url.pathname)) return false;
    if (url.hostname.startsWith('www.amazon.')) return /\/(dp|gp\/product|gp\/aw\/d)\//.test(url.pathname);
    if (url.hostname.endsWith('instagram.com')) return url.pathname === '/' || /^\/(p|reel|reels)\//.test(url.pathname);
    if (url.hostname.endsWith('youtube.com')) return url.pathname === '/watch' || url.pathname.startsWith('/shorts/');
    return true;
  } catch { return false; }
}
export function normalizeObservation(value, sourceUrl) {
  if (!value || !['product', 'post', 'video'].includes(value.kind)) return null;
  let page;
  try { page = new URL(sourceUrl); } catch { return null; }
  if (value.pageUrl !== sourceUrl) return null;
  const clean = v => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  const title = clean(value.title).slice(0, 240);
  if (title.length < 3) return null;
  return { pageUrl: page.href, title, text: clean(value.text).slice(0, MAX_TEXT), kind: value.kind };
}
export function fingerprint(observation) {
  let hash = 2166136261;
  for (const ch of `${observation.pageUrl}|${observation.title}|${observation.text || ''}`) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}
export function mediaReference(value) {
  if (!value || !['photo', 'video'].includes(value.kind) || typeof value.identity !== 'string' || !/^[a-zA-Z0-9:-]{1,100}$/.test(value.identity)) return null;
  return { kind: value.kind, identity: value.identity };
}
export function observationFingerprint(observation, media, now, visualAttempt) {
  const identity = mediaReference(media);
  return `${fingerprint(observation)}${identity ? `:${identity.kind}:${identity.identity}` : ''}${visualAttempt && identity?.kind === 'video' ? `:${Math.floor(now / VISUAL_INTERVAL_MS)}` : ''}`;
}
export function shouldObserve({ settings, url, dwellMs, visible, focused, now, lastAt = 0, duplicate = false, cooldownMs = COOLDOWN_MS }) {
  return !settings.paused && settings.consentVersion === 1 && sourceAllowed(url, settings) && visible && focused && dwellMs >= DWELL_MS && !duplicate && now - lastAt >= Math.max(VISUAL_INTERVAL_MS, cooldownMs);
}
export function cropRectangle(rect, viewport, image) {
  if (!rect || !viewport || !image || ![rect.x, rect.y, rect.width, rect.height, viewport.width, viewport.height, image.width, image.height].every(Number.isFinite)) return null;
  if (viewport.width <= 0 || viewport.height <= 0 || image.width <= 0 || image.height <= 0 || rect.width < 80 || rect.height < 80) return null;
  const x = Math.max(0, rect.x), y = Math.max(0, rect.y);
  const right = Math.min(viewport.width, rect.x + rect.width), bottom = Math.min(viewport.height, rect.y + rect.height);
  if (right - x < 80 || bottom - y < 80) return null;
  const sx = image.width / viewport.width, sy = image.height / viewport.height;
  return { x: Math.floor(x * sx), y: Math.floor(y * sy), width: Math.floor((right - x) * sx), height: Math.floor((bottom - y) * sy) };
}
export function expiresAtMs(value) { return typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value); }
export function publicConnection(connection) {
  if (!connection) return null;
  const { sessionId, epoch, expiresAt, mode, visionAvailable } = connection;
  return { sessionId, epoch, expiresAt, mode, visionAvailable: Boolean(visionAvailable) };
}
export function validCandidates(result, demoEnabled) {
  if (!result || !['demo', 'live'].includes(result.mode) || (result.mode === 'demo' && !demoEnabled)) return [];
  return (Array.isArray(result.candidates) ? result.candidates : []).filter(c => c && typeof c.id === 'string' && typeof c.title === 'string' && safeUrl(c.url) && ['exact', 'similar'].includes(c.match)).slice(0, 6);
}
