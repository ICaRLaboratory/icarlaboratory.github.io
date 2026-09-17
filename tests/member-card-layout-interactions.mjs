import assert from 'node:assert/strict';

export async function runMemberCardLayoutChecks(browser, base) {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto(`${base}/members.html?lang=en`);
    for (const rootSize of [16, 24, 32, 16]) {
      await page.evaluate(size => { document.documentElement.style.fontSize = `${size}px`; }, rootSize);
      for (const width of [1280, 768, 360, 320, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const lang of ['en', 'ko']) {
          await page.locator(`[data-lang="${lang}"]`).click();
          await page.evaluate(() => document.fonts.ready);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const cards = await page.locator('#grad > .person, #undergrad > .person').evaluateAll(nodes => nodes.map(node => {
            const box = node.getBoundingClientRect();
            return { width: box.width, height: box.height, clipped: [...node.querySelectorAll('*')].some(child => {
              const r = child.getBoundingClientRect();
              return r.width > 0 && (r.left < box.left - 1 || r.right > box.right + 1 || r.bottom > box.bottom + 1);
            }) };
          }));
          assert.equal(cards.length, 5);
          for (const card of cards) {
            assert.ok(Math.abs(card.width - cards[0].width) < 1, `Matching width at ${width}px/${lang}/${rootSize}px: ${JSON.stringify(cards)}`);
            assert.ok(Math.abs(card.height - cards[0].height) < 1, `Matching height at ${width}px/${lang}/${rootSize}px: ${JSON.stringify(cards)}`);
            assert.equal(card.clipped, false, 'Card contents remain contained');
          }
        }
      }
    }
    assert.deepEqual(errors, []);
    return [{ name: 'Student and opening card dimensions across resize, language and enlarged text', pass: true }];
  } catch (error) {
    return [{ name: 'Student and opening card dimensions across resize, language and enlarged text', pass: false, error: String(error) }];
  } finally {
    await page.close();
  }
}
