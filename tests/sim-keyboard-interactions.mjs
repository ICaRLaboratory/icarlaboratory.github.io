import assert from 'node:assert/strict';

export async function runSimKeyboardChecks(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  const results = [];
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.setDefaultTimeout(5000);
  const cases = [
    { id: 'sim-track-law', tab: 'track' },
    { id: 'sim-track-algo', tab: 'track', law: 'asmc' },
    { id: 'sim-contact-mode', tab: 'contact' },
  ];
  async function check(name, test) {
    try { await test(); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: error.message }); }
  }
  async function open(spec) {
    await page.goto(`${base}/research.html`, { waitUntil: 'load' });
    await page.locator(`#simtab-${spec.tab}`).click();
    if (spec.law) await page.locator(`#sim-track-law [data-value="${spec.law}"]`).click();
    const group = page.locator(`#${spec.id}`);
    assert.equal(await group.isVisible(), true, `${spec.id} visible`);
    return group;
  }
  async function roving(group, selected) {
    const radios = await group.locator('[role=radio]').evaluateAll(nodes => nodes.map(node => ({
      value: node.dataset.value, checked: node.getAttribute('aria-checked'),
      tabIndex: node.tabIndex, active: node.classList.contains('is-active'), disabled: node.disabled,
    })));
    assert.equal(radios.filter(radio => radio.checked === 'true').length, 1);
    for (const radio of radios) {
      const on = radio.value === selected;
      assert.equal(radio.checked, String(on), `${radio.value} checked`);
      assert.equal(radio.active, on, `${radio.value} active class`);
      assert.equal(radio.tabIndex, on && !radio.disabled ? 0 : -1, `${radio.value} tabIndex`);
    }
  }
  try {
    for (const spec of cases) {
      await check(`${spec.id}: initial and pointer roving tab stop`, async () => {
        const group = await open(spec);
        await roving(group, await group.locator('[aria-checked=true]').getAttribute('data-value'));
        const options = group.locator('[role=radio]:not(:disabled)');
        for (const option of await options.all()) {
          await option.click();
          await roving(group, await option.getAttribute('data-value'));
          await page.keyboard.press('Tab');
          assert.equal(await group.evaluate(el => el.contains(document.activeElement)), false, 'Tab exits group');
          await page.keyboard.press('Shift+Tab');
          assert.equal(await option.evaluate(el => el === document.activeElement), true, 'Shift+Tab returns to selection');
        }
      });
    }
    for (const spec of cases) {
      await check(`${spec.id}: arrows wrap, skip disabled, and restart through click`, async () => {
        const group = await open(spec);
        const options = group.locator('[role=radio]:not(:disabled)');
        const count = await options.count();
        if (spec.law) assert.equal(await group.locator(':disabled').count(), 2);
        await group.evaluate(el => {
          window.radioClicks = 0;
          el.addEventListener('click', () => window.radioClicks++);
        });
        for (const [key, step] of [['ArrowRight', 1], ['ArrowDown', 1], ['ArrowLeft', -1], ['ArrowUp', -1]]) {
          await options.first().click();
          let index = 0;
          for (let i = 0; i < count; i++) {
            const play = page.locator(`#sim-${spec.tab}-play`);
            if (await play.textContent() === 'Pause') await play.click();
            await options.nth(index).focus();
            const clicks = await page.evaluate(() => window.radioClicks);
            await page.keyboard.press(key);
            index = (index + step + count) % count;
            const target = options.nth(index);
            assert.equal(await target.evaluate(el => el === document.activeElement), true, `${key} focus`);
            await roving(group, await target.getAttribute('data-value'));
            assert.equal(await page.evaluate(() => window.radioClicks), clicks + 1, `${key} uses click`);
            assert.equal(await play.textContent(), 'Pause', `${key} restarts playback`);
          }
        }
        if (spec.tab === 'contact') {
          await options.first().click();
          await page.keyboard.press('ArrowRight');
          assert.equal(await page.locator('#sim-contact-md').isDisabled(), true, 'arrow retunes impedance');
          await page.keyboard.press('ArrowRight');
          assert.equal(await page.locator('#sim-contact-md').isEnabled(), true, 'arrow retunes admittance');
        }
      });
      await check(`${spec.id}: native Space and Enter activate once`, async () => {
        const group = await open(spec);
        await group.evaluate(el => {
          window.radioClicks = 0;
          el.addEventListener('click', () => window.radioClicks++);
        });
        for (const key of ['Space', 'Enter']) {
          const target = group.locator('[role=radio]:not(:disabled):not([aria-checked=true])').first();
          const value = await target.getAttribute('data-value');
          await target.focus();
          const clicks = await page.evaluate(() => window.radioClicks);
          await page.keyboard.press(key);
          await roving(group, value);
          assert.equal(await page.evaluate(() => window.radioClicks), clicks + 1, `${key} native click`);
        }
      });
      await check(`${spec.id}: modified arrows remain unintercepted`, async () => {
        const group = await open(spec);
        const selected = group.locator('[aria-checked=true]');
        const value = await selected.getAttribute('data-value');
        await selected.focus();
        // Synthetic events avoid triggering browser history shortcuts.
        const prevented = await selected.evaluate(el => {
          const results = [];
          for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
            for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
              const event = new KeyboardEvent('keydown', { key, [modifier]: true, bubbles: true, cancelable: true });
              el.dispatchEvent(event);
              results.push(event.defaultPrevented);
            }
          }
          return results;
        });
        assert.equal(prevented.some(Boolean), false);
        await roving(group, value);
        assert.equal(await selected.evaluate(el => el === document.activeElement), true);
      });
    }
    await check('simulator keyboard: no page errors', async () => assert.deepEqual(errors, []));
  } finally {
    await page.close();
  }
  return results;
}
