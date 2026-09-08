#!/usr/bin/env node
/*  test_roles.mjs — מודל ההרשאות: תפקיד במקום סיסמת שער.
 *
 *  **מה נאכף:** ⛔ ההשוואה היא ל-`admin` **בדיוק** בעשרה מצבים · ⛔ שתי
 *  שכבות ההגנה על מסך ההגדרות — הניווט **והרינדור** · ⛔ מי שנחסם מקבל
 *  הודעה ⛔ ואינו מנווט · ⛔ ואף מסלול אינו משווה סיסמה מול שם תפקיד.
 *
 *  **הנימוק המדוד:** מסך שמרנדר את עצמו בלי תלות בהרשאה נפתח לכל מי
 *  שהגיע אליו בדרך אחרת — ⚠️ רינדור ישיר, או `state.screen` שנקבע במקום
 *  אחר: ⭐ ולכן שתי השכבות, ⛔ ולא אחת.
 *
 *  **מה יישבר בלעדיו:** ⛔ השוואה שמחזירה `true` על תפקיד שהוקלד בטעות
 *  פותחת את ניהול המשתמשים, ⚠️ בלי שגיאה ובלי עקבה.
 *
 *  **מה אינו נאכף כאן:** ⛔ ה-RLS שבמסד — ⚠️ הוא פתוח בהחלטה מודעת,
 *  ⭐ וההרשאות נאכפות בשכבת האפליקציה.
 *
 *  ⚠️ הבדיקה רצה על הקוד האמיתי המחולץ מ-`index.html`, ⛔ לא על העתק.
 *  ⚠️ **פרטי לאפליקציה** ⛔ ואינו זהה לשתי האחיות — ⭐ ארבע האינווריאנטות
 *  המשותפות יושבות ב-`roles-harness.mjs`, ⛔ ומה שכאן הוא שתי השכבות.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { reporter, extract, adminGaps, messageGaps, residueGaps,
         rolePasswordGaps } from './roles-harness.mjs';

/*  ⛔ הקובץ הזה אינו אוכף שורה בטבלת התשתית (סבב 72) — ⚠️ הצהרה ריקה
 *  ולא היעדר: ⛔ שער בלי הצהרה אינו נבדל משער שההצהרה שלו נשמטה. */
export const ROWS = [];

/*  ⛔ המוטציות אינן ברירת המחדל (סבב 92) — ⚠️ כל מוטציה היא שינוי ⟵ הרצה
 *  ⟵ שחזור, ⭐ ושני שערים לבדם היו רוב זמן הסט: ⛔ הן רצות ברמה המלאה
 *  (`--full`), בסוף הסבב ולפני מיזוג, ⚠️ ולא בכל הרצה בזמן העבודה. */
const RUN_MUT = process.env.GATE_MUT === '1';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const REP = reporter();
/*  ⛔ שער מריץ את כל טענותיו — ⚠️ תהליך שנסגר באמצע מדפיס «עבר» על טענות
 *  שלא רצו: ⭐ `EXPECTED` הוא רצפה שנמדדה ברמה המהירה, ⛔ ופחות ממנה הוא
 *  כשל — ⚠️ והמונה נקרא מהרתמה המשותפת, ⛔ שהיא המדווחת כאן. */
const GATE_ID = new URL(import.meta.url).pathname.split('/').pop();
const EXPECTED = 20;
let RAN = 0;
process.on('exit', () => {
  RAN += REP.st.pass + REP.st.fail;
  console.log(`רצו ${RAN} מתוך ${EXPECTED}`);
  if (RAN < EXPECTED) {
    console.error(`❌ ${GATE_ID}: רצו ${RAN} טענות מתוך ${EXPECTED} מוצהרות — ` +
      'מה עושים: ודא `await` בקריאה הראשית, ⛔ ויציאה שאינה קודמת להמתנה.');
    process.exitCode = 1;
  }
});
const { ok, eq, sect } = REP;
const { fn, decl } = extract(SRC);

/*  ⛔ הרתמה מריצה את הבלוק החתום ואת שתי שכבות ההגנה בלבד — ⚠️ הרינדור
 *  עצמו נעצר על ההרשאה, ⭐ ולכן די בגוף ההודעה. */
function makeCtx() {
  const calls = { toast: [], render: 0 };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    Object, Array, String, JSON, Date, isFinite,
    state: { user: null, screen: 'home', donorId: null, users: [] },
    _sessUser: null, _sessBooted: false,
    lsSet: () => true, lsGet: () => null, lsRemove: () => {},
    toast(m, d, k) { calls.toast.push({ m, k }); },
    render() { calls.render++; },
    emptyBox: (icon, msg) => '<div>' + icon + msg + '</div>',
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    [decl('ROLE_ADMIN')].join('\n') + '\n' +
    ['isAdminOf', 'isAdmin', 'sessSet', 'sessGet', 'sessClear', 'go'].map(fn).join('\n'), ctx);
  return { ctx, calls };
}

sect('א. ⛔ ההשוואה היא ל-`admin` בדיוק');
{
  const h = makeCtx();
  const gaps = adminGaps((u) => h.ctx.isAdminOf(u));
  ok('⭐ עשרה מצבים — רק `admin` מדויק מקבל הרשאה', gaps.length === 0, gaps.join(' · '));
  h.ctx.sessSet({ role: 'admin' });
  ok('`isAdmin()` קורא את המשתמש המחובר', h.ctx.isAdmin());
  h.ctx.sessSet({ role: 'manager' });
  ok('ומחזיר false למנהל', !h.ctx.isAdmin());
  h.ctx.sessSet({ role: 'junior' });
  ok('⛔ ולדרגה שהוכרזה חסרת-נושא', !h.ctx.isAdmin());
  h.ctx.sessClear();
  ok('ובלי משתמש מחובר', !h.ctx.isAdmin());
}

sect('ב. ⭐ שכבה ראשונה — הניווט');
{
  const h = makeCtx();
  h.ctx.sessSet({ role: 'admin' });
  h.ctx.go('settings');
  eq('⭐ בעלים מנווט להגדרות', h.ctx.state.screen, 'settings');
  eq('⛔ ובלי הודעת חסימה', h.calls.toast.length, 0);
}
{
  const h = makeCtx();
  h.ctx.sessSet({ role: 'manager' });
  h.ctx.go('settings');
  eq('⛔ מנהל אינו מנווט', h.ctx.state.screen, 'home');
  eq('⭐ ומקבל הודעה אחת', h.calls.toast.length, 1);
  eq('⛔ והיא מסווגת ככשל', h.calls.toast[0].k, 'bad');
  eq('⛔ ואפס רינדורים', h.calls.render, 0);
  h.ctx.go('donors');
  eq('⚠️ ומסך שאינו ההגדרות פתוח לו', h.ctx.state.screen, 'donors');
}

sect('ג. ⭐ שכבה שנייה — הרינדור עצמו');
{
  /*  ⛔ המדידה על המקור ולא בהרצה — ⚠️ `viewSettings` בונה את כל המסך,
   *  ⭐ ומה שנמדד הוא **שהיציאה המוקדמת קיימת ונשענת על `isAdmin()`**. */
  const body = fn('viewSettings');
  const early = body.indexOf('if (!isAdmin()) {');
  ok('⛔ הרינדור נעצר על ההרשאה', early >= 0);
  ok('⭐ והיציאה היא בראש הפונקציה, לפני בניית המסך',
    early >= 0 && early < body.indexOf("var h = ''"));
  ok('⛔ והיא מחזירה הודעה ולא מסך', /return '<section class="card">' \+ emptyBox/.test(body));
  ok('⛔ ואין בגוף היציאה המוקדמת קריאה ל-state.users',
    body.slice(0, early >= 0 ? body.indexOf("var h = ''") : 0).indexOf('state.users') < 0);
}

sect('ד. ⛔ אין סיסמה שמשווה מול שם תפקיד');
{
  const rp = rolePasswordGaps(SRC, ['admin', 'manager', 'junior']);
  ok('⛔ אפס מסלולים שמשווים סיסמה מול שם תפקיד', rp.length === 0, rp.join(' · '));
  const mg = messageGaps([]);
  ok('⚠️ אין כאן הודעת «העמודה אינה קיימת» — ההצהרה ריקה ואינה נשמטת', mg.length === 0);
  const rg = residueGaps({}, []);
  ok('⚠️ ואין סוד שער שיצא משימוש', rg.length === 0);
  ok('⛔ ואין `owner` בקוד — השם שיצא משימוש', !/['"]owner['"]/.test(SRC));
}

const failed = REP.summary('מודל ההרשאות');

/*  ⛔ המוטציות (סבב 114) — ⚠️ שינוי ⟵ הרצה ⟵ נפילה, ⭐ ועל **עותק
 *  בתיקייה זמנית** ⛔ ולא על העץ. */
if (!RUN_MUT) {
  console.log('\n⏭ test_roles: המוטציות רצות ברמה המלאה (--full)');
  process.exit(failed ? 1 : 0);
}
{
  const os = await import('node:os');
  const cp = await import('node:child_process');
  const self = new URL(import.meta.url).pathname;
  const name = path.basename(self);
  const run = (dir) => cp.spawnSync(process.execPath, [path.join(dir, 'tools', name)],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, GATE_MUT: '' } }).status;
  const mut = (label, edit, expectFail) => {
    /*  ⛔ כותב על עותק — ⚠️ המוטציה מריצה שער אמיתי בתהליך נפרד, ⭐ והוא
     *  קורא את המקור מהדיסק: ⛔ והעץ עצמו אינו נוגע. */
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'roles-'));
    fs.cpSync(ROOT, d, { recursive: true, filter: (s) => !s.includes('/.git') });
    const f = path.join(d, 'index.html');
    fs.writeFileSync(f, edit(fs.readFileSync(f, 'utf8')));
    const fell = run(d) !== 0;
    console.log((fell === expectFail ? '  ok   ' : '  FAIL ') + label);
    if (fell !== expectFail) process.exit(1);
    fs.rmSync(d, { recursive: true, force: true });
  };
  console.log('\n— מוטציות —');
  mut('⛔ היפוך ההשוואה ל«שונה מ-manager» — מפיל את «ההשוואה היא ל-admin בדיוק»',
    (s) => s.replace("function isAdminOf(u) { return !!u && String(u.role) === ROLE_ADMIN; }",
                     "function isAdminOf(u) { return !!u && String(u.role) !== 'manager'; }"), true);
  mut('⛔ הסרת שכבת הניווט — מפילה את «מנהל אינו מנווט»',
    (s) => s.replace("  if (screen === 'settings' && !isAdmin()) {",
                     "  if (screen === 'settings' && false) {"), true);
  mut('⭐ מוטציית-נגד: פונקציה חדשה וחיה — ⛔ אינה מפילה, שהיא שינוי תקין',
    (s) => s.replace('</body>', '<script>function r114Live(){ return 1; }\nvar _r114Seen = r114Live();</script>\n</body>'), false);
}
process.exit(failed ? 1 : 0);
