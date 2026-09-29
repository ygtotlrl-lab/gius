// app/main.js — העלייה, הקליפה, מפת הפעולות והניווט
import { MSG_OFF_NO_CRYPTO, MSG_OFF_NO_FP, MSG_OFF_UNKNOWN, MSG_OFF_USER_WRITE,
         MSG_PASS_SIX, MSG_SERVER_ERR, MSG_SWITCHED_TO, appConfigure, dayToday,
         getDeviceId, uniqHas, withTimeout } from '../core/util.js';
import { afterSave, ctxEpoch, ctxStale, ctxSwitch, eraKeys, eraKick, errToast, idEq,
         pendAlertDismiss, pendBoot, pendCount, pendHas, pendRender, plBoot, plTouch,
         pushDirty, rtyBoot, runSave, sbWatch, tombBoot } from '../core/sync.js';
import { hwBoot, lsBoot, lsClearHorizons, lsRemove } from '../core/storage.js';
import { MIRROR, mirrorBoot, mirrorKey, mirrorTables,
         mirrorWrite } from '../core/mirror.js';
import { bkBoot, logAwait } from '../core/backup.js';
import { authLog, authPassFields, authUsersTable, authVerify, isAdmin, lkBoot, lkReset,
         sessActive, sessGet, sessSet, usersGet, usersSaveOne,
         writeUser } from '../core/auth.js';
import { actRun, ask, closeAsk, closeModal, comboFocus, comboInput, comboKey, comboMake,
         comboOutside, comboPick, esc, ksKey, modalBackdrop, modalEsc, openModal,
         shellBare, swApply, swHideUpdate, toast } from '../core/ui.js';
import { KV_TABLE, MSG_BAD_LOGIN, MSG_DELETE_ACT, MSG_DEL_DONOR_LINKED,
         MSG_DEL_DONOR_TITLE, MSG_DEL_PLEDGE_BODY, MSG_DEL_PLEDGE_TITLE,
         MSG_DEL_QUOTE_POST, MSG_DEL_QUOTE_PRE, MSG_DEL_TASK_BODY, MSG_DEL_TASK_TITLE,
         MSG_DEL_TXN_BODY, MSG_DEL_TXN_TITLE, MSG_EDIT_VALUE, MSG_NEED_PASS,
         MSG_NEED_VALUE, MSG_NOTES_SAVED, MSG_NO_SELF_DISABLE, MSG_OWNER_ONLY,
         MSG_PICK_USER_AND_PASS, MSG_REMOVE_ACT, MSG_REMOVE_QUOTE_POST,
         MSG_REMOVE_QUOTE_PRE, MSG_REMOVE_VALUE_TITLE, MSG_UPDATED, MSG_VALUE_EXISTS2,
         MSG_WHAT_TO_ADD, PASS_SIX_RE, PUSH_TABLES, SUPABASE_ANON_KEY, SUPABASE_URL,
         TABLES } from './constants.js';
import { KDRAG, S, shell, state } from './state.js';
import { $, _gMarkPushed, applyMirrorToState, donorById, donorMatches,
         donorNewCancel, donorNewSave, gAcadYearOf, mirrorHasData, monthKeyOf, pendRowKey,
         pledgeById, pledgesOfDonor, rowPendingKey, rowTs,
         saveConfigList, shiftMonth, softDelete, stripRows, syncNow, tableMeta,
         txnsOfDonor, update, val, viewBare, warnIfNoFp } from './domain.js';
import { donorRowsHTML, formDonor, formTxn, saveDonor, saveTxn, viewDonorCard,
         viewDonors } from './screens/donors.js';
import { viewHome } from './screens/home.js';
import { doLogin, doLogout, formMyPassword, formSaveMyPassword, formSwitchUser, markSVG,
         renderLogin } from './screens/login.js';
import { formPledge, refreshPledges, savePledge,
         viewPledges } from './screens/pledges.js';
import { formPassword, formTarget, formUser, saveTarget, saveUser,
         viewSettings } from './screens/settings.js';
import { formTask, kdragCol, moveTask, saveTask, viewTasks } from './screens/tasks.js';

// ── החיווט ──
// החיווט נמסר בשומרי קריאה — ה-CFG מוגדרים בהמשך, והשומר קורא אותם בזמן הקריאה ולא בזמן המסירה.
appConfigure({
  get BK_CFG() { return BK_CFG; },
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
  get USER_CFG() { return USER_CFG; },
  get saveRefresh() { return saveRefresh; }
});

// tables היא פונקציה ולא מערך — TABLES מוצהר אחרי הבלוק, וקריאה בו כאן הייתה מקבלת undefined.
// טבלה שאינה נדחפת מוכרזת ב-noPush עם המסלול שדוחף אותה — רשומת אב או סוד.
var MIRROR_CFG = {
  prefix: self.APP.prefix + 'mirror_',
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

// אין כאן תור ולכן אין extra — הסימונים הם מקור האמת היחיד.
var PEND_CFG = {
  key: 'g_pending',
  // סימון שקידומתו אינה כאן יורד בעלייה — אין לו כותב ואין שורה שתידחף ותוריד אותו.
  marks: function () { return PUSH_TABLES.map(function (t) { return pendRowKey(t, ''); }); },
  // בתום ההחזקה, תגית ממתין שנותרה צריכה להיכנס לשורות שכבר רונדרו — render שומר על מיקום הגלילה.
  redraw: function () { try { render(); } catch (e) { } }
};

// הריקון הוא syncNow ואין פונקציית דחיפה נפרדת — דחיפה בלי משיכה שקדמה לה מחזירה לחיים שורה שנמחקה במכשיר אחר.
var RTY_CFG = {
  flush:   function () { return syncNow(); },
  pending: function () { try { return pendCount() > 0; } catch (e) { return false; } },
};

// אין להוסיף כאן הודעה — חלון האזהרה של הליבה הוא ההודעה, ונוסח שני נבדל ממנו בשקט.
var LK_CFG = {
  active: function () { return sessActive(); },
  lock:   function () { doLogout(); },
};

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

var PUSH_CFG = {
  tables: PUSH_TABLES,
  chunk:  500,
  delay:  400,
  rows:   function (t) { S._gPushEp = ctxEpoch(); return MIRROR[t] || []; },
  key:    function (t, row) { return rowPendingKey(t, row); },
  send:   function (t, rows) {
    var m = tableMeta(t);
    return withTimeout(S.sb.from(t).upsert(rows, { onConflict: m.key }));
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
  refresh: function () { return syncNow(); },
  log:    function (action, entries) { return logAwait(action, entries); }
};

// מזהה מכשיר אינו מזהה רשומה — אינו עובר ב-newClientId, ודי בשמונה תווים קריאים ביומן.
// מזהה שכבר במכשיר אינו משתנה לעולם — החלפתו מנתקת רישומים קיימים ביומן ממקורם.
var DEV_CFG = { key: 'g_device_id' };

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
    // g_users נמשכת בבדיקה המחזורית, ולכן גם כתיבה אליה מקדמת את החותמת — אחרת משתמש חדש לא יגיע למכשיר אחר עד שינוי נתונים אחר.
    plTouch();
    // ללא טביעה: הגזירה נכשלה ו-pass_fp נכתב ריק לצד סיסמה חדשה; השדה נכנס ל-body רק כשנמסרה סיסמה.
    return { noFp: Object.prototype.hasOwnProperty.call(body, 'pass_fp') && !body.pass_fp };
  }
};

document.title = self.APP.name;

// ── מעטפת המסך ──
var VIEW_LOADING = '<div class="view-loading" role="status" aria-label="טוען"><span class="view-spin"></span></div>';

var TABS = [
  { id: 'home', ic: '🏠', label: 'בית' },
  { id: 'donors', ic: '🙋', label: 'תורמים' },
  { id: 'pledges', ic: '🤝', label: 'התחייבויות' },
  { id: 'tasks', ic: '🗂️', label: 'משימות' },
  { id: 'settings', ic: '⚙️', label: 'הגדרות' }
];

function renderShell() {
  var tabsHTML = TABS.map(function (t) {
    return '<button data-act="tab" data-tab="' + t.id + '" class="' + (state.screen === t.id ? 'on' : '') + '">' +
      '<span class="ic">' + t.ic + '</span><span>' + t.label + '</span></button>';
  }).join('');

  shellBare(false);
  $('header.topbar').innerHTML =
      '<div class="brand">' + markSVG('') + '<span>גיוס<small> · ניהול גיוס כספים</small></span></div>' +
      '<nav class="tabbar">' + tabsHTML + '</nav>' +
      '<div class="who"><div class="who-id"><div class="nm">' + esc(state.user.full_name) + '</div>' +
        '<span class="role">' + (isAdmin() ? 'בעלים' : 'מנהל') + '</span></div>' +
        '<button class="btn ghost sm" data-act="switch-user" title="החלפת משתמש">👥</button>' +
        '<button class="btn ghost sm" data-act="my-pass" title="שינוי סיסמה">🔑</button>' +
        '<button class="btn ghost sm" data-act="logout">יציאה</button></div>';
  // הכפתור הצף אינו בקליפה — מסך ההגדרות בלעדיו.
  var fab = $('#app > .fab');
  if (state.screen === 'settings') { if (fab) fab.remove(); }
  else if (!fab) $('#app').insertAdjacentHTML('beforeend', '<button class="fab" data-act="fab" aria-label="הוספה">＋</button>');
}

function render() {
  if (!state.user) { renderLogin(); return; }
  renderShell();
  var view = $('#view');
  if (state.screen === 'home') view.innerHTML = viewHome();
  else if (state.screen === 'donors') view.innerHTML = state.donorId ? viewDonorCard() : viewDonors();
  else if (state.screen === 'pledges') view.innerHTML = viewPledges();
  else if (state.screen === 'tasks') { view.innerHTML = viewTasks(); }
  else if (state.screen === 'settings') { view.innerHTML = viewSettings(); }

  // קופצים לראש רק במעבר מסך — render נקראת גם מהבדיקה המחזורית, וגלילה ללא תנאי הייתה מקפיצה את המסך באמצע עבודה.
  var key = state.screen + '/' + (state.donorId || '');
  if (key !== S.lastViewKey) { window.scrollTo(0, 0); S.lastViewKey = key; }
}

// כפתור ההגדרות מוצג לכולם בכוונה — מי שאינו מורשה מקבל טוסט, ואין להסתיר את הטאב; האכיפה חוזרת גם ב-viewSettings.
function go(screen) {
  if (screen === 'settings' && !isAdmin()) {
    toast(MSG_OWNER_ONLY, null, 'bad');
    return;
  }
  state.screen = screen;
  state.donorId = null;
  // הבית נפתח בחודש של היום — אחרת מי שחוזר לבית רואה יעד של חודש שדופדף אליו.
  if (screen === 'home') state.month = monthKeyOf(dayToday());
  render();
}

// הקנבן אינו הגרירה לסידור שבליבה — הכרטיס אינו זז בעץ, והשחרור מעביר אותו לשלב שב-data-drop של העמודה שמתחתיו, ולא לסדר שנקרא מה-DOM.
document.addEventListener('pointerdown', function (e) {
  var g = e.target && e.target.closest ? e.target.closest('[data-grip]') : null;
  if (!g) return;
  KDRAG.el = g.closest('[data-drag]');
  if (!KDRAG.el) return;
  KDRAG.col = null;
  KDRAG.el.classList.add('dragging');
  // המצביע נלכד על הידית — בלעדיו אצבע שיוצאת מגבול הכרטיס מפסיקה לשדר והגרירה נתקעת.
  try { g.setPointerCapture(e.pointerId); } catch (e1) {}
  e.preventDefault();
});

document.addEventListener('pointermove', function (e) {
  if (!KDRAG.el) return;
  e.preventDefault();
  var col = kdragCol(e.clientX, e.clientY);
  if (col === KDRAG.col) return;
  if (KDRAG.col) KDRAG.col.classList.remove('over');
  KDRAG.col = col;
  if (col) col.classList.add('over');
});

document.addEventListener('pointerup', function (e) {
  if (!KDRAG.el) return;
  var el = KDRAG.el, col = kdragCol(e.clientX, e.clientY);
  if (KDRAG.col) KDRAG.col.classList.remove('over');
  KDRAG.el = null; KDRAG.col = null;
  el.classList.remove('dragging');
  if (col && col.dataset.drop) moveTask(el.dataset.id, col.dataset.drop);
});

// גרירה שבוטלה אינה מעבירה — בלי זה הכרטיס נשאר «נגרר», והשחרור הבא בכל מקום היה מעביר אותו.
document.addEventListener('pointercancel', function () {
  if (!KDRAG.el) return;
  if (KDRAG.col) KDRAG.col.classList.remove('over');
  KDRAG.el.classList.remove('dragging');
  KDRAG.el = null; KDRAG.col = null;
});

// ── פעולות ──
// אין onclick עם קוד בתוך מאפיין — המסכים נבנים כמחרוזות, וגרש בשם תורם שובר את הקוד והופך הזרקה לביצוע.
// saveRefresh אינה ממתינה לרשת — הכתיבה כבר במראה ובתור, והסנכרון מרנדר שוב ברקע.
function saveRefresh() {
  applyMirrorToState();
  render();
  pendRender();
}

function findUser(id) {
  for (var i = 0; i < state.users.length; i++) if (idEq(state.users[i].client_id, id)) return state.users[i];
  return null;
}

function findTask(id) {
  for (var i = 0; i < state.tasks.length; i++) if (idEq(state.tasks[i].client_id, id)) return state.tasks[i];
  return null;
}

var DOM_ACTIONS = {
  'sw-apply':            function (el) { swApply(el); },
  'sw-dismiss':          function () { swHideUpdate(); },
  // התראות התשתית מנותבות במפה — הכפתור נבנה ב-JS, ומאזין ישיר עליו היה מחוץ למנגנון.
  'ls-alert-close':      function () { var el = document.getElementById('ls-alert'); if (el) el.remove(); },
  'pend-alert-ok':       function () { pendAlertDismiss(); },
  'lk-stay':             function () { lkReset(); },
  'tab': function (el) { go(el.dataset.tab); },
  'switch-user': function () { formSwitchUser(); },
  'switch-confirm': function (el) {
    var id = $('#sw-user') ? $('#sw-user').value : '';
    var p  = $('#sw-pass') ? $('#sw-pass').value : '';
    if (!id || !p) { toast(MSG_PICK_USER_AND_PASS, null, 'bad'); return; }
    var cu = null, arr = usersGet();
    for (var i = 0; i < arr.length; i++) if (arr[i] && String(arr[i].client_id) === String(id)) cu = arr[i];
    // ההודעות נשארות נבדלות — «אין במה לאמת» אינו «סיסמה שגויה», והודעה מאוחדת שולחת להקליד שוב סיסמה נכונה.
    if (!cu) { authLog(false, 'switch_unknown_user_offline', String(id)); toast(MSG_OFF_UNKNOWN, null, 'bad'); return; }
    return authVerify(cu, p).then(function (v) {
      if (v === 'no-fp')     { authLog(false, 'switch_no_fp_offline', cu.username); toast(MSG_OFF_NO_FP, null, 'bad'); return; }
      if (v === 'no-crypto') { authLog(false, 'switch_no_crypto_offline', cu.username); toast(MSG_OFF_NO_CRYPTO, null, 'bad'); return; }
      if (v !== 'ok')        { authLog(false, 'switch_wrong_credentials_offline', cu.username); toast(MSG_BAD_LOGIN, null, 'bad'); return; }
      closeModal();
      ctxSwitch();
      state.user = { client_id: cu.client_id, username: cu.username, full_name: cu.full_name, role: cu.role };
      authLog(true, 'switch_offline', cu.username);
      state.screen = 'home';
      state.donorId = null;
      boot();
      toast(MSG_SWITCHED_TO + (cu.full_name || cu.username), null, 'good');
    }, function (e) { console.warn('[switch]', e); authLog(false, 'switch_no_crypto_offline', cu.username); toast(MSG_OFF_NO_CRYPTO, null, 'bad'); });
  },
  'logout': function () { doLogout(); },
  'modal-close': function () { closeModal(); },
  'ask-yes': function () { closeAsk(true); },
  'ask-no': function () { closeAsk(false); },

  'month': function (el) { state.month = shiftMonth(state.month, +el.dataset.d); render(); },

  'fab': function () {
    openModal(MSG_WHAT_TO_ADD,
      '<div class="chooser">' +
        '<button data-act="txn-new"><span class="ic">💰</span><span>תנועה<small>רישום כסף שנכנס</small></span></button>' +
        '<button data-act="task-new"><span class="ic">📋</span><span>משימה<small>מטלה לקנבן</small></span></button>' +
        '<button data-act="pledge-new"><span class="ic">🤝</span><span>התחייבות<small>הבטחת תרומה</small></span></button>' +
      '</div>', '');
  },

  // ── תורמים ──
  'donor-new': function () { formDonor(null); },
  'donor-edit': function (el) { formDonor(donorById(el.dataset.id)); },
  'donor-save': function (el) { return runSave(function () { return saveDonor(el.dataset.id); }, 'נשמר'); },
  'donor-open': function (el) {
    state.screen = 'donors';
    state.donorId = el.dataset.id;
    render();
  },
  'donor-back': function () { state.donorId = null; render(); },
  'vip-toggle': function (el) {
    var d = donorById(el.dataset.id);
    if (!d) return;
    return update('g_donors', d.client_id, { is_vip: !d.is_vip })
      .then(function () { d.is_vip = !d.is_vip; render(); })
      .catch(errToast);
  },
  'notes-save': function (el) {
    var notes = $('#donor-notes') ? $('#donor-notes').value : '';
    return update('g_donors', el.dataset.id, { notes: notes || null })
      .then(function () {
        var d = donorById(el.dataset.id);
        if (d) d.notes = notes;
        toast(MSG_NOTES_SAVED, null, 'good');
      })
      .catch(errToast);
  },
  'donor-del': function (el) {
    var d = donorById(el.dataset.id);
    if (!d) return;
    var hasData = pledgesOfDonor(d.client_id).length || txnsOfDonor(d.client_id).length;
    return ask(MSG_DEL_DONOR_TITLE,
      hasData
        ? MSG_DEL_DONOR_LINKED
        : MSG_DEL_QUOTE_PRE + d.name + MSG_DEL_QUOTE_POST,
      MSG_DELETE_ACT
    ).then(function (yes) {
      if (!yes) return;
      softDelete('g_donors', d.client_id)
        .then(function () { state.donorId = null; return afterSave('התורם נמחק'); })
        .catch(errToast);
    });
  },

  // ── תנועות התורם ──
  'txn-new': function (el) { formTxn(null, el.dataset.donor || ''); },
  'txn-edit': function (el) {
    var t = null;
    for (var i = 0; i < state.txns.length; i++) if (idEq(state.txns[i].client_id, el.dataset.id)) t = state.txns[i];
    if (t) formTxn(t);
  },
  'txn-save': function (el) { return runSave(function () { return saveTxn(el.dataset.id); }, 'התנועה נשמרה'); },
  'txn-del': function (el) {
    return ask(MSG_DEL_TXN_TITLE, MSG_DEL_TXN_BODY, MSG_DELETE_ACT).then(function (yes) {
      if (!yes) return;
      softDelete('g_txns', el.dataset.id).then(function () { return afterSave('נמחק'); }).catch(errToast);
    });
  },

  // ── התחייבויות התורם ──
  'pledge-new': function (el) { formPledge(null, el.dataset.donor || ''); },
  'pledge-edit': function (el) { formPledge(pledgeById(el.dataset.id)); },
  'pledge-save': function (el) { return runSave(function () { return savePledge(el.dataset.id); }, 'ההתחייבות נשמרה'); },
  'pledge-del': function (el) {
    return ask(MSG_DEL_PLEDGE_TITLE, MSG_DEL_PLEDGE_BODY, MSG_DELETE_ACT).then(function (yes) {
      if (!yes) return;
      softDelete('g_pledges', el.dataset.id).then(function () { return afterSave('נמחק'); }).catch(errToast);
    });
  },
  'pf-clear': function () {
    state.pf = { agent: '', status: '', cause: '', from: '', to: '' };
    render();
  },

  // ── משימות ──
  'task-new': function () { formTask(null); },
  'task-open': function (el) { formTask(findTask(el.dataset.id)); },
  'task-save': function (el) { return runSave(function () { return saveTask(el.dataset.id); }, 'המשימה נשמרה'); },
  'task-del': function (el) {
    return ask(MSG_DEL_TASK_TITLE, MSG_DEL_TASK_BODY, MSG_DELETE_ACT).then(function (yes) {
      if (!yes) return;
      softDelete('g_tasks', el.dataset.id).then(function () { return afterSave('נמחק'); }).catch(errToast);
    });
  },

  // ── הגדרות: משתמשים ──
  'user-new': function () { formUser(null); },
  'user-edit': function (el) { formUser(findUser(el.dataset.id)); },
  'user-save': function (el) { return runSave(function () { return saveUser(el.dataset.id); }, 'המשתמש נשמר'); },
  'user-pass': function (el) { var u = findUser(el.dataset.id); if (u) formPassword(u); },
  'pass-save': function (el) {
    var p = $('#pw-new') ? $('#pw-new').value : '';
    if (!p) { toast(MSG_NEED_PASS, null, 'bad'); return; }
    if (!PASS_SIX_RE.test(p)) { toast(MSG_PASS_SIX, null, 'bad'); return; }
    if (!navigator.onLine) { toast(MSG_OFF_USER_WRITE, null, 'bad'); return; }
    return runSave(function () {
      return authPassFields(p).then(function (pf) {
        return writeUser(el.dataset.id, pf).then(warnIfNoFp);
      });
    }, 'הסיסמה עודכנה');
  },
  'my-pass': function () { formMyPassword(); },
  // הצגת הסיסמה — לשדות שבהם הבעלים קובע סיסמה לאדם אחר אין שדה אימות, והסתרה בלי דרך לראות הייתה נועלת בחוץ בשקט.
  'pass-eye': function (el) {
    var f = $('#' + el.dataset.id);
    if (f) f.type = (f.type === 'password' ? 'text' : 'password');
  },
  'my-pass-save': function () { return formSaveMyPassword(); },
  'user-toggle': function (el) {
    var u = findUser(el.dataset.id);
    if (!u) return;
    if (idEq(u.client_id, state.user.client_id) && u.active) { toast(MSG_NO_SELF_DISABLE, null, 'bad'); return; }
    if (!navigator.onLine) { toast(MSG_OFF_USER_WRITE, null, 'bad'); return; }
    // ההשבתה חייבת להגיע לענן — משתמש מושבת שנשאר במראה של מכשיר אחר נשאר בר-כניסה אופליין.
    return writeUser(u.client_id, { active: !u.active })
      .then(function () { render(); toast(MSG_UPDATED, null, 'good'); })
      .catch(errToast);
  },

  // ── הגדרות: רשימות ──
  'cfg-add': function (el) {
    var key = el.dataset.key;
    var input = $('#cfg-add-' + key);
    var v = input ? input.value.trim() : '';
    if (!v) { toast(MSG_NEED_VALUE, null, 'bad'); return; }
    var list = (state.config[key] || []).slice();
    if (uniqHas(list, v)) { toast(MSG_VALUE_EXISTS2, null, 'bad'); return; }
    list.push(v);
    return runSave(function () { return saveConfigList(key, list); }, 'נוסף');
  },
  'cfg-edit': function (el) {
    var key = el.dataset.key, i = +el.dataset.i;
    var list = (state.config[key] || []).slice();
    openModal(MSG_EDIT_VALUE,
      '<label class="fld"><span>ערך</span><input class="inp" id="cfg-v" value="' + esc(list[i] || '') + '"></label>' +
      '<div class="note">שינוי הערך אינו משנה רשומות קיימות שכבר משתמשות בערך הישן.</div>',
      '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
      '<button class="btn" data-act="cfg-edit-save" data-ksave data-key="' + key + '" data-i="' + i + '">שמירה</button>');
  },
  'cfg-edit-save': function (el) {
    var key = el.dataset.key, i = +el.dataset.i;
    var v = val('cfg-v');
    if (!v) { toast(MSG_NEED_VALUE, null, 'bad'); return; }
    var list = (state.config[key] || []).slice();
    list[i] = v;
    return runSave(function () { return saveConfigList(key, list); }, 'נשמר');
  },
  'cfg-del': function (el) {
    var key = el.dataset.key, i = +el.dataset.i;
    var list = (state.config[key] || []).slice();
    return ask(MSG_REMOVE_VALUE_TITLE, MSG_REMOVE_QUOTE_PRE + list[i] + MSG_REMOVE_QUOTE_POST, MSG_REMOVE_ACT)
      .then(function (yes) {
        if (!yes) return;
        list.splice(i, 1);
        saveConfigList(key, list).then(function () { return afterSave('הוסר'); }).catch(errToast);
      });
  },

  // ── הגדרות: יעדים ──
  'target-set': function (el) { formTarget(el.dataset.month || state.month); },
  'target-save': function () { return runSave(saveTarget, 'היעד נשמר'); },
  'reload':            function () { location.reload(); },
  'login':             function () { return doLogin(); },
  'combo-pick':        function (el) { return comboPick(el); },
  'combo-make':        function (el) { return comboMake(el); },
  'donor-new-cancel':  function (el) { donorNewCancel(el.dataset.id); },
  'donor-new-save':    function (el) { return donorNewSave(el.dataset.id); },
};

// ── מאזינים גלובליים ──
// if (el.tagName === 'A') return אינו קישוט — אחרת קישור בתוך אזור data-act מקבל preventDefault; אין למחוק גם כשאין קישור כזה.
// סגירת הרקע קודמת לניתוב — לחיצה על הרקע אינה נושאת data-act.
document.addEventListener('click', function (e) {
  comboOutside(e);
  if (modalBackdrop(e)) return;
  var el = e.target.closest('[data-act]');
  if (!el) return;
  var fn = DOM_ACTIONS[el.dataset.act];
  if (!fn) return;
  if (el.tagName === 'A') return;
  e.preventDefault();
  actRun(el, fn);
});

// שמירה בשדה עריכה קודמת לסגירת חלון הדו-שיח — אחרת Escape בשדה שבתוך חלון דו-שיח היה סוגר אותו במקום לבטל את השדה.
document.addEventListener('keydown', function (e) {
  if (comboKey(e) || ksKey(e)) return;
  modalEsc(e);
});

// החיפוש מרנדר רק את הרשימה והמונה — רינדור מלא בונה מחדש את השדה ומאבד את הפוקוס אחרי כל תו.
document.addEventListener('input', function (e) {
  if (comboInput(e)) return;
  var el = e.target;
  if (!el.dataset) return;
  if (el.dataset.inp === 'donor-q') {
    state.donorSearch = el.value;
    var box = $('#donor-list');
    if (box) box.innerHTML = donorRowsHTML(donorMatches(state.donorSearch));
    var cnt = $('#view .card > h2 .cnt');
    if (cnt) cnt.textContent = donorMatches(state.donorSearch).length;
    return;
  }
});

document.addEventListener('change', function (e) {
  var el = e.target;
  if (!el.dataset) return;
  if (el.dataset.chg === 'stage') {
    moveTask(el.dataset.id, el.value);
    return;
  }
  var map = { 'pf-agent': 'agent', 'pf-status': 'status', 'pf-cause': 'cause', 'pf-from': 'from', 'pf-to': 'to' };
  if (map[el.dataset.chg]) {
    state.pf[map[el.dataset.chg]] = el.value;
    refreshPledges();
  }
});

// focusin ולא focus — focus אינו עולה בעץ, ומאזין על השדה עצמו מת עם חלון הדו-שיח שנבנה מחדש.
document.addEventListener('focusin', comboFocus);

// ── עלייה ──
// אין להזיז את mirrorLoad אחרי הסנכרון הראשון — המסך עולה מהדיסק לפני שנוגעים ברשת.
function boot() {
  // שני מסלולי הכניסה, המקוון והאופליין, מגיעים לכאן — ולכן זו נקודת הדריכה האחת של הנעילה.
  try { lkReset(); } catch (e) { console.warn('[lk] lkReset', e); }
  viewBare(VIEW_LOADING);
  // קריאה מהעותק המקומי לפני כל נגיעה ברשת — זה ההבדל בין עבודה אופליין לספינר.
  applyMirrorToState();
  pendRender();

  if (mirrorHasData()) {
    render();
    syncNow();
    return Promise.resolve();
  }

  // אין עותק מקומי כלל — כאן רשת היא חובה.
  return syncNow().then(function (okPull) {
    if (okPull || mirrorHasData()) { render(); return; }
    viewBare('<div class="auth"><div class="auth-card">' +
      '<h1>שגיאת טעינה</h1><div class="sub">אין עדיין עותק מקומי של הנתונים, ולא הצלחנו לטעון מהשרת. ' +
      'התחברו לרשת פעם אחת — מכאן והלאה האפליקציה תעבוד גם בלעדיה.</div>' +
      '<button class="reload-btn btn block" data-act="reload">רענון</button>' +
      '</div></div>');
  });
}

function start() {
  shell.render = render;
  shell.boot = boot;
  // state.user הוא חלון למודול הסשן — שדה רגיל היה מסלול שדרכו הסשן יורד לדיסק.
  Object.defineProperty(state, 'user', { get: sessGet, set: sessSet, enumerable: true });
  state.month = monthKeyOf(dayToday());
  if (!window.supabase || !window.supabase.createClient) {
    viewBare('<div class="auth"><div class="auth-card"><h1>שגיאת טעינה</h1>' +
      '<div class="sub">ספריית Supabase לא נטענה. בדקו את החיבור לאינטרנט ורעננו.</div>' +
      '<button class="btn block" data-act="reload">רענון</button></div></div>');
    return;
  }
  S.sb = sbWatch(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  }));

  // מדידה ופינוי יזום לפני טעינת המראה — כדי שהמשיכה שאחריה תכתוב לאחסון שכבר יש בו מקום.
  try { lsBoot(); } catch (e) { console.warn('[ls] lsBoot', e); }
  mirrorBoot();
  // סימוני ההמתנה נטענים לפני הרינדור הראשון — כך שפעולה שלא עלתה בסשן הקודם מוצגת כממתינה מיד.
  try { pendBoot(); } catch (e) { console.warn('[pend] pendBoot', e); }
  try { tombBoot(); } catch (e) { console.warn('[tomb] tombBoot', e); }
  try { eraKick(); } catch (e) { console.warn('[era] eraKick', e); }
  // הגיבוי מופעל בעלייה ולא אחרי משיכה שהצליחה — אחרת בתקופה בלי סנכרון הוא מושבת בלי שאיש יודע.
  try { bkBoot(); } catch (e) { console.warn('[bk] bkBoot', e); }
  try { rtyBoot(); } catch (e) { console.warn('[rty] rtyBoot', e); }
  try { plBoot(); } catch (e) { console.warn('[pl] plBoot', e); }
  try { hwBoot(); } catch (e) { console.warn('[hw] hwBoot', e); }
  try { lkBoot(); } catch (e) { console.warn('[lk] lkBoot', e); }

  // אין שחזור סשן — סשן מ-localStorage בלי תפוגה משאיר מחובר לנצח במכשיר משותף ומוריד את role לדיסק.
  // הכניסה האופליין אינה תלויה בסשן — היא מוכרעת ב-authVerify מול pass_fp שבמראה.
  renderLogin();
}

start();

window.bootOk();
