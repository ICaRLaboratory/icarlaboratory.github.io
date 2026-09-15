import assert from 'node:assert/strict';

export async function runNewsLinksChecks(browser, base) {
  const results = [];
  for (const lang of ['ko', 'en']) for (const width of [320, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const name = `News article and publication links (${lang}, ${width}px)`;
    try {
      // Keep this dated announcement visible independently of the test run date.
      await page.clock.setFixedTime(new Date('2026-09-15T12:00:00'));
      await page.goto(`${base}/index.html?lang=${lang}`);
      const item = page.locator('.news__item').filter({ hasText: /비동기|asynchronous/ });
      assert.equal(await item.count(), 1, 'Research news must be present');
      assert.equal(await item.locator('time').getAttribute('datetime'), '2026-09-07');
      const article = item.getByRole('link', { name: lang === 'ko' ? '기사 원문' : 'News article', exact: true });
      const paper = item.getByRole('link', { name: lang === 'ko' ? '해당 논문' : 'Publication', exact: true });
      assert.equal(await article.getAttribute('href'), 'https://www.sejong.ac.kr/news/people/faculty.do?mode=view&articleNo=892863');
      const target = new URL(await paper.getAttribute('href'), base);
      assert.equal(target.pathname, '/publications.html');
      assert.equal(target.searchParams.get('q'), '10.1016/j.matcom.2025.11.031');
      await page.evaluate(() => document.fonts.ready);
      for (const link of [article, paper]) {
        const box = await link.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= width && box.height >= 44, 'Links fit viewport with touch targets');
      }
      await article.focus();
      await page.keyboard.press('Tab');
      assert.equal(await paper.evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Enter');
      await page.waitForURL('**/publications.html?**');
      await page.locator('#publist .pub').first().waitFor();
      assert.equal(await page.locator('#publist .pub').count(), 1);
      assert.match(await page.locator('#publist .pub').innerText(), /integral looped functionals composed of bivariate functions/);
      assert.ok(await page.locator('#publist a[href="https://doi.org/10.1016/j.matcom.2025.11.031"]').count() >= 1);
      await page.reload();
      assert.equal(await page.locator('#publist .pub').count(), 1);
      await page.goBack();
      await item.waitFor();
      await page.locator(`[data-lang="${lang === 'ko' ? 'en' : 'ko'}"]`).click();
      assert.equal(await item.getByRole('link', { name: lang === 'ko' ? 'Publication' : '해당 논문', exact: true }).count(), 1);
      results.push({ name, pass: true });
    } catch (error) { results.push({ name, pass: false, error: error.message }); }
    finally { await page.close(); }
  }
  return results;
}
