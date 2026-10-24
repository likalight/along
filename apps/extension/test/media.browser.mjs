// Run after installing Playwright Chromium: node --test apps/extension/test/media.browser.mjs
// CHROME_PATH may point at an existing test Chromium binary. No live site/provider is contacted.
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const detection = await readFile(new URL('../src/detection.js', import.meta.url), 'utf8');
const content = await readFile(new URL('../src/content.js', import.meta.url), 'utf8');
const image = color => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="500" height="500" fill="${color}"/></svg>`)}`;
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH }); });
after(async () => { await browser?.close(); });

async function fixture(markup) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `<style>body{margin:50px}article{display:inline-block;vertical-align:top;margin-right:30px}img.main,video{width:500px;height:500px;display:block}h1{font:20px sans-serif}</style>${markup}` }));
  await page.goto('https://www.instagram.com/p/test-photo/');
  await page.bringToFront();
  await page.waitForFunction(() => [...document.images].every(img => img.complete));
  await page.clock.install();
  await page.evaluate(() => {
    globalThis.__observations = [];
    globalThis.chrome = { runtime: {
      id: 'test-extension',
      onMessage: { addListener: handler => { globalThis.__alongListener = handler; } },
      sendMessage: async message => {
        if (message.type === 'ALONG_HELLO') return { enabled: true, connected: true, visual: true, visionAvailable: true, demo: false };
        if (message.type === 'ALONG_OBSERVE') { globalThis.__observations.push(message); return { ok: true }; }
        return {};
      },
    } };
    globalThis.__check = (message, type = 'ALONG_CAPTURE_CHECK') => {
      let result;
      globalThis.__alongListener({ type, observation: message.observation, mediaIdentity: message.media?.identity }, { id: 'test-extension' }, reply => { result = reply; });
      return result;
    };
  });
  await page.addScriptTag({ content: detection });
  await page.addScriptTag({ content });
  await page.clock.runFor(6100);
  return { page, close: () => context.close() };
}

test('a main post photo is captured, deduplicated and invalidated when a carousel changes', async () => {
  const { page, close } = await fixture(`<article><h1 data-along-post-caption>My blue everyday bag</h1><img class="main" alt="Blue tote bag" src="${image('blue')}"></article>`);
  try {
    const first = await page.evaluate(() => globalThis.__observations[0]);
    assert.equal(first.observation.kind, 'post');
    assert.equal(first.media.kind, 'photo');
    assert.equal(await page.evaluate(() => globalThis.__check(globalThis.__observations[0]).media.kind), 'photo');
    await page.clock.runFor(60000);
    assert.equal(await page.evaluate(() => globalThis.__observations.length), 1);
    await page.locator('img.main').evaluate((img, src) => { img.src = src; }, image('red'));
    await page.waitForFunction(() => document.querySelector('img.main').complete);
    assert.equal(await page.evaluate(() => globalThis.__check(globalThis.__observations[0]).media), null);
    assert.equal(await page.evaluate(() => globalThis.__check(globalThis.__observations[0], 'ALONG_OBSERVATION_CHECK').same), false);
    await page.clock.runFor(7000);
    const second = await page.evaluate(() => globalThis.__observations.at(-1));
    assert.notEqual(first.media.identity, second.media.identity);
  } finally { await close(); }
});

test('private controls, modal dialogs and opaque overlays invalidate a photo crop', async () => {
  const { page, close } = await fixture(`<article><h1 data-along-post-caption>My blue everyday bag</h1><img class="main" alt="Blue tote bag" src="${image('blue')}"></article>`);
  try {
    for (const markup of ['<input value="private">', '<div role="dialog">Private dialog</div>', '<div>Unrelated overlay</div>']) {
      await page.evaluate(markup => { const overlay = document.createElement('div'); overlay.id = 'overlay'; overlay.innerHTML = markup; overlay.style.cssText = 'position:fixed;left:200px;top:250px;width:250px;height:150px;background:white;z-index:1000'; overlay.firstElementChild.style.cssText = 'width:100%;height:100%'; document.body.append(overlay); }, markup);
      assert.equal(await page.evaluate(() => globalThis.__check(globalThis.__observations[0]).media), null);
      await page.locator('#overlay').evaluate(element => element.remove());
    }
    assert.equal(await page.evaluate(() => globalThis.__check(globalThis.__observations[0]).media.kind), 'photo');
  } finally { await close(); }
});

test('small corner popovers and pointer-transparent overlays block the crop', async () => {
  const { page, close } = await fixture(`<article><h1 data-along-post-caption>My blue everyday bag</h1><img class="main" alt="Blue tote bag" src="${image('blue')}"></article>`);
  try {
    for (const pointerEvents of ['auto', 'none']) {
      await page.evaluate(pointerEvents => {
        const box = document.querySelector('img.main').getBoundingClientRect();
        const overlay = document.createElement('div'); overlay.id = 'private-corner';
        overlay.textContent = 'Private DM';
        overlay.style.cssText = `position:fixed;left:${box.left + 8}px;top:${box.top + 2}px;width:90px;height:25px;background:white;z-index:1000;pointer-events:${pointerEvents}`;
        document.body.append(overlay);
      }, pointerEvents);
      assert.equal(await page.evaluate(() => globalThis.__check(globalThis.__observations[0]).media), null);
      await page.locator('#private-corner').evaluate(element => element.remove());
    }
    assert.equal(await page.evaluate(() => globalThis.__check(globalThis.__observations[0]).media.kind), 'photo');
  } finally { await close(); }
});

test('avatars and two competing main post photos never become a visual crop', async () => {
  const avatar = await fixture(`<article><h1 data-along-post-caption>My everyday bag</h1><img class="main" alt="Profile picture" src="${image('blue')}"></article>`);
  try { assert.equal(await avatar.page.evaluate(() => globalThis.__observations[0].media), null); } finally { await avatar.close(); }
  const competing = await fixture(`<article><h1 data-along-post-caption>My everyday bag</h1><img class="main" alt="Blue tote bag" src="${image('blue')}"></article><article><h1 data-along-post-caption>A different outfit</h1><img class="main" alt="Red bag" src="${image('red')}"></article>`);
  try { assert.equal(await competing.page.evaluate(() => globalThis.__observations.length), 0); } finally { await competing.close(); }
});

test('a single video keeps frame capture support and carries a media identity', async () => {
  const { page, close } = await fixture('<article><h1 data-along-post-caption>My blue everyday bag</h1><video></video></article>');
  try {
    assert.equal(await page.evaluate(() => globalThis.__observations[0].observation.kind), 'video');
    assert.equal(await page.evaluate(() => globalThis.__check(globalThis.__observations[0]).media.kind), 'video');
  } finally { await close(); }
});
