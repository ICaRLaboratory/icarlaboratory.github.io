// Native clicks exercise browser selection; synthetic clicks do not.
export async function runLightboxChecks(browser, base) {
  const results = [];
  const check = (name, pass) => results.push({ name, pass: !!pass });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  observeErrors(page, base, errors);
  try {
    for (const file of ['gallery.html', 'index.html', 'research.html']) {
      await page.goto(`${base}/${file}`, { waitUntil: 'domcontentloaded' });
      await page.locator(file === 'gallery.html' ? '.shot' : '.card__zoom').first().click();
      const img = page.locator('#lightbox img');
      await page.waitForFunction(() => document.querySelector('#lightbox img').hasAttribute('src'));
      await img.evaluate(el => el.decode());
      const original = await img.getAttribute('src');
      const beforePixels = await img.screenshot();
      const countInSet = file === 'gallery.html'
        ? await page.locator('.album').first().locator('.shot').count()
        : await page.locator(file === 'index.html' ? '#areas .card__zoom' : '#areas-full .card__zoom').count();
      await page.locator('.lightbox__nav--next').click({ clickCount: countInSet, delay: 15 });
      await page.waitForFunction(src => document.querySelector('#lightbox img').getAttribute('src') === src &&
        document.querySelector('#lightbox figure').getAttribute('aria-busy') !== 'true', original);
      await img.evaluate(el => el.decode());
      check(`${file}: rapid round-trip preserves image brightness`, beforePixels.equals(await img.screenshot()));
      for (const side of ['next', 'prev']) {
        for (const count of [2, 3]) {
          await page.locator(`.lightbox__nav--${side}`).click({ clickCount: count, delay: 15 });
          check(`${file}: ${side} ${count}-click does not select/darken the image`,
            await img.evaluate(el => {
              const selection = getSelection();
              return selection.type !== 'Range' || !selection.containsNode(el, true);
            }));
        }
      }
      await page.keyboard.press('Escape');
      check(`${file}: Escape closes viewer`, !await page.locator('#lightbox').evaluate(el => el.open));
    }
    results.push(...await runLoadingChecks(browser, base, errors));
    results.push(...await runTouchChecks(browser, base, errors));
    check('lightbox interactions have no unexpected page or HTTP errors', errors.length === 0);
  } catch (error) {
    results.push({ name: 'lightbox native interactions', pass: false, error: String(error) });
  } finally {
    await page.close();
  }
  return results;
}


async function runLoadingChecks(browser, base, errors) {
  const results = [];
  const check = (name, pass) => results.push({ name, pass: !!pass });
  const page = await browser.newPage();
  observeErrors(page, base, errors);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let failBad = true;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="teal"/></svg>';
  try {
    await page.route('**/qa-viewer-*.svg', async route => {
      if (route.request().url().endsWith('-b.svg')) await pending;
      if (route.request().url().endsWith('-bad.svg') && failBad) {
        await route.fulfill({ status: 503, body: 'Fixture failure' });
        return;
      }
      await route.fulfill({ contentType: 'image/svg+xml', body: svg });
    });
    await page.goto(`${base}/gallery.html`);
    await page.evaluate(() => {
      const album = document.createElement('section');
      album.className = 'album qa-viewer';
      for (const id of ['a', 'b']) {
        const button = document.createElement('button');
        button.className = 'shot';
        button.dataset.src = `/qa-viewer-${id}.svg`;
        button.dataset.alt = `Photo ${id}`;
        album.append(button);
      }
      document.querySelector('#gallery').append(album);
      album.firstElementChild.click();
    });
    await page.waitForFunction(() => document.querySelector('#lightbox img').getAttribute('src') === '/qa-viewer-a.svg');
    await page.locator('#lightbox img').evaluate(el => el.decode());
    await page.locator('.lightbox__nav--next').click();
    check('slow image: displayed photograph retains its own alt and caption',
      await page.locator('#lightbox').evaluate(box =>
        box.querySelector('img').getAttribute('src') === '/qa-viewer-a.svg' &&
        box.querySelector('img').alt === 'Photo a' &&
        box.querySelector('figcaption').textContent.includes('Photo a')));
    check('slow image: loading state is visible',
      await page.locator('.lightbox__status').isVisible());
    await page.keyboard.press('Escape');
    release();
    // A late network completion must not repopulate the closed viewer.
    await page.waitForTimeout(250);
    check('closing invalidates a pending image swap',
      await page.locator('#lightbox').evaluate(box => !box.open && !box.querySelector('img').hasAttribute('src')));
    await page.locator('.qa-viewer .shot').last().evaluate(el => el.click());
    await page.waitForFunction(() => document.querySelector('#lightbox img').getAttribute('src') === '/qa-viewer-b.svg');
    check('reopening shows a consistent photograph and caption',
      await page.locator('#lightbox').evaluate(box => box.querySelector('img').alt === 'Photo b' && box.querySelector('figcaption').textContent.includes('2 / 2')));
    await page.evaluate(() => {
      const bad = document.createElement('button');
      bad.className = 'shot';
      bad.dataset.src = '/qa-viewer-bad.svg';
      bad.dataset.alt = 'Retry photo';
      document.querySelector('.qa-viewer').append(bad);
      // Refresh the opened set through the same delegated handler.
      bad.click();
    });
    await page.waitForFunction(() => document.querySelector('.lightbox__status')?.textContent.includes('could not'));
    check('failed image retains the last good photograph',
      await page.locator('#lightbox img').getAttribute('src') === '/qa-viewer-b.svg');
    const retry = page.locator('.lightbox__retry');
    const canRetry = await retry.isVisible();
    check('failed image offers Retry', canRetry);
    if (canRetry) {
      failBad = false;
      await retry.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#lightbox img').getAttribute('src') === '/qa-viewer-bad.svg');
      check('Retry recovers with matching caption', (await page.locator('#lightbox figcaption').textContent()).includes('Retry photo'));
      check('Retry does not leave focus on a hidden control', await page.evaluate(() => document.activeElement.getClientRects().length > 0 && document.activeElement !== document.body));
    }
    // Load before the deadline, then finish decoding after timeout.
    const beforeTimeout = await page.locator('#lightbox img').getAttribute('src');
    await page.clock.install();
    await page.evaluate(() => {
      window.Image = function () {
        const ready = { complete: false, naturalWidth: 800, onload: null, onerror: null,
          decode: () => new Promise(resolve => setTimeout(resolve, 200)) };
        Object.defineProperty(ready, 'src', { set: () => setTimeout(() => ready.onload?.(), 14950) });
        return ready;
      };
      const late = document.createElement('button');
      late.className = 'shot';
      late.dataset.src = '/qa-viewer-late.svg';
      late.dataset.alt = 'Late decode';
      document.querySelector('.qa-viewer').append(late);
      late.click();
    });
    await page.clock.fastForward(14960);
    await page.clock.fastForward(50);
    check('image deadline reports a timeout', (await page.locator('.lightbox__status').textContent()).includes('could not'));
    await page.clock.fastForward(250);
    check('late decode cannot override the timeout',
      await page.locator('#lightbox img').getAttribute('src') === beforeTimeout && await page.locator('.lightbox__retry').isVisible());
  } catch (error) {
    results.push({ name: 'lightbox delayed loading', pass: false, error: String(error) });
  } finally {
    release();
    await page.close();
  }
  return results;
}


async function runTouchChecks(browser, base, errors) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const results = [];
  try {
    const page = await context.newPage();
    observeErrors(page, base, errors);
    await page.goto(`${base}/gallery.html`);
    await page.locator('.shot').first().tap();
    await page.waitForFunction(() => document.querySelector('#lightbox img').hasAttribute('src'));
    await page.locator('#lightbox img').evaluate(el => el.decode());
    const before = await page.locator('#lightbox img').getAttribute('src');
    const rect = await page.locator('#lightbox img').boundingBox();
    const x = rect.x + rect.width * 0.75, y = rect.y + rect.height * 0.5;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 6; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - i * 20, y }] });
      await page.waitForTimeout(30);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const changed = await page.waitForFunction(src => document.querySelector('#lightbox img').getAttribute('src') !== src,
      before, { timeout: 1500 }).then(() => true, () => false);
    results.push({ name: 'native touch swipe advances the photograph', pass: changed });
    results.push({ name: 'touch swipe leaves viewer open', pass: await page.locator('#lightbox').evaluate(el => el.open) });
    const beforeTwoFingers = await page.locator('#lightbox img').getAttribute('src');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 80, y, id: 1 }, { x, y, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(250);
    results.push({ name: 'two-finger gesture does not trigger photo navigation', pass: await page.locator('#lightbox img').getAttribute('src') === beforeTwoFingers });
  } catch (error) {
    results.push({ name: 'native touch swipe', pass: false, error: String(error) });
  } finally {
    await context.close();
  }
  return results;
}


function observeErrors(page, base, errors) {
  page.on('pageerror', error => errors.push(String(error)));
  page.on('response', response => {
    if (response.url().startsWith(base + '/') && response.status() >= 400 &&
        !response.url().endsWith('/qa-viewer-bad.svg')) {
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
}
