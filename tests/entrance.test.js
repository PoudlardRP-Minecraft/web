import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../dist/entrance.js', import.meta.url), 'utf8');

function boot({ reduced = false, seen = false, hash = '', storageFails = false } = {}) {
  const timers = new Map();
  let timerId = 0;
  const classes = new Set();
  const classList = { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)) };
  class Element extends EventTarget {
    open = false; disabled = false; isConnected = true; focused = false;
    classList = classList;
    showModal() { this.open = true; }
    close() { this.open = false; }
    focus() { this.focused = true; }
  }
  const ids = ['wall-intro', 'replay-entrance', 'open-passage', 'skip-entrance'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  const media = new EventTarget(); media.matches = reduced;
  const window = new EventTarget();
  const marks = [];
  vm.runInNewContext(source, {
    window, document: { querySelector: id => elements[id.slice(1)], body: { classList } },
    matchMedia: () => media, location: { hash }, scrollY: 0,
    sessionStorage: {
      getItem: () => { if (storageFails) throw new Error('blocked'); return seen ? 'seen' : null; },
      setItem: (key, value) => { if (storageFails) throw new Error('blocked'); marks.push([key, value]); },
    },
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout: id => timers.delete(id), CustomEvent,
  });
  return { elements, window, media, timers, classes, marks };
}

test('skip works even when the Three.js bundle never loads', () => {
  const b = boot({ storageFails: true });
  assert(b.elements['wall-intro'].open);
  b.elements['skip-entrance'].dispatchEvent(new Event('click'));
  assert(!b.elements['wall-intro'].open);
  assert(!b.classes.has('entrance-open'));
  assert.equal(b.timers.size, 0);
});

test('Escape and a loading timeout both unlock the document', () => {
  for (const action of ['escape', 'timeout']) {
    const b = boot();
    if (action === 'escape') b.elements['wall-intro'].dispatchEvent(new Event('cancel', { cancelable: true }));
    else [...b.timers.values()][0].fn();
    assert(!b.elements['wall-intro'].open);
    assert(!b.classes.has('entrance-open'));
  }
});

test('return visits, anchor links and reduced motion skip automatic entrance', () => {
  for (const options of [{ reduced: true }, { seen: true }, { hash: '#magie' }]) {
    const b = boot(options);
    assert(!b.elements['wall-intro'].open);
    assert.equal(b.timers.size, 0);
  }
});

test('replay restores focus and completion cancels the watchdog', () => {
  const b = boot({ seen: true });
  b.elements['replay-entrance'].dispatchEvent(new Event('click'));
  assert(b.elements['wall-intro'].open);
  b.window.dispatchEvent(new Event('arcanum:entrance-ready'));
  assert(!b.elements['open-passage'].disabled);
  assert.equal([...b.timers.values()][0].ms, 6500);
  b.window.dispatchEvent(new Event('arcanum:entrance-finish'));
  assert(!b.elements['wall-intro'].open);
  assert(b.elements['replay-entrance'].focused);
  assert.equal(b.timers.size, 0);
});

test('motion preference changes and WebGL failures immediately release the page', () => {
  for (const action of ['preference', 'failure']) {
    const b = boot();
    if (action === 'preference') { const event = new Event('change'); event.matches = true; b.media.dispatchEvent(event); }
    else b.window.dispatchEvent(new Event('arcanum:entrance-unavailable'));
    assert(!b.elements['wall-intro'].open);
    assert(!b.classes.has('entrance-open'));
  }
});
