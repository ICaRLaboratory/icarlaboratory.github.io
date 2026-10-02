#!/usr/bin/env node
// Reuse the live Members renderer; keep data/site.js the profile source of truth.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const host = { innerHTML: '' };
const document = {
  documentElement: { lang: 'ko' },
  querySelector: (selector) => selector === '#advisor' ? host : null,
  querySelectorAll: () => [],
};
const context = vm.createContext({
  document,
  location: { search: '' },
  localStorage: { getItem: () => null },
  window: { addEventListener() {} },
  URLSearchParams,
});
vm.runInContext(read('data/site.js'), context, { filename: 'data/site.js' });
vm.runInContext(read('assets/site.js'), context, { filename: 'assets/site.js' });
vm.runInContext('renderMembers()', context);
// Reveal animation requires JavaScript; initial HTML must be visible without it.
const markup = host.innerHTML.replace(/ data-reveal/g, '').replace(/[ \t]+$/gm, '').trim();
if (!markup) throw new Error('Members renderer returned an empty advisor profile');
const start = '<!-- static-advisor:start (node scripts/build-static-advisor.mjs) -->';
const end = '<!-- static-advisor:end -->';
const path = new URL('members.html', root);
const source = readFileSync(path, 'utf8');
if (source.split(start).length !== 2 || source.split(end).length !== 2) {
  throw new Error('Static advisor markers missing or duplicated');
}
const before = source.slice(0, source.indexOf(start) + start.length);
const after = source.slice(source.indexOf(end));
const next = `${before}\n${markup}\n${after}`;
if (process.argv.includes('--check')) {
  if (next !== source) {
    console.error('Static advisor is stale. Run node scripts/build-static-advisor.mjs');
    process.exitCode = 1;
  } else console.log('Static advisor matches data/site.js and assets/site.js');
} else {
  writeFileSync(fileURLToPath(path), next);
  console.log('Generated Korean static advisor in members.html');
}
