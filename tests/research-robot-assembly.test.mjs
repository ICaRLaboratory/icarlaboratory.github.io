import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as T from '../assets/vendor/three.js';
import { createResearchModel } from '../assets/research-three.js';
import { createApparatusCamera } from '../assets/three/camera.js';

function controller(id) {
  const context = vm.createContext({ document: { addEventListener() {} } });
  const run = name => vm.runInContext(readFileSync(new URL(`../assets/${name}`, import.meta.url), 'utf8'), context);
  run('sim.js');
  vm.runInContext('globalThis.defs = {}; SIM.register = d => { defs[d.id] = d; };', context);
  run('sim-arm-plant.js'); run('sim-tracking.js'); run('sim-contact.js');
  const def = context.defs[id];
  const P = Object.fromEntries(def.controls.map(c => [c.id, c.read ? c.read(c.value) : c.value]));
  def.reset(P); def.tune?.(P);
  return { def, P };
}
test('contact: smooth fixed castings connect the base directly to the integrated linear carrier', () => {
  const { def, P } = controller('contact'), model = createResearchModel('contact');
  model.update(def.visualState(P)); model.root.updateMatrixWorld(true);
  const first = part(model, 'support-link-shell-1'), second = part(model, 'support-link-shell-2');
  const carrier = part(model, 'linear-carrier-shell'), drive = part(model, 'linear-drive-housing');
  for (const mesh of [first, second, carrier, drive]) {
    assert(mesh.geometry.index?.count > 6000, `${mesh.name}: smooth closed volume rather than two plate webs`);
    assert.equal(mesh.material.userData.finish, 'paint');
  }
  assert(bounds(first).intersectsBox(bounds(part(model, 'base-column'))), 'support load path starts in the base');
  assert(bounds(first).intersectsBox(bounds(second)), 'fixed links share the locked elbow');
  assert(bounds(second).intersectsBox(bounds(drive)), 'distal support ends in the drive manifold');
  assert(bounds(drive).intersectsBox(bounds(carrier)), 'drive and rail form one carrier, not separate apparatus');
  // Shared solid mounting regions prove a load path through the actual skins.
  for (const [a, b, x, y, z] of [
    [part(model, 'base-column'), first, -1.16, .27, -.12],
    [first, second, -.88, .91, -.12],
    [second, drive, -.32, .47, -.10],
    [drive, carrier, -.39, .35, -.02],
  ]) for (const mesh of [a, b]) {
    assert(intervals(mesh, x, z).some(([lo, hi]) => y > lo && y < hi), `${mesh.name}: actual mounted skin at ${x},${y},${z}`);
  }
  const fixed = model.root.getObjectByName('fixed-articulated-support');
  const transforms = new Map(); fixed.traverse(o => transforms.set(o, o.matrixWorld.clone()));
  for (let step = 0; step < 361; step++) {
    model.update(def.visualState(P)); model.root.updateMatrixWorld(true);
    for (const [o, matrix] of transforms) assert.deepEqual(o.matrixWorld.elements, matrix.elements, 'articulated support never animates');
    if (!def.done(P)) def.advance(P, 1 / 60);
  }
});

const near = (actual, expected, message, epsilon = 1e-6) => assert(Math.abs(actual - expected) < epsilon, `${message}: ${actual} != ${expected}`);

function firstOpaque(model, camera, point) {
  const origin = camera.isPerspectiveCamera ? camera.position.clone()
    : point.clone().addScaledVector(camera.getWorldDirection(new T.Vector3()), -10);
  const ray = new T.Raycaster(origin, point.clone().sub(origin).normalize());
  return ray.intersectObject(model.root, true).find(hit => {
    const o = hit.object;
    if (!o.isMesh || o.material.transparent && o.material.opacity < 0.5) return false;
    for (let n = o; n; n = n.parent) if (!n.visible || n.userData.environment) return false;
    return true;
  })?.object;
}

test('SCARA: real controller snapshots retain exact FK, path heights, fixed-size mounted payloads and shell buffers', () => {
  const { def, P } = controller('track'), model = createResearchModel('track');
  const shells = ['upper-link-shell', 'forearm-link-shell'].map(n => part(model, n));
  const identities = shells.map(s => [s.geometry, s.geometry.attributes.position, s.geometry.attributes.normal, s.material]);
  const cameraSpec = JSON.stringify(model.camera), camera = createApparatusCamera(model.camera, 1.7213671344499772);
  const checkpoints = [0, 299, 301, 479, 481, 1200], kg = [];
  for (let step = 0; step <= 1200; step++) {
    if (checkpoints.includes(step)) {
      const state = def.visualState(P), saved = JSON.stringify(state);
      model.update(state); model.root.updateMatrixWorld(true);
      const tip = model.root.getObjectByName('tool-tip').getWorldPosition(new T.Vector3());
      near(tip.x, state.lengths[0] * Math.cos(state.q[0]) + state.lengths[1] * Math.cos(state.q[0] + state.q[1]), 'FK X', 1e-12);
      near(tip.z, state.lengths[0] * Math.sin(state.q[0]) + state.lengths[1] * Math.sin(state.q[0] + state.q[1]), 'FK Z', 1e-12);
      near(tip.y, 0.96, 'constant presentation height');
      assertCompleteToolClear(model, `default t=${state.time}, payload=${state.payload}`);
      assertPlanarProjection(model, state);
      for (const [name, points] of [['unloaded-trajectory', state.unloadedTrail], ['measured-trajectory', state.trail]]) {
        const pos = model.root.getObjectByName(name).geometry.attributes.position;
        assert.equal(pos.count, points.length);
        for (let i = 0; i < points.length; i++) {
          near(pos.getX(i), points[i].x, 'retained path X'); near(pos.getY(i), .06, 'retained path Y'); near(pos.getZ(i), points[i].y, 'retained path Z');
        }
      }
      const plates = model.root.getObjectByName('payload').children.filter(p => p.visible);
      kg.push(state.payload); assert.equal(plates.length, state.payload / 5);
      const fixture = bounds(part(model, 'tool-mass-fixture')), spindle = bounds(part(model, 'tool-mass-spindle'));
      for (const plate of plates) {
        const b = bounds(plate);
        assert(b.min.y >= fixture.max.y - 1e-6 && b.max.y < spindle.max.y, 'mass is above its fixture and seated around the retained spindle');
        assert.deepEqual(plate.scale.toArray(), [1, 1, 1]);
        // Probe a camera-facing rim point, not the empty central bore.
        const centre = plate.getWorldPosition(new T.Vector3());
        const facing = camera.position.clone().sub(centre); facing.y = 0; facing.normalize();
        const hit = firstOpaque(model, camera, centre.addScaledVector(facing, .105));
        assert(hit?.name.startsWith('payload-plate-'), `mass stack is not hidden by an arm housing: ${hit?.name}`);
      }
      shells.forEach((s, i) => [s.geometry, s.geometry.attributes.position, s.geometry.attributes.normal, s.material]
        .forEach((value, j) => assert.strictEqual(value, identities[i][j], 'persistent shell and attribute identity')));
      assert.equal(JSON.stringify(state), saved); assert.equal(JSON.stringify(model.camera), cameraSpec);
    }
    if (step < 1200) def.advance(P, 1 / 60);
  }
  assert.deepEqual(kg, [0, 0, 15, 15, 20, 20]);
});

test('contact: real approach and compression expose the force cell and physical probe from the production camera', () => {
  const { def, P } = controller('contact'), model = createResearchModel('contact');
  const camera = createApparatusCamera(model.camera, 1.7213671344499772);
  let firstContact = false, samples = 0;
  for (let step = 0; step <= 361; step++) {
    const state = def.visualState(P);
    if (!step || state.force > 0 && !firstContact || step % 30 === 0) {
      firstContact ||= state.force > 0; samples++;
      model.update(state); model.root.updateMatrixWorld(true);
      const sensor = part(model, 'force-sensor'), pad = part(model, 'contact-pad');
      assert.equal(firstOpaque(model, camera, sensor.getWorldPosition(new T.Vector3())), sensor, 'unobstructed force cell');
      for (const y of [-.045, 0, .045]) {
        const point = pad.localToWorld(new T.Vector3(0, y, .095));
        assert.equal(firstOpaque(model, camera, point), pad, 'probe silhouette is not covered by fixed support or wall');
      }
      const tip = model.root.getObjectByName('tool-tip');
      near(tip.position.x, .65 + 12 * Math.max(-.03, Math.min(.055, state.position)), '12x travel');
      near(tip.position.y, .67, 'fixed contact height'); near(tip.position.z, 0, 'single motion axis');
      const wall = model.root.getObjectByName('contact-wall');
      near(wall.position.x, .65 + 12 * Math.max(-.03, Math.min(.055, Math.max(state.wall, state.position))), 'real wall compression');
    }
    if (!def.done(P)) def.advance(P, 1 / 60);
  }
  assert(firstContact && samples > 10);
});
const bounds = mesh => new T.Box3().setFromObject(mesh);
function part(model, name) {
  const node = model.root.getObjectByName(name);
  assert(node?.isMesh, `${name} must be real volumetric geometry`);
  return node;
}

// Actual triangle crossings, not an AABB-overlap collision claim. Each mesh is
// closed; duplicate triangle-edge hits collapse before inside intervals pair.
function intervals(mesh, x, z) {
  const side = mesh.material.side; mesh.material.side = T.DoubleSide;
  const hits = new T.Raycaster(new T.Vector3(x, 4, z), new T.Vector3(0, -1, 0))
    .intersectObject(mesh, false).map(hit => hit.point.y).sort((a, b) => a - b)
    .filter((y, i, values) => !i || y - values[i - 1] > 1e-6);
  mesh.material.side = side;
  return hits.flatMap((y, i) => i % 2 ? [] : [[y, hits[i + 1] ?? y]]);
}
function interiorOverlap(a, b) {
  const overlap = bounds(a).intersect(bounds(b));
  if (overlap.isEmpty()) return null;
  for (let i = 1; i < 13; i++) for (let j = 1; j < 13; j++) {
    const x = T.MathUtils.lerp(overlap.min.x, overlap.max.x, i / 13);
    const z = T.MathUtils.lerp(overlap.min.z, overlap.max.z, j / 13);
    for (const [a0, a1] of intervals(a, x, z)) for (const [b0, b1] of intervals(b, x, z)) {
      if (Math.min(a1, b1) - Math.max(a0, b0) > 0.001) return { x, z, a: [a0, a1], b: [b0, b1] };
    }
  }
  return null;
}

// Enumerate every mesh, even currently unmounted payload plates. Neither
// visibility nor an environment/annotation tag can exempt structural solids.
function toolSolids(model) {
  const meshes = [];
  model.root.getObjectByName('tool-tip').traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const name of ['tool-stylus', 'tool-collet', 'wrist', 'tool-mass-fixture', 'tool-mass-spindle',
    'payload-plate-1', 'payload-plate-2', 'payload-plate-3', 'payload-plate-4']) {
    assert(meshes.includes(part(model, name)), `${name}: no missing distal solid`);
  }
  for (const mesh of meshes) {
    for (let n = mesh; n; n = n.parent) assert(!n.userData.environment && !n.userData.annotation, `${mesh.name}: physical hardware`);
    assert.equal(mesh.material.transparent, false, `${mesh.name}: do not hide structural solids`);
    assert.equal(mesh.material.opacity, 1);
    if (!mesh.name.startsWith('payload-plate-')) assert(mesh.visible, `${mesh.name}: visible tool`);
  }
  return meshes;
}
function upstreamSolids(model) {
  const meshes = [], elbow = model.root.getObjectByName('elbow');
  for (const name of ['shoulder', 'robot-base']) model.root.getObjectByName(name).traverse(o => {
    if (!o.isMesh) return;
    for (let n = o; n; n = n.parent) if (n === elbow) return;
    meshes.push(o);
  });
  for (const name of ['upper-link-shell', 'shoulder-servo', 'shoulder-encoder']) assert(meshes.includes(part(model, name)));
  return meshes;
}
function assertCompleteToolClear(model, scenario) {
  const upstream = upstreamSolids(model), distal = toolSolids(model);
  // Ray-test intersecting boxes first so the regression reports real solid
  // penetration, not an AABB collision claim or renderer-supplied witness.
  for (const a of upstream) for (const b of distal) {
    const collision = interiorOverlap(a, b);
    assert.equal(collision, null, `${scenario}: ${a.name}/${b.name}: ${JSON.stringify(collision)}`);
  }
  // Stronger, continuous clearance proof: actual mesh extrema are separated
  // along invariant world Y. Both plant joints rotate only about that axis.
  // This is presentation geometry clearance, NOT collision-response physics.
  const top = Math.max(...upstream.map(o => bounds(o).max.y));
  for (const mesh of distal) assert(bounds(mesh).min.y - top >= 0.02,
    `${scenario}: ${mesh.name} must clear the complete upstream envelope by 0.02`);
  const pin = part(model, 'tool-stylus'), collet = part(model, 'tool-collet'), wrist = part(model, 'wrist');
  const p = bounds(pin), c = bounds(collet), w = bounds(wrist);
  assert(p.max.y - p.min.y <= .10, 'a short solid pin, not a rod to the trajectory plane');
  assert(p.min.y < c.min.y - .01 && c.min.y < w.min.y - .02, 'exposed tip and collar, not hidden inside the wrist');
  const ray = model.root.getObjectByName('tool-tip').localToWorld(new T.Vector3(.0037, 0, .0029));
  for (const [a, b] of [[pin, collet], [collet, wrist], [wrist, part(model, 'forearm-link-shell')]]) {
    assert(intervals(a, ray.x, ray.z).some(([a0, a1]) => intervals(b, ray.x, ray.z)
      .some(([b0, b1]) => Math.min(a1, b1) - Math.max(a0, b0) > .001)),
    `${scenario}: actual solid mounting contact ${a.name}/${b.name}`);
  }
}

function assertPlanarProjection(model, state) {
  const annotation = model.root.getObjectByName('tool-planar-projection');
  const guide = model.root.getObjectByName('tool-projection-guide');
  const marker = model.root.getObjectByName('tool-planar-marker');
  assert(guide?.isLine && guide.material.isLineDashedMaterial, 'projection must be a genuinely dashed Three.Line, never a solid rod');
  assert(marker?.isLine && !marker.material.isLineDashedMaterial, 'small planar marker must be a line annotation, not hardware');
  assert(annotation?.userData.annotation && !annotation.userData.environment, 'explicit nonphysical annotation, not hidden environment');
  annotation.traverse(o => {
    assert(!o.isMesh && o.visible && !o.castShadow && !o.receiveShadow, 'projection has no solid, hidden or shadow-casting parts');
  });
  assert(guide.material.dashSize > 0 && guide.material.gapSize > 0);
  assert.equal(guide.geometry.getAttribute('lineDistance').count, 2, 'GPU dash distances are real');
  const positions = guide.geometry.getAttribute('position');
  assert.equal(positions.count, 2);
  const ends = [0, 1].map(i => guide.localToWorld(new T.Vector3().fromBufferAttribute(positions, i))).sort((a, b) => a.y - b.y);
  const expected = new T.Vector3(
    state.lengths[0] * Math.cos(state.q[0]) + state.lengths[1] * Math.cos(state.q[0] + state.q[1]),
    .06, state.lengths[0] * Math.sin(state.q[0]) + state.lengths[1] * Math.sin(state.q[0] + state.q[1]));
  for (const point of [ends[0], marker.getWorldPosition(new T.Vector3())]) {
    point.toArray().forEach((value, i) => near(value, expected.getComponent(i), 'exact actual FK projection on Y=.06', 1e-12));
  }
  near(ends[1].x, expected.x, 'guide begins directly under actual tool X', 1e-12);
  near(ends[1].z, expected.z, 'guide begins directly under actual tool Z', 1e-12);
  const pin = part(model, 'tool-stylus'), vertices = pin.geometry.getAttribute('position');
  const physicalEnd = Array.from({ length: vertices.count }, (_, i) =>
    pin.localToWorld(new T.Vector3().fromBufferAttribute(vertices, i))).sort((a, b) => a.y - b.y)[0];
  near(physicalEnd.x, expected.x, 'physical pin endpoint retains actual FK X', 1e-12);
  near(physicalEnd.z, expected.z, 'physical pin endpoint retains actual FK Z', 1e-12);
  near(physicalEnd.y, .81, 'short physical tool has constant presentation height');
  near(ends[1].y, physicalEnd.y, 'projection starts at the actual solid endpoint');
  const markerPoints = marker.geometry.getAttribute('position');
  const elbow = model.root.getObjectByName('elbow').getWorldPosition(new T.Vector3());
  let marksEndpoint = false;
  for (let i = 0; i < markerPoints.count; i++) {
    const p = marker.localToWorld(new T.Vector3().fromBufferAttribute(markerPoints, i));
    near(p.y, .06, 'every marker vertex lies on the unchanged measured-path plane', 1e-12);
    assert(Math.hypot(p.x - expected.x, p.z - expected.z) <= .05, 'small planar marker, not a replacement trajectory');
    assert(Math.hypot(p.x - elbow.x, p.z - elbow.z) <= state.lengths[1] + 1e-12,
      'annotation stays within the existing continuous workspace and camera budget');
    marksEndpoint ||= p.distanceTo(expected) < 1e-12;
  }
  assert(marksEndpoint, 'marker has an actual vertex at the exact projected endpoint');
}

test('SCARA: nonphysical planar projection maps the connected short tool to exact FK without changing any path', () => {
  const { def, P: defaults } = controller('track'), model = createResearchModel('track');
  const P = Object.freeze({ ...defaults, law: 'pd', kp: 10, kd: 20, h: .1, m: 3 });
  def.reset(P); for (let step = 0; step < 72; step++) def.advance(P, 1 / 60);
  const critical = def.visualState(P);
  const states = [critical];
  for (const payload of [0, 15, 20]) for (const q of [[0, 0], [0, 3], [0, Math.PI], [1.3, -Math.PI]]) {
    states.push(Object.freeze({ ...critical, q: Object.freeze(q), payload }));
  }
  let identities;
  for (const state of states) {
    const saved = JSON.stringify(state);
    model.update(state); model.root.updateMatrixWorld(true);
    assertCompleteToolClear(model, `projection q=${JSON.stringify(state.q)}, payload=${state.payload}`);
    assertPlanarProjection(model, state);
    const nodes = ['tool-projection-guide', 'tool-planar-marker'].map(name => model.root.getObjectByName(name));
    const current = nodes.flatMap(o => [o, o.geometry, o.geometry.getAttribute('position'), o.material]);
    if (identities) current.forEach((value, i) => assert.strictEqual(value, identities[i], 'persistent annotation buffers/materials'));
    else identities = current;
    for (const [name, points] of [['unloaded-trajectory', state.unloadedTrail], ['measured-trajectory', state.trail]]) {
      const expected = new Float32Array(points.flatMap(p => [p.x, .06, p.y]));
      assert.deepEqual(model.root.getObjectByName(name).geometry.getAttribute('position').array, expected, `${name}: unchanged entire path`);
    }
    const c = state.circle, reference = new Float32Array(Array.from({ length: 129 }, (_, i) => {
      const a = i * 2 * Math.PI / 128; return [c.x + c.r * Math.cos(a), .05, c.y + c.r * Math.sin(a)];
    }).flat());
    assert.deepEqual(model.root.getObjectByName('target-trajectory').geometry.getAttribute('position').array, reference);
    assert.equal(JSON.stringify(state), saved);
  }
  assert.match(model.legend.en, /nonphysical projection/i);
  assert.match(model.legend.en, /no vertical degree of freedom/i);
  assert.match(model.legend.en, /no collision physics/i);
  assert.match(model.legend.ko, /비물리적.*투영/);
  assert.match(model.legend.ko, /수직 자유도/);
  assert.match(model.legend.ko, /충돌 동역학/);
  assert.deepEqual(model.readouts()[0].label, { en: 'Horizontal plane · payload', ko: '수평면 · 말단 질량' });
  assert.equal(model.readouts()[0].retainLabel, true);
});

test('SCARA: complete distal solids clear the real supported PD low-gain/delay trajectory', () => {
  const { def, P: defaults } = controller('track'), model = createResearchModel('track');
  const setting = { law: 'pd', kp: 10, kd: 20, h: .1, m: 3 }, P = Object.freeze({ ...defaults, ...setting });
  for (const id of ['kp', 'kd', 'h', 'm']) {
    const c = def.controls.find(c => c.id === id), read = v => c.read ? c.read(v) : v;
    assert(P[id] >= read(c.min) && P[id] <= read(c.max), `${id}: supported slider setting`);
  }
  def.reset(P);
  for (let step = 0; step < 72; step++) { assert(!def.done(P)); def.advance(P, 1 / 60); }
  const critical = def.visualState(P);
  assert(!def.done(P), 'the independently reproduced snapshot is an actual nonterminated run');
  near(critical.time, 1.2, 'reviewed real snapshot time', 1e-12);
  near(critical.q[0], -1.4769669017288185, 'reviewed real shoulder', 1e-12);
  near(critical.q[1], 2.9693734969654457, 'reviewed real elbow', 1e-12);
  model.update(critical); model.root.updateMatrixWorld(true);
  assertCompleteToolClear(model, `PD kp=10 kd=20 h=.1 m=3 t=${critical.time}`);
  def.reset(P);
  let samples = 0;
  for (let step = 0; step <= 1201; step++) {
    const state = def.visualState(P), saved = JSON.stringify(state);
    assert(Object.isFrozen(state) && Object.isFrozen(state.q));
    model.update(state); model.root.updateMatrixWorld(true);
    assertCompleteToolClear(model, `PD low-gain/delay t=${state.time}`); samples++;
    assert.equal(JSON.stringify(state), saved);
    if (def.done(P)) break;
    def.advance(P, 1 / 60);
  }
  assert(samples > 72 && def.done(P), 'include reset, every frame and the real terminal snapshot');
});

test('SCARA: reset and analytical fully folded housings do not occupy the same solid interior', () => {
  const { def, P } = controller('track'), model = createResearchModel('track');
  const state = def.visualState(P);
  for (const payload of [0, 15, 20]) for (const q of [state.q, [0, 2.7], [0, 3], [0, Math.PI], [1.3, -Math.PI]]) {
    model.update(Object.freeze({ ...state, q: Object.freeze(q), payload })); model.root.updateMatrixWorld(true);
    assertCompleteToolClear(model, `analytical q=${JSON.stringify(q)}, payload=${payload}`);
    for (const first of ['upper-link-shell', 'shoulder-servo', 'shoulder-encoder']) {
      for (const second of [part(model, 'forearm-link-shell'), ...toolSolids(model)]) {
        const collision = interiorOverlap(part(model, first), second);
        assert.equal(collision, null, `${first}/${second.name} at ${JSON.stringify(q)}: ${JSON.stringify(collision)}`);
      }
    }
  }
});

test('contact: all supported controller slider corners preserve the single moving assembly and clear fixed castings', () => {
  const { def, P: defaults } = controller('contact'), model = createResearchModel('contact');
  const settings = [];
  for (const mode of ['admittance', 'impedance']) {
    let corners = [{ ...defaults, mode }];
    for (const id of mode === 'admittance' ? ['md', 'dd', 'kd', 'ke', 'h'] : ['dd', 'kd', 'ke', 'h']) {
      const c = def.controls.find(c => c.id === id);
      corners = corners.flatMap(P => [c.min, c.max].map(v => ({ ...P, [id]: c.read ? c.read(v) : v })));
    }
    settings.push(...corners);
  }
  assert.equal(settings.length, 48);
  const support = model.root.getObjectByName('fixed-articulated-support');
  model.root.updateMatrixWorld(true);
  const fixed = new Map(); support.traverse(o => fixed.set(o, o.matrixWorld.toArray()));
  let snapshots = 0, clipped = 0;
  for (const P of settings) {
    Object.freeze(P); def.reset(P); def.tune(P);
    for (let step = 0; step <= 362; step++) {
      if (step % 30 === 0 || def.done(P)) {
        const state = def.visualState(P), saved = JSON.stringify(state);
        model.update(state); model.root.updateMatrixWorld(true); snapshots++;
        const tip = model.root.getObjectByName('tool-tip');
        near(tip.position.x, .65 + 12 * Math.max(-.03, Math.min(.055, state.position)), 'display clipping is not physical travel');
        near(tip.position.y, .67, 'constant Y'); near(tip.position.z, 0, 'constant Z');
        assert.equal(model.readouts().find(r => r.id === 'position').value, `${(state.position * 1000).toFixed(2)} mm`);
        assert.equal(model.readouts().find(r => r.id === 'force').value, `${state.force.toFixed(2)} N`);
        for (const [o, matrix] of fixed) assert.deepEqual(o.matrixWorld.toArray(), matrix, `${o.name} remains fixed`);
        for (const name of ['linear-carrier-shell', 'linear-drive-housing', 'support-link-shell-2']) {
          assert.equal(interiorOverlap(part(model, 'carriage'), part(model, name)), null, 'moving saddle clears fixed castings');
        }
        if (state.position < -.03 || state.position > .055) clipped++;
        assert.equal(JSON.stringify(state), saved);
      }
      if (def.done(P)) break;
      def.advance(P, 1 / 60);
    }
  }
  assert(snapshots > 200 && clipped > 0, 'include real stable and divergent pre-termination snapshots');
});

test('SCARA: the default three-quarter view reveals the horizontal link layers', () => {
  const model = createResearchModel('track');
  const direction = new T.Vector3().fromArray(model.camera.position)
    .sub(new T.Vector3().fromArray(model.camera.target)).normalize();
  assert(direction.y >= 0.35, 'view must improve the horizontal-layer view without sacrificing full-workspace coverage');
});

test('SCARA: cast shells occupy separate horizontal layers connected by an axial bearing and shaft', () => {
  const { def, P } = controller('track'), model = createResearchModel('track');
  const state = def.visualState(P);
  model.update(state); model.root.updateMatrixWorld(true);
  const upper = part(model, 'upper-link-shell'), lower = part(model, 'forearm-link-shell');
  for (const shell of [upper, lower]) {
    assert(shell.geometry.getAttribute('position').count > 1000, 'closed smooth cast shell, not box beams');
    assert(shell.geometry.index?.count > 6000);
    assert.deepEqual(shell.scale.toArray(), [1, 1, 1], 'joint caps are not stretched with the link');
    assert.equal(shell.material.userData.finish, 'paint');
  }
  const a = bounds(upper), b = bounds(lower);
  assert(b.min.y - a.max.y >= 0.045, 'independently moving shells need a genuine vertical clearance');
  const shaft = bounds(part(model, 'elbow-shaft'));
  assert(shaft.min.y <= a.max.y && shaft.max.y >= b.min.y, 'actual metal shaft bridges the two layers');
  const bearing = bounds(part(model, 'elbow-bearing'));
  assert(bearing.min.y < b.min.y && bearing.max.y > a.max.y, 'bearing occupies the inter-layer mounting gap');
  const fixed = bounds(part(model, 'base-column'));
  assert(fixed.max.y <= a.min.y + 1e-6, 'first moving shell clears the stationary base housing');
});
