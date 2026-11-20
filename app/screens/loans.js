// app/screens/loans.js — הלוואות
import { dayToday, readNum } from '../../core/util.js';
import { pendTag } from '../../core/sync.js';
import { esc, openModal, receiptHTML, toast } from '../../core/ui.js';
import { APP_FIRST_MONTH, LOAN_KINDS, MONTH_SHORT, LOAN_STATUSES, MSG_AMOUNT_POSITIVE, MSG_CK_AMT, MSG_CK_COUNT, MSG_CK_SUM_PRE, MSG_NEED_MOVE_AMOUNT, MSG_NEED_NAME,
         TTL_LOAN_EDIT, TTL_LOAN_NEW, TTL_MOVE_EDIT } from '../constants.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import { $, dmyDate, emptyBox, gSortLoanMoves, gSortLoans, ils, insert, monthAmount, monthKeyOf, monthLabel, monthTxnsInit, nextSort, nullable,
         pendRowKey, selectHTML, shiftMonth, sum, update, val } from '../domain.js';

// תאריך מלא, או חודש בלבד כשהיום אינו ידוע.
function loanWhen(l, k) {
  if (l[k + '_date']) return dmyDate(l[k + '_date']);
  var m = l[k + '_month'];
  return m ? mmYYYY(m) : '';
}
function mmYYYY(m) { return m ? m.slice(5, 7) + '/' + m.slice(0, 4) : ''; }

// שדה תאריך, ולצדו חודש בלבד — אחד מהשניים נשמר.
function whenFieldsHTML(id, label, l, k) {
  return '<div class="f2">' +
    '<label class="fld"><span>' + label + '</span><input class="inp" type="date" id="' + id + '" value="' + esc(l && l[k + '_date'] ? l[k + '_date'] : '') + '"></label>' +
    '<label class="fld"><span>או חודש בלבד</span><input class="inp" type="month" id="' + id + '-m" value="' + esc(l && l[k + '_month'] ? l[k + '_month'] : '') + '"></label>' +
  '</div>';
}

var LOAN_CLS = { 'נמסר': 'ok', 'לטיפול': 'warn', 'להגשה': 'brand', 'בהתראה': 'bad' };

// ── החישוב — אף סכום אינו נשמר ──
function curMonth() { return dayToday().slice(0, 7); }
function movesOf(id) { return gSortLoanMoves(state.loanMoves.filter(function (m) { return m.loan_client_id === id; })); }
function moveMonth(mv) { return mv.move_date ? monthKeyOf(mv.move_date) : ''; }
function takenMonth(l) { return l.taken_date ? monthKeyOf(l.taken_date) : (l.taken_month || ''); }
// מועד ההחזר של הלוואה לטווח ארוך — תאריך מלא או חודש; בלעדיו אינה בצפי.
function dueMonth(l) { return l.last_check_date ? monthKeyOf(l.last_check_date) : (l.last_check_month || ''); }

// הצ׳קים — חודש לכל צ׳ק ברצף מהראשון (בלי חודש ראשון — בלי חודשים), וסכום: שווה, או לכל צ׳ק.
function checkList(l) {
  var n = +l.check_count || 0, out = [];
  var per = Array.isArray(l.check_amounts) && l.check_amounts.length === n ? l.check_amounts : null;
  for (var i = 0; i < n; i++) out.push({ i: i + 1, n: n, m: l.first_check_month ? shiftMonth(l.first_check_month, i) : '',
                                         a: per ? +per[i] || 0 : +l.check_amount || 0 });
  return out;
}
function lastCheckMonth(l) { var c = checkList(l); return c.length && c[c.length - 1].m || ''; }

// נפרע עד סוף חודש mk: התנועות שנרשמו עד אז (ותנועה בלי תאריך — תמיד);
// בצ׳קים — הגבוה מבין זה לבין הצ׳קים שחודשם הגיע, כך שצ׳ק שנרשם גם כתנועה אינו נספר פעמיים;
// ובטווח ארוך, בחודש עתידי — כל הסכום מחודש מועד ההחזר (צפי).
function paidBy(l, mk) {
  var moves = sum(movesOf(l.client_id).filter(function (mv) { var m = moveMonth(mv); return !m || m <= mk; }), function (mv) { return mv.amount; });
  if (l.kind === 'checks') return Math.max(moves, sum(checkList(l).filter(function (c) { return c.m && c.m <= mk; }), function (c) { return c.a; }));
  // הלוואה שמועדה עבר ולא הוחזרה — באיחור, ואינה נספרת כנפרעת בצפי
  if (l.kind === 'long' && mk > curMonth() && dueMonth(l) >= curMonth() && dueMonth(l) <= mk) return Math.max(moves, +l.amount || 0);
  return moves;
}
function loanBalance(l, mk) { return Math.max(0, (+l.amount || 0) - paidBy(l, mk || curMonth())); }
function repaidIn(l, mk) { return paidBy(l, mk) - paidBy(l, shiftMonth(mk, -1)); }
function kindOf(l) { return l.kind === 'checks' || l.kind === 'long' ? l.kind : 'none'; }

// חודש אחד: החוב בסופו לפי סוג · מה שנלקח · מה שהוחזר · צ׳קים · הכנסות (היזומות, כמו בדשבורד).
function loanMonthStats(mk) {
  var s = { m: mk, debt: { checks: 0, long: 0, none: 0 }, taken: 0, repaid: 0, checks: 0, inc: 0, future: mk > curMonth() };
  state.loans.forEach(function (l) {
    var tm = takenMonth(l);
    if (!tm || tm <= mk) s.debt[kindOf(l)] += loanBalance(l, mk);
    if (tm === mk) s.taken += +l.amount || 0;
    var r = repaidIn(l, mk);
    s.repaid += r;
    if (l.kind === 'checks') s.checks += sum(checkList(l).filter(function (c) { return c.m === mk; }), function (c) { return c.a; });
  });
  s.total = s.debt.checks + s.debt.long + s.debt.none;
  if (!s.future) s.inc = sum(monthTxnsInit(mk), monthAmount);
  return s;
}
// הטווח בגרפים — מהחודש הראשון של האפליקציה ועד שלושה חודשי צפי.
var LOAN_AHEAD = 3;
function loanMonths() {
  var out = [], k = APP_FIRST_MONTH, end = shiftMonth(curMonth(), LOAN_AHEAD);
  while (k <= end) { out.push(k); k = shiftMonth(k, 1); }
  return out;
}

function pctOf(a, b) { return b > 0 ? Math.round(a / b * 100) : 0; }
function kShort(v) {
  var a = Math.abs(v);
  return a >= 1e6 ? (Math.round(v / 1e5) / 10) + 'M' : a >= 1000 ? Math.round(v / 1000) + 'K' : String(Math.round(v));
}

// ── לוח ההלוואות ──
function loanStat(lab, valHTML, small, cls) {
  return '<div class="stat ln-stat' + (cls ? ' ' + cls : '') + '"><span>' + esc(lab) + '</span><b>' + valHTML + '</b>' +
    (small ? '<small>' + small + '</small>' : '') + '</div>';
}
function loanDashHTML() {
  var cur = curMonth(), s = loanMonthStats(cur), net = s.taken - s.repaid;
  var yearEnd = shiftMonth(cur, 12), dueYear = 0, dueN = 0, late = 0;
  state.loans.forEach(function (l) {
    if (l.kind !== 'long') return;
    var d = dueMonth(l), b = loanBalance(l, cur);
    if (!d || !(b > 0)) return;
    if (d < cur) late++;
    else if (d <= yearEnd) { dueYear += b; dueN++; }
  });
  var split = [['checks', 'צ׳קים'], ['long', 'ארוך'], ['none', 'לא מסווג']].filter(function (k) { return s.debt[k[0]] > 0 || k[0] !== 'none'; })
    .map(function (k) { return '<span class="ln-part"><i class="ln-k ' + k[0] + '"></i>' + esc(k[1]) + ' ' + esc(kShort(s.debt[k[0]])) + '</span>'; }).join('');
  return '<section class="card ln-dash"><h2>מצב ההלוואות<span class="sp ln-dash-m">' + esc(monthLabel(cur)) + '</span></h2>' +
    '<div class="hero-stats ln-stats">' +
      loanStat('סך החוב', esc(ils(s.total)), split) +
      loanStat('הלוואות נטו החודש', esc(ils(Math.abs(net))), esc((net > 0 ? 'החוב גדל' : net < 0 ? 'החוב קטן' : 'ללא שינוי') +
        ' · נלקח ' + kShort(s.taken) + ' · הוחזר ' + kShort(s.repaid)), net > 0 ? 'bad' : 'ok') +
      loanStat('צ׳קים החודש', esc(ils(s.checks)), s.inc > 0 ? esc(pctOf(s.checks, s.inc) + '% מההכנסות החודש') : esc('אין הכנסות החודש'),
        s.inc > 0 && s.checks > s.inc * 0.5 ? 'warn' : '') +
      loanStat('לפירעון בשנה הקרובה', esc(ils(dueYear)), esc(dueN + ' הלוואות לטווח ארוך' + (late ? ' · ' + late + ' באיחור' : '')), late ? 'warn' : '') +
    '</div></section>';
}

// ── הגרפים — חוב לפי סוג, ונלקח מול הוחזר ──
function hFr(v, max) { return Math.round(Math.min(1, Math.max(0, v || 0) / max) * 1000) / 1000; }
function monthLab(m) { var p = m.split('-'); return MONTH_SHORT[+p[1] - 1] + ' ' + p[0].slice(2); }
function debtColHTML(s, max) {
  var segs = ['none', 'long', 'checks'].map(function (k) {
    return s.debt[k] > 0 ? '<span class="ln-seg ' + k + '" style="--v:' + hFr(s.debt[k], max) + '"></span>' : '';
  }).join('');
  return '<div class="fl-col' + (s.future ? ' ln-future' : '') + '"><div class="fl-plot">' +
      '<div class="ln-stack" style="--v:' + hFr(s.total, max) + '">' + segs +
        (s.total > 0 ? '<span class="fl-vals"><b class="ln-tot">' + esc(kShort(s.total)) + '</b></span>' : '') + '</div>' +
    '</div><div class="fl-lab">' + esc(monthLab(s.m)) + '</div></div>';
}
function flowColHTML(s, max) {
  var ht = hFr(s.taken, max), hr = hFr(s.repaid, max);
  var b = function (v, h, cls, lbl) { return '<span class="fl-bar ' + cls + '" style="--v:' + h + '" title="' + esc(lbl + ' ' + ils(v)) + '"></span>'; };
  // התוויות — מעל העמודה הגבוהה, כמו בדשבורד: הגבוה למעלה ובצבע העמודה
  var lb = function (v, cls) { return v > 0 ? '<b class="' + cls + '">' + esc(kShort(v)) + '</b>' : ''; };
  var lbls = ht >= hr ? lb(s.repaid, 'rep') + lb(s.taken, 'loan') : lb(s.taken, 'loan') + lb(s.repaid, 'rep');
  var ratio = !s.future && s.inc > 0 && s.checks > 0 ? pctOf(s.checks, s.inc) + '%' : '';
  return '<div class="fl-col' + (s.future ? ' ln-future' : '') + '"><div class="fl-plot">' +
      b(s.taken, ht, 'loan', 'נלקח') + b(s.repaid, hr, 'rep', 'הוחזר') +
      (lbls ? '<span class="fl-vals" style="--v:' + Math.max(ht, hr) + '">' + lbls + '</span>' : '') + '</div>' +
    '<div class="fl-lab">' + esc(monthLab(s.m)) + '</div><div class="ln-ratio" title="צ׳קים מתוך ההכנסות">' + esc(ratio) + '</div></div>';
}
function loanChartsHTML() {
  var months = loanMonths().map(loanMonthStats);
  var maxD = 1, maxF = 1;
  months.forEach(function (s) { maxD = Math.max(maxD, s.total); maxF = Math.max(maxF, s.taken, s.repaid); });
  var track = function (fn, max) {
    return '<div class="fl-scroll" tabindex="0"><div class="fl-track">' + months.slice().reverse().map(function (s) { return fn(s, max); }).join('') + '</div></div>';
  };
  return '<section class="card ln-charts">' +
    '<div class="fl-hist"><div class="fl-title"><span>החוב בסוף כל חודש</span></div>' +
      '<div class="fl-legend"><div class="fl-lg"><span><i class="ln-k checks"></i>צ׳קים</span><span><i class="ln-k long"></i>טווח ארוך</span>' +
        '<span><i class="ln-k none"></i>לא מסווג</span><span><i class="ln-k fut"></i>צפי</span></div></div>' +
      track(debtColHTML, maxD) + '</div>' +
    '<div class="fl-hist"><div class="fl-title"><span>נלקח מול הוחזר</span></div>' +
      '<div class="fl-legend"><div class="fl-lg"><span><i class="loan"></i>נלקח</span><span><i class="rep"></i>הוחזר</span>' +
        '<span><b class="ln-ratio-k">%</b>צ׳קים מתוך ההכנסות</span></div></div>' +
      track(flowColHTML, maxF) + '</div>' +
  '</section>';
}

// ── הצפי — באיחור · שלושת החודשים הבאים של צ׳קים · טווח ארוך בשנה הקרובה ──
var FC_CHECK_MONTHS = 3;
function forecastHTML() {
  var cur = curMonth(), items = [];
  state.loans.forEach(function (l) {
    var bal = loanBalance(l, cur);
    if (!(bal > 0)) return;
    if (l.kind === 'checks') {
      checkList(l).forEach(function (c) {
        if (c.m && c.m >= cur && c.m < shiftMonth(cur, FC_CHECK_MONTHS))
          items.push({ m: c.m, l: l, a: c.a, sub: 'צ׳ק ' + c.i + ' מתוך ' + c.n, method: 'צ׳ק', ic: 'cheque' });
      });
    } else if (l.kind === 'long' && dueMonth(l)) {
      var d = dueMonth(l);
      if (d < cur) items.push({ m: '', late: true, l: l, a: bal, sub: 'מועד ההחזר ' + loanWhen(l, 'last_check'), method: 'טווח ארוך', ic: 'loans' });
      else if (d <= shiftMonth(cur, 12)) items.push({ m: d, l: l, a: bal, sub: 'מועד ההחזר ' + loanWhen(l, 'last_check'), method: 'טווח ארוך', ic: 'loans' });
    }
  });
  items.sort(function (x, y) { return x.late !== y.late ? (x.late ? -1 : 1) : x.m < y.m ? -1 : x.m > y.m ? 1 : y.a - x.a; });
  var total = sum(items, function (it) { return it.a; });
  var h = '<section class="card ln-fc"><h2>צפי הפירעונות<span class="cnt">' + items.length + '</span>' +
    '<span class="sp ln-fc-tot">' + esc(ils(total)) + '</span></h2>';
  if (!items.length) return h + emptyBox('loans', 'אין פירעונות מתוכננים') + '</section>';
  return h + '<div class="rc-list">' + receiptHTML(items.map(function (it) {
    return { day: it.late ? 'באיחור' : monthLabel(it.m), amt: esc(ils(it.a)), method: it.method, ico: icon(it.ic), dashed: it.late, cls: it.late ? 'ln-late' : '',
             who: '<b>' + esc(it.l.lender) + '</b><small>' + esc(it.sub) + '</small>', act: 'loan-open', id: it.l.client_id };
  })) + '</div></section>';
}

function loanMatches() {
  var q = String(state.loansQ || '').trim().toLowerCase();
  var st = state.loansStatus;
  return gSortLoans(state.loans.filter(function (l) {
    if (st && l.status !== st) return false;
    return !q || String(l.lender || '').toLowerCase().indexOf(q) >= 0;
  }), state.loansSort);
}

function viewLoans() {
  return loanDashHTML() + loanChartsHTML() + forecastHTML() +
    '<section class="card list-tools">' +
      '<label class="search-box"><input aria-label="חיפוש הלוואה" class="inp search" id="loans-q" data-inp="loans-q" placeholder="חיפוש הלוואה" value="' + esc(state.loansQ) + '">' +
        '<span class="search-ic">' + icon('search') + '</span></label>' +
      '<div class="tools-row">' + selectHTML('loans-status', LOAN_STATUSES, state.loansStatus, 'סינון לפי סטטוס', 'loans-status') +
      '<div class="seg" role="group" aria-label="מיון">' +
      [['name', 'שם'], ['taken', 'תאריך לקיחה'], ['end', 'תאריך סיום'], ['status', 'סטטוס']].map(function (o) {
        return '<button class="' + (state.loansSort === o[0] ? 'on' : '') + '" data-act="loans-sort" data-v="' + o[0] + '">' + o[1] + '</button>';
      }).join('') + '</div></div></section>' +
    '<section class="card" id="loans-list">' + loansBodyHTML() + '</section>';
}

// פרטי ההחזר בשורה — צ׳קים: מספר, סכום וחודשים; טווח ארוך: מועד ההחזר.
function repayLine(l) {
  if (l.kind === 'checks' && +l.check_count) {
    var c = checkList(l), uneq = Array.isArray(l.check_amounts) && l.check_amounts.length;
    return c.length + ' צ׳קים' + (uneq ? ' בסכומים שונים' : ' × ' + ils(l.check_amount)) +
      (l.first_check_month ? ' · מ־' + mmYYYY(l.first_check_month) + ' עד ' + mmYYYY(lastCheckMonth(l)) : ' · בלי תאריך');
  }
  if (l.kind === 'long') return loanWhen(l, 'last_check') ? 'מועד ההחזר ' + loanWhen(l, 'last_check') : 'בלי מועד החזר';
  return '';
}

// הלוואה סגורה — מלווה · פרטים · יתרה; לחיצה פותחת את התנועות, הלוואה אחת פתוחה בכל פעם.
function loansBodyHTML() {
  var list = loanMatches(), cur = curMonth();
  if (state.loansOpen && !list.some(function (l) { return l.client_id === state.loansOpen; })) state.loansOpen = null;
  var h = '<h2>הלוואות<span class="cnt">' + list.length + '</span>' +
    '<span class="sp"><button class="btn sm" data-act="loan-new">' + icon('plus') + 'הלוואה</button></span></h2>';
  if (!list.length) return h + emptyBox('loans', state.loans.length ? 'אין הלוואה התואמת את החיפוש או הסינון' : 'אין הלוואות רשומות');
  h += '<div class="evs">' + list.map(function (l) {
    var open = state.loansOpen === l.client_id, id = esc(l.client_id), moves = movesOf(l.client_id), bal = loanBalance(l, cur);
    var r = '<div class="ev' + (open ? ' open' : '') + '" id="ln-' + id + '">' +
      '<button class="ev-hd" data-act="loan-toggle" data-id="' + id + '" aria-expanded="' + open + '">' +
        '<span class="ev-name"><b>' + esc(l.lender) + pendTag(pendRowKey('g_loans', l.client_id)) +
          (l.kind ? ' <span class="badge ln-kb ' + l.kind + '">' + esc(LOAN_KINDS[l.kind]) + '</span>' : '') +
          (l.status ? ' <span class="badge ' + (LOAN_CLS[l.status] || '') + '">' + esc(l.status) + '</span>' : '') + '</b>' +
          '<small>' + esc([loanWhen(l, 'taken') ? 'נלקחה ' + loanWhen(l, 'taken') : '', repayLine(l), l.repay_terms, l.note]
            .filter(Boolean).join(' · ')) + '</small></span>' +
        '<span class="ln-amt"><small>יתרה</small><b>' + ils(bal) + '</b><small>מתוך ' + ils(l.amount) + '</small></span>' +
        '<span class="ev-chev" aria-hidden="true">' + icon(open ? 'up' : 'down') + '</span>' +
      '</button>';
    if (open) {
      r += '<div class="ev-body" data-ks-area>' + (l.kind === 'checks' ? checksHTML(l, moves) : '') +
        (moves.length ? '<div class="ln-sub">תנועות</div>' + moves.map(function (m) {
          return '<div class="row" data-act="loan-move-edit" data-id="' + esc(m.client_id) + '">' +
            '<div class="main"><b>' + ils(m.amount) + pendTag(pendRowKey('g_loan_moves', m.client_id)) + '</b>' +
              '<small>' + esc([m.move_date ? dmyDate(m.move_date) : '', m.note].filter(Boolean).join(' · ') || '—') + '</small></div></div>';
        }).join('') : l.kind === 'checks' ? '' : emptyBox('loans', 'אין עדיין תנועות בהלוואה')) +
        '<div class="total-row"><span>יתרה</span><b>' + ils(bal) + '</b></div>' +
        '<div class="lm-add" data-ks>' +
          '<input class="inp lm-amt" id="lm-amt" inputmode="decimal" placeholder="סכום" aria-label="סכום התנועה">' +
          '<input class="inp lm-date" id="lm-date" type="date" value="' + esc(dayToday()) + '" aria-label="תאריך התנועה">' +
          '<input class="inp lm-note" id="lm-note" placeholder="הערה" aria-label="הערה לתנועה">' +
          '<button class="btn sm" data-act="loan-move-add" data-id="' + id + '" data-ksave>' + icon('plus') + 'הוספה</button>' +
        '</div>' +
        '<div class="btnrow ev-acts"><button class="btn ghost sm" data-act="loan-edit" data-id="' + id + '">עריכת ההלוואה</button></div>' +
      '</div>';
    }
    return r + '</div>';
  }).join('') + '</div>';
  h += '<div class="total-row"><span>סה״כ יתרה</span><b>' + ils(sum(list, function (l) { return loanBalance(l, cur); })) + '</b></div>';
  return h;
}

// הצ׳קים של ההלוואה — חודש · סכום · נפרע או עתידי; צ׳ק בלי חודש — «בלי תאריך», ואינו בצפי.
function checksHTML(l, moves) {
  var cur = curMonth(), c = checkList(l);
  if (!c.length) return '<div class="ln-sub">צ׳קים</div>' + emptyBox('cheque', 'לא הוגדרו צ׳קים — בעריכת ההלוואה');
  return '<div class="ln-sub">צ׳קים</div><div class="ln-cks">' + c.map(function (x) {
    var done = x.m && x.m <= cur;
    return '<div class="ln-ck' + (done ? ' done' : '') + '" title="צ׳ק ' + x.i + ' מתוך ' + x.n + '">' +
      '<span class="ln-ck-m">' + esc(x.i + ' · ' + (x.m ? monthLab(x.m) : 'בלי תאריך')) + '</span>' +
      '<b>' + esc(ils(x.a)) + '</b><small>' + (done ? 'נפרע' : x.m ? 'עתידי' : 'אינו בצפי') + '</small></div>';
  }).join('') + '</div>';
}

// עריכת תנועה — סכום · תאריך · הערה, ומחיקה.
function formLoanMove(m) {
  openModal(TTL_MOVE_EDIT,
    '<div class="f2">' +
      '<label class="fld"><span>סכום *</span><input class="inp" id="lm-e-amt" inputmode="decimal" value="' + esc(m.amount) + '"></label>' +
      '<label class="fld"><span>תאריך</span><input class="inp" id="lm-e-date" type="date" value="' + esc(m.move_date || '') + '"></label>' +
    '</div>' +
    '<label class="fld"><span>הערה</span><input class="inp" id="lm-e-note" value="' + esc(m.note || '') + '"></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    '<button class="btn danger" data-act="loan-move-del" data-id="' + esc(m.client_id) + '">מחיקה</button>' +
    '<button class="btn" data-act="loan-move-save" data-id="' + esc(m.client_id) + '" data-ksave>' + icon('save') + 'שמירה</button>');
}

function saveLoanMove(id) {
  var amount = readNum($('#lm-e-amt'), 0);
  if (!amount) { toast(MSG_NEED_MOVE_AMOUNT, null, 'warn'); return; }
  return update('g_loan_moves', id, { amount: amount, move_date: nullable(val('lm-e-date')), note: nullable(val('lm-e-note')) });
}

// תנועה — סכום (חובה, לא אפס; שלילי מגדיל את היתרה), תאריך (ברירת המחדל — היום) והערה.
function addLoanMove(id) {
  var amount = readNum($('#lm-amt'), 0);
  if (!amount) { toast(MSG_NEED_MOVE_AMOUNT, null, 'warn'); return; }
  return insert('g_loan_moves', { loan_client_id: id, amount: amount, move_date: nullable(val('lm-date')),
                                  note: nullable(val('lm-note')), sort: nextSort(movesOf(id)) });
}

// ── טופס ההלוואה ──
// סוג: בצ׳קים — מספר · סכום לצ׳ק · חודש הצ׳ק הראשון (רשות), ו«הצ׳קים אינם שווים» — סכום לכל צ׳ק;
// לטווח ארוך — מועד ההחזר (רשות). בלי תאריך — ההלוואה אינה נכנסת לצפי, עד שנקבע לה.
function formLoan(l) {
  var kind = l ? l.kind || '' : '', uneq = !!(l && Array.isArray(l.check_amounts) && l.check_amounts.length);
  openModal(l ? TTL_LOAN_EDIT : TTL_LOAN_NEW,
    '<div class="f2">' +
      '<label class="fld"><span>מלווה *</span><input class="inp" id="o-lender" value="' + esc(l ? l.lender : '') + '"></label>' +
      '<label class="fld"><span>סכום *</span><input class="inp" id="o-amount" inputmode="decimal" data-inp="ck-sync" value="' + esc(l && l.amount != null ? l.amount : '') + '"></label>' +
    '</div>' +
    '<input type="hidden" id="o-kind" value="' + esc(kind) + '">' +
    '<div class="fld"><span>סוג ההלוואה</span><div class="seg seg-wide ln-kind" role="radiogroup" aria-label="סוג ההלוואה">' +
      Object.keys(LOAN_KINDS).map(function (k) {
        return '<button type="button" role="radio" aria-checked="' + (kind === k) + '" class="' + (kind === k ? 'on' : '') + '" data-act="loan-kind" data-v="' + k + '">' +
          icon(k === 'checks' ? 'cheque' : 'calendar') + esc(LOAN_KINDS[k]) + '</button>';
      }).join('') + '</div></div>' +
    '<div class="ln-box" id="o-ck"' + (kind === 'checks' ? '' : ' hidden') + '>' +
      '<div class="f3">' +
        '<label class="fld"><span>מספר צ׳קים</span><input class="inp" id="o-ck-n" inputmode="numeric" data-inp="ck-sync" value="' + esc(l && l.check_count || '') + '"></label>' +
        '<label class="fld" id="o-ck-a-box"' + (uneq ? ' hidden' : '') + '><span>סכום לצ׳ק</span><input class="inp" id="o-ck-a" inputmode="decimal" data-inp="ck-sync" value="' + esc(l && l.check_amount || '') + '"></label>' +
        '<label class="fld"><span>חודש הצ׳ק הראשון</span><input class="inp" type="month" id="o-ck-m" data-chg="ck-sync" value="' + esc(l && l.first_check_month || '') + '"></label>' +
      '</div>' +
      '<label class="fld chk"><input type="checkbox" id="o-ck-uneq" data-chg="ck-uneq"' + (uneq ? ' checked' : '') + '><span>הצ׳קים אינם שווים</span></label>' +
      '<div class="ln-ck-list" id="o-ck-list">' + (uneq ? ckListHTML(l.check_count, l.first_check_month, l.check_amounts) : '') + '</div>' +
      '<div class="ln-ck-sum" id="o-ck-sum"></div>' +
    '</div>' +
    '<div class="ln-box" id="o-lg"' + (kind === 'long' ? '' : ' hidden') + '>' + whenFieldsHTML('o-check', 'מועד ההחזר', l, 'last_check') + '</div>' +
    whenFieldsHTML('o-taken', 'תאריך לקיחה', l, 'taken') +
    '<label class="fld"><span>תנאי החזר</span><input class="inp" id="o-terms" value="' + esc(l ? l.repay_terms || '' : '') + '"></label>' +
    '<label class="fld"><span>סטטוס</span><select class="inp" id="o-status"><option value="">— ללא —</option>' + LOAN_STATUSES.map(function (s) {
      return '<option' + (l && l.status === s ? ' selected' : '') + '>' + esc(s) + '</option>';
    }).join('') + '</select></label>' +
    '<label class="fld"><span>הערה</span><input class="inp" id="o-note" value="' + esc(l ? l.note || '' : '') + '"></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (l ? '<button class="btn danger" data-act="loan-del" data-id="' + esc(l.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="loan-save" data-id="' + esc(l ? l.client_id : '') + '" data-ksave>' + icon('save') + 'שמירה</button>');
  ckSync();
}

// סכום לכל צ׳ק — שורה לכל צ׳ק, ובה החודש שלו כשיש חודש ראשון.
function ckListHTML(n, first, vals) {
  n = Math.min(+n || 0, 60);
  var h = '';
  for (var i = 0; i < n; i++) {
    h += '<label class="fld ln-ck-f"><span>צ׳ק ' + (i + 1) + (first ? ' · ' + mmYYYY(shiftMonth(first, i)) : '') + '</span>' +
      '<input class="inp" inputmode="decimal" data-ck="' + i + '" data-inp="ck-sync" value="' + esc(vals && vals[i] != null ? vals[i] : '') + '"></label>';
  }
  return h;
}
function ckReadList() {
  return Array.prototype.map.call(document.querySelectorAll('#o-ck-list [data-ck]'), function (el) { return readNum(el, 0); });
}
function loanKindPick(el) {
  var h = $('#o-kind'); if (!h) return;
  h.value = h.value === el.dataset.v ? '' : el.dataset.v;
  document.querySelectorAll('.ln-kind button').forEach(function (b) { var on = b.dataset.v === h.value; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  $('#o-ck').hidden = h.value !== 'checks';
  $('#o-lg').hidden = h.value !== 'long';
  ckSync();
}
// מספר הצ׳קים, החודש הראשון והסימון — הרשימה נבנית מחדש ושומרת את מה שהוקלד; ומתחת — סך הצ׳קים מול סכום ההלוואה.
function ckSync() {
  var list = $('#o-ck-list'), box = $('#o-ck-a-box'), out = $('#o-ck-sum');
  if (!list || !out) return;
  var uneq = !!($('#o-ck-uneq') && $('#o-ck-uneq').checked), n = Math.min(readNum($('#o-ck-n'), 0), 60), first = val('o-ck-m');
  box.hidden = uneq;
  if (uneq) {
    var have = ckReadList();
    if (have.length !== n || list.dataset.first !== first) { list.innerHTML = ckListHTML(n, first, have.map(function (v) { return v || ''; })); list.dataset.first = first; }
  } else if (list.innerHTML) list.innerHTML = '';
  var tot = uneq ? sum(ckReadList(), function (v) { return v; }) : n * readNum($('#o-ck-a'), 0), amt = readNum($('#o-amount'), 0);
  out.textContent = n ? 'סה״כ הצ׳קים ' + ils(tot) + (amt && tot !== amt ? ' — סכום ההלוואה ' + ils(amt) : '') : '';
  out.classList.toggle('warn', !!(n && amt && tot !== amt));
}

function saveLoan(id) {
  var lender = val('o-lender'), amount = readNum($('#o-amount'), 0), kind = val('o-kind') || null;
  if (!lender) { toast(MSG_NEED_NAME, null, 'warn'); return; }
  if (!(amount > 0)) { toast(MSG_AMOUNT_POSITIVE, null, 'warn'); return; }
  var td = nullable(val('o-taken'));
  var row = { lender: lender, amount: amount, kind: kind,
              taken_date: td, taken_month: td ? null : nullable(val('o-taken-m')),
              repay_terms: nullable(val('o-terms')), status: nullable(val('o-status')), note: nullable(val('o-note')) };
  if (kind === 'checks') {
    var n = readNum($('#o-ck-n'), 0), uneq = $('#o-ck-uneq').checked;
    if (!(n > 0) || n !== Math.round(n)) { toast(MSG_CK_COUNT, null, 'warn'); return; }
    var per = uneq ? ckReadList() : null, a = uneq ? null : readNum($('#o-ck-a'), 0);
    if (uneq ? per.some(function (v) { return !(v > 0); }) : !(a > 0)) { toast(MSG_CK_AMT, null, 'warn'); return; }
    var tot = uneq ? sum(per, function (v) { return v; }) : n * a;
    row.check_count = n; row.check_amount = a; row.check_amounts = per; row.first_check_month = nullable(val('o-ck-m'));
    if (tot !== amount) toast(MSG_CK_SUM_PRE + ils(tot) + ' / ' + ils(amount), null, 'warn');
  } else {
    row.check_count = null; row.check_amount = null; row.check_amounts = null; row.first_check_month = null;
  }
  if (kind === 'long') {
    var cd = nullable(val('o-check'));
    row.last_check_date = cd; row.last_check_month = cd ? null : nullable(val('o-check-m'));
  }
  return id ? update('g_loans', id, row) : insert('g_loans', row);
}

export { addLoanMove, ckSync, formLoan, formLoanMove, loanKindPick, saveLoanMove, loansBodyHTML, saveLoan, viewLoans };
