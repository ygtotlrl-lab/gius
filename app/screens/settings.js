// app/screens/settings.js — ההגדרות, המנהלים והיעד
import { dragDef, esc, lookupDragApply, openModal, toast } from '../../core/ui.js';
import { CONFIG_KEYS, LK_MANAGER, MSG_MANAGERS, MSG_MANAGER_LABEL, MSG_MANAGER_NEW, MSG_MONTH_GOAL,
         MSG_PICK_VALID_MONTH } from '../constants.js';
import { state } from '../state.js';
import { emptyBox, ils, lookupRows, monthLabel, monthTxns, num, sum, upsertBy,
         val } from '../domain.js';

// ── הגדרות ──
// המסך פתוח לכולם — אין כניסה, ואין תפקיד שאפשר לבדוק.
function viewSettings() {
  var h = '';

  // ── מנהלים ──
  // הסידור בגרירה מהידית, והסדר נכתב לכל השורות מה-DOM הסופי — במנגנון שבליבה; לחיצה על שורה פותחת עריכה.
  var mgr = lookupRows(LK_MANAGER);
  h += '<section class="card"><h2>' + esc(MSG_MANAGERS) + '<span class="cnt">' + mgr.length + '</span>' +
    '<span class="sp"><button class="btn sm" data-act="look-add" data-id="' + esc(LK_MANAGER) + '">' + esc(MSG_MANAGER_NEW) + '</button></span></h2>' +
    '<div class="hint-lead">הרשימה מזינה את שדה «מנהל מטפל» בטופס התנועה, ואת ההצעות לשגריר ולאחראי.</div>';
  if (!mgr.length) h += emptyBox('👤', 'הרשימה ריקה');
  else {
    h += '<div class="look-list">' + mgr.map(function (r) {
      return '<div class="list-item" data-act="look-edit" data-drag="' + esc(LK_MANAGER) + '" data-id="' + esc(r.client_id) + '">' +
        '<span class="grip" data-grip aria-hidden="true">⣿</span>' +
        '<span class="list-val">' + esc(r.label) + '</span></div>';
    }).join('') + '</div>';
  }
  h += '</section>';

  // ── רשימות ──
  h += '<section class="card"><h2>📋 ניהול רשימות</h2>' +
    '<div class="hint-lead">הרשימות האלו מזינות את כל התפריטים באפליקציה.</div>' +
    '<div class="grid2">';
  CONFIG_KEYS.forEach(function (c) {
    var items = state.config[c.key] || [];
    h += '<div class="list-box">' +
      '<div class="list-title">' + esc(c.label) + '</div>' +
      '<div class="list-hint">' + esc(c.hint) + '</div>';
    if (!items.length) h += '<div class="list-empty">הרשימה ריקה</div>';
    items.forEach(function (v, i) {
      h += '<div class="list-item">' +
        '<span class="list-val">' + esc(v) + '</span>' +
        '<button class="btn ghost xs" data-act="cfg-edit" data-key="' + c.key + '" data-i="' + i + '">עריכה</button>' +
        '<button class="btn danger xs" data-act="cfg-del" data-key="' + c.key + '" data-i="' + i + '">הסרה</button></div>';
    });
    h += '<div class="addrow" data-ks>' +
      '<input aria-label="ערך חדש" class="inp" id="cfg-add-' + c.key + '" placeholder="ערך חדש…">' +
      '<button class="btn sm" data-act="cfg-add" data-ksave data-key="' + c.key + '">הוספה</button></div>' +
      '</div>';
  });
  h += '</div></section>';

  // ── יעדים ──
  h += '<section class="card"><h2>🎯 יעד חודשי<span class="cnt">' + state.targets.length + '</span>' +
    '<span class="sp"><button class="btn sm" data-act="target-set">קביעת יעד</button></span></h2>';
  if (!state.targets.length) h += emptyBox('🎯', 'עדיין לא הוגדרו יעדים');
  else {
    h += '<div class="tw"><table><thead><tr><th>חודש</th><th class="num">יעד</th><th class="num">נגבה</th>' +
      '<th class="num">אחוז</th><th></th></tr></thead><tbody>';
    state.targets.forEach(function (t) {
      var got = sum(monthTxns(t.target_month), function (x) { return x.amount; });
      var pct = num(t.amount) > 0 ? got / num(t.amount) * 100 : 0;
      h += '<tr><td>' + esc(monthLabel(t.target_month)) + '</td>' +
        '<td class="num">' + ils(t.amount) + '</td><td class="num">' + ils(got) + '</td>' +
        '<td class="num">' + pct.toFixed(0) + '%</td>' +
        '<td><button class="btn ghost xs" data-act="target-set" data-month="' + esc(t.target_month) + '">עריכה</button></td></tr>';
    });
    h += '</tbody></table></div>';
  }
  h += '</section>';
  return h;
}

dragDef(LK_MANAGER, lookupDragApply);

// כפתור אחד לשני המסלולים, ומחיקה רק בעריכה — שני ליטרלים הם שני מקומות שבהם data-ksave יכול להישמט.
function lookupFormHTML(r) {
  return '<label class="fld"><span>' + esc(MSG_MANAGER_LABEL) + '</span>' +
    '<input class="inp" id="l-label" autocomplete="off" value="' + esc(r ? r.label : '') + '"></label>';
}

function lookupFootHTML(r, kind) {
  return '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (r ? '<button class="btn danger" data-act="look-del" data-id="' + esc(r.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="look-save" data-id="' + esc(r ? r.client_id : '') +
    '" data-k="' + esc(kind) + '" data-ksave>שמירה</button>';
}

function formTarget(month) {
  var m = month || state.month;
  var cur = 0;
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
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) { toast(MSG_PICK_VALID_MONTH, null, 'bad'); return Promise.resolve(); }
  var amount = num(val('tg-amount'));
  // המזהה הוא החודש — שני מכשירים שקובעים את אותו חודש מגיעים לאותה שורה.
  return upsertBy('g_targets', { client_id: m, target_month: m, amount: amount });
}

export { formTarget, lookupFootHTML, lookupFormHTML, saveTarget, viewSettings };
