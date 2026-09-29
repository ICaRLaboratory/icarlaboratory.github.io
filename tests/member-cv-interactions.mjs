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
      return { total: people.length, withCv: people.filter(p => p.cvPdf || p.cvUrl).length };
    });
    assert.ok(counts.total > 0);
    assert.equal(await page.locator('.person__cv:disabled').count(), counts.total - counts.withCv);
    // Students/alumni links plus the advisor's own hosted-PDF CV link.
    assert.equal(await page.locator('a.person__cv').count(), counts.withCv + 1);
    assert.equal(await page.locator('#advisor a.person__cv').count(), 1);
    assert.match(await page.locator('#advisor a.person__cv').getAttribute('href'), /assets\/cv\/.*\.pdf$/);
    assert.equal(await page.locator('.person--opening .person__cv').count(), 0);
    // Disabled buttons share the link silhouette: same end-cap document icon.
    for (const btn of await page.locator('.person__cv:disabled').all()) {
      assert.equal(await btn.locator('.person__cv-endcap svg.person__cv-icon').count(), 1);
      assert.equal(await btn.locator('.sr-only').count(), 1);
    }
    for (const link of await page.locator('a.person__cv, .person__cv:disabled').all()) {
      const disabled = await link.evaluate(node => node.matches(':disabled'));
      if (!disabled) {
        assert.equal(await link.getAttribute('target'), '_blank');
        assert.match(await link.getAttribute('rel'), /noopener/);
        // Destination marks: hosted PDFs show the document icon, external pages the site-wide ↗.
        const pdf = await link.evaluate(node => /\.pdf($|[?#])/i.test(node.getAttribute('href')));
        assert.equal(await link.locator('svg.person__cv-icon').count(), pdf ? 1 : 0);
        assert.equal(await link.locator('.person__cv-mark').count(), pdf ? 0 : 1);
        assert.equal(await link.locator('.sr-only').count(), 1);
      }
      // End-cap geometry: a square cap sits flush right at full control height,
      // the mark centres in it, and the CV label centres in the remaining width.
      const geo = await link.evaluate(node => {
        const cv = node.getBoundingClientRect();
        const cap = node.querySelector('.person__cv-endcap').getBoundingClientRect();
        const mark = node.querySelector('.person__cv-endcap > svg') || node.querySelector('.person__cv-endcap');
        const markBox = mark.getBoundingClientRect();
        const label = document.createRange();
        label.selectNodeContents(node);
        label.setEnd(node.firstChild, 2); // the "CV" text node
        const labelBox = label.getBoundingClientRect();
        return {
          square: Math.abs(cap.width - cap.height) <= 1,
          // absolute inset:0 spans the padding box, i.e. clientHeight (borders excluded)
          fullHeight: Math.abs(cap.height - node.clientHeight) <= 1,
          flushRight: Math.abs(cap.right - cv.right) <= 1,
          markCentered: Math.abs((markBox.left + markBox.width / 2) - (cap.left + cap.width / 2)) <= 1
            && Math.abs((markBox.top + markBox.height / 2) - (cap.top + cap.height / 2)) <= 1.5,
          labelCentered: Math.abs((labelBox.left + labelBox.width / 2) - (cv.left + (cv.width - cap.width / 2) / 2)) <= 1.5,
        };
      });
      assert.deepEqual(geo, { square: true, fullHeight: true, flushRight: true, markCentered: true, labelCentered: true }, `CV chip geometry: ${JSON.stringify(geo)}`);
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
    // Fixtures: exercise both optional-CV variants in isolation.
    await page.evaluate(() => {
      document.querySelector('#undergrad').innerHTML =
        personCard({ nameEn: 'CV Url Fixture', nameKo: '외부 구성원', degree: DEG.ug, cvUrl: 'members.html?cv-fixture=1' }, 0) +
        personCard({ nameEn: 'CV Pdf Fixture', nameKo: '문서 구성원', degree: DEG.ug, cvPdf: 'assets/cv/fixture.pdf' }, 1);
    });
    const link = page.locator('#undergrad a.person__cv').first();
    assert.equal(await page.locator('#undergrad a.person__cv').count(), 2);
    assert.equal(await link.getAttribute('href'), 'members.html?cv-fixture=1');
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.equal(await link.getAttribute('rel'), 'noopener');
    assert.equal(await link.locator('.person__cv-mark').count(), 1);
    assert.equal(await link.locator('svg.person__cv-icon').count(), 0);
    const pdfLink = page.locator('#undergrad a.person__cv').nth(1);
    assert.equal(await pdfLink.getAttribute('href'), 'assets/cv/fixture.pdf');
    assert.equal(await pdfLink.getAttribute('rel'), 'noopener');
    assert.equal(await pdfLink.locator('svg.person__cv-icon').count(), 1);
    assert.equal(await pdfLink.locator('.person__cv-endcap').getAttribute('aria-hidden'), 'true');
    assert.equal(await pdfLink.locator('.person__cv-mark').count(), 0);
    // The icon must not stretch the compact control.
    const pdfHeight = await pdfLink.evaluate(node => node.getBoundingClientRect().height);
    assert.ok(pdfHeight >= 24 && pdfHeight <= 30, `Compact PDF CV height: ${pdfHeight}`);
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
