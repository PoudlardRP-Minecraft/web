// This small, dependency-free controller always lets visitors skip the entrance,
// even if WebGL, the main bundle, or a texture fails to load.
(() => {
  const dialog = document.querySelector('#wall-intro');
  const replay = document.querySelector('#replay-entrance');
  const start = document.querySelector('#open-passage');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let watchdog;
  let returnFocus;
  let alreadySeen = false;
  try { alreadySeen = sessionStorage.getItem('arcanum-entrance-v1') === 'seen'; } catch { /* Storage is optional. */ }

  function close(reason = 'skip') {
    clearTimeout(watchdog);
    if (!dialog.open) return;
    dialog.close();
    document.body.classList.remove('entrance-open');
    dialog.classList.remove('is-ready', 'is-opening');
    try { sessionStorage.setItem('arcanum-entrance-v1', 'seen'); } catch { /* No persistent storage required. */ }
    window.dispatchEvent(new CustomEvent('arcanum:entrance-close', { detail: { reason } }));
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }

  function open(isReplay = false) {
    if (reduced.matches || dialog.open || typeof dialog.showModal !== 'function') return;
    returnFocus = isReplay ? replay : null;
    start.disabled = true;
    document.body.classList.add('entrance-open');
    try { dialog.showModal(); } catch { document.body.classList.remove('entrance-open'); return; }
    watchdog = setTimeout(() => close('timeout'), 7500);
    window.dispatchEvent(new CustomEvent('arcanum:entrance-request'));
  }

  document.querySelector('#skip-entrance').addEventListener('click', () => close());
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  start.addEventListener('click', () => window.dispatchEvent(new CustomEvent('arcanum:entrance-start')));
  replay.addEventListener('click', () => open(true));
  window.addEventListener('arcanum:entrance-ready', () => {
    if (!dialog.open) return;
    dialog.classList.add('is-ready');
    start.disabled = false;
    clearTimeout(watchdog);
    watchdog = setTimeout(() => close('timeout'), 6500);
  });
  window.addEventListener('arcanum:entrance-opening', () => dialog.classList.add('is-opening'));
  window.addEventListener('arcanum:entrance-finish', () => close('finished'));
  window.addEventListener('arcanum:entrance-unavailable', () => close('unavailable'));
  reduced.addEventListener('change', event => { if (event.matches) close('reduced-motion'); });
  if (!alreadySeen && !location.hash && scrollY < 40) open();
})();
