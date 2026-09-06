#!/usr/bin/env node
/*  test_users_patch.mjs — נתיב עדכון חלקי למראת המשתמשים.
 *
 *  **מה נאכף:** שלוש אינווריאנטות — (1) ⛔ עדכון חלקי אינו מכניס את
 *  הסיסמה, לא למראה ולא לדיסק; (2) שאר המשתמשים במראה נשארים שלמים אחרי
 *  עדכון חלקי; (3) כניסה אופליין למשתמש שאינו האחרון שנכנס עדיין עובדת.
 *
 *  **הנימוק המדוד:** ⛔ מסנן שיושב בנתיב אחד בלבד ⛔ ונתיב שני שעוקף אותו —
 *  ⚠️ זו הנקודה שנשברה בשתי אפליקציות, בשני סבבים נפרדים.
 *
 *  **מה יישבר בלעדיו:** ⛔ סיסמה גלויה שנכתבת לאחסון המקומי, ⚠️ באותו
 *  origin שבו חיות עוד שלוש אפליקציות; ⛔ ועדכון שמחליף שורה במקום למזג
 *  שדות מוחק טביעה קיימת ⛔ ונועל משתמש בחוץ.
 *
 *  **מה אינו נאכף כאן:** ⛔ הכתיבה לענן — ⚠️ היא דורשת רשת ונבדקת בשער
 *  הסיסמאות, ⭐ וכאן נמדד **מה יורד לדיסק**.
 *
 *  ⚠️ הבדיקה רצה על הקוד האמיתי המחולץ מ-`index.html`, ⛔ לא על העתק.
 *  ⚠️ **פרטי לאפליקציה הזו** — ⛔ ואין ליישר אותו.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';


/*  ⛔ הקובץ הזה אינו אוכף שורה בטבלת התשתית (סבב 72) — ⚠️ הצהרה ריקה
 *  ולא היעדר: ⛔ שער בלי הצהרה אינו נבדל משער שההצהרה שלו נשמטה. */
export const ROWS = [];

/*  ⛔ המוטציות אינן ברירת המחדל (סבב 92) — ⚠️ כל מוטציה היא שינוי ⟵ הרצה
 *  ⟵ שחזור, ⭐ ושני שערים לבדם היו רוב זמן הסט: ⛔ הן רצות ברמה המלאה
 *  (`--full`), בסוף הסבב ולפני מיזוג, ⚠️ ולא בכל הרצה בזמן העבודה. */
const RUN_MUT = process.env.GATE_MUT === '1';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.error('  ❌ ' + name + (extra ? '  →  ' + extra : '')); }
};
const eq = (name, got, want) => ok(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const sect = (t) => console.log('\n▶ ' + t);

/* ── חילוץ מהקוד האמיתי ────────────────────────────────────────────────── */
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
function decl(name) {
  const m = new RegExp('^var ' + name + '\\s*=', 'm').exec(SRC);
  if (!m) throw new Error('לא נמצאה ההצהרה ' + name + ' ב-index.html');
  let depth = 0;
  for (let j = m.index; j < SRC.length; j++) {
    const c = SRC[j];
    if ('{(['.includes(c)) depth++;
    else if ('})]'.includes(c)) depth--;
    else if (c === ';' && depth === 0) return SRC.slice(m.index, j + 1);
  }
  throw new Error('הצהרה לא נסגרה: ' + name);
}
const body = (name) => fn(name);

const NAMES_VAR = ['G_PASS_ITER', 'G_PASS_CTX', 'TABLES', 'MIRROR_PREFIX',
  'MSG_OFF_UNKNOWN', 'MSG_OFF_NO_FP', 'MSG_OFF_NO_CRYPTO'];
const NAMES_FN = ['gRandSalt', 'gPassFp', 'gMakePassFp', 'gVerifyOffline',
  'mirrorUserByName', 'doLoginOffline', 'stripCols', 'stripRows', 'mirrorSave',
  'usersSanitize', 'usersCacheSave', 'usersCacheSaveAll',
  'tableMeta', 'findRow', 'rowTs'];

/* ── הרתמה ─────────────────────────────────────────────────────────────── */
function makeCtx(opts = {}) {
  const store = Object.create(null);
  const calls = { loginError: [], toast: [], boot: 0 };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    TextEncoder,
    crypto: opts.noCrypto ? undefined : webcrypto,
    MIRROR: {},
    state: { user: null },
    MSG_BAD_LOGIN: '❌ שם משתמש או סיסמה שגויים',
    lsSetArray(key, arr) { store[key] = JSON.stringify(arr); return true; },
    // ⭐ סבב 35: שער הדיסק של החלון החם עוטף את כתיבות המראה — כאן שקוף
    //    בכוונה; בדיקות החלון עצמו יושבות ב-test_hotwin.
    hwDiskFilter(k, rows) { return rows; },
    hwNoteCloud() {},
    lsSet(key, v) { store[key] = String(v); return true; },
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
  vm.runInContext(NAMES_VAR.map(decl).join('\n') + '\n' + NAMES_FN.map(fn).join('\n'), ctx);
  return { ctx, store, calls };
}

// ⛔ הסריקה שמגדירה את האינווריאנטה — הערך עצמו **וגם** שם העמודה, בכל
//    מפתח localStorage שהרתמה ראתה. חיפוש הערך לבדו היה מפספס עמודה
//    שנכתבה ריקה; חיפוש השם לבדו היה מפספס ערך שנכתב תחת שם אחר.
function diskHas(store, needle) {
  return Object.keys(store).some((k) => String(store[k]).includes(needle));
}

const PASS_A = '111111', PASS_B = '222222';

async function seed(h) {
  const a = await h.ctx.gMakePassFp(PASS_A);
  const b = await h.ctx.gMakePassFp(PASS_B);
  h.ctx.MIRROR.g_users = [
    { client_id: 'aaa', username: 'user_a', full_name: 'משתמש א', role: 'owner', active: true,
      pass_salt: a.salt, pass_fp: a.fp, updated_at: '2026-08-01T00:00:00.000Z' },
    { client_id: 'bbb', username: 'user_b', full_name: 'משתמש ב', role: 'manager', active: true,
      pass_salt: b.salt, pass_fp: b.fp, updated_at: '2026-08-01T00:00:00.000Z' },
  ];
  h.ctx.mirrorSave('g_users');
  return { a, b };
}

async function run() {
  /* ── א. הנתיב החלקי אינו מכניס סיסמה ─────────────────────────────────── */
  sect('א. ⛔ עדכון חלקי — `password` אינו נכנס');
  {
    const h = makeCtx();
    await seed(h);
    // בדיוק מה ש-`doLogin` מקבל מהענן: `select('*')`, כלומר עם הסיסמה.
    h.ctx.usersCacheSave({ client_id: 'bbb', username: 'user_b', full_name: 'משתמש ב',
      role: 'manager', active: true, password: 'סיסמה-גלויה-222222' });
    const row = h.ctx.MIRROR.g_users.filter((u) => u.client_id === 'bbb')[0];
    ok('העדכון נכנס למראה', !!row);
    ok('⛔ אין `password` ברשומה שבזיכרון', !('password' in row));
    ok('⛔ ערך הסיסמה אינו על הדיסק', !diskHas(h.store, 'סיסמה-גלויה-222222'));
    ok('⛔ שם העמודה `password` אינו על הדיסק', !diskHas(h.store, 'password'));
  }

  /* ── ב. שאר המשתמשים נשארים שלמים ────────────────────────────────────── */
  sect('ב. עדכון חלקי אינו נוגע בשאר המראה');
  {
    const h = makeCtx();
    const { a } = await seed(h);
    h.ctx.usersCacheSave({ client_id: 'bbb', username: 'user_b', full_name: 'שם חדש',
      role: 'manager', active: true, password: 'x' });
    const users = h.ctx.MIRROR.g_users;
    eq('עדיין שני משתמשים', users.length, 2);
    // ⚠️ `|| {}` בכוונה: מוטציה שמוחקת משתמש מהמראה חייבת להפיל **טענה**,
    //    לא לזרוק — אחרת הריצה נעצרת והפרקים שאחריה לא נבדקים בכלל.
    const A = users.filter((u) => u.client_id === 'aaa')[0] || {};
    const B = users.filter((u) => u.client_id === 'bbb')[0] || {};
    eq('משתמש א — המלח שלו לא נגע', A.pass_salt, a.salt);
    eq('משתמש א — הטביעה שלו לא נגעה', A.pass_fp, a.fp);
    eq('משתמש א — שמו לא נגע', A.full_name, 'משתמש א');
    eq('⭐ משתמש ב — השדה שהשתנה אכן התעדכן', B.full_name, 'שם חדש');
  }

  /* ── ג. מיזוג שדות, לא החלפת שורה ────────────────────────────────────── */
  sect('ג. עדכון חלקי ממזג ואינו מוחק שדות חסרים');
  {
    const h = makeCtx();
    const { b } = await seed(h);
    // תשובת שרת מלפני `0003_pass_fp.sql` — בלי עמודות הטביעה כלל.
    h.ctx.usersCacheSave({ client_id: 'bbb', username: 'user_b', full_name: 'משתמש ב',
      role: 'owner', active: true });
    const B = h.ctx.MIRROR.g_users.filter((u) => u.client_id === 'bbb')[0];
    eq('⭐ הטביעה שרדה עדכון שלא כלל אותה', B.pass_fp, b.fp);
    eq('והמלח שרד גם הוא', B.pass_salt, b.salt);
    eq('והשדה שכן נשלח התעדכן', B.role, 'owner');
  }

  /* ── ד. הנתיב המלא — אותו מסנן ───────────────────────────────────────── */
  sect('ד. ⛔ הנתיב המלא עובר דרך אותו מסנן');
  {
    const h = makeCtx();
    h.ctx.usersCacheSaveAll([
      { client_id: 'aaa', username: 'user_a', role: 'owner', active: true, password: 'סוד-א' },
      { client_id: 'bbb', username: 'user_b', role: 'manager', active: true, password: 'סוד-ב' },
    ]);
    eq('שני המשתמשים נשמרו', h.ctx.MIRROR.g_users.length, 2);
    ok('⛔ אין `password` באף רשומה בזיכרון',
      h.ctx.MIRROR.g_users.length > 0 &&
      h.ctx.MIRROR.g_users.every((u) => !('password' in u)));
    ok('⛔ אף ערך סיסמה אינו על הדיסק',
      !diskHas(h.store, 'סוד-א') && !diskHas(h.store, 'סוד-ב'));
    ok('⛔ שם העמודה אינו על הדיסק', !diskHas(h.store, 'password'));
  }
  {
    // ⭐ שתי הפונקציות חייבות להישען על אותו מסנן. הטענה הזו היא מה
    //   שנופל אם מישהו יכתוב לנתיב אחד סינון משלו.
    const h = makeCtx();
    ok('⭐ usersCacheSave קורא ל-usersSanitize', body('usersCacheSave').includes('usersSanitize'));
    ok('⭐ usersCacheSaveAll קורא ל-usersSanitize', body('usersCacheSaveAll').includes('usersSanitize'));
    ok('usersSanitize מסנן דרך stripCols', body('usersSanitize').includes("stripCols('g_users'"));
    ok('שני הנתיבים נשמרים דרך mirrorSave',
      body('usersCacheSave').includes("mirrorSave('g_users')") &&
      body('usersCacheSaveAll').includes("mirrorSave('g_users')"));
    // הנתיב החלקי מסרב לשורה בלי מזהה — אחרת היא הייתה נערמת ככפילות.
    ok('שורה בלי id נדחית', h.ctx.usersCacheSave({ username: 'x' }) === false);
    ok('קלט שאינו אובייקט נדחה', h.ctx.usersCacheSave(null) === false);
  }

  /* ── ה. כניסה אופליין למשתמש שאינו האחרון שנכנס ──────────────────────── */
  sect('ה. ⭐ כניסה אופליין למשתמש שאינו האחרון שנכנס');
  {
    const h = makeCtx();
    await seed(h);
    h.ctx.state.user = { client_id: 'aaa', username: 'user_a' };   // א' נכנס אחרון
    await h.ctx.doLoginOffline('user_b', PASS_B, null);
    eq('⭐ משתמש ב נכנס', (h.ctx.state.user || {}).username, 'user_b');
    eq('בלי שגיאת כניסה', h.calls.loginError.length, 0);
    eq('האפליקציה עלתה', h.calls.boot, 1);
    ok('הסשן אינו מחזיק סיסמה', !String(h.store['gius.session']).includes(PASS_B));
  }
  {
    // ⭐ ואחרי עדכון חלקי של משתמש **אחר** — הכניסה עדיין עובדת. זו
    //   הטענה שמחברת בין א', ב' ו-ה': נתיב חדש לא שבר את הישן.
    const h = makeCtx();
    await seed(h);
    h.ctx.usersCacheSave({ client_id: 'aaa', username: 'user_a', full_name: 'עודכן',
      role: 'owner', active: true, password: 'סוד-א' });
    await h.ctx.doLoginOffline('user_b', PASS_B, null);
    eq('⭐ ב נכנס גם אחרי עדכון חלקי של א', (h.ctx.state.user || {}).username, 'user_b');
    eq('בלי שגיאה', h.calls.loginError.length, 0);
  }
  {
    const h = makeCtx();
    await seed(h);
    await h.ctx.doLoginOffline('user_b', 'לא-נכון', null);
    eq('סיסמה שגויה נדחית', h.calls.loginError[0], h.ctx.MSG_BAD_LOGIN);
    eq('ולא נכנס', h.ctx.state.user, null);
  }
  {
    // משתמש שנכנס למראה דרך הנתיב החלקי **בלי** טביעה מקבל 'no-fp'
    // ולא «סיסמה שגויה» — ההבחנה של סבב 23, שהנתיב החדש חייב לשמר.
    const h = makeCtx();
    await seed(h);
    h.ctx.usersCacheSave({ client_id: 'ccc', username: 'user_c', role: 'manager',
      active: true, password: 'סוד-ג' });
    await h.ctx.doLoginOffline('user_c', 'סוד-ג', null);
    eq('משתמש בלי טביעה ⇒ MSG_OFF_NO_FP', h.calls.loginError[0], h.ctx.MSG_OFF_NO_FP);
    ok('⛔ ולא הודעת סיסמה שגויה', h.calls.loginError[0] !== h.ctx.MSG_BAD_LOGIN);
  }

  /* ── ו. אינווריאנטות במקור עצמו ──────────────────────────────────────── */
  sect('ו. אינווריאנטות במקור');
  {
    // ⭐ הסדר של סבב 23: הרענון קורה **אחרי** קביעת המשתמש הפעיל.
    const login = body('doLogin');
    const iUser = login.indexOf('state.user =');
    const iCache = login.indexOf('usersCacheSave(');
    ok('⭐ doLogin מרענן את המראה', iCache !== -1);
    ok('⭐ והרענון אחרי קביעת המשתמש הפעיל, לא לפניו', iUser !== -1 && iCache > iUser);

    /*  ⭐ סבב 53 — `revalidateSession` ירדה יחד עם שחזור הסשן: היא רצה
     *  רק ממנו, ואין עוד סשן משוחזר לאמת. ⛔ הטענה הפוכה מעכשיו. */
    ok('⛔ `revalidateSession` אינה בקוד (סבב 53)',
      !/function\s+revalidateSession\s*\(/.test(SRC));
    ok('⛔ ואין קבוע `SESSION_KEY`', !/SESSION_KEY/.test(SRC));

    // ⛔ אין נתיב שלישי — כל כתיבה למראת המשתמשים עוברת דרך המודול.
    /*  ⛔ הכתיבה למראה עברה לווו של האפליקציה — ⚠️ הבלוק החתום כותב לענן
     *  בלבד, ⭐ ומה שנעשה אחרי התשובה הוא פר-אפליקציה. */
    ok('⛔ USER_CFG כותב דרך usersCacheSave', decl('USER_CFG').includes('usersCacheSave('));
    ok('⛔ USER_CFG אינו קורא ל-upsertLocal', !decl('USER_CFG').includes("upsertLocal('g_users'"));
    ok('⛔ אין upsertLocal על g_users בשום מקום',
      SRC.split("upsertLocal('g_users'").length - 1 === 0);
    ok('syncPull שומר את המשתמשים דרך הנתיב המלא',
      body('syncPull').includes('usersCacheSaveAll('));

    ok('`strip: [password]` עדיין מוגדר על g_users',
      /\{[^}]*t:\s*'g_users'[^}]*strip:\s*\[\s*'password'\s*\][^}]*\}/.test(SRC));
    ok('⛔ pass_salt/pass_fp אינם ב-strip — הם חייבים לרדת למכשיר',
      !/\{[^}]*t:\s*'g_users'[^}]*strip:[^\]]*pass_(salt|fp)/.test(SRC));
    ok('⛔ g_users אינה ב-PUSH_TABLES', !/PUSH_TABLES\s*=\s*\[[^\]]*g_users/.test(SRC));

    ok('CACHE_NAME בתבנית gius-v<N>',
      /const CACHE_NAME = 'gius-v\d+';/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')));
  }

  /* ── מוטציות — ⛔ על עותק בזיכרון, ⛔ ולא על העץ (סבב 72) ──────────────── */
  /*  ⚠️ עד סבב 72 הקובץ הזה נמדד «יש בו מוטציה» מפני שהמילה הופיעה
   *  ב**באנר** — ⛔ ולא רצה כאן אף מוטציה. ⭐ שתי אלה מודדות את המסנן
   *  עצמו: הסרת `strip: ['password']` חייבת להפיל טענה, ⛔ ותוספת עמודה
   *  שאינה סוד חייבת **לעבור**. */
  /*  ⛔ מכאן ולמטה מוטציות (סבב 92) — ⚠️ הן רצות ברמה המלאה בלבד. */
  if (!RUN_MUT) {
    console.log('\n⏭ test_users_patch: המוטציות רצות ברמה המלאה (--full)');
    process.exit(fail ? 1 : 0);
  }
  sect('מוטציות');
  {
    const stripRe = /\{[^}]*t:\s*'g_users'[^}]*strip:\s*\[\s*'password'\s*\][^}]*\}/;
    /*  ⛔ ההחלפה מכוונת לאובייקט התצורה עצמו (סבב 72) — ⚠️ המחרוזת
     *  `strip: ['password']` מופיעה גם בשתי הערות, והחלפה גלובלית
     *  הייתה מודדת אותן ולא את הקוד. */
    const dropped = SRC.replace(stripRe, (m) => m.replace(/strip:\s*\[\s*'password'\s*\]/, 'strip: []'));
    ok('⛔ מוטציה: הסרת `password` מ-strip מפילה את טענת המסנן — expectFail: `strip: [password]` עדיין מוגדר על g_users',
       dropped !== SRC && !stripRe.test(dropped));

    const extra = SRC.replace("t: 'g_users'", "t: 'g_users', note: 'הערה שנוספה במוטציית-הנגד'");
    ok('⭐ מוטציית-נגד: שדה שאינו `strip` ⛔ אינו מפיל — נמדד המסנן, לא הצורה',
       extra !== SRC && stripRe.test(extra));
  }

  console.log('\n' + (fail ? '❌' : '✅') + `  ${pass} עברו, ${fail} נכשלו`);
  process.exit(fail ? 1 : 0);
}

run().catch((e) => { console.error('💥 ' + (e && e.stack || e)); process.exit(1); });
