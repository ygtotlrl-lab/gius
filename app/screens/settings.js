// app/screens/settings.js — ההגדרות: שש הרשימות והיעד החודשי
import { dragDef, esc, lookupDragApply, lookupSeed, openModal, toast } from '../../core/ui.js';
import { readNum } from '../../core/util.js';
import { KV_TABLE, LISTS, MSG_AMOUNT_POSITIVE, MSG_MONTH_GOAL, MSG_PICK_VALID_MONTH } from '../constants.js';
import { state } from '../state.js';
import { $, TARGET_DEFAULT_KEY, emptyBox, ils, listDef, lookupRows, monthLabel, monthTxnsInit, num, sum,
         targetDefault, targetOwn, upsertBy, val } from '../domain.js';

// ── הרשימות ──
// רשימה שעוד לא נזרעה מוצגת מנקודת הפתיחה, במזהים שהזריעה תיתן לה — עריכה וגרירה זורעות קודם.
function lookupShown(l) {
  var rows = lookupRows(l.kind);
  if (rows.length) return rows;
  return l.dflt.map(function (label) { return { client_id: l.kind + ':' + label, label: label }; });
}

function lookupCardHTML(l) {
  var rows = lookupShown(l);
  var h = '<section class="card look-card"><h2>' + esc(l.title) + '<span class="cnt">' + rows.length + '</span>' +
    '<span class="sp"><button class="btn sm" data-act="look-add" data-k="' + esc(l.kind) + '">＋ ' + esc(l.one) + '</button></span></h2>';
  if (!rows.length) return h + emptyBox('📋', 'הרשימה ריקה') + '</section>';
  return h + '<div class="look-list">' + rows.map(function (r) {
    return '<div class="list-item" data-act="look-edit" data-k="' + esc(l.kind) + '" data-drag="' + esc(l.kind) + '" data-id="' + esc(r.client_id) + '">' +
      '<span class="grip" data-grip aria-hidden="true">⣿</span>' +
      '<span class="list-val">' + esc(r.label) + '</span></div>';
  }).join('') + '</div></section>';
}

LISTS.forEach(function (l) {
  dragDef(l.kind, function (list, kind) { lookupSeed(kind, l.dflt); lookupDragApply(list, kind); });
});

function viewSettings() {
  var h = '<div class="grid2">' + LISTS.map(lookupCardHTML).join('') + '</div>';

  // ── היעד החודשי ──
  // יעד קבוע לכל החודשים, וחודש שנקבע לו יעד משלו — גובר עליו.
  var dflt = targetDefault();
  var tg = state.targets.slice().sort(function (a, b) { return a.target_month < b.target_month ? 1 : -1; });
  h += '<section class="card"><h2>יעד חודשי</h2>' +
    '<div class="row" data-act="target-default">' +
      '<div class="main"><b>יעד קבוע</b><small>חל על כל חודש שאין לו יעד משלו</small></div>' +
      '<div class="end">' + (dflt > 0 ? ils(dflt) : '— לא הוגדר —') + '</div></div>' +
    '<div class="sec-t tg-own">חודשים עם יעד משלהם<span class="cnt">' + tg.length + '</span>' +
      '<button class="btn sm" data-act="target-set">＋ יעד לחודש</button></div>';
  if (!tg.length) h += '<div class="hint">אין — כל החודשים ביעד הקבוע.</div>';
  else h += tg.map(function (t) {
    var got = sum(monthTxnsInit(t.target_month), function (x) { return x.amount; });
    var pct = num(t.amount) > 0 ? got / num(t.amount) * 100 : 0;
    return '<div class="row" data-act="target-set" data-month="' + esc(t.target_month) + '">' +
      '<div class="main"><b>' + esc(monthLabel(t.target_month)) + '</b><small>נגבה ' + ils(got) + ' · ' + pct.toFixed(0) + '%</small></div>' +
      '<div class="end">' + ils(t.amount) + '<small>יעד</small></div></div>';
  }).join('');
  return h + '</section>';
}

// כפתור אחד לשני המסלולים, ומחיקה רק בעריכה.
function lookupForm(kind, r) {
  var l = listDef(kind);
  openModal((r ? 'עריכת ' : 'הוספת ') + (l ? l.one : ''),
    '<label class="fld"><span>' + esc(l ? l.one : 'ערך') + '</span>' +
    '<input class="inp" id="l-label" autocomplete="off" value="' + esc(r ? r.label : '') + '"></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (r ? '<button class="btn danger" data-act="look-del" data-id="' + esc(r.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="look-save" data-id="' + esc(r ? r.client_id : '') + '" data-k="' + esc(kind) + '" data-ksave>שמירה</button>');
  var inp = $('#l-label'); if (inp) inp.focus();
}

function formTarget(month) {
  var m = month || state.month, own = targetOwn(m);
  openModal(MSG_MONTH_GOAL,
    '<div class="f2">' +
      '<label class="fld"><span>חודש *</span><input class="inp" type="month" id="tg-month" value="' + esc(m) + '"></label>' +
      '<label class="fld"><span>סכום יעד *</span><input class="inp" id="tg-amount" inputmode="decimal" value="' + (own ? num(own.amount) : '') + '"></label>' +
    '</div>' +
    '<div class="hint">היעד הקבוע: ' + ils(targetDefault()) + '. יעד שנקבע כאן חל על החודש הזה בלבד.</div>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (own ? '<button class="btn danger" data-act="target-clear" data-id="' + esc(own.client_id) + '">חזרה ליעד הקבוע</button>' : '') +
    '<button class="btn" data-act="target-save" data-ksave>שמירה</button>');
}

function saveTarget() {
  var m = val('tg-month');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) { toast(MSG_PICK_VALID_MONTH, null, 'bad'); return; }
  // המזהה הוא החודש — שני מכשירים שקובעים את אותו חודש מגיעים לאותה שורה.
  return upsertBy('g_targets', { client_id: m, target_month: m, amount: readNum($('#tg-amount'), 0), deleted: false, deleted_at: null });
}

function formTargetDefault() {
  openModal('יעד חודשי קבוע',
    '<label class="fld"><span>סכום *</span><input class="inp" id="tgd-amount" inputmode="decimal" value="' + (targetDefault() || '') + '"></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    '<button class="btn" data-act="target-default-save" data-ksave>שמירה</button>');
}

function saveTargetDefault() {
  var n = readNum($('#tgd-amount'), 0);
  if (!(n > 0)) { toast(MSG_AMOUNT_POSITIVE, null, 'bad'); return; }
  return upsertBy(KV_TABLE, { key: TARGET_DEFAULT_KEY, value: JSON.stringify(n) });
}

export { formTarget, formTargetDefault, lookupForm, saveTarget, saveTargetDefault, viewSettings };
