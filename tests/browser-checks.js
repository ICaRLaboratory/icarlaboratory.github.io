/* Serve the repository root and open tests/browser-checks.html.
   Tests exercise the real page in an isolated, narrow same-origin frame. */
window.testResults = [];
window.testsDone = false;
(async () => {
  let savedLang;
  try { savedLang = localStorage.getItem('icar-lang'); } catch (_) { /* private mode */ }
  const frame = document.createElement('iframe');
  frame.style.cssText = 'width:390px;height:844px;border:0';
  document.body.append(frame);
  const check = (name, pass) => window.testResults.push({ name, pass: !!pass });
  const settle = () => new Promise(resolve => setTimeout(resolve, 300));
  /* Resolve on the new document being parsed, not on the frame's load event:
     contact.html carries a map iframe, and waiting for it hangs the run. */
  let navSeq = 0;
  const navigate = (path) => {
    const marker = 'test-run=' + Date.now() + '-' + (navSeq++);
    return new Promise(resolve => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      const started = Date.now();
      frame.onload = done;
      const poll = () => {
        if (settled) return;
        let doc = null;
        try { doc = frame.contentDocument; } catch (_) { /* mid-navigation */ }
        /* the marker says this is the document we asked for and not the one
           before it, which is already complete and would resolve at once */
        const here = doc && doc.location && doc.location.href.indexOf(marker) !== -1;
        if (here && (doc.readyState === 'complete'
            || (doc.readyState === 'interactive' && Date.now() - started > 1500))) done();
        else if (Date.now() - started > 10000) done();   /* test what is there */
        else setTimeout(poll, 100);
      };
      frame.src = path + '?' + marker;
      setTimeout(poll, 100);
    });
  };
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
    await navigate('../index.html');
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
      await navigate('../' + page);
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
          // a scroller's contents are meant to be past its edge
          const inScroller = el => {
            for (let node = el.parentElement; node && node !== pageDoc.body; node = node.parentElement) {
              const flow = frame.contentWindow.getComputedStyle(node).overflowX;
              if (flow === 'auto' || flow === 'scroll') return true;
            }
            return false;
          };
          const clipped = [...pageDoc.querySelectorAll('main *')].filter(el => {
            const rect = el.getBoundingClientRect();
            const style = frame.contentWindow.getComputedStyle(el);
            return rect.width > 2 && style.visibility !== 'hidden' &&
              (rect.right > edge + 1 || rect.left < -1) && !inScroller(el);
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
    await navigate('../gallery.html');
    const galleryDoc = frame.contentDocument;
    const yearChip = galleryDoc.querySelector('#galfilters [data-set]:not([data-set="all"])');
    if (!yearChip) throw new Error('Gallery filter fixture needs multiple years');
    yearChip.focus();
    yearChip.click();
    const selectedYear = yearChip.dataset.set;
    const selectedAlbums = [...galleryDoc.querySelectorAll('#gallery .album')];
    check('year selection retains keyboard focus', galleryDoc.activeElement === yearChip);
    galleryDoc.querySelector('.skip').click();
    await settle();
    check('skip-to-content preserves selected gallery year',
      galleryDoc.querySelector('#galfilters [aria-pressed="true"]')?.dataset.set === selectedYear);
    check('skip-to-content preserves filtered albums',
      selectedAlbums.every(album => album.isConnected));

    // Exercise the real delegated viewer with deterministic aspect ratios,
    // independent of which photos happen to be in the production albums.
    const fixture = galleryDoc.createElement('section');
    fixture.className = 'album';
    const imageURL = (width, height) => 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="teal"/></svg>`);
    for (const [width, height] of [[1200, 700], [400, 800]]) {
      const shot = galleryDoc.createElement('button');
      shot.className = 'shot';
      shot.dataset.src = imageURL(width, height);
      shot.dataset.alt = `${width} by ${height}`;
      fixture.append(shot);
    }
    galleryDoc.querySelector('#gallery').append(fixture);
    const box = galleryDoc.querySelector('#lightbox');
    const image = box.querySelector('img');
    const nextPhoto = box.querySelector('.lightbox__nav--next');
    const waitForPhoto = async src => {
      const deadline = Date.now() + 3000;
      while (image.getAttribute('src') !== src) {
        if (Date.now() > deadline) throw new Error('Viewer did not display requested image');
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      await image.decode();
    };
    for (const width of [320, 768, 1361, 1920]) {
      frame.style.width = width + 'px';
      await settle();
      fixture.firstElementChild.click();
      await waitForPhoto(fixture.firstElementChild.dataset.src);
      const before = nextPhoto.getBoundingClientRect();
      nextPhoto.click();
      await waitForPhoto(fixture.lastElementChild.dataset.src);
      const after = nextPhoto.getBoundingClientRect();
      check(`lightbox: ${width}px navigation stays fixed across aspect ratios`,
        Math.abs(before.x - after.x) < 1 && Math.abs(before.y - after.y) < 1);
      const target = galleryDoc.elementFromPoint(before.x + before.width / 2, before.y + before.height / 2);
      check(`lightbox: ${width}px repeated pointer position still hits Next`,
        target?.closest('.lightbox__nav--next') === nextPhoto);
      target?.dispatchEvent(new frame.contentWindow.MouseEvent('click', { bubbles: true }));
      if (box.open) await waitForPhoto(fixture.firstElementChild.dataset.src);
      check(`lightbox: ${width}px repeated click wraps without closing`,
        box.open && image.alt === fixture.firstElementChild.dataset.alt);
      box.close();
      // close cleanup is queued by the browser; let it finish before reopening.
      await settle();
    }
    fixture.remove();
    await window.runStripChecks(frame, check);
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
