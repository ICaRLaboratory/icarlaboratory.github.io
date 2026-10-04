import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('Home actions localize without replacing links or duplicating the founding year', async () => {
  const server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: ['ignore', 'pipe', 'ignore'],
  });
  let browser;
  try {
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 10000);
      let output = '';
      server.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/Serving HTTP on .* port (\d+)/);
        if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
      });
      server.on('error', error => { clearTimeout(timeout); reject(error); });
    });
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    browser = await chromium.launch({ headless: true });
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await page.goto(`${base}/index.html?lang=ko`);
      await page.evaluate(() => { window.homeLinks = [...document.querySelectorAll('main a.btn')]; });
      for (const lang of ['ko', 'en', 'ko']) {
        await page.locator(`[data-lang="${lang}"]`).click();
        const expected = lang === 'ko' ? ['연구 분야 보기', '연구실 구성원', '전체 논문 보기'] : ['Explore the research', 'Meet the lab', 'See all'];
        assert.deepEqual((await page.locator('main a.btn').allTextContents()).map(s => s.trim()), expected);
        assert.deepEqual(await page.locator('main a.btn').evaluateAll(nodes => nodes.map(n => n.getAttribute('href'))), ['research.html', 'members.html', 'publications.html']);
        assert.deepEqual(await page.locator('.cta-row a.btn').evaluateAll(nodes => nodes.map(n => n.querySelector('svg path')?.getAttribute('d'))), ['M5 12h14M13 6l6 6-6 6', 'M5 12h14M13 6l6 6-6 6'], 'Both hero navigation buttons show the same right arrow');
        assert.equal(await page.evaluate(() => homeLinks.every((n, i) => n === document.querySelectorAll('main a.btn')[i])), true);
        assert.match(await page.locator('.hero__meta').innerText(), lang === 'ko' ? /교수 연구실.*대양 AI센터 526호/ : /Faculty office.*Room 526, Daeyang AI Center/i);
        assert.doesNotMatch(await page.locator('.hero__meta').innerText(), /2019/);
        assert.match(await page.locator('.hero__affiliation').innerText(), /2019/);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator('.hero__meta, main a.btn').evaluateAll(nodes => nodes.every(n => {
          const r = n.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1;
        })), true, `No clipped controls at ${width}px ${lang}`);
      }
      await page.reload();
      assert.equal((await page.locator('.cta-row a').first().innerText()).trim(), '연구 분야 보기');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser?.close(); server.kill(); }
});
