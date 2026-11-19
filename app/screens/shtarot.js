// app/screens/shtarot.js — שטרות: תור ההתרמה בטלפון
import { getDeviceId, readNum } from '../../core/util.js';
import { errToast, idEq, newClientId, pendTag } from '../../core/sync.js';
import { ask, cardWinHTML, comboDef, comboHTML, comboValue, esc, methodGridHTML, methodIcon, receiptHTML,
         methodPick as coreMethodPick, openModal, toast } from '../../core/ui.js';
import { LK_AMBASSADOR, LK_METHOD, MSG_AMOUNT_POSITIVE, MSG_SHT_AMB, MSG_SHT_DUP, MSG_SHT_LOCKED, MSG_SHT_NO_NAME, MSG_SHT_PICK,
         MSG_SHT_PHONE, SHT_BEAT_MS, SHT_GIVE, SHT_LOCK_MS, SHT_NEXT, SHT_PAGE, SHT_RETRY_MS, SHT_STATUS } from '../constants.js';
import { S, state } from '../state.js';
import { icon } from '../icons.js';
import { $, donorById, emptyBox, gSortDonors, ils, initials, insert, lookupLabels, nowISO, nullable, num, pendRowKey,
         update, val } from '../domain.js';

// ── האיש ──
// השם — מהכרטיס בגיוס כשהאיש מקושר אליו, ואחרת מה שנרשם; בלי שם — «שם לא ידוע».
function personById(id) {
  for (var i = 0; i < state.shtarPeople.length; i++) if (idEq(state.shtarPeople[i].client_id, id)) return state.shtarPeople[i];
  return null;
}
function personName(p) {
  var d = p.donor_client_id ? donorById(p.donor_client_id) : null;
  return (d && d.name) || p.name || '';
}
function digits(s) { return String(s || '').replace(/\D/g, ''); }
function phoneShow(ph) {
  var d = digits(ph);
  return d.length === 10 && d.charAt(0) === '0' ? d.slice(0, 3) + '-' + d.slice(3) : String(ph || '');
}
function waLink(ph) {
  var d = digits(ph);
  return 'https://wa.me/' + (d.charAt(0) === '0' ? '972' + d.slice(1) : d);
}

// ── השיחות ──
// המפה נבנית פעם אחת לכל מצב של הנתונים — applyMirrorToState מחליפה את המערך, וזה אות הרענון.
var _ix = { src: null, map: {} };
function callsOf(pid) {
  if (_ix.src !== state.shtarCalls) {
    var map = {};
    state.shtarCalls.forEach(function (c) { (map[c.person_client_id] || (map[c.person_client_id] = [])).push(c); });
    Object.keys(map).forEach(function (k) { map[k].sort(function (a, b) { return Date.parse(a.call_at) - Date.parse(b.call_at); }); });
    _ix = { src: state.shtarCalls, map: map };
  }
  return _ix.map[pid] || [];
}
function callById(id) {
  for (var i = 0; i < state.shtarCalls.length; i++) if (idEq(state.shtarCalls[i].client_id, id)) return state.shtarCalls[i];
  return null;
}
function isGive(c) { return SHT_GIVE.indexOf(c.status) >= 0; }
function isToday(iso) { return new Date(iso).toDateString() === new Date().toDateString(); }

// מצב האיש — נגזר מהשיחה האחרונה ואינו נשמר. rank — הסדר בתור:
// לחזור שהגיע מועדו · טרם התקשרו · לא ענו לפני שעתיים ויותר · ומי שעוד לא הגיע זמנו.
function pState(p) {
  var cs = callsOf(p.client_id), last = cs[cs.length - 1], now = Date.now(), t;
  if (!last) return { k: 'new', rank: 1, at: 0 };
  if (last.status === 'cb') {
    t = last.callback_at ? Date.parse(last.callback_at) : 0;
    return { k: 'cb', rank: t <= now ? 0 : 3, at: t, last: last };
  }
  if (last.status === 'na') {
    t = Date.parse(last.call_at) + SHT_RETRY_MS;
    return { k: 'na', rank: t <= now ? 2 : 3, at: t, last: last };
  }
  return { k: 'done', rank: 9, at: Date.parse(last.call_at), last: last };
}

// הסינון — «כל התור», «טרם התקשרו», וכפתור לכל תוצאה, בשמה ובסדרה כמו בתפריט התוצאות שבשיחה: מי שזו תוצאת השיחה האחרונה שלו.
var FILTERS = { queue: function (s) { return s.k !== 'done'; }, 'new': function (s) { return s.k === 'new'; } };
var FILTER_LIST = [['queue', 'כל התור'], ['new', 'טרם התקשרו']];
Object.keys(SHT_STATUS).forEach(function (k) {
  FILTERS[k] = function (s) { return !!s.last && s.last.status === k; };
  FILTER_LIST.push([k, SHT_STATUS[k].l]);
});

// הכותרת של הרשימה — שם הסינון, ובתוצאה — שמה כמו בכפתור שבשיחה.
var FILTER_TITLE = { queue: 'התור' };
FILTER_LIST.forEach(function (o) { if (!FILTER_TITLE[o[0]]) FILTER_TITLE[o[0]] = o[1]; });

function shtMatches() {
  var s = state.sht, q = String(s.q || '').trim().toLowerCase(), qd = digits(q), f = FILTERS[s.f] || FILTERS.queue;
  var rows = [];
  state.shtarPeople.forEach(function (p) {
    var st = pState(p);
    if (!f(st, p)) return;
    var name = personName(p);
    if (q && name.toLowerCase().indexOf(q) < 0 && !(qd && digits(p.phone).indexOf(qd) >= 0)) return;
    rows.push({ p: p, st: st, name: name });
  });
  return rows.sort(function (a, b) {
    if (a.st.rank !== b.st.rank) return a.st.rank - b.st.rank;
    if (a.st.rank === 9) return b.st.at - a.st.at;
    if (a.st.at !== b.st.at) return a.st.at - b.st.at;
    if (!a.name !== !b.name) return a.name ? -1 : 1;
    return a.name.localeCompare(b.name, 'he') || String(a.p.phone).localeCompare(String(b.p.phone));
  });
}

// תרומות היום — השינוי בין תחילת היום לעכשיו, לכל איש שהייתה לו שיחה היום: נכנס לתרומה (התחייב · תרם · נסלק) — נספר, יצא ממנה — יורד;
// והסכום — ההפרש בין הסכום שבשיחה האחרונה לזה שבשיחה שלפני היום. כך מעבר בין השלבים אינו נספר שוב, ושינוי סכום נספר בהפרש בלבד.
function giveToday() {
  var t0 = new Date(); t0.setHours(0, 0, 0, 0); t0 = +t0;
  var n = 0, s = 0, g = function (c) { return !!c && isGive(c); }, a = function (c) { return g(c) ? num(c.amount) : 0; };
  state.shtarPeople.forEach(function (p) {
    var cs = callsOf(p.client_id), last = cs[cs.length - 1], before = null;
    if (!last || Date.parse(last.call_at) < t0) return;
    for (var i = cs.length - 1; i >= 0; i--) if (Date.parse(cs[i].call_at) < t0) { before = cs[i]; break; }
    n += (g(last) ? 1 : 0) - (g(before) ? 1 : 0);
    s += a(last) - a(before);
  });
  return { n: n, sum: s };
}

// ── המסך ──
// הלוח — נתונים בלבד, לא סינון: כמה בתור, וכמה שיחות ותרומות היו היום. מה שממתין לפעולה — בשורת הסינון וברכיבים שמתחת ללוח.
function shtDashHTML() {
  var queue = 0;
  state.shtarPeople.forEach(function (p) { if (pState(p).k !== 'done') queue++; });
  var today = state.shtarCalls.filter(function (c) { return isToday(c.call_at); }), g = giveToday();
  return [['בתור', queue], ['שיחות היום', today.length], ['תרומות היום', g.n], ['סכום היום', ils(g.sum), 'ok']].map(function (t) {
    return '<div class="sht-k' + (t[2] ? ' ' + t[2] : '') + '"><span>' + t[0] + '</span><b>' + t[1] + '</b></div>';
  }).join('');
}

// «לפי תוצאה» — בורר אחד לשמונה התוצאות, בסדר התפריט שבשיחה, וליד כל אחת — כמה שזו תוצאת השיחה האחרונה שלהם.
function shtResHTML() {
  var n = {}, f = state.sht.f;
  state.shtarPeople.forEach(function (p) { var st = pState(p); if (st.last) n[st.last.status] = (n[st.last.status] || 0) + 1; });
  return '<select class="inp' + (SHT_STATUS[f] ? ' on' : '') + '" id="sht-res" aria-label="סינון לפי תוצאה" data-chg="sht-res">' +
    '<option value="">לפי תוצאה</option>' + FILTER_LIST.slice(2).map(function (o) {
      return '<option value="' + o[0] + '"' + (f === o[0] ? ' selected' : '') + '>' + esc(o[1]) + ' · ' + (n[o[0]] || 0) + '</option>';
    }).join('') + '</select>';
}

function viewShtarot() {
  var s = state.sht;
  return '<section class="sht-dash" id="sht-dash">' + shtDashHTML() + '</section>' +
    '<div id="sht-give">' + shtGiveHTML() + '</div>' +
    '<section class="card list-tools">' +
      '<label class="search-box"><input aria-label="חיפוש לפי שם או טלפון" class="inp search" id="sht-q" data-inp="sht-q" placeholder="חיפוש לפי שם או טלפון" value="' + esc(s.q) + '">' +
        '<span class="search-ic">' + icon('search') + '</span></label>' +
      '<div class="tools-row sht-tools"><div class="seg sht-seg" role="group" aria-label="סינון">' +
      FILTER_LIST.slice(0, 2).map(function (o) {
        return '<button class="' + (s.f === o[0] ? 'on' : '') + '" data-act="sht-filter" data-v="' + o[0] + '">' + o[1] + '</button>';
      }).join('') + '</div>' + shtResHTML() + '</div></section>' +
    '<section class="card" id="sht-list">' + shtListHTML() + '</section>' +
    '<div id="sht-win">' + shtWinHTML() + '</div>';
}

function whenShow(ms) {
  var d = new Date(ms), p = function (n) { return (n < 10 ? '0' : '') + n; };
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function stBadge(st) {
  if (st.k === 'new') return '';
  if (st.k === 'cb') return '<span class="badge warn">' + (st.at ? 'לחזור ' + esc(whenShow(st.at)) : 'לחזור') + '</span>';
  if (st.k === 'na') return '<span class="badge">' + (st.rank === 3 ? 'לא ענה · שוב ב-' + esc(whenShow(st.at).slice(6)) : 'לא ענה') + '</span>';
  var d = SHT_STATUS[st.last.status] || { l: st.last.status, cls: '' };
  return '<span class="badge ' + d.cls + '">' + esc(st.last.status === 'int' && st.last.handled ? 'פרטים נשלחו' : d.l + (isGive(st.last) && st.last.handled ? ' · אושר' : '')) + '</span>';
}

// ── ממתינים לטיפול ──
// רכיב אחד מתחת ללוח, ובו חלק לכל תוצאה שממתינה לפעולה — והכותרת של כל חלק היא שם התוצאה כמו בכפתור שבשיחה:
// ממתין לפרטים — «טופל» · התחייב — «תרם» · תרם — «נסלק»: הכפתור מעביר למצב הבא (SHT_NEXT), והשיחה יוצאת מהרכיב (handled).
// השורות — «קבלה» של הליבה, כמו תשלומי החודש בדשבורד: קבוצה לכל יום, הסכום בראש ובירוק, השם ומתחתיו השגריר והסיכום, ובקצה האמצעי.
function shtGiveHTML() {
  var h = '', total = 0;
  SHT_NEXT.forEach(function (part) {
    var list = state.shtarCalls.filter(function (c) { return c.status === part[0] && !c.handled && personById(c.person_client_id); })
      .sort(function (a, b) { return Date.parse(b.call_at) - Date.parse(a.call_at); });
    if (!list.length) return;
    total += list.length;
    var give = SHT_GIVE.indexOf(part[0]) >= 0;
    h += '<div class="list-sub">' + esc(SHT_STATUS[part[0]].l) + ' <span class="cnt">' + list.length + '</span></div>' + receiptHTML(list.map(function (c) {
      var p = personById(c.person_client_id);
      return { day: whenShow(Date.parse(c.call_at)).slice(0, 5), amt: give ? (c.amount != null ? ils(c.amount) : '—') : '', cls: give ? '' : 'sht-noamt',
        who: '<b>' + esc(personName(p) || MSG_SHT_NO_NAME) + pendTag(pendRowKey('g_shtar_calls', c.client_id)) + '</b>' +
          '<small>' + esc([c.ambassador, c.note].filter(Boolean).join(' · ')) + '</small>',
        method: give ? c.method || '' : '', ico: give && c.method ? icon(methodIcon(c.method)) : '', act: 'sht-open', id: p.client_id,
        tail: '<button class="btn sm" data-act="sht-next" data-id="' + esc(c.client_id) + '">' + icon('check') + part[1] + '</button>' };
    }));
  });
  return h ? '<section class="card sht-give"><h2>ממתינים לטיפול<span class="cnt">' + total + '</span></h2>' + h + '</section>' : '';
}

function shtListHTML() {
  var s = state.sht, list = shtMatches(), lim = s.lim || SHT_PAGE;
  var h = '<h2>' + esc(FILTER_TITLE[s.f] || FILTER_TITLE.queue) + '<span class="cnt">' + list.length + '</span></h2>';
  if (!list.length) return h + emptyBox('shtarot', state.shtarPeople.length ? 'אין כאן אף אחד כרגע' : 'הרשימה ריקה');
  h += list.slice(0, lim).map(function (r) {
    var p = r.p, n = callsOf(p.client_id).length;
    return '<div class="row sht-row' + (r.st.rank === 3 ? ' later' : '') + '" data-act="sht-open" data-id="' + esc(p.client_id) + '">' +
      '<span class="av">' + (r.name ? esc(initials(r.name)) : icon('call')) + '</span>' +
      '<div class="main"><b' + (r.name ? '' : ' class="unk"') + '>' + esc(r.name || MSG_SHT_NO_NAME) + pendTag(pendRowKey('g_shtar_people', p.client_id)) + '</b>' +
        '<small dir="ltr">' + esc(phoneShow(p.phone)) + '</small>' + (n ? '<small> · ' + n + ' שיחות</small>' : '') + '</div>' +
      '<div class="end">' + stBadge(r.st) + '</div></div>';
  }).join('');
  if (list.length > lim) h += '<div class="btnrow sht-more"><button class="btn ghost sm" data-act="sht-more">הצג עוד · ' + (list.length - lim) + '</button></div>';
  return h;
}

// ── כרטיס האיש ──
comboDef('sht-amb', { val: true, max: 30,
  items: function () { return lookupLabels(LK_AMBASSADOR).map(function (l) { return { value: l, label: l }; }); },
  pick: function (it) { state.sht.amb = it ? it.value : ''; } });

function localInput(iso) {
  if (!iso) return '';
  var d = new Date(iso), p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function stBtn(k, cur) {
  return '<button type="button" class="sht-o ' + (SHT_STATUS[k].cls || '') + (cur === k ? ' on' : '') + '" aria-pressed="' + (cur === k) +
    '" data-act="sht-st" data-v="' + k + '" data-give="' + (SHT_GIVE.indexOf(k) >= 0 ? 1 : 0) + '">' + esc(SHT_STATUS[k].l) + '</button>';
}

function shtCardHTML(p) {
  var s = state.sht, id = esc(p.client_id), name = personName(p), cs = callsOf(p.client_id);
  var cur = s.call ? callById(s.call) : null, st = cur ? cur.status : '', give = !!cur && isGive(cur);
  var i = s.nav.indexOf(p.client_id);
  var facts = [['תרומות קודמות', p.past], ['שם במאגר', p.db_name], ['קבוצות וואטסאפ', p.wa_groups], ['מופיע במאגרים', p.sources],
               ['ניסה לתרום', p.tried], ['הערה', p.note]].filter(function (f) { return f[1]; });
  var hist = cs.filter(function (c) { return !cur || c.client_id !== cur.client_id; }).reverse();
  var h = '<div class="copen sht-card">' +
    '<div class="cp-band">' +
      '<span class="cp-av">' + (name ? esc(initials(name)) : icon('call')) + '</span>' +
      '<div class="cp-who"><h3>' + esc(name || MSG_SHT_NO_NAME) + '</h3>' +
        (p.donor_client_id ? '<div class="cp-chips"><span>כרטיס בגיוס</span></div>' : '') + '</div>' +
      '<div class="sht-side"><div class="cp-acts">' +
        '<a class="cp-btn" href="tel:' + esc(p.phone) + '" aria-label="חיוג" title="חיוג">' + icon('call') + '</a>' +
        '<a class="cp-btn" href="' + esc(waLink(p.phone)) + '" target="_blank" rel="noopener noreferrer" aria-label="וואטסאפ" title="וואטסאפ">' + icon('chat') + '</a>' +
        '<button class="cp-btn" data-act="sht-edit" data-id="' + id + '" aria-label="עריכת הפרטים" title="עריכת הפרטים">' + icon('edit') + '</button>' +
        '<button class="cp-btn" data-act="sht-close" aria-label="סגירה">' + icon('close') + '</button>' +
      '</div><span class="sht-phone" dir="ltr">' + esc(phoneShow(p.phone)) + '</span></div>' +
    '</div><div class="cp-body" data-ks-area>';
  if (facts.length) h += '<dl class="sht-facts">' + facts.map(function (f) { return '<div><dt>' + f[0] + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('') + '</dl>';
  h += '<div class="fld"><span>שגריר מטלפן *</span>' +
      comboHTML('sht-amb', { id: 'sht-amb', label: 'שגריר מטלפן', placeholder: 'הקלדה לסינון…',
                             picked: s.amb ? { value: s.amb, label: s.amb } : null }) + '</div>' +
    // הטופס — נשמר בכפתור; יציאה בלי שמירה שואלת (data-ks). השגריר מחוץ לו — הוא נשאר בין איש לאיש ואינו «שינוי».
    '<div data-ks><input type="hidden" id="sht-status" value="' + esc(st) + '">' +
    '<div class="fld"><span>לא נוצר קשר</span><div class="sht-os">' + stBtn('na', st) + stBtn('wrong', st) + '</div></div>' +
    '<div class="fld"><span>תוצאת השיחה</span><div class="sht-os">' + ['yes', 'pl', 'int', 'cb', 'no', 'rmv'].map(function (k) { return stBtn(k, st); }).join('') + '</div></div>' +
    '<div id="sht-give-box"' + (give ? '' : ' hidden') + '>' +
      '<label class="fld"><span>סכום</span><input class="inp" id="sht-amt" inputmode="decimal" value="' + esc(cur && cur.amount != null ? cur.amount : '') + '"></label>' +
      '<div class="fld"><span>אמצעי</span><input type="hidden" id="sht-method" value="' + esc(cur ? cur.method || '' : '') + '">' +
      methodGridHTML({ target: 'sht-method', list: lookupLabels(LK_METHOD), cur: cur ? cur.method || '' : '', label: 'אמצעי',
                       ico: function (l) { return icon(methodIcon(l)); } }) + '</div></div>' +
    '<label class="fld" id="sht-when-box"' + (st === 'cb' ? '' : ' hidden') + '><span>מתי לחזור</span><input class="inp" type="datetime-local" id="sht-when" value="' + esc(cur ? localInput(cur.callback_at) : '') + '"></label>' +
    '<label class="fld"><span>סיכום השיחה</span><textarea class="inp" id="sht-note" rows="3" placeholder="מה נאמר, מה הוסכם…">' + esc(cur ? cur.note || '' : '') + '</textarea></label>' +
    '<div class="btnrow sht-save"><button class="btn" data-act="sht-call-save" data-ksave>' + icon('save') + (cur ? 'עדכון השיחה' : 'שמירת השיחה') + '</button></div></div>';
  if (hist.length) {
    h += '<div class="sec-t">שיחות קודמות<span class="cnt">' + hist.length + '</span></div><div class="sht-hist">' + hist.map(function (c) {
      var d = SHT_STATUS[c.status] || { l: c.status, cls: '' };
      return '<div class="sht-h"><button class="icon-btn sht-h-edit" data-act="sht-call-edit" data-id="' + esc(c.client_id) + '" data-ks-leave aria-label="עריכת השיחה" title="עריכת השיחה">' + icon('edit') + '</button><div><span class="badge ' + d.cls + '">' + esc(d.l) + '</span> <small>' + esc(whenShow(Date.parse(c.call_at))) + ' · ' + esc(c.ambassador) + '</small>' +
        pendTag(pendRowKey('g_shtar_calls', c.client_id)) + '</div>' +
        ((c.amount != null || c.method) ? '<div><b>' + (c.amount != null ? ils(c.amount) : '') + '</b> ' + esc(c.method || '') + '</div>' : '') +
        (c.status === 'cb' && c.callback_at ? '<div><small>לחזור ב-' + esc(whenShow(Date.parse(c.callback_at))) + '</small></div>' : '') +
        (c.note ? '<div class="sht-hn">' + esc(c.note) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }
  h += '<div class="sht-nav">' +
      '<button class="btn ghost" data-act="sht-step" data-d="-1" data-ks-leave' + (i > 0 ? '' : ' disabled') + '>' + icon('prev') + 'הקודם</button>' +
      '<button class="btn" data-act="sht-step" data-d="1" data-ks-leave' + (i >= 0 && i < s.nav.length - 1 ? '' : ' disabled') + '>הבא' + icon('next') + '</button>' +
    '</div></div></div>';
  return h;
}

function shtWinHTML() {
  var s = state.sht, p = s.open && personById(s.open);
  if (s.open && !p) { lockRelease(s.open); s.open = null; s.call = null; }
  return p ? cardWinHTML({ label: personName(p) || MSG_SHT_NO_NAME, close: 'sht-close', body: shtCardHTML(p) }) : '';
}

// הציור החלקי — הלוח, הרשימה וגוף הכרטיס; החלון עצמו נשאר, ואיתו מקום הגלילה שבו.
function shtRefresh() {
  var dash = $('#sht-dash'), list = $('#sht-list'), win = $('#sht-win');
  if (!dash || !list || !win) return false;
  dash.innerHTML = shtDashHTML();
  list.innerHTML = shtListHTML();
  var give = $('#sht-give');
  if (give) give.innerHTML = shtGiveHTML();
  document.querySelectorAll('.sht-seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === state.sht.f); });
  var res = $('#sht-res');
  if (res && document.activeElement !== res) res.outerHTML = shtResHTML();
  var qi = $('#sht-q');
  if (qi && qi.value !== state.sht.q && document.activeElement !== qi) qi.value = state.sht.q;
  var inn = $('.cw-in', win), p = state.sht.open && personById(state.sht.open);
  if (inn && p) inn.innerHTML = shtCardHTML(p); else win.innerHTML = shtWinHTML();
  return true;
}

// ── הנעילה ──
// איש שפתוח במכשיר אחד נעול לאחרים. השורה ב-g_shtar_locks אינה במראה — היא נכתבת ונקראת ישר מול הענן,
// ובלי רשת אין נעילה: העבודה נמשכת, והתנגשות אפשרית.
var _beat = 0;
function lockOn() { return !!(S.sb && navigator.onLine); }
function lockTake(pid) {
  if (!lockOn()) return Promise.resolve(true);
  var dev = getDeviceId();
  var q = S.sb.from('g_shtar_locks').select('client_id,device,updated_at').eq('person_client_id', pid).maybeSingle().then(function (res) {
    if (res.error) return true;
    var r = res.data;
    if (r && r.device && r.device !== dev && Date.now() - Number(r.updated_at) < SHT_LOCK_MS) return false;
    return S.sb.from('g_shtar_locks').upsert({ client_id: r ? r.client_id : newClientId(), person_client_id: pid, device: dev,
      ambassador: state.sht.amb || null, updated_at: Date.now(), deleted: false }, { onConflict: 'client_id' }).then(function () { return true; });
  });
  // הנעילה אינה מעכבת את העבודה — ענן שאינו עונה תוך רגע נחשב כמי שאין בו נעילה.
  return Promise.race([q, new Promise(function (ok) { setTimeout(function () { ok(true); }, 2500); })]).catch(function () { return true; });
}
function lockPatch(pid, patch) {
  if (!lockOn() || !pid) return;
  try {
    S.sb.from('g_shtar_locks').update(Object.assign({ updated_at: Date.now() }, patch)).eq('person_client_id', pid).eq('device', getDeviceId())
      .then(function () { }, function () { });
  } catch (e) { }
}
function lockRelease(pid) { lockPatch(pid, { device: null }); }
function lockBeat() {
  clearInterval(_beat); _beat = 0;
  if (!state.sht.open) return;
  _beat = setInterval(function () {
    if (!state.sht.open || state.screen !== 'shtarot') { clearInterval(_beat); _beat = 0; return; }
    lockPatch(state.sht.open, {});
  }, SHT_BEAT_MS);
}

// פתיחה — מהרשימה (ואז סדר «הקודם/הבא» נלכד מהרשימה כפי שהיא) או בצעד מתוך כרטיס פתוח.
function shtOpen(id, keepNav) {
  var s = state.sht;
  if (!keepNav) s.nav = shtMatches().map(function (r) { return r.p.client_id; });
  return lockTake(id).then(function (free) {
    if (!free) { toast(MSG_SHT_LOCKED, null, 'warn'); return false; }
    if (s.open && s.open !== id) lockRelease(s.open);
    s.open = id; s.call = null;
    lockBeat();
    var win = $('#sht-win');
    if (win) { win.innerHTML = shtWinHTML(); var cw = $('.copen', win); if (cw) cw.scrollTop = 0; }
    return true;
  });
}

// צעד — איש נעול או שנמחק מדולג, עד קצה הרשימה.
function shtStep(d) {
  var s = state.sht;
  function at(j) {
    if (j < 0 || j >= s.nav.length) return Promise.resolve(false);
    if (!personById(s.nav[j])) return at(j + d);
    return shtOpen(s.nav[j], true).then(function (ok) { return ok || at(j + d); });
  }
  return at(s.nav.indexOf(s.open) + d);
}

function shtClose() {
  var s = state.sht;
  if (s.open) lockRelease(s.open);
  s.open = null; s.call = null;
  lockBeat();
}

// ── השיחה ──
// הטופס נשמר בכפתור: התוצאה נבחרת, הפרטים מתמלאים, ו«שמירת השיחה» כותבת שורה; יציאה בלי שמירה שואלת.
// אחרי השמירה הטופס נשאר טעון בשיחה שנשמרה — תיקון באותה פתיחה מעדכן אותה ואינו יוצר שיחה נוספת.
function shtStatusPick(el) {
  var h = $('#sht-status');
  if (!h) return;
  h.value = h.value === el.dataset.v ? '' : el.dataset.v;
  document.querySelectorAll('.sht-o[data-act="sht-st"]').forEach(function (b) {
    var on = b.dataset.v === h.value;
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
  });
  var gb = $('#sht-give-box'), wb = $('#sht-when-box');
  if (gb) gb.hidden = SHT_GIVE.indexOf(h.value) < 0;
  if (wb) wb.hidden = h.value !== 'cb';
}

function shtCallSave() {
  var s = state.sht, p = s.open && personById(s.open), st = val('sht-status');
  if (!p) return;
  var amb = comboValue('sht-amb');
  if (!amb) { toast(MSG_SHT_AMB, null, 'warn'); var q = $('#sht-amb [data-combo-q]'); if (q) q.focus(); return; }
  if (!SHT_STATUS[st]) { toast(MSG_SHT_PICK, null, 'warn'); return; }
  var give = SHT_GIVE.indexOf(st) >= 0, amt = $('#sht-amt'), when = val('sht-when');
  var amount = give && amt && amt.value.trim() !== '' ? readNum(amt, 0) : null;
  if (amount != null && !(amount > 0)) { toast(MSG_AMOUNT_POSITIVE, null, 'warn'); return; }
  var row = { status: st, ambassador: amb, amount: amount, method: give ? nullable(val('sht-method')) : null,
              callback_at: st === 'cb' && when ? new Date(when).toISOString() : null, note: nullable(val('sht-note')) };
  var w = s.call ? update('g_shtar_calls', s.call, row)
                 : insert('g_shtar_calls', Object.assign(row, { person_client_id: p.client_id, call_at: nowISO(), handled: false }));
  return w.then(function (c) { s.call = c.client_id; return c; });
}

function shtMethodPick(el) { coreMethodPick(el); }

// ── עריכת שיחה שנרשמה ──
// כל שיחה ברשימת «שיחות קודמות» נפתחת לעריכה: התוצאה, השגריר, ולפי התוצאה — סכום ואמצעי או מועד לחזור, הסיכום, ומחיקה.
function formCall(c) {
  var give = isGive(c), ambs = lookupLabels(LK_AMBASSADOR).slice();
  if (ambs.indexOf(c.ambassador) < 0) ambs.push(c.ambassador);
  openModal('עריכת שיחה',
    '<div class="f2">' +
      '<label class="fld"><span>תוצאה *</span><select class="inp" id="sc-status" data-chg="sc-status">' + Object.keys(SHT_STATUS).map(function (k) {
        return '<option value="' + k + '"' + (c.status === k ? ' selected' : '') + '>' + esc(SHT_STATUS[k].l) + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld"><span>שגריר מטלפן *</span><select class="inp" id="sc-amb">' + ambs.map(function (a) {
        return '<option' + (c.ambassador === a ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') + '</select></label>' +
    '</div>' +
    '<div id="sc-give-box"' + (give ? '' : ' hidden') + '>' +
      '<label class="fld"><span>סכום</span><input class="inp" id="sc-amt" inputmode="decimal" value="' + esc(c.amount == null ? '' : c.amount) + '"></label>' +
      '<div class="fld"><span>אמצעי</span><input type="hidden" id="sc-method" value="' + esc(c.method || '') + '">' +
      methodGridHTML({ target: 'sc-method', list: lookupLabels(LK_METHOD), cur: c.method || '', label: 'אמצעי',
                       ico: function (l) { return icon(methodIcon(l)); } }) + '</div></div>' +
    '<label class="fld" id="sc-when-box"' + (c.status === 'cb' ? '' : ' hidden') + '><span>מתי לחזור</span><input class="inp" type="datetime-local" id="sc-when" value="' + esc(localInput(c.callback_at)) + '"></label>' +
    '<label class="fld"><span>סיכום השיחה</span><textarea class="inp" id="sc-note" rows="3">' + esc(c.note || '') + '</textarea></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    '<button class="btn danger" data-act="sht-call-del" data-id="' + esc(c.client_id) + '">מחיקה</button>' +
    '<button class="btn" data-act="sht-call-update" data-id="' + esc(c.client_id) + '" data-ksave>' + icon('save') + 'שמירה</button>');
}
function callStatusPick(v) {
  var gb = $('#sc-give-box'), wb = $('#sc-when-box');
  if (gb) gb.hidden = SHT_GIVE.indexOf(v) < 0;
  if (wb) wb.hidden = v !== 'cb';
}
function saveCall(id) {
  var st = val('sc-status'), give = SHT_GIVE.indexOf(st) >= 0, amt = $('#sc-amt'), when = val('sc-when');
  if (!SHT_STATUS[st]) { toast(MSG_SHT_PICK, null, 'warn'); return; }
  var amount = give && amt && amt.value.trim() !== '' ? readNum(amt, 0) : null;
  if (amount != null && !(amount > 0)) { toast(MSG_AMOUNT_POSITIVE, null, 'warn'); return; }
  return update('g_shtar_calls', id, { status: st, ambassador: val('sc-amb'), amount: amount, method: give ? nullable(val('sc-method')) : null,
    callback_at: st === 'cb' && when ? new Date(when).toISOString() : null, note: nullable(val('sc-note')) });
}

// ── המעבר לשלב הבא ──
// הכפתור שב«ממתינים לטיפול» שואל אם להעביר את האיש למצב הבא (ממתין לפרטים — התחייב או תרם), עם סכום ואמצעי — רשות,
// ובמעבר מהתחייב או מתרם — מהשיחה הקודמת. האישור — שיחה חדשה ביום הלחיצה, בשגריר של השיחה הקודמת, והקודמת מסומנת «טופל».
function nextOf(c) { for (var i = 0; i < SHT_NEXT.length; i++) if (SHT_NEXT[i][0] === c.status) return SHT_NEXT[i]; return null; }
function formNext(c) {
  var nx = nextOf(c), p = personById(c.person_client_id);
  if (!nx || !p) return;
  var to = nx[2], one = to.length === 1;
  openModal((personName(p) || MSG_SHT_NO_NAME) + ' · ' + nx[1],
    '<div class="fld"><span>' + 'המצב הבא' + '</span><input type="hidden" id="sn-to" value="' + (one ? to[0] : '') + '">' +
      '<div class="sht-os">' + to.map(function (k) {
        return '<button type="button" class="sht-o ' + SHT_STATUS[k].cls + (one ? ' on' : '') + '" data-act="sht-next-to" data-v="' + k + '" aria-pressed="' + one + '">' + esc(SHT_STATUS[k].l) + '</button>';
      }).join('') + '</div></div>' +
    '<label class="fld"><span>סכום</span><input class="inp" id="sn-amt" inputmode="decimal" value="' + esc(c.amount == null ? '' : c.amount) + '"></label>' +
    '<div class="fld"><span>אמצעי</span><input type="hidden" id="sn-method" value="' + esc(c.method || '') + '">' +
      methodGridHTML({ target: 'sn-method', list: lookupLabels(LK_METHOD), cur: c.method || '', label: 'אמצעי',
                       ico: function (l) { return icon(methodIcon(l)); } }) + '</div>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    '<button class="btn" data-act="sht-next-save" data-id="' + esc(c.client_id) + '" data-ksave>' + icon('check') + 'העברה</button>');
}
function shtNextTo(el) {
  $('#sn-to').value = el.dataset.v;
  document.querySelectorAll('[data-act="sht-next-to"]').forEach(function (b) {
    var on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
  });
}
function saveNext(id) {
  var c = callById(id), to = val('sn-to'), amt = $('#sn-amt');
  if (!c || !nextOf(c)) return;
  if (!SHT_STATUS[to]) { toast(MSG_SHT_PICK, null, 'warn'); return; }
  var amount = amt && amt.value.trim() !== '' ? readNum(amt, 0) : null;
  if (amount != null && !(amount > 0)) { toast(MSG_AMOUNT_POSITIVE, null, 'warn'); return; }
  return insert('g_shtar_calls', { person_client_id: c.person_client_id, status: to, ambassador: c.ambassador, amount: amount,
      method: nullable(val('sn-method')), callback_at: null, note: null, call_at: nowISO(), handled: false })
    .then(function () { return update('g_shtar_calls', id, { handled: true }); });
}

// ── הוספה ועריכה ──
comboDef('sht-donor', { val: true, max: 30,
  items: function () {
    return gSortDonors(state.donors, 'abc').map(function (d) {
      return { value: d.client_id, label: d.name, sub: d.phone || '', find: [d.name, d.phone || ''].join('\n') };
    });
  },
  pick: function (it) {
    var d = it ? donorById(it.value) : null, nm = $('#sp-name'), ph = $('#sp-phone');
    if (nm) { nm.value = d ? d.name : ''; nm.disabled = !!d; }
    if (ph && d && d.phone && !ph.value.trim()) ph.value = d.phone;
  } });

function formShtar(p) {
  var d = p && p.donor_client_id ? donorById(p.donor_client_id) : null;
  openModal(p ? 'עריכת הפרטים' : 'הוספה לרשימה',
    '<div class="fld"><span>כרטיס בגיוס</span>' +
      comboHTML('sht-donor', { id: 'sp-donor', label: 'חיפוש כרטיס לפי שם או טלפון', placeholder: 'חיפוש כרטיס — או שם וטלפון למטה',
                               picked: d ? { value: d.client_id, label: d.name } : null }) + '</div>' +
    '<div class="f2">' +
      '<label class="fld"><span>שם</span><input class="inp" id="sp-name" value="' + esc(p ? personName(p) : '') + '"' + (d ? ' disabled' : '') + '></label>' +
      '<label class="fld"><span>טלפון *</span><input class="inp" id="sp-phone" inputmode="tel" dir="ltr" value="' + esc(p ? p.phone : '') + '"></label>' +
    '</div>' +
    '<label class="fld"><span>הערה</span><input class="inp" id="sp-note" value="' + esc(p ? p.note || '' : '') + '"></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (p ? '<button class="btn danger" data-act="sht-del" data-id="' + esc(p.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="sht-save" data-id="' + esc(p ? p.client_id : '') + '" data-ksave>' + icon('save') + 'שמירה</button>');
}

// כפילות — אותו טלפון או אותו שם; אזהרה, וההוספה ממשיכה רק באישור.
function shtDup(id, name, phone) {
  var pd = digits(phone), nm = name.trim();
  for (var i = 0; i < state.shtarPeople.length; i++) {
    var o = state.shtarPeople[i];
    if (idEq(o.client_id, id)) continue;
    if ((pd && digits(o.phone) === pd) || (nm && personName(o) === nm)) return o;
  }
  return null;
}

function saveShtar(id) {
  var donor = nullable(comboValue('sp-donor')), phone = val('sp-phone').replace(/[\s-]/g, ''), name = donor ? '' : val('sp-name');
  if (!digits(phone)) { toast(MSG_SHT_PHONE, null, 'warn'); return; }
  var row = { donor_client_id: donor, name: nullable(name), phone: phone, note: nullable(val('sp-note')) };
  var dup = shtDup(id, donor ? donorById(donor).name : name, phone);
  var go = function () { return id ? update('g_shtar_people', id, row) : insert('g_shtar_people', row); };
  if (!dup) return go();
  return ask('כפילות', MSG_SHT_DUP + (personName(dup) || MSG_SHT_NO_NAME) + ' · ' + phoneShow(dup.phone) + '. לשמור בכל זאת?', 'שמירה')
    .then(function (yes) { return yes ? go() : undefined; });
}

export { callById, callStatusPick, formCall, formShtar, personById, saveCall, saveShtar, shtCallSave, shtClose, formNext, saveNext, shtNextTo, shtListHTML, shtMethodPick, shtOpen, shtRefresh,
         shtStatusPick, shtStep, viewShtarot };
