// app/screens/tasks.js — המשימות: אחראי ⟵ שלושה שלבים ⟵ הרשימה
import { pendTag } from '../../core/sync.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { ASSIGNEES, LK_DOMAIN, MSG_NEED_TITLE, STAGES } from '../constants.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
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

function taskRowHTML(t) {
  var meta = [t.domain, t.note].filter(Boolean).join(' · ') || '—', made = createdLabel(t);
  return '<div class="row' + (t.starred ? ' star' : '') + '" data-act="task-open" data-id="' + esc(t.client_id) + '">' +
    '<span class="stage-dot ' + stageOf(t.stage).cls + '"></span>' +
    '<div class="main"><b>' + esc(t.title) + pendTag(pendRowKey('g_tasks', t.client_id)) + '</b>' +
      '<small>' + esc(meta) + '</small></div>' +
    '<div class="end">' + (t.due_date ? '<span class="badge">' + esc(dmyDate(t.due_date)) + '</span>' : '') +
      (made ? '<small>נוצרה ' + esc(made) + '</small>' : '') + '</div>' +
    '<button class="task-star' + (t.starred ? ' on' : '') + '" data-act="task-star" data-id="' + esc(t.client_id) +
      '" aria-pressed="' + !!t.starred + '" aria-label="עדיפות">' + (t.starred ? '★' : '☆') + '</button>' +
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
    h += '<section class="card"><h2>' + esc(ui.stage || 'חיפוש') + ' · ' + esc(ui.who) + '<span class="cnt">' + list.length + '</span></h2>';
    h += list.length ? list.map(taskRowHTML).join('') : emptyBox('☑', q ? 'לא נמצאו משימות' : 'אין משימות בשלב הזה');
    h += '</section>';
  } else h += '<div class="hint stage-hint">בחרו שלב כדי לראות את המשימות.</div>';
  return h;
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
  if (!title) { toast(MSG_NEED_TITLE, null, 'bad'); return; }
  var row = { title: title, assignee: val('k-who'), stage: val('k-stage'), domain: nullable(val('k-domain')),
              due_date: nullable(val('k-due')), note: nullable(val('k-note')) };
  if (id) return update('g_tasks', id, row);
  return insert('g_tasks', Object.assign(row, { sort: nextSort(state.tasks), starred: false }));
}

export { formTask, saveTask, tasksBodyHTML, viewTasks };
