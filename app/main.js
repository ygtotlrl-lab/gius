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
import { KV_TABLE, MORE, MSG_DELETE_ACT, MSG_DEL_BUDGET, MSG_DEL_EVENT, MSG_DEL_DONOR, MSG_DEL_LOAN, MSG_DEL_LOAN_MOVE, MSG_DEL_LOOKUP,
         MSG_DEL_NOTE, MSG_DEL_PAY, MSG_DEL_PLAN, MSG_DEL_PLEDGE, MSG_DEL_SOFT, MSG_DEL_TASK,
         MSG_NEED_VALUE, MSG_VALUE_EXISTS, PUSH_TABLES, SUPABASE_ANON_KEY, SUPABASE_URL, TABLES,
         TABS } from './constants.js';
import { S, shell, state } from './state.js';
import { $, applyMirrorToState, donorById, donorNewCancel, donorNewSave, listDef, lookupById,
         lookupPut, lookupRows, mirrorHasData, monthKeyOf, pendRowKey, pledgeById, rowPendingKey,
         shiftMonth, softDelete, stripRows, syncNow, tableMeta, update, viewBare } from './domain.js';
import { icon } from './icons.js';
import { viewDash } from './screens/dash.js';
import { cardRowsHTML, formDonor, initPick, initSwitchChange, payPledgePick, formPay, formPledge, saveDonor, savePay, savePledge, soSync,
         soToggle, viewCards } from './screens/cards.js';
import { formPlan, savePlan, viewPlan } from './screens/plan.js';
import { formTask, saveTask, tasksBodyHTML, viewTasks } from './screens/tasks.js';
import { closeNoteFull, formNote, noteColorPick, viewNotes } from './screens/notes.js';
import { addLoanMove, formLoan, formLoanMove, saveLoanMove, loansBodyHTML, saveLoan, viewLoans } from './screens/loans.js';
import { formBudget, formEvent, saveBudget, saveEvent, viewBudget } from './screens/budget.js';
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
      { name: 'g_loan_moves',   order: 'client_id', ts: 'updated_at' },
      { name: 'g_events',       order: 'client_id', ts: 'updated_at' },
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
                loans: 'loan-new', budget: 'event-new' };

var VIEWS = { dash: viewDash, cards: viewCards, plan: viewPlan, tasks: viewTasks, notes: viewNotes,
              loans: viewLoans, budget: viewBudget, settings: viewSettings };

function tabOf(id) {
  var all = TABS.concat(MORE);
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  return TABS[0];
}

function inMore(id) { return MORE.some(function (t) { return t.id === id; }); }

// סמל רמת אביב — לבן על צבע הזהות, כמו אייקון האפליקציה (design/icon-master.svg).
var EMBLEM_D = 'M229.8,424.5C222.5,423.8 215.9,422.2 214.1,420.9C212.9,419.9 213.5,418.2 215.9,415.5C218.9,412.1 223.7,403.7 224.7,400.0C225.1,398.5 226.2,394.7 227.2,391.5C230.2,381.7 229.9,369.6 226.4,358.8C221.8,344.5 213.0,334.6 198.7,327.3C190.7,323.3 177.0,309.5 173.8,302.3C173.1,300.9 171.8,297.9 170.8,295.7C168.1,289.7 166.5,279.2 167.5,274.8C167.8,273.4 168.2,270.8 168.5,268.9C169.0,264.7 172.6,256.8 174.9,254.9C177.8,252.5 182.3,252.0 186.9,253.5C191.0,254.9 194.6,257.4 203.1,264.9C204.8,266.3 206.3,267.5 206.6,267.5C206.8,267.5 208.1,268.5 209.4,269.7C210.7,270.8 212.3,272.2 213.1,272.8C213.8,273.3 216.1,275.1 218.3,276.8C220.4,278.4 223.3,280.6 224.8,281.8C226.2,282.9 230.7,286.4 234.7,289.8C238.7,293.1 243.1,296.5 244.4,297.5C245.8,298.5 248.7,300.8 250.9,302.8C255.1,306.4 258.7,309.2 261.3,311.1C262.2,311.7 266.7,315.3 271.3,319.0C276.0,322.8 283.2,328.5 287.5,331.9C291.8,335.3 296.3,338.9 297.5,339.9C298.7,341.0 301.6,343.3 303.8,345.1C305.9,346.9 308.8,349.3 310.0,350.4C311.2,351.5 313.3,353.0 314.5,353.9C315.7,354.8 318.4,356.8 320.3,358.4C322.3,360.0 326.1,362.9 328.8,365.0C331.4,367.1 335.9,370.6 338.6,372.9C341.4,375.2 344.7,377.7 345.8,378.6C347.0,379.4 348.2,380.4 348.6,380.9C349.0,381.4 350.1,382.4 351.2,383.1C352.4,383.8 354.6,385.8 356.2,387.4C359.1,390.4 359.2,390.5 358.5,391.8C357.7,393.2 348.0,400.2 343.2,402.8C341.6,403.6 337.7,405.8 334.5,407.5C328.3,410.9 322.3,413.5 314.0,416.5C311.1,417.5 308.1,418.6 307.4,418.9C305.2,419.8 296.7,422.0 290.5,423.4C284.9,424.6 284.2,424.6 259.0,424.7C244.8,424.8 231.7,424.7 229.8,424.5ZM112.5,348.4C103.9,336.8 95.6,319.3 91.4,304.0C90.9,301.9 89.9,298.5 89.2,296.3C85.3,283.9 84.5,236.1 88.0,220.9C91.4,205.5 98.8,185.8 105.3,174.5C105.7,173.8 107.0,171.4 108.3,169.2C110.9,164.6 115.7,159.0 116.4,159.8C116.7,160.0 117.2,162.9 117.7,166.2C119.5,179.5 122.6,189.8 126.4,195.4C129.7,200.3 130.0,200.7 131.9,203.6C135.5,209.1 149.1,222.5 158.5,229.9C160.6,231.6 163.7,234.3 165.4,235.9C169.3,239.6 169.6,238.9 161.0,247.8C153.6,255.5 148.2,261.8 144.6,267.0C139.3,274.7 138.5,275.8 135.9,280.0C130.7,288.5 124.5,302.0 122.8,309.0C122.0,311.8 121.2,314.6 121.0,315.1C120.4,316.0 120.1,317.4 118.5,326.0C117.9,328.9 117.2,332.4 116.8,333.8C116.4,335.1 115.9,338.8 115.8,342.0C115.3,350.7 114.8,351.5 112.5,348.4ZM407.6,324.2C402.5,314.2 392.1,301.2 384.2,295.2C382.3,293.7 379.5,291.5 378.0,290.3C376.5,289.1 374.3,287.3 373.1,286.5C371.8,285.6 369.7,283.9 368.3,282.7C366.9,281.5 364.6,279.6 363.1,278.6C360.1,276.5 349.4,268.2 342.5,262.8C339.9,260.7 336.4,258.1 334.8,256.9C329.5,253.3 322.4,246.5 321.4,244.0C319.0,238.8 320.5,232.8 326.8,222.3C331.1,215.2 332.7,213.2 335.5,211.8C342.1,208.4 345.9,209.7 358.8,219.8C361.2,221.7 363.9,223.7 364.8,224.2C365.6,224.7 368.3,226.6 370.8,228.5C380.7,235.8 383.2,236.1 390.0,230.6C400.0,222.5 405.1,214.8 413.3,195.1C414.6,192.1 418.1,199.7 421.7,213.2C422.4,216.0 423.4,219.4 423.8,220.8C425.9,228.1 426.7,274.1 424.9,285.0C424.1,290.1 420.9,302.6 419.8,305.5C419.4,306.5 418.4,309.5 417.5,312.2C416.7,315.0 414.9,319.4 413.6,322.0C410.6,328.1 409.7,328.4 407.6,324.2ZM305.1,234.8C300.4,231.7 293.7,226.6 289.6,223.3C286.0,220.2 278.4,214.2 273.8,210.5C272.4,209.5 269.6,207.2 267.5,205.6C265.4,203.9 261.9,201.2 259.8,199.5C257.6,197.8 254.8,195.7 253.8,194.8C252.7,193.9 249.3,191.3 246.2,189.0C243.2,186.7 236.9,181.8 232.3,178.0C221.9,169.7 220.0,168.2 217.3,166.2C216.1,165.4 213.6,163.5 211.6,161.9C209.7,160.4 207.5,158.7 206.7,158.2C205.9,157.7 204.2,156.4 203.0,155.4C201.7,154.3 199.0,152.2 196.9,150.6C180.9,138.5 167.8,125.2 163.9,117.2C161.7,112.8 163.6,111.2 181.5,102.2C191.8,97.1 203.9,92.6 212.2,90.8C214.4,90.3 217.5,89.6 219.0,89.3C226.6,87.4 228.8,87.2 256.5,87.3C283.3,87.3 283.8,87.3 288.8,88.4C296.2,90.2 297.0,90.4 300.0,91.0C303.4,91.6 310.2,94.3 311.1,95.3C311.8,96.2 310.0,100.3 307.5,103.3C303.7,107.9 301.1,111.7 295.6,121.2C284.8,140.0 284.7,162.0 295.5,174.9C301.2,181.8 306.1,185.8 314.5,190.6C319.6,193.5 323.5,199.3 324.3,205.2C325.3,212.1 313.2,237.1 309.1,237.0C308.6,236.9 306.9,236.0 305.1,234.8Z';
function markSVG(cls) {
  return '<svg class="' + cls + '" viewBox="0 0 512 512" aria-hidden="true">' +
    '<rect width="512" height="512" rx="112" fill="var(--brand-fill)"/>' +
    '<g transform="translate(256 256) scale(.88) translate(-255.5 -255.5)"><path fill="#fff" d="' + EMBLEM_D + '"/></g></svg>';
}

function renderShell() {
  // המשניים נצבעים גם הם, ומוצגים רק במסך רחב — שם «עוד» נעלם והסרגל פורס את כל המסכים.
  var tabsHTML = TABS.concat(MORE).map(function (t) {
    var cls = (state.screen === t.id ? 'on' : '') + (inMore(t.id) ? ' wide-only' : '');
    return '<button data-act="tab" data-tab="' + t.id + '" class="' + cls.trim() + '">' +
      '<span class="ic">' + icon(t.ic) + '</span><span>' + t.label + '</span></button>';
  }).join('') +
    '<button data-act="more" class="narrow-only' + (inMore(state.screen) ? ' on' : '') + '" aria-haspopup="dialog">' +
      '<span class="ic">' + icon('more') + '</span><span>עוד</span></button>';
  var t = tabOf(state.screen);

  shellBare(false);
  $('header.topbar').innerHTML =
      '<div class="brand">' + markSVG('') + '<span class="brand-t"><small>גיוס</small>' + esc(t.title || t.label) + '</span></div>' +
      '<nav class="tabbar">' + tabsHTML + '</nav>';
  var fab = $('#app > .fab'), act = FAB_ACT[state.screen];
  if (!act) { if (fab) fab.remove(); return; }
  if (!fab) { $('#app').insertAdjacentHTML('beforeend', '<button class="fab" aria-label="הוספה">' + icon('plus') + '</button>'); fab = $('#app > .fab'); }
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
  if (screen === 'dash') { state.month = m; state.dashPayAll = false; }
  if (screen === 'plan') state.planMonth = m;
  if (screen === 'cards') state.cards = { q: '', aff: '', pf: '', sort: 'sum', open: null, plOpen: null };
  if (screen === 'loans') { state.loansSort = 'name'; state.loansQ = ''; state.loansStatus = ''; state.loansOpen = null; }
  if (screen === 'budget') state.budgetOpen = null;
  if (screen === 'tasks') { state.tasks_ui.stage = null; state.tasks_ui.q = ''; }
  closeModal();
  render();
}

// החיפוש מצייר את גוף המסך בלבד — ציור מלא היה מחליף את השדה ומפיל את המקלדת באמצע ההקלדה.
function tasksRefresh() {
  var box = $('#tasks-body');
  if (box) box.innerHTML = tasksBodyHTML(); else render();
}

function loansRefresh() {
  var box = $('#loans-list');
  if (box) box.innerHTML = loansBodyHTML(); else render();
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
  'month': function (el) { state.month = shiftMonth(state.month, +el.dataset.d); state.dashPayAll = false; render(); },
  'dash-pay-all': function () { state.dashPayAll = !state.dashPayAll; render(); },
  'dash-who': function (el) { go('tasks'); state.tasks_ui.who = el.dataset.who; render(); },
  'card-go': function (el) { go('cards'); state.cards.open = el.dataset.id; render(); },

  // ── כרטיסים ──
  'cards-sort': function (el) { state.cards.sort = el.dataset.v; render(); },
  'card-toggle': function (el) {
    state.cards.open = state.cards.open === el.dataset.id ? null : el.dataset.id;
    state.cards.plOpen = null;
    cardsRefresh();
  },
  'pledge-toggle': function (el) {
    state.cards.plOpen = state.cards.plOpen === el.dataset.id ? null : el.dataset.id;
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
  'pay-new': function (el) { formPay(null, el.dataset.pledge, el.dataset.donor); },
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
  'task-star': function (el) {
    var t = findIn(state.tasks, el.dataset.id);
    if (!t) return;
    return update('g_tasks', t.client_id, { starred: !t.starred }).then(function () { render(); }).catch(errToast);
  },
  'task-save': saver(saveTask, 'המשימה נשמרה'),
  'task-del': function (el) { return delAsk(MSG_DEL_TASK, 'g_tasks', el.dataset.id); },

  // ── רשומות · הלוואות · תקציב ──
  'note-new': function () { formNote(null); },
  'note-edit': function (el) { var n = findIn(state.notes, el.dataset.id); if (n) formNote(n); },
  'note-close': function () { return runSave(function () { return closeNoteFull(true); }, 'נשמר'); },
  'note-del': function (el) { return delAsk(MSG_DEL_NOTE, 'g_notes', el.dataset.id, function () { closeNoteFull(false); }); },
  'loan-new': function () { formLoan(null); },
  'loans-sort': function (el) { state.loansSort = el.dataset.v; render(); },
  'loan-edit': function (el) { var l = findIn(state.loans, el.dataset.id); if (l) formLoan(l); },
  'loan-save': saver(saveLoan, 'נשמר'),
  'loan-del': function (el) {
    return delAsk(MSG_DEL_LOAN, 'g_loans', el.dataset.id, function () { if (state.loansOpen === el.dataset.id) state.loansOpen = null; });
  },
  'loan-toggle': function (el) { state.loansOpen = state.loansOpen === el.dataset.id ? null : el.dataset.id; render(); },
  'loan-move-add': function (el) { return runSave(function () { return addLoanMove(el.dataset.id); }, 'נשמר'); },
  'loan-move-edit': function (el) { var m = findIn(state.loanMoves, el.dataset.id); if (m) formLoanMove(m); },
  'loan-move-save': saver(saveLoanMove, 'נשמר'),
  'loan-move-del': function (el) { return delAsk(MSG_DEL_LOAN_MOVE, 'g_loan_moves', el.dataset.id); },
  'event-new': function () { formEvent(null); },
  'event-edit': function (el) { var e = findIn(state.events, el.dataset.id); if (e) formEvent(e); },
  'event-save': saver(saveEvent, 'נשמר'),
  'event-del': function (el) {
    return delAsk(MSG_DEL_EVENT, 'g_events', el.dataset.id, function () { if (state.budgetOpen === el.dataset.id) state.budgetOpen = null; });
  },
  'event-toggle': function (el) { state.budgetOpen = state.budgetOpen === el.dataset.id ? null : el.dataset.id; render(); },
  'budget-new': function (el) { formBudget(null, el.dataset.event); },
  'budget-edit': function (el) { var b = findIn(state.budget, el.dataset.id); if (b) formBudget(b); },
  'budget-save': function (el) { return runSave(function () { return saveBudget(el.dataset.id, el.dataset.event); }, 'נשמר'); },
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
  if (el.dataset.inp === 'loans-q') { state.loansQ = el.value; loansRefresh(); }
  if (el.dataset.inp === 'tasks-q') { state.tasks_ui.q = el.value; tasksRefresh(); }
  if (el.dataset.inp === 'pay-so') soSync();
});

document.addEventListener('note-close', function () { DOM_ACTIONS['note-close'](); });
document.addEventListener('change', function (e) {
  var el = e.target;
  if (!el.dataset) return;
  if (el.dataset.chg === 'cards-aff') { state.cards.aff = el.value; cardsRefresh(); return; }
  if (el.dataset.chg === 'loans-status') { state.loansStatus = el.value; loansRefresh(); return; }
  if (el.dataset.chg === 'cards-pf') { state.cards.pf = el.value; cardsRefresh(); return; }
  if (el.dataset.chg === 'p-now') { var nb = $('#p-now-box'); if (nb) nb.hidden = !el.checked; return; }
  if (el.dataset.chg === 'p-init') { initSwitchChange(el); return; }
  if (el.dataset.chg === 'note-color') { noteColorPick(el.value); return; }
  // תאריך שנבחר מעביר את החודש אחריו — שני שדות שסותרים זה את זה היו נשמרים בשקט.
  if (el.dataset.chg === 'pay-method') { soToggle(el.value); return; }
  if (el.dataset.chg === 'when-date') {
    var mInp = document.getElementById(el.dataset.m);
    if (mInp && el.value) mInp.value = monthKeyOf(el.value);
    return;
  }
  // שייכות — בטופס הכרטיס; נשמרת עם השמירה.
  if (el.dataset.chg === 'aff-pick') { var ch = el.closest('.chip'); if (ch) ch.classList.toggle('on', el.checked); return; }
  if (el.dataset.chg === 'pay-pledge') { payPledgePick(el); return; }
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
