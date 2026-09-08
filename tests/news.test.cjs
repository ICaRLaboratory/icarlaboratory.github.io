const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const context = vm.createContext({ URLSearchParams, location: { search: '' } });
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

test('currentNews includes today and day 13 but not future, day 14 or invalid dates', () => {
  const actual = vm.runInContext(`
    NEWS.splice(0, NEWS.length, ...['2026-09-10', '2026-08-26', '2026-08-27',
      '2026-09-09', '2026-08-40'].map(date => ({date, title: date})));
    JSON.stringify(currentNews(new Date(2026, 8, 9)).map(n => n.date));
  `, context);
  assert.deepEqual(JSON.parse(actual), ['2026-09-09', '2026-08-27']);
});
