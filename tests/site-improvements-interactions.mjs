import assert from 'node:assert/strict';

export async function runSiteImprovementChecks(browser, base) {
  const results = [];
  for (const width of [320, 390, 1280]) {
    for (const lang of ['ko', 'en']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      try {
        await page.goto(`${base}/index.html?lang=${lang}`);
        await page.locator('.hero__faculty').waitFor({ timeout: 3000 });
        assert.match(await page.locator('.hero__faculty').innerText(), lang === 'ko' ? /이석영/ : /Seok Young Lee/);
        assert.match(await page.locator('.cta-row').innerText(), lang === 'ko' ? /연구 분야 보기/ : /Explore the research/);
        const guide = page.locator('#recruit a[href="members.html#application-guide"]');
        await guide.focus();
        await page.keyboard.press('Enter');
        await page.waitForURL(/members\.html#application-guide/);
        await page.locator('#application-guide').waitFor();
        assert.equal(await page.locator('#application-guide').evaluate(el => el === document.activeElement), true);
        assert.match(await page.locator('#application-guide').innerText(), lang === 'ko' ? /참여 희망 시기/ : /timing|start|participat/i);
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#application-guide a[href^="mailto:"]').evaluate(el => el === document.activeElement), true);
        const nodes = await page.locator('#application-guide [data-ko]').count();
        assert.ok(nodes > 0);
        await page.locator(`[data-lang="${lang === 'ko' ? 'en' : 'ko'}"]`).click();
        await page.locator(`[data-lang="${lang}"]`).click();
        await page.reload();
        assert.match(await page.locator('#application-guide').innerText(), lang === 'ko' ? /지원 안내/ : /Application guide/);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.locator('#application-guide').evaluate(root => [...root.querySelectorAll('*')].filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
        }).map(el => el.tagName + '.' + el.className));
        assert.deepEqual(overflow, []);
        assert.deepEqual(errors, []);
        results.push({ name: `Site improvement guide and home actions ${width}px ${lang}`, pass: true });
      } catch (error) {
        results.push({ name: `Site improvement guide and home actions ${width}px ${lang}`, pass: false, error: String(error) });
      } finally { await context.close(); }
    }
  }
  const noJS = await browser.newContext({ javaScriptEnabled: false });
  const page = await noJS.newPage();
  try {
    await page.goto(`${base}/members.html`);
    assert.match(await page.locator('#advisor').innerText(), /이석영/);
    assert.match(await page.locator('#advisor').innerText(), /지능정보융합학과/);
    assert.ok(await page.locator('#advisor a[href^="mailto:"]').count());
    assert.ok(await page.locator('#application-guide').isVisible());
    results.push({ name: 'Advisor and application guide readable without JavaScript', pass: true });
  } catch (error) {
    results.push({ name: 'Advisor and application guide readable without JavaScript', pass: false, error: String(error) });
  } finally { await noJS.close(); }
  return results;
}
