// Mandatory pre-push gate.
//
// index.html carries the whole application inline, so a syntax error there is
// invisible to any normal lint step and ships a blank white page. This script
// pulls every inline <script> block out of index.html, writes them to a temp
// file, and runs `node --check` on that plus sw.js.
//
//   node scripts/check-js.mjs
//
// Exits non-zero on the first failure.

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(join(tmpdir(), 'gius-check-'));
let failed = 0;

function check(label, file) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log('  ok   ' + label);
  } catch (err) {
    failed++;
    console.error('  FAIL ' + label);
    console.error(String(err.stderr || err.stdout || err.message).trim());
  }
}

// ---- inline scripts from index.html ---------------------------------------
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
let m, n = 0;
while ((m = re.exec(html)) !== null) {
  if (/\bsrc\s*=/i.test(m[1])) continue;             // external, nothing to parse
  n++;
  const out = join(work, `index-inline-${n}.js`);
  writeFileSync(out, m[2]);
  check(`index.html inline script #${n}`, out);
}
if (n === 0) {
  failed++;
  console.error('  FAIL no inline script found in index.html — did the markup change?');
}

// ---- standalone files ------------------------------------------------------
check('sw.js', join(ROOT, 'sw.js'));

// ---- cheap sanity checks that a parser cannot catch ------------------------
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const rules = [
  [/CACHE_NAME\s*=\s*'gius-v1'/.test(sw), "sw.js: CACHE_NAME must be 'gius-v1'"],
  [/supabase\.co/.test(sw), 'sw.js: must skip supabase.co requests'],
  [/mode:\s*'cors'/.test(sw), "sw.js: CDN fetches must use mode:'cors'"],
  [/text\/html;\s*charset=utf-8/.test(sw), 'sw.js: offline page needs an explicit Content-Type'],
  [/startsWith\(CACHE_PREFIX\)/.test(sw), "sw.js: activate must sweep only the 'gius-' prefix"],
  [/supabase-js@2\.111\.0/.test(html), 'index.html: supabase-js must be pinned to 2.111.0'],
  [!/supabase-js@2\/(?!1)/.test(html), 'index.html: no floating @2 CDN version allowed'],
];
for (const [pass, msg] of rules) {
  if (pass) continue;
  failed++;
  console.error('  FAIL ' + msg);
}

if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nall checks passed');
