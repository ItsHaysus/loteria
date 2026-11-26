import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../service-worker.js', import.meta.url), 'utf8');

test('a new service-worker version gets a fresh cache and removes prior app caches', async () => {
  const listeners = new Map();
  const openedCaches = [];
  const deletedCaches = [];
  let claimed = false;
  const cache = { addAll: async () => {} };
  const self = {
    location: { href: 'https://example.test/service-worker.js?v=1.5.3' },
    addEventListener: (name, listener) => listeners.set(name, listener),
    skipWaiting: async () => {},
    clients: { claim: async () => { claimed = true; } },
  };
  const caches = {
    open: async name => {
      openedCaches.push(name);
      return cache;
    },
    keys: async () => ['card-dealer-v32', 'card-dealer-1.5.2', 'card-dealer-1.5.3', 'unrelated-cache'],
    delete: async name => {
      deletedCaches.push(name);
      return true;
    },
  };

  runInNewContext(source, { self, caches, URL });

  let installPromise;
  listeners.get('install')({ waitUntil: promise => { installPromise = promise; } });
  await installPromise;

  let activatePromise;
  listeners.get('activate')({ waitUntil: promise => { activatePromise = promise; } });
  await activatePromise;

  assert.deepEqual(openedCaches, ['card-dealer-1.5.3']);
  assert.deepEqual(deletedCaches, ['card-dealer-v32', 'card-dealer-1.5.2']);
  assert.equal(claimed, true);
});
