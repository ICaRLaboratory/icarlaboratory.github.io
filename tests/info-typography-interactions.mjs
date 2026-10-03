import assert from 'node:assert/strict';

export async function runInfoTypographyChecks(browser, base) {
  const results = [];
  for (const width of [320, 390, 768, 1280]) {
    for (const file of ['lecture.html', 'research.html']) {
      const name = `Information typography ${file} ${width}px KO/EN and CSS text enlargement`;
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      try {
        await page.goto(`${base}/${file}?lang=ko`);
        const selector = file === 'lecture.html' ? '.course__years' : '#projects .pill';
        const initial = await page.locator(selector).allTextContents();
        assert.ok(initial.length > 0);
        for (const lang of ['ko', 'en', 'ko']) {
          await page.locator(`[data-lang="${lang}"]`).click();
          for (const rootSize of [16, 24, 32, 16]) {
            await page.evaluate(size => { document.documentElement.style.fontSize = `${size}px`; }, rootSize);
            await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
            await page.waitForFunction(({ selector, rootSize }) =>
              parseFloat(getComputedStyle(document.documentElement).fontSize) === rootSize &&
              [...document.querySelectorAll(selector)].every(el => Math.abs(parseFloat(getComputedStyle(el).fontSize) - rootSize * .85) < .02),
            { selector, rootSize }, { timeout: 3000 });
            assert.deepEqual(await page.locator(selector).allTextContents(), initial, 'Years and statuses stay unchanged');
            const items = await page.locator(selector).evaluateAll(nodes => nodes.map(el => {
              const style = getComputedStyle(el);
              const bounds = el.closest('.course, .project').getBoundingClientRect();
              const range = document.createRange(); range.selectNodeContents(el);
              const rects = [...range.getClientRects()];
              return {
                family: style.fontFamily, size: parseFloat(style.fontSize), weight: style.fontWeight,
                spacing: style.letterSpacing, lineHeight: parseFloat(style.lineHeight),
                fits: rects.every(r => r.left >= bounds.left - 1 && r.right <= bounds.right + 1 && r.left >= -1 && r.right <= innerWidth + 1),
                background: style.backgroundColor, color: style.color,
                live: el.classList.contains('pill--live'),
              };
            }));
            for (const item of items) {
              assert.match(item.family, /Pretendard/);
              assert.doesNotMatch(item.family, /Mono/);
              assert.ok(Math.abs(item.size - rootSize * .85) < .02, `Secondary information uses .85rem: actual=${item.size}, root=${rootSize}, lang=${lang}`);
              assert.equal(item.weight, '500');
              assert.ok(item.spacing === 'normal' || parseFloat(item.spacing) === 0);
              assert.ok(Math.abs(item.lineHeight - item.size * 1.5) < .05);
              assert.equal(item.fits, true, 'Actual text remains inside its row and viewport');
              if (file === 'research.html') {
                assert.equal(item.background, item.live ? 'rgb(10, 10, 10)' : 'rgba(0, 0, 0, 0)');
                assert.equal(item.color, item.live ? 'rgb(255, 255, 255)' : 'rgb(102, 102, 112)');
              }
            }
          }
        }
        results.push({ name, pass: true });
      } catch (error) { results.push({ name, pass: false, error: String(error) }); }
      finally { await page.close(); }
    }
  }
  return results;
}
