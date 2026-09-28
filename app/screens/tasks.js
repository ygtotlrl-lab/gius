// app/screens/tasks.js — המשימות
import { dayToday } from '../../core/util.js';
import { errToast, idEq, pendTag, schedulePush } from '../../core/sync.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { MSG_EDIT_TASK, MSG_NEED_TITLE, MSG_NEW_TASK } from '../constants.js';
import { shell, state } from '../state.js';
import { $, datalistHTML, dmyDate, insert, nullable, pendRowKey, selectHTML, uniqSorted,
         update, val } from '../domain.js';

var STAGES = ['הכנה', 'הרצה', 'השלמה', 'חסומה'];

var STAGE_CLS = { 'הכנה': 'stage-prep', 'הרצה': 'stage-run', 'השלמה': 'stage-done', 'חסומה': 'stage-blocked' };

// ── משימות ──
// הלוח נבנה מחדש בכל רינדור — הגרירה באצלה מ-document ולא במאזין לכרטיס או לעמודה.
function viewTasks() {
  var h = '<section class="board-card card">' +
    '<h2>🗂️ משימות<span class="cnt">' + state.tasks.length + '</span>' +
    '<span class="sp"><button class="btn sm" data-act="task-new">＋ משימה</button></span></h2>' +
    '<div class="hint">גררו כרטיס בין העמודות, או שנו שלב בבורר שבתוך הכרטיס.</div>' +
  '</section><div class="kb">';

  STAGES.forEach(function (st) {
    var list = state.tasks.filter(function (t) { return t.stage === st; });
    h += '<div class="kcol" data-drop="' + esc(st) + '">' +
      '<h3><span class="dot ' + STAGE_CLS[st] + '"></span>' + esc(st) +
      '<span class="cnt">' + list.length + '</span></h3>';
    if (!list.length) h += '<div class="col-empty empty">אין משימות</div>';
    list.forEach(function (t) {
      var late = t.due_date && t.due_date < dayToday() && t.stage !== 'השלמה';
      h += '<div class="kcard" data-drag="task" data-id="' + t.client_id + '">' +
        '<span class="grip" data-grip aria-hidden="true">⣿</span>' +
        '<b>' + esc(t.title) + '</b>' + pendTag(pendRowKey('g_tasks', t.client_id)) +
        '<div class="meta">' +
          (t.assignee ? '<span class="badge brand">' + esc(t.assignee) + '</span>' : '') +
          (t.domain ? '<span class="badge">' + esc(t.domain) + '</span>' : '') +
          (t.due_date ? '<span class="badge ' + (late ? 'bad' : '') + '">' + esc(dmyDate(t.due_date)) + '</span>' : '') +
          (t.log ? '<span class="logdot" title="יש רישום ביומן">✎</span>' : '') +
        '</div>' +
        '<div class="ft">' +
          '<select data-chg="stage" aria-label="שלב המשימה" data-id="' + t.client_id + '">' +
            STAGES.map(function (s) {
              return '<option value="' + esc(s) + '"' + (s === t.stage ? ' selected' : '') + '>' + esc(s) + '</option>';
            }).join('') +
          '</select>' +
          '<button class="btn ghost xs" data-act="task-open" data-id="' + t.client_id + '">פתיחה</button>' +
        '</div>' +
      '</div>';
    });
    h += '</div>';
  });
  return h + '</div>';
}

function kdragCol(x, y) {
  var over = document.elementFromPoint(x, y);
  return over && over.closest ? over.closest('[data-drop]') : null;
}

// עדכון אופטימי עם החזרה — update נכשלת רק כשהכתיבה המקומית נכשלה, ואז הכרטיס שעל המסך משקר.
function moveTask(id, stage) {
  var t = null;
  for (var i = 0; i < state.tasks.length; i++) if (idEq(state.tasks[i].id, id)) t = state.tasks[i];
  if (!t || t.stage === stage) return;
  var prev = t.stage;
  t.stage = stage;
  shell.render();
  Promise.resolve().then(function () { return update('g_tasks', id, { stage: stage }); })
    .then(function () { schedulePush(); })
    .catch(function (e) { t.stage = prev; shell.render(); errToast(e); });
}

function formTask(existing) {
  var t = existing || {};
  var people = uniqSorted(state.users.filter(function (u) { return u.active; })
    .map(function (u) { return u.full_name; }));
  var body =
    '<label class="fld"><span>כותרת *</span><input class="inp" id="tk-title" value="' + esc(t.title || '') + '"></label>' +
    '<div class="f2">' +
      '<label class="fld"><span>שלב</span>' + selectHTML('tk-stage', STAGES, t.stage || 'הכנה', 'הכנה') + '</label>' +
      '<label class="fld"><span>אחראי</span><input class="inp" id="tk-assignee" list="dl-people" value="' +
        esc(t.assignee != null ? t.assignee : (t.client_id ? '' : state.user.full_name)) + '"></label>' +
    '</div>' +
    '<div class="f2">' +
      '<label class="fld"><span>תחום</span>' + selectHTML('tk-domain', state.config.domains, t.domain, '— ללא תחום —') + '</label>' +
      '<label class="fld"><span>תאריך יעד</span><input class="inp" type="date" id="tk-due" value="' + esc(t.due_date || '') + '"></label>' +
    '</div>' +
    (t.log ? '<div class="fld"><span>יומן</span><pre class="log">' + esc(t.log) + '</pre></div>' : '') +
    '<label class="fld"><span>הוספה ליומן</span>' +
      '<textarea aria-label="רישום חדש ליומן" class="inp" id="tk-log" placeholder="רישום חדש — יתווסף ליומן עם תאריך ושם…"></textarea></label>' +
    datalistHTML('dl-people', people);

  var foot = '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (t.client_id ? '<button class="btn danger" data-act="task-del" data-id="' + t.client_id + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="task-save" data-ksave data-id="' + (t.client_id || '') + '">שמירה</button>';

  openModal(t.client_id ? MSG_EDIT_TASK : MSG_NEW_TASK, body, foot);
  var titleEl = $('#tk-title');
  if (titleEl && !t.client_id) titleEl.focus();
}

function saveTask(id) {
  var title = val('tk-title');
  if (!title) { toast(MSG_NEED_TITLE, null, 'bad'); return Promise.resolve(); }
  var existing = null;
  for (var i = 0; i < state.tasks.length; i++) if (idEq(state.tasks[i].id, id)) existing = state.tasks[i];

  var row = {
    title: title,
    stage: val('tk-stage') || 'הכנה',
    assignee: nullable(val('tk-assignee')),
    domain: nullable(val('tk-domain')),
    due_date: nullable(val('tk-due'))
  };
  // היומן מצטבר ולא נדרס — row.log = entry היה מוחק את כל היסטוריית הטיפול, ואין גרסאות לשחזר ממנה.
  var entry = val('tk-log');
  if (entry) {
    var stamp = '[' + dmyDate(dayToday()) + ' · ' + state.user.full_name + ']';
    var prev = (existing && existing.log) ? existing.log + '\n' : '';
    row.log = prev + stamp + ' ' + entry;
  }
  return id ? update('g_tasks', id, row) : insert('g_tasks', row);
}

export { formTask, kdragCol, moveTask, saveTask, viewTasks };
