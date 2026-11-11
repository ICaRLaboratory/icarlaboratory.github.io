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

export async function runResearchThreeChecks(browser, base, screenshotDir, { cameraOnly = false } = {}) {
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
    try { const evidence = await fn(); results.push({ name, pass: true, evidence }); }
    catch (error) { results.push({ name, pass: false, error: error.stack }); }
  }
  async function cameraEnvelope(id, history = false, setting = null) {
    return page.evaluate(async ({ id, history, setting }) => {
      const T = await import('./assets/vendor/three.js');
      const { createResearchModel } = await import('./assets/research-three.js');
      const { createApparatusCamera } = await import('./assets/three/camera.js');
      const model = createResearchModel(id), def = window.__researchDefs[id];
      const snapshot = def.visualState(window.__researchParams[id]);
      let states = history ? window.__researchTrackingState.hist.filter((_, i) => i % 10 === 0)
        .map(row => Object.freeze({ ...snapshot, time: row[0], q: Object.freeze(row.slice(1, 3)), payload: ARMPLANT.carried(row[0]) }))
        : [snapshot];
      states.push(snapshot);
      if (setting) {
        const P = { ...window.__researchCameraDefaults, ...setting };
        def.reset(P);
        states = [def.visualState(P)];
        // Actual frozen snapshots, not a final path paired with earlier joints.
        // Keep every path vertex; the 0.2 s pose samples are supplemented by
        // the continuous all-angle workspace proof below.
        for (let step = 1; !def.done(P) && step <= Math.ceil(ARMPLANT.WINDOW * 60) + 1; step++) {
          def.advance(P, 1 / 60);
          if (step % 12 === 0 || [299, 300, 301, 479, 480, 481].includes(step) || def.done(P)) {
            states.push(def.visualState(P));
          }
        }
        const reviewTime = setting.law === 'pd' && setting.kp === 10 && setting.h === undefined ? 7.4
          : setting.law === 'smc' && setting.lam === undefined && setting.h === 0.100 ? 1.2
          : setting.law === 'pd' && setting.kp === 10 && setting.kd === 20 && setting.h === .1 && setting.m === 3 ? 1.2 : null;
        if (reviewTime !== null) {
          window.__researchCameraReview ||= [];
          window.__researchCameraReview.push({ setting: P, state: states.find(s => Math.abs(s.time - reviewTime) < 1e-9) });
        }
      }
      if (id === 'contact') for (const position of [-0.03, -0.02, 0, 0.02, 0.055, 0.075]) {
        states.push(Object.freeze({ ...snapshot, position }));
      }
      const aspects = [{ w: 780, h: 620 }, { w: 380, h: 1010 }].map(D => {
        const box = def.visualBox(D); return box.w / box.h;
      });
      const point = new T.Vector3(), transform = new T.Matrix4(), results = [];
      for (const aspect of aspects) {
        // Use the production camera helper, including its aspect adaptation.
        const camera = createApparatusCamera(model.camera, aspect);
        const projection = new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        const bounds = [Infinity, Infinity, -Infinity, -Infinity], outside = [];
        let vertices = 0;
        for (const state of states) {
          model.update(state); model.root.updateMatrixWorld(true);
          model.root.traverseVisible(o => {
            if (!o.geometry) return;
            for (let n = o; n; n = n.parent) if (n.userData.environment) return;
            const position = o.geometry.getAttribute('position');
            transform.multiplyMatrices(projection, o.matrixWorld);
            for (let i = 0; i < position.count; i++) {
              point.fromBufferAttribute(position, i).applyMatrix4(transform); vertices++;
              bounds[0] = Math.min(bounds[0], point.x); bounds[1] = Math.min(bounds[1], point.y);
              bounds[2] = Math.max(bounds[2], point.x); bounds[3] = Math.max(bounds[3], point.y);
              if ((!point.toArray().every(Number.isFinite) || Math.abs(point.x) > 0.98 || Math.abs(point.y) > 0.98 ||
                Math.abs(point.z) > 1) && outside.length < 5) {
                outside.push({ name: o.name, time: state.time, position: state.position, x: point.x, y: point.y, z: point.z });
              }
            }
          });
        }
        results.push({ aspect, samples: states.length, vertices, bounds, outside,
          times: setting ? states.map(s => s.time) : undefined });
      }
      return results;
    }, { id, history, setting });
  }
  try {
    await page.goto(`${base}/research.html?lang=en`, { waitUntil: 'load' });
    await page.locator('#simtab-track').click();
    await page.waitForFunction(() => window.__researchViews?.track);
    const settings = await page.evaluate(() => {
      const def = window.__researchDefs.track;
      const defaults = Object.fromEntries(def.controls.map(c => [c.id, c.read ? c.read(c.value) : c.value]));
      window.__researchCameraDefaults = defaults;
      const settings = [
        { law: 'pd', kp: 10, kd: 2 }, { law: 'smc', h: 0.100, m: 3 },
        { law: 'pd', h: 0.075, m: 3 }, { law: 'tdc', h: 0.075, m: 3 },
        { law: 'pd' }, { law: 'smc' }, { law: 'tdc' },
        { law: 'asmc', algo: 'quasi' }, { law: 'asmc', algo: 'sigvar' },
      ];
      // All corners of the supported sliders, including mixed low/high gains.
      // ASMC has no adjustable gains and locks its clock/delay in production.
      for (const [law, ids] of [['pd', ['kp', 'kd', 'h', 'm']],
        ['smc', ['lam', 'eta', 'h', 'm']], ['tdc', ['l1', 'l2', 'hs', 'h', 'm']]]) {
        let corners = [{ law }];
        for (const id of ids) {
          const c = def.controls.find(c => c.id === id);
          corners = corners.flatMap(P => [c.min, c.max].map(v => ({ ...P, [id]: c.read ? c.read(v) : v })));
        }
        settings.push(...corners);
      }
      return settings;
    });
    for (const setting of settings) {
      await check(`track camera: real history ${JSON.stringify(setting)} fits hardware and complete path buffers`, async () => {
        const envelope = await cameraEnvelope('track', false, setting);
        for (const result of envelope) {
          assert(result.samples > 1 && result.vertices > 1000, 'include the real reset and pre-termination states');
          if (setting.law === 'pd' && setting.kp === 10 && setting.h === undefined) {
            assert(result.times.some(t => Math.abs(t - 7.4) < 1e-9), 'include the reviewed loaded spindle pose');
          }
          if (setting.law === 'smc' && setting.lam === undefined && setting.h === 0.100) {
            assert(result.times.some(t => Math.abs(t - 1.2) < 1e-9), 'include the reviewed pre-termination unloaded path');
          }
          assert.deepEqual(result.outside, [], JSON.stringify({ setting, ...result, times: undefined }));
        }
      });
    }
    await check('track camera: continuous horizontal 2R workspace fits with the same 0.98 NDC margin', async () => {
      const report = await page.evaluate(async () => {
        const T = await import('./assets/vendor/three.js');
        const { createResearchModel } = await import('./assets/research-three.js');
        const { createApparatusCamera } = await import('./assets/three/camera.js');
        const def = window.__researchDefs.track, model = createResearchModel('track');
        const snapshot = def.visualState(window.__researchCameraDefaults);
        // Zero angles expose each actual vertex's radius about its joint.
        // Every height is invariant under the two world-Y rotations.
        model.update(Object.freeze({ ...snapshot, q: Object.freeze([0, 0]), payload: ARMPLANT.PAYLOAD }));
        model.root.updateMatrixWorld(true);
        const shoulder = model.root.getObjectByName('shoulder'), elbow = model.root.getObjectByName('elbow');
        const target = model.root.getObjectByName('target'), point = new T.Vector3();
        const circles = [], fixed = [];
        model.root.traverseVisible(o => {
          if (!o.geometry) return;
          let rotating = false, downstream = false, movingTarget = false;
          for (let n = o; n; n = n.parent) {
            if (n.userData.environment) return;
            rotating ||= n === shoulder; downstream ||= n === elbow; movingTarget ||= n === target;
          }
          const position = o.geometry.getAttribute('position');
          for (let i = 0; i < position.count; i++) {
            point.fromBufferAttribute(position, i).applyMatrix4(o.matrixWorld);
            if (rotating) {
              const radius = downstream ? snapshot.lengths[0] + Math.hypot(point.x - snapshot.lengths[0], point.z)
                : Math.hypot(point.x, point.z);
              circles.push({ name: o.name, centre: new T.Vector3(0, point.y, 0), radius });
            } else if (movingTarget) {
              circles.push({ name: o.name, centre: new T.Vector3(snapshot.circle.x + point.x - target.position.x,
                point.y, snapshot.circle.y + point.z - target.position.z), radius: snapshot.circle.r });
            } else fixed.push({ name: o.name, point: point.clone() });
          }
        });
        // Entire possible measured histories, not just sampled poses or the
        // rolling tail: FK lives in the disk of radius L1 + L2 at path height.
        for (const name of ['unloaded-trajectory', 'measured-trajectory']) {
          circles.push({ name, centre: new T.Vector3(0, 0.06, 0),
            radius: snapshot.lengths[0] + snapshot.lengths[1] + 1e-6 });
        }
        return [{ w: 780, h: 620 }, { w: 380, h: 1010 }].map(D => {
          const box = def.visualBox(D), aspect = box.w / box.h;
          const camera = createApparatusCamera(model.camera, aspect);
          const projection = new T.Matrix4().makeScale(1 / 0.98, 1 / 0.98, 1)
            .multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
          const planes = new T.Frustum().setFromProjectionMatrix(projection).planes;
          let minimum = Infinity, worst;
          const measure = (distance, name, plane) => {
            if (distance < minimum) { minimum = distance; worst = { name, plane }; }
          };
          planes.forEach((plane, i) => {
            for (const { name, centre, radius } of circles) {
              // Exact support of a horizontal circle against a frustum plane;
              // covers intermediate angles without a finite-angle grid gap.
              measure(plane.distanceToPoint(centre) - radius * Math.hypot(plane.normal.x, plane.normal.z), name, i);
            }
            for (const { name, point } of fixed) measure(plane.distanceToPoint(point), name, i);
          });
          return { aspect, minimum, worst, circles: circles.length, fixed: fixed.length };
        });
      });
      for (const result of report) {
        assert(result.circles > 1000 && result.fixed > 1000);
        assert(Number.isFinite(result.minimum) && result.minimum >= 0, JSON.stringify(result));
      }
      return report;
    });
    // Restore the actual default run and its retained comparison paths before
    // the existing interaction checks; the UI parameter values are untouched.
    await page.evaluate(() => {
      const def = window.__researchDefs.track, P = window.__researchCameraDefaults;
      def.reset(P);
      while (!def.done(P)) def.advance(P, 1 / 60);
      const state = def.visualState(P);
      window.__researchViews.track.view.update(state, P);
      window.__researchCameraReview.unshift({ setting: P, state });
    });
    await check('track camera: default completed apparatus retains useful framing at both layout aspects', async () => {
      const envelope = await cameraEnvelope('track');
      for (const result of envelope) {
        assert.deepEqual(result.outside, [], JSON.stringify(result));
        assert(result.bounds[2] - result.bounds[0] > 0.85, 'retain the existing useful horizontal framing requirement');
      }
      return envelope;
    });
    for (const width of [1440, 390]) {
      await check(`track camera: ${width}px live GPU default and reviewed off-default poses use the production camera`, async () => {
        await page.setViewportSize({ width, height: 960 });
        const canvas = page.locator('#simpanel-track .research-three canvas');
        await canvas.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => {
          const { renderer } = window.__researchViews.track;
          const c = renderer.domElement, r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
          return r.width > 100 && r.height > 120 && c.width === Math.floor(r.width * dpr) && c.height === Math.floor(r.height * dpr);
        });
        const reports = [];
        for (const [index, name] of ['default', 'pd-low-gains-7.4', 'smc-delay-1.2', 'pd-mixed-gains-delay-1.2'].entries()) {
          const report = await page.evaluate(async index => {
            const T = await import('./assets/vendor/three.js');
            const { createApparatusCamera } = await import('./assets/three/camera.js');
            const { model, view, camera, renderer } = window.__researchViews.track;
            const { state, setting } = window.__researchCameraReview[index], saved = JSON.stringify(state);
            const cameraBefore = JSON.stringify(model.camera);
            view.update(state, setting); model.root.updateMatrixWorld(true);
            const rect = renderer.domElement.getBoundingClientRect();
            const production = createApparatusCamera(model.camera, rect.width / rect.height);
            const matches = ['projectionMatrix', 'matrixWorldInverse'].every(property =>
              camera[property].elements.every((n, i) => Math.abs(n - production[property].elements[i]) < 1e-10));
            const point = new T.Vector3(), bounds = [Infinity, Infinity, -Infinity, -Infinity], outside = [];
            let vertices = 0;
            model.root.traverseVisible(o => {
              if (!o.geometry) return;
              for (let n = o; n; n = n.parent) if (n.userData.environment) return;
              const position = o.geometry.getAttribute('position');
              for (let i = 0; i < position.count; i++) {
                point.fromBufferAttribute(position, i).applyMatrix4(o.matrixWorld).project(camera); vertices++;
                bounds[0] = Math.min(bounds[0], point.x); bounds[1] = Math.min(bounds[1], point.y);
                bounds[2] = Math.max(bounds[2], point.x); bounds[3] = Math.max(bounds[3], point.y);
                if ((!point.toArray().every(Number.isFinite) || Math.abs(point.x) > 0.98 || Math.abs(point.y) > 0.98 ||
                  Math.abs(point.z) > 1) && outside.length < 5) outside.push({ name: o.name, point: point.toArray() });
              }
            });
            const get = name => model.root.getObjectByName(name), distal = [], upstream = [];
            get('tool-tip').traverse(o => { if (o.isMesh) distal.push(o); });
            for (const name of ['shoulder', 'robot-base']) get(name).traverse(o => {
              if (!o.isMesh) return;
              for (let n = o; n; n = n.parent) if (n === get('elbow')) return;
              upstream.push(o);
            });
            const upstreamTop = Math.max(...upstream.map(o => new T.Box3().setFromObject(o).max.y));
            const guide = get('tool-projection-guide'), marker = get('tool-planar-marker');
            const endpoints = [0, 1].map(i => guide.localToWorld(new T.Vector3()
              .fromBufferAttribute(guide.geometry.getAttribute('position'), i))).sort((a, b) => a.y - b.y);
            const expected = new T.Vector3(state.lengths[0] * Math.cos(state.q[0]) + state.lengths[1] * Math.cos(state.q[0] + state.q[1]),
              .06, state.lengths[0] * Math.sin(state.q[0]) + state.lengths[1] * Math.sin(state.q[0] + state.q[1]));
            return { time: state.time, matches, vertices, bounds, outside, width: rect.width, height: rect.height,
              distalSolids: distal.map(o => o.name),
              toolClearance: Math.min(...distal.map(o => new T.Box3().setFromObject(o).min.y - upstreamTop)),
              projectionExact: endpoints[0].distanceTo(expected) < 1e-12 && marker.getWorldPosition(new T.Vector3()).distanceTo(expected) < 1e-12,
              projectionIsLine: guide.isLine && guide.material.isLineDashedMaterial && marker.isLine && !marker.isMesh,
              gpu: renderer.getContext() instanceof WebGL2RenderingContext,
              frozen: Object.isFrozen(state) && Object.isFrozen(state.q) && Object.isFrozen(state.trail),
              unchanged: JSON.stringify(state) === saved && JSON.stringify(model.camera) === cameraBefore,
              retainLabel: model.readouts().find(r => r.id === 'payload').retainLabel };
          }, index);
          reports.push({ name, ...report });
          if (screenshotDir) {
            await mkdir(screenshotDir, { recursive: true });
            await page.locator('#simpanel-track .research-three').screenshot({ path: resolve(screenshotDir, `camera-${name}-${width}.png`) });
          }
          assert(report.gpu && report.matches && report.frozen && report.unchanged && report.retainLabel, JSON.stringify(report));
          assert(report.vertices > 1000);
          assert.deepEqual(report.outside, [], JSON.stringify({ name, ...report }));
          assert(report.toolClearance >= .02 && report.projectionExact && report.projectionIsLine, JSON.stringify(report));
          for (const solid of ['tool-stylus', 'tool-collet', 'wrist', 'tool-mass-fixture', 'tool-mass-spindle',
            'payload-plate-1', 'payload-plate-2', 'payload-plate-3', 'payload-plate-4']) assert(report.distalSolids.includes(solid));
          if (name === 'pd-mixed-gains-delay-1.2') assert(Math.abs(report.time - 1.2) < 1e-12, 'actual reviewed legal controller snapshot');
        }
        return reports;
      });
    }
    await page.setViewportSize({ width: 1280, height: 960 });
    await page.evaluate(() => {
      const { state, setting } = window.__researchCameraReview[0];
      window.__researchViews.track.view.update(state, setting);
    });
    if (cameraOnly) {
      await check('track camera: no uncaught page errors', async () => assert.deepEqual(errors, []));
      return results;
    }
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
    await check('track: layered cast SCARA hardware carries discrete inertial mass plates and true stable readouts', async () => {
      const report = await page.evaluate(async () => {
        const { createResearchModel } = await import('./assets/research-three.js');
        const model = createResearchModel('track'), def = window.__researchDefs.track;
        const P = window.__researchParams.track, saved = def.visualState(P);
        const get = name => model.root.getObjectByName(name);
        const parts = ['shoulder-bearing', 'shoulder-servo', 'elbow-bearing', 'upper-link-shell',
          'forearm-link-shell', 'elbow-shaft', 'tool-mass-fixture', 'payload-plate-1', 'payload-plate-4'];
        const structure = parts.map(name => ({ name, exists: !!get(name),
          geometry: get(name)?.geometry?.type, finish: get(name)?.material?.userData.finish }));
        const readings = model.readouts?.(), entries = readings?.map(r => [r, r.anchor]), values = [];
        const identities = new Map();
        model.root.traverse(o => identities.set(o, [o.geometry, o.material]));
        let stable = !!readings, finite = true, pose = [];
        const hist = window.__researchTrackingState.hist;
        for (const time of [0, 4.98, 5.02, 7.98, 8.02]) {
          const row = hist.find(row => row[0] >= time);
          const state = Object.freeze({ ...saved, time: row[0], q: Object.freeze(row.slice(1, 3)), payload: ARMPLANT.carried(row[0]) });
          const before = JSON.stringify(state);
          model.update(state); model.root.updateMatrixWorld(true);
          const payload = get('payload'), tip = get('tool-tip');
          values.push({ time: state.time, kg: state.payload,
            readout: model.readouts?.().find(r => r.id === 'payload')?.value,
            visible: payload.visible, scale: payload.scale.toArray(),
            plates: payload.children.filter(o => /^payload-plate-/.test(o.name) && o.visible).length });
          stable &&= model.readouts?.() === readings && entries.every(([entry, anchor], i) => readings[i] === entry && entry.anchor === anchor);
          stable &&= JSON.stringify(state) === before;
          model.root.traverse(o => {
            stable &&= identities.has(o) && identities.get(o)[0] === o.geometry && identities.get(o)[1] === o.material;
            finite &&= o.matrixWorld.elements.every(Number.isFinite);
            if (o.geometry) finite &&= o.geometry.getAttribute('position').array.every(Number.isFinite);
          });
          pose.push({ x: tip.matrixWorld.elements[12], y: tip.matrixWorld.elements[13], z: tip.matrixWorld.elements[14],
            q: state.q, lengths: state.lengths });
        }
        const anchors = readings?.map(r => ({ id: r.id, object: r.anchor?.isObject3D,
          named: r.anchor?.name, label: r.label, side: r.side }));
        const materials = ['shoulder-servo', 'shoulder-bearing', 'upper-link-shell', 'base-power-cable']
          .map(name => { const m = get(name)?.material; return m ? [m.metalness, m.roughness] : null; });
        // The live renderer still receives its original frozen snapshot.
        window.__researchViews.track.view.update(saved, P);
        return { structure, values, stable, finite, pose, anchors, materials, legend: model.legend };
      });
      assert(report.structure.every(p => p.exists), `meaningful robot assembly: ${JSON.stringify(report.structure)}`);
      assert.equal(report.structure.find(p => p.name === 'shoulder-bearing').geometry, 'ExtrudeGeometry', 'a bored bearing flange, not another solid puck');
      assert.equal(report.structure.find(p => p.name === 'upper-link-shell').geometry, 'BufferGeometry');
      assert.equal(report.structure.find(p => p.name === 'forearm-link-shell').geometry, 'BufferGeometry');
      assert(new Set(report.materials.map(JSON.stringify)).size >= 3, 'metal, painted servo and rubber have different optical finishes');
      assert.equal(report.stable, true, 'readouts, hardware and materials are retained across read-only updates');
      assert.equal(report.finite, true);
      assert.equal(report.anchors.length, 2);
      assert(report.anchors.every(r => r.object && r.label.en && r.label.ko && ['left', 'right'].includes(r.side)));
      assert.deepEqual(report.values.map(v => v.kg), [0, 0, 15, 15, 20]);
      assert.deepEqual(report.values.map(v => v.plates), [0, 0, 3, 3, 4]);
      for (const v of report.values) {
        assert.equal(v.readout, `${v.kg.toFixed(0)} kg`);
        assert.equal(v.visible, v.kg > 0);
        assert.deepEqual(v.scale, [1, 1, 1], 'mass steps attach fixed geometry; no inflation or falling animation');
      }
      for (const p of report.pose) {
        assert(Math.abs(p.x - (p.lengths[0] * Math.cos(p.q[0]) + p.lengths[1] * Math.cos(p.q[0] + p.q[1]))) < 1e-12);
        assert(Math.abs(p.z - (p.lengths[0] * Math.sin(p.q[0]) + p.lengths[1] * Math.sin(p.q[0] + p.q[1]))) < 1e-12);
        assert.equal(p.y, report.pose[0].y, 'the tip remains in the horizontal plane');
      }
      assert.match(report.legend.en, /horizontal plane/i);
      assert.match(report.legend.en, /inertial payload/i);
      assert.match(report.legend.ko, /수평면/);
    });
    await check('contact: a bench-mounted direct-drive stage carries one linear carriage with actual force and travel readouts', async () => {
      const report = await page.evaluate(async () => {
        const { createResearchModel } = await import('./assets/research-three.js');
        const model = createResearchModel('contact'), saved = window.__researchDefs.contact.visualState(window.__researchParams.contact);
        const get = name => model.root.getObjectByName(name);
        const parts = ['linear-rail-bed', 'direct-drive-stator', 'direct-drive-forcer', 'carriage-saddle', 'carriage-bearing-front', 'force-sensor', 'sensor-connector',
          'sensor-cable-loom', 'stage-left-foot', 'stage-right-foot', 'wall-guide-rod', 'wall-damper-body'];
        const structure = parts.map(name => ({ name, exists: !!get(name), finish: get(name)?.material?.userData.finish }));
        const readouts = model.readouts?.(), states = [saved,
          Object.freeze({ ...saved, position: -0.02, force: 0 }),
          Object.freeze({ ...saved, position: 0.012, force: 17.625 }),
          Object.freeze({ ...saved, position: 0.075, force: 125, mode: 'impedance' })];
        const support = get('fixed-linear-stage');
        model.root.updateMatrixWorld(true);
        const supportMatrices = new Map();
        support.traverse(o => supportMatrices.set(o, JSON.stringify(o.matrixWorld.toArray())));
        const identities = new Map();
        model.root.traverse(o => identities.set(o, [o.geometry, o.material]));
        const samples = states.map(state => {
          const frozenBefore = JSON.stringify(state); model.update(state); model.root.updateMatrixWorld(true);
          const readings = model.readouts?.();
          return { position: state.position, force: state.force,
            tip: get('tool-tip').matrixWorld.elements.slice(12, 15), wall: get('contact-wall').position.x,
            forceText: readings?.find(r => r.id === 'force')?.value,
            travelText: readings?.find(r => r.id === 'position')?.value,
            stable: readings === readouts, supportFixed: [...supportMatrices].every(([o, matrix]) => matrix === JSON.stringify(o.matrixWorld.toArray())),
            readonly: JSON.stringify(state) === frozenBefore };
        });
        let stableGeometry = true, finite = true;
        model.root.traverse(o => {
          stableGeometry &&= identities.has(o) && identities.get(o)[0] === o.geometry && identities.get(o)[1] === o.material;
          finite &&= o.matrixWorld.elements.every(Number.isFinite);
          if (o.geometry) finite &&= o.geometry.getAttribute('position').array.every(Number.isFinite);
        });
        return { structure, samples, stableGeometry, finite, legend: model.legend,
          anchors: readouts?.map(r => ({ object: r.anchor?.isObject3D, name: r.anchor?.name, label: r.label })) };
      });
      assert(report.structure.every(p => p.exists), `linear force-test hardware: ${JSON.stringify(report.structure)}`);
      assert(new Set(report.structure.map(p => p.finish)).size >= 3, 'rail/sensor, painted support and rubber cable are distinct');
      assert.equal(report.anchors.length, 2);
      assert(report.anchors.every(r => r.object && r.label.en && r.label.ko));
      assert(report.anchors.some(r => r.name === 'force-sensor'), 'force leader anchors at the sensor itself');
      for (const s of report.samples) {
        assert.equal(s.forceText, `${s.force.toFixed(2)} N`);
        assert.equal(s.travelText, `${(s.position * 1000).toFixed(2)} mm`, 'readout is physical travel, never the 12x drawing coordinate');
        const shown = 0.65 + 12 * Math.max(-0.03, Math.min(0.055, s.position));
        assert(Math.abs(s.tip[0] - shown) < 1e-12);
        assert.equal(s.tip[1], 0.67); assert.equal(s.tip[2], 0);
        assert(Math.abs(s.wall - (0.65 + 12 * Math.max(0, Math.min(0.055, s.position)))) < 1e-12);
        assert(s.stable && s.supportFixed && s.readonly);
      }
      assert(report.stableGeometry && report.finite, 'updates retain finite hardware and material identity');
      assert.match(report.legend.en, /single.axis/i);
      assert.match(report.legend.en, /direct.drive.*fixed guides/i);
      assert.match(report.legend.en, /admittance.*feedback.*impedance.*measurement only/i);
      assert.match(report.legend.en, /12 times/);
    });
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
            primaryValue: window.__researchViews[id].view.element.querySelector('.three-readout__value')?.textContent,
            primaryLabel: model.readouts()[0].label,
            meshes: (() => { let n = 0; model.root.traverse(o => { if (o.isMesh) n++; }); return n; })() };
        }, id);
        assert.equal(report.frozen, true);
        assert.equal(report.scene, true);
        assert(report.meshes > 20, 'solid articulated geometry, not a flat diagram');
        if (id === 'track') {
          const s = report.state;
          assert.equal(report.shoulder, -s.q[0]);
          assert.equal(report.elbow, -s.q[1]);
          assert.equal(report.primaryValue, `${s.payload.toFixed(0)} kg`, 'the live DOM shows the actual scheduled payload');
          assert.match(report.primaryLabel.en, /horizontal plane/i);
          assert.match(report.primaryLabel.ko, /수평면/);
          assert(Math.abs(report.tip[0] - (s.lengths[0] * Math.cos(s.q[0]) + s.lengths[1] * Math.cos(s.q[0] + s.q[1]))) < 1e-12);
          assert(Math.abs(report.tip[2] - (s.lengths[0] * Math.sin(s.q[0]) + s.lengths[1] * Math.sin(s.q[0] + s.q[1]))) < 1e-12);
        } else {
          assert.equal(report.primaryValue, `${report.state.force.toFixed(2)} N`, 'the live DOM shows actual contact force, not its target');
          assert(Math.abs(report.tip[0] - (0.65 + 12 * Math.max(-0.03, Math.min(0.055, report.state.position)))) < 1e-12);
        }
      });
      await check(`${id}: default camera contains the whole robot and contact surface`, async () => {
        const outside = await page.evaluate(async id => {
          const T = await import('./assets/vendor/three.js');
          const { createApparatusCamera } = await import('./assets/three/camera.js');
          const { model, camera, renderer } = window.__researchViews[id];
          const rect = renderer.domElement.getBoundingClientRect();
          const production = createApparatusCamera(model.camera, rect.width / rect.height);
          const names = id === 'track' ? ['robot-base', 'shoulder'] : ['test-bed', 'fixed-linear-stage', 'contact-wall', 'wall-backplate'];
          model.root.updateMatrixWorld(true);
          const outside = [];
          for (const property of ['projectionMatrix', 'matrixWorldInverse']) {
            if (camera[property].elements.some((n, i) => Math.abs(n - production[property].elements[i]) > 1e-10)) {
              outside.push({ projectionMismatch: property });
            }
          }
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
      await check(`${id}: production camera fits actual hardware vertices and paths at both layout aspects`, async () => {
        const envelope = await cameraEnvelope(id);
        for (const result of envelope) {
          assert(result.vertices > 1000);
          assert.deepEqual(result.outside, [], JSON.stringify(result));
          assert(result.bounds[2] - result.bounds[0] > 0.85, 'apparatus must occupy a useful horizontal fraction of its compact viewport');
        }
      });
    }
    for (const [law, algo] of [['pd'], ['smc'], ['tdc'], ['asmc', 'quasi'], ['asmc', 'sigvar']]) {
      await check(`track ${law}${algo ? '/' + algo : ''}: completed GPU scene retains the exact unloaded comparison path and clears it on reset`, async () => {
        await page.locator('#simtab-track').click();
        await page.locator(`#sim-track-law [data-value=${law}]`).click();
        if (algo) await page.locator(`#sim-track-algo [data-value=${algo}]`).click();
        assert.equal(await page.locator('#sim-track-play').textContent(), 'Replay');
        await check(`track ${law}${algo ? '/' + algo : ''}: recorded transient and payload poses stay within the fixed production camera`, async () => {
          const envelope = await cameraEnvelope('track', true);
          for (const result of envelope) {
            assert(result.samples > 100, 'replay the actual controller history rather than only its final pose');
            assert.deepEqual(result.outside, [], JSON.stringify(result));
          }
        });
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
        const reset = await camera();
        assert(reset.every((n, i) => Math.abs(n - initial[i]) < 1e-12),
          'OrbitControls restores the camera up to spherical-coordinate roundoff');
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
          const readoutReport = await page.locator(`#simpanel-${id} .research-three`).evaluate(async (host, { id, lang }) => {
            const T = await import('./assets/vendor/three.js');
            const viewport = host.querySelector('.three-viewport'), box = viewport.getBoundingClientRect();
            const { model, camera } = window.__researchViews[id], readings = model.readouts();
            const nodes = [...viewport.querySelectorAll('.three-readout')], leaders = [...viewport.querySelectorAll('.three-leader')];
            return readings.map(r => {
              const index = nodes.findIndex(n => n.dataset.readout === r.id), node = nodes[index];
              if (!node?.checkVisibility()) return { id: r.id, visible: false };
              const label = node.querySelector('.three-readout__label'), value = node.querySelector('.three-readout__value');
              const text = label.checkVisibility() ? [label, value] : [value];
              const point = r.anchor.getWorldPosition(new T.Vector3()).project(camera), leader = leaders[index];
              return { id: r.id, visible: true, labelVisible:label.checkVisibility(), actual: value.textContent, expected: r.value,
                localized: label.textContent === r.label[lang],
                anchored: Math.abs(Number(leader.getAttribute('x1')) - (point.x + 1) * box.width / 2) < 0.06 &&
                  Math.abs(Number(leader.getAttribute('y1')) - (1 - point.y) * box.height / 2) < 0.06,
                inside: text.every(n => { const b = n.getBoundingClientRect();
                  return b.left >= box.left - 1 && b.right <= box.right + 1 && b.top >= box.top - 1 && b.bottom <= box.bottom + 1;
                }), font: Math.min(...text.map(n => parseFloat(getComputedStyle(n).fontSize))) };
            });
          }, { id, lang });
          assert(readoutReport[0].visible, `the primary actual measurement is visible: ${JSON.stringify(readoutReport)}`);
          if(id==='track')assert(readoutReport[0].labelVisible,'the horizontal-plane assumption stays visible on mobile');
          assert(readoutReport.filter(r => r.visible).every(r => r.actual === r.expected && r.localized && r.anchored),
            `leaders terminate at their current true 3D anchors: ${JSON.stringify(readoutReport)}`);
          assert(readoutReport.filter(r => r.visible).every(r => r.inside && r.font >= 12), 'anchored values stay readable inside the apparatus, not over its graphs');
          assert.equal(await page.locator(`#simpanel-${id} .three-reset`).getAttribute('aria-label'), lang === 'en' ? 'Reset view' : '시점 초기화');
          assert.equal(await page.locator(`#simpanel-${id} .three-reset svg`).isVisible(), true);
          const summary = page.locator(`#simpanel-${id} .research-three__info > summary`);
          assert.equal(await summary.getAttribute('aria-label'), lang === 'en' ? 'Scene information' : '장치 설명');
          if (await summary.evaluate(s => s.parentElement.open)) await summary.click();
          await summary.click();
          assert.equal(await page.locator(`#simpanel-${id} .three-legend`).isVisible(), true);
          if (id === 'track') {
            const legend = await page.locator('#simpanel-track .three-legend').textContent();
            assert.match(legend, lang === 'en' ? /nonphysical projection/i : /비물리적 투영/);
            assert.match(legend, lang === 'en' ? /no collision physics/i : /충돌 동역학/);
          }
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
    const cameraOnly = process.argv.includes('--camera-only');
    const results = await runResearchThreeChecks(browser, base, process.env.SCREENSHOT_DIR, { cameraOnly });
    if (!cameraOnly) results.push(...await runResearchThreeFontChecks(chromium, base));
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
