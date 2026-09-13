import assert from 'node:assert/strict';

export async function runContactLayoutChecks(browser, base) {
  const results = [];
  for (const name of ['contact', 'members']) {
    for (const width of [320, 360, 768, 1280]) {
      for (const lang of ['ko', 'en']) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(`${base}/${name}.html?lang=${lang}`);
          await page.locator('.contact-row dd').first().waitFor();
          const original = await page.locator('.contact-list').evaluateAll(lists => lists.map(list => ({
            text: list.textContent, links: [...list.querySelectorAll('a')].map(a => a.getAttribute('href')),
          })));
          for (const scale of [100, 200]) {
            // Root-font scaling simulates text enlargement, not native browser zoom.
            await page.evaluate(scale => document.documentElement.style.fontSize = `${scale}%`, scale);
            for (const media of ['screen', 'print']) {
              const label = `Contact spacing: ${name} ${width}px ${lang} ${scale}% ${media}`;
              try {
                await page.emulateMedia({ media });
                await page.evaluate(async () => {
                  await document.fonts.ready;
                  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                });
                const rows = await page.locator('.contact-row').evaluateAll(elements => elements.map(row => {
                  const dt = row.querySelector('dt'), dd = row.querySelector('dd');
                  const range = document.createRange();
                  range.selectNodeContents(dt);
                  const label = range.getBoundingClientRect(), value = dd.getBoundingClientRect();
                  const bounds = row.getBoundingClientRect();
                  range.selectNodeContents(dd);
                  return {
                    text: dt.textContent,
                    separated: value.top >= label.bottom + 3 || value.left >= label.right + 8,
                    contained: [...range.getClientRects(), label, value].every(r => r.left >= bounds.left - 1 && r.right <= bounds.right + 1),
                  };
                }));
                assert.ok(rows.length >= 4, 'Real contact data must be present');
                for (const row of rows) {
                  assert.ok(row.separated, `${row.text}: label needs a visible gap from value`);
                  assert.ok(row.contained, `${row.text}: contact text must stay inside its row`);
                }
                assert.deepEqual(await page.locator('.contact-list').evaluateAll(lists => lists.map(list => ({
                  text: list.textContent, links: [...list.querySelectorAll('a')].map(a => a.getAttribute('href')),
                }))), original, 'Layout preserves contact text and links');
                assert.deepEqual(errors, []);
                results.push({ name: label, pass: true });
              } catch (error) { results.push({ name: label, pass: false, error: error.message }); }
            }
          }
        } finally { await page.close(); }
      }
    }
  }
  return results;
}
