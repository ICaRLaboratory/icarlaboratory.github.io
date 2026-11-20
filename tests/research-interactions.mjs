import assert from 'node:assert/strict';

const targets = [
  ['Research areas', 'research-areas'],
  ['Interactive', 'interactive'],
  ['Funded projects', 'funded-projects'],
];

export async function checkResearchCitations(page, base, lang) {
  await page.goto(`${base}/research.html?sim=track&lang=${lang}#interactive`);
  const panel = page.locator('#simpanel-track');
  const foot = panel.locator('[data-sim-foot]');
  const pdFoot = await foot.innerText();
  assert.ok(pdFoot.length > 0);
  const law = value => page.locator(`#sim-track-law [data-value="${value}"]`);
  const algo = value => page.locator(`#sim-track-algo [data-value="${value}"]`);
  async function expectPapers(dois) {
    const hrefs = dois.map(doi => `https://doi.org/${doi}`);
    for (const selector of ['.pub__link', '.pub__doi']) {
      assert.deepEqual(await foot.locator(`${selector}:visible`).evaluateAll(links => links.map(a => a.href)), hrefs);
    }
    for (const [i, doi] of dois.entries()) {
      const paper = await page.evaluate(doi => JOURNAL_PAPERS.find(p => p.doi === doi), doi);
      assert.equal(await foot.locator('.pub__link').nth(i).innerText(), paper.title);
      assert.equal(await foot.locator('.pub__authors:visible').nth(i).innerText(), paper.authors);
      assert.equal(await foot.locator('.pub__venue:visible').nth(i).innerText(), `${paper.venue} · ${paper.detail} · doi:${doi}`);
    }
  }
  await law('asmc').click();
  await algo('quasi').click();
  const smoothPapers = ['10.3390/electronics13193940', '10.3390/s25144252'];
  const note = panel.locator('[data-sim-note]');
  async function expectSmooth(language) {
    assert.equal(await page.locator('html').getAttribute('lang'), language);
    await expectPapers(smoothPapers);
    assert.ok(await note.isVisible(), 'Smooth gain modification note is visible');
    const text = await note.innerText();
    const terms = language === 'ko' ? [/고정 계수/, /신경망 추정기 대신/, /재조정/] :
      [/fixed coefficient/i, /instead of the neural estimator/i, /retuned/i];
    for (const term of [...terms, /α = 0\.03/, /10 ms/]) assert.match(text, term);
  }
  await expectSmooth(lang);
  const other = lang === 'en' ? 'ko' : 'en';
  await page.locator(`button[data-lang="${other}"]`).click();
  await expectSmooth(other);
  await page.locator(`button[data-lang="${lang}"]`).click();
  await algo('sigvar').click();
  assert.ok(await note.isHidden(), 'Smooth gain note clears for Novel SV');
  await expectPapers(['10.1109/access.2024.3493882']);
  await law('pd').click();
  assert.equal(await foot.innerText(), pdFoot);
  assert.equal(await foot.locator('a').count(), 0);
  await law('tdc').click();
  assert.ok(await foot.isHidden());
  await page.locator('#simtab-contact').click();
  const contactFoot = page.locator('#simpanel-contact [data-sim-foot]');
  assert.equal(await contactFoot.innerText(), await page.evaluate(lang => SITE.sims.contact.foot[lang], lang));
}

export async function runResearchChecks(browser, base) {
  const results = [];
  async function check(name, test) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(4000);
    try { await test(page); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: error.message }); }
    finally { await context.close(); }
  }
  for (const lang of ['en', 'ko']) {
    await check(`Research ${lang}: selected tracking law cites its papers`, page => checkResearchCitations(page, base, lang));
  }
  await check('Research native section navigation transfers keyboard focus', async page => {
    await page.goto(`${base}/research.html`);
    const nav = page.getByRole('navigation', { name: 'On this page' });
    assert.equal(await nav.count(), 1, 'Missing on-page Research navigation');
    assert.deepEqual(await nav.getByRole('link').allTextContents(), targets.map(([name]) => name));
    for (const [name, id] of targets) {
      await page.goto(`${base}/research.html`);
      // Reach each link through actual document Tab order, including mobile menu controls.
      let reached = false;
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Tab');
        reached = await page.evaluate(id => document.activeElement?.getAttribute('href') === `#${id}`, id);
        if (reached) break;
      }
      assert.ok(reached, `${name} reachable by Tab`);
      await page.keyboard.press('Enter');
      await page.waitForFunction(id => location.hash === `#${id}` && document.activeElement?.id === id, id);
      const target = page.locator(`#${id}`);
      assert.equal(await target.getAttribute('tabindex'), '-1');
      const bounds = await target.boundingBox();
      const header = await page.locator('.nav').boundingBox();
      assert.ok(bounds.y >= header.y + header.height, `${name} clear of sticky header`);
    }
  });
  await check('Research contextual routes lead to Publications and Contact', async page => {
    await page.goto(`${base}/research.html`);
    const routes = page.getByRole('navigation', { name: 'Research next steps' });
    assert.equal(await routes.count(), 1, 'Missing contextual research routes');
    assert.ok(await routes.evaluate(el => Boolean(el.previousElementSibling?.querySelector('#projects'))), 'Routes follow funded projects');
    for (const [name, path] of [['Publications', 'publications.html'], ['Contact', 'contact.html']]) {
      const link = routes.getByRole('link', { name, exact: true });
      assert.equal(await link.getAttribute('href'), path);
      await link.focus();
      await page.keyboard.press('Enter');
      await page.waitForURL(`${base}/${path}`);
      assert.equal((await page.request.get(page.url())).status(), 200);
      await page.goBack();
    }
  });
  for (const width of [320, 390, 1280]) {
    for (const language of ['en', 'ko']) {
      await check(`Research ${width}px ${language}: fragment reload, native keyboard and layout`, async page => {
        await page.setViewportSize({ width, height: 900 });
        for (const [name, id] of targets) {
          await page.goto(`${base}/research.html?lang=${language}#${id}`);
          await page.reload();
          // Reload restores scroll position; browsers need not restore focus to a fragment.
          assert.equal(new URL(page.url()).hash, `#${id}`);
          const target = page.locator(`#${id}`);
          const bounds = await target.boundingBox();
          const header = await page.locator('.nav').boundingBox();
          assert.ok(bounds.y >= header.y + header.height && bounds.y < 900, `${name} visible below header after reload`);
        }
        await page.goto(`${base}/research.html?lang=${language}`);
        for (let i = 0; i < 30; i++) {
          await page.keyboard.press('Tab');
          if (await page.evaluate(() => document.activeElement?.getAttribute('href') === '#interactive')) break;
        }
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => location.hash === '#interactive' && document.activeElement?.id === 'interactive');
        await page.keyboard.press('Tab');
        assert.ok(await page.locator('#interactive').evaluate(el => el.contains(document.activeElement)), 'Next Tab enters destination controls');
        const nav = page.getByRole('navigation', { name: 'On this page' });
        assert.deepEqual(await nav.getByRole('link').allTextContents(), targets.map(([name]) => name));
        assert.equal(await nav.evaluate(el => getComputedStyle(el).position), 'static', 'Local nav does not overlay content');
        const clipped = await page.locator('main').evaluate(main => [...main.querySelectorAll('*')].filter(el => {
          if (el.closest('dialog:not([open])') || el.classList.contains('sr-only')) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.left < -1 || r.right > innerWidth + 1);
        }).map(el => `${el.tagName}.${el.className}`));
        assert.deepEqual(clipped, [], 'Main content must fit viewport (not merely hide overflow)');
        for (const link of await page.locator('.research-nav a').all()) {
          const r = await link.boundingBox();
          assert.ok(r.height >= 44 && r.x >= 0 && r.x + r.width <= width, 'Navigation hit targets fit');
        }
      });
    }
  }
  for (const width of [320, 360, 768, 1280]) {
    for (const language of ['en', 'ko']) {
      await check(`Research section chips: prominent and keyboard-visible ${width}px ${language}`, async page => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${base}/research.html?lang=${language}`);
        await page.evaluate(() => document.fonts.ready);
        const links = page.getByRole('navigation', { name: 'On this page' }).getByRole('link');
        assert.equal(await links.count(), 3);
        for (const [index, [name, id]] of targets.entries()) {
          const link = links.nth(index);
          assert.equal(await link.getAttribute('href'), `#${id}`);
          assert.equal(await link.getAttribute('aria-selected'), null, 'Section links are not selection tabs');
          const style = await link.evaluate(el => {
            const s = getComputedStyle(el), r = el.getBoundingClientRect();
            return { background: s.backgroundColor, color: s.color, size: parseFloat(s.fontSize),
              weight: Number(s.fontWeight), padding: parseFloat(s.paddingLeft),
              fits: r.left >= 0 && r.right <= innerWidth && r.height >= 44 && el.scrollWidth <= el.clientWidth };
          });
          assert.equal(style.background, 'rgba(0, 0, 0, 0)', `${name}: subdued chip surface`);
          assert.equal(style.color, 'rgb(85, 85, 92)', `${name}: dark gray label`);
          assert.ok(style.size >= 16 && style.weight >= 600 && style.padding >= 15, 'Prominent, padded labels');
          assert.ok(style.fits, 'Whole chip fits the viewport');
          assert.equal(await link.locator('svg[aria-hidden="true"]').count(), 0, 'No decorative arrows');
          assert.equal(await page.getByRole('link', { name, exact: true }).count(), 1, 'Arrow does not change accessible name');
        }
        await links.first().hover();
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.research-nav--sections a')).borderTopColor === 'rgba(10, 10, 10, 0.17)');
        const hover = await links.first().evaluate(el => {
          const s = getComputedStyle(el);
          return { background: s.backgroundColor, border: s.borderTopColor };
        });
        assert.deepEqual(hover, { background: 'rgba(0, 0, 0, 0)', border: 'rgba(10, 10, 10, 0.17)' }, 'Hover strengthens only the border');
        await page.mouse.move(0, 0);
        for (let i = 0; i < 30; i++) {
          await page.keyboard.press('Tab');
          if (await links.first().evaluate(el => el === document.activeElement)) break;
        }
        assert.ok(await links.first().evaluate(el => el === document.activeElement));
        const focus = await links.first().evaluate(el => {
          const s = getComputedStyle(el);
          return { visible: el.matches(':focus-visible'), style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
        });
        assert.ok(focus.visible && focus.style !== 'none' && focus.width >= 2, 'Distinct keyboard focus');
      });
    }
  }
  await check('Research anchor routes work without JavaScript', async page => {
    await page.context().route('**/*.js', route => route.abort());
    await page.goto(`${base}/research.html`);
    for (const [name, id] of targets) {
      await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name, exact: true }).click();
      await page.waitForFunction(id => location.hash === `#${id}` && document.activeElement?.id === id, id);
    }
  });
  return results;
}
