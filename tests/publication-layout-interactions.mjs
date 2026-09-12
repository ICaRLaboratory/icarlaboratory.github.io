import assert from 'node:assert/strict';

export async function runPublicationLayoutChecks(browser, base) {
  const results = [];
  for (const { width, lang } of [320, 390, 768, 1280].flatMap(width => ['ko', 'en'].map(lang => ({ width, lang })))) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${base}/publications.html?lang=${lang}`);
      await page.evaluate(() => document.fonts.ready);
      const search = page.locator('#pubsearch');
      const list = page.locator('#publist');
      const searchBox = await search.boundingBox();
      const listBox = await list.boundingBox();
      assert.ok(searchBox.y < 470, `Search starts too low: ${searchBox.y}`);
      assert.ok(listBox.y < (width === 320 ? 900 : 844), `Results start too low: ${listBox.y}`);
      assert.equal(await page.locator('#profiles .banner').count(), 0, 'Secondary profile links must not dominate as a banner');
      assert.equal(await page.locator('#profiles a').count(), 2, 'Scholar and ORCID must remain available');
      const profiles = await page.locator('#profiles a').evaluateAll(links => links.map(a => ({ href: a.href, rel: a.rel })));
      const advisor = await page.evaluate(() => ({ scholar: ADVISOR.scholar, orcid: ADVISOR.orcid, name: ADVISOR.nameEn }));
      assert.deepEqual(profiles.map(a => a.href), [advisor.scholar, `https://orcid.org/${advisor.orcid}`]);
      assert.ok(profiles.every(a => a.rel.split(/\s+/).includes('noopener')));
      assert.ok((await page.locator('#profiles').getAttribute('aria-label')).includes(advisor.name));
      const selectors = ['#pubsearch', ...['journal', 'conference', 'domestic', 'all'].map(type => `#pubfilters [data-set="${type}"]`), '#pubyear', '#pubreset'];
      await search.focus();
      for (const selector of selectors) {
        const el = page.locator(selector);
        assert.equal(await el.evaluate(e => e === document.activeElement), true, `Native order: ${selector}`);
        const r = await el.boundingBox();
        assert.ok(r.x >= 0 && r.x + r.width <= width + 1 && r.height >= 44, `Accessible bounds: ${selector}`);
        assert.ok(await el.evaluate(e => e.scrollWidth <= e.clientWidth + 1), `Clipped control: ${selector}`);
        await page.keyboard.press('Tab');
      }
      assert.deepEqual(errors, []);
      results.push({ name: `Publication compact layout and native control order at ${width}px ${lang}`, pass: true });
    } catch (error) {
      results.push({ name: `Publication compact layout and native control order at ${width}px ${lang}`, pass: false, error: error.message });
    } finally { await page.close(); }
  }
  return results;
}
