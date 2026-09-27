// app/config.js — התצורה, שמות הטבלאות והמחרוזות
import { MSG_OFF_USER_WRITE, MSG_SERVER_ERR, appConfigure, dayToday, getDeviceId,
         withTimeout } from '../core/util.js';
import { ctxEpoch, ctxStale, eraKeys, pendCount, pendHas, plTouch, pushDirty } from '../core/sync.js';
import { lsClearHorizons, lsRemove } from '../core/storage.js';
import { MIRROR, mirrorKey, mirrorTables, mirrorWrite } from '../core/mirror.js';
import { authUsersTable, isAdmin, sessActive, usersSaveOne } from '../core/auth.js';
import { toast } from '../core/ui.js';
import { S, state } from './state.js';
import { _gMarkPushed, applyMirrorToState, dirtyRows, gAcadYearOf, pendRowKey,
         rowPendingKey, rowTs, stripRows, syncNow, tableMeta } from './domain.js';
import { doLogout } from './screens/login.js';
import { DOM_ACTIONS, render, saveRefresh } from './main.js';

// התצורה נמסרת בשומרי קריאה — חלקה מוגדר בהמשך, והשומר קורא אותה בזמן הקריאה ולא בזמן המסירה.
appConfigure({
  get BK_CFG() { return BK_CFG; },
  get DATA_ERA() { return DATA_ERA; },
  get DEV_CFG() { return DEV_CFG; },
  get DOM_ACTIONS() { return DOM_ACTIONS; },
  get ERA_CFG() { return ERA_CFG; },
  get HW_CFG() { return HW_CFG; },
  get LK_CFG() { return LK_CFG; },
  get LS_CFG() { return LS_CFG; },
  get MIRROR_CFG() { return MIRROR_CFG; },
  get PEND_CFG() { return PEND_CFG; },
  get PL_CFG() { return PL_CFG; },
  get PUSH_CFG() { return PUSH_CFG; },
  get RTY_CFG() { return RTY_CFG; },
  get TOAST_DEFAULT_MS() { return TOAST_DEFAULT_MS; },
  get USER_CFG() { return USER_CFG; },
  get saveRefresh() { return saveRefresh; }
});


var SUPABASE_URL = self.APP.supabase.url;

var SUPABASE_ANON_KEY = self.APP.supabase.key;

// נקודת פתיחה למצב ריק בלבד — הרשימות עצמן בטבלת ההגדרות וניתנות לעריכה.
var DEFAULT_CONFIG = {
  categories: ['תרומה', 'גביה', 'מגביות', 'פרוייקטים', 'הוראות קבע', 'פרנסים ותאריכים'],
  causes: [],
  domains: ['כספים', 'שימור תורמים', 'תשתיות', 'יעד יזום']
};

var CONFIG_KEYS = [
  { key: 'categories', label: 'סעיפי תנועה', hint: 'מזין את שדה "סעיף" בטופס התנועה' },
  { key: 'causes', label: 'עילות התחייבות', hint: 'מזין את שדה "עילה" בטופס ההתחייבות' },
  { key: 'domains', label: 'תחומי משימות', hint: 'מזין את שדה "תחום" בטופס המשימה' }
];

// ── עוזרי רשת ──
// בלי תקרת זמן sb.from אינו מוגבל — ברשת חצי מחוברת ה-fetch לא מצליח ולא נכשל, והמשתמש ממתין לנצח.
var MSG_BAD_LOGIN = '❌ שם משתמש או סיסמה שגויים';

// משתמש מושבת מקבל הודעה משלו — עם «סיסמה שגויה» הוא מקליד שוב ושוב סיסמה נכונה.
var MSG_USER_INACTIVE = '❌ המשתמש מושבת. פנו לבעלים.';

// ── הודעות פר-אפליקציה ──
var MSG_MAYBE_STALE = ') — המוצג עלול להיות לא מעודכן';

var MSG_OWNER_ONLY = '⚠️ אין הרשאה — מסך ההגדרות פתוח לבעלים בלבד';

var MSG_NEED_DONOR_NAME = '⚠️ נא למלא שם תורם';

var MSG_DONOR_CREATED = 'התורם נוצר';

var MSG_EDIT_TXN = 'עריכת תנועה';

var MSG_NEW_TXN = '💰 תנועה חדשה';

var MSG_PICK_DONOR = '⚠️ נא לבחור תורם';

var MSG_AMOUNT_POSITIVE = '⚠️ נא להזין סכום גדול מאפס';

var MSG_EDIT_PLEDGE = 'עריכת התחייבות';

var MSG_NEW_PLEDGE = '🤝 התחייבות חדשה';

var MSG_EDIT_TASK = 'עריכת משימה';

var MSG_NEW_TASK = '📋 משימה חדשה';

var MSG_NEED_TITLE = '⚠️ נא למלא כותרת';

var MSG_EDIT_DONOR = 'עריכת תורם';

var MSG_NEW_DONOR = '🙋 תורם חדש';

var MSG_NEED_NAME = '⚠️ נא למלא שם';

var MSG_EDIT_USER = 'עריכת משתמש';

var MSG_NEW_USER = '👤 משתמש חדש';

var MSG_NEED_FULL_AND_USER = '⚠️ נא למלא שם מלא ושם משתמש';

var MSG_NEED_PASS = '⚠️ נא להזין סיסמה';

var MSG_SAVED_NO_FP = '⚠️ נשמר — אך ללא הכנה לכניסה ללא רשת';

var MSG_PASS_CHANGE_FOR = 'שינוי סיסמה — ';

var MSG_NO_OTHER_USER_LOCAL = '⚠️ אין משתמש אחר בעותק המקומי של המכשיר';

var MSG_SWITCH_USER = '👥 החלפת משתמש';

var MSG_MONTH_GOAL = '🎯 יעד חודשי';

var MSG_PICK_VALID_MONTH = '⚠️ נא לבחור חודש תקין';

var MSG_PICK_USER_AND_PASS = '⚠️ נא לבחור משתמש ולהזין סיסמה';

var MSG_WHAT_TO_ADD = 'מה מוסיפים?';

var MSG_NOTES_SAVED = 'ההערות נשמרו';

var MSG_DEL_DONOR_TITLE = 'מחיקת תורם';

var MSG_DEL_DONOR_LINKED = 'לתורם יש התחייבויות או תנועות. המחיקה היא רכה — הרשומות יישמרו במסד ולא יוצגו.';

var MSG_DEL_QUOTE_PRE = 'למחוק את "';

var MSG_DEL_QUOTE_POST = '"? המחיקה רכה וניתנת לשחזור במסד.';

var MSG_DELETE_ACT = 'מחיקה';

var MSG_DEL_TXN_TITLE = 'מחיקת תנועה';

var MSG_DEL_TXN_BODY = 'למחוק את התנועה? המחיקה רכה.';

var MSG_DEL_PLEDGE_TITLE = 'מחיקת התחייבות';

var MSG_DEL_PLEDGE_BODY = 'למחוק את ההתחייבות? המחיקה רכה.';

var MSG_DEL_TASK_TITLE = 'מחיקת משימה';

var MSG_DEL_TASK_BODY = 'למחוק את המשימה? המחיקה רכה.';

var MSG_NO_SELF_DISABLE = '⚠️ אי אפשר להשבית את המשתמש המחובר';

var MSG_UPDATED = 'עודכן';

var MSG_NEED_VALUE = '⚠️ נא להזין ערך';

var MSG_VALUE_EXISTS2 = '⚠️ הערך כבר קיים';

var MSG_EDIT_VALUE = 'עריכת ערך';

var MSG_REMOVE_VALUE_TITLE = 'הסרת ערך';

var MSG_REMOVE_QUOTE_PRE = 'להסיר את "';

var MSG_REMOVE_QUOTE_POST = '" מהרשימה? רשומות קיימות שמשתמשות בערך יישארו כמות שהן.';

var MSG_REMOVE_ACT = 'הסרה';

// ── עמידות אחסון מקומי ──
var KV_TABLE = 'g_settings';

// ── MIRROR_CFG ──
// tables היא פונקציה ולא מערך — TABLES מוצהר אחרי הבלוק, וקריאה בו כאן הייתה מקבלת undefined.
// טבלה שאינה נדחפת מוכרזת ב-noPush עם המסלול שדוחף אותה — רשומת אב או סוד.
var MIRROR_CFG = {
  prefix: self.APP.prefix + 'mirror_',
  app:    self.APP.prefix,
  tables: function () { return TABLES.map(function (m) { return m.t; }); },
  noPush: [{ t: 'g_users', via: 'writeUser', adds: 'secret' }],
  empty:  function () { return []; },
  ts:     function (r) { return rowTs(r); },
  clean:  function (t, rows) { return stripRows(t, rows); },
  fail:   function (where, e) { console.error('[mirror] ' + where, e); },
};

var LS_CFG = {
  // cachePrefix נגזר משם האפליקציה שבתצורה ולא מקידומת האחסון — שם אחסון שישתנה היה מחזיר רשימה ריקה, והבאנר היה חוזר בכל טעינה.
  cachePrefix: self.APP.id + '-',
  logKey: 'g_ls_log',
  hzPrefix: 'g_ls_hz_',
  // הסימן נושא את תחילית האפליקציה — ה-origin משותף, וסימן אחד היה נדרס בכל דחייה.
  dismissKey: 'g_sw_dismissed',
  // מפתח שאינו במרשם נמחק בעלייה.
  keys: function () {
    return [LS_CFG.logKey, LS_CFG.dismissKey, DEV_CFG.key, PEND_CFG.key,
            BK_CFG.flagKey, BK_CFG.logQueueKey]
      .concat(eraKeys(), mirrorTables().map(mirrorKey));
  },

  // חלון הפינוי נגזר מסוג האפליקציה — אין מספר ימים באף רשומה.
  appType: { type: 'annual', why: 'החישוב שלה נפרש על שנה — ⚠️ יעד החודש ו«מה שלי היום» נגזרים מהמשימות ומהתנועות של השנה' },

  // wholeKeys ריק — מראת המשתמשים היא מסלול הכניסה האופליין, ופינויה נועל את המכשיר בלי רשת.
  wholeKeys: [],

  // oldRecords ריק ומוצהר — כל טבלה שגדלה כאן נדרשת במלואה.
  // שדה חסר נקרא «לא נשאל», וריק נקרא «נמדד ואין».
  oldRecords: [],
  // «נגבה» להתחייבות הוא סכום כל תנועותיה, והתחייבות רב-שנתית חיה יותר מכל חלון — רשומה שפונתה היא סכום שגוי.
  // משימה פתוחה מוצגת ב«מה שלי היום» בכל גיל — משימה שפונתה נעלמת.
  fullHistory: [
    { t: 'g_txns',    calc: 'collectedForPledge' },
    { t: 'g_pledges', calc: 'collectedForPledge' },
    { t: 'g_tasks',   calc: 'viewHome' }
  ],

  // טבלת מראה שאינה בפינוי קבועה בגודלה — טבלה שגדלה ואינה בפינוי ממלאת את האחסון המשותף וחונקת את כל האפליקציות.
  fixedSize: [
    { t: 'g_donors',  why: 'תורמים — שורה לתורם, ⛔ ואינם גדלים עם התנועות' },
    { t: 'g_targets', why: 'יעדים — שורה לחודש, ⛔ שתים-עשרה בשנה' },
    { t: KV_TABLE,    why: 'הגדרות — שורה למפתח, ⛔ ומספר המפתחות קבוע בקוד' },
    { t: 'g_users',   why: 'משתמשים — שורה למשתמש, ⚠️ והיא מסלול הכניסה האופליין' }
  ],

  pending: function () { try { return pendCount() > 0; } catch (e) { return true; } },

  // 0 בכוונה — חותמת המשיכה המלאה אינה עד דחיפה, ופינוי שנשען עליה מוחק מהדיסק רשומה שמעולם לא עלתה.
  // כל מפתח ב-oldRecords מביא עד דחיפה משלו, _gPushedAt.
  syncedThrough: function () { return 0; }
};

// ── BK_CFG ──
// האפליקציה בפרויקט Supabase נפרד — ולכן sh_backup ו-sh_sync_log נוצרות בקובץ הסכימה שלה.
// g_users נגבית ב-cols מפורש ולא ב-* — sh_backup קריאה ל-anon, ו-select('*') היה מעתיק את הסוד למקום שני.
var BK_CFG = {
  client: function () { return S.sb; },
  flagKey: 'g_last_backup',
  logQueueKey: 'g_log_queue',
  prefix: '',
  device: function () { try { return getDeviceId(); } catch (e) { return null; } },
  user: function () { try { return (state.user && state.user.full_name) ? state.user.full_name : null; } catch (e) { return null; } },
  // secrets ריק — הסוד היחיד מוגן ב-cols שאינו שולף אותו, והמנגנון נשאר דרוך לסוד עתידי.
  secrets: [],
  sources: function () {
    return [
      { kind: 'table', name: 'g_donors',  order: 'client_id', ts: 'updated_at' },
      { kind: 'table', name: 'g_pledges', order: 'client_id', ts: 'updated_at' },
      { kind: 'table', name: 'g_txns',    order: 'client_id', ts: 'updated_at' },
      { kind: 'table', name: 'g_tasks',   order: 'client_id', ts: 'updated_at' },
      { kind: 'table', name: 'g_targets', order: 'client_id', ts: 'updated_at' },
      { kind: 'table', name: KV_TABLE,    order: 'key' },
      { kind: 'table', name: 'g_users',   order: 'client_id', ts: 'updated_at',
        cols: 'client_id,username,full_name,role,active,created_at,updated_at' }
    ];
  }
};

// ── PEND_CFG ──
// אין כאן תור ולכן אין extra — הסימונים הם מקור האמת היחיד.
var PEND_CFG = {
  app: 'gius', key: 'g_pending',
  // סימון שקידומתו אינה כאן יורד בעלייה — אין לו כותב ואין שורה שתידחף ותוריד אותו.
  marks: function () { return PUSH_TABLES.map(function (t) { return pendRowKey(t, ''); }); },
  // בתום ההחזקה, תגית ממתין שנותרה צריכה להיכנס לשורות שכבר רונדרו — render שומר על מיקום הגלילה.
  redraw: function () { try { render(); } catch (e) { } }
};

// ── RTY_CFG ──
// הריקון הוא syncNow ואין פונקציית דחיפה נפרדת — דחיפה בלי משיכה שקדמה לה מחזירה לחיים שורה שנמחקה במכשיר אחר.
var RTY_CFG = {
  flush:   function () { return syncNow(); },
  pending: function () { try { return pendCount() > 0; } catch (e) { return false; } },
};

// ── LK_CFG ──
// אין להוסיף כאן הודעה — חלון האזהרה של הליבה הוא ההודעה, ונוסח שני נבדל ממנו בשקט.
var LK_CFG = {
  active: function () { return sessActive(); },
  lock:   function () { doLogout(); },
};

// ── PL_CFG ──
// שורת החותמת מוחרגת מהמראה ב-stripRows — דחיפת-מצב שלה הייתה מחזירה לענן חותמת ישנה.
// ok() אינו נוגע ב-_lastPullOk — הוא עד המשיכה המלאה, ושיחה מוצלחת אחרת אינה עדות על מצב הענן.
var PL_CFG = {
  every:  3000,
  active: function () { return sessActive(); },
  seen:   function () { return S._gSeenTs; },
  note:   function (ts) { S._gSeenTs = ts; },
  ok:     function () { S._lastSeenOk = Date.now(); },
  pull:   function () { return syncNow(); },
  client: function () { return S.sb; },
  table:  function () { return KV_TABLE; },
};

// ── PUSH_CFG ──
// g_users אינה כאן ולא תידחף — המראה מסירה ממנה את הסיסמה, ודחיפה שלה הייתה כותבת סיסמאות ריקות; מסלולה writeUser.
// הסדר שומר על המפתח הזר — תורמים לפני התחייבויות ותנועות.
var PUSH_TABLES = ['g_donors', 'g_pledges', 'g_txns', 'g_tasks', 'g_targets', KV_TABLE];

var PUSH_CFG = {
  tables: PUSH_TABLES,
  chunk:  500,
  delay:  400,
  dirty:  function (t, ctx) { S._gPushEp = ctxEpoch(); return dirtyRows(t, (ctx && ctx[t]) || {}); },
  key:    function (t, row) { return rowPendingKey(t, row); },
  send:   function (t, rows) {
    var m = tableMeta(t);
    return withTimeout(S.sb.from(t).upsert(rows, { onConflict: m.conflict || m.key }));
  },
  mark:   function (t) { if (!ctxStale(S._gPushEp)) _gMarkPushed(t); },
  run:    function () { syncNow(); },
};

// החלון החם הוא תנועות שנת הפעילות הנוכחית — תורמים הם אבות המפתח הזר, והתחייבויות פתוחות לאורך שנים.
// תנועה בלי תאריך תקין נשארת חמה — בספק לא מפנים.
var HW_CFG = {
  enabled: true,
  admin: function () { return isAdmin(); },
  specs: [{
    key: mirrorKey('g_txns'),
    label: 'תנועות שנים סגורות',
    inWindow: function (t) {
      var y = gAcadYearOf(t && t.txn_date);
      if (!isFinite(y)) return true;
      return y >= gAcadYearOf(dayToday());
    },
    idOf: function (r) { return r && r.client_id; },
    ts: function (r) { return rowTs(r); },
    isPending: function (r) { return pendHas(rowPendingKey('g_txns', r)); },
    fetch: async function () {
      try {
        if (!S.sb) return { ok: false, rows: [] };
        var res = await withTimeout(S.sb.from('g_txns').select('*'));
        return (res && !res.error && Array.isArray(res.data))
          ? { ok: true, rows: res.data } : { ok: false, rows: [] };
      } catch (e) { return { ok: false, rows: [] }; }
    },
    rows: function () { return MIRROR.g_txns; },
    apply: function (kept) { return mirrorWrite('g_txns', kept); }
  }]
};

// ── ERA_CFG ──
// העידן עולה רק בשינוי צורת שורה — שורה ישנה שנדחפת נושאת מפתח שאין לו עמודה, נופלת ב-42703 וחוסמת את התור
var DATA_ERA = 2;

var ERA_CFG = {
  prefix: self.APP.prefix,
  client: function () { return S.sb; },
  table:  function () { return KV_TABLE; },
  // גם אופק הפינוי נמחק — אופק ששרד מסנן את מה שהמשיכה מחזירה, והמכשיר היה נשאר ריק.
  wipe:   function () {
    mirrorTables().forEach(function (t) { MIRROR[t] = MIRROR_CFG.empty(); lsRemove(mirrorKey(t)); });
    lsClearHorizons();
  },
  // הדחיפה היא ראיה טרייה ולא זיכרון — מכשיר נקי מקבל ok עם still ריק.
  push:   function () { return pushDirty(null); },
  refresh: function () { return syncNow(); }
};

// ── מזהה מכשיר ──
// מזהה מכשיר אינו מזהה רשומה — אינו עובר ב-newClientId, ודי בשמונה תווים קריאים ביומן.
// מזהה שכבר במכשיר אינו משתנה לעולם — החלפתו מנתקת רישומים קיימים ביומן ממקורם.
var DEV_CFG = { key: 'g_device_id' };

// אין מרווח פולינג משלו — המרווח היחיד הוא PL_CFG.every.

// strip — עמודות שאינן נשמרות במראה: password נשלפת, ו-pass_salt ו-pass_fp לעולם לא — הן מה שמאפשר כניסה בלי רשת.
var TABLES = [
  { t: 'g_donors',  key: 'client_id', soft: true,  order: 'name' },
  { t: 'g_pledges', key: 'client_id', soft: true,  order: 'due_date' },
  { t: 'g_txns',    key: 'client_id', soft: true,  order: 'txn_date', desc: true },
  { t: 'g_tasks',   key: 'client_id', soft: true,  order: 'due_date' },
  { t: 'g_targets', key: 'client_id', soft: true,  order: 'month', desc: true, conflict: 'month' },
  { t: 'g_users',   key: 'client_id', soft: false, order: 'created_at', strip: ['password'] },
  { t: KV_TABLE,    key: 'key', soft: false, conflict: 'key' }
];

// הכתיבה נכנסת למראה בלי pendMark — מה שכבר בענן אינו ממתין, וסימון עליו היה גובר במיזוג ומסתיר את השורה שבענן.
var USER_CFG = {
  ready: function () { return !!S.sb && navigator.onLine; },
  // ההודעה נקראת בזמן הקריאה ולא בזמן ההשמה — הקבוע מוצהר מתחת לבלוק, וקריאה בהשמה הייתה נותנת undefined.
  offMsg: function () { return MSG_OFF_USER_WRITE; },
  from: function () { return S.sb.from(authUsersTable()); },
  run: function (q) { return withTimeout(q); },
  refreshed: function () { applyMirrorToState(); },
  revalidated: function (u) {
    state.user = { client_id: u.client_id, username: u.username, full_name: u.full_name, role: u.role };
    applyMirrorToState();
  },
  logout: function (msg) { doLogout(); toast(msg, null, 'bad'); },
  after: function (res, body) {
    // הכשל נזרק ולא מוחזר — הקוראים עובדים ב-catch, וכשל שמוחזר בשקט היה עובר אצלם כהצלחה.
    if (!res || res.error) throw ((res && res.error) || new Error(MSG_SERVER_ERR));
    var saved = (Array.isArray(res.data) && res.data[0]) || body;
    usersSaveOne(saved);
    // העד נכתב אחרי כתיבה לענן שחזרה ok — משיכה אינה ראיה שהשורה שלנו עלתה.
    _gMarkPushed('g_users');
    applyMirrorToState();
    // g_users נמשכת בפולינג, ולכן גם כתיבה אליה מקדמת את החותמת — אחרת משתמש חדש לא יגיע למכשיר אחר עד שינוי נתונים אחר.
    plTouch();
    // ללא טביעה: הגזירה נכשלה ו-pass_fp נכתב ריק לצד סיסמה חדשה; השדה נכנס ל-body רק כשנמסרה סיסמה.
    return { noFp: Object.prototype.hasOwnProperty.call(body, 'pass_fp') && !body.pass_fp };
  }
};

// משך התצוגה של הטוסט הוא ערך פרטי ולא מנגנון.
var TOAST_DEFAULT_MS = 2600;

export { CONFIG_KEYS, DEFAULT_CONFIG, KV_TABLE, MSG_AMOUNT_POSITIVE, MSG_BAD_LOGIN,
         MSG_DELETE_ACT, MSG_DEL_DONOR_LINKED, MSG_DEL_DONOR_TITLE,
         MSG_DEL_PLEDGE_BODY, MSG_DEL_PLEDGE_TITLE, MSG_DEL_QUOTE_POST,
         MSG_DEL_QUOTE_PRE, MSG_DEL_TASK_BODY, MSG_DEL_TASK_TITLE, MSG_DEL_TXN_BODY,
         MSG_DEL_TXN_TITLE, MSG_DONOR_CREATED, MSG_EDIT_DONOR, MSG_EDIT_PLEDGE,
         MSG_EDIT_TASK, MSG_EDIT_TXN, MSG_EDIT_USER, MSG_EDIT_VALUE, MSG_MAYBE_STALE,
         MSG_MONTH_GOAL, MSG_NEED_DONOR_NAME, MSG_NEED_FULL_AND_USER, MSG_NEED_NAME,
         MSG_NEED_PASS, MSG_NEED_TITLE, MSG_NEED_VALUE, MSG_NEW_DONOR, MSG_NEW_PLEDGE,
         MSG_NEW_TASK, MSG_NEW_TXN, MSG_NEW_USER, MSG_NOTES_SAVED,
         MSG_NO_OTHER_USER_LOCAL, MSG_NO_SELF_DISABLE, MSG_OWNER_ONLY,
         MSG_PASS_CHANGE_FOR, MSG_PICK_DONOR, MSG_PICK_USER_AND_PASS,
         MSG_PICK_VALID_MONTH, MSG_REMOVE_ACT, MSG_REMOVE_QUOTE_POST,
         MSG_REMOVE_QUOTE_PRE, MSG_REMOVE_VALUE_TITLE, MSG_SAVED_NO_FP,
         MSG_SWITCH_USER, MSG_UPDATED, MSG_USER_INACTIVE, MSG_VALUE_EXISTS2,
         MSG_WHAT_TO_ADD, SUPABASE_ANON_KEY, SUPABASE_URL, TABLES };
