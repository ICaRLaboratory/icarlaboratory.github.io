const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const context = vm.createContext({ URLSearchParams, location: { search: '' }, window: new EventTarget() });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../data/news.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/site.js'), 'utf8'), context);

// Load the real renderer, not a copied date parser.
test('newsDay rejects impossible dates and malformed input', () => {
  for (const date of ['2026-02-31', '2026-02-29', '2026-13-01', '2026-00-01',
    '2026-01-00', '2026-04-31', '2026-1-01', '', null, undefined]) {
    assert.equal(context.newsDay(date), null, String(date));
  }
});

test('newsDay preserves valid calendar dates including leap days', () => {
  for (const [value, year, month, day] of [
    ['2026-09-09', 2026, 9, 9], ['2024-02-29', 2024, 2, 29],
    [' 2026-12-31 ', 2026, 12, 31],
  ]) {
    const parsed = context.newsDay(value);
    assert.ok(parsed);
    assert.deepEqual([parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate()],
      [year, month, day]);
  }
});

const shown = (dates, now = new Date(2026, 8, 9)) => JSON.parse(vm.runInContext(`
  NEWS.splice(0, NEWS.length, ...${JSON.stringify(dates)}.map(date => ({date, title: date})));
  JSON.stringify(currentNews(new Date(${now.getFullYear()}, ${now.getMonth()}, ${now.getDate()}))
    .map(n => n.date));
`, context));

test('a current item carries older ones onto the page, newest first', () => {
  // 09-09 is today, 08-27 is day 13, 08-26 is day 14: expired on its own,
  // but it rides along under a current item.
  assert.deepEqual(shown(['2026-08-26', '2026-09-09', '2026-08-27']),
    ['2026-09-09', '2026-08-27', '2026-08-26']);
});

test('future and invalid dates stay off the page', () => {
  assert.deepEqual(shown(['2026-09-10', '2026-08-40', '2026-09-09']), ['2026-09-09']);
});

test('the band shows at most NEWS_MAX_ITEMS', () => {
  assert.equal(vm.runInContext('NEWS_MAX_ITEMS', context), 3);
  assert.deepEqual(shown(['2026-09-09', '2026-09-08', '2026-09-07', '2026-09-06']),
    ['2026-09-09', '2026-09-08', '2026-09-07']);
});

test('nothing current takes the whole band down, old items and all', () => {
  assert.deepEqual(shown(['2026-08-26', '2026-06-01']), []);
  assert.deepEqual(shown(['2026-09-10']), []);      // queued, not yet due
  assert.deepEqual(shown([]), []);
});
