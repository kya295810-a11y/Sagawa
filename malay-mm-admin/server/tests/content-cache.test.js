'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createContentCache } = require('../content-cache');

test('content cache reuses a value until the TTL expires', async () => {
  const cache = createContentCache();
  let loads = 0;

  const loader = async () => {
    loads += 1;
    return { loads };
  };

  const first = await cache.getOrLoad('news:list', 1000, loader);
  const second = await cache.getOrLoad('news:list', 1000, loader);

  assert.deepEqual(first, { loads: 1 });
  assert.deepEqual(second, { loads: 1 });
  assert.equal(loads, 1);
});

test('content cache collapses concurrent misses into one loader call', async () => {
  const cache = createContentCache();
  let loads = 0;

  const loader = async () => {
    loads += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return 'ready';
  };

  const values = await Promise.all([
    cache.getOrLoad('exchange:public', 1000, loader),
    cache.getOrLoad('exchange:public', 1000, loader),
    cache.getOrLoad('exchange:public', 1000, loader),
  ]);

  assert.deepEqual(values, ['ready', 'ready', 'ready']);
  assert.equal(loads, 1);
});

test('clearPrefix invalidates only matching content keys', async () => {
  const cache = createContentCache();

  await cache.getOrLoad('news:list', 1000, async () => 'news');
  await cache.getOrLoad('services:list', 1000, async () => 'services');

  cache.clearPrefix('news:');

  let newsLoads = 0;
  const news = await cache.getOrLoad('news:list', 1000, async () => {
    newsLoads += 1;
    return 'fresh-news';
  });
  const services = await cache.getOrLoad('services:list', 1000, async () => 'fresh-services');

  assert.equal(news, 'fresh-news');
  assert.equal(newsLoads, 1);
  assert.equal(services, 'services');
});
