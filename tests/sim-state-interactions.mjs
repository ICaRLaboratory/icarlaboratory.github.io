import assert from 'node:assert/strict';

// Real models and DOM clicks; only frame delivery and document visibility are simulated.
export async function runSimStateChecks(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, reducedMotion: 'no-preference' });
  const results = [], errors = [];
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(() => {
    const nativeRequest = window.requestAnimationFrame.bind(window);
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    const frames = new Map();
    let next = -1, now = 0, hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
    window.requestAnimationFrame = callback => {
      if (callback.name !== 'frame') return nativeRequest(callback);
      const id = next--;
      frames.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = id => { if (!frames.delete(id)) nativeCancel(id); };
    window.__simClock = {
      pending: () => frames.size,
      visibility(value) { hidden = value; document.dispatchEvent(new Event('visibilitychange')); },
      tick(count = 1, gap = 1000 / 60) {
        for (let i = 0; i < count; i++) {
          now += gap;
          const batch = [...frames];
          for (const [id, callback] of batch) {
            if (frames.delete(id)) callback(now);
          }
        }
      },
    };
  });
  await page.route('**/assets/sim.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
;(() => {
  const register = SIM.register;
  window.__simStates = {};
  SIM.register = def => {
    const state = window.__simStates[def.id] = { resets: 0, steps: 0, done: false, dt: null };
    const reset = def.reset, advance = def.advance;
    def.reset = function (...args) {
      state.resets++; state.steps = 0;
      const result = reset.apply(this, args);
      state.done = def.done(args[0]);
      return result;
    };
    def.advance = function (...args) {
      state.steps++; state.dt = args[1];
      const result = advance.apply(this, args);
      state.done = def.done(args[0]);
      return result;
    };
    register(def);
  };
})();` });
  });
  const open = async (reducedMotion = 'no-preference') => {
    await page.emulateMedia({ reducedMotion });
    await page.goto(`${base}/research.html`, { waitUntil: 'load' });
    await page.locator('#sim-track-play').waitFor();
  };
  const state = id => page.evaluate(id => ({ ...window.__simStates[id] }), id);
  const tick = (count = 1, gap) => page.evaluate(([count, gap]) => window.__simClock.tick(count, gap), [count, gap]);
  const pending = () => page.evaluate(() => window.__simClock.pending());
  const visibility = hidden => page.evaluate(hidden => window.__simClock.visibility(hidden), hidden);
  const tab = id => page.locator(`#simtab-${id}`).click();
  const play = id => page.locator(`#sim-${id}-play`);
  async function check(name, test) {
    try { await test(); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: error.message }); }
  }
  try {
    await check('Pause survives real panel clicks without resetting either model', async () => {
      await open();
      await tick(12);
      await play('track').click();
      const paused = await state('track');
      await tab('contact');
      await tick(9);
      await play('contact').click();
      const other = await state('contact');
      await tab('track');
      assert.equal(await play('track').textContent(), 'Play', 'explicit Pause must survive a panel round trip');
      await tick(5);
      assert.deepEqual(await state('track'), paused);
      await tab('contact');
      assert.equal(await play('contact').textContent(), 'Play');
      assert.deepEqual(await state('contact'), other);
      assert.equal(await pending(), 0);
    });
    await check('simulated document visibility suppresses newly selected panels and preserves Pause', async () => {
      await open();
      await tick(8);
      await play('track').click();
      const paused = await state('track');
      await visibility(true);
      await tick(3, 60000);
      await visibility(false);
      assert.equal(await play('track').textContent(), 'Play');
      assert.deepEqual(await state('track'), paused);
      await visibility(true);
      await tab('contact');
      assert.equal(await pending(), 0, 'a panel selected while document is simulated hidden must not schedule frames');
      const contact = await state('contact');
      await tick(3, 60000);
      assert.deepEqual(await state('contact'), contact);
      await visibility(false);
      assert.equal(await pending(), 1);
      await tick(1, 60000);
      assert.equal((await state('contact')).steps, contact.steps + 1, 'return advances one fixed step, not elapsed-time catch-up');
    });
    await check('reduced-motion changes preserve paused state and explicit animation invitation', async () => {
      await open();
      await tick(7);
      await play('track').click();
      const paused = await state('track');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      // Allow native MediaQueryList change delivery, not simulated visibility.
      await page.waitForTimeout(100);
      assert.deepEqual(await state('track'), paused, 'motion preference must not reset an explicitly paused run');
      assert.equal(await play('track').textContent(), 'Play');
      assert.equal(await pending(), 0, 'inactive panels must not start on a media change');
      await tab('contact');
      assert.equal(await play('contact').textContent(), 'Replay', 'uninvited reduced-motion panel renders its final state');
      await play('contact').click();
      await tick(4);
      const running = await state('contact');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForTimeout(100);
      assert.deepEqual(await state('contact'), running);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(100);
      assert.deepEqual(await state('contact'), running, 'invited animation survives media changes');
      assert.equal(await pending(), 1);
    });
    await check('reduced-motion first load stays completed when preference changes; unopened panel stays idle', async () => {
      await open('reduce');
      assert.equal(await play('track').textContent(), 'Replay');
      assert.equal(await pending(), 0);
      const completed = await state('track');
      const unopened = await state('contact');
      assert.equal(completed.done, true);
      assert.equal(unopened.steps, 0);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForTimeout(100);
      assert.equal(await pending(), 0, 'media changes must not start an unopened panel');
      assert.deepEqual(await state('track'), completed);
      assert.deepEqual(await state('contact'), unopened);
      await tab('contact');
      assert.equal(await pending(), 1);
      await tick(1);
      assert.equal((await state('contact')).steps, 1);
    });
    await check('simulated hidden playback keeps its Pause action and cannot start a hidden frame chain', async () => {
      await open();
      await tick(5);
      const running = await state('track');
      await visibility(true);
      assert.equal(await play('track').textContent(), 'Pause', 'suspension is not user Pause');
      await play('track').click();
      assert.equal(await play('track').textContent(), 'Play');
      assert.equal(await pending(), 0);
      await play('track').click();
      assert.equal(await pending(), 0, 'Play while simulated hidden records intent without animation');
      await visibility(false);
      assert.equal(await pending(), 1);
      assert.deepEqual(await state('track'), running);
      await tick();
      assert.equal((await state('track')).steps, running.steps + 1);
    });
    await check('first load initializes once and starts only the selected panel', async () => {
      await open();
      assert.equal(await play('track').textContent(), 'Pause');
      assert.equal(await pending(), 1);
      for (const id of ['track', 'contact']) {
        assert.equal((await state(id)).resets, 1);
        assert.equal((await state(id)).steps, 0);
      }
      await tick(3);
      assert.equal((await state('track')).steps, 3);
      assert.equal((await state('track')).dt, 1 / 60);
      assert.equal((await state('contact')).steps, 0);
    });
    await check('running models resume unchanged across repeated real panel clicks and simulated visibility', async () => {
      await open();
      await tick(10);
      for (let i = 0; i < 6; i++) {
        for (const [id, other] of [['track', 'contact'], ['contact', 'track']]) {
          await tab(id);
          const before = await state(id);
          await visibility(true);
          await visibility(true);
          assert.equal(await pending(), 0);
          await tick(2, 60000);
          assert.deepEqual(await state(id), before);
          await visibility(false);
          await visibility(false);
          assert.equal(await pending(), 1, 'repeated resume schedules just one callback');
          await tab(other);
          await tick(2);
          assert.deepEqual(await state(id), before, 'inactive model must not advance');
          await tab(id);
          assert.deepEqual(await state(id), before, 'panel return must not reset');
          assert.equal(await pending(), 1);
          await tick(1, 60000);
          const after = await state(id);
          assert.equal(after.steps, before.steps + 1);
          assert.equal(after.resets, before.resets);
          assert.equal(after.dt, 1 / 60);
        }
      }
    });
    await check('completed models retain Replay across transitions; Replay alone resets them', async () => {
      await open();
      for (const [id, other] of [['track', 'contact'], ['contact', 'track']]) {
        await tab(id);
        await page.evaluate(id => {
          for (let i = 0; i < 6000 && !window.__simStates[id].done; i++) window.__simClock.tick();
        }, id);
        const completed = await state(id);
        assert.equal(completed.done, true, `${id} reaches its real model endpoint`);
        assert.equal(await play(id).textContent(), 'Replay');
        assert.equal(await pending(), 0);
        await tab(other);
        await tick(4);
        await tab(id);
        await visibility(true);
        await tick(2, 60000);
        await visibility(false);
        assert.deepEqual(await state(id), completed);
        assert.equal(await play(id).textContent(), 'Replay');
        assert.equal(await pending(), 0);
        await play(id).click();
        const replay = await state(id);
        assert.equal(replay.resets, completed.resets + 1);
        assert.equal(replay.steps, 0);
        assert.equal(replay.done, false);
        assert.equal(await play(id).textContent(), 'Pause');
        assert.equal(await pending(), 1);
        await tick();
        assert.equal((await state(id)).steps, 1);
      }
    });
    await check('slider and radio changes while paused explicitly reset and run each model', async () => {
      await open();
      for (const id of ['track', 'contact']) {
        await tab(id);
        for (const control of ['slider', 'radio']) {
          await tick(4);
          await play(id).click();
          assert.equal(await play(id).textContent(), 'Play');
          const before = await state(id);
          const panel = page.locator(`#simpanel-${id}`);
          if (control === 'slider') {
            const slider = panel.locator('input[type=range]:enabled:visible').first();
            await slider.focus();
            await page.keyboard.press('ArrowRight');
          } else {
            await panel.locator('[role=radio]:not(:disabled):not([aria-checked=true]):visible').first().click();
          }
          const after = await state(id);
          assert.equal(after.resets, before.resets + 1, `${id} ${control} resets once`);
          assert.equal(after.steps, 0);
          assert.equal(await play(id).textContent(), 'Pause');
          assert.equal(await pending(), 1);
          await tick();
          assert.equal((await state(id)).steps, 1);
        }
      }
    });
    await check('enabling reduced motion completes uninvited playback without resetting it', async () => {
      await open();
      await tick(8);
      const before = await state('track');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => window.__simStates.track.done);
      assert.equal((await state('track')).resets, before.resets);
      assert.equal(await play('track').textContent(), 'Replay');
      assert.equal(await pending(), 0);
      await play('track').click();
      await tick(4);
      await play('track').click();
      const slider = page.locator('#simpanel-track input[type=range]:enabled:visible').first();
      await slider.focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await play('track').textContent(), 'Pause', 'explicit invitation also applies to parameter changes');
      assert.equal(await pending(), 1);
    });
    await check('simulator state checks have no uncaught browser errors', async () => assert.deepEqual(errors, []));
  } finally { await page.close(); }
  return results;
}
