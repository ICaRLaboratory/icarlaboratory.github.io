import assert from 'node:assert/strict';

// Link arrows describe destinations, not whether a new tab is opened.
export async function runLinkArrowChecks(browser, base) {
  const results = [];
  for (const width of [320, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    try {
      for (const file of ['index', 'research', 'members', 'publications', 'gallery', 'lecture', 'contact', '404']) {
        await page.goto(`${base}/${file}.html?lang=en`, { waitUntil: 'domcontentloaded' });
        for (const lang of ['en', 'ko']) {
          await page.locator(`[data-lang="${lang}"]`).click();
          const arrows = await page.locator('a').evaluateAll(links => links.flatMap(link => {
            const paths = [...link.querySelectorAll('svg path')].map(p => p.getAttribute('d'));
            const direction = paths.includes('M5 12h14M13 6l6 6-6 6') || link.textContent.includes('→')
              ? 'internal' : paths.includes('M7 17 17 7M7 7h10v10') || link.textContent.includes('↗')
                ? 'external' : null;
            return direction ? [{ href: link.href, direction }] : [];
          }));
          for (const arrow of arrows) {
            const url = new URL(arrow.href);
            const internal = url.origin === new URL(base).origin;
            assert.equal(arrow.direction, internal ? 'internal' : 'external', `${file}/${lang}: ${arrow.href}`);
          }
          if (file === 'index') {
            const recruit = page.locator('.recruit__link');
            assert.equal(await recruit.getAttribute('href'), await page.evaluate(() => `mailto:${SITE.contact.email}`));
            assert.equal(await recruit.locator('svg').getAttribute('aria-hidden'), 'true');
            assert.equal(await recruit.locator('path').getAttribute('d'), 'M7 17 17 7M7 7h10v10');
            await recruit.focus();
            assert.equal(await recruit.evaluate(el => el === document.activeElement), true);
            const box = await recruit.boundingBox();
            assert.ok(box.width > 0 && box.x >= 0 && box.x + box.width <= width);
            assert.ok(arrows.some(a => a.direction === 'internal'), 'Home retains internal arrows');
          }
        }
      }
      results.push({ name: `Link arrow destinations ${width}px EN/KO across all pages`, pass: true });
    } catch (error) {
      results.push({ name: `Link arrow destinations ${width}px EN/KO across all pages`, pass: false, error: String(error) });
    } finally { await page.close(); }
  }
  return results;
}
