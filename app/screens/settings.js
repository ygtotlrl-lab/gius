// app/screens/settings.js — ההגדרות: שש הרשימות והיעד החודשי
import { dragDef, esc, lookupDragApply, lookupSeed, openModal, toast } from '../../core/ui.js';
import { readNum } from '../../core/util.js';
import { LISTS, MSG_MONTH_GOAL, MSG_PICK_VALID_MONTH } from '../constants.js';
import { state } from '../state.js';
import { $, emptyBox, ils, listDef, lookupRows, monthLabel, monthTxns, num, sum, upsertBy,
         val } from '../domain.js';

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
  var tg = state.targets.slice().sort(function (a, b) { return a.target_month < b.target_month ? 1 : -1; });
  h += '<section class="card"><h2>יעד חודשי<span class="cnt">' + tg.length + '</span>' +
    '<span class="sp"><button class="btn sm" data-act="target-set">קביעת יעד</button></span></h2>';
  if (!tg.length) h += emptyBox('🎯', 'עדיין לא הוגדרו יעדים');
  else h += tg.map(function (t) {
    var got = sum(monthTxns(t.target_month), function (x) { return x.amount; });
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
  var m = month || state.month, cur = 0;
  for (var i = 0; i < state.targets.length; i++) if (state.targets[i].target_month === m) cur = num(state.targets[i].amount);
  openModal(MSG_MONTH_GOAL,
    '<div class="f2">' +
      '<label class="fld"><span>חודש *</span><input class="inp" type="month" id="tg-month" value="' + esc(m) + '"></label>' +
      '<label class="fld"><span>סכום יעד *</span><input class="inp" id="tg-amount" inputmode="decimal" value="' + (cur || '') + '"></label>' +
    '</div>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    '<button class="btn" data-act="target-save" data-ksave>שמירה</button>');
}

function saveTarget() {
  var m = val('tg-month');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) { toast(MSG_PICK_VALID_MONTH, null, 'bad'); return; }
  // המזהה הוא החודש — שני מכשירים שקובעים את אותו חודש מגיעים לאותה שורה.
  return upsertBy('g_targets', { client_id: m, target_month: m, amount: readNum($('#tg-amount'), 0), deleted: false });
}

export { formTarget, lookupForm, saveTarget, viewSettings };
