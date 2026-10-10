import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createProductSearchIndex, searchProductIndex } from '../src/utils/productSearch.js';

const fixtures = [
  { id: '1', name: 'Le Gemme Orom', brand: 'Bvlgari', tags: 'woody oud', category: 'Унисекс', variants: [{ label: '5 мл' }] },
  { id: '2', name: 'Moonstone Mist', brand: 'Volarè', tags: 'white musk', category: 'Женские', variants: [{ label: '100 ml' }] },
  { id: '3', name: 'BEDEVI YARA', brand: 'Bedevi', tags: 'extrait', category: 'Женские', variants: [{ label: '50 ML' }] },
  { id: '4', name: 'Miss Dior Blooming Bouquet', brand: 'Dior', tags: 'floral', category: 'Женские', variants: [{ label: '10 мл' }] },
];

const index = createProductSearchIndex(fixtures);
const firstName = query => searchProductIndex(index, query)[0]?.name;

assert.equal(firstName('orom bvlgari'), 'Le Gemme Orom');
assert.equal(firstName('bvlgri orom'), 'Le Gemme Orom');
assert.equal(firstName('воларе moonstone'), 'Moonstone Mist');
assert.equal(firstName('volare mist'), 'Moonstone Mist');
assert.equal(firstName('бедеви яра'), 'BEDEVI YARA');
assert.equal(firstName('dior bouquet'), 'Miss Dior Blooming Bouquet');
assert.equal(firstName('50 ml'), 'BEDEVI YARA');
assert.deepEqual(searchProductIndex(index, 'missing scent'), []);

const synthetic = Array.from({ length: 800 }, (_, i) => ({
  ...fixtures[i % fixtures.length],
  id: `product-${i}`,
  name: `${fixtures[i % fixtures.length].name} ${i}`,
}));
const syntheticIndex = createProductSearchIndex(synthetic);
const started = performance.now();
for (let i = 0; i < 100; i += 1) searchProductIndex(syntheticIndex, 'bvlgri orom');
const elapsed = performance.now() - started;

console.log(`admin product search: ${synthetic.length} products × 100 queries = ${elapsed.toFixed(1)}ms`);
console.log('product search tests passed');
