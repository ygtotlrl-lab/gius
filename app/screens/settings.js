// app/screens/settings.js — ההגדרות, המשתמשים והיעד
import { MSG_OFF_USER_WRITE, MSG_PASS_SIX } from '../../core/util.js';
import { plTouch } from '../../core/sync.js';
import { authPassFields, isAdmin, isAdminOf, writeUser } from '../../core/auth.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { CONFIG_KEYS, MSG_EDIT_USER, MSG_MONTH_GOAL, MSG_NEED_FULL_AND_USER,
         MSG_NEED_PASS, MSG_NEW_USER, MSG_PASS_CHANGE_FOR, MSG_PICK_VALID_MONTH,
         PASS_SIX_RE } from '../constants.js';
import { state } from '../state.js';
import { $, checked, emptyBox, ils, monthLabel, monthTxns, num, sum, upsertBy, val,
         warnIfNoFp } from '../domain.js';

// ── הגדרות ──
// אין שער סיסמה מעל ההגדרות ואין ברירת מחדל לסיסמה או לתפקיד — בהתקנה טרייה הם נופלים לערך שכל אחד מקליד.
// role הוא text not null בלי DEFAULT; הנפילה-חזרה ל-manager ב-saveUser היא הגנת טופס לתפקיד הנמוך.
function viewSettings() {
  // שכבת הגנה שנייה — אין להסיר «כי go כבר בודק»: מסך שמרנדר בלי בדיקה נפתח לכל מי שהגיע אליו בדרך אחרת.
  if (!isAdmin()) {
    return '<section class="card">' + emptyBox('🔒', 'אין הרשאה — מסך ההגדרות פתוח לבעלים בלבד') + '</section>';
  }

  var h = '';

  // ── משתמשים ──
  h += '<section class="card"><h2>👥 ניהול משתמשים<span class="cnt">' + state.users.length + '</span>' +
    '<span class="sp"><button class="btn sm" data-act="user-new">＋ משתמש</button></span></h2>' +
    '<div class="tw"><table><thead><tr><th>שם מלא</th><th>שם משתמש</th><th>תפקיד</th><th>סטטוס</th><th></th></tr></thead><tbody>';
  state.users.forEach(function (u) {
    h += '<tr><td><b>' + esc(u.full_name) + '</b></td><td>' + esc(u.username) + '</td>' +
      '<td><span class="badge ' + (isAdminOf(u) ? 'brand' : '') + '">' + (isAdminOf(u) ? 'בעלים' : 'מנהל') + '</span></td>' +
      '<td><span class="badge ' + (u.active ? 'ok' : 'bad') + '">' + (u.active ? 'פעיל' : 'מושבת') + '</span></td>' +
      '<td><button class="btn ghost xs" data-act="user-edit" data-id="' + u.client_id + '">עריכה</button> ' +
        '<button class="btn ghost xs" data-act="user-pass" data-id="' + u.client_id + '">סיסמה</button> ' +
        '<button class="btn ' + (u.active ? 'danger' : 'soft') + ' xs" data-act="user-toggle" data-id="' + u.client_id + '">' +
          (u.active ? 'השבתה' : 'הפעלה') + '</button></td></tr>';
  });
  h += '</tbody></table></div></section>';

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

function formUser(existing) {
  var u = existing || {};
  var body =
    '<div class="f2">' +
      '<label class="fld"><span>שם מלא *</span><input class="inp" id="us-full" value="' + esc(u.full_name || '') + '"></label>' +
      '<label class="fld"><span>שם משתמש *</span><input class="inp" id="us-name" autocapitalize="off" spellcheck="false" value="' + esc(u.username || '') + '"></label>' +
    '</div>' +
    (u.client_id ? '' : '<label class="fld"><span>סיסמה *</span><input class="inp" id="us-pass" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"><button type="button" class="pass-eye btn ghost sm" data-act="pass-eye" data-id="us-pass" title="הצג/הסתר סיסמה">👁</button></label>') +
    '<div class="f2">' +
      '<label class="fld"><span>תפקיד</span><select class="inp" id="us-role">' +
        '<option value="manager"' + (isAdminOf(u) ? '' : ' selected') + '>מנהל</option>' +
        '<option value="admin"' + (isAdminOf(u) ? ' selected' : '') + '>בעלים</option></select></label>' +
      '<label class="active-chk fld chk"><input type="checkbox" id="us-active"' +
        (u.client_id ? (u.active ? ' checked' : '') : ' checked') + '><span>משתמש פעיל</span></label>' +
    '</div>';
  var foot = '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    '<button class="btn" data-act="user-save" data-ksave data-id="' + (u.client_id || '') + '">שמירה</button>';
  openModal(u.client_id ? MSG_EDIT_USER : MSG_NEW_USER, body, foot);
}

function saveUser(id) {
  var full = val('us-full'), uname = val('us-name');
  if (!full || !uname) { toast(MSG_NEED_FULL_AND_USER, null, 'bad'); return Promise.resolve(); }
  var row = {
    full_name: full, username: uname,
    role: val('us-role') || 'manager',
    active: checked('us-active')
  };
  // כתיבת משתמש חייבת להגיע לענן כדי שהטביעה תגיע לשאר המכשירים — בלי רשת היא נכשלת ברעש.
  if (!navigator.onLine) { toast(MSG_OFF_USER_WRITE, null, 'bad'); return Promise.resolve(); }
  if (!id) {
    var p = $('#us-pass') ? $('#us-pass').value : '';
    if (!p) { toast(MSG_NEED_PASS, null, 'bad'); return Promise.resolve(); }
    if (!PASS_SIX_RE.test(p)) { toast(MSG_PASS_SIX, null, 'bad'); return Promise.resolve(); }
    return authPassFields(p).then(function (pf) {
      return writeUser(null, Object.assign({}, row, pf)).then(warnIfNoFp)
        .then(function (r) { if (r && !r.error) plTouch(); return r; });
    });
  }
  // עריכת משתמש קיים אינה נוגעת בסיסמה ולכן גם לא בטביעה.
  // כתיבה שהצליחה מקדמת את אות הפולינג — g_users נמשכת כמו כל טבלה, ובלי הקידום השינוי אינו נראה במכשיר אחר.
  return writeUser(id, row).then(function (r) { if (r && !r.error) plTouch(); return r; });
}

function formPassword(u) {
  openModal(MSG_PASS_CHANGE_FOR + u.full_name,
    '<label class="fld"><span>סיסמה חדשה *</span><input class="inp" id="pw-new" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"><button type="button" class="pass-eye btn ghost sm" data-act="pass-eye" data-id="pw-new" title="הצג/הסתר סיסמה">👁</button></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    '<button class="btn" data-act="pass-save" data-ksave data-id="' + u.client_id + '">שמירה</button>');
  var el = $('#pw-new'); if (el) el.focus();
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

export { formPassword, formTarget, formUser, saveTarget, saveUser, viewSettings };
