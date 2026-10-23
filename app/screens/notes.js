// app/screens/notes.js — רשומות: לוח פתקים בצבעים, בסדר שנגרר
import { pendTag } from '../../core/sync.js';
import { dragDef, dragOrder, esc, openModal, toast } from '../../core/ui.js';
import { MSG_NEED_TITLE, NOTE_COLORS } from '../constants.js';
import { state } from '../state.js';
import { $, emptyBox, gSortNotes, insert, nextSort, pendRowKey, update, val } from '../domain.js';

function viewNotes() {
  var list = gSortNotes(state.notes);
  var h = '<section class="card"><h2>רשומות<span class="cnt">' + list.length + '</span>' +
    '<span class="sp"><button class="btn sm" data-act="note-new">＋ פתק</button></span></h2>';
  if (!list.length) return h + emptyBox('✎', 'אין עדיין רשומות') + '</section>';
  h += '<div class="notes">' + list.map(function (n) {
    return '<article class="note-card nc-' + esc(n.color || NOTE_COLORS[0]) + '" data-drag="note" data-id="' + esc(n.client_id) + '">' +
      '<span class="grip" data-grip aria-hidden="true">⣿</span>' +
      '<button class="note-open" data-act="note-edit" data-id="' + esc(n.client_id) + '">' +
        '<b>' + esc(n.title || 'ללא כותרת') + pendTag(pendRowKey('g_notes', n.client_id)) + '</b>' +
        '<span class="note-body">' + esc(n.body || '') + '</span></button>' +
    '</article>';
  }).join('') + '</div>';
  return h + '</section>';
}

// הסדר נכתב לכל הפתקים מה-DOM הסופי — שני פתקים באותו sort הם סדר שאיש לא הכריע.
dragDef('note', function (list) {
  var ids = dragOrder(list, 'note', 'data-id');
  ids.forEach(function (id, i) {
    var n = null;
    for (var j = 0; j < state.notes.length; j++) if (state.notes[j].client_id === id) n = state.notes[j];
    if (n && +n.sort !== i + 1) update('g_notes', id, { sort: i + 1 });
  });
});

function formNote(n) {
  var cur = n ? n.color || NOTE_COLORS[0] : NOTE_COLORS[0];
  openModal(n ? 'עריכת פתק' : 'פתק חדש',
    '<label class="fld"><span>כותרת *</span><input class="inp" id="n-title" value="' + esc(n ? n.title : '') + '"></label>' +
    '<div class="fld"><span>צבע</span><div class="swatches" role="radiogroup" aria-label="צבע">' + NOTE_COLORS.map(function (c) {
      return '<label class="sw nc-' + c + '"><input type="radio" name="n-color" value="' + c + '"' + (c === cur ? ' checked' : '') + ' aria-label="' + c + '"></label>';
    }).join('') + '</div></div>' +
    '<label class="fld"><span>טקסט</span><textarea class="inp note-ta" id="n-body">' + esc(n ? n.body || '' : '') + '</textarea></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (n ? '<button class="btn danger" data-act="note-del" data-id="' + esc(n.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="note-save" data-id="' + esc(n ? n.client_id : '') + '" data-ksave>שמירה</button>');
}

function saveNote(id) {
  var title = val('n-title');
  if (!title) { toast(MSG_NEED_TITLE, null, 'bad'); return; }
  var c = $('input[name="n-color"]:checked');
  var row = { title: title, color: c ? c.value : NOTE_COLORS[0], body: $('#n-body') ? $('#n-body').value : '' };
  if (id) return update('g_notes', id, row);
  return insert('g_notes', Object.assign(row, { sort: nextSort(state.notes) }));
}

export { formNote, saveNote, viewNotes };
