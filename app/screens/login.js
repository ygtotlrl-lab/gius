// app/screens/login.js — הכניסה, החלפת משתמש והסיסמה שלי
import { MSG_FILL_ALL, MSG_FILL_LOGIN, MSG_LOGIN_ERR, MSG_MY_PASS_TITLE, MSG_OFFLINE,
         MSG_OFFLINE_LOGIN, MSG_OFF_NO_CRYPTO, MSG_OFF_NO_FP, MSG_OFF_UNKNOWN,
         MSG_OFF_USER_WRITE, MSG_PASS_MISMATCH, MSG_PASS_SIX, MSG_SERVER_ERR, isNetErr,
         withTimeout } from '../../core/util.js';
import { ctxSwitch, plTouch, runSave } from '../../core/sync.js';
import { AUTH_USER_COLS, authLog, authPassFields, authUsersTable, authVerify, lkStop,
         sessClear, usersByName, usersGet, usersSaveOne, writeUser } from '../../core/auth.js';
import { esc, openModal, toast, uiNoDialog } from '../../core/ui.js';
import { S, state } from '../state.js';
import { MSG_BAD_LOGIN, MSG_NO_OTHER_USER_LOCAL, MSG_SWITCH_USER, MSG_USER_INACTIVE } from '../config.js';
import { $, PASS_SIX_RE, ok, val } from '../domain.js';
import { warnIfNoFp } from './settings.js';
import { boot, viewBare } from '../main.js';

// ── כניסה ──

function markSVG(cls) {
  return '<svg class="' + cls + '" viewBox="0 0 100 100" aria-hidden="true">' +
    '<rect x="2" y="2" width="96" height="96" rx="24" fill="var(--brand-fill)"/>' +
    '<circle cx="50" cy="50" r="26" fill="none" stroke="#fff" stroke-width="8"/>' +
    '<circle cx="50" cy="50" r="10" fill="#fff"/></svg>';
}

function renderLogin() {
  viewBare(
    '<div class="auth"><div class="auth-card ksave">' +
      markSVG('mark') +
      '<h1>גיוס</h1>' +
      '<div class="sub">ניהול גיוס כספים</div>' +
      '<label class="fld"><span>שם משתמש</span>' +
        '<input class="inp" id="lg-user" autocomplete="username" autocapitalize="off" spellcheck="false"></label>' +
      '<label class="fld"><span>סיסמה</span>' +
        '<input class="inp" id="lg-pass" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></label>' +
      '<button class="btn block" data-act="login" data-busy="⏳ בודק…" data-ksave id="lg-btn">כניסה</button>' +
      '<div class="auth-err" id="lg-err"></div>' +
    '</div></div>');

  var u = $('#lg-user');
  if (u) u.focus();
}

function loginError(msg) {
  var el = $('#lg-err');
  el.textContent = msg;
  el.classList.add('show');
}

function doLogin() {
  var username = val('lg-user');
  var password = $('#lg-pass') ? $('#lg-pass').value : '';
  $('#lg-err').classList.remove('show');
  if (!username || !password) { loginError(MSG_FILL_LOGIN); return; }

  // בלי רשת — אימות מול הטביעה שבמראה ולא MSG_OFFLINE: אחרת רק מי שנכנס אחרון במכשיר יכול להיכנס.
  if (!navigator.onLine) { return doLoginOffline(username, password); }
  return withTimeout(S.sb.from(authUsersTable()).select(AUTH_USER_COLS.join(',')).eq('username', username).limit(1))
    .then(ok)
    .then(function (rows) {
      var u = rows && rows[0];
      if (!u) throw new Error('bad');
      if (!u.active) throw new Error('inactive');
      // ההשוואה מול הטביעה ולא מול סיסמה — ה-RLS פתוח ומפתח ה-anon ציבורי, ועמודת סיסמה הייתה מפתח לכניסה.
      return authVerify(u, password).then(function (v) {
        if (v === 'no-crypto') throw new Error('no-crypto');
        if (v !== 'ok') throw new Error('bad');
        return u;
      });
    })
    .then(function (u) {
      ctxSwitch();
      state.user = { client_id: u.client_id, username: u.username, full_name: u.full_name, role: u.role };
      authLog(true, 'online', username);
      // הנתיב החלקי רץ אחרי קביעת state.user — רענון שקודם לו עובד על מצב שעוד לא השתנה.
      try { usersSaveOne(u); } catch (e) { console.warn('[users] cache', e); }
      return boot();
    })
    .catch(function (e) {
      var m = e && e.message;
      authLog(false, m === 'bad' ? 'wrong_credentials_online' : m === 'inactive' ? 'inactive_online'
                   : m === 'no-crypto' ? 'no_crypto_online' : isNetErr(e) ? 'net_error' : 'server_error',
              username);
      if (e && e.message === 'bad') loginError(MSG_BAD_LOGIN);
      else if (e && e.message === 'inactive') loginError(MSG_USER_INACTIVE);
      // כשל מערכת בטוסט — .auth-err שמור למה שהמשתמש יכול לתקן בהקלדה.
      else if (isNetErr(e)) toast(MSG_OFFLINE, null, 'bad');
      else toast(MSG_LOGIN_ERR + ((e && e.message) || MSG_SERVER_ERR), null, 'bad');
    });
}

// ארבעה מצבים וארבע הודעות — משתמש שאינו במראה או בלי טביעה אינו סיסמה שגויה, והודעה כזו מובילה לנסות שוב סיסמה נכונה.
function doLoginOffline(username, password) {
  var cu = usersByName(username);
  if (!cu) { authLog(false, 'unknown_user_offline', username); loginError(MSG_OFF_UNKNOWN); return Promise.resolve(); }
  // מחזירה Promise בשביל הבדיקות — אף קורא בקוד אינו נשען על הערך המוחזר.
  return authVerify(cu, password).then(function (verdict) {
    if (verdict === 'no-fp')     { authLog(false, 'no_fp_offline', username); loginError(MSG_OFF_NO_FP); return; }
    if (verdict === 'no-crypto') { authLog(false, 'no_crypto_offline', username); loginError(MSG_OFF_NO_CRYPTO); return; }
    if (verdict !== 'ok')        { authLog(false, 'wrong_credentials_offline', username); loginError(MSG_BAD_LOGIN); return; }
    ctxSwitch();
    state.user = { client_id: cu.client_id, username: cu.username, full_name: cu.full_name, role: cu.role };
    authLog(true, 'offline', username);
    boot();
    toast(MSG_OFFLINE_LOGIN, null, 'bad');
  }, function (e) {
    console.warn('[login] אימות אופליין נכשל', e);
    authLog(false, 'no_crypto_offline', username);
    loginError(MSG_OFF_NO_CRYPTO);
  });
}

function doLogout() {
  lkStop();
  ctxSwitch();
  sessClear();
  state.screen = 'home';
  state.donorId = null;
  renderLogin();
}

// הסיסמה הנוכחית אינה נבדקת מול תבנית שש-הספרות — אכיפה כאן הייתה נועלת בחוץ סיסמה ותיקה ותקפה.
function formMyPassword() {
  openModal(MSG_MY_PASS_TITLE,
    '<label class="fld"><span>סיסמה נוכחית *</span><input class="inp" id="mp-cur" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></label>' +
    '<label class="fld"><span>סיסמה חדשה *</span><input class="inp" id="mp-new" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>' +
    '<label class="fld"><span>אימות סיסמה חדשה *</span><input class="inp" id="mp-new2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    '<button class="btn" data-act="my-pass-save" data-ksave>שמירה</button>');
  var el = $('#mp-cur'); if (el) el.focus();
}

function formSaveMyPassword() {
  var c1 = $('#mp-cur'), n1 = $('#mp-new'), n2 = $('#mp-new2');
  if (!c1 || !n1 || !n2) { uiNoDialog('formSaveMyPassword', 'mp-cur'); return; }
  var cur = c1.value.trim(), p1 = n1.value.trim(), p2 = n2.value.trim();
  if (!cur || !p1 || !p2) { toast(MSG_FILL_ALL, null, 'bad'); return; }
  if (!PASS_SIX_RE.test(p1)) { toast(MSG_PASS_SIX, null, 'bad'); return; }
  if (p1 !== p2) { toast(MSG_PASS_MISMATCH, null, 'bad'); return; }
  if (!S.sb || !navigator.onLine) { toast(MSG_OFF_USER_WRITE, null, 'bad'); return; }
  // האימות מול הענן רגעי בלבד — הסיסמה הנוכחית אינה נכתבת לשום מקום.
  return runSave(function () {
    // האימות מול הטביעה; הטקסט הגלוי אינו נשלף.
    return withTimeout(S.sb.from(authUsersTable()).select('client_id,active,pass_salt,pass_fp').eq('client_id', state.user.client_id).limit(1))
      .then(function (res) {
        if (res && res.error) throw res.error;
        var u = res && Array.isArray(res.data) && res.data[0];
        if (!u) throw new Error('הסיסמה הנוכחית שגויה');
        return authVerify(u, cur).then(function (v) {
          if (v !== 'ok') throw new Error('הסיסמה הנוכחית שגויה');
          return authPassFields(p1);
        });
      })
      .then(function (pf) { return writeUser(state.user.client_id, pf).then(warnIfNoFp)
        .then(function (r) { if (r && !r.error) plTouch(); return r; }); });
  }, 'הסיסמה עודכנה');
}

// ── החלפת משתמש ──
// האימות הוא authVerify, אותה הכרעה של הכניסה — מסלול שני היה בודק active או טביעה אחרת.
// אין החלפה בלי סיסמה — אחרת כל מכשיר פתוח הוא מעבר חופשי לכל זהות שבמראה.
function formSwitchUser() {
  var others = usersGet().filter(function (u) {
    return u && u.active !== false && String(u.client_id) !== String(state.user.client_id);
  });
  if (!others.length) { toast(MSG_NO_OTHER_USER_LOCAL, null, 'bad'); return; }
  openModal(MSG_SWITCH_USER,
    '<label class="fld"><span>משתמש</span><select class="inp" id="sw-user" aria-label="המשתמש שאליו עוברים">' +
      others.map(function (u) {
        return '<option value="' + esc(u.client_id) + '">' + esc(u.full_name || u.username) + '</option>';
      }).join('') +
    '</select></label>' +
    '<label class="fld"><span>סיסמה *</span><input class="inp" id="sw-pass" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    '<button class="btn" data-act="switch-confirm" data-ksave>כניסה</button>');
  var el = $('#sw-pass'); if (el) el.focus();
}

export { doLogin, doLogout, formMyPassword, formSaveMyPassword, formSwitchUser,
         markSVG, renderLogin };
