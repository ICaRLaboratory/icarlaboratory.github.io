import assert from 'node:assert/strict';

export async function runChipConsistencyChecks(browser, base) {
  const results = [];
  for (const width of [320, 360, 768, 1280]) for (const lang of ['ko', 'en']) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      for (const file of ['research', 'members']) {
        await page.goto(`${base}/${file}.html?lang=${lang}`);
        const links = page.locator(file === 'research' ? '.research-nav--sections a' : '.members-nav a');
        assert.equal(await links.locator('svg').count(), 0, 'No downward arrows');
        for (const link of await links.all()) {
          const s = await link.evaluate(el => { const s = getComputedStyle(el); return [s.backgroundColor, s.borderRadius, s.fontSize]; });
          assert.deepEqual(s, ['rgba(0, 0, 0, 0)', '999px', '16px']);
        }
      }
      await page.goto(`${base}/contact.html?lang=${lang}`);
      await page.evaluate(() => document.fonts.ready);
      const links = page.locator('#contactlinks a');
      assert.equal(await links.count(), 4);
      const boxes = await links.evaluateAll(ns => ns.map(n => {const b=n.getBoundingClientRect();return {height:b.height,top:b.top,left:b.left,right:b.right};}));
      for (const b of boxes) { assert.equal(b.height, boxes[0].height); assert.ok(b.left>=0 && b.right<=width && b.height===38); }
      if (width >= 768) for (const b of boxes) assert.ok(Math.abs(b.top-boxes[0].top)<1, 'Email and maps share a row');
      for (const link of await links.all()) {
        const background = await link.evaluate(el=>getComputedStyle(el).backgroundColor);
        await link.hover();
        await page.waitForFunction(el=>getComputedStyle(el).opacity==='0.86' && getComputedStyle(el).transform==='matrix(1, 0, 0, 1, 0, -2)', await link.elementHandle());
        assert.equal(await link.evaluate(el=>getComputedStyle(el).backgroundColor), background, 'Keep provider color on hover');
        await page.mouse.move(0,0);
      }
      results.push({name:`Consistent navigation and Contact chips ${width}px ${lang}`,pass:true});
    } catch(error) {results.push({name:`Consistent navigation and Contact chips ${width}px ${lang}`,pass:false,error:String(error)});}
    finally {await page.close();}
  }
  return results;
}
