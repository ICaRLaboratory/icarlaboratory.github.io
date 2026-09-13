import assert from 'node:assert/strict';

export async function runContactMembersLanguageChecks(browser, base) {
  const results = [];
  async function check(name, run) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await run(page);
      assert.deepEqual(errors, []);
      results.push({ name, pass: true });
    } catch (error) {
      results.push({ name, pass: false, error: error.message });
    } finally { await context.close(); }
  }
  async function contact(page, lang) {
    assert.equal(await page.locator('[data-site="contactLabName"]').textContent(), lang === 'ko' ? 'ICaR 연구실' : 'Intelligent Control and Robotics Laboratory');
    assert.equal(await page.locator('main .contact-row').count(), 5, 'Only one address row');
    assert.equal(await page.locator('[data-site="address"]').textContent(), lang === 'ko'
      ? '05006 서울특별시 광진구 능동로 209 (군자동) 세종대학교 대양 AI센터 515호'
      : '209 Neungdong-ro, Gwangjin-gu, Seoul 05006, Republic of Korea');
    assert.equal(await page.locator('[data-site="department"]').textContent(), lang === 'ko'
      ? '지능정보융합학과' : 'Department of Artificial Intelligence and Information Technology');
    assert.equal(await page.locator('[data-site="office"]').textContent(), lang === 'ko'
      ? '대양 AI센터 515호' : 'Room 515, Daeyang AI Center');
    assert.deepEqual(await page.locator('main dt').allTextContents(), lang === 'ko'
      ? ['연구실', '연구실 위치', '주소', '이메일', '학과'] : ['Lab', 'Office', 'Address', 'Email', 'Department']);
    assert.equal(await page.locator('[data-site="address"]').evaluate(el => el.closest('[lang]').lang), lang);
    assert.equal((await page.locator('body').innerText()).includes('[object Object]'), false);
  }
  await check('Contact selected-language fields switch both ways without replacing links or map', async page => {
    await page.goto(`${base}/contact.html?lang=en`);
    await contact(page, 'en');
    const links = await page.locator('main a').evaluateAll(nodes => nodes.map(n => [n.href, n.target, n.rel]));
    const map = await page.locator('#map iframe').getAttribute('src');
    await page.evaluate(() => { window.savedLinks = [...document.querySelectorAll('main a')]; window.savedMap = document.querySelector('#map iframe'); });
    for (const lang of ['ko', 'en']) {
      await page.locator(`[data-lang="${lang}"]`).click();
      await contact(page, lang);
      assert.deepEqual(await page.locator('main a').evaluateAll(nodes => nodes.map(n => [n.href, n.target, n.rel])), links);
      assert.equal(await page.locator('#map iframe').getAttribute('src'), map);
      assert.equal(await page.evaluate(() => window.savedLinks.every(n => n.isConnected) && window.savedMap === document.querySelector('#map iframe')), true);
    }
  });
  async function members(page, lang) {
    const expected = await page.evaluate(lang => [ADVISOR, ...GRAD_STUDENTS, ...UNDERGRAD_STUDENTS, ...ALUMNI].map(p => lang === 'ko' ? p.nameKo || p.nameEn : p.nameEn), lang);
    assert.deepEqual(await page.locator('#advisor h2, .person__name').allTextContents(), expected, 'One selected-language name per person');
    assert.equal(await page.locator('#advisor .lede').textContent(), lang === 'ko'
      ? '부교수, 세종대학교 지능정보융합학과'
      : 'Associate Professor, Department of Artificial Intelligence and Information Technology, Sejong University');
    assert.deepEqual(await page.locator('.person__role').allTextContents(), lang === 'ko'
      ? ['박사과정', '석사과정', '석사과정', '석사', '석사']
      : ['Ph.D. Candidate', 'M.S. Candidate', 'M.S. Candidate', 'M.S.', 'M.S.']);
    const thesis = await page.locator('#advisor .timeline').last().locator('.tl-note').nth(1).textContent();
    assert.equal(thesis, lang === 'ko'
      ? '학위논문: “Stability Analysis of Systems with Time-varying Delays via Slack Matrix Based Approaches” · 지도교수: PooGyeon Park 교수'
      : 'Dissertation: “Stability Analysis of Systems with Time-varying Delays via Slack Matrix Based Approaches” · Advisor: Prof. PooGyeon Park');
    assert.equal(await page.locator('.badge').textContent(), lang === 'ko' ? '연구실 매니저' : 'Lab Manager');
    assert.equal(await page.locator('#advisor .contact-row').nth(1).locator('dd').textContent(), lang === 'ko' ? '대양 AI센터 515호' : 'Room 515, Daeyang AI Center');
    assert.equal((await page.locator('body').innerText()).includes('[object Object]'), false);
  }
  await check('Members names, roles and affiliations switch in place and retain visible reveal nodes', async page => {
    await page.goto(`${base}/members.html?lang=en`);
    await members(page, 'en');
    const links = await page.locator('main a').evaluateAll(nodes => nodes.map(n => [n.href, n.target, n.rel]));
    const facts = await page.locator('.tags, .tl-period, .person__meta').allTextContents();
    await page.locator('#alumni').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('#alumni [data-reveal]')].every(n => n.classList.contains('is-in')));
    await page.evaluate(() => { window.savedLinks = [...document.querySelectorAll('main a')]; window.savedPeople = [...document.querySelectorAll('#advisor > div, .person')]; });
    for (const lang of ['ko', 'en']) {
      await page.locator(`[data-lang="${lang}"]`).click();
      await members(page, lang);
      assert.deepEqual(await page.locator('main a').evaluateAll(nodes => nodes.map(n => [n.href, n.target, n.rel])), links);
      // Interests and dates remain factual; the graduation label alone is translated.
      const current = await page.locator('.tags, .tl-period, .person__meta').allTextContents();
      assert.deepEqual(current.map(s => s.replace('졸업', 'Graduated').replace('현재', 'present')), facts);
      assert.equal(await page.evaluate(() => window.savedLinks.every(n => n.isConnected) && window.savedPeople.every(n => n.isConnected)), true);
      assert.equal(await page.locator('#alumni [data-reveal]:not(.is-in)').count(), 0);
    }
  });
  await check('Members portrait alternative text follows selected name', async page => {
    await page.goto(`${base}/members.html?lang=ko`);
    for (const lang of ['ko', 'en', 'ko']) {
      await page.locator(`[data-lang="${lang}"]`).click();
      const names = await page.evaluate(lang => [ADVISOR, ...GRAD_STUDENTS].filter(p => p.photo).map(p => lang === 'ko' ? p.nameKo || p.nameEn : p.nameEn), lang);
      assert.deepEqual(await page.locator('#advisor img, .person img').evaluateAll(nodes => nodes.map(n => n.alt)), names);
    }
  });
  for (const [file, verify] of [['contact', contact], ['members', members]]) {
    await check(`${file}: initial/default, query override, reload, cross-page and native history restore selected language`, async page => {
      await page.goto(`${base}/${file}.html`);
      await verify(page, 'ko');
      await page.evaluate(() => localStorage.setItem('icar-lang', 'en'));
      await page.reload();
      await verify(page, 'en');
      await page.goto(`${base}/${file}.html?lang=ko&keep=a&keep=b`);
      await verify(page, 'ko');
      await page.evaluate(() => history.replaceState({ marker: 'keep' }, ''));
      const original = page.url();
      await page.locator('.skip').focus();
      await page.keyboard.press('Enter');
      await page.locator('[data-lang="en"]').click();
      const english = page.url();
      await verify(page, 'en');
      await page.locator('main a').first().focus();
      await page.evaluate(() => { window.focusedLink = document.activeElement; });
      await page.goBack();
      await verify(page, 'ko');
      assert.equal(page.url(), original);
      assert.deepEqual(await page.evaluate(() => history.state), { marker: 'keep' });
      assert.equal(await page.evaluate(() => window.focusedLink === document.activeElement && window.focusedLink.isConnected), true, 'History translation preserves focused link');
      await page.goForward();
      await verify(page, 'en');
      assert.equal(page.url(), english);
      await page.reload();
      await verify(page, 'en');
      await page.locator('[data-lang="ko"]').click();
      await page.reload();
      await verify(page, 'ko');
      const other = file === 'contact' ? 'members' : 'contact';
      await page.locator(`#navlinks a[href="${other}.html"]`).click();
      await (other === 'members' ? members : contact)(page, 'ko');
      await page.goBack();
      await verify(page, 'ko');
    });
  }
  return results;
}
