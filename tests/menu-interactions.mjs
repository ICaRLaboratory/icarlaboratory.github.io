import assert from 'node:assert/strict';

async function tabTo(page, selector) {
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(selector => document.activeElement.matches(selector), selector)) return;
  }
  throw new Error(`Native Tab did not reach ${selector}`);
}

export async function runMenuChecks(browser, base) {
  const results = [];
  async function check(name, run, width = 390) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    page.setDefaultTimeout(5000);
    try {
      await page.goto(`${base}/index.html`, { waitUntil: 'load' });
      await page.waitForSelector('#menuBtn', { state: 'attached' });
      await run(page);
      results.push({ name, pass: true });
    } catch (error) {
      results.push({ name, pass: false, error: error.message });
    } finally {
      await page.close();
    }
  }

  await check('Mobile Menu: native keyboard opening focuses first link; Tab advances', async page => {
    await tabTo(page, '#menuBtn');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#navlinks a').first().evaluate(el => el === document.activeElement), true,
      'Keyboard opening must focus the first link');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#navlinks a').nth(1).evaluate(el => el === document.activeElement), true,
      'Tab after keyboard opening must advance to the second link');
  });
  await check('Mobile Menu: Escape closes after native Tab leaves navigation', async page => {
    await tabTo(page, '#menuBtn');
    await page.keyboard.press('Enter');
    await tabTo(page, 'main a');
    assert.equal(await page.locator('#nav').evaluate(el => el.contains(document.activeElement)), false);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'), 'false',
      'Escape outside the navigation must close the open menu');
    assert.equal(await page.locator('#menuBtn').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('#navlinks').evaluate(el => el.inert), true);
  });
  await check('Mobile Menu: links follow native tab order and Escape restores toggle', async page => {
    await tabTo(page, '#menuBtn');
    await page.keyboard.press('Space');
    const links = page.locator('#navlinks a');
    for (let i = 0; i < await links.count(); i++) {
      assert.equal(await links.nth(i).evaluate(el => el === document.activeElement), true);
      if (i + 1 < await links.count()) await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#menuBtn').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('#navlinks').evaluate(el => el.inert), true);
  });
  await check('Mobile Menu: collapsed links are skipped; toggle closes and reopens', async page => {
    await tabTo(page, '#menuBtn');
    assert.equal(await page.locator('#navlinks').evaluate(el => el.inert), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#navlinks').evaluate(el => el.contains(document.activeElement)), false);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('#menuBtn').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#navlinks').evaluate(el => el.inert), true);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#menuBtn').evaluate(el => el === document.activeElement), true);
  });
  await check('Desktop Menu: native links precede language controls and Escape preserves focus', async page => {
    await tabTo(page, '.brand');
    assert.equal(await page.locator('#menuBtn').isVisible(), false);
    assert.equal(await page.locator('#navlinks').evaluate(el => el.inert), false);
    const links = page.locator('#navlinks a');
    for (let i = 0; i < await links.count(); i++) {
      await page.keyboard.press('Tab');
      assert.equal(await links.nth(i).evaluate(el => el === document.activeElement), true);
    }
    await page.keyboard.press('Escape');
    assert.equal(await links.last().evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.lang button').first().evaluate(el => el === document.activeElement), true);
    const brandBox = await page.locator('#nav .brand').boundingBox();
    const linksBox = await page.locator('#navlinks').boundingBox();
    const langBox = await page.locator('.lang').boundingBox();
    assert.ok(linksBox.x >= brandBox.x + brandBox.width);
    assert.ok(langBox.x >= linksBox.x + linksBox.width);
    assert.ok(langBox.x + langBox.width <= 1280);
  }, 1280);
  await check('Menu breakpoint: focused desktop link moves to collapsed mobile toggle', async page => {
    await tabTo(page, '#navlinks a');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('#navlinks').inert);
    assert.equal(await page.locator('#menuBtn').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'), 'false');
  }, 1280);
  await check('Menu breakpoint: open mobile link retains desktop focus', async page => {
    await tabTo(page, '#menuBtn');
    await page.keyboard.press('Enter');
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.waitForFunction(() => document.querySelector('#menuBtn').getAttribute('aria-expanded') === 'false');
    assert.equal(await page.locator('#navlinks a').first().evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('#navlinks').evaluate(el => el.inert), false);
  });
  await check('Mobile Menu: closed controls have matching visual and native focus order', async page => {
    await tabTo(page, '.brand');
    let previous = await page.locator('#nav .brand').boundingBox();
    for (const selector of ['.lang button[data-lang="ko"]', '.lang button[data-lang="en"]', '#menuBtn']) {
      await page.keyboard.press('Tab');
      const control = page.locator(selector);
      assert.equal(await control.evaluate(el => el === document.activeElement), true);
      const box = await control.boundingBox();
      assert.ok(box.x >= previous.x + previous.width, `${selector} must follow the previous control visually`);
      assert.ok(box.x + box.width <= 390, `${selector} must fit the mobile viewport`);
      previous = box;
    }
  });
  await check('Mobile Menu: Escape in a modal does not close the menu or steal focus', async page => {
    await tabTo(page, '#menuBtn');
    await page.keyboard.press('Enter');
    await tabTo(page, 'main a');
    await page.evaluate(() => {
      const dialog = document.createElement('dialog');
      dialog.id = 'menu-test-dialog';
      dialog.innerHTML = '<button autofocus>Dialog action</button>';
      document.body.append(dialog);
      dialog.showModal();
    });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#menu-test-dialog').evaluate(el => el.open), false);
    assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'), 'true',
      'The modal, not the background menu, owns Escape');
    assert.equal(await page.evaluate(() => document.activeElement.matches('main a')), true);
  });
  await check('Mobile Menu: pointer toggle preserves focus and closes on second click', async page => {
    await page.locator('#menuBtn').click();
    assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#menuBtn').evaluate(el => el === document.activeElement), true);
    await page.locator('#menuBtn').click();
    assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#navlinks').evaluate(el => el.inert), true);
  });
  return results;
}
