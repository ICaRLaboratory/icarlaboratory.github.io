import assert from 'node:assert/strict';

export async function runContactMapLinkChecks(browser, base) {
  const results = [];
  for (const width of [320, 360, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    try {
      await page.goto(`${base}/contact.html?lang=en`);
      const iframe = await page.locator('#map iframe').getAttribute('src');
      for (const lang of ['en', 'ko', 'en']) {
        await page.locator(`[data-lang="${lang}"]`).click();
        const links = page.locator('#contactlinks .map-link');
        assert.deepEqual(await links.locator('span[data-en]').allTextContents(), lang === 'ko'
          ? ['네이버 지도', '카카오맵', 'Google 지도'] : ['Naver Maps', 'Kakao Map', 'Google Maps']);
        const targets = await links.evaluateAll(nodes => nodes.map(n => ({ href: n.href, target: n.target, rel: n.rel })));
        assert.equal(targets[0].href, 'https://map.naver.com/p/entry/place/1030806564');
        const coords = await page.evaluate(() => SITE.contact.coords);
        assert.equal(decodeURIComponent(new URL(targets[1].href).pathname), `/link/map/세종대학교 대양AI센터,${coords}`);
        assert.equal(targets[2].href, await page.evaluate(() => SITE.contact.mapUrl));
        for (const t of targets) { assert.equal(t.target, '_blank'); assert.match(t.rel, /noopener/); }
        await page.evaluate(() => document.fonts.ready);
        const chips = page.locator('#contactlinks .contact-chip');
        const firstBox = await chips.first().boundingBox();
        for (const chip of await chips.all()) {
          const box = await chip.boundingBox();
          assert.equal(box.height, 38, 'Contact chips should be compact');
          assert.ok(Math.abs(box.width - firstBox.width) < 1, 'All four chip widths should match');
          assert.ok(box.width >= 44 && box.x >= 0 && box.x + box.width <= width);
        }
        assert.equal(await page.locator('#map iframe').getAttribute('src'), iframe);
        assert.equal(await page.locator('#contactlinks .contact-chip--email').getAttribute('href'), 'mailto:lsy@sejong.ac.kr');
        const email = page.locator('#contactlinks .contact-chip--email');
        assert.equal(await email.locator('span[data-en]').textContent(), lang === 'ko' ? '이메일' : 'Email');
        assert.equal(await email.locator('[aria-hidden="true"]').textContent(), '↗');
        assert.equal(await email.evaluate(el => getComputedStyle(el).fontSize), await links.first().evaluate(el => getComputedStyle(el).fontSize));
        assert.equal(await page.locator('.contact-row a[href="mailto:lsy@sejong.ac.kr"]').textContent(), 'lsy@sejong.ac.kr');
        await email.focus();
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.getAttribute('class')), 'contact-chip map-link map-link--naver');
        for (const provider of ['kakao', 'google']) {
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement.getAttribute('class')), `contact-chip map-link map-link--${provider}`);
        }
      }
      results.push({ name: `Contact branded map links ${width}px KO/EN`, pass: true });
    } catch (error) { results.push({ name: `Contact branded map links ${width}px KO/EN`, pass: false, error: String(error) }); }
    finally { await page.close(); }
  }
  return results;
}
