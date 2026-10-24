import { SITES, backendOrigin, hostPattern, safeUrl } from '../src/core.js';
const $ = id => document.getElementById(id);
let state = null, setupOpen = new URLSearchParams(location.search).has('setup'), backendDirty = false;
async function send(type, data = {}) { const response = await chrome.runtime.sendMessage({ type, ...data }); if (response?.error) throw new Error(response.error); return response; }
function error(err) { $('notice').hidden = false; $('notice').textContent = err.message || String(err); }
function node(tag, className, content) { const element = document.createElement(tag); if (className) element.className = className; if (content) element.textContent = content; return element; }
async function save(patch) { await send('ALONG_SETTINGS', { patch }); await refresh(); }
function requireConsent() { if (!$('consent').checked) throw new Error('Read and accept the discovery disclosure before enabling a site.'); }
async function permission(origin) { if (!(await chrome.permissions.request({ origins: [origin] }))) throw new Error('Permission was not granted. This feature remains off.'); }
function money(value) { if (!value || !Number.isFinite(value.amount)) return 'Price not verified'; try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: value.currency }).format(value.amount); } catch { return 'Price not verified'; } }
function renderResults() {
  $('results').replaceChildren();
  $('count').textContent = String(state.results.reduce((n, r) => n + r.candidates.length, 0));
  $('empty').hidden = state.results.length > 0;
  $('clear').hidden = !state.results.length;
  for (const record of state.results) {
    const section = node('article', 'discovery');
    const heading = node('div', 'discovery-heading');
    heading.append(node('span', `pill${record.mode === 'demo' ? ' demo' : ''}`, record.mode === 'demo' ? 'DEMO · FIXTURE DATA' : 'LIVE DISCOVERY'));
    section.append(heading, node('p', 'source-title', `From: ${record.source.title}`));
    if (record.notice) section.append(node('p', 'small', record.notice));
    for (const candidate of record.candidates) {
      const card = node('div', 'product-card');
      const top = node('div', 'product-top');
      if (candidate.imageUrl && safeUrl(candidate.imageUrl, { images: true })) {
        const image = node('img', 'product-image'); image.src = candidate.imageUrl; image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; image.addEventListener('error', () => image.remove()); top.append(image);
      }
      const copy = node('div', 'product-copy'); copy.append(node('h3', '', candidate.title), node('p', 'price', money(candidate.price)));
      copy.append(node('p', 'match', candidate.linkKind === 'search' ? 'Search suggestion · listing not verified' : candidate.match === 'exact' ? 'Exact match reported by source' : 'Similar item · not an exact match'));
      top.append(copy); card.append(top);
      const details = node('div', 'details');
      if (candidate.reasons?.length) details.append(node('p', '', candidate.reasons.slice(0, 3).join(' · ')));
      if (candidate.unknowns?.length) details.append(node('p', 'unknowns', `Not verified: ${candidate.unknowns.slice(0, 3).join(' · ')}`));
      card.append(details);
      const actions = node('div', 'card-actions');
      const discuss = node('button', 'discuss', 'Discuss with Along'); discuss.type = 'button';
      discuss.addEventListener('click', async () => { discuss.disabled = true; try { await send('ALONG_HANDOFF', { observationId: record.observationId, candidateId: candidate.id }); } catch (err) { error(err); } finally { discuss.disabled = false; } });
      const listing = node('a', 'listing', candidate.linkKind === 'search' ? 'Search ↗' : 'View ↗'); listing.href = candidate.url; listing.target = '_blank'; listing.rel = 'noopener noreferrer';
      actions.append(discuss, listing); card.append(actions); section.append(card);
    }
    $('results').append(section);
  }
}
function renderSites() {
  $('sites').replaceChildren();
  for (const site of SITES) {
    const label = node('label', 'toggle-row');
    const text = node('span'); text.append(node('strong', '', site.name), node('small', '', site.detail));
    const input = node('input'); input.type = 'checkbox'; input.setAttribute('role', 'switch'); input.setAttribute('aria-label', `Enable discovery on ${site.name}`); input.checked = state.settings.enabledOrigins.includes(site.origin);
    input.addEventListener('change', async () => {
      const enabling = input.checked;
      try {
        if (enabling) { requireConsent(); await permission(hostPattern(site.origin)); }
        await save({ site: { origin: site.origin, enabled: enabling }, consentVersion: 1 });
        if (!enabling) await chrome.permissions.remove({ origins: [hostPattern(site.origin)] });
      } catch (err) { input.checked = !enabling; error(err); }
    });
    label.append(text, input); $('sites').append(label);
  }
}
async function refresh() {
  state = await send('ALONG_STATE');
  const { settings: config, connection } = state;
  if (!config.consentVersion) setupOpen = true;
  $('setup').hidden = !setupOpen;
  $('settings-toggle').setAttribute('aria-expanded', String(setupOpen));
  if (!backendDirty && document.activeElement !== $('backend')) $('backend').value = config.backendOrigin;
  $('consent').checked = config.consentVersion === 1;
  $('demo').checked = config.demo; $('visual').checked = config.visual;
  $('demo-site').hidden = !config.demo;
  $('demo-site').textContent = config.enabledOrigins.includes(config.backendOrigin) ? 'Open local demo page ↗' : 'Enable local demo page';
  $('connection-dot').classList.toggle('on', Boolean(connection));
  $('connection-label').textContent = connection ? 'Your conversation is connected' : 'Connect your conversation';
  $('connection-copy').textContent = connection ? 'Discoveries return to this Along session. No second chatbot.' : 'Use the Along conversation you already have.';
  $('connect').hidden = Boolean(connection); $('disconnect').hidden = !connection;
  $('mode-pill').hidden = !connection; $('mode-pill').textContent = config.demo ? 'demo' : connection?.mode || ''; $('mode-pill').classList.toggle('demo', config.demo);
  $('pause').textContent = config.paused ? 'Resume' : 'Pause'; $('pause').setAttribute('aria-pressed', String(config.paused));
  $('scan-state').textContent = config.paused ? 'Paused. Your pages are not being observed.' : !connection ? 'Connect Along to begin discovering.' : config.enabledOrigins.length ? `${config.enabledOrigins.length} enabled site${config.enabledOrigins.length === 1 ? '' : 's'} · quiet, automatic discovery` : 'Enable a site in settings to get started.';
  $('vision-status').textContent = !config.visual ? 'Visual mode is off.' : connection?.visionAvailable ? 'Vision is available on your Along server.' : 'Waiting for a connected server with vision available. No screenshots are being uploaded.';
  $('notice').hidden = !state.notice; $('notice').textContent = state.notice;
  renderSites(); renderResults();
}
$('settings-toggle').addEventListener('click', () => { setupOpen = !setupOpen; $('setup').hidden = !setupOpen; $('settings-toggle').setAttribute('aria-expanded', String(setupOpen)); });
$('backend').addEventListener('input', () => { backendDirty = true; });
$('consent').addEventListener('change', async () => {
  try {
    if ($('consent').checked) await save({ consentVersion: 1 });
    else await save({ consentVersion: 0, paused: true, visual: false, enabledOrigins: [] });
  } catch (err) { error(err); }
});
$('connect').addEventListener('click', async () => {
  try { const origin = backendOrigin($('backend').value); await permission(hostPattern(origin)); await save({ backendOrigin: origin }); backendDirty = false; await send('ALONG_CONNECT'); } catch (err) { error(err); }
});
$('save-backend').addEventListener('click', async () => {
  try { const origin = backendOrigin($('backend').value); await permission(hostPattern(origin)); await save({ backendOrigin: origin }); backendDirty = false; } catch (err) { error(err); }
});
$('disconnect').addEventListener('click', async () => { try { await send('ALONG_DISCONNECT'); await refresh(); } catch (err) { error(err); } });
$('pause').addEventListener('click', async () => { try { await save({ paused: !state.settings.paused }); } catch (err) { error(err); } });
$('clear').addEventListener('click', async () => { try { await send('ALONG_CLEAR'); await refresh(); } catch (err) { error(err); } });
$('demo').addEventListener('change', async () => { try { await save({ demo: $('demo').checked }); } catch (err) { $('demo').checked = !$('demo').checked; error(err); } });
$('visual').addEventListener('change', async () => {
  const visual = $('visual').checked;
  try {
    if (visual) { requireConsent(); await permission('<all_urls>'); }
    await save({ visual, consentVersion: 1 });
    if (!visual) await chrome.permissions.remove({ origins: ['<all_urls>'] });
  } catch (err) { $('visual').checked = !visual; error(err); }
});
$('demo-site').addEventListener('click', async () => {
  try {
    requireConsent();
    const origin = state.settings.backendOrigin;
    await permission(hostPattern(origin));
    await save({ site: { origin, enabled: true }, consentVersion: 1 });
    await chrome.tabs.create({ url: `${origin}/extension-demo` });
  } catch (err) { error(err); }
});
chrome.runtime.onMessage.addListener(message => { if (message.type === 'ALONG_UPDATED') refresh().catch(error); });
refresh().catch(error);
send('ALONG_REFRESH').then(refresh).catch(() => {});
setInterval(() => { if (document.visibilityState === 'visible') refresh().catch(() => {}); }, 30000);
