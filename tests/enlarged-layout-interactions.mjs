import assert from 'node:assert/strict';

// Use actual browser default-font preferences, not CSS scaling or page zoom.
// The supplied browser stays open; each preference gets an isolated browser.
export async function runEnlargedLayoutChecks(browser, base, { fontSizes = [16, 24, 32] } = {}) {
  return runNativeEnlargedLayoutChecks(browser.browserType(), base, fontSizes);
}

async function runFontChecks(browser, base, fontSize) {
  const results = [];
  {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    try {
      for (const lang of ['en', 'ko']) for (const file of ['index.html', 'publications.html']) {
        let preserved;
        for (const width of [320, 360, 768, 1280]) {
          const name = `enlarged browser preference ${fontSize}px ${lang} ${file} ${width}px`;
          const page = await context.newPage();
          page.setDefaultTimeout(4000);
          try {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(`${base}/${file}?lang=${lang}`, { waitUntil: 'load' });
            await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); });
            assert.equal(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)), fontSize);
            if (fontSize === 16) {
              assert.ok((await page.locator('.nav__inner').boundingBox()).height <= 68, 'Normal-font header keeps its 68px single row');
            }
            const content = await page.evaluate(() => ({
              brand: document.querySelector('.nav .brand').textContent.replace(/\s+/g, ' ').trim(),
              links: [...document.querySelectorAll('.nav a, .pub a')].map(a => [a.textContent, a.getAttribute('href'), a.target, a.rel]),
              papers: [...document.querySelectorAll('.pub')].map(el => el.textContent),
            }));
            preserved ??= content;
            assert.deepEqual(content, preserved, 'Text and link attributes must survive reflow');
            const bad = await page.evaluate(() => [...document.querySelectorAll('.nav .brand, .nav .brand span, .nav .lang, .nav button, .nav__links, .nav__links a')]
              .filter(el => el.checkVisibility()).flatMap(el => {
                const r = el.getBoundingClientRect();
                return r.left < -1 || r.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1
                  ? [`${el.className || el.id}: ${r.left}..${r.right}, width ${el.clientWidth}, scroll ${el.scrollWidth}`] : [];
              }));
            assert.deepEqual(bad, [], 'Header controls/text must remain in bounds');
            const overflow = await page.evaluate(() => [...document.querySelectorAll('.year-group, .pub-list, .pub, .pub *')].flatMap(el => {
              const r = el.getBoundingClientRect();
              const parent = el.closest('.year-group, #recent').getBoundingClientRect();
              return r.left < parent.left - 1 || r.right > parent.right + 1 ||
                (el.clientWidth && el.scrollWidth > el.clientWidth + 1)
                ? [`${el.className}: width ${el.clientWidth}, scroll ${el.scrollWidth}, right ${r.right}, parent ${parent.right}`] : [];
            }));
            assert.deepEqual(overflow, [], 'Publication descendants must not clip');
            // Reach the skip link natively from a fresh document, then activate it.
            await page.keyboard.press('Tab');
            assert.equal(await page.locator('.skip').evaluate(el => el === document.activeElement), true);
            await page.keyboard.press('Enter');
            assert.equal(await page.locator('#main').evaluate(el => el === document.activeElement), true);
            assert.equal(await page.evaluate(() => document.querySelector('#main').getBoundingClientRect().top >=
              Math.max(0, document.querySelector('#navbar').getBoundingClientRect().bottom) - 1), true, 'Skip target clears header');
            if (width <= 920) {
              await page.goto(`${base}/${file}?lang=${lang}&layout-check=menu`, { waitUntil: 'load' });
              await page.evaluate(() => document.fonts.ready);
              // Native forward order: skip, brand, Korean, English, menu.
              for (const selector of ['.skip', '.nav .brand', '[data-lang="ko"]', '[data-lang="en"]', '#menuBtn']) {
                await page.keyboard.press('Tab');
                assert.equal(await page.locator(selector).evaluate(el => el === document.activeElement), true, `Native Tab reaches ${selector}`);
              }
              await page.keyboard.press('Enter');
              assert.equal(await page.locator('#navlinks a').first().evaluate(el => el === document.activeElement), true);
              await page.waitForFunction(() => getComputedStyle(document.querySelector('#navlinks')).transform === 'none');
              const menu = await page.locator('#navlinks').boundingBox();
              const header = await page.locator('#navbar').boundingBox();
              assert.ok(menu.y >= header.y + header.height - 1, `Dropdown starts ${menu.y}, header ends ${header.y + header.height}`);
              assert.ok(menu.x >= -1 && menu.x + menu.width <= width + 1, 'Dropdown horizontal bounds');
              assert.ok(menu.y + menu.height <= 901, 'Dropdown is bounded by the viewport');
              assert.equal(await page.locator('#navlinks').evaluate(el => getComputedStyle(el).opacity), '1');
              await page.keyboard.press('Tab');
              assert.equal(await page.locator('#navlinks a').nth(1).evaluate(el => el === document.activeElement), true);
              await page.keyboard.press('Escape');
              assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'), 'false');
              assert.equal(await page.locator('#menuBtn').evaluate(el => el === document.activeElement), true);
              await page.locator('#menuBtn').click();
              await page.keyboard.press('Tab');
              assert.equal(await page.locator('#navlinks a').first().evaluate(el => el === document.activeElement), true, 'Pointer-open retains native Tab entry');
              await page.keyboard.press('Shift+Tab');
              assert.equal(await page.locator('#menuBtn').evaluate(el => el === document.activeElement), true);
              for (let i = 0; i < await page.locator('#navlinks a').count() + 1; i++) await page.keyboard.press('Tab');
              assert.equal(await page.locator('#navlinks').evaluate(el => el.contains(document.activeElement)), false, 'Tab exits the menu');
              await page.keyboard.press('Escape');
              assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'), 'false', 'Escape closes menu after focus leaves it');
              assert.equal(await page.locator('#menuBtn').evaluate(el => el === document.activeElement), true);
            }
            results.push({ name, pass: true, error: null });
          } catch (error) { results.push({ name, pass: false, error: error.message }); }
          finally { await page.close(); }
        }
      }
    } finally { await context.close(); }
  }
  return results;
}

// Optional real browser-preference run, with no CSS font-size override.
// Accepts Playwright's chromium BrowserType; caller owns its existing browser.
export async function runNativeEnlargedLayoutChecks(chromium, base, fontSizes = [24, 32]) {
  const results = [];
  for (const fontSize of fontSizes) {
    const browser = await chromium.launch({ args: [`--blink-settings=defaultFontSize=${fontSize}`] });
    try { results.push(...await runFontChecks(browser, base, fontSize)); }
    finally { await browser.close(); }
  }
  return results;
}
