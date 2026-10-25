// app/screens/budget.js — תקציב אירוע: אירועים כרטיסים סגורים, ובכל אירוע — ההוצאות שלו
import { readNum } from '../../core/util.js';
import { pendTag } from '../../core/sync.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { MSG_NEED_EVENT_NAME, MSG_NEED_ITEM } from '../constants.js';
import { state } from '../state.js';
import { $, dmyDate, emptyBox, gSortBudget, gSortEvents, ils, insert, nextSort, nullable, pendRowKey, sum, uniqSorted,
         update, val } from '../domain.js';

function itemsOf(evId) { return gSortBudget(state.budget.filter(function (b) { return b.event_client_id === evId; })); }

// אירוע סגור — שם · תאריך · מספר ההוצאות · סה״כ; לחיצה פותחת את ההוצאות, אירוע אחד פתוח בכל פעם.
function viewBudget() {
  var evs = gSortEvents(state.events);
  var h = '<section class="card"><h2>אירועים<span class="cnt">' + evs.length + '</span>' +
    '<span class="sp"><button class="btn sm" data-act="event-new">＋ אירוע</button></span></h2>';
  if (!evs.length) return h + emptyBox('🎉', 'אין עדיין אירועים') + '</section>';
  h += '<div class="evs">' + evs.map(function (e) {
    var items = itemsOf(e.client_id), open = state.budgetOpen === e.client_id, id = esc(e.client_id);
    var total = sum(items, function (b) { return b.cost; });
    var r = '<div class="ev' + (open ? ' open' : '') + '">' +
      '<button class="ev-hd" data-act="event-toggle" data-id="' + id + '" aria-expanded="' + open + '">' +
        '<span class="ev-name"><b>' + esc(e.name) + pendTag(pendRowKey('g_events', e.client_id)) + '</b>' +
          '<small>' + esc([e.event_date ? dmyDate(e.event_date) : '', items.length + ' הוצאות', e.note].filter(Boolean).join(' · ')) + '</small></span>' +
        '<span class="ev-total">' + ils(total) + '</span>' +
        '<span class="ev-chev" aria-hidden="true">' + (open ? '▴' : '▾') + '</span>' +
      '</button>';
    if (open) {
      r += '<div class="ev-body">' +
        (items.length ? items.map(function (b) {
          return '<div class="row" data-act="budget-edit" data-id="' + esc(b.client_id) + '">' +
            '<div class="main"><b>' + esc(b.item) + pendTag(pendRowKey('g_budget_items', b.client_id)) + '</b>' +
              '<small>' + esc([b.category, b.note].filter(Boolean).join(' · ') || '—') + '</small></div>' +
            '<div class="end">' + ils(b.cost) + '</div></div>';
        }).join('') + '<div class="total-row"><span>סה״כ</span><b>' + ils(total) + '</b></div>'
        : emptyBox('🧾', 'אין עדיין הוצאות באירוע')) +
        '<div class="btnrow ev-acts">' +
          '<button class="btn sm" data-act="budget-new" data-event="' + id + '">＋ הוצאה</button>' +
          '<button class="btn ghost sm" data-act="event-edit" data-id="' + id + '">עריכת האירוע</button>' +
        '</div></div>';
    }
    return r + '</div>';
  }).join('') + '</div>';
  return h + '</section>';
}

function formEvent(e) {
  openModal(e ? 'עריכת אירוע' : 'אירוע חדש',
    '<label class="fld"><span>שם האירוע *</span><input class="inp" id="e-name" value="' + esc(e ? e.name : '') + '"></label>' +
    '<label class="fld"><span>תאריך</span><input class="inp" type="date" id="e-date" value="' + esc(e && e.event_date ? e.event_date : '') + '"></label>' +
    '<label class="fld"><span>הערה</span><input class="inp" id="e-note" value="' + esc(e ? e.note || '' : '') + '"></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (e ? '<button class="btn danger" data-act="event-del" data-id="' + esc(e.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="event-save" data-id="' + esc(e ? e.client_id : '') + '" data-ksave>שמירה</button>');
  var n = $('#e-name'); if (n && !e) n.focus();
}

function saveEvent(id) {
  var name = val('e-name');
  if (!name) { toast(MSG_NEED_EVENT_NAME, null, 'bad'); return; }
  var row = { name: name, event_date: nullable(val('e-date')), note: nullable(val('e-note')) };
  if (id) return update('g_events', id, row);
  return insert('g_events', Object.assign(row, { sort: nextSort(state.events) })).then(function (e) {
    state.budgetOpen = e.client_id;
    return e;
  });
}

// הקטגוריה — טקסט חופשי עם הצעות מהקטגוריות שכבר הוזנו, בכל האירועים.
function formBudget(b, evId) {
  var cats = uniqSorted(state.budget.map(function (x) { return x.category; }));
  var ev = b ? b.event_client_id : evId;
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
    '<button class="btn" data-act="budget-save" data-id="' + esc(b ? b.client_id : '') + '" data-event="' + esc(ev || '') + '" data-ksave>שמירה</button>');
}

// הוצאה חדשה שייכת תמיד לאירוע — נפתחת מתוך האירוע הפתוח.
function saveBudget(id, evId) {
  var item = val('b-item');
  if (!item) { toast(MSG_NEED_ITEM, null, 'bad'); return; }
  var row = { item: item, category: nullable(val('b-cat')), cost: readNum($('#b-cost'), 0), note: nullable(val('b-note')) };
  if (id) return update('g_budget_items', id, row);
  if (!evId) return;
  var mine = state.budget.filter(function (b) { return b.event_client_id === evId; });
  return insert('g_budget_items', Object.assign(row, { event_client_id: evId, sort: nextSort(mine) }));
}

export { formBudget, formEvent, saveBudget, saveEvent, viewBudget };
