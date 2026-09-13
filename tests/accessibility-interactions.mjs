import assert from 'node:assert/strict';

const pages = ['index', 'research', 'members', 'publications', 'lecture', 'gallery', 'contact'];

export async function runAccessibilityChecks(browser, base, axeSource) {
  const results = [];
  for (const name of pages) {
    for (const width of [320, 1280]) {
      for (const lang of ['ko', 'en']) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        let label = `Contrast: ${name} ${width}px ${lang}`;
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(`${base}/${name}.html?lang=${lang}`);
          await page.evaluate(() => document.fonts.ready);
          if (name === 'index') {
            // Keep the date label covered after production announcements expire.
            await page.evaluate(() => {
              const now = new Date();
              const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
              NEWS.splice(0, NEWS.length, { date, title: { en: 'Contrast check', ko: '공지 대비 검사' } });
              renderNews();
            });
            assert.ok(await page.locator('.news__date').isVisible());
          }
          await page.addScriptTag({ content: axeSource });
          const contrast = await page.evaluate(async () => {
            const result = await axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] } });
            return {
              checked: result.passes.reduce((count, rule) => count + rule.nodes.length, 0),
              failures: result.violations.flatMap(rule => rule.nodes.map(node => `${node.target.join(' ')}: ${node.failureSummary}`)),
            };
          });
          assert.ok(contrast.checked > 0, 'Contrast checker must inspect actual text');
          assert.deepEqual(contrast.failures, []);
          assert.deepEqual(errors, []);
          results.push({ name: label, pass: true });
          label = `Print navigation: ${name} ${width}px ${lang}`;
          const nav = page.locator('#nav');
          const before = await nav.boundingBox();
          assert.ok(before.height > 0, 'Screen navigation is present');
          await page.emulateMedia({ media: 'print' });
          assert.equal(await nav.evaluate(e => e.getBoundingClientRect().height), 0, 'Print must remove the navigation slot');
          assert.ok(await page.locator('main').isVisible(), 'Print retains content');
          await page.emulateMedia({ media: 'screen' });
          assert.equal((await nav.boundingBox()).height, before.height, 'Screen navigation returns after print');
          assert.deepEqual(errors, []);
          results.push({ name: label, pass: true });
        } catch (error) {
          results.push({ name: label, pass: false, error: error.message });
        } finally { await page.close(); }
      }
    }
  }
  return results;
}
