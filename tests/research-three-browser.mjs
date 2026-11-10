#!/usr/bin/env node
// Development-only. Uses an OS-assigned port and a real WebGL2 renderer.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { runSimStateChecks } from './sim-state-interactions.mjs';
import { runSimKeyboardChecks } from './sim-keyboard-interactions.mjs';

export async function runResearchThreeChecks(browser, base, screenshotDir) {
  const results = [], errors = [];
  const originalCanvas = new Map();
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(String(error)));
  page.setDefaultTimeout(10000);
  await page.addInitScript(() => {
    const nativeRequest = window.requestAnimationFrame.bind(window);
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    const frames = new Map();
    let next = -1;
    window.requestAnimationFrame = fn => {
      if (fn.name !== 'frame') return nativeRequest(fn);
      const id = next--; frames.set(id, fn); return id;
    };
    window.cancelAnimationFrame = id => { if (!frames.delete(id)) nativeCancel(id); };
    window.__researchClock = {
      pending: () => frames.size,
      tick(n = 1) {
        for (let i = 0; i < n; i++) for (const [id, fn] of [...frames]) {
          if (frames.delete(id)) fn();
        }
      },
    };
  });
  await page.route('**/assets/sim.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
;(() => {
  window.__researchDefs = {}; window.__researchParams = {};
  const register = SIM.register;
  SIM.register = def => {
    window.__researchDefs[def.id] = def;
    const reset = def.reset;
    def.reset = P => { window.__researchParams[def.id] = P; return reset(P); };
    register(def);
  };
})();` });
  });
  await page.route('**/assets/sim-arm-plant.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
;(() => {
  const integrate = ARMPLANT.integrate;
  ARMPLANT.integrate = (state, ...args) => {
    window.__researchTrackingState = state;
    return integrate(state, ...args);
  };
})();` });
  });
  await page.route('**/assets/three/view.js', async route => {
    const response = await route.fetch();
    const code = await response.text();
    const marker = 'return {update, render, resize: render, dispose, setLanguage, canvas, element};';
    assert(code.includes(marker), 'shared view test instrumentation marker');
    await route.fulfill({ response, body: code.replace(marker, `
      const view = {update, render, resize: render, dispose, setLanguage, canvas, element};
      window.__researchViews ||= {};
      window.__researchViews[host.closest('.simpanel').id.replace('simpanel-', '')] = {view, model, renderer, camera};
      return view;`) });
  });
  async function check(name, fn) {
    try { await fn(); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: error.stack }); }
  }
  try {
    await page.goto(`${base}/research.html?lang=en`, { waitUntil: 'load' });
    for (const id of ['track', 'contact']) {
      await check(`${id}: genuine WebGL2 apparatus with the original graph canvas retained`, async () => {
        await page.locator(`#simtab-${id}`).click();
        await page.waitForFunction(id => document.querySelector(`#simpanel-${id} .research-three canvas`), id);
        const report = await page.locator(`#simpanel-${id} .sim__fig`).evaluate(fig => {
          const canvas = fig.querySelector('.research-three canvas');
          const gl = canvas.getContext('webgl2');
          return { gpu: gl instanceof WebGL2RenderingContext, version: gl?.getParameter(gl.VERSION),
            graphs: !!fig.querySelector(':scope > canvas')?.getContext('2d'),
            canvasCount: fig.querySelectorAll('canvas').length,
            pixels: canvas.width * canvas.height };
        });
        assert.equal(report.gpu, true);
        assert.match(report.version, /WebGL 2/);
        assert.equal(report.graphs, true);
        assert.equal(report.canvasCount, 2);
        assert(report.pixels > 10000);
        assert.equal(await page.locator(`#sim-${id}-play`).textContent(), 'Replay');
        assert.equal(await page.evaluate(id => window.__researchViews[id].renderer.isWebGLRenderer, id), true);
        await page.evaluate(() => document.fonts.ready);
        originalCanvas.set(id, await page.locator(`#simpanel-${id} .sim__fig > canvas`).evaluate(c => c.toDataURL()));
        if (screenshotDir) {
          await mkdir(screenshotDir, { recursive: true });
          await page.locator(`#simpanel-${id} .sim`).screenshot({ path: resolve(screenshotDir, `${id}-desktop-en.png`) });
        }
      });
    }
    for (const id of ['track', 'contact']) {
      await check(`${id}: actual frozen snapshot drives the articulated scene pose`, async () => {
        await page.locator(`#simtab-${id}`).click();
        const report = await page.evaluate(async id => {
          const T = await import('./assets/vendor/three.js');
          const { model } = window.__researchViews[id];
          const state = window.__researchDefs[id].visualState(window.__researchParams[id]);
          model.root.updateMatrixWorld(true);
          const tip = model.root.getObjectByName('tool-tip').getWorldPosition(new T.Vector3());
          return { state, tip: tip.toArray(), frozen: Object.isFrozen(state),
            shoulder: model.root.getObjectByName('shoulder')?.rotation.y,
            elbow: model.root.getObjectByName('elbow')?.rotation.y,
            scene: model.root.parent.isScene,
            meshes: (() => { let n = 0; model.root.traverse(o => { if (o.isMesh) n++; }); return n; })() };
        }, id);
        assert.equal(report.frozen, true);
        assert.equal(report.scene, true);
        assert(report.meshes > 20, 'solid articulated geometry, not a flat diagram');
        if (id === 'track') {
          const s = report.state;
          assert.equal(report.shoulder, -s.q[0]);
          assert.equal(report.elbow, -s.q[1]);
          assert(Math.abs(report.tip[0] - (s.lengths[0] * Math.cos(s.q[0]) + s.lengths[1] * Math.cos(s.q[0] + s.q[1]))) < 1e-12);
          assert(Math.abs(report.tip[2] - (s.lengths[0] * Math.sin(s.q[0]) + s.lengths[1] * Math.sin(s.q[0] + s.q[1]))) < 1e-12);
        } else {
          assert(Math.abs(report.tip[0] - (0.65 + 12 * Math.max(-0.03, Math.min(0.055, report.state.position)))) < 1e-12);
        }
      });
      await check(`${id}: default camera contains the whole robot and contact surface`, async () => {
        const outside = await page.evaluate(async id => {
          const T = await import('./assets/vendor/three.js');
          const { model, camera } = window.__researchViews[id];
          const names = id === 'track' ? ['robot-base', 'shoulder'] : ['robot-base', 'fixed-articulated-support', 'contact-wall', 'wall-backplate'];
          model.root.updateMatrixWorld(true);
          const outside = [];
          for (const name of names) {
            const b = new T.Box3().setFromObject(model.root.getObjectByName(name));
            for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
              const p = new T.Vector3(x, y, z).project(camera);
              if (Math.abs(p.x) > 0.99 || Math.abs(p.y) > 0.99) outside.push({ name, x: p.x, y: p.y });
            }
          }
          return outside;
        }, id);
        assert.deepEqual(outside, []);
      });
    }
    for (const [law, algo] of [['pd'], ['smc'], ['tdc'], ['asmc', 'quasi'], ['asmc', 'sigvar']]) {
      await check(`track ${law}${algo ? '/' + algo : ''}: completed GPU scene retains the exact unloaded comparison path and clears it on reset`, async () => {
        await page.locator('#simtab-track').click();
        await page.locator(`#sim-track-law [data-value=${law}]`).click();
        if (algo) await page.locator(`#sim-track-algo [data-value=${algo}]`).click();
        assert.equal(await page.locator('#sim-track-play').textContent(), 'Replay');
        const report = await page.evaluate(() => {
          const def = window.__researchDefs.track, P = window.__researchParams.track;
          const { view, model } = window.__researchViews.track;
          const state = def.visualState(P), saved = JSON.stringify(state);
          const hist = window.__researchTrackingState.hist, A = ARMPLANT;
          const cut = hist.length > A.TRAIL ? hist[hist.length - A.TRAIL][0] : 0;
          const points = rows => rows.map(row => A.fk([row[1], row[2]]));
          const unloadedPoints = points(hist.filter(row => row[0] >= 0 && row[0] <= A.T_LOAD));
          const recentPoints = points(hist.filter(row => row[0] >= Math.max(A.T_LOAD, cut)));
          const c = A.CIRCLE;
          const referencePoints = Array.from({ length: 129 }, (_, i) => ({
            x: c.x + c.r * Math.cos(i * 2 * Math.PI / 128),
            y: c.y + c.r * Math.sin(i * 2 * Math.PI / 128),
          }));
          const nodes = ['unloaded-trajectory', 'measured-trajectory', 'target-trajectory']
            .map(name => model.root.getObjectByName(name));
          const compare = (node, points, height) => {
            if (!node) return null;
            const position = node.geometry.getAttribute('position');
            const expected = new Float32Array(points.flatMap(p => [p.x, height, p.y]));
            return { count: position.count, expectedCount: points.length, visible: node.visible,
              exact: position.array.length === expected.length && expected.every((v, i) => v === position.array[i]),
              isLine: node.isLine, color: node.material.color.getHex(), dashed: !!node.material.isLineDashedMaterial };
          };
          const completed = nodes.map((node, i) => compare(node, [unloadedPoints, recentPoints, referencePoints][i], i === 2 ? 0.05 : 0.06));
          // Updating an already-rendered frozen snapshot is also read-only.
          view.update(state, P);
          const unchanged = JSON.stringify(state) === saved;
          def.reset(P);
          view.update(def.visualState(P), P);
          const reset = nodes.map(node => node ? { visible: node.visible, count: node.geometry.getAttribute('position').count } : null);
          def.advance(P, 1 / 60);
          view.update(def.visualState(P), P);
          const restarted = nodes.map(node => node ? { visible: node.visible, count: node.geometry.getAttribute('position').count } : null);
          return { completed, reset, restarted, done: state.time >= A.WINDOW, cut, load: A.T_LOAD,
            unique: new Set(nodes).size, legend: model.legend, unchanged: unchanged && JSON.stringify(state) === saved,
            frozen: Object.isFrozen(state) && Object.isFrozen(state.unloadedTrail) && state.unloadedTrail.every(Object.isFrozen) };
        });
        assert.equal(report.done, true);
        assert(report.cut > report.load, 'the first lap has left the rolling window');
        assert(report.completed[0], 'a separate unloaded measured Three.Line must exist');
        assert.equal(report.unique, 3);
        for (const [i, path] of report.completed.entries()) {
          assert.equal(path.isLine, true);
          assert.equal(path.visible, true);
          assert.equal(path.count, path.expectedCount);
          assert.equal(path.exact, true, `trace ${i} matches every original path point at Float32 GPU precision`);
        }
        const [unloaded, recent, reference] = report.completed;
        assert.equal(unloaded.color, 0x8596a5, 'gray unloaded measured path');
        assert.equal(recent.color, 0x087f74, 'teal recent loaded path');
        assert.notEqual(unloaded.color, reference.color);
        assert.deepEqual([unloaded.dashed, recent.dashed, reference.dashed], [false, false, true]);
        assert.match(report.legend.en, /gray: unloaded measured path/i);
        assert.match(report.legend.en, /teal: recent loaded path/i);
        assert.match(report.legend.ko, /회색: 무부하 실제 궤적/);
        assert.match(report.legend.ko, /청록: 최근 부하 궤적/);
        assert.equal(report.frozen, true);
        assert.equal(report.unchanged, true);
        assert.deepEqual(report.reset, [{ visible: false, count: 0 }, { visible: false, count: 0 }, { visible: true, count: reference.count }]);
        assert.deepEqual(report.restarted, [{ visible: false, count: 1 }, { visible: false, count: 0 }, { visible: true, count: reference.count }]);
      });
    }
    // Restore the real reduced-motion completed run before playback checks.
    await page.locator('#sim-track-law [data-value=pd]').click();
    const snapshot = id => page.evaluate(id => window.__researchDefs[id].visualState(window.__researchParams[id]), id);
    await check('contact: the default view shows the tool sensor, not the back of the wall', async () => {
      const visible = await page.evaluate(async () => {
        const T = await import('./assets/vendor/three.js');
        const { model, camera } = window.__researchViews.contact;
        model.root.updateMatrixWorld(true);
        const sensor = model.root.getObjectByName('force-sensor');
        const point = sensor.getWorldPosition(new T.Vector3());
        const direction = camera.getWorldDirection(new T.Vector3());
        const ray = new T.Raycaster(point.addScaledVector(direction, -10), direction);
        return ray.intersectObject(model.root, true).find(hit => hit.object.isMesh)?.object.name;
      });
      assert.equal(visible, 'force-sensor');
    });
    const tick = n => page.evaluate(n => window.__researchClock.tick(n), n);
    const pose = id => page.evaluate(async id => {
      const T = await import('./assets/vendor/three.js');
      const root = window.__researchViews[id].model.root;
      root.updateMatrixWorld(true);
      return root.getObjectByName('tool-tip').getWorldPosition(new T.Vector3()).toArray();
    }, id);
    for (const id of ['track', 'contact']) {
      await check(`${id}: Replay, Pause, tabs and all controller modes keep state-bound motion`, async () => {
        await page.locator(`#simtab-${id}`).click();
        await page.locator(`#sim-${id}-play`).click();
        await tick(1);
        const start = await snapshot(id), startPose = await pose(id);
        assert(start.time < 0.02, 'Replay starts the unchanged clock again');
        await tick(30);
        assert.notDeepEqual(await pose(id), startPose, 'GPU mesh actually moves with the simulation');
        await page.locator(`#sim-${id}-play`).click();
        const paused = await snapshot(id), pausedPose = await pose(id);
        await tick(3);
        assert.deepEqual(await snapshot(id), paused);
        assert.deepEqual(await pose(id), pausedPose);
        const other = id === 'track' ? 'contact' : 'track';
        await page.locator(`#simtab-${other}`).click();
        await page.locator(`#simtab-${id}`).click();
        assert.equal(await page.locator(`#sim-${id}-play`).textContent(), 'Play');
        assert.deepEqual(await snapshot(id), paused);
        const modes = id === 'track' ? ['pd', 'smc', 'tdc', 'asmc'] : ['admittance', 'impedance'];
        for (const mode of modes) {
          await page.locator(`#sim-${id}-${id === 'track' ? 'law' : 'mode'} [data-value=${mode}]`).click();
          await tick(3);
          assert((await snapshot(id)).time > 0);
          if (id === 'track' && mode === 'asmc') {
            for (const algo of ['quasi', 'sigvar']) {
              await page.locator(`#sim-track-algo [data-value=${algo}]`).click();
              await tick(3);
              assert((await snapshot(id)).q.every(Number.isFinite));
            }
          }
        }
        await page.locator(`#sim-${id}-play`).click();
      });
      await check(`${id}: shared camera orbit/reset changes only view, never physics or graphs`, async () => {
        const before = await snapshot(id);
        const canvas = page.locator(`#simpanel-${id} .research-three canvas`);
        const camera = () => page.evaluate(id => window.__researchViews[id].camera.position.toArray(), id);
        const initial = await camera();
        const image = await canvas.evaluate(c => c.toDataURL());
        const graph = await page.locator(`#simpanel-${id} .sim__fig > canvas`).evaluate(c => c.toDataURL());
        await canvas.focus();
        await page.keyboard.press('ArrowRight');
        assert.notDeepEqual(await camera(), initial);
        assert.notEqual(await canvas.evaluate(c => c.toDataURL()), image, 'real GPU pixels change after orbit');
        assert.deepEqual(await snapshot(id), before);
        assert.equal(await page.locator(`#simpanel-${id} .sim__fig > canvas`).evaluate(c => c.toDataURL()), graph);
        await page.locator(`#simpanel-${id} .three-reset`).click();
        assert.deepEqual(await camera(), initial);
        assert.deepEqual(await snapshot(id), before);
      });
    }
    for (const width of [320, 390, 620, 768, 1280]) for (const lang of ['ko', 'en']) {
      await check(`${width}px ${lang}: apparatus-only placement, localized camera UI and usable info`, async () => {
        await page.setViewportSize({ width, height: 960 });
        await page.locator(`[data-lang=${lang}]`).click();
        for (const id of ['track', 'contact']) {
          await page.locator(`#simtab-${id}`).click();
          await page.waitForFunction(id => {
            const fig = document.querySelector(`#simpanel-${id} .sim__fig`);
            const r = fig.querySelector(':scope > canvas').getBoundingClientRect();
            const v = fig.querySelector('.research-three').getBoundingClientRect();
            const D = r.width / r.height >= 1.1 ? { w: 780, h: 620 } : { w: 380, h: 1010 };
            const b = window.__researchDefs[id].visualBox(D), scale = Math.min(r.width / D.w, r.height / D.h);
            return Math.abs(v.width - b.w * scale) < 1 && Math.abs(v.height - b.h * scale) < 1 &&
              Math.abs(v.x - (r.left + (r.width - D.w * scale) / 2 + b.x * scale)) < 1 &&
              Math.abs(v.y - (r.top + (r.height - D.h * scale) / 2 + b.y * scale)) < 1;
          }, id);
          const measured = await page.locator(`#simpanel-${id} .sim__fig`).evaluate((fig, id) => {
            const canvas = fig.querySelector(':scope > canvas'), r = canvas.getBoundingClientRect();
            const host = fig.querySelector('.research-three'), v = host.getBoundingClientRect();
            const D = r.width / r.height >= 1.1 ? { w: 780, h: 620 } : { w: 380, h: 1010 };
            const b = window.__researchDefs[id].visualBox(D), scale = Math.min(r.width / D.w, r.height / D.h);
            return { expected: [r.left + (r.width - D.w * scale) / 2 + b.x * scale,
              r.top + (r.height - D.h * scale) / 2 + b.y * scale, b.w * scale, b.h * scale],
              actual: [v.x, v.y, v.width, v.height], graphTop: r.top + (D.w === 780 ? 330 : 460) * scale,
              bottom: v.bottom, right: v.right, lang: host.querySelector('.three-view').lang,
              canvasHeight: host.querySelector('canvas').getBoundingClientRect().height,
              resetHeight: host.querySelector('.three-reset').getBoundingClientRect().height };
          }, id);
          measured.actual.forEach((n, i) => assert(Math.abs(n - measured.expected[i]) < 1,
            `viewport follows original design units: ${JSON.stringify(measured)}`));
          assert(measured.bottom < measured.graphTop, 'no graph occlusion');
          assert(measured.right <= width, 'no page overflow');
          assert(measured.canvasHeight > 120, 'compact toolbar must not consume the scene');
          assert(measured.resetHeight >= 44);
          assert.equal(measured.lang, lang);
          assert.equal(await page.locator(`#simpanel-${id} .three-reset`).getAttribute('aria-label'), lang === 'en' ? 'Reset view' : '시점 초기화');
          assert.equal(await page.locator(`#simpanel-${id} .three-reset svg`).isVisible(), true);
          const summary = page.locator(`#simpanel-${id} .research-three__info > summary`);
          assert.equal(await summary.getAttribute('aria-label'), lang === 'en' ? 'Scene information' : '장치 설명');
          if (await summary.evaluate(s => s.parentElement.open)) await summary.click();
          await summary.click();
          assert.equal(await page.locator(`#simpanel-${id} .three-legend`).isVisible(), true);
          const info = await page.locator(`#simpanel-${id} .research-three__info-body`).boundingBox();
          // A native click may scroll a mobile apparatus into view. Compare
          // both boxes after the click rather than mixing viewport origins.
          const currentHost = await page.locator(`#simpanel-${id} .research-three`).boundingBox();
          assert(info.x >= currentHost.x - 1);
          assert(info.x + info.width <= currentHost.x + currentHost.width + 1);
          assert(info.y >= currentHost.y - 1);
          await summary.click();
          if (screenshotDir && [390, 1280].includes(width)) {
            await page.locator(`#simpanel-${id} .sim`).screenshot({ path: resolve(screenshotDir, `${id}-${width}-${lang}.png`) });
          }
        }
      });
    }
    for (const width of [320, 390]) for (const lang of ['ko', 'en']) for (const size of [24, 32]) {
      await check(`${width}px ${lang} ${size}px root: camera controls remain inside the apparatus`, async () => {
        const enlarged = await browser.newPage({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
        try {
          await enlarged.goto(`${base}/research.html?lang=${lang}`);
          await enlarged.evaluate(size => document.documentElement.style.fontSize = size + 'px', size);
          for (const id of ['track', 'contact']) {
            await enlarged.locator(`#simtab-${id}`).click();
            await enlarged.locator(`#simpanel-${id} .research-three canvas`).waitFor({ state: 'visible' });
            await enlarged.waitForTimeout(180);
            const bad = await enlarged.locator(`#simpanel-${id} .research-three`).evaluate(host => {
              const b = host.getBoundingClientRect();
              return [...host.querySelectorAll('.three-reset,summary')].filter(n => n.checkVisibility()).flatMap(n => {
                const r = n.getBoundingClientRect();
                return r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1 ||
                  r.width < 44 || r.height < 44 || n.scrollWidth > n.clientWidth + 1 ? [n.className || n.tagName] : [];
              });
            });
            assert.deepEqual(bad, [], 'enlarged controls must not be clipped by the GPU viewport');
          }
        } finally { await enlarged.close(); }
      });
    }
    await check('printing uses the complete original 2D figure, not a blank GPU surface', async () => {
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('#simpanel-contact .research-three').isVisible(), false);
      assert.equal(await page.locator('#simpanel-contact .sim__fig > canvas').isVisible(), true);
      await page.emulateMedia({ media: 'screen' });
    });
    await check('actual WebGL context loss uncovers the original apparatus and retains controls', async () => {
      await page.locator('#simtab-contact').click();
      const before = await snapshot('contact');
      await page.locator('#simpanel-contact .research-three canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
      await page.waitForFunction(() => !document.querySelector('#simpanel-contact .research-three'));
      assert.deepEqual(await snapshot('contact'), before);
      assert.equal(await page.locator('#simpanel-contact .sim__fig > canvas').isVisible(), true);
      await page.locator('#sim-contact-play').click();
      await tick(2);
      assert((await snapshot('contact')).time > before.time);
    });
    for (const failure of ['webgl', 'import']) {
      await check(`${failure} failure leaves both complete 2D simulators functional`, async () => {
        const fallback = await browser.newPage({ viewport: { width: 1280, height: 960 }, reducedMotion: 'reduce' });
        const fallbackErrors = [];
        fallback.on('pageerror', error => fallbackErrors.push(String(error)));
        try {
          if (failure === 'webgl') await fallback.addInitScript(() => {
            const get = HTMLCanvasElement.prototype.getContext;
            window.__webglAttempts = 0;
            HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
              if (kind === 'webgl2') { window.__webglAttempts++; return null; }
              return get.call(this, kind, ...args);
            };
          });
          else await fallback.route('**/assets/research-three.js', route => route.abort('failed'));
          await fallback.goto(`${base}/research.html?lang=en`, { waitUntil: 'load' });
          await fallback.evaluate(() => document.fonts.ready);
          for (const id of ['track', 'contact']) {
            await fallback.locator(`#simtab-${id}`).click();
            await fallback.waitForTimeout(200);
            assert.equal(await fallback.locator(`#simpanel-${id} .research-three`).count(), 0);
            const complete = await fallback.locator(`#simpanel-${id} .sim__fig > canvas`).evaluate(c => {
              const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
              return pixels.some((n, i) => i % 4 === 3 && n > 0);
            });
            assert.equal(complete, true);
            assert.equal(await fallback.locator(`#sim-${id}-play`).textContent(), 'Replay');
            assert.equal(await fallback.locator(`#simpanel-${id} .sim__fig > canvas`).evaluate(c => c.toDataURL()),
              originalCanvas.get(id), '2D apparatus and every graph pixel are identical with/without WebGL');
          }
          if (failure === 'webgl') assert.equal(await fallback.evaluate(() => window.__webglAttempts), 2);
          assert.deepEqual(fallbackErrors, []);
        } finally { await fallback.close(); }
      });
    }
    await check('Three integration has no uncaught page errors', async () => assert.deepEqual(errors, []));
  } finally { await page.close(); }
  return results;
}

// Native Chromium default-font preferences, not CSS root scaling or page zoom.
// Each preference owns its browser; the caller's ordinary browser is untouched.
export async function runResearchThreeFontChecks(chromium, base) {
  const results = [];
  for (const size of [24, 32]) {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH,
      args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
        '--disable-accelerated-2d-canvas', `--blink-settings=defaultFontSize=${size}`] });
    try {
      for (const width of [320, 390]) for (const lang of ['ko', 'en']) {
        const name = `${width}px ${lang} native ${size}px font: scene info and reset are clickable inside both GPU viewports`;
        const page = await browser.newPage({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
        const errors = [], controls = [];
        page.on('pageerror', error => errors.push(String(error)));
        page.setDefaultTimeout(10000);
        try {
          await page.goto(`${base}/research.html?lang=${lang}`, { waitUntil: 'load' });
          await page.evaluate(() => document.fonts.ready);
          assert.deepEqual(await page.evaluate(() => ({
            font: getComputedStyle(document.documentElement).fontSize,
            inline: document.documentElement.style.fontSize,
          })), { font: `${size}px`, inline: '' }, 'the browser preference itself enlarges text');
          for (const id of ['track', 'contact']) {
            await page.locator(`#simtab-${id}`).click();
            const host = page.locator(`#simpanel-${id} .research-three`);
            const canvas = host.locator('canvas');
            await canvas.waitFor({ state: 'visible' });
            await canvas.scrollIntoViewIfNeeded();
            await page.waitForFunction(id => {
              const canvas = document.querySelector(`#simpanel-${id} .research-three canvas`);
              const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
              return r.height > 120 && canvas.width === Math.floor(r.width * dpr) && canvas.height === Math.floor(r.height * dpr);
            }, id);
            assert.equal(await canvas.evaluate(c => c.getContext('webgl2') instanceof WebGL2RenderingContext), true);
            const info = host.locator('.research-three__info > summary'), reset = host.locator('.three-reset');
            assert.equal(await info.getAttribute('aria-label'), lang === 'en' ? 'Scene information' : '장치 설명');
            assert.equal(await reset.getAttribute('aria-label'), lang === 'en' ? 'Reset view' : '시점 초기화');
            assert.equal(await reset.evaluate(n => n.tagName === 'BUTTON' && n.type === 'button' && !n.disabled), true);
            assert.equal(await reset.locator('svg').getAttribute('aria-hidden'), 'true');
            assert.equal(await reset.locator('svg').getAttribute('focusable'), 'false');
            await host.evaluate(host => {
              host.__nativeControlClicks = [];
              for (const node of host.querySelectorAll('summary, .three-reset')) {
                node.addEventListener('click', event => host.__nativeControlClicks.push({
                  control: node.tagName, trusted: event.isTrusted,
                }));
              }
            });
            const hitTest = async locator => {
              const hit = await locator.evaluate(node => {
                const r = node.getBoundingClientRect(), host = node.closest('.research-three');
                const v = host.querySelector('canvas').getBoundingClientRect(), h = host.getBoundingClientRect();
                const rect = b => ({ x: b.x, y: b.y, width: b.width, height: b.height });
                const inside = b => r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
                const probes = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]
                  .map(([x, y]) => {
                    const target = document.elementFromPoint(r.left + r.width * x, r.top + r.height * y);
                    return { reachable: node === target || node.contains(target), target: target?.tagName || null };
                  });
                return { control: node.getAttribute('aria-label'), rect: rect(r), gpu: rect(v),
                  inside: inside(v) && inside(h), fits: node.scrollWidth <= node.clientWidth + 1, probes,
                  x: r.left + r.width / 2, y: r.top + r.height / 2 };
              });
              assert(hit.inside && hit.fits && hit.rect.width >= 44 && hit.rect.height >= 44,
                `44px control must fit inside the actual GPU canvas: ${JSON.stringify(hit)}`);
              assert(hit.probes.every(p => p.reachable), `native hit targets: ${JSON.stringify(hit)}`);
              return hit;
            };
            const infoHit = await hitTest(info);
            await page.mouse.click(infoHit.x, infoHit.y);
            assert.equal(await info.evaluate(n => n.parentElement.open), true);
            assert.equal(await host.locator('.three-legend').isVisible(), true);
            const closeHit = await hitTest(info);
            await page.mouse.click(closeHit.x, closeHit.y);
            assert.equal(await info.evaluate(n => n.parentElement.open), false);
            const image = await canvas.evaluate(c => c.toDataURL());
            const graph = page.locator(`#simpanel-${id} .sim__fig > canvas`);
            const graphImage = await graph.evaluate(c => c.toDataURL());
            await canvas.focus();
            await page.keyboard.press('ArrowRight');
            assert.notEqual(await canvas.evaluate(c => c.toDataURL()), image, 'keyboard orbit changes actual GPU pixels');
            const resetHit = await hitTest(reset);
            await page.mouse.click(resetHit.x, resetHit.y);
            assert.equal(await canvas.evaluate(c => c.toDataURL()), image, 'native reset click restores the real camera view');
            assert.equal(await graph.evaluate(c => c.toDataURL()), graphImage, 'camera controls do not alter graph pixels');
            assert.deepEqual(await host.evaluate(h => h.__nativeControlClicks), [
              { control: 'SUMMARY', trusted: true }, { control: 'SUMMARY', trusted: true }, { control: 'BUTTON', trusted: true },
            ]);
            controls.push({ id, info: infoHit, reset: resetHit });
          }
          assert.deepEqual(errors, []);
          results.push({ name, pass: true, controls });
        } catch (error) { results.push({ name, pass: false, error: error.stack, controls }); }
        finally { await page.close(); }
      }
    } finally { await browser.close(); }
  }
  return results;
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const modulePath = process.env.PLAYWRIGHT_MODULE;
  const { chromium } = await import(modulePath ? pathToFileURL(resolve(modulePath)).href : 'playwright');
  const server = spawn(process.env.PYTHON || 'python3', ['-u', '-c', [
    'from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler',
    "server = ThreadingHTTPServer(('127.0.0.1', 0), SimpleHTTPRequestHandler)",
    "print('READY_PORT=' + str(server.server_port), flush=True)",
    'server.serve_forever()',
  ].join('\n')], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '', browser;
  const exited = new Promise(resolve => server.once('close', resolve));
  for (const stream of [server.stdout, server.stderr]) stream.on('data', bytes => { log = (log + bytes).slice(-32768); });
  try {
    let base;
    for (let i = 0; i < 100 && !base; i++) {
      const port = log.match(/READY_PORT=(\d+)/)?.[1];
      if (port) base = `http://127.0.0.1:${port}`;
      else await delay(100);
    }
    assert(base, 'HTTP server readiness');
    assert.equal((await fetch(base + '/research.html')).status, 200);
    console.log(`Research Three checks: ${base}`);
    browser = await chromium.launch({ headless: true,
      executablePath: process.env.CHROMIUM_PATH,
      // Keep genuine WebGL2 enabled; do not enqueue thousands of legacy 2D
      // graph paints in SwiftShader during the synchronous fixed-step tests.
      args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-accelerated-2d-canvas'] });
    const results = await runResearchThreeChecks(browser, base, process.env.SCREENSHOT_DIR);
    results.push(...await runResearchThreeFontChecks(chromium, base));
    if (process.argv.includes('--regression')) {
      results.push(...await runSimStateChecks(browser, base));
      results.push(...await runSimKeyboardChecks(browser, base));
    }
    for (const result of results) console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}${result.error ? '\n' + result.error : ''}`);
    const failed = results.filter(r => !r.pass);
    console.log(`${results.length - failed.length}/${results.length} research checks passed`);
    if (failed.length) process.exitCode = 1;
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
    await exited;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch(error => { console.error(error); process.exitCode = 1; });
}
