'use strict';

function createContentCache({ maxEntries = 64 } = {}) {
  const values = new Map();
  const inFlight = new Map();

  function prune() {
    const now = Date.now();

    for (const [key, entry] of values) {
      if (entry.expiresAt <= now) values.delete(key);
    }

    while (values.size > maxEntries) {
      const oldestKey = values.keys().next().value;
      if (oldestKey === undefined) break;
      values.delete(oldestKey);
    }
  }

  async function getOrLoad(key, ttlMs, loader) {
    const now = Date.now();
    const cached = values.get(key);

    if (cached && cached.expiresAt > now) {
      // Refresh insertion order so frequently used keys survive pruning.
      values.delete(key);
      values.set(key, cached);
      return cached.value;
    }

    if (cached) values.delete(key);

    const pending = inFlight.get(key);
    if (pending) return pending;

    const loadPromise = Promise.resolve()
      .then(loader)
      .then((value) => {
        values.set(key, {
          value,
          expiresAt: Date.now() + Math.max(1, Number(ttlMs) || 1),
        });
        prune();
        return value;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, loadPromise);
    return loadPromise;
  }

  function clearPrefix(prefix) {
    for (const key of values.keys()) {
      if (key.startsWith(prefix)) values.delete(key);
    }
  }

  function clearAll() {
    values.clear();
  }

  function size() {
    prune();
    return values.size;
  }

  return {
    getOrLoad,
    clearPrefix,
    clearAll,
    size,
  };
}

const contentCache = createContentCache();

module.exports = contentCache;
module.exports.createContentCache = createContentCache;
