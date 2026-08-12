#!/usr/bin/env node
/*  בדיקת סבב 23 — כניסה אופליין מרובת-משתמשים.
 *
 *  ⚠️ **הבדיקה רצה על הקוד האמיתי המחולץ מ-`index.html`**, לא על העתק.
 *  הפונקציות נחתכות מהקובץ לפי שם (התאמת סוגריים), מורצות ב-`vm` מעל
 *  רתמה מינימלית, ונבדקות מולה. כך מוטציה בקוד האמיתי מפילה כאן טענה —
 *  וזה כל הרעיון.
 *
 *  ארבע הטענות שהסבב נדרש להן, ולצידן הגנות שנגזרות מהן:
 *    1. כניסה אופליין למשתמש שאינו האחרון שנכנס במכשיר.
 *    2. סיסמה שגויה נדחית.
 *    3. `password` אינו מופיע באף מפתח localStorage — בשום נתיב כתיבה.
 *    4. משתמש בלי טביעה מקבל את ההודעה הנכונה, ולא «סיסמה שגויה».
 *
 *  הרצה:  node scripts/test_round23.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.error('  ❌ ' + name + (extra ? '  →  ' + extra : '')); }
};
const eq = (name, got, want) => ok(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

/* ── חילוץ מהקוד האמיתי ────────────────────────────────────────────────── */
// חיתוך פונקציה לפי שם, בהתאמת סוגריים מסולסלים. נכשל ברעש אם השם נעלם —
// שינוי שם בקוד לא יעבור כאן בשקט כ"אפס בדיקות".
function fn(name) {
  const at = SRC.indexOf('\nfunction ' + name + '(');
  if (at < 0) throw new Error('לא נמצאה הפונקציה ' + name + ' ב-index.html');
  let i = SRC.indexOf('{', at), depth = 0, j = i;
  for (; j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}') { depth--; if (!depth) break; }
  }
  return SRC.slice(at + 1, j + 1);
}
// חיתוך הצהרת `var NAME = …;` בשורה אחת או רב-שורתית עד `;\n` ברמה 0.
function decl(name) {
  const re = new RegExp('^var ' + name + '\\s*=', 'm');
  const m = re.exec(SRC);
  if (!m) throw new Error('לא נמצאה ההצהרה ' + name + ' ב-index.html');
  let i = m.index, depth = 0;
  for (let j = i; j < SRC.length; j++) {
    const c = SRC[j];
    if ('{(['.includes(c)) depth++;
    else if ('})]'.includes(c)) depth--;
    else if (c === ';' && depth === 0) return SRC.slice(i, j + 1);
  }
  throw new Error('הצהרה לא נסגרה: ' + name);
}

const NAMES_FN = [
  'gRandSalt', 'gPassFp', 'gMakePassFp', 'gIsMissingFpCol', 'gVerifyOffline',
  'mirrorUserByName', 'doLoginOffline', 'passFields',
  'stripCols', 'stripRows', 'mirrorSave', 'upsertLocal', 'tableMeta', 'findRow', 'rowTs'
];
const NAMES_VAR = [
  'G_PASS_ITER', 'G_PASS_CTX', 'TABLES', 'MIRROR_PREFIX',
  'MSG_OFF_UNKNOWN', 'MSG_OFF_NO_FP', 'MSG_OFF_NO_CRYPTO', 'MSG_OFF_USER_WRITE'
];

/* ── הרתמה ─────────────────────────────────────────────────────────────── */
function makeCtx(opts = {}) {
  const store = Object.create(null);
  const calls = { loginError: [], toast: [], boot: 0, lsSet: [] };
  const ctx = {
    console,
    TextEncoder,
    crypto: opts.noCrypto ? undefined : webcrypto,
    MIRROR: {},
    state: { user: null },
    SESSION_KEY: 'gius.session',
    MSG_BAD_LOGIN: '❌ שם משתמש או סיסמה שגויים',
    // חוזה `lsSetArray`/`lsSet` כפי שהמודול המשותף מקיים אותו: מחרוזת
    // JSON תחת מפתח. הבדיקה «אין password בדיסק» סורקת את `store` הזה.
    lsSetArray(key, arr) { store[key] = JSON.stringify(arr); return true; },
    lsSet(key, v) { calls.lsSet.push(key); store[key] = String(v); return true; },
    loginError(m) { calls.loginError.push(m); },
    busy() {},
    boot() { calls.boot++; },
    toast(m) { calls.toast.push(m); },
    applyMirrorToState() {},
    nowISO: () => new Date(0).toISOString(),
    Promise, Object, Array, String, JSON, Date, Uint8Array, isFinite,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const code = NAMES_VAR.map(decl).join('\n') + '\n' + NAMES_FN.map(fn).join('\n');
  vm.runInContext(code, ctx);
  return { ctx, store, calls };
}

const USER_A = { id: 'aaa', username: 'mmf', full_name: 'מענדי פרידמן', role: 'owner', active: true };
const USER_B = { id: 'bbb', username: 'yossi', full_name: 'יוסי', role: 'manager', active: true };

async function seedUsers(h, list) {
  h.ctx.MIRROR.g_users = [];
  for (const u of list) {
    const row = Object.assign({}, u);
    if (u._pass) {
      const made = await h.ctx.gMakePassFp(u._pass);
      row.pass_salt = made.salt; row.pass_fp = made.fp;
    }
    delete row._pass;
    h.ctx.MIRROR.g_users.push(row);
  }
  h.ctx.mirrorSave('g_users');
}

/* ══════════════════════════════════════════════════════════════════════ */
console.log('\n▶ א. גזירת הטביעה — PBKDF2-SHA256, 100k, מלח פר-משתמש');
{
  const h = makeCtx();
  eq('100,000 סיבובים', h.ctx.G_PASS_ITER, 100000);
  ok('הפרדת הקשר בקידומת המלח', /^gius\//.test(h.ctx.G_PASS_CTX), h.ctx.G_PASS_CTX);

  const s1 = h.ctx.gRandSalt(), s2 = h.ctx.gRandSalt();
  ok('מלח באורך 32 hex', /^[0-9a-f]{32}$/.test(s1), s1);
  ok('מלח אקראי — שתי קריאות שונות', s1 !== s2);

  const fpA = await h.ctx.gPassFp('123456', s1);
  const fpA2 = await h.ctx.gPassFp('123456', s1);
  const fpB = await h.ctx.gPassFp('123456', s2);
  const fpC = await h.ctx.gPassFp('654321', s1);
  ok('טביעה באורך 64 hex', /^[0-9a-f]{64}$/.test(fpA), fpA);
  eq('דטרמיניסטית — אותה סיסמה ואותו מלח', fpA2, fpA);
  ok('מלח שונה ⇒ טביעה שונה (אין טבלה משותפת לכל המשתמשים)', fpA !== fpB);
  ok('סיסמה שונה ⇒ טביעה שונה', fpA !== fpC);
  ok('בלי מלח — null (נכשל סגור)', (await h.ctx.gPassFp('123456', null)) === null);

  const made = await h.ctx.gMakePassFp('123456');
  ok('gMakePassFp מחזירה {salt,fp}', !!(made && made.salt && made.fp));
  eq('הטביעה תואמת למלח שהוחזר', made.fp, await h.ctx.gPassFp('123456', made.salt));
}
{
  const h = makeCtx({ noCrypto: true });
  ok('בלי crypto — gRandSalt מחזירה null', h.ctx.gRandSalt() === null);
  ok('בלי crypto — gMakePassFp מחזירה null', (await h.ctx.gMakePassFp('123456')) === null);
}

console.log('\n▶ ב. כישלון גזירה **מאפס** את שני השדות (סעיף 5 בבקשת הסבב)');
{
  const h = makeCtx({ noCrypto: true });
  const pf = await h.ctx.passFields('999999');
  eq('הסיסמה עדיין נשלחת לענן', pf.password, '999999');
  eq('pass_salt מאופס ל-null ולא מושמט', pf.pass_salt, null);
  eq('pass_fp מאופס ל-null ולא מושמט', pf.pass_fp, null);
  ok('שני המפתחות קיימים באובייקט — כלומר ייכתבו ויידרסו בענן',
    Object.prototype.hasOwnProperty.call(pf, 'pass_salt') &&
    Object.prototype.hasOwnProperty.call(pf, 'pass_fp'));
}
{
  const h = makeCtx();
  const pf = await h.ctx.passFields('123456');
  ok('עם crypto — טביעה אמיתית נגזרת', /^[0-9a-f]{64}$/.test(pf.pass_fp));
}

console.log('\n▶ ג. ⭐ כניסה אופליין למשתמש שאינו האחרון שנכנס במכשיר');
{
  const h = makeCtx();
  await seedUsers(h, [
    Object.assign({ _pass: '770770' }, USER_A),
    Object.assign({ _pass: '654321' }, USER_B)
  ]);
  // הסשן שעל המכשיר הוא של A — B מעולם לא נכנס כאן.
  h.store['gius.session'] = JSON.stringify(USER_A);
  await h.ctx.doLoginOffline('yossi', '654321', null);
  eq('אין הודעת שגיאה', h.calls.loginError.length, 0);
  eq('המשתמש המחובר הוא B', h.ctx.state.user && h.ctx.state.user.id, 'bbb');
  eq('התפקיד נלקח מהמראה', h.ctx.state.user && h.ctx.state.user.role, 'manager');
  eq('boot() נקראה פעם אחת', h.calls.boot, 1);
  eq('הסשן נכתב מחדש ל-B', JSON.parse(h.store['gius.session']).id, 'bbb');
  ok('נאמר למשתמש שזו כניסה אופליין', h.calls.toast.some(t => /אופליין/.test(t)), JSON.stringify(h.calls.toast));

  // וגם A עצמו ממשיך לעבוד — הכניסה אינה "אחד בלבד" בכיוון ההפוך.
  const h2 = makeCtx();
  await seedUsers(h2, [Object.assign({ _pass: '770770' }, USER_A), Object.assign({ _pass: '654321' }, USER_B)]);
  await h2.ctx.doLoginOffline('mmf', '770770', null);
  eq('גם A נכנס אופליין', h2.ctx.state.user && h2.ctx.state.user.id, 'aaa');
}

console.log('\n▶ ד. סיסמה שגויה נדחית');
{
  const h = makeCtx();
  await seedUsers(h, [Object.assign({ _pass: '654321' }, USER_B)]);
  await h.ctx.doLoginOffline('yossi', '654320', null);
  eq('הודעה אחת', h.calls.loginError.length, 1);
  eq('והיא «שם משתמש או סיסמה שגויים»', h.calls.loginError[0], h.ctx.MSG_BAD_LOGIN);
  eq('לא נכנס', h.ctx.state.user, null);
  eq('boot() לא נקראה', h.calls.boot, 0);
  ok('הסשן לא נכתב', h.store['gius.session'] === undefined);
}
{
  const h = makeCtx();
  await seedUsers(h, [Object.assign({ _pass: '654321', active: false }, USER_B, { active: false })]);
  await h.ctx.doLoginOffline('yossi', '654321', null);
  eq('משתמש מושבת — נדחה גם עם הסיסמה הנכונה', h.calls.loginError[0], h.ctx.MSG_BAD_LOGIN);
  eq('ולא נכנס', h.ctx.state.user, null);
}

console.log('\n▶ ה. משתמש בלי טביעה — ההודעה הנכונה, לא «סיסמה שגויה»');
{
  const h = makeCtx();
  await seedUsers(h, [USER_B]);                       // ללא _pass ⇒ אין טביעה
  await h.ctx.doLoginOffline('yossi', '654321', null);
  eq('הודעת «טרם הוכן לכניסה ללא רשת»', h.calls.loginError[0], h.ctx.MSG_OFF_NO_FP);
  ok('ההודעה דורשת חיבור אחד במפורש', /חיבור לאינטרנט פעם אחת/.test(h.ctx.MSG_OFF_NO_FP));
  ok('⛔ אינה «סיסמה שגויה»', h.calls.loginError[0] !== h.ctx.MSG_BAD_LOGIN);
  eq('לא נכנס', h.ctx.state.user, null);
}
{
  const h = makeCtx();
  await seedUsers(h, [Object.assign({ _pass: '654321' }, USER_B)]);
  await h.ctx.doLoginOffline('nobody', '654321', null);
  eq('משתמש שאינו במראה — הודעה נפרדת משלו', h.calls.loginError[0], h.ctx.MSG_OFF_UNKNOWN);
  ok('⛔ אינה «סיסמה שגויה»', h.calls.loginError[0] !== h.ctx.MSG_BAD_LOGIN);
}
{
  // דפדפן בלי crypto.subtle: יש טביעה במראה, אבל אין במה לגזור להשוואה.
  const seed = makeCtx();
  const made = await seed.ctx.gMakePassFp('654321');
  const h = makeCtx({ noCrypto: true });
  h.ctx.MIRROR.g_users = [Object.assign({}, USER_B, { pass_salt: made.salt, pass_fp: made.fp })];
  await h.ctx.doLoginOffline('yossi', '654321', null);
  eq('בלי crypto — הודעת «אין תמיכה בהצפנה»', h.calls.loginError[0], h.ctx.MSG_OFF_NO_CRYPTO);
  ok('⛔ אינה «סיסמה שגויה»', h.calls.loginError[0] !== h.ctx.MSG_BAD_LOGIN);
  eq('לא נכנס', h.ctx.state.user, null);
}
{
  const h = makeCtx();
  const four = [h.ctx.MSG_OFF_UNKNOWN, h.ctx.MSG_OFF_NO_FP, h.ctx.MSG_OFF_NO_CRYPTO, h.ctx.MSG_BAD_LOGIN];
  eq('ארבע ההודעות נבדלות זו מזו', new Set(four).size, 4);
}

console.log('\n▶ ו. ⛔ `password` אינו מגיע לאף מפתח localStorage');
{
  const SECRET = '424242';
  const h = makeCtx();

  // 1) כתיבה מקומית של משתמש עם סיסמה — הנתיב שהדליף עד סבב 23.
  h.ctx.upsertLocal('g_users', {
    id: 'ccc', username: 'nir', full_name: 'ניר', role: 'manager', active: true,
    password: SECRET, pass_salt: 'ff00', pass_fp: 'ab12', updated_at: new Date(0).toISOString()
  });
  // 2) שורות שהגיעו מהענן — הנתיב של `syncPull`.
  const remote = h.ctx.stripRows('g_users', [
    { id: 'ddd', username: 'dov', password: SECRET, pass_salt: 'aa', pass_fp: 'bb' }
  ]);
  h.ctx.MIRROR.g_users = h.ctx.MIRROR.g_users.concat(remote);
  h.ctx.mirrorSave('g_users');

  const dump = Object.keys(h.store).map(k => k + '=' + h.store[k]).join('\n');
  ok('אף מפתח אינו מכיל את הסיסמה', dump.indexOf(SECRET) === -1);
  ok('אף מפתח אינו מכיל את השדה "password"', dump.indexOf('"password"') === -1);
  ok('הטביעה **כן** נשמרה (אחרת אין כניסה אופליין)', dump.indexOf('"pass_fp"') !== -1);
  ok('והמלח נשמר איתה', dump.indexOf('"pass_salt"') !== -1);
  ok('הסינון קודם לזיכרון ולא רק לדיסק',
    !Object.prototype.hasOwnProperty.call(h.ctx.MIRROR.g_users[0], 'password'));
  eq('שאר השדות שרדו', h.ctx.MIRROR.g_users[0].username, 'nir');

  // 3) טבלה ללא `strip` אינה נפגעת — הסינון ממוקד ולא גורף.
  h.ctx.upsertLocal('g_donors', { id: 'd1', name: 'תורם', notes: SECRET });
  eq('טבלה בלי strip נשמרת כמות שהיא', h.ctx.MIRROR.g_donors[0].notes, SECRET);
}
{
  // ⭐ **שכבת הדיסק נבדקת בנפרד.** `upsertLocal` כבר מסנן, ולכן בלעדיה
  //    הבדיקה שלמעלה עוברת גם אם `mirrorSave` יפסיק לסנן — והשכבה השנייה
  //    הייתה נשחקת בלי שאיש ישים לב. כאן הסוד מוזרק ל-MIRROR **ישירות**,
  //    כמו שנתיב עתידי שיעקוף את `upsertLocal` היה עושה.
  const SECRET = '313131';
  const h = makeCtx();
  h.ctx.MIRROR.g_users = [{ id: 'eee', username: 'zvi', password: SECRET, pass_fp: 'cc' }];
  h.ctx.mirrorSave('g_users');
  ok('mirrorSave מסנן גם רשומה שנכנסה ל-MIRROR בעקיפה',
    h.store['g_mirror_g_users'].indexOf(SECRET) === -1, h.store['g_mirror_g_users']);
  ok('והטביעה שרדה גם שם', h.store['g_mirror_g_users'].indexOf('pass_fp') !== -1);
}
{
  // מלח פר-משתמש, לא קבוע: שני משתמשים עם **אותה סיסמה** חייבים לקבל
  // טביעות שונות. מלח קבוע היה מאפשר טבלה מחושבת אחת לכל הצוות.
  const h = makeCtx();
  await seedUsers(h, [
    Object.assign({ _pass: '123456' }, USER_A),
    Object.assign({ _pass: '123456' }, USER_B)
  ]);
  const [a, b] = h.ctx.MIRROR.g_users;
  ok('שני מלחים שונים לשתי רשומות', a.pass_salt !== b.pass_salt);
  ok('⭐ אותה סיסמה ⇒ טביעות שונות (מלח פר-משתמש)', a.pass_fp !== b.pass_fp);
}
{
  const h = makeCtx();
  const meta = h.ctx.tableMeta('g_users');
  ok('`strip: [password]` עדיין מוגדר על g_users',
    Array.isArray(meta.strip) && meta.strip.indexOf('password') !== -1);
  ok('⛔ pass_salt/pass_fp **אינם** ב-strip — הם חייבים לרדת למכשיר',
    meta.strip.indexOf('pass_salt') === -1 && meta.strip.indexOf('pass_fp') === -1);
}

console.log('\n▶ ז. נפילה-חזרה לחלון שלפני המיגרציה');
{
  const h = makeCtx();
  ok('מזוהה: "column pass_fp does not exist"',
    h.ctx.gIsMissingFpCol({ message: 'column g_users.pass_fp does not exist' }));
  ok('מזוהה גם על pass_salt', h.ctx.gIsMissingFpCol({ details: 'PASS_SALT missing' }));
  ok('שגיאה אחרת אינה מזוהה בטעות', !h.ctx.gIsMissingFpCol({ message: 'network timeout' }));
  ok('שגיאה ריקה אינה מזוהה', !h.ctx.gIsMissingFpCol(null));
}

console.log('\n▶ ח. אינווריאנטות במקור עצמו');
{
  ok('`g_users` אינה ב-PUSH_TABLES', /var PUSH_TABLES = \[(?![^\]]*g_users)/.test(SRC));
  // שורות הערה מנוטרלות — הפרק שמסביר את הבאג מצטט את הקריאה שהוסרה.
  const CODE = SRC.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  ok('כתיבת משתמש עוברת דרך writeUser ולא דרך insert/update המקומיים',
    !/\b(insert|update)\('g_users'/.test(CODE));
  ok('הכניסה המקוונת לא קיבלה בדיקת פורמט סיסמה (סבב 19)',
    !/PASS_SIX_RE[\s\S]{0,400}?sb\.from\('g_users'\)\.select/.test(SRC));
  // ⚠️ `username`/`password`/`full_name` הם `not null` (0001), ו-Postgres בודק
  // NOT NULL לפני ש-ON CONFLICT נכנס לפעולה. `upsert` עם אובייקט חלקי (שינוי
  // סיסמה, השבתה) היה נופל במקום לעדכן — ולכן העריכה חייבת להיות `update`.
  const WU = /function writeUser\([\s\S]*?\n}/.exec(SRC)[0];
  ok('⭐ writeUser: יצירה ב-upsert, עריכה ב-update (NOT NULL)',
    /id == null\)\s*\n?\s*\?\s*sb\.from\('g_users'\)\.upsert/.test(WU) &&
    /:\s*sb\.from\('g_users'\)\.update\(obj\)\.eq\('id', id\)/.test(WU));
  const WU_CODE = WU.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  ok('writeUser אינו מסמן ⏳ — מה שכבר בענן אינו ממתין', !/markLocal|pendMark/.test(WU_CODE));
  ok('writeUser נכשל ברעש בלי רשת', /!navigator\.onLine\) return Promise\.reject/.test(WU));
  ok('gBackfillPassFp מותנית ב-owner', /_gFpBackfillDone[\s\S]{0,400}?role !== 'owner'/.test(SRC));
  ok('gBackfillPassFp מותנית ברשת', /_gFpBackfillDone[\s\S]{0,400}?navigator\.onLine/.test(SRC));
  ok('CACHE_NAME קודם ל-gius-v11',
    /const CACHE_NAME = 'gius-v11';/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')));
  ok('המיגרציה אדיטיבית ואידמפוטנטית',
    /add column if not exists pass_salt text;[\s\S]*add column if not exists pass_fp\s+text;/
      .test(fs.readFileSync(path.join(ROOT, 'migrations/0003_pass_fp.sql'), 'utf8')));
  ok('⛔ המיגרציה אינה נוגעת ב-password',
    !/\b(alter|drop|update)\b[^\n]*\bpassword\b/i.test(
      fs.readFileSync(path.join(ROOT, 'migrations/0003_pass_fp.sql'), 'utf8')
        .split('\n').filter(l => !l.trim().startsWith('--')).join('\n')));
}

console.log(`\n${fail ? '❌' : '✅'}  ${pass} עברו, ${fail} נכשלו\n`);
process.exit(fail ? 1 : 0);
