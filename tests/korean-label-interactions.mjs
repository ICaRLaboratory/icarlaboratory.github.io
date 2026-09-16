import assert from 'node:assert/strict';

export async function runKoreanLabelChecks(browser, base) {
  const results = [];
  for (const file of ['members', 'contact']) for (const width of [320, 360, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const name = `Bilingual information labels (${file}, ${width}px)`;
    try {
      await page.goto(`${base}/${file}.html?lang=en`);
      const labels = page.locator('main .contact-row dt, .person__role, .badge');
      const styles = () => labels.evaluateAll(nodes => nodes.map(el => {
        const s = getComputedStyle(el);
        return [s.fontFamily, s.fontSize, s.fontWeight, s.letterSpacing, s.color];
      }));
      const checkTypography = async () => {
        const actual = await labels.evaluateAll(nodes => nodes.map(el => {
          const s = getComputedStyle(el);
          return { text: el.textContent.trim(), family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, spacing: s.letterSpacing, transform: s.textTransform };
        }));
        for (const label of actual) {
          assert.match(label.family, /Pretendard/, `${label.text}: shared text family`);
          assert.equal(label.size, '13px', `${label.text}: readable label size`);
          assert.equal(label.weight, '600');
          assert.equal(label.spacing, 'normal');
          assert.equal(label.transform, 'none');
        }
      };
      await checkTypography();
      const english = await styles();
      await page.locator('[data-lang="ko"]').click();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.evaluate(() => document.fonts.ready);
      await checkTypography();
      const korean = await labels.evaluateAll(nodes => nodes.filter(el => /[가-힣]/.test(el.textContent)).map(el => {
        const s = getComputedStyle(el);
        return { text: el.textContent, family: s.fontFamily, size: parseFloat(s.fontSize), weight: Number(s.fontWeight), spacing: parseFloat(s.letterSpacing) || 0 };
      }));
      assert.ok(korean.length > 0);
      for (const label of korean) {
        assert.ok(label.size >= 13, `${label.text}: at least 13px at normal root size`);
        assert.match(label.family, /Pretendard/);
        assert.ok(label.weight >= 500 && label.weight <= 600);
        assert.ok(Math.abs(label.spacing) <= 0.15, `${label.text}: compact Korean spacing`);
      }
      for (const label of await labels.all()) {
        await label.scrollIntoViewIfNeeded();
        const box = await label.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= width, 'Labels stay within viewport');
      }
      const overlaps = await page.locator('main .contact-row').evaluateAll(rows => rows.filter(row => {
        const dt = row.querySelector('dt'), dd = row.querySelector('dd');
        const range = document.createRange(); range.selectNodeContents(dt);
        const a = range.getBoundingClientRect(), b = dd.getBoundingClientRect();
        return a.top < b.bottom && a.bottom > b.top && a.right > b.left;
      }).map(row => row.textContent));
      assert.deepEqual(overlaps, [], 'Enlarged labels do not overlap values');
      await page.locator('[data-lang="en"]').click();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.deepEqual(await styles(), english, 'English typography is unchanged after switching back');
      results.push({ name, pass: true });
    } catch (error) { results.push({ name, pass: false, error: error.message }); }
    finally { await page.close(); }
  }
  return results;
}
