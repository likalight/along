import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/core.js';

test('the real worker does not send a social caption when visual capture is missing or rejected', async () => {
  const originalChrome = globalThis.chrome, originalFetch = globalThis.fetch;
  const origin = 'https://www.instagram.com', source = `${origin}/p/test-photo/`;
  const session = { connection: { token: 'test', sessionId: 'session', epoch: 1, expiresAt: Date.now() + 60000, mode: 'live', visionAvailable: true } };
  const local = { settings: { ...DEFAULTS, consentVersion: 1, visual: true, enabledOrigins: [origin] } };
  const storage = state => ({
    setAccessLevel: async () => {},
    get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, state[key]])),
    set: async patch => Object.assign(state, patch),
    remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key]; },
  });
  let listener, captureReply = { media: null }, screenshotCalls = 0;
  const actions = [];
  globalThis.chrome = {
    runtime: { id: 'test-extension', getURL: path => `chrome-extension://test-extension/${path}`, sendMessage: async () => {}, onMessage: { addListener: callback => { listener = callback; } }, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
    storage: { session: storage(session), local: storage(local) },
    permissions: { contains: async () => true, onRemoved: { addListener() {} } },
    tabs: { get: async () => ({ id: 1, active: true, windowId: 1, url: source }), query: async () => [], sendMessage: async () => captureReply, captureVisibleTab: async () => { screenshotCalls++; throw new Error('No capture should occur'); } },
    windows: { get: async () => ({ focused: true }) },
  };
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body); actions.push(body.action);
    if (body.action !== 'status') throw new Error('A rejected visual capture must not call discovery');
    return Response.json({ mode: 'live', visionAvailable: true, sessionId: 'session', epoch: 1 });
  };
  try {
    await import('../src/worker.js');
    const observe = media => new Promise(resolve => listener({ type: 'ALONG_OBSERVE', observation: { pageUrl: source, title: 'Generic video caption', kind: 'post' }, media, dwellMs: 6000, visible: true }, { id: 'test-extension', frameId: 0, url: source, origin, tab: { id: 1 } }, resolve));
    assert.deepEqual(await observe(null), { skipped: true });
    assert.deepEqual(await observe({ kind: 'photo', identity: '1:abc' }), { skipped: true });
    captureReply = { media: { kind: 'photo', identity: '1:changed' } };
    assert.deepEqual(await observe({ kind: 'photo', identity: '1:abc' }), { skipped: true });
    assert.equal(screenshotCalls, 0);
    assert.deepEqual(actions, ['status']);
  } finally { globalThis.chrome = originalChrome; globalThis.fetch = originalFetch; }
});
