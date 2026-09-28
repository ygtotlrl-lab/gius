// app/domain.js — הסנכרון, הכתיבה המקומית, הנגזרות ורכיבי הממשק
import { MSG_LOAD_FAIL_PRE, MSG_SYNC_BACK, kvParse } from '../core/util.js';
import { PL_STAMP_KEY, _rowsPaged, ctxEpoch, ctxStale, errToast, idEq, mergeCore,
         newClientId, pendAll, pendClearMany, pendHas, pendMark, pendMarkMany, pendRender,
         pushDirty, schedulePush, tombAt } from '../core/sync.js';
import { MSG_LS_FULL, hwNoteCloud } from '../core/storage.js';
import { MIRROR, mirrorKey, mirrorSave } from '../core/mirror.js';
import { logAction } from '../core/backup.js';
import { authUsersTable, usersSanitize, usersSaveAll } from '../core/auth.js';
import { comboDef, comboHTML, comboSet, esc, pullRender, shellBare, toast } from '../core/ui.js';
import { DEFAULT_CONFIG, DONOR_NEW_LABEL, DONOR_NO_PHONE, EPS, KV_TABLE, MSG_DONOR_CREATED,
         MSG_MAYBE_STALE, MSG_NEED_DONOR_NAME, MSG_SAVED_NO_FP, TABLES } from './constants.js';
import { S, shell, state } from './state.js';

// ── מיון עברי ──
try { S._heColl = new Intl.Collator('he'); } catch (e) { S._heColl = null; }

var HE = S._heColl || { compare: function (a, b) { return String(a).localeCompare(String(b), 'he'); } };

// ── עד הדחיפה פר-מפתח ──
// נכתב רק אחרי מעבר דחיפה של הטבלה בלי שורה בכשל רשת, והדחיפה רצה רק אחרי משיכה מלאה שהצליחה.
// מכשיר שרק קורא מקבל אותו גם הוא — המעבר מסתיים ריק; אין לגזור אותו ממשיכה לבדה.
var _gPushedAt = {};

function _gMarkPushed(tbl) { _gPushedAt[tbl] = Date.now(); }

// גבול השנה ספטמבר–אוגוסט — שנת הלימודים של המוסד ולא השנה האזרחית.
function gAcadYearOf(iso) {
  var d = new Date(String(iso == null ? '' : iso).slice(0, 10) + 'T00:00:00');
  var y = d.getFullYear();
  if (!isFinite(y)) return NaN;
  return d.getMonth() >= 8 ? y : y - 1;
}

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
  return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
}

function shiftMonth(m, delta) {
  var p = m.split('-');
  var d = new Date(+p[0], +p[1] - 1 + delta, 1);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}

function initials(name) {
  var parts = String(name || '?').trim().split(/\s+/);
  return (parts[0] || '?').charAt(0) + (parts[1] ? parts[1].charAt(0) : '');
}

function byName(a, b) { return HE.compare(a.name || '', b.name || ''); }

function uniqSorted(list) {
  var seen = {}, out = [];
  for (var i = 0; i < list.length; i++) {
    var v = String(list[i] == null ? '' : list[i]).trim();
    if (!v || seen[v]) continue;
    seen[v] = 1; out.push(v);
  }
  return out.sort(function (a, b) { return HE.compare(a, b); });
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
function rowTs(r) {
  if (!r || typeof r !== 'object') return 0;
  // updated_at מספר ו-created_at ISO — Date.parse על מספר מחזיר NaN.
  var x = r.updated_at != null ? Number(r.updated_at) : Date.parse(r.created_at || '');
  return isFinite(x) ? x : 0;
}

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
  // מראת המשתמשים עוברת ברשימת-ההיתר של המודול — strip הוא רשימת-איסור, ועמודה רגישה חדשה עוקפת אותה.
  if (t === authUsersTable()) return usersSanitize(rows);
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

// המיון בצד הלקוח — המראה נקראת מהדיסק, והסדר אינו מגיע מהשרת.
function sortRows(t, arr) {
  var m = tableMeta(t);
  if (!m.order) return arr;
  var dir = m.desc ? -1 : 1;
  return arr.sort(function (a, b) {
    var x = a[m.order], y = b[m.order];
    var xe = (x == null || x === ''), ye = (y == null || y === '');
    if (xe && ye) return 0;
    if (xe) return 1; // ריקים תמיד בסוף, כמו nullsFirst:false
    if (ye) return -1;
    if (m.order === 'name') return HE.compare(x, y) * dir;
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
}

// value הוא טקסט ולא jsonb — הלקוח מנתח אותו, וערך פגום נקרא כשורה חסרה ואינו מפיל מסך.
function gCfgParse(key, v) {
  var pr = kvParse(key, v);
  return Array.isArray(pr.value) ? pr.value : null;
}

function configFromMirror() {
  var cfg = { categories: [], causes: [], domains: [] }, seen = {};
  (MIRROR[KV_TABLE] || []).forEach(function (row) {
    var list = gCfgParse(row.key, row.value);
    if (!list) return;
    cfg[row.key] = list.slice();
    seen[row.key] = true;
  });
  // ברירות מחדל רק כשהשורה חסרה — רשימה שרוקנה חוזרת ריקה ולא ברירות המחדל.
  Object.keys(DEFAULT_CONFIG).forEach(function (k) { if (!seen[k]) cfg[k] = DEFAULT_CONFIG[k].slice(); });
  return cfg;
}

function applyMirrorToState() {
  state.donors  = sortRows('g_donors',  liveRows('g_donors'));
  state.pledges = sortRows('g_pledges', liveRows('g_pledges'));
  state.txns    = sortRows('g_txns',    liveRows('g_txns'));
  state.tasks   = sortRows('g_tasks',   liveRows('g_tasks'));
  state.targets = sortRows('g_targets', liveRows('g_targets'));
  state.users   = sortRows('g_users',   liveRows('g_users'));
  state.config  = configFromMirror();
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

// הבן מקבל את חותמת המחיקה של האב ולא Date.now() — שתי חותמות לאותה מחיקה הן שתי הכרעות נפרדות במנוע המיזוג
function pcChildKill(parent, kid) {
  return Object.assign({}, kid, {
    deleted: !!parent.deleted,
    deleted_at: (parent.deleted_at === undefined) ? null : parent.deleted_at,
    deleted_by: (parent.deleted_by === undefined) ? null : parent.deleted_by,
    updated_at: parent.updated_at
  });
}

// לתנועה שני אבות — התורם חובה וההתחייבות אופציונלית, והתורם נשאל ראשון: מחיקתו מפילה את התנועה בכל מקרה.
var PC_CHILDREN = {
  g_donors: [{ t: 'g_pledges', fk: 'donor_client_id' }, { t: 'g_txns', fk: 'donor_client_id' }],
  g_pledges: [{ t: 'g_txns', fk: 'pledge_client_id' }]
};

// הכתיבה לבנים עוברת ב-upsertLocal ולא ב-update — update חותם Date.now() ומבטל את ירושת החותמת.
function pcCascadeDelete(table, parent) {
  var kids = PC_CHILDREN[table] || [], pid = parent[tableMeta(table).key], n = 0;
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i], km = tableMeta(k.t), arr = MIRROR[k.t] || [];
    for (var j = 0; j < arr.length; j++) {
      if (arr[j].deleted || !idEq(arr[j][k.fk], pid)) continue;
      var kid = pcChildKill(parent, arr[j]);
      upsertLocal(k.t, kid);
      markLocal(k.t, kid[km.key]);
      n++;
    }
  }
  if (n) applyMirrorToState();
  return n;
}

function softDelete(table, id) {
  return update(table, id, { deleted: true, deleted_at: tombAt() })
    .then(function (row) { pcCascadeDelete(table, row); return row; });
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

function saveConfigList(key, list) {
  return upsertBy(KV_TABLE, { key: key, value: JSON.stringify(list) });
}

// ── דחיפת-מצב ──
// דחיפת-מצב ולא תור יוצא — בתור, כשל תוכן אחד חוסם את כל מה שאחריו; כאן כל רשומה עומדת בפני עצמה.
function rowPendingKey(t, row) { return pendRowKey(t, row[tableMeta(t).key]); }

// בחותמת שווה שני התנאים הראשונים שקטים — בלי בדיקת הסימון, רשומה ממתינה לא הייתה נדחפת לעולם.
function dirtyRows(t, remoteByKey) {
  var m = tableMeta(t);
  return (MIRROR[t] || []).filter(function (l) {
    var k = String(l[m.key]);
    if (k === 'undefined' || k === 'null') return false;
    var r = remoteByKey[k];
    return !r || rowTs(l) > rowTs(r) || pendHas(pendRowKey(t, l[m.key]));
  });
}

// ── משיכה ──
// מחזירה {ok, remote} — מפת הענן היא מה שמאפשר לדחיפה שאחריה לדעת מה מקומי וחדש יותר.
function syncPull() {
  if (S._pulling || !S.sb) return Promise.resolve({ ok: false, remote: {} });
  S._pulling = true;
  // ההקשר נלכד בכניסה ונבדק לפני המיזוג — המשתמש יכול להתחלף בין המשיכה לכתיבה.
  var _ep = ctxEpoch();
  var remoteMaps = {};
  return Promise.all(TABLES.map(function (m) {
    // בלי סינון deleted — בלי ה-tombstones מחיקה ממכשיר אחר לא תגיע לכאן לעולם.
    // העימוד חובה: select('*') בבקשה אחת נחתך בשקט בתקרת db-max-rows.
    // הסדר לפי m.key ולא m.order — m.order הוא סדר תצוגה שעשוי להיות ריק, והעימוד דורש מפתח יציב וייחודי.
    return _rowsPaged(function () {
      return S.sb.from(m.t).select('*');
    }, m.key, null)
      .then(function (rows) { return { m: m, res: rows ? { data: rows, error: null }
                                                       : { data: null, error: { message: 'rows:' + m.t } } }; },
            function (e) { return { m: m, res: { error: e } }; });
  })).then(function (list) {
    if (ctxStale(_ep)) return { ok: false, remote: {} };
    var errs = [];
    list.forEach(function (x) {
      if (!x.res || x.res.error || !Array.isArray(x.res.data)) { errs.push(x.m.t); return; }
      var rows = stripRows(x.m.t, x.res.data);
      hwNoteCloud(mirrorKey(x.m.t), rows); // ראיה עננית לשער הדיסק
      var map = {};
      rows.forEach(function (r) { map[String(r[x.m.key])] = r; });
      remoteMaps[x.m.t] = map;
      var merged = mergeCore(MIRROR[x.m.t], rows, { key: x.m.key,
        isPending: function (k) { return pendHas(pendRowKey(x.m.t, k)); } });
      // מראת המשתמשים נשמרת דרך הנתיב המלא של המודול שלה, שמסנן בדיוק כמו הנתיב החלקי.
      if (x.m.t === authUsersTable()) usersSaveAll(merged);
      else { MIRROR[x.m.t] = merged; mirrorSave(x.m.t); }
    });
    applyMirrorToState();
    if (!errs.length) {
      S._lastPullOk = Date.now();
      // הגיבוי היומי ותור היומן אינם תלויים במשיכה שהצליחה — אחרת כל יום בלי סנכרון מדולג.
      // אין כאן כתיבת עד פינוי — משיכה אומרת «ראיתי את הענן» ולא «מה שאצלי עלה»; העד נכתב בסוף הדחיפה.
      if (!S._gPullLogged) { S._gPullLogged = true; gSyncLog('pull', null, null); }
      if (S._netWarned) { S._netWarned = false; toast(MSG_SYNC_BACK, null, 'good'); }
    } else {
      console.warn('[sync] נכשלו:', errs.join(', '));
      if (!S._netWarned) {
        S._netWarned = true;
        toast(MSG_LOAD_FAIL_PRE + errs.join(', ') + MSG_MAYBE_STALE, null, 'bad');
      }
    }
    return { ok: !errs.length, remote: remoteMaps };
  }).catch(function (e) {
    console.warn('[sync]', e);
    return { ok: false, remote: {} };
  }).then(function (r) { S._pulling = false; pendRender(); return r; });
}

// משיכה קודמת לדחיפה — בלי מצב הענן אין לדעת מה מקומי וחדש יותר, ודחיפה עיוורת מחייה רשומה שנמחקה במכשיר אחר.
// אין לרשום כל מחזור סנכרון — הפולינג רץ כל שלוש שניות, ו-sh_sync_log היא insert בלבד ואי-אפשר לדלל אותה.
function gSyncLog(action, key, recordCount, details) {
  try { logAction(action, key, recordCount, details); } catch (e) { }
}

function syncNow() {
  var t0 = Date.now();
  // הדחיפה נבדקת מול ההקשר שנלכד לפני המשיכה — res.remote נמדד עבורו.
  var _ep = ctxEpoch();
  return syncPull().then(function (res) {
    if (!res.ok || ctxStale(_ep)) { pullRender(shell.render); return false; }
    // שער הרשת כאן ולא בשכבת הדחיפה — הוא תלוי בלקוח, ומעבר ריק היה מסמן עד פינוי בלי ראיה מהענן.
    var p = (!S.sb || !navigator.onLine) ? Promise.resolve({ still: [] })
                                       : pushDirty(res.remote);
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
// כל סכום כסף מחושב בכל קריאה מ-state.txns — סכום שמור מתיישן בכל תנועה שנרשמה במכשיר אחר.
function donorById(id) {
  for (var i = 0; i < state.donors.length; i++) if (idEq(state.donors[i].client_id, id)) return state.donors[i];
  return null;
}

// מציין מקום ולא מחרוזת ריקה — שורת תנועה בלי שם נראית כבאג ומסתירה שהכסף עדיין רשום ומחושב.
function donorName(id) { var d = donorById(id); return d ? d.name : '— תורם שנמחק —'; }

function pledgeById(id) {
  for (var i = 0; i < state.pledges.length; i++) if (idEq(state.pledges[i].client_id, id)) return state.pledges[i];
  return null;
}

function txnsOfDonor(id) { return state.txns.filter(function (t) { return t.donor_client_id === id; }); }

function pledgesOfDonor(id) { return state.pledges.filter(function (p) { return p.donor_client_id === id; }); }

function collectedForPledge(pid) {
  return sum(state.txns.filter(function (t) { return t.pledge_client_id === pid; }), function (t) { return t.amount; });
}

// הסכומים numeric(14,2) חוזרים כ-float — בלי EPS התחייבות שנגבתה במלואה מוצגת «חלקי» בגלל שגיאת ייצוג.
function pledgeStatus(p) {
  var c = collectedForPledge(p.client_id);
  if (c <= EPS) return 'לא בוצע';
  if (c + EPS < num(p.amount)) return 'חלקי';
  return 'בוצע';
}

function statusClass(s) { return s === 'בוצע' ? 'ok' : s === 'חלקי' ? 'warn' : ''; }

function monthTxns(m) { return state.txns.filter(function (t) { return monthKeyOf(t.txn_date) === m; }); }

function targetFor(m) {
  for (var i = 0; i < state.targets.length; i++) if (state.targets[i].target_month === m) return num(state.targets[i].amount);
  return 0;
}

// השגריר, המנהל והאחראי הם טקסט חופשי ולא מפתח זר — הרשימה כוללת גם ערכים שכבר נרשמו, כדי ששם ישן לא ייעלם מהבורר.
function agentPool() {
  return uniqSorted(
    state.users.map(function (u) { return u.full_name; })
      .concat(state.donors.map(function (d) { return d.agent; }))
      .concat(state.pledges.map(function (p) { return p.agent; }))
      .concat(state.txns.map(function (t) { return t.agent; }))
  );
}

// גם value וגם הטקסט עוברים esc — ערכי הרשימות נקבעים בידי המשתמש במסך ההגדרות.
function selectHTML(name, options, value, placeholder, chg) {
  // ה-placeholder הוא השם הנגיש של הבורר — ה-id נגזר מהקורא ואין label צמוד.
  var h = '<select class="inp" aria-label="' + esc(placeholder || 'בחירה') + '" id="' + name + '"' +
    (chg ? ' data-chg="' + chg + '"' : '') + '>';
  h += '<option value="">' + esc(placeholder || '— ללא —') + '</option>';
  for (var i = 0; i < options.length; i++) {
    var o = options[i];
    h += '<option value="' + esc(o) + '"' + (String(o) === String(value == null ? '' : value) ? ' selected' : '') + '>' + esc(o) + '</option>';
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

// ── בורר התורם ──
// רשימה שנבנית בכל הקלדה ולא select — בורר עם מאות אפשרויות אינו שמיש במובייל.
function donorComboItems() {
  return state.donors.slice().sort(byName).map(function (d) {
    return { value: d.client_id, label: d.name, sub: d.phone || DONOR_NO_PHONE,
             find: [d.name, d.phone || '', d.agent || ''].join('\n') };
  });
}
var DONOR_COMBO = { val: true, max: 30, items: donorComboItems, make: donorNewOpen,
  makeLabel: function (q) { return DONOR_NEW_LABEL + (q ? ' — "' + q + '"' : ''); } };
comboDef('donor', DONOR_COMBO);
// התלות של #txn-pledge בתורם יושבת כאן ולא בסגור שנמסר בכל פתיחת מודאל — סגור פר-פתיחה מתיישן כשהרכיב משתנה.
comboDef('donor-txn', Object.assign({}, DONOR_COMBO, { pick: function (it) {
  var sel = $('#txn-pledge');
  if (sel) sel.innerHTML = pledgeOptionsFor(it ? it.value : '');
} }));

function donorFieldHTML(id, kind, donorId) {
  var d = donorId ? donorById(donorId) : null;
  return comboHTML(kind, { id: id, label: 'חיפוש תורם לפי שם או טלפון', placeholder: 'חיפוש תורם לפי שם או טלפון…',
                           picked: d ? { value: d.client_id, label: d.name } : null }) +
    '<div class="new-donor" data-new-donor="' + esc(id) + '"></div>';
}

// הטופס נבנה כשנפתח ויורד בביטול — כפתור שמירה מוסתר שנשאר בעץ היה נבחר במקש.
function donorNewOpen(q, root) {
  var box = $('[data-new-donor="' + root.id + '"]');
  if (!box) { console.error('[donor] אין מקום לטופס תורם חדש — #' + root.id); return; }
  box.innerHTML = '<div class="new-donor-form" data-ks>' +
      '<div class="new-donor-title">תורם חדש</div>' +
      '<div class="f2">' +
        '<label class="fld"><span>שם התורם</span><input class="inp" data-new-donor-name value="' + esc(q) + '"></label>' +
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
  if (!box) { console.error('[donor] אין טופס תורם חדש — #' + id); return; }
  var name = $('[data-new-donor-name]', box).value.trim();
  var phone = $('[data-new-donor-phone]', box).value.trim();
  if (!name) { toast(MSG_NEED_DONOR_NAME, null, 'bad'); return; }
  return insert('g_donors', { name: name, phone: phone || null })
    .then(function (d) {
      box.innerHTML = '';
      comboSet(id, { value: d.client_id, label: d.name });
      toast(MSG_DONOR_CREATED, null, 'good');
    })
    .catch(errToast);
}

// saveX שמחזירה undefined היא ולידציה שעצרה, ו-runSave אינה סוגרת את המודאל — אין להחזיר משם ערך «בשביל האחידות».
function pledgeOptionsFor(donorId) {
  var list = donorId ? pledgesOfDonor(donorId) : [];
  var h = '<option value="">— ללא שיוך —</option>';
  list.forEach(function (p) {
    var left = Math.max(0, num(p.amount) - collectedForPledge(p.client_id));
    h += '<option value="' + p.client_id + '">' + esc(p.cause || 'התחייבות') + ' · ' + ils(p.amount) +
      ' (נותר ' + ils(left) + ')</option>';
  });
  return h;
}

// ── משותף למסכים ──
function viewBare(html) {
  shellBare(true);
  var fab = $('#app > .fab');
  if (fab) fab.remove();
  $('#view').innerHTML = html;
}

function donorMatches(q) {
  q = String(q || '').trim().toLowerCase();
  var list = state.donors.slice().sort(byName);
  if (!q) return list;
  return list.filter(function (d) {
    return String(d.name || '').toLowerCase().indexOf(q) >= 0 ||
      String(d.phone || '').indexOf(q) >= 0 ||
      String(d.agent || '').toLowerCase().indexOf(q) >= 0;
  });
}

// שמירה בלי טביעה אינה «נשמר בהצלחה» — הכניסה האופליין של המשתמש לא תעבוד, ואומרים את זה.
function warnIfNoFp(r) {
  if (r && r.noFp) toast(MSG_SAVED_NO_FP, null, 'bad');
  return r;
}

export { $, HE, _gMarkPushed, agentPool, applyMirrorToState, checked, collectedForPledge,
         datalistHTML, dirtyRows, dmyDate, donorById, donorFieldHTML, donorMatches,
         donorName, donorNewCancel, donorNewSave, emptyBox, gAcadYearOf, ils, initials,
         insert, mirrorHasData, monthKeyOf, monthLabel, monthTxns, nullable, num, ok,
         pendRowKey, pledgeById, pledgeOptionsFor, pledgeStatus,
         pledgesOfDonor, rowPendingKey, rowTs, saveConfigList, selectHTML, shiftMonth,
         softDelete, statusClass, stripRows, sum, syncNow, tableMeta, targetFor,
         txnsOfDonor, uniqSorted, update, upsertBy, val, viewBare, warnIfNoFp };
