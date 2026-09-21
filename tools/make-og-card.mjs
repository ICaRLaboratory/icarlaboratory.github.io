#!/usr/bin/env node
// Development-only: regenerate assets/img/og.jpg from tools/og-card.html.
// Uses the same temporary Playwright install as run-browser-checks.mjs:
//   PLAYWRIGHT_MODULE=<install>/node_modules/playwright/index.mjs \
//     node tools/make-og-card.mjs
// The page is opened under reduced motion, so the live hero figure
// draws a single warmed-up still frame; the 1200×630 stage is then
// screenshotted at 2x and saved as a JPEG.
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.PYTHON || 'python3';
const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(resolve(modulePath)).href : 'playwright');

// Bind port 0 in Python itself: no free-port probe/rebind race.
const server = spawn(python, ['-u', '-c', [
  'from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler',
  "server = ThreadingHTTPServer(('127.0.0.1', 0), SimpleHTTPRequestHandler)",
  "print('READY_PORT=' + str(server.server_port), flush=True)",
  'server.serve_forever()',
].join('\n')], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });

const port = await new Promise((resolvePort, reject) => {
  let buffer = '';
  const timer = setTimeout(() => reject(new Error('Server start timed out')), 10_000);
  server.stdout.on('data', (chunk) => {
    buffer += chunk;
    const m = /READY_PORT=(\d+)/.exec(buffer);
    if (m) { clearTimeout(timer); resolvePort(+m[1]); }
  });
  server.once('close', () => reject(new Error('Server exited early')));
});

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 700 },
    deviceScaleFactor: 2,          // crisp canvas and text at 1200×630
    reducedMotion: 'reduce',       // hero.js draws one warmed-up frame
  });
  page.on('pageerror', (e) => { throw e; });
  await page.goto(`http://127.0.0.1:${port}/tools/og-card.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // One settle pass: fonts arriving can reflow the copy column.
  await page.waitForTimeout(300);

  const stage = page.locator('#stage');
  const box = await stage.boundingBox();
  if (!box || Math.round(box.width) !== 1200 || Math.round(box.height) !== 630) {
    throw new Error(`Stage is ${box && box.width}×${box && box.height}, expected 1200×630`);
  }
  const canvasDrawn = await page.evaluate(() => {
    const c = document.getElementById('herofig');
    return c && c.width > 0 && c.height > 0;
  });
  if (!canvasDrawn) throw new Error('Hero canvas did not draw');

  const out = resolve(root, 'assets/img/og.jpg');
  await stage.screenshot({ path: out, type: 'jpeg', quality: 88 });
  console.log(`Wrote ${out}`);
} finally {
  if (browser) await browser.close();
  server.kill();
}
