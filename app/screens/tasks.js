// app/screens/tasks.js — המשימות: אחראי ⟵ שלושה שלבים ⟵ הרשימה
import { pendTag } from '../../core/sync.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { ASSIGNEES, LK_DOMAIN, MSG_NEED_TITLE, STAGES } from '../constants.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import { snapShare } from '../snap.js';
import { dmyDate, emptyBox, gSortTasks, insert, lookupLabels, nextSort, nullable, pendRowKey,
         selectHTML, update, val } from '../domain.js';

function stageOf(id) {
  for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return STAGES[i];
  return STAGES[0];
}

// החיפוש — בשם המשימה, והמונים בלשוניות ובשלבים סופרים את מה שנמצא.
function tasksOf(who, stage) {
  var q = String(state.tasks_ui.q || '').trim().toLowerCase();
  return gSortTasks(state.tasks.filter(function (t) {
    return t.assignee === who && (!stage || t.stage === stage) &&
      (!q || String(t.title || '').toLowerCase().indexOf(q) >= 0);
  }));
}

// חודש היצירה — בשעון המקומי; created_at נשמר ב-UTC, ובקצה החודש החיתוך שלו נופל על החודש הקודם.
function createdLabel(t) {
  var d = t.created_at ? new Date(t.created_at) : null;
  return d && !isNaN(d) ? (d.getMonth() + 1) + '/' + d.getFullYear() : '';
}

// שורת משימה — עיגול סימון בצבע השלב (לחיצה מעבירה שלב, בלי לפתוח), הכותרת, וכוכב העדיפות בקצה,
// ושבבים: התחום ותאריך היעד — שעבר באדום, ושבוע קרוב בזהב.
function dueCls(iso) {
  if (!iso) return '';
  var d = new Date(iso + 'T12:00:00'), now = new Date(), days = (d - now) / 864e5;
  return days < -0.5 ? ' late' : days <= 7 ? ' soon' : '';
}
function taskRowHTML(t) {
  var st = stageOf(t.stage), made = createdLabel(t);
  return '<div class="tk ' + st.cls + '" data-act="task-open" data-id="' + esc(t.client_id) + '">' +
    '<button class="tk-check ' + st.cls + '" data-act="task-step" data-id="' + esc(t.client_id) + '" aria-label="' + esc('שלב: ' + st.id) + '" title="' + esc(st.id) + '">' +
      icon(st.cls === 'off' ? 'close' : 'check') + '</button>' +
    '<div class="tk-main"><b>' + esc(t.title) + '</b>' +
      pendTag(pendRowKey('g_tasks', t.client_id)) +
      '<div class="tk-chips">' + (t.domain ? '<span>' + esc(t.domain) + '</span>' : '') +
        (t.due_date ? '<span class="due' + dueCls(t.due_date) + '">יעד ' + esc(dmyDate(t.due_date)) + '</span>' : '') + '</div>' +
      '<small class="tk-meta">' + esc([t.note, made ? 'נוצרה ' + made : ''].filter(Boolean).join(' · ')) + '</small>' +
    '</div>' +
    '<button class="task-star' + (t.starred ? ' on' : '') + '" data-act="task-star" data-id="' + esc(t.client_id) +
      '" aria-pressed="' + !!t.starred + '" aria-label="עדיפות">' + icon('star') + '</button>' +
  '</div>';
}

// גוף המסך — הכל מלבד שדה החיפוש: אחראי ⟵ שלושה שלבים ⟵ הרשימה. בחיפוש בלי שלב — כל השלבים.
function tasksBodyHTML() {
  var ui = state.tasks_ui, q = String(ui.q || '').trim();
  var h = '<div class="seg seg-wide" role="tablist" aria-label="אחראי">' + ASSIGNEES.map(function (w) {
    return '<button role="tab" aria-selected="' + (w === ui.who) + '" class="' + (w === ui.who ? 'on' : '') + '" data-act="task-who" data-who="' + esc(w) + '">' +
      esc(w) + '<small>' + tasksOf(w).length + '</small></button>';
  }).join('') + '</div>';

  h += '<div class="stage-grid">' + STAGES.map(function (s) {
    var n = tasksOf(ui.who, s.id).length, on = ui.stage === s.id;
    return '<button class="stage-card ' + s.cls + (on ? ' on' : '') + '" data-act="task-stage" data-stage="' + esc(s.id) + '" aria-pressed="' + on + '">' +
      '<span class="stage-dot"></span><b>' + esc(s.id) + '</b><span class="stage-n">' + n + '</span></button>';
  }).join('') + '</div>';

  if (ui.stage || q) {
    var list = tasksOf(ui.who, ui.stage);
    // «בהרצה» — ייצוא רשימת האחראי כתמונה, בכותרת.
    var run = ui.stage === STAGES[0].id;
    h += '<section class="card"><h2>' + esc(ui.stage || 'חיפוש') + ' · ' + esc(ui.who) + '<span class="cnt">' + list.length + '</span>' +
      (run ? '<span class="sp"><button class="btn ghost xs ic" data-act="tasks-share" aria-label="ייצוא תמונה" title="ייצוא תמונה">' + icon('share') + '</button></span>' : '') + '</h2>';
    h += list.length ? list.map(taskRowHTML).join('') : emptyBox('tasks', q ? 'לא נמצאו משימות' : 'אין משימות בשלב הזה');
    h += '</section>';
  } else h += '<div class="hint stage-hint">בחרו שלב כדי לראות את המשימות.</div>';
  return h;
}

// ייצוא המשימות בהרצה של האחראי — כל המשימות שבשלב, בלי סינון החיפוש.
function tasksShare() {
  var who = state.tasks_ui.who, st = STAGES[0].id;
  var list = gSortTasks(state.tasks.filter(function (t) { return t.assignee === who && t.stage === st; }));
  if (!list.length) return;
  snapShare('<div class="snap-hd"><small>משימות ' + esc(st) + ' · ' + list.length + '</small><h2>' + esc(who) + '</h2></div>' +
    '<section class="card">' + list.map(taskRowHTML).join('') + '</section>', 'משימות ' + st + ' — ' + who);
}

function viewTasks() {
  return '<section class="card list-tools">' +
      '<label class="search-box"><input aria-label="חיפוש משימה" class="inp search" id="tasks-q" data-inp="tasks-q" placeholder="חיפוש משימה" value="' + esc(state.tasks_ui.q) + '">' +
        '<span class="search-ic">' + icon('search') + '</span></label>' +
    '</section>' +
    '<div id="tasks-body">' + tasksBodyHTML() + '</div>';
}

function formTask(t) {
  var ui = state.tasks_ui;
  var who = t ? t.assignee : ui.who, stage = t ? t.stage : (ui.stage || STAGES[0].id);
  openModal(t ? 'עריכת משימה' : 'משימה חדשה',
    '<label class="fld"><span>משימה *</span><input class="inp" id="k-title" value="' + esc(t ? t.title : '') + '"></label>' +
    '<div class="f2">' +
      '<label class="fld"><span>אחראי</span><select class="inp" id="k-who">' + ASSIGNEES.map(function (w) {
        return '<option' + (w === who ? ' selected' : '') + '>' + esc(w) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="fld"><span>שלב</span><select class="inp" id="k-stage">' + STAGES.map(function (s) {
        return '<option' + (s.id === stage ? ' selected' : '') + '>' + esc(s.id) + '</option>';
      }).join('') + '</select></label>' +
    '</div>' +
    '<div class="f2">' +
      '<label class="fld"><span>תחום</span>' + selectHTML('k-domain', lookupLabels(LK_DOMAIN), t ? t.domain : '', '— ללא —') + '</label>' +
      '<label class="fld"><span>תאריך יעד</span><input class="inp" type="date" id="k-due" value="' + esc(t && t.due_date ? t.due_date : '') + '"></label>' +
    '</div>' +
    '<label class="fld"><span>הערות</span><textarea class="inp" id="k-note">' + esc(t ? t.note || '' : '') + '</textarea></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (t ? '<button class="btn danger" data-act="task-del" data-id="' + esc(t.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="task-save" data-id="' + esc(t ? t.client_id : '') + '" data-ksave>שמירה</button>');
}

// משימה חדשה — בסוף הרשימה; הסדר הקיים נשמר כפי שהיה בגיליון.
function saveTask(id) {
  var title = val('k-title');
  if (!title) { toast(MSG_NEED_TITLE, null, 'warn'); return; }
  var row = { title: title, assignee: val('k-who'), stage: val('k-stage'), domain: nullable(val('k-domain')),
              due_date: nullable(val('k-due')), note: nullable(val('k-note')) };
  if (id) return update('g_tasks', id, row);
  return insert('g_tasks', Object.assign(row, { sort: nextSort(state.tasks), starred: false }));
}

export { formTask, saveTask, tasksBodyHTML, tasksShare, viewTasks };
