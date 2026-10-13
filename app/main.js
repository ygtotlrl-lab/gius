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
         dragCancel, dragDown, dragMove, dragUp, esc, openModal, shellBare, swApply, swHideUpdate,
         toast, uiNoDialog } from '../core/ui.js';
import { KV_TABLE, MSG_DELETE_ACT, MSG_DEL_DONOR_LINKED, MSG_DEL_DONOR_TITLE,
         MSG_DEL_MANAGER_BODY, MSG_DEL_MANAGER_TITLE, MSG_DEL_PLEDGE_BODY, MSG_DEL_PLEDGE_TITLE,
         MSG_DEL_QUOTE_POST, MSG_DEL_QUOTE_PRE, MSG_DEL_TASK_BODY, MSG_DEL_TASK_TITLE,
         MSG_DEL_TXN_BODY, MSG_DEL_TXN_TITLE, MSG_EDIT_VALUE, MSG_MANAGER_DUP, MSG_MANAGER_NEW,
         MSG_NEED_MANAGER, MSG_NEED_VALUE, MSG_NOTES_SAVED, MSG_REMOVE_ACT, MSG_REMOVE_QUOTE_POST,
         MSG_REMOVE_QUOTE_PRE, MSG_REMOVE_VALUE_TITLE, MSG_VALUE_EXISTS2,
         MSG_WHAT_TO_ADD, PUSH_TABLES, SUPABASE_ANON_KEY, SUPABASE_URL,
         TABLES } from './constants.js';
import { KDRAG, S, shell, state } from './state.js';
import { $, applyMirrorToState, donorById, donorMatches,
         donorNewCancel, donorNewSave, lookupById, lookupPut, lookupRows, mirrorHasData,
         monthKeyOf, pendRowKey, pledgeById, pledgesOfDonor, rowPendingKey,
         saveConfigList, shiftMonth, softDelete, stripRows, syncNow, tableMeta,
         txnsOfDonor, update, val, viewBare } from './domain.js';
import { donorRowsHTML, formDonor, formTxn, saveDonor, saveTxn, viewDonorCard,
         viewDonors } from './screens/donors.js';
import { viewHome } from './screens/home.js';
import { formPledge, refreshPledges, savePledge,
         viewPledges } from './screens/pledges.js';
import { formTarget, lookupFootHTML, lookupFormHTML, saveTarget,
         viewSettings } from './screens/settings.js';
import { formTask, kdragCol, moveTask, saveTask, viewTasks } from './screens/tasks.js';

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
      { name: 'g_donors',  order: 'client_id', ts: 'updated_at' },
      { name: 'g_pledges', order: 'client_id', ts: 'updated_at' },
      { name: 'g_txns',    order: 'client_id', ts: 'updated_at' },
      { name: 'g_tasks',   order: 'client_id', ts: 'updated_at' },
      { name: 'g_targets', order: 'client_id', ts: 'updated_at' },
      { name: KV_TABLE,    order: 'key',       ts: 'updated_at' },
      { name: 'g_lookups', order: 'client_id', ts: 'updated_at' }
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

var TABS = [
  { id: 'home', ic: '🏠', label: 'בית' },
  { id: 'donors', ic: '🙋', label: 'תורמים' },
  { id: 'pledges', ic: '🤝', label: 'התחייבויות' },
  { id: 'tasks', ic: '🗂️', label: 'משימות' },
  { id: 'settings', ic: '⚙️', label: 'הגדרות' }
];

function markSVG(cls) {
  return '<svg class="' + cls + '" viewBox="0 0 100 100" aria-hidden="true">' +
    '<rect x="2" y="2" width="96" height="96" rx="24" fill="var(--brand-fill)"/>' +
    '<circle cx="50" cy="50" r="26" fill="none" stroke="#fff" stroke-width="8"/>' +
    '<circle cx="50" cy="50" r="10" fill="#fff"/></svg>';
}

function renderShell() {
  var tabsHTML = TABS.map(function (t) {
    return '<button data-act="tab" data-tab="' + t.id + '" class="' + (state.screen === t.id ? 'on' : '') + '">' +
      '<span class="ic">' + t.ic + '</span><span>' + t.label + '</span></button>';
  }).join('');

  shellBare(false);
  $('header.topbar').innerHTML =
      '<div class="brand">' + markSVG('') + '<span>גיוס<small> · ניהול גיוס כספים</small></span></div>' +
      '<nav class="tabbar">' + tabsHTML + '</nav>';
  // הכפתור הצף אינו בקליפה — מסך ההגדרות בלעדיו.
  var fab = $('#app > .fab');
  if (state.screen === 'settings') { if (fab) fab.remove(); }
  else if (!fab) $('#app').insertAdjacentHTML('beforeend', '<button class="fab" data-act="fab" aria-label="הוספה">＋</button>');
}

function render() {
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

function go(screen) {
  state.screen = screen;
  state.donorId = null;
  // הבית נפתח בחודש של היום — אחרת מי שחוזר לבית רואה יעד של חודש שדופדף אליו.
  if (screen === 'home') state.month = monthKeyOf(dayToday());
  render();
}

// הקנבן אינו הגרירה לסידור שבליבה — הכרטיס אינו זז בעץ, והשחרור מעביר אותו לשלב שב-data-drop של העמודה שמתחתיו, ולא לסדר שנקרא מה-DOM.
// כל גרירה אחרת — רשימת המנהלים — עוברת במנגנון שבליבה, ומאזין אחד לכל אירוע מכריע ביניהן.
document.addEventListener('pointerdown', function (e) {
  var g = e.target && e.target.closest ? e.target.closest('[data-grip]') : null;
  if (!g) return;
  var el = g.closest('[data-drag]');
  if (!el) return;
  if (el.getAttribute('data-drag') !== 'task') { dragDown(e); return; }
  KDRAG.el = el;
  KDRAG.col = null;
  KDRAG.el.classList.add('dragging');
  // המצביע נלכד על הידית — בלעדיו אצבע שיוצאת מגבול הכרטיס מפסיקה לשדר והגרירה נתקעת.
  try { g.setPointerCapture(e.pointerId); } catch (e1) {}
  e.preventDefault();
});

document.addEventListener('pointermove', function (e) {
  if (!KDRAG.el) { dragMove(e); return; }
  e.preventDefault();
  var col = kdragCol(e.clientX, e.clientY);
  if (col === KDRAG.col) return;
  if (KDRAG.col) KDRAG.col.classList.remove('over');
  KDRAG.col = col;
  if (col) col.classList.add('over');
});

document.addEventListener('pointerup', function (e) {
  if (!KDRAG.el) { dragUp(e); return; }
  var el = KDRAG.el, col = kdragCol(e.clientX, e.clientY);
  if (KDRAG.col) KDRAG.col.classList.remove('over');
  KDRAG.el = null; KDRAG.col = null;
  el.classList.remove('dragging');
  if (col && col.dataset.drop) moveTask(el.dataset.id, col.dataset.drop);
});

// גרירה שבוטלה אינה מעבירה — בלי זה הכרטיס נשאר «נגרר», והשחרור הבא בכל מקום היה מעביר אותו.
document.addEventListener('pointercancel', function (e) {
  if (!KDRAG.el) { dragCancel(e); return; }
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
  'tab': function (el) { go(el.dataset.tab); },
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

  // ── הגדרות: מנהלים ──
  'look-add': function (el) {
    openModal(MSG_MANAGER_NEW, lookupFormHTML(null), lookupFootHTML(null, el.dataset.id));
    var inp = $('#l-label'); if (inp) inp.focus();
  },
  'look-edit': function (el) {
    var r = lookupById(el.dataset.id);
    if (!r) { uiNoDialog('look-edit', el.dataset.id); return; }
    openModal(r.label, lookupFormHTML(r), lookupFootHTML(r, r.kind));
  },
  'look-save': function (el) {
    var inp = $('#l-label');
    if (!inp) { uiNoDialog('look-save', 'l-label'); return; }
    var txt = inp.value.trim(), id = el.dataset.id, kind = el.dataset.k;
    if (!txt) { toast(MSG_NEED_MANAGER, null, 'bad'); return; }
    // השורה שנערכת מוחרגת מהבדיקה — אחרת היא מתנגשת בעצמה.
    var others = lookupRows(kind).filter(function (x) { return !idEq(x.client_id, id); })
      .map(function (x) { return x.label; });
    if (uniqHas(others, txt)) { toast(MSG_MANAGER_DUP, null, 'bad'); return; }
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
    return ask(MSG_DEL_MANAGER_TITLE, MSG_DEL_MANAGER_BODY, MSG_DELETE_ACT).then(function (yes) {
      if (!yes) return;
      // המחיקה סימון וחותמת על אותה שורה — tombKill חותם את deleted_at ברגע ה-updated_at שלה.
      lookupPut(tombKill(Object.assign({}, r)));
      return afterSave('נמחק');
    });
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
  'combo-pick':        function (el) { return comboPick(el); },
  'combo-make':        function (el) { return comboMake(el); },
  'donor-new-cancel':  function (el) { donorNewCancel(el.dataset.id); },
  'donor-new-save':    function (el) { return donorNewSave(el.dataset.id); },
};

// ── מאזינים גלובליים ──
actWire(DOM_ACTIONS);


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
  state.month = monthKeyOf(dayToday());
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
