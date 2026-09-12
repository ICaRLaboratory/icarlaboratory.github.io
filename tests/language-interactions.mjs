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

  return results;
}
