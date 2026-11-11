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
test('contact: a bench-mounted direct-drive stage has a continuous load path and no rotary-arm silhouette', () => {
  const { def, P } = controller('contact'), model = createResearchModel('contact');
  model.update(def.visualState(P)); model.root.updateMatrixWorld(true);
  model.root.traverse(o => assert(!/articulated|support-link|support-joint|locking-plate|linear-carrier-shell|base-column/.test(o.name),
    `${o.name}: a scalar contact plant must not look like a locked rotary robot`));
  const fixed = model.root.getObjectByName('fixed-linear-stage');
  assert(fixed?.isGroup, 'one fixed bench stage, not articulated links');
  // Actual triangle crossings at mounting faces, not overlapping AABBs.
  const seated = (lower, upper, x, z) => {
    const a = intervals(part(model, lower), x, z), b = intervals(part(model, upper), x, z);
    assert(a.some(([lo, hi]) => b.some(([bottom, top]) =>
      Math.min(hi, top) >= Math.max(lo, bottom) - 1e-6)), `${lower}/${upper}: solid mounting contact`);
  };
  for (const [foundation, foot, x] of [['test-bed', 'stage-left-foot', -.24], ['wall-foot', 'stage-right-foot', 1.14]]) {
    for (const dx of [-.025, .025]) for (const z of [-.08, .08]) {
      seated(foundation, foot, x + dx, z);
      seated(foot, 'linear-rail-bed', x + dx, z);
    }
  }
  for (const z of [-.13, .13]) for (const x of [-.26, 1.17]) {
    const suffix = `${x < 0 ? 'left' : 'right'}-${z < 0 ? 'rear' : 'front'}`;
    seated('linear-rail-bed', `rail-end-support-${suffix}`, x + .009, z + .008);
    seated(`rail-end-support-${suffix}`, `linear-guide-${z < 0 ? 'rear' : 'front'}`, x + .009, z + .008);
  }
  for (const x of [-.1, .5, 1.05]) seated('linear-rail-bed', 'direct-drive-stator', x, .013);
  const initial = def.visualState(P);
  for (const position of [-.03, -.02, 0, .02, .055]) {
    model.update(Object.freeze({ ...initial, position })); model.root.updateMatrixWorld(true);
    assertContactLoadPath(model);
  }
  const transforms = new Map(); fixed.traverse(o => transforms.set(o, o.matrixWorld.clone()));
  for (let step = 0; step < 361; step++) {
    model.update(def.visualState(P)); model.root.updateMatrixWorld(true);
    for (const [o, matrix] of transforms) assert.deepEqual(o.matrixWorld.elements, matrix.elements, 'linear stage foundation never animates');
    if (!def.done(P)) def.advance(P, 1 / 60);
  }
  assert.match(model.legend.en, /single.axis.*direct.drive/i);
  assert.match(model.legend.en, /admittance.*feedback.*impedance.*measurement only/i);
  assert.match(model.legend.en, /12 times/);
  assert.match(model.legend.ko, /직동/);
  assert.match(model.legend.ko, /어드미턴스.*피드백.*임피던스.*측정/);
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

test('contact: the sensor lead terminates on the translating carriage rather than floating above it', () => {
  const { def, P } = controller('contact'), model = createResearchModel('contact');
  model.update(def.visualState(P)); model.root.updateMatrixWorld(true);
  const loom = part(model, 'sensor-cable-loom');
  const endpoint = loom.localToWorld(loom.geometry.parameters.path.getPoint(1));
  assert(intervals(part(model, 'carriage'), endpoint.x, endpoint.z).some(([lo, hi]) => endpoint.y > lo && endpoint.y < hi),
    'the cable return must terminate inside its moving mounting block');
});

test('contact: the static camera centers the compact bench and frames the full permitted stroke', () => {
  const { def, P } = controller('contact'), model = createResearchModel('contact');
  const initial = def.visualState(P), specification = JSON.stringify(model.camera);
  for (const D of [{ w: 780, h: 620 }, { w: 380, h: 1010 }]) {
    const box = def.visualBox(D), camera = createApparatusCamera(model.camera, box.w / box.h);
    model.update(initial); model.root.updateMatrixWorld(true);
    const vertices = part(model, 'test-bed').geometry.getAttribute('position');
    const xs = Array.from({ length: vertices.count }, (_, i) => new T.Vector3().fromBufferAttribute(vertices, i)
      .applyMatrix4(part(model, 'test-bed').matrixWorld).project(camera).x);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    assert(Math.abs(mid) < .08, `center the shorter bench instead of reserving space for a removed arm: ${mid}`);
    assert(Math.max(...xs) - Math.min(...xs) > .85, 'retain the existing minimum compact-view framing budget');
    for (const position of [-.03, -.02, 0, .02, .055]) for (const mode of ['admittance', 'impedance']) {
      for (const command of [-125, 125]) {
        model.update(Object.freeze({ ...initial, position, mode, reference: position, force: 125, command }));
        model.root.updateMatrixWorld(true);
        model.root.traverseVisible(o => {
          if (!o.geometry) return;
          for (let n = o; n; n = n.parent) if (n.userData.environment) return;
          const positions = o.geometry.getAttribute('position');
          for (let i = 0; i < positions.count; i++) {
            const p = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(o.matrixWorld).project(camera);
            assert(p.toArray().every(Number.isFinite) && Math.abs(p.x) <= .98 && Math.abs(p.y) <= .98 && Math.abs(p.z) <= 1,
              `${o.name}: full carriage/wall travel must fit with margins: ${p.toArray()}`);
          }
        });
        assert.equal(JSON.stringify(model.camera), specification, 'no state-dependent camera refit');
      }
    }
  }
});

test('contact: real approach and compression expose the force cell and physical probe from the production camera', () => {
  const { def, P: defaults } = controller('contact'), model = createResearchModel('contact');
  const cameras = [{ w: 780, h: 620 }, { w: 380, h: 1010 }].map(D => {
    const box = def.visualBox(D); return createApparatusCamera(model.camera, box.w / box.h);
  });
  for (const mode of ['admittance', 'impedance']) {
    const P = Object.freeze({ ...defaults, mode }); def.reset(P); def.tune(P);
    let firstContact = false, samples = 0;
    for (let step = 0; step <= 361; step++) {
      const state = def.visualState(P), saved = JSON.stringify(state);
      if (!step || state.force > 0 && !firstContact || step % 30 === 0) {
        firstContact ||= state.force > 0; samples++;
        model.update(state); model.root.updateMatrixWorld(true);
        const sensor = part(model, 'force-sensor'), pad = part(model, 'contact-pad');
        for (const camera of cameras) {
          assert.equal(firstOpaque(model, camera, sensor.getWorldPosition(new T.Vector3())), sensor, 'unobstructed force cell');
          for (const x of [-.012, 0, .012]) for (const y of [-.05, 0, .05]) {
            const point = pad.localToWorld(new T.Vector3(x, y, .098));
            assert.equal(firstOpaque(model, camera, point), pad, 'probe silhouette is not covered by the stage or wall');
          }
        }
        const tip = model.root.getObjectByName('tool-tip');
        near(tip.position.x, .65 + 12 * Math.max(-.03, Math.min(.055, state.position)), '12x travel');
        near(tip.position.y, .67, 'fixed contact height'); near(tip.position.z, 0, 'single motion axis');
        const wall = model.root.getObjectByName('contact-wall');
        near(wall.position.x, .65 + 12 * Math.max(-.03, Math.min(.055, Math.max(state.wall, state.position))), 'real wall compression');
        assert.equal(JSON.stringify(state), saved, 'visibility checks do not mutate frozen plant snapshots');
      }
      if (!def.done(P)) def.advance(P, 1 / 60);
    }
    assert(firstContact && samples > 10, `${mode}: include reset, first contact and representative compression`);
  }
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
function axialIntervals(mesh, y, z) {
  const side = mesh.material.side; mesh.material.side = T.DoubleSide;
  const hits = new T.Raycaster(new T.Vector3(4, y, z), new T.Vector3(-1, 0, 0))
    .intersectObject(mesh, false).map(hit => hit.point.x).sort((a, b) => a - b)
    .filter((x, i, values) => !i || x - values[i - 1] > 1e-6);
  mesh.material.side = side;
  return hits.flatMap((x, i) => i % 2 ? [] : [[x, hits[i + 1] ?? x]]);
}
function assertContactLoadPath(model) {
  const tip = model.root.getObjectByName('tool-tip').position;
  const saddle = part(model, 'carriage-saddle'), carriage = part(model, 'carriage');
  const stator = part(model, 'direct-drive-stator'), forcer = part(model, 'direct-drive-forcer');
  const seated = (a, b, x, z) => assert(intervals(a, x, z).some(([lo, hi]) =>
    intervals(b, x, z).some(([bottom, top]) => Math.min(hi, top) - Math.max(lo, bottom) > .001)),
  `${a.name}/${b.name}: connected actual solids`);
  for (const side of ['rear', 'front']) {
    const rail = part(model, `linear-guide-${side}`), bearing = part(model, `carriage-bearing-${side}`);
    const centre = bearing.getWorldPosition(new T.Vector3());
    const r = bounds(rail), b = bounds(bearing);
    assert(r.min.x < b.min.x - .02 && r.max.x > b.max.x + .02, 'bearing remains on its guide throughout permitted travel');
    near(centre.y, .255, 'bearing and guide share the fixed centreline');
    assert.deepEqual(axialIntervals(bearing, centre.y + .005, centre.z + .004), [], 'actual through bore, not a rod buried inside a solid block');
    assert(axialIntervals(rail, centre.y + .005, centre.z + .004).length, 'guide passes through the bearing bore');
    assert(axialIntervals(bearing, centre.y + .04, centre.z + .006).length, 'bearing has an actual load-bearing sleeve');
    // The running fit touches the real triangulated bore within 0.1 mm;
    // this is visual mounting clearance, not an added contact-physics model.
    for (const z of [centre.z - .008, centre.z + .008]) {
      const sleeve = intervals(bearing, centre.x + .013, z), guide = intervals(rail, centre.x + .013, z);
      assert.equal(sleeve.length, 2); assert.equal(guide.length, 1);
      near(sleeve[0][1], guide[0][0], 'lower running fit', .0001);
      near(sleeve[1][0], guide[0][1], 'upper running fit', .0001);
      seated(bearing, saddle, centre.x + .013, z);
    }
  }
  for (const z of [-.03, .03]) {
    seated(saddle, carriage, tip.x - .32, z);
    seated(forcer, saddle, tip.x - .32, z);
  }
  const a = bounds(stator), b = bounds(forcer);
  assert(b.min.y - a.max.y > .01 && b.min.y - a.max.y < .03, 'direct-drive air gap, no screw or rotary motor');
  assert(a.min.x < b.min.x && a.max.x > b.max.x, 'forcer stays over its stator for the whole stroke');
  for (const [dy, z] of [[.009, .011], [-.013, -.009]]) {
    const chain = ['carriage', 'tool-shaft', 'force-sensor', 'contact-pad']
      .map(name => axialIntervals(part(model, name), tip.y + dy, z));
    assert(chain.every(spans => spans.length === 1), 'solid carriage/shaft/cell/pad sections');
    for (let i = 1; i < chain.length; i++) assert(chain[i][0][0] <= chain[i - 1][0][1] + 1e-6,
      'no floating shaft, force cell or contact pad');
    near(chain.at(-1)[0][1], tip.x, 'pad contact face remains the exact model-mapped tool X');
  }
  for (const fixed of ['linear-rail-bed', 'direct-drive-stator', 'rail-end-support-left-front', 'rail-end-support-right-front',
    'rail-end-support-left-rear', 'rail-end-support-right-rear']) {
    for (const moving of ['carriage', 'carriage-saddle', 'direct-drive-forcer', 'force-sensor', 'contact-pad']) {
      assert.equal(interiorOverlap(part(model, fixed), part(model, moving)), null, `${moving} clears ${fixed}`);
    }
    assert.equal(interiorOverlap(part(model, fixed), part(model, 'wall-face')), null, `${fixed} clears the deforming wall`);
  }
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

test('contact: all supported controller slider corners preserve the single moving assembly and clear the fixed stage', () => {
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
  const support = model.root.getObjectByName('fixed-linear-stage');
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
        for (const name of ['linear-rail-bed', 'direct-drive-stator', 'stage-left-foot', 'stage-right-foot']) {
          assert.equal(interiorOverlap(part(model, 'carriage'), part(model, name)), null, 'moving saddle clears the fixed stage');
        }
        assertContactLoadPath(model);
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
