import assert from 'node:assert/strict';

export async function runLanguageChecks(browser, base) {
  const results = [];
  async function check(name, run) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await run(page, context);
      assert.deepEqual(errors, [], 'No uncaught browser errors');
      results.push({ name, pass: true });
    } catch (error) {
      results.push({ name, pass: false, error: error.message });
    } finally {
      await context.close();
    }
  }
  const home = suffix => new URL(`index.html${suffix}`, `${base.replace(/\/$/, '')}/`).href;
  async function language(page, expected) {
    assert.equal(await page.locator(`[data-lang="${expected}"]`).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator(`[data-lang="${expected === 'ko' ? 'en' : 'ko'}"]`).getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  }

  await check('Explicit KO replaces forced EN without adding history; survives reload, navigation and Back', async page => {
    await page.goto(home('?lang=en&campaign=a%26b&tag=one&tag=two#main'));
    await language(page, 'en');
    const heading = await page.locator('h1').textContent();
    const historyLength = await page.evaluate(() => {
      history.replaceState({ marker: 'keep' }, '');
      return history.length;
    });
    await page.locator('[data-lang="ko"]').click();
    await language(page, 'ko');
    assert.equal(await page.locator('[data-site="tagline"]').getAttribute('lang'), 'ko');
    assert.equal(await page.locator('h1').textContent(), heading);
    assert.equal(await page.evaluate(() => history.length), historyLength);
    assert.deepEqual(await page.evaluate(() => history.state), { marker: 'keep' });
    await page.reload();
    await language(page, 'ko');
    const url = new URL(page.url());
    assert.equal(url.searchParams.get('lang'), 'ko');
    assert.equal(url.searchParams.get('campaign'), 'a&b');
    assert.deepEqual(url.searchParams.getAll('tag'), ['one', 'two']);
    assert.equal(url.hash, '#main');
    assert.equal(await page.evaluate(() => localStorage.getItem('icar-lang')), 'ko');
    await page.locator('#navlinks a[href="research.html"]').click();
    await language(page, 'ko');
    await page.goBack();
    await language(page, 'ko');
  });

  await check('Clicking active EN explicitly saves the preference for internal navigation', async page => {
    await page.goto(home('?lang=en'));
    await language(page, 'en');
    await page.evaluate(() => localStorage.removeItem('icar-lang'));
    const historyLength = await page.evaluate(() => history.length);
    await page.locator('[data-lang="en"]').click();
    assert.equal(await page.evaluate(() => localStorage.getItem('icar-lang')), 'en');
    assert.equal(await page.evaluate(() => history.length), historyLength);
    await page.locator('#navlinks a[href="research.html"]').click();
    await language(page, 'en');
    await page.reload();
    await language(page, 'en');
  });

  await check('An explicit English entry URL persists on internal navigation without a toggle', async page => {
    await page.goto(home('?lang=en'));
    await language(page, 'en');
    await page.locator('#navlinks a[href="research.html"]').click();
    await language(page, 'en');
    assert.equal(await page.evaluate(() => localStorage.getItem('icar-lang')), 'en');
  });

  await check('Default Korean, stored preferences and valid URL precedence remain intact', async page => {
    await page.goto(home(''));
    await language(page, 'ko');
    assert.equal(new URL(page.url()).search, '');
    await page.evaluate(() => localStorage.setItem('icar-lang', 'en'));
    await page.reload();
    await language(page, 'en');
    await page.goto(home('?lang=invalid'));
    await language(page, 'en');
    await page.goto(home('?lang=ko'));
    await language(page, 'ko');
    assert.equal(await page.evaluate(() => localStorage.getItem('icar-lang')), 'ko');
    await page.goto(home(''));
    await language(page, 'ko');
    await page.evaluate(() => localStorage.setItem('icar-lang', 'invalid'));
    await page.reload();
    await language(page, 'ko');
    await page.locator('[data-lang="en"]').click();
    await language(page, 'en');
    assert.equal(await page.locator('[data-site="tagline"]').getAttribute('lang'), null);
    await page.reload();
    await language(page, 'en');
  });

  for (const blocked of ['getter', 'methods']) {
    await check(`Unavailable storage (${blocked}) allows toggles and URL-backed reload without errors`, async (page, context) => {
      await context.addInitScript(mode => {
        const deny = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
        if (mode === 'getter') Object.defineProperty(window, 'localStorage', { get: deny });
        else {
          Storage.prototype.getItem = deny;
          Storage.prototype.setItem = deny;
        }
      }, blocked);
      await page.goto(home(''));
      await language(page, 'ko');
      await page.goto(home('?lang=en&keep=yes#main'));
      await language(page, 'en');
      await page.locator('[data-lang="en"]').click();
      await page.locator('[data-lang="ko"]').click();
      await language(page, 'ko');
      await page.reload();
      await language(page, 'ko');
      assert.equal(new URL(page.url()).searchParams.get('keep'), 'yes');
      assert.equal(new URL(page.url()).hash, '#main');
      await page.locator('#navlinks a[href="research.html"]').click();
      await language(page, 'ko');
    });
  }

  for (const blocked of [null, 'getter', 'methods']) {
    await check(`Research native anchor Back restores URL language, URL/state and simulator state (storage: ${blocked || 'available'})`, async (page, context) => {
      if (blocked) await context.addInitScript(mode => {
        const deny = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
        if (mode === 'getter') Object.defineProperty(window, 'localStorage', { get: deny });
        else { Storage.prototype.getItem = deny; Storage.prototype.setItem = deny; }
      }, blocked);
      // Count real model resets without replacing simulator behavior or its clock.
      await page.route('**/assets/sim.js', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: await response.text() + `
          ;window.__languageResets = 0;
          const originalRegister = SIM.register;
          SIM.register = def => {
            const reset = def.reset;
            def.reset = function (...args) { window.__languageResets++; return reset.apply(this, args); };
            originalRegister(def);
          };` });
      });
      await page.goto(new URL('research.html?lang=ko&keep=a&keep=b', home('')).href);
      await page.evaluate(() => history.replaceState({ marker: 'research' }, ''));
      const original = page.url();
      await page.locator('.research-nav a[href="#interactive"]').click();
      assert.equal(new URL(page.url()).hash, '#interactive');
      const slider = page.locator('#simpanel-track input[type="range"]').first();
      await slider.focus();
      await slider.press('ArrowRight');
      const value = await slider.inputValue();
      const resets = await page.evaluate(() => window.__languageResets);
      await page.locator('[data-lang="en"]').click();
      const english = page.url();
      await page.goBack();
      assert.equal(page.url(), original);
      await language(page, 'ko');
      assert.deepEqual(await page.evaluate(() => history.state), { marker: 'research' });
      await page.goForward();
      assert.equal(page.url(), english);
      await language(page, 'en');
      assert.equal(await slider.inputValue(), value);
      assert.equal(await page.evaluate(() => window.__languageResets), resets, 'Language history must not reset simulator models');
      await page.reload();
      await language(page, 'en');
    });
  }

  await check('Native Skip anchor restores language on Back and Forward', async page => {
    await page.goto(home('?lang=ko&keep=a&keep=b'));
    const original = page.url();
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.skip').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash, '#main');
    await page.locator('[data-lang="en"]').click();
    const english = page.url();
    await page.goBack();
    assert.equal(page.url(), original);
    await language(page, 'ko');
    await page.goForward();
    assert.equal(page.url(), english);
    await language(page, 'en');
  });

  await check('Gallery year-hash entry restores language through Skip history without rebuilding selected albums', async page => {
    await page.goto(new URL('gallery.html?lang=ko&keep=a&keep=b#2024', home('')).href);
    await page.evaluate(() => {
      history.replaceState({ marker: 'gallery' }, '');
      window.__album = document.querySelector('#gallery .album');
    });
    const original = page.url();
    await page.locator('.skip').focus();
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash, '#main');
    await page.locator('[data-lang="en"]').click();
    await page.goBack();
    await language(page, 'ko');
    assert.equal(page.url(), original);
    assert.deepEqual(await page.evaluate(() => history.state), { marker: 'gallery' });
    await page.goForward();
    await language(page, 'en');
    assert.equal(new URL(page.url()).hash, '#main');
    assert.equal(await page.evaluate(() => window.__album === document.querySelector('#gallery .album')), true);
    assert.equal(await page.locator('#galfilters [data-set="2024"]').getAttribute('aria-pressed'), 'true');
  });

  for (const suffix of ['?lang=en&lang=ko', '', '?lang=invalid']) {
    await check(`Unchanged language history preserves Research focus regions and uses existing preference (${suffix || 'no lang'})`, async page => {
      await page.goto(new URL(`research.html${suffix}`, home('')).href);
      if (!suffix.startsWith('?lang=en')) {
        await page.evaluate(() => localStorage.setItem('icar-lang', 'en'));
        await page.reload();
      }
      const original = page.url();
      await page.locator('.research-nav a[href="#interactive"]').click();
      await page.evaluate(() => {
        window.__area = document.querySelector('#areas-full .card');
        window.__langEvents = 0;
        document.addEventListener('icar:lang', () => window.__langEvents++);
      });
      await page.locator('#areas-full .card__zoom').first().focus();
      await page.goBack();
      assert.equal(page.url(), original);
      await language(page, 'en');
      assert.equal(await page.evaluate(() => window.__area === document.querySelector('#areas-full .card')), true);
      assert.equal(await page.locator('#areas-full .card__zoom').first().evaluate(el => el === document.activeElement), true);
      assert.equal(await page.evaluate(() => window.__langEvents), 0, 'Unchanged preference must not rerender translated regions');
    });
  }

  return results;
}
