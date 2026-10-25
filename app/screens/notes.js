// app/screens/notes.js — רשומות: לוח פתקים בצבעים, בסדר שנגרר
import { pendTag } from '../../core/sync.js';
import { dragDef, dragOrder, esc } from '../../core/ui.js';
import { NOTE_COLORS } from '../constants.js';
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

// הפתק נפתח על כל המסך, בצבע שלו — כמו בגוגל קיפ: כותרת, טקסט חופשי וצבע. הסגירה שומרת אם משהו השתנה;
// פתק חדש ריק אינו נשמר. כותרת אינה חובה — פתק בלי כותרת מוצג «ללא כותרת».
var _nf = null;
function formNote(n) {
  closeNoteFull(false);
  var cur = n ? n.color || NOTE_COLORS[0] : NOTE_COLORS[0];
  _nf = { id: n ? n.client_id : null, title: n ? n.title || '' : '', body: n ? n.body || '' : '', color: cur };
  var el = document.createElement('div');
  el.id = 'note-full';
  el.className = 'note-full nc-' + cur;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', n ? 'עריכת פתק' : 'פתק חדש');
  el.innerHTML = '<div class="nf-in">' +
    '<div class="nf-bar">' +
      '<button class="nf-btn" data-act="note-close" aria-label="סגירה ושמירה">✕</button>' +
      '<span class="nf-grow"></span>' +
      (n ? '<button class="nf-btn nf-del" data-act="note-del" data-id="' + esc(n.client_id) + '">מחיקה</button>' : '') +
    '</div>' +
    '<input class="nf-title" id="n-title" placeholder="כותרת" aria-label="כותרת" value="' + esc(_nf.title) + '">' +
    '<textarea class="nf-body" id="n-body" placeholder="פתק…" aria-label="טקסט">' + esc(_nf.body) + '</textarea>' +
    '<div class="swatches nf-colors" role="radiogroup" aria-label="צבע">' + NOTE_COLORS.map(function (c) {
      return '<label class="sw nc-' + c + '"><input type="radio" name="n-color" data-chg="note-color" value="' + c + '"' + (c === cur ? ' checked' : '') + ' aria-label="' + c + '"></label>';
    }).join('') + '</div>' +
  '</div>';
  document.body.appendChild(el);
  document.body.classList.add('locked');
  var f = n ? $('#n-body') : $('#n-title');
  if (f) f.focus();
}

function noteColorPick(v) {
  var el = document.getElementById('note-full');
  if (el) el.className = 'note-full nc-' + v;
}

// save=false — סגירה בלי כתיבה (אחרי מחיקה, או לפני פתיחת פתק אחר).
function closeNoteFull(save) {
  var el = document.getElementById('note-full'), nf = _nf, row = null;
  if (el && nf && save) {
    var c = $('input[name="n-color"]:checked');
    row = { title: val('n-title'), body: $('#n-body') ? $('#n-body').value : '', color: c ? c.value : nf.color };
  }
  if (el) el.remove();
  _nf = null;
  document.body.classList.remove('locked');
  if (!row) return;
  if (nf.id) {
    if (row.title === nf.title && row.body === nf.body && row.color === nf.color) return;
    return update('g_notes', nf.id, row);
  }
  if (!row.title && !row.body.trim()) return;
  return insert('g_notes', Object.assign(row, { sort: nextSort(state.notes) }));
}

// Escape סוגר ושומר, כמו ✕ — רק כשאין חלון אישור פתוח מעליו.
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape' || !document.getElementById('note-full')) return;
  var a = document.getElementById('ask');
  if (a && a.classList.contains('open')) return;
  e.preventDefault();
  document.dispatchEvent(new CustomEvent('note-close'));
});

export { closeNoteFull, formNote, noteColorPick, viewNotes };
