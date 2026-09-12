/* Shared with the browser harness; exercises real gallery rendering and events. */
window.runStripChecks = async (frame, check) => {
  const width = frame.style.width;
  frame.style.width = '390px';
  await new Promise((resolve, reject) => {
    frame.onload = resolve;
    frame.onerror = reject;
    frame.src = new URL('../gallery.html?strip-checks=' + Date.now(), location.href).href;
  });
  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async predicate => {
    const deadline = Date.now() + 2500;
    while (!predicate() && Date.now() < deadline) await pause(25);
  };
  try {
    const host = doc.querySelector('#gallery');
    host.innerHTML = win.albumCard({
      title: 'Strip "focus" & motion fixture', date: 'September 2026',
      photos: Array.from({ length: 6 }, (_, i) => ({
        src: 'assets/favicon.png', alt: 'Strip fixture photo ' + (i + 1)
      }))
    }, 0);
    win.wireStrips(host);
    const grid = host.querySelector('.album__grid');
    const prev = host.querySelector('.album__page--prev');
    const next = host.querySelector('.album__page--next');
    await until(() => grid.scrollWidth > grid.clientWidth && !next.hidden);
    check('strip fixture overflows', grid.scrollWidth > grid.clientWidth);
    for (const button of [prev, next]) {
      check(button.classList.contains('album__page--next')
        ? 'Next arrow accessible name includes its album'
        : 'Previous arrow accessible name includes its album',
      button.getAttribute('aria-label').includes('Strip "focus" & motion fixture'));
    }
    const endpoint = async (button, left, name) => {
      grid.scrollTo({ left, behavior: 'instant' });
      await until(() => !button.hidden);
      button.focus();
      check(name + ' arrow can receive keyboard focus', doc.activeElement === button);
      button.click();
      await until(() => button.hidden);
      check(name + ' arrow hides at endpoint', button.hidden);
      check(name + ' endpoint preserves focus on the album scroller', doc.activeElement === grid);
    };
    await endpoint(next, grid.scrollWidth - grid.clientWidth - 100, 'Next');
    await endpoint(prev, 100, 'Previous');
    // A same-origin iframe cannot emulate OS media settings itself. Override
    // only this query; scrolling and layout still run in the real browser.
    const matchMedia = win.matchMedia;
    win.matchMedia = query => query === '(prefers-reduced-motion: reduce)'
      ? { matches: true } : matchMedia.call(win, query);
    try {
      await pause(100);
      next.click();
      check('reduced-motion next scroll moves immediately', grid.scrollLeft > 0);
      await until(() => !prev.hidden);
      await pause(500);
      const before = grid.scrollLeft;
      prev.click();
      check('reduced-motion previous scroll moves immediately', grid.scrollLeft < before);
    } finally {
      win.matchMedia = matchMedia;
    }
  } finally {
    frame.style.width = width;
    frame.onload = null;
    frame.onerror = null;
  }
};
