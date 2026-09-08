/* Serve the repository root and open tests/browser-checks.html.
   Tests exercise the real page in an isolated, narrow same-origin frame. */
window.testResults = [];
window.testsDone = false;
(async () => {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'width:390px;height:844px;border:0';
  const loaded = new Promise(resolve => frame.onload = resolve);
  frame.src = '../index.html';
  document.body.append(frame);
  const check = (name, pass) => window.testResults.push({ name, pass: !!pass });
  const settle = () => new Promise(resolve => setTimeout(resolve, 300));
  try {
    await loaded;
    // A parent reload need not revalidate the iframe's stylesheet cache.
    const sheet = frame.contentDocument.querySelector('link[rel="stylesheet"]');
    const styled = new Promise(resolve => sheet.onload = resolve);
    sheet.href += '?test-run=' + Date.now();
    await styled;
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
  } catch (error) {
    window.testResults.push({ name: 'test harness', pass: false, error: String(error) });
  } finally {
    frame.remove();
    window.testsDone = true;
    document.querySelector('#results').textContent = JSON.stringify(window.testResults, null, 2);
  }
})();
