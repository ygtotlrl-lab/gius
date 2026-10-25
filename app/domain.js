// app/domain.js — הסנכרון, הכתיבה המקומית, הנגזרות ורכיבי הממשק
import { DAY_MONTHS, MSG_LOAD_FAIL_PRE, MSG_SYNC_BACK, dayNoon, sortCompare } from '../core/util.js';
import { PL_STAMP_KEY, _rowsPaged, ctxEpoch, ctxStale, errToast, idEq, mergeCore,
         newClientId, pendAll, pendClearMany, pendHas, pendMark, pendMarkMany, pendRender,
         pushDirty, schedulePush, tombInherit, tombKill } from '../core/sync.js';
import { MSG_LS_FULL } from '../core/storage.js';
import { MIRROR, mirrorSave } from '../core/mirror.js';
import { logAction } from '../core/backup.js';
import { comboDef, comboHTML, comboSet, esc, lookupList, pullRender, shellBare, toast } from '../core/ui.js';
import { DONOR_NEW_LABEL, DONOR_NO_PHONE, EPS, KV_TABLE, LISTS,
         MSG_DONOR_CREATED, MSG_MAYBE_STALE, MSG_NEED_NAME, TABLES } from './constants.js';
import { S, shell, state } from './state.js';

// ── סימוני ממתין ──
// אין תור — האישור מגיע מ-pendClear על upsert מוצלח ומ-pendReconcile אחרי משיכה שהצליחה.
function pendRowKey(table, id) { return table + ':' + id; }

// ── עוזרים כלליים ──
function $(sel, root) { return (root || document).querySelector(sel); }

function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, ''));
  return isFinite(n) ? n : 0;
}

function sum(arr, pick) {
  var t = 0;
  for (var i = 0; i < arr.length; i++) t += num(pick ? pick(arr[i]) : arr[i]);
  return t;
}

// המעצב נוצר פעם אחת — ils נקראת עשרות פעמים בכל רינדור, ובניית NumberFormat יקרה מהעיצוב עצמו.
var ilsFmt = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });

function ils(n) { return ilsFmt.format(Math.round(num(n))); }

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function nowISO() { return new Date().toISOString(); }

function monthKeyOf(iso) { return String(iso || '').slice(0, 7); }

// מחזיר dd.mm.yyyy לועזי — ואינו מנוע התאריך העברי.
function dmyDate(iso) {
  if (!iso) return '—';
  var p = String(iso).slice(0, 10).split('-');
  if (p.length !== 3) return String(iso);
  return p[2] + '.' + p[1] + '.' + p[0];
}

function monthLabel(m) {
  var p = String(m || '').split('-');
  if (p.length !== 2) return String(m || '');
  return (DAY_MONTHS[+p[1] - 1] || '') + ' ' + p[0];
}

function shiftMonth(m, delta) {
  var p = m.split('-');
  var d = dayNoon(+p[0], +p[1] - 1 + delta, 1);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}

function initials(name) {
  var parts = String(name || '?').trim().split(/\s+/);
  return (parts[0] || '?').charAt(0) + (parts[1] ? parts[1].charAt(0) : '');
}

// ── המיונים — פונקציה אחת לכל סוג רשומות ──
function bySort(a, b) {
  return ((+a.sort || 0) - (+b.sort || 0)) || sortCompare(String(a.created_at || ''), String(b.created_at || ''));
}

// כרטיסים — לפי א״ב, או לפי היתרה מהגבוהה לנמוכה ובשוויון לפי א״ב.
function gSortDonors(list, mode) {
  return list.slice().sort(function (a, b) {
    if (mode === 'left') {
      var d = donorLeft(b.client_id) - donorLeft(a.client_id);
      if (Math.abs(d) > EPS) return d;
    }
    return sortCompare(a.name || '', b.name || '');
  });
}

// שמות — בסדר הא״ב.
function gSortNames(list) {
  return list.slice().sort(function (a, b) { return sortCompare(a, b); });
}

// תשלומים — החדש ראשון.
function gSortTxns(list) {
  return list.slice().sort(function (a, b) {
    return sortCompare(b.txn_month || '', a.txn_month || '') || sortCompare(b.txn_date || '', a.txn_date || '');
  });
}

// התחייבויות — בסדר הרישום.
function gSortPledges(list) {
  return list.slice().sort(function (a, b) {
    return sortCompare(String(a.created_at || ''), String(b.created_at || ''));
  });
}

// שורות תכנית — הרלוונטיות למעלה בסדר הרישום, ו«לא רלוונטי» למטה.
function gSortPlan(list) {
  return list.slice().sort(function (a, b) { return ((a.irrelevant ? 1 : 0) - (b.irrelevant ? 1 : 0)) || bySort(a, b); });
}

// משימות, פתקים והוצאות — בסדר שנקבע, ובשוויון בסדר הרישום.
function gSortTasks(list) { return list.slice().sort(bySort); }

function gSortNotes(list) { return list.slice().sort(bySort); }

function gSortBudget(list) { return list.slice().sort(bySort); }

// הלוואות — לפי שם המלווה.
function gSortLoans(list) {
  return list.slice().sort(function (a, b) { return sortCompare(a.lender || '', b.lender || ''); });
}

// קבוצות הפילוח — הסכום הגדול ראשון.
function gSortGroups(list) { return list.slice().sort(function (a, b) { return b.total - a.total; }); }

function uniqSorted(list) {
  var seen = {}, out = [];
  for (var i = 0; i < list.length; i++) {
    var v = String(list[i] == null ? '' : list[i]).trim();
    if (!v || seen[v]) continue;
    seen[v] = 1; out.push(v);
  }
  return gSortNames(out);
}

// ── עבודה אופליין — מראה, סנכרון ומיזוג ──
// המראה כוללת מחוקים והסינון יושב ב-liveRows ולא בשאילתה — בלעדיהם מחיקה ממכשיר אחר לא מגיעה לכאן.
// רשומה שנמחקה פיזית במסד תחזור פעם אחת מהמראה — מחיר מודע, ול-anon אין הרשאת DELETE.

// supabase-js אינו זורק בכשל — ok הופך error לזריקה, ולכן כל .then(ok) חייב להישאר.
function ok(res) {
  if (res && res.error) throw res.error;
  return res ? res.data : null;
}

function tableMeta(t) {
  for (var i = 0; i < TABLES.length; i++) if (TABLES[i].t === t) return TABLES[i];
  return { t: t, key: 'client_id', soft: false };
}

// ── מזהים ──
// המזהה נוצר בצד הלקוח כדי שהכתיבה תעבוד בלי רשת — המחולל הוא newClientId, ואין לצידו מחולל מקומי.

// ── המראה ──
// המראה היא העותק המלא כולל tombstones, ולא מטמון מהירות.

// strip נאכף בשלוש נקודות — משיכה, upsertLocal ו-mirrorSave: כתיבה מקומית עוקפת את המשיכה, ושער הדיסק עוצר נתיב חדש שידליף.
function stripCols(t, row) {
  var m = tableMeta(t);
  if (!m.strip || !row || typeof row !== 'object') return row;
  var c = Object.assign({}, row);
  m.strip.forEach(function (f) { delete c[f]; });
  return c;
}

function stripRows(t, rows) {
  var m = tableMeta(t);
  // שורת החותמת אינה יורדת למראה — שורה במראה נדחפת חזרה, והמכשיר היה כותב לענן חותמת ישנה ומשתיק שינוי אמיתי.
  if (t === KV_TABLE) rows = (rows || []).filter(function (r) { return !(r && String(r.key) === PL_STAMP_KEY); });
  if (!m.strip) return rows;
  return (rows || []).map(function (r) { return stripCols(t, r); });
}

function mirrorHasData() {
  for (var i = 0; i < TABLES.length; i++) if ((MIRROR[TABLES[i].t] || []).length) return true;
  return false;
}

function findRow(arr, keyName, k) {
  for (var i = 0; i < arr.length; i++) if (String(arr[i][keyName]) === String(k)) return arr[i];
  return null;
}

function liveRows(t) {
  var m = tableMeta(t), arr = MIRROR[t] || [];
  return m.soft ? arr.filter(function (r) { return !r.deleted; }) : arr.slice();
}

function applyMirrorToState() {
  state.donors  = liveRows('g_donors');
  state.pledges = liveRows('g_pledges');
  state.txns    = liveRows('g_txns');
  state.plan    = liveRows('g_plan_items');
  state.tasks   = liveRows('g_tasks');
  state.targets = liveRows('g_targets');
  state.notes   = liveRows('g_notes');
  state.loans   = liveRows('g_loans');
  state.budget  = liveRows('g_budget_items');
}

// ── כתיבה מקומית ──

// הכתיבה המקומית זורקת בכשל — אחסון מלא פירושו שהפעולה לא תגיע לענן, ואסור שמשהו יתנהג כאילו נשמר.
function markLocal(table, id) {
  if (!mirrorSave(table)) throw new Error(MSG_LS_FULL);
  if (!pendMark(pendRowKey(table, id))) throw new Error(MSG_LS_FULL);
  schedulePush();
}

// ── API כתיבה ──
function upsertLocal(t, row) {
  var m = tableMeta(t);
  var arr = MIRROR[t] || (MIRROR[t] = []);
  // הסינון קודם לכתיבה לזיכרון — כדי שהסוד לא יישב ב-MIRROR אפילו לרגע.
  row = stripCols(t, row);
  var cur = findRow(arr, m.key, row[m.key]);
  if (cur) Object.keys(row).forEach(function (k) { cur[k] = row[k]; });
  else arr.push(row);
  mirrorSave(t);
  return cur || row;
}

function insert(table, row) {
  var m = tableMeta(table);
  var full = Object.assign({}, row);
  if (full[m.key] == null) full[m.key] = newClientId();
  if (!full.created_at) full.created_at = nowISO();
  full.updated_at = Date.now();
  if (m.soft) { if (full.deleted == null) full.deleted = false; if (full.deleted_at === undefined) full.deleted_at = null; }
  // insert נשלח כ-upsert על המפתח הראשי — ניסיון חוזר אחרי תשובה שאבדה אינו נכשל על מפתח כפול.
  var saved = upsertLocal(table, full);
  markLocal(table, full[m.key]);
  applyMirrorToState();
  return Promise.resolve(saved);
}

function update(table, id, patch) {
  var m = tableMeta(table);
  var p = Object.assign({}, patch, { updated_at: Date.now() });
  var row = Object.assign({}, p);
  row[m.key] = id;
  var saved = upsertLocal(table, row);
  markLocal(table, id);
  applyMirrorToState();
  return Promise.resolve(saved);
}

// לתשלום שני אבות — הכרטיס וההתחייבות, ושניהם חובה; הכרטיס נשאל ראשון: מחיקתו מפילה את התשלום בכל מקרה.
// donor_client_id בתשלום — עמודת הסינון של האב בשרת, ומוצהרת: התשלום שייך לכרטיס דרך ההתחייבות.
var PC_CHILDREN = {
  g_donors: [{ t: 'g_pledges', fk: 'donor_client_id' }, { t: 'g_txns', fk: 'donor_client_id' },
             { t: 'g_plan_items', fk: 'donor_client_id' }],
  g_pledges: [{ t: 'g_txns', fk: 'pledge_client_id' }]
};

// הכתיבה לבנים עוברת ב-upsertLocal ולא ב-update — update חותם Date.now() ומבטל את ירושת החותמת.
function pcCascadeDelete(table, parent) {
  var kids = PC_CHILDREN[table] || [], pid = parent[tableMeta(table).key], n = 0;
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i], km = tableMeta(k.t), arr = MIRROR[k.t] || [];
    for (var j = 0; j < arr.length; j++) {
      if (arr[j].deleted || !idEq(arr[j][k.fk], pid)) continue;
      var kid = tombInherit(parent, Object.assign({}, arr[j]));
      upsertLocal(k.t, kid);
      markLocal(k.t, kid[km.key]);
      n++;
    }
  }
  if (n) applyMirrorToState();
  return n;
}

// לא דרך update — הוא חותם Date.now() משלו, ו-deleted_at היה נבדל מ-updated_at של המחיקה.
function softDelete(table, id) {
  var row = tombKill({});
  row[tableMeta(table).key] = id;
  var saved = upsertLocal(table, row);
  markLocal(table, id);
  pcCascadeDelete(table, saved);
  applyMirrorToState();
  return Promise.resolve(saved);
}

// השורה נושאת את מפתח המיזוג — מזהה שנגזר מהמפתח הטבעי, או key בטבלת ההגדרות.
function upsertBy(table, row) {
  var m = tableMeta(table);
  var full = Object.assign({}, row, { updated_at: Date.now() });
  var arr = MIRROR[table] || (MIRROR[table] = []);
  var cur = findRow(arr, m.key, full[m.key]);
  if (cur) Object.keys(full).forEach(function (k) { cur[k] = full[k]; });
  else arr.push(full);
  markLocal(table, full[m.key]);
  applyMirrorToState();
  return Promise.resolve(cur || full);
}

// ── הרשימות — g_lookups ──
// הכתיבה של LOOKUP_CFG — השורה כבר נושאת את חותמתה (הזריעה והסידור שבליבה חותמים), ולכן לא דרך update.
function lookupPut(row) {
  var full = Object.assign({}, row);
  if (full.updated_at == null) full.updated_at = Date.now();
  upsertLocal('g_lookups', full);
  markLocal('g_lookups', full.client_id);
  applyMirrorToState();
}

// פריטי סוג אחד — בסדר הגרירה, ובשוויון לפי התווית.
function lookupRows(kind) {
  return liveRows('g_lookups').filter(function (r) { return r.kind === kind; }).sort(function (a, b) {
    return ((+a.sort || 0) - (+b.sort || 0)) || sortCompare(a.label || '', b.label || '');
  });
}

function lookupById(id) {
  var l = liveRows('g_lookups');
  for (var i = 0; i < l.length; i++) if (idEq(l[i].client_id, id)) return l[i];
  return null;
}

// תוויות הרשימה — מהטבלה, ובהתקנה טרייה מנקודת הפתיחה שבקבועים.
function listDef(kind) {
  for (var i = 0; i < LISTS.length; i++) if (LISTS[i].kind === kind) return LISTS[i];
  return null;
}

function lookupLabels(kind) { var d = listDef(kind); return lookupList(kind, d ? d.dflt : []); }

// ── דחיפת-מצב ──
// דחיפת-מצב ולא תור יוצא — בתור, כשל תוכן אחד חוסם את כל מה שאחריו; כאן כל רשומה עומדת בפני עצמה.
function rowPendingKey(t, row) { return pendRowKey(t, row[tableMeta(t).key]); }

// ── משיכה ──
// מחזירה {ok} — משיכה שנכשלה עוצרת את הדחיפה שאחריה, כי אין ראיה על מצב הענן.
function syncPull() {
  if (S._pulling || !S.sb) return Promise.resolve({ ok: false, remote: {} });
  S._pulling = true;
  // ההקשר נלכד בכניסה לפונקציה ונבדק לפני המיזוג — עידן שנזרק בין המשיכה לכתיבה מבטל את המחזור.
  var _ep = ctxEpoch();
  return Promise.all(TABLES.map(function (m) {
    // בלי סינון deleted — בלי ה-tombstones מחיקה ממכשיר אחר לא תגיע לכאן לעולם.
    // העימוד חובה: select('*') בבקשה אחת נחתך בשקט בתקרת db-max-rows.
    return _rowsPaged(function () {
      return S.sb.from(m.t).select('*');
    }, m.key, null)
      .then(function (rows) { return { m: m, res: rows ? { data: rows, error: null }
                                                       : { data: null, error: { message: 'rows:' + m.t } } }; },
            function (e) { return { m: m, res: { error: e } }; });
  })).then(function (list) {
    if (ctxStale(_ep)) return { ok: false };
    var errs = [];
    list.forEach(function (x) {
      if (!x.res || x.res.error || !Array.isArray(x.res.data)) { errs.push(x.m.t); return; }
      var rows = stripRows(x.m.t, x.res.data);
      var merged = mergeCore(MIRROR[x.m.t], rows, { key: x.m.key,
        isPending: function (k) { return pendHas(pendRowKey(x.m.t, k)); } });
      MIRROR[x.m.t] = merged; mirrorSave(x.m.t);
    });
    applyMirrorToState();
    if (!errs.length) {
      S._lastPullOk = Date.now();
      // הגיבוי היומי ותור היומן אינם תלויים במשיכה שהצליחה — אחרת כל יום בלי סנכרון מדולג.
      if (!S._gPullLogged) { S._gPullLogged = true; gSyncLog('pull', null, null); }
      if (S._netWarned) { S._netWarned = false; toast(MSG_SYNC_BACK, null, 'good'); }
    } else {
      console.warn('[sync] נכשלו:', errs.join(', '));
      if (!S._netWarned) {
        S._netWarned = true;
        toast(MSG_LOAD_FAIL_PRE + errs.join(', ') + MSG_MAYBE_STALE, null, 'bad');
      }
    }
    return { ok: !errs.length };
  }).catch(function (e) {
    console.warn('[sync]', e);
    return { ok: false };
  }).then(function (r) { S._pulling = false; pendRender(); return r; });
}

// משיכה קודמת לדחיפה — בלי מצב הענן אין לדעת מה מקומי וחדש יותר, ודחיפה עיוורת מחייה רשומה שנמחקה במכשיר אחר.
// אין לרשום כל מחזור סנכרון — הבדיקה המחזורית רצה כל שלוש שניות, ו-sh_sync_log היא insert בלבד ואי-אפשר לדלל אותה.
function gSyncLog(action, key, recordCount, details) {
  try { logAction(action, key, recordCount, details); } catch (e) { }
}

function syncNow() {
  var t0 = Date.now();
  // הדחיפה נבדקת מול ההקשר שנלכד לפני המשיכה.
  var _ep = ctxEpoch();
  return syncPull().then(function (res) {
    if (!res.ok || ctxStale(_ep)) { pullRender(shell.render); return false; }
    // שער הרשת כאן ולא בשכבת הדחיפה — הוא תלוי בלקוח.
    var p = (!S.sb || !navigator.onLine) ? Promise.resolve({ still: [] })
                                       : pushDirty(null);
    return p.then(function (r) {
      if (ctxStale(_ep)) { pullRender(shell.render); return false; }
      pendReconcile(r.still, t0);
      if (r && r.n) gSyncLog('push', null, r.n);
      pullRender(shell.render);
      return true;
    });
  });
}

// הסימונים מחושבים מחדש רק אחרי משיכה שהצליחה; מה שנכתב אחרי t0 לא נבדק מול הענן ולכן אינו מנוקה.
function pendReconcile(still, t0) {
  var want = {};
  (still || []).forEach(function (k) { want[k] = 1; });
  pendMarkMany(Object.keys(want));
  var m = pendAll(), gone = [];
  Object.keys(m).forEach(function (k) { if (!want[k] && m[k] < t0) gone.push(k); });
  pendClearMany(gone);
}

// ── נגזרות ──
// כל סכום מחושב בכל קריאה מ-state.txns — סכום שמור מתיישן בכל תשלום שנרשם במכשיר אחר.
function byId(list, id) {
  for (var i = 0; i < list.length; i++) if (idEq(list[i].client_id, id)) return list[i];
  return null;
}

function donorById(id) { return byId(state.donors, id); }

function pledgeById(id) { return byId(state.pledges, id); }

// מציין מקום ולא מחרוזת ריקה — שורה בלי שם נראית כבאג ומסתירה שהכסף עדיין רשום ומחושב.
function donorName(id) { var d = donorById(id); return d ? d.name : '— כרטיס שנמחק —'; }

function pledgesOfDonor(id) { return state.pledges.filter(function (p) { return idEq(p.donor_client_id, id); }); }

function txnsOfPledge(id) { return state.txns.filter(function (t) { return idEq(t.pledge_client_id, id); }); }

function txnsOfDonor(id) { return state.txns.filter(function (t) { return idEq(t.donor_client_id, id); }); }

function collectedForPledge(id) { return sum(txnsOfPledge(id), function (t) { return t.amount; }); }

function leftForPledge(p) { return Math.max(0, num(p.amount) - collectedForPledge(p.client_id)); }

// הסכומים numeric(14,2) חוזרים כ-float — בלי EPS התחייבות שנגבתה במלואה מוצגת «חלקי» בגלל שגיאת ייצוג.
function pledgeStatus(p) {
  var c = collectedForPledge(p.client_id);
  if (c <= EPS) return 'לא בוצע';
  if (c + EPS < num(p.amount)) return 'חלקי';
  return 'בוצע';
}

function statusClass(s) { return s === 'בוצע' ? 'ok' : s === 'חלקי' ? 'warn' : ''; }

// היתרה היא סכום היתרות של ההתחייבויות — תשלום עודף על אחת אינו מקזז התחייבות אחרת.
function donorTotal(id) { return sum(pledgesOfDonor(id), function (p) { return p.amount; }); }

function donorPaid(id) { return sum(txnsOfDonor(id), function (t) { return t.amount; }); }

function donorLeft(id) { return sum(pledgesOfDonor(id), function (p) { return leftForPledge(p); }); }

// החודש של תשלום — שדה משלו ולא נגזר מהתאריך: תשלום בלי תאריך עדיין שייך לחודש שבו נרשם.
function monthTxns(m) { return state.txns.filter(function (t) { return t.txn_month === m; }); }

// מתי — התאריך, ובלעדיו החודש; תשלום בלי חודש הוא מה שנגבה לפני המעבר לאפליקציה.
function txnWhen(t) {
  if (t.txn_date) return dmyDate(t.txn_date);
  return t.txn_month ? monthLabel(t.txn_month) : 'לפני המעבר';
}

// היעד הקבוע — מפתח בטבלת ההגדרות, וחל על כל חודש שאין לו יעד משלו.
var TARGET_DEFAULT_KEY = 'target_default';

function targetDefault() {
  var r = findRow(liveRows(KV_TABLE), 'key', TARGET_DEFAULT_KEY);
  return r ? num(r.value) : 0;
}

function targetOwn(m) {
  for (var i = 0; i < state.targets.length; i++) if (state.targets[i].target_month === m) return state.targets[i];
  return null;
}

function targetFor(m) { var t = targetOwn(m); return t ? num(t.amount) : targetDefault(); }

// «בפועל» בשורת תכנית — התשלומים של הכרטיס בחודש התכנית; נגזר ואינו מוקלד.
function planActual(it) {
  return sum(txnsOfDonor(it.donor_client_id).filter(function (t) { return t.txn_month === it.plan_month; }),
             function (t) { return t.amount; });
}

function planOfMonth(m) { return state.plan.filter(function (r) { return r.plan_month === m; }); }

// הסדר הבא ברשימה שנקבעת ידנית — אחרי האחרון.
function nextSort(list) {
  var m = 0;
  for (var i = 0; i < list.length; i++) m = Math.max(m, +list[i].sort || 0);
  return m + 1;
}

// גם value וגם הטקסט עוברים esc — ערכי הרשימות נקבעים בידי המשתמש במסך ההגדרות.
// ערך שכבר רשום ואינו ברשימה נשאר בבורר — שם שירד מהרשימה אינו נמחק מהרשומה בשמירה הבאה.
function selectHTML(name, options, value, placeholder, chg) {
  var opts = options.slice(), v = value == null ? '' : String(value);
  if (v && opts.indexOf(v) < 0) opts.push(v);
  // ה-placeholder הוא השם הנגיש של הבורר — ה-id נגזר מהקורא ואין label צמוד.
  var h = '<select class="inp" aria-label="' + esc(placeholder || 'בחירה') + '" id="' + name + '"' +
    (chg ? ' data-chg="' + chg + '"' : '') + '>';
  h += '<option value="">' + esc(placeholder || '— ללא —') + '</option>';
  for (var i = 0; i < opts.length; i++) {
    var o = opts[i];
    h += '<option value="' + esc(o) + '"' + (String(o) === v ? ' selected' : '') + '>' + esc(o) + '</option>';
  }
  return h + '</select>';
}

function datalistHTML(id, options) {
  var h = '<datalist id="' + id + '">';
  for (var i = 0; i < options.length; i++) h += '<option value="' + esc(options[i]) + '"></option>';
  return h + '</datalist>';
}

function val(id) { var el = $('#' + id); return el ? String(el.value).trim() : ''; }

function checked(id) { var el = $('#' + id); return !!(el && el.checked); }

function nullable(v) { return v === '' ? null : v; }

function emptyBox(icon, text) {
  return '<div class="empty"><span class="big">' + icon + '</span>' + esc(text) + '</div>';
}

// ── בורר הכרטיס ──
// רשימה שנבנית בכל הקלדה ולא select — בורר עם מאות אפשרויות אינו שמיש במובייל.
function donorComboItems() {
  return gSortDonors(state.donors, 'abc').map(function (d) {
    return { value: d.client_id, label: d.name, sub: d.phone || DONOR_NO_PHONE,
             find: [d.name, d.phone || '', d.ambassador || ''].join('\n') };
  });
}
var DONOR_COMBO = { val: true, max: 30, items: donorComboItems, make: donorNewOpen,
  makeLabel: function (q) { return DONOR_NEW_LABEL + (q ? ' — "' + q + '"' : ''); } };
// בתכנית — בחירת הכרטיס ממלאת את השגריר מהכרטיס, וניתן לשנותו; התלות כאן ולא בסגור פר-פתיחה, שמתיישן כשהרכיב משתנה.
comboDef('donor-plan', Object.assign({}, DONOR_COMBO, { pick: function (it) {
  var d = it ? donorById(it.value) : null, sel = $('#pl-amb');
  if (sel && d && d.ambassador) sel.value = d.ambassador;
} }));

function donorFieldHTML(id, kind, donorId) {
  var d = donorId ? donorById(donorId) : null;
  return comboHTML(kind, { id: id, label: 'חיפוש כרטיס לפי שם או טלפון', placeholder: 'חיפוש כרטיס לפי שם או טלפון…',
                           picked: d ? { value: d.client_id, label: d.name } : null }) +
    '<div class="new-donor" data-new-donor="' + esc(id) + '"></div>';
}

// הטופס נבנה כשנפתח ויורד בביטול — כפתור שמירה מוסתר שנשאר בעץ היה נבחר במקש.
function donorNewOpen(q, root) {
  var box = $('[data-new-donor="' + root.id + '"]');
  if (!box) { console.error('[donor] אין מקום לטופס כרטיס חדש — #' + root.id); return; }
  box.innerHTML = '<div class="new-donor-form" data-ks>' +
      '<div class="new-donor-title">כרטיס חדש</div>' +
      '<div class="f2">' +
        '<label class="fld"><span>שם</span><input class="inp" data-new-donor-name value="' + esc(q) + '"></label>' +
        '<label class="fld"><span>טלפון</span><input class="inp" data-new-donor-phone inputmode="tel"></label>' +
      '</div>' +
      '<div class="btnrow"><button type="button" class="btn sm" data-act="donor-new-save" data-id="' + esc(root.id) + '" data-ksave>שמירה ובחירה</button>' +
      '<button type="button" class="btn ghost sm" data-act="donor-new-cancel" data-id="' + esc(root.id) + '" data-kesc>ביטול</button></div>' +
    '</div>';
  $('[data-new-donor-name]', box).focus();
}

function donorNewCancel(id) {
  var box = $('[data-new-donor="' + id + '"]'), root = $('#' + id);
  if (box) box.innerHTML = '';
  if (root) $('[data-combo-q]', root).focus();
}

function donorNewSave(id) {
  var box = $('[data-new-donor="' + id + '"]');
  if (!box) { console.error('[donor] אין טופס כרטיס חדש — #' + id); return; }
  var name = $('[data-new-donor-name]', box).value.trim();
  var phone = $('[data-new-donor-phone]', box).value.trim();
  if (!name) { toast(MSG_NEED_NAME, null, 'bad'); return; }
  return insert('g_donors', { name: name, phone: phone || null, affiliations: [], starred: false })
    .then(function (d) {
      box.innerHTML = '';
      comboSet(id, { value: d.client_id, label: d.name });
      toast(MSG_DONOR_CREATED, null, 'good');
    })
    .catch(errToast);
}

// ── משותף למסכים ──
function viewBare(html) {
  shellBare(true);
  var fab = $('#app > .fab');
  if (fab) fab.remove();
  $('#view').innerHTML = html;
}

// חיפוש וסינון הכרטיסים — לפי שם, טלפון, תפקיד או שגריר, ולפי שייכות.
function donorMatches(q, aff, mode) {
  q = String(q || '').trim().toLowerCase();
  var list = state.donors.filter(function (d) {
    if (aff && (d.affiliations || []).indexOf(aff) < 0) return false;
    if (!q) return true;
    return [d.name, d.phone, d.role, d.ambassador].some(function (v) {
      return String(v || '').toLowerCase().indexOf(q) >= 0;
    });
  });
  return gSortDonors(list, mode);
}

export { $, applyMirrorToState, checked, collectedForPledge, datalistHTML, dmyDate, donorById,
         donorFieldHTML, donorLeft, donorMatches, donorName, donorNewCancel, donorNewSave, donorPaid,
         donorTotal, emptyBox, gSortBudget, gSortGroups, gSortLoans, gSortNotes, gSortPlan, gSortPledges,
         gSortTasks, gSortTxns, ils, initials, insert, leftForPledge, listDef, lookupById, lookupLabels,
         lookupPut, lookupRows, mirrorHasData, monthKeyOf, monthLabel, monthTxns, nextSort, nullable,
         num, ok, pendRowKey, planActual, planOfMonth, pledgeById, pledgeStatus, pledgesOfDonor,
         rowPendingKey, selectHTML, shiftMonth, softDelete, statusClass, stripRows, sum, syncNow,
         tableMeta, TARGET_DEFAULT_KEY, txnWhen, targetDefault, targetFor, targetOwn, txnsOfDonor, txnsOfPledge, uniqSorted, update, upsertBy, val, viewBare };
