import assert from 'node:assert/strict';

export async function runMemberNavigationChecks(browser, base) {
  const results = [];
  for (const width of [320, 360, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    try {
      await page.goto(`${base}/members.html?lang=en`);
      for (const lang of ['en', 'ko']) {
        await page.locator(`[data-lang="${lang}"]`).click();
        const nav = page.locator('.members-nav');
        assert.deepEqual(await nav.locator('a span').allTextContents(), lang === 'ko'
          ? ['지도교수', '대학원생', '학부연구생', '졸업생']
          : ['Advisor', 'Graduate students', 'Undergraduate researchers', 'Alumni']);
        for (const link of await nav.locator('a').all()) {
          const href = await link.getAttribute('href');
          const box = await link.boundingBox();
          assert.ok(box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= width);
          await link.focus();
          await page.keyboard.press('Enter');
          await page.waitForFunction(id => location.hash === id && document.activeElement.id === id.slice(1), href);
          const target = page.locator(href);
          const bounds = await target.boundingBox();
          const header = await page.locator('#nav').boundingBox();
          assert.ok(bounds.y >= header.height - 1, `${href} clears sticky header`);
          await page.keyboard.press('Tab');
          assert.ok(await target.evaluate(el => el.contains(document.activeElement)), 'Next Tab enters destination content');
        }
        await page.reload();
        assert.equal(new URL(page.url()).hash, '#alumni-section');
        await page.evaluate(() => document.fonts.ready);
        assert.ok((await page.locator('#alumni-section').boundingBox()).y >= (await page.locator('#nav').boundingBox()).height - 1);
        assert.equal(await page.locator('#grad > .person').count(), 4, 'Navigation never filters cards');
      }
      results.push({ name: `Members native section navigation ${width}px KO/EN`, pass: true });
    } catch (error) {
      results.push({ name: `Members native section navigation ${width}px KO/EN`, pass: false, error: String(error) });
    } finally { await page.close(); }
  }
  return results;
}
