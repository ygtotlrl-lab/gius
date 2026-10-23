// app/screens/budget.js — תקציב אירוע
import { readNum } from '../../core/util.js';
import { pendTag } from '../../core/sync.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { MSG_NEED_ITEM } from '../constants.js';
import { state } from '../state.js';
import { $, emptyBox, gSortBudget, ils, insert, nextSort, nullable, pendRowKey, sum, uniqSorted,
         update, val } from '../domain.js';

function viewBudget() {
  var list = gSortBudget(state.budget);
  var h = '<section class="card"><h2>תקציב אירוע<span class="cnt">' + list.length + '</span>' +
    '<span class="sp"><button class="btn sm" data-act="budget-new">＋ הוצאה</button></span></h2>';
  if (!list.length) return h + emptyBox('🧾', 'אין עדיין הוצאות') + '</section>';
  h += list.map(function (b) {
    return '<div class="row" data-act="budget-edit" data-id="' + esc(b.client_id) + '">' +
      '<div class="main"><b>' + esc(b.item) + pendTag(pendRowKey('g_budget_items', b.client_id)) + '</b>' +
        '<small>' + esc([b.category, b.note].filter(Boolean).join(' · ') || '—') + '</small></div>' +
      '<div class="end">' + ils(b.cost) + '</div></div>';
  }).join('');
  h += '<div class="total-row"><span>סה״כ</span><b>' + ils(sum(list, function (b) { return b.cost; })) + '</b></div>';
  return h + '</section>';
}

// הקטגוריה — טקסט חופשי עם הצעות מהקטגוריות שכבר הוזנו.
function formBudget(b) {
  var cats = uniqSorted(state.budget.map(function (x) { return x.category; }));
  openModal(b ? 'עריכת הוצאה' : 'הוצאה חדשה',
    '<label class="fld"><span>פריט *</span><input class="inp" id="b-item" value="' + esc(b ? b.item : '') + '"></label>' +
    '<div class="f2">' +
      '<label class="fld"><span>קטגוריה</span><input class="inp" id="b-cat" list="b-cats" value="' + esc(b ? b.category || '' : '') + '"></label>' +
      '<label class="fld"><span>עלות</span><input class="inp" id="b-cost" inputmode="decimal" value="' + esc(b && b.cost != null ? b.cost : '') + '"></label>' +
    '</div>' +
    '<datalist id="b-cats">' + cats.map(function (c) { return '<option value="' + esc(c) + '"></option>'; }).join('') + '</datalist>' +
    '<label class="fld"><span>הערה</span><input class="inp" id="b-note" value="' + esc(b ? b.note || '' : '') + '"></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (b ? '<button class="btn danger" data-act="budget-del" data-id="' + esc(b.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="budget-save" data-id="' + esc(b ? b.client_id : '') + '" data-ksave>שמירה</button>');
}

function saveBudget(id) {
  var item = val('b-item');
  if (!item) { toast(MSG_NEED_ITEM, null, 'bad'); return; }
  var row = { item: item, category: nullable(val('b-cat')), cost: readNum($('#b-cost'), 0), note: nullable(val('b-note')) };
  return id ? update('g_budget_items', id, row) : insert('g_budget_items', Object.assign(row, { sort: nextSort(state.budget) }));
}

export { formBudget, saveBudget, viewBudget };
