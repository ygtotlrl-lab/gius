// app/main.js — העלייה, הקליפה, מפת הפעולות והניווט
import { appConfigure, dayToday, getDeviceId, uniqHas,
         netTimeout } from '../core/util.js';
import { afterSave, eraKeys, errToast, idEq, newClientId, pendAlertDismiss, pendCount, pendRender,
         runSave, sbWatch, schedulePush, tombKill } from '../core/sync.js';

import { lsOpen } from '../core/storage.js';
import { MIRROR, mirrorKey, mirrorTables } from '../core/mirror.js';
import { logAwait } from '../core/backup.js';
import { bootRun } from '../core/boot-run.js';
import { actWire, ask, closeAsk, closeModal, comboFocus, comboInput, comboMake, comboPick,
         dragCancel, dragDown, dragMove, dragUp, esc, lookupSeed, openModal, shellBare, swApply,
         swHideUpdate, toast, uiNoDialog } from '../core/ui.js';
import { KV_TABLE, MORE, MSG_DELETE_ACT, MSG_DEL_BUDGET, MSG_DEL_DONOR, MSG_DEL_LOAN, MSG_DEL_LOOKUP,
         MSG_DEL_NOTE, MSG_DEL_PAY, MSG_DEL_PLAN, MSG_DEL_PLEDGE, MSG_DEL_SOFT, MSG_DEL_TASK,
         MSG_NEED_VALUE, MSG_VALUE_EXISTS, PUSH_TABLES, SUPABASE_ANON_KEY, SUPABASE_URL, TABLES,
         TABS } from './constants.js';
import { S, shell, state } from './state.js';
import { $, applyMirrorToState, donorById, donorNewCancel, donorNewSave, listDef, lookupById,
         lookupPut, lookupRows, mirrorHasData, monthKeyOf, pendRowKey, pledgeById, rowPendingKey,
         shiftMonth, softDelete, stripRows, syncNow, tableMeta, update, viewBare } from './domain.js';
import { icon } from './icons.js';
import { viewDash } from './screens/dash.js';
import { cardRowsHTML, formDonor, initPick, formPay, formPledge, saveDonor, savePay, savePledge,
         viewCards } from './screens/cards.js';
import { formPlan, savePlan, viewPlan } from './screens/plan.js';
import { formTask, saveTask, viewTasks } from './screens/tasks.js';
import { formNote, saveNote, viewNotes } from './screens/notes.js';
import { formLoan, saveLoan, viewLoans } from './screens/loans.js';
import { formBudget, saveBudget, viewBudget } from './screens/budget.js';
import { formTarget, formTargetDefault, lookupForm, saveTarget, saveTargetDefault,
         viewSettings } from './screens/settings.js';

// ── החיווט ──
// החיווט נמסר בשומרי קריאה — ה-CFG מוגדרים בהמשך, והשומר קורא אותם בזמן הקריאה ולא בזמן המסירה.
appConfigure({
  get BK_CFG() { return BK_CFG; },
  get DEV_CFG() { return DEV_CFG; },
  get DOM_ACTIONS() { return DOM_ACTIONS; },
  get ERA_CFG() { return ERA_CFG; },
  get LOOKUP_CFG() { return LOOKUP_CFG; },
  get LS_CFG() { return LS_CFG; },
  get MIRROR_CFG() { return MIRROR_CFG; },
  get PEND_CFG() { return PEND_CFG; },
  get PL_CFG() { return PL_CFG; },
  get PUSH_CFG() { return PUSH_CFG; },
  get RTY_CFG() { return RTY_CFG; },
  get saveRefresh() { return saveRefresh; }
});

// הרשימות לסידור — השורות והכתיבה של גיוס, והזריעה והסידור בליבה; הכתיבה המקומית כבר דורכת את הדחיפה.
var LOOKUP_CFG = {
  rows:   function (kind) { return lookupRows(kind); },
  put:    function (row) { lookupPut(row); },
  after:  function () { schedulePush(); },
  render: function () { render(); }
};

// tables היא פונקציה ולא מערך — TABLES מוצהר אחרי הבלוק, וקריאה בו כאן הייתה מקבלת undefined.
// טבלה שאינה נדחפת מוכרזת ב-noPush עם המסלול שדוחף אותה — רשומת אב או סוד.
var MIRROR_CFG = {
  prefix: self.APP.prefix + 'mirror_',
  tables: function () { return TABLES.map(function (m) { return m.t; }); },
  // ריק ומוצהר — שדה חסר נקרא «לא נשאל», וריק נקרא «נמדד ואין».
  noPush: [],
  empty:  function () { return []; },
  clean:  function (t, rows) { return stripRows(t, rows); },
  fail:   function (where, e) { console.error('[mirror] ' + where, e); },
};

var LS_CFG = {
  // cachePrefix נגזר משם האפליקציה שבתצורה ולא מקידומת האחסון — שם אחסון שישתנה היה מחזיר רשימה ריקה, והבאנר היה חוזר בכל טעינה.
  cachePrefix: self.APP.id + '-',
  logKey: 'g_ls_log',
  // הסימן נושא את תחילית האפליקציה — ה-origin משותף, וסימן אחד היה נדרס בכל דחייה.
  dismissKey: 'g_sw_dismissed',
  // מפתח שאינו במרשם נמחק בעלייה.
  keys: function () {
    return [LS_CFG.logKey, LS_CFG.dismissKey, DEV_CFG.key, PEND_CFG.key,
            BK_CFG.flagKey, BK_CFG.logQueueKey]
      .concat(eraKeys(), mirrorTables().map(mirrorKey));
  }
};

// האפליקציה בפרויקט Supabase נפרד — ולכן sh_backup ו-sh_sync_log נוצרות בקובץ הסכימה שלה.
var BK_CFG = {
  client: function () { return S.sb; },
  flagKey: 'g_last_backup',
  logQueueKey: 'g_log_queue',
  prefix: '',
  device: function () { try { return getDeviceId(); } catch (e) { return null; } },
  // אין כניסה ולכן אין שם משתמש — המכשיר הוא הזהות היחידה, ושדה מומצא היה עדות שאיש לא מסר.
  user: function () { return null; },
  // secrets ריק — אין היום סוד, והמנגנון נשאר דרוך לסוד עתידי.
  secrets: [],
  sources: function () {
    return [
      { name: 'g_donors',       order: 'client_id', ts: 'updated_at' },
      { name: 'g_pledges',      order: 'client_id', ts: 'updated_at' },
      { name: 'g_txns',         order: 'client_id', ts: 'updated_at' },
      { name: 'g_plan_items',   order: 'client_id', ts: 'updated_at' },
      { name: 'g_tasks',        order: 'client_id', ts: 'updated_at' },
      { name: 'g_targets',      order: 'client_id', ts: 'updated_at' },
      { name: 'g_notes',        order: 'client_id', ts: 'updated_at' },
      { name: 'g_loans',        order: 'client_id', ts: 'updated_at' },
      { name: 'g_budget_items', order: 'client_id', ts: 'updated_at' },
      { name: KV_TABLE,         order: 'key',       ts: 'updated_at' },
      { name: 'g_lookups',      order: 'client_id', ts: 'updated_at' }
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

// שורת החותמת מוחרגת מהמראה ב-stripRows — דחיפת-מצב שלה הייתה מחזירה לענן חותמת ישנה.
// ok() אינו נוגע ב-_lastPullOk — הוא עד המשיכה המלאה, ושיחה מוצלחת אחרת אינה עדות על מצב הענן.
var PL_CFG = {
  every:  3000,
  // אין כניסה — הבדיקה המחזורית פעילה כל עוד הלשונית גלויה, ותנאי של משתמש מחובר לא היה מתקיים כאן לעולם.
  active: function () { return document.visibilityState !== 'hidden'; },
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
  rows:   function (t) { return MIRROR[t] || []; },
  key:    function (t, row) { return rowPendingKey(t, row); },
  send:   function (t, rows) {
    var m = tableMeta(t);
    return netTimeout(S.sb.from(t).upsert(rows, { onConflict: m.key }));
  },
  run:    function () { syncNow(); },
};

var ERA_CFG = {
  prefix: self.APP.prefix,
  client: function () { return S.sb; },
  table:  function () { return KV_TABLE; },
  refresh: function () { return syncNow(); },
  log:    function (action, entries) { return logAwait(action, entries); }
};

// מזהה מכשיר אינו מזהה רשומה — אינו עובר ב-newClientId, ודי בשמונה תווים קריאים ביומן.
// מזהה שכבר במכשיר אינו משתנה לעולם — החלפתו מנתקת רישומים קיימים ביומן ממקורם.
var DEV_CFG = { key: 'g_device_id' };

document.title = self.APP.name;

// ── מעטפת המסך ──
var VIEW_LOADING = '<div class="view-loading" role="status" aria-label="טוען"><span class="view-spin"></span></div>';

// הכפתור הצף — הוספה במסך שיש בו מה להוסיף; בלוח הבקרה ובהגדרות אין.
var FAB_ACT = { cards: 'donor-new', plan: 'plan-new', tasks: 'task-new', notes: 'note-new',
                loans: 'loan-new', budget: 'budget-new' };

var VIEWS = { dash: viewDash, cards: viewCards, plan: viewPlan, tasks: viewTasks, notes: viewNotes,
              loans: viewLoans, budget: viewBudget, settings: viewSettings };

function tabOf(id) {
  var all = TABS.concat(MORE);
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  return TABS[0];
}

function inMore(id) { return MORE.some(function (t) { return t.id === id; }); }

function markSVG(cls) {
  return '<svg class="' + cls + '" viewBox="0 0 100 100" aria-hidden="true">' +
    '<rect x="2" y="2" width="96" height="96" rx="24" fill="var(--brand-fill)"/>' +
    '<circle cx="50" cy="50" r="26" fill="none" stroke="#fff" stroke-width="8"/>' +
    '<circle cx="50" cy="50" r="10" fill="#fff"/></svg>';
}

function renderShell() {
  // המשניים נצבעים גם הם, ומוצגים רק במסך רחב — שם «עוד» נעלם והסרגל פורס את כל המסכים.
  var tabsHTML = TABS.concat(MORE).map(function (t) {
    var cls = (state.screen === t.id ? 'on' : '') + (inMore(t.id) ? ' wide-only' : '');
    return '<button data-act="tab" data-tab="' + t.id + '" class="' + cls.trim() + '">' +
      '<span class="ic">' + icon(t.ic) + '</span><span>' + t.label + '</span></button>';
  }).join('') +
    '<button data-act="more" class="narrow-only' + (inMore(state.screen) ? ' on' : '') + '" aria-haspopup="dialog">' +
      '<span class="ic">' + icon('more') + '</span><span>' + (inMore(state.screen) ? esc(tabOf(state.screen).label) : 'עוד') + '</span></button>';
  var t = tabOf(state.screen);

  shellBare(false);
  $('header.topbar').innerHTML =
      '<div class="brand">' + markSVG('') + '<span class="brand-t"><small>גיוס</small>' + esc(t.title || t.label) + '</span></div>' +
      '<nav class="tabbar">' + tabsHTML + '</nav>';
  var fab = $('#app > .fab'), act = FAB_ACT[state.screen];
  if (!act) { if (fab) fab.remove(); return; }
  if (!fab) { $('#app').insertAdjacentHTML('beforeend', '<button class="fab" aria-label="הוספה">＋</button>'); fab = $('#app > .fab'); }
  fab.setAttribute('data-act', act);
}

function render() {
  renderShell();
  $('#view').innerHTML = (VIEWS[state.screen] || viewDash)();
  // קופצים לראש רק במעבר מסך — render נקראת גם מהבדיקה המחזורית, וגלילה ללא תנאי הייתה מקפיצה את המסך באמצע עבודה.
  if (state.screen !== S.lastViewKey) { window.scrollTo(0, 0); S.lastViewKey = state.screen; }
}

// כניסה למסך — לוח הבקרה והתכנית בחודש של היום; הכרטיסים בלי סינון, לפי א״ב ובלי כרטיס פתוח.
function go(screen) {
  state.screen = screen;
  var m = monthKeyOf(dayToday());
  if (screen === 'dash') state.month = m;
  if (screen === 'plan') state.planMonth = m;
  if (screen === 'cards') state.cards = { q: '', aff: '', sort: 'abc', open: null };
  if (screen === 'tasks') state.tasks_ui.stage = null;
  closeModal();
  render();
}

function cardsRefresh() {
  var box = $('#cards-list');
  if (box) box.innerHTML = cardRowsHTML(); else render();
}

// ── גרירה ──
// כל גרירה עוברת במנגנון שבליבה — הרשימות בהגדרות והפתקים; המחיל לכל סוג רשום ב-dragDef.
document.addEventListener('pointerdown', function (e) { dragDown(e); });
document.addEventListener('pointermove', function (e) { dragMove(e); });
document.addEventListener('pointerup', function (e) { dragUp(e); });
document.addEventListener('pointercancel', function (e) { dragCancel(e); });

// ── פעולות ──
// אין onclick עם קוד בתוך מאפיין — המסכים נבנים כמחרוזות, וגרש בשם תורם שובר את הקוד והופך הזרקה לביצוע.
// saveRefresh אינה ממתינה לרשת — הכתיבה כבר במראה ובתור, והסנכרון מרנדר שוב ברקע.
function saveRefresh() {
  applyMirrorToState();
  render();
  pendRender();
}

function findIn(list, id) {
  for (var i = 0; i < list.length; i++) if (idEq(list[i].client_id, id)) return list[i];
  return null;
}

// מחיקה רכה אחרי אישור — ומחיקת אב מפילה איתה את הבנים (PC_CHILDREN).
function delAsk(msg, table, id, done) {
  return ask(MSG_DELETE_ACT, msg + MSG_DEL_SOFT, MSG_DELETE_ACT).then(function (yes) {
    if (!yes) return;
    return softDelete(table, id).then(function () { if (done) done(); return afterSave('נמחק'); }).catch(errToast);
  });
}

function saver(fn, msg) { return function (el) { return runSave(function () { return fn(el.dataset.id, el); }, msg); }; }

var DOM_ACTIONS = {
  'sw-apply':            function (el) { swApply(el); },
  'sw-dismiss':          function () { swHideUpdate(); },
  // התראות התשתית מנותבות במפה — הכפתור נבנה ב-JS, ומאזין ישיר עליו היה מחוץ למנגנון.
  'ls-alert-close':      function () { var el = document.getElementById('ls-alert'); if (el) el.remove(); },
  'pend-alert-ok':       function () { pendAlertDismiss(); },
  'tab': function (el) { go(el.dataset.tab); },
  'more': function () {
    openModal('עוד', '<div class="more-tiles">' + MORE.map(function (t) {
      return '<button data-act="tab" data-tab="' + t.id + '" class="' + (state.screen === t.id ? 'on' : '') + '">' +
        '<span class="ic">' + icon(t.ic) + '</span><span>' + esc(t.label) + '</span></button>';
    }).join('') + '</div>', '');
  },
  'modal-close': function () { closeModal(); },
  'ask-yes': function () { closeAsk(true); },
  'ask-no': function () { closeAsk(false); },

  // ── לוח הבקרה ──
  'month': function (el) { state.month = shiftMonth(state.month, +el.dataset.d); render(); },
  'dash-who': function (el) { go('tasks'); state.tasks_ui.who = el.dataset.who; render(); },
  'card-go': function (el) { go('cards'); state.cards.open = el.dataset.id; render(); },

  // ── כרטיסים ──
  'cards-sort': function (el) { state.cards.sort = el.dataset.v; render(); },
  'card-toggle': function (el) {
    state.cards.open = state.cards.open === el.dataset.id ? null : el.dataset.id;
    cardsRefresh();
  },
  'card-close': function () { state.cards.open = null; cardsRefresh(); },
  'card-star': function (el) {
    var d = donorById(el.dataset.id);
    if (!d) return;
    return update('g_donors', d.client_id, { starred: !d.starred }).then(function () { cardsRefresh(); }).catch(errToast);
  },
  'donor-new': function () { formDonor(null); },
  'donor-edit': function (el) { formDonor(donorById(el.dataset.id)); },
  'donor-save': saver(saveDonor, 'נשמר'),
  'donor-del': function (el) {
    return delAsk(MSG_DEL_DONOR, 'g_donors', el.dataset.id, function () { state.cards.open = null; });
  },
  'pledge-new': function (el) { formPledge(null, el.dataset.donor); },
  'pledge-edit': function (el) { formPledge(pledgeById(el.dataset.id)); },
  'pledge-save': function (el) {
    return runSave(function () { return savePledge(el.dataset.id, el.dataset.donor); }, 'ההתחייבות נשמרה');
  },
  'pledge-del': function (el) { return delAsk(MSG_DEL_PLEDGE, 'g_pledges', el.dataset.id); },
  'pay-new': function (el) { formPay(null, el.dataset.pledge); },
  'pay-edit': function (el) { var t = findIn(state.txns, el.dataset.id); if (t) formPay(t); },
  'pay-save': function (el) {
    return runSave(function () { return savePay(el.dataset.id, el.dataset.pledge); }, 'התשלום נשמר');
  },
  'pay-del': function (el) { return delAsk(MSG_DEL_PAY, 'g_txns', el.dataset.id); },
  'init-pick': function (el) { return runSave(function () { return initPick(el.dataset.v); }, 'נשמר'); },

  // ── תכנית ──
  'plan-month': function (el) { state.planMonth = shiftMonth(state.planMonth, +el.dataset.d); render(); },
  'plan-new': function () { formPlan(null); },
  'plan-edit': function (el) { var r = findIn(state.plan, el.dataset.id); if (r) formPlan(r); },
  'plan-save': saver(savePlan, 'נשמר'),
  'plan-del': function (el) { return delAsk(MSG_DEL_PLAN, 'g_plan_items', el.dataset.id); },
  // ידני בלבד — השורה יורדת לתחתית ואינה נספרת בצפי ובבפועל.
  'plan-irr': function (el) {
    var r = findIn(state.plan, el.dataset.id);
    if (!r) return;
    return update('g_plan_items', r.client_id, { irrelevant: !r.irrelevant }).then(function () { render(); }).catch(errToast);
  },

  // ── משימות ──
  'task-who': function (el) { state.tasks_ui.who = el.dataset.who; render(); },
  'task-stage': function (el) {
    state.tasks_ui.stage = state.tasks_ui.stage === el.dataset.stage ? null : el.dataset.stage;
    render();
  },
  'task-new': function () { formTask(null); },
  'task-open': function (el) { var t = findIn(state.tasks, el.dataset.id); if (t) formTask(t); },
  'task-save': saver(saveTask, 'המשימה נשמרה'),
  'task-del': function (el) { return delAsk(MSG_DEL_TASK, 'g_tasks', el.dataset.id); },

  // ── רשומות · הלוואות · תקציב ──
  'note-new': function () { formNote(null); },
  'note-edit': function (el) { var n = findIn(state.notes, el.dataset.id); if (n) formNote(n); },
  'note-save': saver(saveNote, 'נשמר'),
  'note-del': function (el) { return delAsk(MSG_DEL_NOTE, 'g_notes', el.dataset.id); },
  'loan-new': function () { formLoan(null); },
  'loan-edit': function (el) { var l = findIn(state.loans, el.dataset.id); if (l) formLoan(l); },
  'loan-save': saver(saveLoan, 'נשמר'),
  'loan-del': function (el) { return delAsk(MSG_DEL_LOAN, 'g_loans', el.dataset.id); },
  'budget-new': function () { formBudget(null); },
  'budget-edit': function (el) { var b = findIn(state.budget, el.dataset.id); if (b) formBudget(b); },
  'budget-save': saver(saveBudget, 'נשמר'),
  'budget-del': function (el) { return delAsk(MSG_DEL_BUDGET, 'g_budget_items', el.dataset.id); },

  // ── הגדרות: הרשימות ──
  // הזריעה קודמת לכל עריכה — רשימה שמוצגת מנקודת הפתיחה אינה נושאת שורות, ופריט אחד שנוסף היה מוחק את השאר.
  'look-add': function (el) {
    var l = listDef(el.dataset.k);
    if (!l) { uiNoDialog('look-add', el.dataset.k); return; }
    lookupSeed(l.kind, l.dflt);
    lookupForm(l.kind, null);
  },
  'look-edit': function (el) {
    var l = listDef(el.dataset.k);
    if (l) lookupSeed(l.kind, l.dflt);
    var r = lookupById(el.dataset.id);
    if (!r) { uiNoDialog('look-edit', el.dataset.id); return; }
    lookupForm(r.kind, r);
  },
  'look-save': function (el) {
    var inp = $('#l-label');
    if (!inp) { uiNoDialog('look-save', 'l-label'); return; }
    var txt = inp.value.trim(), id = el.dataset.id, kind = el.dataset.k;
    if (!txt) { toast(MSG_NEED_VALUE, null, 'bad'); return; }
    // השורה שנערכת מוחרגת מהבדיקה — אחרת היא מתנגשת בעצמה.
    var others = lookupRows(kind).filter(function (x) { return !idEq(x.client_id, id); })
      .map(function (x) { return x.label; });
    if (uniqHas(others, txt)) { toast(MSG_VALUE_EXISTS, null, 'bad'); return; }
    return runSave(function () {
      var r = id ? lookupById(id) : null;
      var row = r ? Object.assign({}, r, { label: txt, updated_at: Date.now() })
                  : { client_id: newClientId(), kind: kind, label: txt,
                      sort: lookupRows(kind).length + 1, deleted: false, deleted_at: null };
      lookupPut(row);
      return row;
    }, 'נשמר');
  },
  'look-del': function (el) {
    var r = lookupById(el.dataset.id);
    if (!r) { uiNoDialog('look-del', el.dataset.id); return; }
    return ask(MSG_DELETE_ACT, MSG_DEL_LOOKUP, MSG_DELETE_ACT).then(function (yes) {
      if (!yes) return;
      // המחיקה סימון וחותמת על אותה שורה — tombKill חותם את deleted_at ברגע ה-updated_at שלה.
      lookupPut(tombKill(Object.assign({}, r)));
      return afterSave('הוסר');
    });
  },

  // ── הגדרות: יעד ──
  'target-set': function (el) { formTarget(el.dataset.month || state.month); },
  'target-save': function () { return runSave(saveTarget, 'היעד נשמר'); },
  'target-clear': function (el) {
    return softDelete('g_targets', el.dataset.id).then(function () { return afterSave('החודש חזר ליעד הקבוע'); }).catch(errToast);
  },
  'target-default': function () { formTargetDefault(); },
  'target-default-save': function () { return runSave(saveTargetDefault, 'היעד הקבוע נשמר'); },
  'reload':            function () { location.reload(); },
  'combo-pick':        function (el) { return comboPick(el); },
  'combo-make':        function (el) { return comboMake(el); },
  'donor-new-cancel':  function (el) { donorNewCancel(el.dataset.id); },
  'donor-new-save':    function (el) { return donorNewSave(el.dataset.id); },
};

// ── מאזינים גלובליים ──
actWire(DOM_ACTIONS);

// החיפוש מרנדר רק את הרשימה — רינדור מלא בונה מחדש את השדה ומאבד את הפוקוס אחרי כל תו.
document.addEventListener('input', function (e) {
  if (comboInput(e)) return;
  var el = e.target;
  if (!el.dataset) return;
  if (el.dataset.inp === 'cards-q') { state.cards.q = el.value; cardsRefresh(); }
});

document.addEventListener('change', function (e) {
  var el = e.target;
  if (!el.dataset) return;
  if (el.dataset.chg === 'cards-aff') { state.cards.aff = el.value; cardsRefresh(); return; }
  // תאריך שנבחר מעביר את החודש אחריו — שני שדות שסותרים זה את זה היו נשמרים בשקט.
  if (el.dataset.chg === 'when-date') {
    var mInp = document.getElementById(el.dataset.m);
    if (mInp && el.value) mInp.value = monthKeyOf(el.value);
    return;
  }
  // שייכות — סימון ישיר בכרטיס הפתוח, נשמר בשינוי.
  if (el.dataset.chg === 'aff') {
    var d = donorById(el.dataset.id);
    if (!d) return;
    var list = (d.affiliations || []).filter(function (a) { return a !== el.value; });
    if (el.checked) list.push(el.value);
    update('g_donors', d.client_id, { affiliations: list }).then(function () { cardsRefresh(); }).catch(errToast);
  }
});

// focusin ולא focus — focus אינו עולה בעץ, ומאזין על השדה עצמו מת עם חלון הדו-שיח שנבנה מחדש.
document.addEventListener('focusin', comboFocus);

// ── עלייה ──
// אין להזיז את mirrorLoad אחרי הסנכרון הראשון — המסך עולה מהדיסק לפני שנוגעים ברשת.
function boot() {
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
    viewBare('<div class="load-err"><div class="load-err-card">' +
      '<h1>שגיאת טעינה</h1><div class="sub">אין עדיין עותק מקומי של הנתונים, ולא הצלחנו לטעון מהשרת. ' +
      'התחברו לרשת פעם אחת — מכאן והלאה האפליקציה תעבוד גם בלעדיה.</div>' +
      '<button class="reload-btn btn block" data-act="reload">רענון</button>' +
      '</div></div>');
  });
}

function start() {
  shell.render = render;
  state.month = state.planMonth = monthKeyOf(dayToday());
  if (!window.supabase || !window.supabase.createClient) {
    viewBare('<div class="load-err"><div class="load-err-card"><h1>שגיאת טעינה</h1>' +
      '<div class="sub">ספריית Supabase לא נטענה. בדקו את החיבור לאינטרנט ורעננו.</div>' +
      '<button class="btn block" data-act="reload">רענון</button></div></div>');
    return;
  }
  S.sb = sbWatch(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  }));

  // הליבה עולה לפני המסך — הסימונים, הגיבוי והמראה, והמסך עולה מהדיסק לפני שנוגעים ברשת.
  bootRun();
  boot();
}

// האחסון נפתח לפני כל קריאה ממנו — אחרי שה-CFG הוגדרו, כי המרשם קורא אותם.
await lsOpen();
start();

window.bootOk();
