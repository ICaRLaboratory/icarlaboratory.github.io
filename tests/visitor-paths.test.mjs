import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let browser, server, base;
before(async () => {
  server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Preview server startup timed out')), 10000);
    let output = '';
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/Serving HTTP on .* port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    server.on('error', error => { clearTimeout(timeout); reject(error); });
    server.on('exit', code => { clearTimeout(timeout); reject(new Error(`Preview server exited: ${code}`)); });
  });
  assert.equal((await fetch(base)).ok, true);
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
});
after(async () => { await browser?.close(); server?.kill(); });

test('Recruitment offers a native bilingual guide path while preserving direct email', async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    for (const lang of ['ko', 'en']) {
      await page.goto(`${base}/index.html?lang=${lang}`);
      const guide = page.locator('#recruit a[href="members.html#application-guide"]');
      assert.equal(await guide.count(), 1);
      assert.equal((await guide.innerText()).replace(/\s+/g, ' ').trim(), `${lang === 'ko' ? '지원 안내' : 'Application guide'} →`);
      assert.equal(await page.locator('#recruit a[href="mailto:lsy@sejong.ac.kr"]').count(), 1);
      await tabTo(page, '#recruit a[href="members.html#application-guide"]');
      await page.keyboard.press('Enter');
      await page.waitForURL('**/members.html#application-guide');
      // Destination content is owned by the separate HTML task.
      const openings = page.locator('.person--opening');
      assert.equal(await openings.count(), 2);
      for (const card of await openings.all()) {
        assert.equal(await card.locator('a[href="mailto:lsy@sejong.ac.kr"]').count(), 1);
        assert.equal(await card.locator('a[href="#application-guide"]').count(), 1);
      }
    }
  } finally { await context.close(); }
});

async function tabTo(page, selector) {
  for (let i = 0; i < 150; i++) {
    if (await page.locator(selector).evaluate(el => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  assert.fail(`Native Tab did not reach ${selector}`);
}

test('Shared navigation localizes in place and retains native mobile focus order', async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/index.html?lang=en`);
      await page.evaluate(() => { window.savedNavigation = [...document.querySelectorAll('#navlinks a, #footer a')]; });
      for (const lang of ['ko', 'en']) {
        await page.locator(`[data-lang="${lang}"]`).click();
        const labels = lang === 'ko' ? ['홈', '연구', '구성원', '논문', '강의', '갤러리', '연락처'] : ['Home', 'Research', 'Members', 'Publications', 'Lecture', 'Gallery', 'Contact'];
        assert.deepEqual(await page.locator('#navlinks a').allTextContents(), labels);
        assert.deepEqual((await page.locator('#footer a').allTextContents()).slice(0, 7), labels);
        assert.equal(await page.locator('#menuBtn').getAttribute('aria-label'), lang === 'ko' ? '메뉴' : 'Menu');
        assert.equal(await page.locator('.lang').getAttribute('aria-label'), lang === 'ko' ? '언어 선택' : 'Language');
        assert.equal(await page.evaluate(() => savedNavigation.every((node, i) => node === document.querySelectorAll('#navlinks a, #footer a')[i])), true);
        if (width === 320) {
          await tabTo(page, '#menuBtn');
          await page.keyboard.press('Enter');
          assert.equal(await page.locator('#navlinks a').first().evaluate(el => el === document.activeElement), true);
          await page.keyboard.press('Tab');
          assert.equal(await page.locator('#navlinks a').nth(1).evaluate(el => el === document.activeElement), true);
        } else await tabTo(page, '#navlinks a[href="research.html"]');
        await page.evaluate(() => setLang(LANG === 'ko' ? 'en' : 'ko'));
        assert.equal(await page.locator('#navlinks a[href="research.html"]').evaluate(el => el === document.activeElement), true, 'Language updates preserve a focused native anchor');
        if (width === 320) await page.keyboard.press('Escape');
      }
    }
  } finally { await context.close(); }
});

test('Visitor links and application guide have scoped readable responsive styles', async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    for (const width of [320, 1280]) for (const lang of ['ko', 'en']) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/index.html?lang=${lang}`);
      for (const link of await page.locator('.area-publication, .area-example, .recruit__guide, .hero__faculty a').all()) {
        assert.ok((await link.boundingBox()).height >= 44, 'Added links have comfortable native focus targets');
      }
      await page.goto(`${base}/members.html?lang=${lang}#application-guide`);
      const styles = await page.locator('.application-guide__grid').evaluate(el => {
        const grid = getComputedStyle(el), heading = getComputedStyle(el.querySelector('h3'));
        return { display: grid.display, margin: parseFloat(grid.marginTop), gap: parseFloat(grid.gap), weight: parseInt(heading.fontWeight), columns: grid.gridTemplateColumns.split(' ').length };
      });
      assert.equal(styles.display, 'grid');
      assert.ok(styles.margin >= 24 && styles.gap >= 24, 'Guide headings do not touch');
      assert.ok(styles.weight >= 600);
      assert.equal(styles.columns, width === 320 ? 1 : 2);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow');
    }
  } finally { await context.close(); }
});

const refs = ['10.1016/j.matcom.2025.11.031', '10.3390/math14132323', '10.3390/electronics15173864'];
test('Each shared research card leads natively to its one DOI-backed publication in both languages', async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    for (const file of ['index.html', 'research.html']) for (const lang of ['ko', 'en']) {
      await page.goto(`${base}/${file}?lang=${lang}`);
      const data = await page.evaluate(() => SITE.areas.map(a => ({ ref: a.ref, title: JOURNAL_PAPERS.find(p => p.doi === a.ref)?.title })));
      assert.deepEqual(data.map(a => a.ref), refs, 'Every area references its actual representative DOI');
      const host = file === 'index.html' ? '#areas' : '#areas-full';
      for (let i = 0; i < refs.length; i++) {
        const link = page.locator(`${host} .card`).nth(i).locator('.area-publication');
        assert.equal(await link.count(), 1);
        assert.equal(await link.getAttribute('href'), `publications.html?q=${encodeURIComponent(refs[i])}`);
        assert.equal(await link.getAttribute('title'), data[i].title);
        assert.equal((await link.innerText()).replace(/\s+/g, ' ').trim(), `${lang === 'ko' ? '대표 논문' : 'Representative publication'} →`);
        assert.equal(await link.getAttribute('target'), null);
      }
      await tabTo(page, `${host} .card:first-child .area-publication`);
      await page.keyboard.press('Enter');
      await page.waitForURL('**/publications.html?q=*');
      assert.equal(await page.locator('#publist .pub').count(), 1);
      assert.equal(await page.locator('#publist .pub__title').innerText(), data[0].title);
      await page.reload();
      assert.equal(await page.locator('#publist .pub').count(), 1);
      await page.locator(`[data-lang="${lang === 'ko' ? 'en' : 'ko'}"]`).click();
      assert.equal(await page.locator('#publist .pub').count(), 1);
      for (let i = 1; i < refs.length; i++) {
        await page.goto(`${base}/publications.html?lang=${lang}&q=${encodeURIComponent(refs[i])}`);
        assert.equal(await page.locator('#publist .pub').count(), 1);
        assert.equal(await page.locator('#publist .pub__title').innerText(), data[i].title);
      }
    }
    await page.goto(`${base}/index.html?lang=en`);
    await page.evaluate(() => { JOURNAL_PAPERS.find(p => p.doi === SITE.areas[0].ref).title = 'Updated title <from data>'; setLang('ko'); });
    assert.equal(await page.locator('#areas .area-publication').first().getAttribute('title'), 'Updated title <from data>');
  } finally { await context.close(); }
});

test('Robotics offers the existing public research image, not an invented demonstration', async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    for (const lang of ['ko', 'en']) {
      await page.goto(`${base}/research.html?lang=${lang}`);
      const link = page.locator('#areas-full .area-example');
      assert.equal(await link.count(), 1);
      assert.equal(await link.getAttribute('href'), 'assets/img/area-robotics.jpg');
      assert.equal((await link.innerText()).replace(/\s+/g, ' ').trim(), `${lang === 'ko' ? '연구 이미지 보기' : 'View research image'} →`);
      await tabTo(page, '#areas-full .area-example');
      await page.keyboard.press('Enter');
      await page.waitForURL('**/assets/img/area-robotics.jpg');
      assert.equal((await page.request.get(page.url())).status(), 200);
    }
  } finally { await context.close(); }
});
