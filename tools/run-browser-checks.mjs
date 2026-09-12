#!/usr/bin/env node
// Development-only: PLAYWRIGHT_MODULE points to a temporary install's index.mjs.
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { runLightboxChecks } from '../tests/lightbox-interactions.mjs';
import { runLanguageChecks } from '../tests/language-interactions.mjs';
import { runMenuChecks } from '../tests/menu-interactions.mjs';
import { runSimKeyboardChecks } from '../tests/sim-keyboard-interactions.mjs';
import { runSimStateChecks } from '../tests/sim-state-interactions.mjs';
import { runPublicationChecks } from '../tests/publication-interactions.mjs';
import { runPublicationLayoutChecks } from '../tests/publication-layout-interactions.mjs';
import { runResearchChecks } from '../tests/research-interactions.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.PYTHON || 'python3';
const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(resolve(modulePath)).href : 'playwright');
const controller = new AbortController();
const { signal } = controller;
const interrupt = () => controller.abort(new Error('Browser checks interrupted'));
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);
const deadline = setTimeout(() => controller.abort(new Error('Browser checks exceeded 180 seconds')), 180_000);
let browser;
let server;
let serverLog = '';
let serverError;
let serverClosed;

async function run() {
  // Bind port 0 in Python itself: no free-port probe/rebind race or fixed-port collision.
  server = spawn(python, ['-u', '-c', [
    'from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler',
    "server = ThreadingHTTPServer(('127.0.0.1', 0), SimpleHTTPRequestHandler)",
    "print('READY_PORT=' + str(server.server_port), flush=True)",
    'server.serve_forever()',
  ].join('\n')], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  serverClosed = new Promise(resolve => server.once('close', resolve));
  server.on('error', error => { serverError = error; });
  for (const stream of [server.stdout, server.stderr]) {
    stream.on('data', chunk => { serverLog = (serverLog + chunk).slice(-32_768); });
  }
  const startupDeadline = Date.now() + 10_000;
  let base;
  while (!base) {
    signal.throwIfAborted();
    if (serverError) throw serverError;
    if (server.exitCode !== null || server.signalCode !== null) throw new Error('HTTP server exited before readiness');
    if (Date.now() > startupDeadline) throw new Error('HTTP server was not ready within 10 seconds');
    const match = serverLog.match(/^READY_PORT=(\d+)$/m);
    if (match) {
      const candidate = `http://127.0.0.1:${match[1]}`;
      const response = await fetch(`${candidate}/tests/browser-checks.html`, { signal });
      if (!response.ok) throw new Error(`Harness readiness returned HTTP ${response.status}`);
      await response.text();
      base = candidate;
    } else {
      await delay(50, undefined, { signal });
    }
  }
  console.log(`Serving browser harness at ${base}/tests/browser-checks.html`);
  browser = await chromium.launch({ headless: true, timeout: 20_000 });
  signal.throwIfAborted();
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    // Only this repository's own console errors are this repository's problem.
    // The contact page embeds a map, which is the site's one request to
    // somewhere else, and a five hundred from that somewhere else says
    // nothing about the code here -- but it used to fail the run, because
    // the response listener below skips other origins and this one did not.
    // A message with no location keeps counting: that is our own script.
    const from = message.location()?.url || '';
    if (from && !from.startsWith(base + '/')) return;
    errors.push(`console: ${message.text()}`);
  });
  page.on('response', response => {
    if (response.url().startsWith(base + '/') && response.status() >= 400) {
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
  const response = await page.goto(`${base}/tests/browser-checks.html`, { waitUntil: 'load', timeout: 20_000 });
  if (!response?.ok()) throw new Error('Browser could not load the test harness');
  await page.waitForFunction(() => window.testsDone === true, { }, { timeout: 60_000 });
  const results = await page.evaluate(() => window.testResults);
  if (!Array.isArray(results) || results.length === 0) throw new Error('Harness returned no test results');
  results.push(...await runLightboxChecks(browser, base));
  results.push(...await runLanguageChecks(browser, base));
  results.push(...await runMenuChecks(browser, base));
  results.push(...await runSimKeyboardChecks(browser, base));
  results.push(...await runSimStateChecks(browser, base));
  results.push(...await runPublicationChecks(browser, base));
  results.push(...await runPublicationLayoutChecks(browser, base));
  results.push(...await runResearchChecks(browser, base));
  for (const result of results) {
    console.log(`${result?.pass === true ? 'PASS' : 'FAIL'} ${result?.name}${result?.error ? ': ' + result.error : ''}`);
  }
  const failed = results.filter(result => result?.pass !== true);
  console.log(`Browser checks: ${results.length - failed.length}/${results.length} passed`);
  if (errors.length) console.error(errors.join('\n'));
  if (failed.length || errors.length) throw new Error(`${failed.length} failed assertions; ${errors.length} browser errors`);
}

const task = run();
try {
  const interrupted = new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  await Promise.race([task, interrupted]);
} catch (error) {
  console.error(error.stack || String(error));
  if (serverLog) console.error('HTTP server log:\n' + serverLog);
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  // Always stop Python, even when browser launch, readiness, or assertions fail.
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    const forceKill = setTimeout(() => server.kill('SIGKILL'), 2_000);
    await serverClosed;
    clearTimeout(forceKill);
  }
  await browser?.close();
  await task.catch(() => {});
  // A launch already in flight during interruption must also be cleaned up.
  await browser?.close();
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', interrupt);
}
