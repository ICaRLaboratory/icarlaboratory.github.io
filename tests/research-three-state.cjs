// Run: node --test tests/research-three-state.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
const vm = require('node:vm');
const root = resolve(__dirname, '..');
const source = name => readFileSync(resolve(root, 'assets', name), 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');

function models(withoutVisual = false, observePlant) {
  const context = vm.createContext({ document: { addEventListener() {} } });
  vm.runInContext(source('sim.js'), context);
  vm.runInContext('globalThis.defs = {}; SIM.register = d => { defs[d.id] = d; };', context);
  vm.runInContext(source('sim-arm-plant.js'), context);
  observePlant?.(vm.runInContext('ARMPLANT', context));
  for (const file of ['sim-tracking.js', 'sim-contact.js']) {
    const code = source(file);
    vm.runInContext(withoutVisual ? stripVisual(code) : code, context);
  }
  return context.defs;
}
function stripVisual(code) {
  return code.replace(/\n    \/\* Read-only 3D projection\. \*\/[\s\S]*?    \/\* End 3D projection\. \*\/\n/, '');
}
const defaults = def => Object.fromEntries(def.controls.map(c => [c.id, c.read ? c.read(c.value) : c.value]));
const plain = value => JSON.parse(JSON.stringify(value));

for (const settings of [
  { law: 'pd' }, { law: 'smc' }, { law: 'tdc' },
  { law: 'asmc', algo: 'quasi' }, { law: 'asmc', algo: 'sigvar' },
]) {
  test(`track ${settings.law}${settings.algo ? '/' + settings.algo : ''}: completed run retains the exact unloaded lap separately from the rolling path`, () => {
    let A, actual;
    const def = models(false, plant => {
      A = plant;
      const integrate = A.integrate;
      // Observe the real history without replacing the plant or its clock.
      A.integrate = (state, ...args) => { actual = state; return integrate(state, ...args); };
    }).track;
    const P = { ...defaults(def), ...settings }, controls = plain(P);
    def.reset(P);
    let firstLap, firstLapCopy, steps = 0;
    while (!def.done(P) && steps++ < 6000) {
      def.advance(P, 1 / 60);
      if (!firstLap && actual.simT >= A.T_LOAD) {
        firstLap = def.visualState(P);
        firstLapCopy = plain(firstLap);
      }
    }
    assert(steps < 6000 && actual.simT >= A.WINDOW, 'all laws must finish the real run');
    const hist = actual.hist;
    const cut = hist.length > A.TRAIL ? hist[hist.length - A.TRAIL][0] : 0;
    // These inclusive intervals are the original drawArm path selections.
    const unloadedRows = hist.filter(row => row[0] >= 0 && row[0] <= A.T_LOAD);
    const recentRows = hist.filter(row => row[0] >= Math.max(A.T_LOAD, cut));
    const points = rows => plain(rows.map(row => A.fk([row[1], row[2]])));
    assert(unloadedRows.length > 1 && cut > A.T_LOAD, 'the rolling window has discarded the first lap');
    const completed = def.visualState(P);
    assert(Array.isArray(completed.unloadedTrail), 'completed snapshot must retain the unloaded measured trajectory');
    assert.deepEqual(plain(completed.unloadedTrail), points(unloadedRows), 'every first-lap measured point, in order');
    assert.deepEqual(plain(completed.unloadedTrail), plain(firstLap.unloadedTrail), 'first lap survives later loaded laps');
    assert.deepEqual(plain(completed.trail), points(recentRows), 'rolling path contains only the recent loaded samples');
    assert.notDeepEqual(plain(completed.unloadedTrail), plain(unloadedRows.map(row => A.ref(row[0]))),
      'the unloaded path is measured, not an ideal reference circle');
    assert.deepEqual(plain(completed.target), plain(A.ref(actual.simT)));
    assert.deepEqual(plain(completed.circle), plain(A.CIRCLE));
    assert.notStrictEqual(completed.unloadedTrail, completed.trail);
    const frozen = value => {
      if (!value || typeof value !== 'object') return;
      assert(Object.isFrozen(value), 'snapshots must be deeply frozen');
      Object.values(value).forEach(frozen);
    };
    frozen(firstLap); frozen(completed);
    const copy = plain(completed), reread = def.visualState(P);
    assert.notStrictEqual(reread.unloadedTrail, completed.unloadedTrail);
    assert.notStrictEqual(reread.unloadedTrail[0], completed.unloadedTrail[0]);
    assert.equal(Reflect.set(completed.unloadedTrail[0], 'x', 999), false);
    assert.deepEqual(plain(def.visualState(P)), copy, 'snapshot reads/mutation attempts cannot change state');
    assert.deepEqual(P, controls);
    assert.deepEqual(plain(firstLap), firstLapCopy, 'later steps cannot mutate the saved first lap');

    def.reset(P);
    const reset = def.visualState(P);
    assert.equal(reset.time, 0);
    assert.deepEqual(plain(reset.unloadedTrail), []);
    assert.deepEqual(plain(reset.trail), []);
    def.advance(P, 1 / 60);
    const restarted = def.visualState(P);
    assert.deepEqual(plain(restarted.unloadedTrail), points(actual.hist), 'new run starts a fresh unloaded path');
    assert.deepEqual(plain(restarted.trail), [], 'loaded rolling path stays empty before the first load');
    assert.deepEqual(plain(completed), copy, 'reset/advance cannot mutate the completed snapshot');
  });
}

for (const id of ['track', 'contact']) {
  test(`${id}: detached frozen snapshots follow real fixed-step state`, () => {
    const def = models()[id], P = defaults(def);
    assert.equal(typeof def.visualState, 'function', 'model needs a read-only visual snapshot');
    def.reset(P); def.tune?.(P);
    const before = def.visualState(P), copy = plain(before);
    assert.equal(Object.isFrozen(before), true);
    if (id === 'track') {
      assert.equal(Object.isFrozen(before.q), true);
      assert.equal(Object.isFrozen(before.trail), true);
      assert.equal(Object.isFrozen(before.target), true);
      assert.deepEqual(plain(before.lengths), [1, 0.85]);
    } else {
      assert.equal(before.position, -0.02);
      assert.equal(before.force, 0);
      assert.equal(before.targetForce, 0);
    }
    for (let i = 0; i < 90; i++) def.advance(P, 1 / 60);
    const after = def.visualState(P);
    assert(after.time > before.time);
    assert.notDeepEqual(plain(after), copy);
    assert.deepEqual(plain(before), copy, 'later steps cannot mutate an earlier snapshot');
    assert.deepEqual(plain(def.visualState(P)), plain(after), 'reading does not advance state');
    assert.deepEqual(P, defaults(def), 'reading does not modify controls');
    if (id === 'track') assert.notDeepEqual(plain(after.q), plain(before.q));
    else assert(after.position > before.position);
  });
}

test('original controllers, parameters, graphs and plant remain byte-identical', () => {
  const pinned = {
    'sim-tracking.js': '3f13f2de1f5f0db8dcf04c16a722801b3854a201774060f540d2a9a458d9d400',
    'sim-contact.js': '39cd0d3af04ae756419321a8608f7bfbe0e8237c53f3639ce1673a2fefdaed54',
    'sim-arm-plant.js': '692c9e3b58f7ffcd9726cca66685a0e4e1a21ebfc5b073906734cdd7097577a6',
  };
  for (const [file, expected] of Object.entries(pinned)) assert.equal(hash(stripVisual(source(file))), expected, file);
});

test('snapshot reads leave every sample and readout identical to the original code', () => {
  const actual = models(), original = models(true);
  const cases = [
    ['track', { law: 'pd' }], ['track', { law: 'smc' }], ['track', { law: 'tdc' }],
    ['track', { law: 'asmc', algo: 'quasi' }], ['track', { law: 'asmc', algo: 'sigvar' }],
    ['track', { law: 'pd', h: 0.075, m: 3 }],
    ['contact', { mode: 'admittance' }], ['contact', { mode: 'impedance' }],
    ['contact', { mode: 'admittance', ke: 1e6, md: 0.5 }],
    ['contact', { mode: 'impedance', h: 0.04, kd: 3000 }],
  ];
  for (const [id, settings] of cases) {
    const a = actual[id], b = original[id], P = { ...defaults(a), ...settings };
    assert.equal(typeof a.visualState, 'function');
    for (const def of [a, b]) { def.reset(P); def.tune?.(P); }
    let steps = 0;
    while (!b.done(P) && steps++ < 6000) {
      a.visualState(P);
      a.advance(P, 1 / 60); b.advance(P, 1 / 60);
      a.visualState(P);
      assert.equal(a.done(P), b.done(P));
      assert.deepEqual(plain(a.live(P)), plain(b.live(P)), `${id} ${JSON.stringify(settings)} sample ${steps}`);
    }
    assert(steps < 6000);
  }
});

test('3D view occupies only the original apparatus, at both canvas breakpoints', () => {
  for (const def of Object.values(models())) {
    assert.equal(typeof def.visualBox, 'function');
    for (const D of [{ w: 780, h: 620 }, { w: 380, h: 1010 }]) {
      const b = def.visualBox(D), wide = D.w >= 700;
      const loop = { x: 0, y: 18, w: D.w, h: wide ? 282 : 412 };
      assert.deepEqual(plain(b), { x: loop.w * 0.40, y: loop.y + loop.h * 0.03,
        w: loop.w * 0.585, h: loop.h * 0.94 });
      assert(b.y + b.h < (wide ? 330 : 460), 'graphs must remain wholly outside the viewport');
    }
  }
});
