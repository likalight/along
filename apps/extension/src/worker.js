import { DEFAULTS, SITES, backendOrigin, hostPattern, sourceAllowed, normalizeObservation, mediaReference, observationFingerprint, shouldObserve, cropRectangle, expiresAtMs, publicConnection, validCandidates, VISUAL_INTERVAL_MS, createSerialQueue } from './core.js';

let discoveryBusy = false;
let lastStatusAt = 0;
const serializeSettings = createSerialQueue();
const serializeScripts = createSerialQueue();
const ready = Promise.all([
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
  chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
]);
const settings = async () => ({ ...DEFAULTS, ...(await chrome.storage.local.get('settings')).settings });
const auth = async () => {
  const value = (await chrome.storage.session.get('connection')).connection;
  if (!value) return null;
  if (expiresAtMs(value.expiresAt) <= Date.now()) { await chrome.storage.session.remove(['connection', 'results']); return null; }
  return value;
};
function trustedUI(sender) { return sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL('ui/')); }
function pageSource(sender) {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.tab?.id || !sender.url) return null;
  try {
    const url = new URL(sender.url);
    if (sender.origin && sender.origin !== url.origin) return null;
    return url.href;
  } catch { return null; }
}
async function notify() {
  try { await chrome.runtime.sendMessage({ type: 'ALONG_UPDATED' }); } catch { /* No panel open. */ }
  const config = await settings(), connection = publicConnection(await auth());
  for (const tab of await chrome.tabs.query({})) {
    try { if (tab.id && tab.url && new URL(tab.url).origin === config.backendOrigin) await chrome.tabs.sendMessage(tab.id, { type: 'ALONG_CONNECTION_STATUS', connection }, { frameId: 0 }); } catch { /* Bridge unavailable. */ }
  }
}
async function recordNotice(notice) { await chrome.storage.session.set({ notice: String(notice).slice(0, 400) }); await notify(); }
async function api(action, body = {}, connection = null) {
  const config = await settings();
  const credential = connection || await auth();
  if (!credential || expiresAtMs(credential.expiresAt) <= Date.now()) {
    await chrome.storage.session.remove('connection');
    throw new Error('Reconnect to your Along conversation to continue.');
  }
  const response = await fetch(`${config.backendOrigin}/api/discovery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential.token}` },
    body: JSON.stringify({ action, ...body }), signal: AbortSignal.timeout(25000), credentials: 'omit', redirect: 'error',
  });
  if ((response.status === 401 || response.status === 403) && (await auth())?.token === credential.token) await chrome.storage.session.remove(['connection', 'results']);
  const raw = await response.text();
  if (raw.length > 1000000) throw new Error('Along returned too much data. Try again later.');
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('Along did not return a valid response.'); }
  if (!response.ok) { const error = new Error(typeof value.error === 'string' ? value.error.slice(0, 250) : value.error?.message || 'Along is unavailable.'); error.status = response.status; throw error; }
  return value;
}
async function refreshStatus(force = false) {
  const connection = await auth();
  if (!connection || (!force && Date.now() - lastStatusAt < 30000)) return connection;
  const status = await api('status', {}, connection);
  const current = await auth();
  if (current?.token !== connection.token) return current;
  if (status.sessionId !== connection.sessionId || status.epoch !== connection.epoch) {
    await chrome.storage.session.remove(['connection', 'results']);
    throw new Error('Your Along conversation changed. Reconnect to continue.');
  }
  const updated = { ...connection, mode: status.mode, visionAvailable: Boolean(status.visionAvailable), expiresAt: status.expiresAt || connection.expiresAt };
  await chrome.storage.session.set({ connection: updated });
  lastStatusAt = Date.now();
  return updated;
}
function syncScripts() {
  return serializeScripts(syncScriptsNow);
}
async function syncScriptsNow() {
  const config = await settings();
  const desired = [];
  if (await chrome.permissions.contains({ origins: [hostPattern(config.backendOrigin)] })) desired.push({ id: 'along-pair-bridge', matches: [hostPattern(config.backendOrigin)], js: ['src/bridge.js'], runAt: 'document_idle', persistAcrossSessions: true });
  const matches = [];
  for (const origin of config.enabledOrigins) {
    if (await chrome.permissions.contains({ origins: [hostPattern(origin)] })) matches.push(origin === config.backendOrigin ? `${hostPattern(origin).slice(0, -1)}extension-demo*` : hostPattern(origin));
  }
  if (matches.length) desired.push({ id: 'along-discovery', matches: [...new Set(matches)], js: ['src/detection.js', 'src/content.js'], runAt: 'document_idle', persistAcrossSessions: true });
  await chrome.scripting.unregisterContentScripts({ ids: (await chrome.scripting.getRegisteredContentScripts()).map(s => s.id) });
  if (desired.length) await chrome.scripting.registerContentScripts(desired);
  // Registration affects future documents; inject into already-open opted-in pages too.
  for (const tab of await chrome.tabs.query({})) {
    if (!tab.id || !tab.url) continue;
    const files = [];
    try {
      if (new URL(tab.url).origin === config.backendOrigin && await chrome.permissions.contains({ origins: [hostPattern(config.backendOrigin)] })) files.push('src/bridge.js');
      if (sourceAllowed(tab.url, config)) files.push('src/detection.js', 'src/content.js');
      if (files.length) await chrome.scripting.executeScript({ target: { tabId: tab.id }, files });
    } catch { /* Tab closed or browser withheld access. */ }
  }
}
function saveSettings(patch) { return serializeSettings(() => saveSettingsNow(patch)); }
async function saveSettingsNow(patch) {
  const previous = await settings();
  const next = { ...previous };
  if ('backendOrigin' in patch) next.backendOrigin = backendOrigin(patch.backendOrigin);
  for (const key of ['paused', 'demo', 'visual']) if (key in patch) next[key] = patch[key] === true;
  if (patch.consentVersion === 1 || patch.consentVersion === 0) next.consentVersion = patch.consentVersion;
  if ('site' in patch) {
    const { origin, enabled } = patch.site || {};
    if (![...SITES.map(site => site.origin), next.backendOrigin].includes(origin) || typeof enabled !== 'boolean') throw new Error('Invalid site setting.');
    const origins = new Set(next.enabledOrigins);
    enabled ? origins.add(origin) : origins.delete(origin);
    next.enabledOrigins = [...origins];
  }
  if ('enabledOrigins' in patch) {
    if (!Array.isArray(patch.enabledOrigins)) throw new Error('Invalid site list.');
    const allowed = [...SITES.map(s => s.origin), next.backendOrigin];
    next.enabledOrigins = [...new Set(patch.enabledOrigins)].filter(o => allowed.includes(o));
  }
  for (const origin of next.enabledOrigins) if (!(await chrome.permissions.contains({ origins: [hostPattern(origin)] }))) throw new Error('Site permission is required before enabling discovery.');
  if (next.visual && !(await chrome.permissions.contains({ origins: ['<all_urls>'] }))) throw new Error('Visual mode requires the separate browser screenshot permission.');
  if (next.consentVersion !== 1 && (next.enabledOrigins.length || next.visual)) throw new Error('Accept the discovery data disclosure first.');
  if (!next.demo) next.enabledOrigins = next.enabledOrigins.filter(o => o !== next.backendOrigin);
  await chrome.storage.local.set({ settings: next });
  if (previous.backendOrigin !== next.backendOrigin) await chrome.storage.session.remove(['connection', 'results', 'gates']);
  else if (previous.demo !== next.demo) await chrome.storage.session.remove(['results', 'gates']);
  if (next.paused || !next.demo) {
    const { results = [] } = await chrome.storage.session.get('results');
    await chrome.storage.session.set({ results: next.paused ? results : results.filter(r => r.mode !== 'demo') });
  }
  await syncScripts();
  await notify();
  return next;
}
async function openAlong(query) {
  const config = await settings();
  const target = new URL('/', config.backendOrigin);
  for (const [key, value] of Object.entries(query)) target.searchParams.set(key, value);
  const tabs = await chrome.tabs.query({});
  const connection = await auth();
  const candidates = tabs.filter(tab => { try { const u = new URL(tab.url); return u.origin === config.backendOrigin && u.pathname === '/'; } catch { return false; } }).sort((a, b) => Number(b.id === connection?.appTabId) - Number(a.id === connection?.appTabId) || (b.lastAccessed || 0) - (a.lastAccessed || 0));
  let existing = null;
  for (const tab of candidates) {
    if (!query.discoverySession) { existing = tab; break; }
    try { const check = await chrome.tabs.sendMessage(tab.id, { type: 'ALONG_SESSION_CHECK', sessionId: query.discoverySession }, { frameId: 0 }); if (check?.same === true) { existing = tab; break; } } catch { /* No verified session in this tab. */ }
  }
  if (existing) {
    // The existing root conversation remains the destination; never create a chat session here.
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    if (query.alongExtension) await chrome.tabs.sendMessage(existing.id, { type: 'ALONG_CONNECT_REQUEST' }, { frameId: 0 });
  } else await chrome.tabs.create({ url: target.href });
  return { ok: true };
}
async function claimPair(message, sender) {
  const config = await settings();
  const source = pageSource(sender);
  if (!source || new URL(source).origin !== config.backendOrigin || message.extensionId !== chrome.runtime.id || typeof message.code !== 'string' || message.code.length < 8 || message.code.length > 500) throw new Error('Invalid Along pairing request.');
  const response = await fetch(`${config.backendOrigin}/api/discovery/pair`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'claim', code: message.code, extensionId: chrome.runtime.id }),
    signal: AbortSignal.timeout(15000), credentials: 'omit', redirect: 'error',
  });
  const value = await response.json();
  if (!response.ok || typeof value.token !== 'string' || typeof value.sessionId !== 'string' || value.epoch === undefined || !Number.isFinite(expiresAtMs(value.expiresAt))) throw new Error('Pairing expired or was refused. Reconnect from Along.');
  await chrome.storage.session.set({ connection: { ...value, appTabId: sender.tab.id }, results: [], gates: {}, notice: 'Connected to your Along conversation.' });
  lastStatusAt = 0;
  await notify();
  return { ok: true, sessionId: value.sessionId, epoch: value.epoch }; // Never expose the bearer token to the page.
}
async function screenshot(sender, observation, mediaReference, config, connection) {
  if (!mediaReference || !config.visual || config.demo || !connection.visionAvailable || !(await chrome.permissions.contains({ origins: ['<all_urls>'] }))) return null;
  const check = await chrome.tabs.sendMessage(sender.tab.id, { type: 'ALONG_CAPTURE_CHECK', observation, mediaIdentity: mediaReference.identity }, { frameId: 0 });
  const media = check?.media;
  if (!media || media.identity !== mediaReference.identity || media.kind !== mediaReference.kind) return null;
  const tab = await chrome.tabs.get(sender.tab.id);
  const window = await chrome.windows.get(tab.windowId);
  if (!tab.active || !window.focused || tab.url !== sender.url || !sourceAllowed(tab.url, config)) return null;
  const { lastCaptureAt = 0 } = await chrome.storage.session.get('lastCaptureAt');
  if (Date.now() - lastCaptureAt < VISUAL_INTERVAL_MS) return null;
  await chrome.storage.session.set({ lastCaptureAt: Date.now() });
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 70 });
  const current = await chrome.tabs.get(tab.id);
  const currentWindow = await chrome.windows.get(tab.windowId);
  if (!current.active || !currentWindow.focused || current.url !== tab.url) return null;
  const recheck = await chrome.tabs.sendMessage(tab.id, { type: 'ALONG_CAPTURE_CHECK', observation, mediaIdentity: media.identity }, { frameId: 0 });
  if (JSON.stringify(recheck?.media) !== JSON.stringify(media)) return null;
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  try {
    const crop = cropRectangle(media.rect, media.viewport, bitmap);
    if (!crop) return null;
    const ratio = Math.min(1, 640 / Math.max(crop.width, crop.height));
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(crop.width * ratio)), Math.max(1, Math.round(crop.height * ratio)));
    canvas.getContext('2d').drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.65 });
    if (blob.size > 300000) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return `data:image/jpeg;base64,${btoa(binary)}`;
  } finally { bitmap.close(); }
}
async function discover(message, sender) {
  const sourceUrl = pageSource(sender);
  const config = await settings();
  if (!sourceUrl || discoveryBusy) return { skipped: true };
  const observation = normalizeObservation(message.observation, sourceUrl);
  if (!observation) return { skipped: true };
  const media = mediaReference(message.media);
  const tab = await chrome.tabs.get(sender.tab.id);
  const window = await chrome.windows.get(tab.windowId);
  const now = Date.now();
  const { gates = {} } = await chrome.storage.session.get('gates');
  const visualEnabled = !config.demo && config.visual && (await auth())?.visionAvailable;
  // Social media in visual mode must provide trustworthy pixels; a failed/ambiguous capture is not a caption-only match.
  if (visualEnabled && observation.kind !== 'product' && !media) return { skipped: true };
  const visualAttempt = Boolean(visualEnabled && media);
  const key = observationFingerprint(observation, media, now, visualAttempt);
  const gate = gates[new URL(sourceUrl).origin] || { seen: {}, lastAt: 0 };
  if (!shouldObserve({ settings: config, url: sourceUrl, dwellMs: Math.min(Number(message.dwellMs) || 0, 60000), visible: message.visible === true && tab.active && tab.url === sourceUrl, focused: window.focused, now, lastAt: gate.lastAt, duplicate: Boolean(gate.seen[key] && now - gate.seen[key] < 600000), cooldownMs: visualAttempt ? VISUAL_INTERVAL_MS : 45000 })) return { skipped: true };
  discoveryBusy = true;
  try {
    const connection = await refreshStatus();
    if (!connection) return { skipped: true };
    if (connection.mode === 'demo' && !config.demo) return { skipped: true };
    if (connection.mode === 'unavailable' && !config.demo) { await recordNotice('Live discovery is unavailable. Enable demo mode explicitly to explore fixtures.'); return { skipped: true }; }
    const image = visualAttempt ? await screenshot(sender, observation, media, config, connection) : null;
    if (visualAttempt && !image) return { skipped: true };
    if (image) observation.imageDataUrl = image;
    const beforeSendConfig = await settings();
    const beforeSendAuth = await auth();
    const beforeSendTab = await chrome.tabs.get(sender.tab.id);
    const beforeSendWindow = await chrome.windows.get(beforeSendTab.windowId);
    if (beforeSendConfig.paused || beforeSendConfig.demo !== config.demo || beforeSendConfig.visual !== config.visual || !sourceAllowed(sourceUrl, beforeSendConfig) || beforeSendAuth?.token !== connection.token || !beforeSendTab.active || !beforeSendWindow.focused || beforeSendTab.url !== sourceUrl) return { skipped: true };
    gate.lastAt = now;
    gate.seen[key] = now;
    gate.seen = Object.fromEntries(Object.entries(gate.seen).filter(([, t]) => now - t < 600000).slice(-100));
    gates[new URL(sourceUrl).origin] = gate;
    await chrome.storage.session.set({ gates });
    const result = await api('discover', { observation, demo: config.demo }, connection);
    const nextConfig = await settings();
    const nextConnection = await auth();
    if (nextConfig.paused || !sourceAllowed(sourceUrl, nextConfig) || nextConnection?.token !== connection.token) return { skipped: true };
    const resultTab = await chrome.tabs.get(sender.tab.id), resultWindow = await chrome.windows.get(sender.tab.windowId);
    const currentObservation = await chrome.tabs.sendMessage(sender.tab.id, { type: 'ALONG_OBSERVATION_CHECK', observation, mediaIdentity: media?.identity }, { frameId: 0 });
    if (!resultTab.active || !resultWindow.focused || resultTab.url !== sourceUrl || !currentObservation?.same) return { skipped: true };
    const { results = [] } = await chrome.storage.session.get('results');
    const candidates = validCandidates(result, nextConfig.demo);
    if (!candidates.length) { await recordNotice(result.notice || 'No confident match. Along will stay quiet.'); return { skipped: true }; }
    const record = { observationId: result.observationId, mode: result.mode, notice: String(result.notice || '').slice(0, 500), source: { url: sourceUrl, title: observation.title }, candidates, capturedAt: Date.now(), sessionId: connection.sessionId, epoch: connection.epoch };
    const duplicate = candidates.every(candidate => results.some(r => r.source.url === sourceUrl && r.mode === result.mode && r.candidates.some(c => c.id === candidate.id)));
    await chrome.storage.session.set({ results: [record, ...results.filter(r => r.source.url !== sourceUrl && Date.now() - r.capturedAt < 600000)].slice(0, 12), notice: record.notice });
    await notify();
    return duplicate ? { skipped: true } : { result: record };
  } finally { discoveryBusy = false; }
}
async function handoff(message) {
  const connection = await refreshStatus(true);
  const { results = [] } = await chrome.storage.session.get('results');
  const record = results.find(r => r.observationId === message.observationId && r.sessionId === connection?.sessionId && r.epoch === connection?.epoch);
  if (!record || !record.candidates.some(c => c.id === message.candidateId)) throw new Error('This discovery has expired. Find it again in the current conversation.');
  let result;
  try { result = await api('handoff', { observationId: message.observationId, candidateId: message.candidateId }); }
  catch (error) { if (error.status === 409) { await chrome.storage.session.set({ results: results.filter(r => r.observationId !== message.observationId) }); await notify(); } throw error; }
  const config = await settings();
  const url = new URL(result.url, config.backendOrigin);
  if (url.origin !== config.backendOrigin || url.pathname !== '/' || result.sessionId !== connection.sessionId) throw new Error('Along returned an unexpected conversation destination.');
  return openAlong({ discoverySession: result.sessionId });
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!message || typeof message.type !== 'string' || message.type === 'ALONG_UPDATED') return false;
  // Opening the panel must happen while the original content-script click is still a user gesture.
  if (message.type === 'ALONG_OPEN_PANEL') {
    const source = pageSource(sender);
    if (!source) { reply({ error: 'Invalid page.' }); return false; }
    chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => reply({ ok: true }), () => reply({ error: 'Use the Along toolbar icon to open your discoveries.' }));
    return true;
  }
  (async () => {
    await ready;
    if (message.type === 'ALONG_PAIR_CODE') return claimPair(message, sender);
    if (message.type === 'ALONG_PAIR_STATUS') {
      const config = await settings(), source = pageSource(sender);
      if (!source || new URL(source).origin !== config.backendOrigin) throw new Error('Invalid Along origin.');
      return { connection: publicConnection(await auth()) };
    }
    if (message.type === 'ALONG_OBSERVE') return discover(message, sender);
    if (message.type === 'ALONG_HELLO') {
      const config = await settings();
      const source = pageSource(sender);
      const connection = await auth();
      return { enabled: Boolean(source && config.consentVersion === 1 && !config.paused && sourceAllowed(source, config)), demo: config.demo, visual: config.visual, visionAvailable: Boolean(connection?.visionAvailable), connected: Boolean(connection) };
    }
    if (!trustedUI(sender)) throw new Error('This command is only available inside Along.');
    switch (message.type) {
      case 'ALONG_STATE': {
        const state = await chrome.storage.session.get(['results', 'notice']);
        const results = (state.results || []).filter(r => Date.now() - r.capturedAt < 600000);
        return { settings: await settings(), connection: publicConnection(await auth()), results, notice: state.notice || '', extensionId: chrome.runtime.id };
      }
      case 'ALONG_SETTINGS': return { settings: await saveSettings(message.patch || {}) };
      case 'ALONG_CONNECT': return serializeSettings(async () => { await syncScripts(); return openAlong({ alongExtension: chrome.runtime.id }); });
      case 'ALONG_REFRESH': await refreshStatus(true); return { ok: true };
      case 'ALONG_HANDOFF': return handoff(message);
      case 'ALONG_CLEAR': await chrome.storage.session.remove(['results', 'notice']); await notify(); return { ok: true };
      case 'ALONG_DISCONNECT': await chrome.storage.session.remove(['connection', 'results', 'gates']); await notify(); return { ok: true };
      default: throw new Error('Unknown Along command.');
    }
  })().then(reply).catch(async error => { const text = error.name === 'TimeoutError' ? 'Along took too long. Discovery will retry later.' : String(error.message || 'Along is unavailable.').slice(0, 400); await recordNotice(text); reply({ error: text }); });
  return true;
});
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await ready;
  await serializeSettings(async () => {
    if (reason === 'install') { await chrome.storage.local.set({ settings: { ...DEFAULTS } }); await chrome.tabs.create({ url: chrome.runtime.getURL('ui/panel.html?setup=1') }); }
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    await syncScripts();
  });
});
chrome.runtime.onStartup.addListener(() => { syncScripts().catch(() => {}); });
chrome.permissions.onRemoved.addListener(async () => {
  await serializeSettings(async () => {
    const config = await settings();
    const enabledOrigins = [];
    for (const origin of config.enabledOrigins) if (await chrome.permissions.contains({ origins: [hostPattern(origin)] })) enabledOrigins.push(origin);
    await chrome.storage.local.set({ settings: { ...config, enabledOrigins, visual: config.visual && await chrome.permissions.contains({ origins: ['<all_urls>'] }) } });
    await syncScripts(); await notify();
  });
});
