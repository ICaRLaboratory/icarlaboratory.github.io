/* Serve the repository root and open tests/browser-checks.html.
   Tests exercise the real page in an isolated, narrow same-origin frame. */
window.testResults = [];
window.testsDone = false;
(async () => {
  let savedLang;
  try { savedLang = localStorage.getItem('icar-lang'); } catch (_) { /* private mode */ }
  const frame = document.createElement('iframe');
  frame.style.cssText = 'width:390px;height:844px;border:0';
  const loaded = new Promise(resolve => frame.onload = resolve);
  frame.src = '../index.html?test-run=' + Date.now();
  document.body.append(frame);
  const check = (name, pass) => window.testResults.push({ name, pass: !!pass });
  const settle = () => new Promise(resolve => setTimeout(resolve, 300));
  const refreshStyles = async doc => {
    await Promise.all([...doc.querySelectorAll('link[rel="stylesheet"]')].map(sheet =>
      new Promise((resolve, reject) => {
        sheet.onload = resolve;
        sheet.onerror = () => reject(new Error('Stylesheet failed: ' + sheet.href));
        sheet.href += '?test-run=' + Date.now();
      })));
  };
  try {
    check('test page opts out of search indexing',
      document.querySelector('meta[name="robots"]')?.content.split(/[,\s]+/).includes('noindex'));
    await loaded;
    // Revalidate every fixture's styles when rerunning during local development.
    await refreshStyles(frame.contentDocument);
    await settle();
    const doc = frame.contentDocument;
    const nav = doc.querySelector('#navlinks');
    const button = doc.querySelector('#menuBtn');
    const first = nav.querySelector('a');
    check('menu button identifies controlled navigation', button.getAttribute('aria-controls') === nav.id);
    first.focus();
    check('closed mobile navigation cannot receive focus', doc.activeElement !== first);
    button.click();
    await settle();
    first.focus();
    check('open mobile navigation receives focus', doc.activeElement === first);
    check('open menu announces expanded state', button.getAttribute('aria-expanded') === 'true');
    first.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    check('Escape closes menu', !nav.classList.contains('is-open') && button.getAttribute('aria-expanded') === 'false');
    check('Escape returns focus to toggle', doc.activeElement === button);
    if (!nav.classList.contains('is-open')) button.click();
    await settle();
    // Prevent page navigation while allowing the real delegated click handler.
    first.addEventListener('click', event => event.preventDefault(), { once: true });
    first.click();
    check('link activation synchronizes closed state', !nav.classList.contains('is-open') && button.getAttribute('aria-expanded') === 'false');
    frame.style.width = '1100px';
    await settle();
    first.focus();
    check('desktop navigation remains focusable', doc.activeElement === first);
    frame.style.width = '390px';
    await settle();
    check('desktop-to-mobile resize returns navigation focus to toggle', doc.activeElement === button);
    first.focus();
    check('returning to mobile keeps collapsed links unfocusable', doc.activeElement !== first && button.getAttribute('aria-expanded') === 'false');
    for (const page of ['index.html', 'research.html', 'members.html', 'publications.html',
      'lecture.html', 'gallery.html', 'contact.html']) {
      const pageLoaded = new Promise(resolve => frame.onload = resolve);
      frame.src = '../' + page + '?test-run=' + Date.now();
      await pageLoaded;
      const pageDoc = frame.contentDocument;
      await refreshStyles(pageDoc);
      await pageDoc.fonts.ready;
      for (const width of [320, 360, 768, 1100]) {
        frame.style.width = width + 'px';
        await settle();
        for (const lang of ['ko', 'en']) {
          pageDoc.querySelector(`[data-lang="${lang}"]`).click();
          await pageDoc.fonts.ready;
          const edge = pageDoc.documentElement.clientWidth;
          const clipped = [...pageDoc.querySelectorAll('main *')].filter(el => {
            const rect = el.getBoundingClientRect();
            const style = frame.contentWindow.getComputedStyle(el);
            return rect.width > 2 && style.visibility !== 'hidden' &&
              (rect.right > edge + 1 || rect.left < -1);
          });
          check(`${page}: ${width}px ${lang} content fits viewport`, clipped.length === 0);
          if (clipped.length) window.testResults.at(-1).elements = clipped.slice(0, 4)
            .map(el => el.tagName + '.' + el.className);
          if (page === 'contact.html') {
            const address = pageDoc.querySelector('[data-site="addressKo"]');
            check(`Korean address keeps ko language in ${lang} mode at ${width}px`,
              address.closest('[lang]')?.lang === 'ko');
          }
        }
      }
    }
  } catch (error) {
    window.testResults.push({ name: 'test harness', pass: false, error: String(error) });
  } finally {
    frame.remove();
    try {
      if (savedLang === null) localStorage.removeItem('icar-lang');
      else if (savedLang !== undefined) localStorage.setItem('icar-lang', savedLang);
    } catch (_) { /* private mode */ }
    window.testsDone = true;
    document.querySelector('#results').textContent = JSON.stringify(window.testResults, null, 2);
  }
})();
