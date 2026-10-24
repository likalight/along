import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, backendOrigin, sourceAllowed, normalizeObservation, shouldObserve, cropRectangle, validCandidates, publicConnection, expiresAtMs, fingerprint, createSerialQueue } from '../src/core.js';
import '../src/detection.js';
const D = globalThis.AlongDetection;
const enabled = { ...DEFAULTS, consentVersion: 1, enabledOrigins: ['https://www.amazon.com', 'https://www.instagram.com', 'https://www.tiktok.com'] };
test('only HTTPS or explicit local app addresses can receive credentials', () => {
  assert.equal(backendOrigin('http://127.0.0.1:4324/path'), 'http://127.0.0.1:4324');
  assert.equal(backendOrigin('https://along.example/app'), 'https://along.example');
  for (const url of ['http://evil.test', 'https://user:password@example.com', 'javascript:alert(1)', 'file:///tmp/a']) assert.throws(() => backendOrigin(url));
});
test('site permission is exact and excludes private/account/checkout surfaces', () => {
  assert.equal(sourceAllowed('https://www.amazon.com/dp/B00EXAMPLE', enabled), true);
  for (const url of ['https://www.amazon.com.evil.test/dp/1', 'https://www.amazon.com/checkout', 'https://www.amazon.com/cart/', 'https://www.amazon.com/gp/buy/spc/handlers/display.html', 'https://www.instagram.com/direct/inbox/', 'https://www.tiktok.com/messages', 'https://www.instagram.com/accounts/edit/']) assert.equal(sourceAllowed(url, enabled), false, url);
  assert.equal(sourceAllowed('https://www.instagram.com/reel/123/', enabled), true);
  assert.equal(sourceAllowed('https://www.instagram.com/', enabled), true);
});
test('local fixture permission never enables observation of the actual conversation', () => {
  const config = { ...enabled, demo: true, enabledOrigins: [DEFAULTS.backendOrigin] };
  assert.equal(sourceAllowed(`${DEFAULTS.backendOrigin}/extension-demo`, config), true);
  assert.equal(sourceAllowed(`${DEFAULTS.backendOrigin}/`, config), false);
  assert.equal(sourceAllowed(`${DEFAULTS.backendOrigin}/extension-demo`, { ...config, demo: false }), false);
});
test('observation must be bound to the sender URL and cannot carry extra fields', () => {
  const source = 'https://www.amazon.com/dp/1';
  const input = { pageUrl: source, title: '  A bag\n title ', kind: 'product', text: 'a'.repeat(5000), token: 'secret', imageDataUrl: 'untrusted' };
  const result = normalizeObservation(input, source);
  assert.equal(result.title, 'A bag title'); assert.equal(result.text.length, 1800); assert.equal(result.token, undefined); assert.equal(result.imageDataUrl, undefined);
  assert.equal(normalizeObservation(input, `${source}2`), null);
  assert.equal(normalizeObservation({ ...input, kind: 'password' }, source), null);
});
test('automatic detection requires consent, foreground focus, dwell, fresh content and cooldown', () => {
  const input = { settings: enabled, url: 'https://www.amazon.com/dp/1', dwellMs: 5000, visible: true, focused: true, now: 100000, lastAt: 0 };
  assert.equal(shouldObserve(input), true);
  for (const change of [{ dwellMs: 4999 }, { visible: false }, { focused: false }, { duplicate: true }, { lastAt: 99999 }, { settings: { ...enabled, paused: true } }, { settings: { ...enabled, consentVersion: 0 } }, { url: 'https://unsupported.example/' }]) assert.equal(shouldObserve({ ...input, ...change }), false);
});
test('video crop clips to viewport and accounts for device pixel ratio', () => {
  assert.deepEqual(cropRectangle({ x: -10, y: 20, width: 210, height: 120 }, { width: 300, height: 200 }, { width: 600, height: 400 }), { x: 0, y: 40, width: 400, height: 240 });
  assert.equal(cropRectangle({ x: 290, y: 0, width: 200, height: 200 }, { width: 300, height: 200 }, { width: 600, height: 400 }), null);
  assert.equal(cropRectangle({ x: NaN, y: 0, width: 200, height: 200 }, { width: 300, height: 200 }, { width: 600, height: 400 }), null);
});
test('demo fixtures cannot leak into live-only UI and unsafe destinations are dropped', () => {
  const candidate = { id: 'bag', title: 'Bag', url: 'https://www.coupang.com/vp/products/1', match: 'similar' };
  assert.equal(validCandidates({ mode: 'demo', candidates: [candidate] }, false).length, 0);
  assert.equal(validCandidates({ mode: 'demo', candidates: [candidate] }, true).length, 1);
  assert.equal(validCandidates({ mode: 'live', candidates: [candidate, { ...candidate, url: 'javascript:alert(1)' }] }, false).length, 1);
});
test('public pairing status never includes the bearer credential', () => {
  const result = publicConnection({ token: 'secret', sessionId: 's', epoch: 2, expiresAt: 123, mode: 'live', visionAvailable: true, privateKey: 'no' });
  assert.equal(result.token, undefined); assert.equal(result.privateKey, undefined); assert.equal(result.sessionId, 's');
  assert.equal(expiresAtMs(1700000000), 1700000000000);
});
test('extracts product graphs while avoiding unrelated schema objects', () => {
  const result = D.productFromJsonLd({ '@graph': [{ '@type': 'Person', name: 'Not a product' }, { '@type': ['Thing', 'Product'], name: 'Transit pack', brand: { name: 'Test' }, description: '<b>20 litres</b>', offers: { price: 79, priceCurrency: 'USD' } }] });
  assert.equal(result.title, 'Transit pack'); assert.match(result.text, /20 litres/); assert.doesNotMatch(result.text, /<b>/);
  assert.equal(D.productFromJsonLd({ '@type': 'Organization', name: 'Store' }), null);
  const cyclic = {}; cyclic.mainEntity = cyclic; assert.equal(D.productFromJsonLd(cyclic), null);
});
test('visibility area ignores offscreen content and fingerprints distinguish new posts', () => {
  assert.equal(D.visibleArea({ left: 400, right: 500, top: 0, bottom: 100 }, { width: 300, height: 200 }), 0);
  assert.notEqual(fingerprint({ pageUrl: 'https://x.test', title: 'A', text: 'one' }), fingerprint({ pageUrl: 'https://x.test', title: 'A', text: 'two' }));
});
test('capture guard geometry excludes overlapping private controls and changed posts', () => {
  const video = { left: 10, top: 20, right: 400, bottom: 500 };
  assert.equal(D.intersects(video, { left: 100, top: 100, right: 300, bottom: 150 }), true);
  assert.equal(D.intersects(video, { left: 10, top: 0, right: 400, bottom: 19 }), false);
  const before = { pageUrl: 'https://www.tiktok.com/', kind: 'video', title: 'Blue bag', text: 'Model A' };
  assert.equal(D.sameObservation(before, { ...before }), true);
  assert.equal(D.sameObservation(before, { ...before, text: 'Model B' }), false);
  assert.equal(D.sameObservation(before, { ...before, pageUrl: `${before.pageUrl}other` }), false);
});
test('overlapping settings updates preserve both changes and failed reconciliation does not block later work', async () => {
  const settingsQueue = createSerialQueue(), scriptsQueue = createSerialQueue();
  let settings = { sites: [] }, active = 0, maximumActive = 0;
  const reconcile = () => scriptsQueue(async () => { maximumActive = Math.max(maximumActive, ++active); await new Promise(resolve => setTimeout(resolve, 1)); active--; });
  const enable = site => settingsQueue(async () => {
    const snapshot = settings;
    await new Promise(resolve => setTimeout(resolve, 1));
    settings = { sites: [...snapshot.sites, site] };
    await reconcile();
  });
  await Promise.all([enable('amazon'), enable('tiktok'), reconcile()]);
  assert.deepEqual(settings.sites, ['amazon', 'tiktok']); assert.equal(maximumActive, 1);
  await assert.rejects(settingsQueue(() => { throw new Error('permission revoked'); }));
  await enable('youtube'); assert.deepEqual(settings.sites, ['amazon', 'tiktok', 'youtube']);
});
