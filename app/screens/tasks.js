// app/screens/tasks.js — המשימות: אחראי ⟵ «בעבודה» פרוסה בחלקים ⟵ «הושלמו» ו«לא רלוונטיות» בכפתורים
import { pendTag } from '../../core/sync.js';
import { ask, esc, openModal, toast } from '../../core/ui.js';
import { dayAdd, dayToday } from '../../core/util.js';
import { gauthUser } from '../../core/gauth.js';
import { LK_DOMAIN, MSG_NEED_TITLE, MSG_TASK_BACK_ACT, MSG_TASK_BACK_Q, MSG_TASK_DONE_ACT, MSG_TASK_DONE_Q, MSG_TASK_NEXT,
         STAGES, TASK_SECTIONS, TASK_SOON_DAYS, TTL_TASK_EDIT, TTL_TASK_NEW } from '../constants.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import { snapShare } from '../../core/snap.js';
import { assigneeList, assigneeNames, dmyDate, emptyBox, gSortTasks, insert, lookupLabels, nextSort, nullable, pendRowKey,
         selectHTML, update, val } from '../domain.js';

var TBL = 'g_tasks';
var RUN = STAGES[0].id, DONE = STAGES[1].id, OFF = STAGES[2].id;

function stageOf(id) {
  for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return STAGES[i];
  return STAGES[0];
}
function taskById(id) {
  for (var i = 0; i < state.tasks.length; i++) if (state.tasks[i].client_id === id) return state.tasks[i];
  return null;
}

// האחראי שהמסך נפתח בו — מי שנכנס, אם הוא אחד האחראים (לפי המייל שבהגדרות), ובלעדיו — הראשון
function myAssignee() {
  var u = gauthUser(), list = assigneeList();
  for (var i = 0; u && i < list.length; i++) if (String(list[i].login || '').toLowerCase() === String(u.login || '').toLowerCase()) return list[i].name;
  return list.length ? list[0].name : '';
}
function curWho() {
  var names = assigneeNames();
  if (names.indexOf(state.tasks_ui.who) < 0) state.tasks_ui.who = myAssignee();
  return state.tasks_ui.who;
}

// החיפוש — בשם המשימה; והמונים בלשוניות סופרים את מה שנמצא
function tasksOf(who, stage) {
  var q = String(state.tasks_ui.q || '').trim().toLowerCase();
  return state.tasks.filter(function (t) {
    return t.assignee === who && (!stage || t.stage === stage) &&
      (!q || String(t.title || '').toLowerCase().indexOf(q) >= 0);
  });
}

// ── «בעבודה» בחלקים: החודש הקרוב · עבר זמנן · ללא תאריך · מאוחר יותר ──
function sectionOf(t) {
  if (!t.due_date) return 'none';
  var today = dayToday();
  if (t.due_date < today) return 'late';
  return t.due_date <= dayAdd(today, TASK_SOON_DAYS) ? 'soon' : 'later';
}
// בתוך חלק — קבוצה לכל סוג (בסדר התחומים שבהגדרות, ובלי סוג בסוף), ובתוכה העדיפות בראש, ואז התאריך והשעה
function byDue(a, b) {
  var x = (a.due_date || '9999') + (a.due_time || '99'), y = (b.due_date || '9999') + (b.due_time || '99');
  return x < y ? -1 : x > y ? 1 : 0;
}
function domainGroups(list) {
  var doms = lookupLabels(LK_DOMAIN), keys = [];
  list.forEach(function (t) { var k = t.domain || ''; if (keys.indexOf(k) < 0) keys.push(k); });
  keys.sort(function (a, b) {
    var ia = a ? doms.indexOf(a) : 1e6, ib = b ? doms.indexOf(b) : 1e6;
    if (ia < 0) ia = 1e5; if (ib < 0) ib = 1e5;
    return ia - ib || (a < b ? -1 : a > b ? 1 : 0);
  });
  return keys.map(function (k) {
    var items = gSortTasks(list.filter(function (t) { return (t.domain || '') === k; }));
    items.sort(function (a, b) { return ((b.starred ? 1 : 0) - (a.starred ? 1 : 0)) || byDue(a, b); });
    return { name: k, items: items };
  });
}
function groupsHTML(list) {
  return domainGroups(list).map(function (g) {
    return '<div class="tk-dom"><h3>' + esc(g.name || 'ללא סוג') + '<span class="cnt">' + g.items.length + '</span></h3>' +
      g.items.map(taskRowHTML).join('') + '</div>';
  }).join('');
}

// חודש היצירה — בשעון המקומי; created_at נשמר ב-UTC, ובקצה החודש החיתוך שלו נופל על החודש הקודם.
function createdLabel(t) {
  var d = t.created_at ? new Date(t.created_at) : null;
  return d && !isNaN(d) ? (d.getMonth() + 1) + '/' + d.getFullYear() : '';
}
// התאריך — שעבר באדום, ושבוע קרוב בזהב; ואחריו השעה והחזרה
function dueCls(iso) {
  if (!iso) return '';
  var d = new Date(iso + 'T12:00:00'), now = new Date(), days = (d - now) / 864e5;
  return days < -0.5 ? ' late' : days <= 7 ? ' soon' : '';
}
function dueLabel(t) {
  return [dmyDate(t.due_date), t.due_time || ''].filter(Boolean).join(' · ');
}
// תת-משימות — כמו בגוגל טאסקים: עיגול קטן לכל אחת, ולחיצה עליו מסמנת «הושלם» בלי לפתוח את המשימה;
// ובשבבים — כמה הושלמו מתוך כולן. נשמרות במשימה עצמה (`subtasks`: מזהה · כותרת · הושלם).
function subsOf(t) { return Array.isArray(t.subtasks) ? t.subtasks.filter(function (x) { return x && x.title; }) : []; }
function subsHTML(t) {
  var subs = subsOf(t);
  if (!subs.length) return '';
  return '<ul class="tk-subs">' + subs.map(function (x) {
    return '<li class="tk-sub' + (x.done ? ' done' : '') + '"><button class="sub-dot" data-act="task-sub" data-id="' + esc(t.client_id) + '" data-sid="' + esc(x.id) +
      '" aria-pressed="' + !!x.done + '" aria-label="' + esc((x.done ? 'בטל סימון: ' : 'סימון כהושלם: ') + x.title) + '">' + icon('check') + '</button>' +
      '<span>' + esc(x.title) + '</span></li>';
  }).join('') + '</ul>';
}
function taskSubToggle(el) {
  var t = taskById(el.dataset.id);
  if (!t) return;
  var subs = subsOf(t).map(function (x) { return x.id === el.dataset.sid ? Object.assign({}, x, { done: !x.done }) : x; });
  return update(TBL, t.client_id, { subtasks: subs });
}
// שורת משימה — עיגול בצבע השלב (לחיצה שואלת), הכותרת, וכוכב העדיפות בקצה; ושבבים: הסוג, התאריך והשעה, והחזרה
function taskRowHTML(t) {
  var st = stageOf(t.stage), made = createdLabel(t), subs = subsOf(t);
  var nDone = subs.filter(function (x) { return x.done; }).length;
  return '<div class="tk ' + st.cls + '" data-act="task-open" data-id="' + esc(t.client_id) + '">' +
    '<button class="tk-check ' + st.cls + '" data-act="task-step" data-id="' + esc(t.client_id) + '" aria-label="' + esc('שלב: ' + st.id) + '" title="' + esc(st.id) + '">' +
      icon(st.cls === 'off' ? 'close' : 'check') + '</button>' +
    '<div class="tk-main"><b>' + esc(t.title) + '</b>' +
      pendTag(pendRowKey(TBL, t.client_id)) +
      '<div class="tk-chips">' +
        (subs.length ? '<span class="tk-prog' + (nDone === subs.length ? ' all' : '') + '">' + icon('check') + nDone + '/' + subs.length + '</span>' : '') +
        (t.due_date ? '<span class="due' + (t.stage === RUN ? dueCls(t.due_date) : '') + '">' + icon('calendar') + esc(dueLabel(t)) + '</span>' : '') +
        (t.repeat ? '<span class="tk-rep" title="' + esc(repeatLabel(t.repeat)) + '">' + icon('repeat') + esc(repeatLabel(t.repeat)) + '</span>' : '') + '</div>' +
      '<small class="tk-meta">' + esc([t.note, made ? 'נוצרה ' + made : ''].filter(Boolean).join(' · ')) + '</small>' +
      subsHTML(t) +
    '</div>' +
    '<button class="task-star' + (t.starred ? ' on' : '') + '" data-act="task-star" data-id="' + esc(t.client_id) +
      '" aria-pressed="' + !!t.starred + '" aria-label="עדיפות">' + icon('star') + '</button>' +
  '</div>';
}

// גוף המסך — הכל מלבד שדה החיפוש: לשונית לכל אחראי ⟵ «בעבודה» בחלקים ⟵ שני הכפתורים, והחלק שנפתח מהם
function tasksBodyHTML() {
  var ui = state.tasks_ui, who = curWho(), names = assigneeNames(), q = String(ui.q || '').trim();
  var h = '<div class="seg seg-wide" role="tablist" aria-label="אחראי">' + names.map(function (w) {
    return '<button role="tab" aria-selected="' + (w === who) + '" class="' + (w === who ? 'on' : '') + '" data-act="task-who" data-who="' + esc(w) + '">' +
      esc(w) + '<small>' + tasksOf(w, RUN).length + '</small></button>';
  }).join('') + '</div>';
  if (!who) return h + emptyBox('tasks', 'אין אחראים למשימות');

  var run = tasksOf(who, RUN), any = false;
  TASK_SECTIONS.forEach(function (s) {
    var list = run.filter(function (t) { return sectionOf(t) === s[0]; });
    if (!list.length) return;
    any = true;
    h += '<section class="card tk-sec tk-' + s[0] + '"><h2>' + esc(s[1]) + '<span class="cnt">' + list.length + '</span></h2>' + groupsHTML(list) + '</section>';
  });
  if (!any) h += '<section class="card">' + emptyBox('tasks', q ? 'לא נמצאו משימות בעבודה' : 'אין משימות בעבודה') + '</section>';

  // «הושלמו» ו«לא רלוונטי» — כפתור לכל אחד, ולחיצה פורשת אותן באותה צורה; לחיצה נוספת סוגרת
  h += '<div class="tk-more">' + [[DONE, 'הושלמו', 'done'], [OFF, 'לא רלוונטי', 'off']].map(function (x) {
    var n = tasksOf(who, x[0]).length, on = ui.extra === x[0];
    return '<button class="tk-more-btn ' + x[2] + (on ? ' on' : '') + '" data-act="task-extra" data-stage="' + esc(x[0]) + '" aria-expanded="' + on + '">' +
      '<span class="stage-dot"></span>' + esc(x[1]) + '<span class="cnt">' + n + '</span>' + icon(on ? 'up' : 'down') + '</button>';
  }).join('') + '</div>';
  if (ui.extra) {
    var ex = tasksOf(who, ui.extra);
    h += '<section class="card tk-sec"><h2>' + esc(ui.extra === DONE ? 'הושלמו' : 'לא רלוונטי') + '<span class="cnt">' + ex.length + '</span></h2>' +
      (ex.length ? groupsHTML(ex) : emptyBox('tasks', 'אין משימות כאן')) + '</section>';
  }
  return h;
}

// ייצוא המשימות בעבודה של האחראי — בחלקים, כמו במסך, בלי סינון החיפוש.
function tasksShare() {
  var who = curWho();
  var run = state.tasks.filter(function (t) { return t.assignee === who && t.stage === RUN; });
  if (!run.length) return;
  var body = TASK_SECTIONS.map(function (s) {
    var list = run.filter(function (t) { return sectionOf(t) === s[0]; });
    return list.length ? '<section class="card tk-sec"><h2>' + esc(s[1]) + '<span class="cnt">' + list.length + '</span></h2>' + groupsHTML(list) + '</section>' : '';
  }).join('');
  snapShare('<div class="snap-hd"><small>משימות ' + esc(RUN) + ' · ' + run.length + '</small><h2>' + esc(who) + '</h2></div>' + body, 'משימות ' + RUN + ' — ' + who);
}

function viewTasks() {
  return '<section class="card list-tools">' +
      '<div class="tk-tools"><label class="search-box"><input aria-label="חיפוש משימה" class="inp search" id="tasks-q" data-inp="tasks-q" placeholder="חיפוש משימה" value="' + esc(state.tasks_ui.q) + '">' +
        '<span class="search-ic">' + icon('search') + '</span></label>' +
      '<button class="btn ghost ic" data-act="tasks-share" aria-label="ייצוא תמונה" title="ייצוא תמונה">' + icon('share') + '</button></div>' +
    '</section>' +
    '<div id="tasks-body">' + tasksBodyHTML() + '</div>';
}

// ── העיגול — שואל: בעבודה ⟵ הושלמה, ומהושלמה או מלא רלוונטית — חזרה לעבודה ──
// משימה חוזרת שהושלמה — נוצרת מיד המשימה הבאה, בתאריך הבא, כמו בגוגל טאסקים.
function taskStep(id) {
  var t = taskById(id);
  if (!t) return Promise.resolve();
  var toDone = t.stage === RUN;
  return ask(toDone ? MSG_TASK_DONE_Q : MSG_TASK_BACK_Q, t.title, toDone ? MSG_TASK_DONE_ACT : MSG_TASK_BACK_ACT, toDone ? 'ok' : null).then(function (yes) {
    if (!yes) return false;
    if (!toDone) return update(TBL, t.client_id, { stage: RUN }).then(function () { return true; });
    var nx = t.repeat && t.due_date ? repeatNext(t.due_date, t.repeat) : null;
    return update(TBL, t.client_id, { stage: DONE, repeat: null }).then(function () {
      if (!nx) return true;
      var rep = Object.assign({}, t.repeat);
      if (rep.end === 'count') rep.left = Math.max(0, (+rep.left || +rep.count || 1) - 1);
      return insert(TBL, { title: t.title, assignee: t.assignee, stage: RUN, domain: t.domain || null, note: t.note || null,
        due_date: nx, due_time: t.due_time || null, repeat: rep, starred: !!t.starred, sort: nextSort(state.tasks),
        subtasks: subsOf(t).map(function (x) { return Object.assign({}, x, { done: false }); }) }).then(function () {
        toast(MSG_TASK_NEXT + dmyDate(nx), null, 'ok');
        return true;
      });
    });
  });
}

// ── חזרה ──
// repeat: every · unit (day/week/month/year) · days (0–6, בשבוע) · end (never/date/count) · date · count · left (כמה נשארו)
var UNITS = [['day', 'יום', 'ימים'], ['week', 'שבוע', 'שבועות'], ['month', 'חודש', 'חודשים'], ['year', 'שנה', 'שנים']];
var DOW = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
var MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
function unitOf(u) { for (var i = 0; i < UNITS.length; i++) if (UNITS[i][0] === u) return UNITS[i]; return UNITS[0]; }
function repeatLabel(r) {
  if (!r) return '';
  var n = +r.every || 1, u = unitOf(r.unit);
  var s = n === 1 ? 'כל ' + u[1] : 'כל ' + n + ' ' + u[2];
  if (r.unit === 'week' && Array.isArray(r.days) && r.days.length) s += ' · ' + r.days.slice().sort().map(function (d) { return DOW[d]; }).join(' ');
  if (r.end === 'date' && r.date) s += ' · עד ' + dmyDate(r.date);
  if (r.end === 'count') s += ' · עוד ' + (+r.left || +r.count || 1);
  return s;
}
function isoOf(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function addMonths(iso, n) {
  var p = iso.split('-').map(Number), y = p[0], m = p[1] - 1 + n, day = p[2];
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  var last = new Date(y, m + 1, 0).getDate();
  return isoOf(new Date(y, m, Math.min(day, last)));
}
// התאריך הבא אחרי from — ובלעדיו (נגמרה החזרה) null
function repeatNext(from, r) {
  var n = Math.max(1, +r.every || 1), nx;
  if (r.unit === 'day') nx = dayAdd(from, n);
  else if (r.unit === 'month') nx = addMonths(from, n);
  else if (r.unit === 'year') nx = addMonths(from, 12 * n);
  else {
    var days = Array.isArray(r.days) && r.days.length ? r.days.slice().sort() : [new Date(from + 'T12:00:00').getDay()];
    var cur = new Date(from + 'T12:00:00').getDay(), later = days.filter(function (d) { return d > cur; });
    nx = later.length ? dayAdd(from, later[0] - cur) : dayAdd(from, 7 * n - cur + days[0]);
  }
  if (r.end === 'date' && r.date && nx > r.date) return null;
  if (r.end === 'count' && (+r.left || +r.count || 1) <= 1) return null;
  return nx;
}

// ── בורר התאריך, השעה והחזרה — כמו בגוגל טאסקים: לוח חודש, «הגדרת שעה», «חוזר», ו«סיום» ──
// הבחירה בזיכרון עד השמירה (_dt), והטופס מציג את תקצירה בכפתור אחד.
var _dt = null;
function dtSummary() {
  if (!_dt || !_dt.date) return 'ללא תאריך';
  var d = new Date(_dt.date + 'T12:00:00');
  return ['יום ' + DOW[d.getDay()] + ' ' + dmyDate(_dt.date), _dt.time || '', _dt.repeat ? repeatLabel(_dt.repeat) : ''].filter(Boolean).join(' · ');
}
function dtCalHTML() {
  var v = _dt.view.split('-').map(Number), y = v[0], m = v[1] - 1;
  var first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), today = dayToday();
  var cells = '';
  for (var i = 0; i < first; i++) cells += '<span></span>';
  for (var d = 1; d <= days; d++) {
    var iso = isoOf(new Date(y, m, d));
    cells += '<button type="button" class="dtp-d' + (iso === _dt.date ? ' on' : '') + (iso === today ? ' today' : '') + '" data-act="dtp-day" data-day="' + iso + '">' + d + '</button>';
  }
  return '<div class="dtp-hd"><b>' + MONTHS[m] + ' ' + y + '</b>' +
      '<button type="button" class="btn ghost sm ic" data-act="dtp-mon" data-n="-1" aria-label="החודש הקודם">' + icon('prev') + '</button>' +
      '<button type="button" class="btn ghost sm ic" data-act="dtp-mon" data-n="1" aria-label="החודש הבא">' + icon('next') + '</button></div>' +
    '<div class="dtp-grid">' + DOW.map(function (x) { return '<span class="dtp-w">' + x + '</span>'; }).join('') + cells + '</div>';
}
function dtRepeatHTML() {
  var r = _dt.repeat;
  var h = '<label class="dtp-row">' + icon('repeat') + '<select class="inp" id="dtp-rep" data-inp="dtp-rep">' +
    [['', 'לא חוזר'], ['day', 'כל יום'], ['week', 'כל שבוע'], ['month', 'כל חודש'], ['year', 'כל שנה'], ['custom', 'מותאם אישית…']].map(function (o) {
      var sel = !r ? o[0] === '' : _dt.custom ? o[0] === 'custom' : o[0] === r.unit;
      return '<option value="' + o[0] + '"' + (sel ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select></label>';
  if (r && _dt.custom) {
    h += '<div class="dtp-custom">' +
      '<div class="dtp-row"><span>כל</span><input class="inp dtp-n" type="number" min="1" id="dtp-every" data-inp="dtp-c" value="' + (+r.every || 1) + '">' +
        '<select class="inp" id="dtp-unit" data-inp="dtp-c">' + UNITS.map(function (u) { return '<option value="' + u[0] + '"' + (u[0] === r.unit ? ' selected' : '') + '>' + u[2] + '</option>'; }).join('') + '</select></div>' +
      (r.unit === 'week' ? '<div class="dtp-days">' + DOW.map(function (x, i) {
        var on = (r.days || []).indexOf(i) >= 0;
        return '<button type="button" class="dtp-dow' + (on ? ' on' : '') + '" data-act="dtp-dow" data-d="' + i + '" aria-pressed="' + on + '">' + x + '</button>';
      }).join('') + '</div>' : '') +
      '<div class="dtp-end"><span>מסתיים</span>' +
        '<label><input type="radio" name="dtp-end" value="never" data-inp="dtp-c"' + (r.end === 'never' ? ' checked' : '') + '>אף פעם</label>' +
        '<label><input type="radio" name="dtp-end" value="date" data-inp="dtp-c"' + (r.end === 'date' ? ' checked' : '') + '>בתאריך <input class="inp" type="date" id="dtp-until" data-inp="dtp-c" value="' + esc(r.date || '') + '"></label>' +
        '<label><input type="radio" name="dtp-end" value="count" data-inp="dtp-c"' + (r.end === 'count' ? ' checked' : '') + '>אחרי <input class="inp dtp-n" type="number" min="1" id="dtp-count" data-inp="dtp-c" value="' + (+r.count || 10) + '"> פעמים</label>' +
      '</div></div>';
  }
  return h;
}
function dtPanelHTML() {
  return dtCalHTML() +
    '<label class="dtp-row">' + icon('clock') + '<input class="inp" type="time" id="dtp-time" data-inp="dtp-time" value="' + esc(_dt.time || '') + '" aria-label="הגדרת שעה">' +
      '<small>' + (_dt.time ? 'תזכורת בשעה הזו' : 'בלי שעה — התזכורת ב-10:00') + '</small></label>' +
    dtRepeatHTML() +
    '<div class="dtp-ft"><button type="button" class="btn ghost sm" data-act="dtp-clear">ניקוי</button>' +
      '<button type="button" class="btn sm" data-act="dtp-done">סיום</button></div>';
}
function dtRedraw() {
  var b = document.getElementById('k-dt-sum'); if (b) b.textContent = dtSummary();
  var p = document.getElementById('k-dtp'); if (p && !p.hidden) p.innerHTML = dtPanelHTML();
}
function dtToggle() {
  var p = document.getElementById('k-dtp');
  if (!p) return;
  p.hidden = !p.hidden;
  if (!p.hidden) { if (!_dt.view) _dt.view = (_dt.date || dayToday()).slice(0, 7); p.innerHTML = dtPanelHTML(); }
}
function dtDay(el) { _dt.date = el.dataset.day; dtRedraw(); }
function dtMon(el) {
  var v = _dt.view.split('-').map(Number), d = new Date(v[0], v[1] - 1 + (+el.dataset.n), 1);
  _dt.view = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
  dtRedraw();
}
function dtDow(el) {
  var d = +el.dataset.d, days = (_dt.repeat.days || []).slice(), i = days.indexOf(d);
  if (i >= 0) { if (days.length > 1) days.splice(i, 1); } else days.push(d);
  _dt.repeat.days = days.sort();
  dtRedraw();
}
// שדה בבורר — השעה, סוג החזרה, והמותאם אישית
function dtInput(el) {
  var k = el.dataset.inp;
  if (k === 'dtp-time') { _dt.time = el.value || ''; var b = document.getElementById('k-dt-sum'); if (b) b.textContent = dtSummary(); return; }
  if (k === 'dtp-rep') {
    var v = el.value, base = _dt.date || dayToday();
    if (!v) { _dt.repeat = null; _dt.custom = false; }
    else if (v === 'custom') { _dt.repeat = _dt.repeat || { every: 1, unit: 'week', days: [new Date(base + 'T12:00:00').getDay()], end: 'never' }; _dt.custom = true; }
    else { _dt.repeat = { every: 1, unit: v, days: v === 'week' ? [new Date(base + 'T12:00:00').getDay()] : [], end: 'never' }; _dt.custom = false; }
    if (_dt.repeat && !_dt.date) _dt.date = base;
    dtRedraw();
    return;
  }
  if (k === 'dtp-c' && _dt.repeat) {
    var r = _dt.repeat, endEl = document.querySelector('input[name="dtp-end"]:checked');
    r.every = Math.max(1, +val('dtp-every') || 1);
    var unit = val('dtp-unit') || r.unit;
    if (unit !== r.unit) { r.unit = unit; r.days = unit === 'week' ? [new Date((_dt.date || dayToday()) + 'T12:00:00').getDay()] : []; }
    r.end = endEl ? endEl.value : 'never';
    r.date = r.end === 'date' ? val('dtp-until') : '';
    r.count = r.end === 'count' ? Math.max(1, +val('dtp-count') || 1) : 0;
    r.left = r.count;
    if (el.tagName === 'SELECT' || el.type === 'radio') dtRedraw();
    else { var s = document.getElementById('k-dt-sum'); if (s) s.textContent = dtSummary(); }
  }
}
function dtClear() { _dt.date = ''; _dt.time = ''; _dt.repeat = null; _dt.custom = false; dtRedraw(); }
function dtDone() { var p = document.getElementById('k-dtp'); if (p) p.hidden = true; }

function formTask(t) {
  var who = t ? t.assignee : curWho(), stage = t ? t.stage : RUN;
  var rep = t && t.repeat ? Object.assign({}, t.repeat) : null;
  _dt = { date: t && t.due_date ? t.due_date : '', time: t && t.due_time ? t.due_time : '', repeat: rep, view: '',
          custom: !!(rep && (rep.every > 1 || rep.end !== 'never' || (rep.unit === 'week' && rep.days && rep.days.length > 1))) };
  var names = assigneeNames();
  if (who && names.indexOf(who) < 0) names = names.concat([who]);
  openModal(t ? TTL_TASK_EDIT : TTL_TASK_NEW,
    '<label class="fld"><span>משימה *</span><input class="inp" id="k-title" value="' + esc(t ? t.title : '') + '"></label>' +
    '<div class="f2">' +
      '<label class="fld"><span>אחראי</span><select class="inp" id="k-who">' + names.map(function (w) {
        return '<option' + (w === who ? ' selected' : '') + '>' + esc(w) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="fld"><span>שלב</span><select class="inp" id="k-stage">' + STAGES.map(function (s) {
        return '<option' + (s.id === stage ? ' selected' : '') + '>' + esc(s.id) + '</option>';
      }).join('') + '</select></label>' +
    '</div>' +
    '<label class="fld"><span>תחום</span>' + selectHTML('k-domain', lookupLabels(LK_DOMAIN), t ? t.domain : '', '— ללא —') + '</label>' +
    '<div class="fld"><span>תאריך, שעה וחזרה</span>' +
      '<button type="button" class="inp dt-btn" data-act="dtp-open">' + icon('calendar') + '<span id="k-dt-sum">' + esc(dtSummary()) + '</span></button>' +
      '<div id="k-dtp" class="dtp" hidden></div></div>' +
    '<label class="fld"><span>הערות</span><textarea class="inp" id="k-note">' + esc(t ? t.note || '' : '') + '</textarea></label>' +
    '<div class="fld"><span>תת-משימות</span><div id="k-subs" class="sub-eds">' + (t ? subsOf(t) : []).map(subEdHTML).join('') + '</div>' +
      '<button type="button" class="btn ghost sm sub-add" data-act="sub-add">' + icon('plus') + 'תת-משימה</button></div>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (t ? '<button class="btn danger" data-act="task-del" data-id="' + esc(t.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="task-save" data-id="' + esc(t ? t.client_id : '') + '" data-ksave>' + icon('save') + 'שמירה</button>');
}

// שורה בעורך — העיגול (הסימון נשמר עם המשימה), הכותרת והסרה; Enter בשורה פותח את הבאה
function subEdHTML(x) {
  x = x || { id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: '', done: false };
  return '<div class="sub-ed' + (x.done ? ' done' : '') + '" data-sid="' + esc(x.id) + '" data-done="' + (x.done ? '1' : '') + '">' +
    '<button type="button" class="sub-dot" data-act="sub-ed-dot" aria-label="הושלם">' + icon('check') + '</button>' +
    '<input class="inp sub-in" data-key="sub-in" value="' + esc(x.title) + '" placeholder="תת-משימה" aria-label="תת-משימה">' +
    '<button type="button" class="sub-rm" data-act="sub-rm" aria-label="הסרה">' + icon('close') + '</button></div>';
}
function subAdd() {
  var box = document.getElementById('k-subs');
  if (!box) return;
  box.insertAdjacentHTML('beforeend', subEdHTML(null));
  var ins = box.querySelectorAll('.sub-in');
  if (ins.length) ins[ins.length - 1].focus();
}
function subRm(el) { var r = el.closest('.sub-ed'); if (r) r.remove(); }
function subEdDot(el) {
  var r = el.closest('.sub-ed');
  if (!r) return;
  var on = r.dataset.done !== '1';
  r.dataset.done = on ? '1' : '';
  r.classList.toggle('done', on);
}
function readSubs() {
  return Array.prototype.map.call(document.querySelectorAll('#k-subs .sub-ed'), function (r) {
    var i = r.querySelector('.sub-in');
    return { id: r.dataset.sid, title: i ? i.value.trim() : '', done: r.dataset.done === '1' };
  }).filter(function (x) { return x.title; });
}

// משימה חדשה — בסוף הרשימה; התאריך, השעה והחזרה — מהבורר
function saveTask(id) {
  var title = val('k-title');
  if (!title) { toast(MSG_NEED_TITLE, null, 'warn'); return; }
  var d = _dt || {};
  var rep = d.date && d.repeat ? Object.assign({}, d.repeat) : null;
  if (rep && rep.end === 'count' && !rep.left) rep.left = rep.count;
  var row = { title: title, assignee: val('k-who'), stage: val('k-stage'), domain: nullable(val('k-domain')),
              due_date: nullable(d.date || ''), due_time: d.date ? nullable(d.time || '') : null, repeat: rep,
              note: nullable(val('k-note')), subtasks: readSubs() };
  if (id) return update(TBL, id, row);
  return insert(TBL, Object.assign(row, { sort: nextSort(state.tasks), starred: false }));
}

export { dtClear, dtDay, dtDone, dtDow, dtInput, dtMon, dtToggle, formTask, saveTask, subAdd, subEdDot, subRm, taskStep,
         taskSubToggle, tasksBodyHTML, tasksShare, viewTasks };
