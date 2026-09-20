import assert from 'node:assert/strict';

export async function runMemberCVChecks(browser, base) {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(`${base}/members.html?lang=ko`);
    assert.equal(await page.locator('.badge-slot').count(), 0);
    assert.equal(await page.locator('.person__heading .badge').count(), 1);
    const cvHeight = await page.locator('.person__cv').first().evaluate(node => node.getBoundingClientRect().height);
    assert.ok(cvHeight >= 24 && cvHeight <= 30, `Compact CV height: ${cvHeight}`);
    const counts = await page.evaluate(() => {
      const people = [...GRAD_STUDENTS, ...UNDERGRAD_STUDENTS, ...ALUMNI];
      return { total: people.length, withCv: people.filter(p => p.cv).length };
    });
    assert.ok(counts.total > 0);
    assert.equal(await page.locator('.person__cv:disabled').count(), counts.total - counts.withCv);
    assert.equal(await page.locator('a.person__cv').count(), counts.withCv);
    assert.equal(await page.locator('#advisor .person__cv, .person--opening .person__cv').count(), 0);
    for (const link of await page.locator('a.person__cv').all()) {
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.match(await link.getAttribute('rel'), /noopener/);
    }
    for (const lang of ['en', 'ko']) {
      await page.locator(`[data-lang="${lang}"]`).click();
      for (const width of [1280, 768, 360, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => document.fonts.ready);
        const geometry = await page.locator('.person__cv').evaluateAll(nodes => nodes.map(node => {
          const cv = node.getBoundingClientRect();
          const photo = node.previousElementSibling.getBoundingClientRect();
          node.focus();
          const focused = document.activeElement === node;
          // Disabled buttons must stay unfocusable; real CV links must take focus.
          return { below: cv.top >= photo.bottom, width: Math.abs(cv.width - photo.width) < 1, focusOk: node.matches('a') ? focused : !focused };
        }));
        assert.ok(geometry.every(g => g.below && g.width && g.focusOk));
      }
    }
    // Fixture: exercises the optional-CV link path in isolation.
    await page.evaluate(() => {
      document.querySelector('#undergrad').innerHTML = personCard({ nameEn: 'CV Fixture', nameKo: '검사 구성원', degree: DEG.ug, cv: 'members.html?cv-fixture=1' }, 0);
    });
    const link = page.locator('#undergrad a.person__cv');
    assert.equal(await link.count(), 1);
    assert.equal(await link.getAttribute('href'), 'members.html?cv-fixture=1');
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.equal(await link.getAttribute('rel'), 'noopener');
    await link.evaluate(node => node.focus());
    assert.equal(await link.evaluate(node => document.activeElement === node), true);
    const popupPromise = page.waitForEvent('popup');
    await page.keyboard.press('Enter');
    const popup = await popupPromise;
    await popup.waitForLoadState();
    assert.ok(popup.url().includes('cv-fixture=1'));
    await popup.close();
    return [{ name: 'Disabled member CV placement and optional CV keyboard link; advisor and openings excluded', pass: true }];
  } catch (error) {
    return [{ name: 'Member CV buttons', pass: false, error: String(error) }];
  } finally {
    await page.close();
  }
}
