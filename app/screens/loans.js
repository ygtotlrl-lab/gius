// app/screens/loans.js — הלוואות
import { dayToday, readNum } from '../../core/util.js';
import { pendTag } from '../../core/sync.js';
import { esc, openModal, receiptHTML, toast } from '../../core/ui.js';
import { APP_FIRST_MONTH, LOAN_KINDS, MONTH_SHORT, LOAN_STATUSES, MSG_AMOUNT_POSITIVE, MSG_CK_AMT, MSG_CK_COUNT, MSG_CK_SUM_PRE, MSG_NEED_MOVE_AMOUNT, MSG_NEED_NAME,
         TTL_LOAN_EDIT, TTL_LOAN_NEW, TTL_MOVE_EDIT } from '../constants.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import { $, dmyDate, emptyBox, gSortLoans, ils, insert, loanBalance, loanCheckList, loanCurMonth, loanDueMonth, loanFlow, loanIsChecks, loanLongDebt, loanMovesOf,
         monthLabel, nextSort, nullable, pendRowKey, selectHTML, shiftMonth, sum, update, val } from '../domain.js';

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

// החישוב — ב-domain.js (גם הדשבורד קורא אותו); כאן — הקיצורים של המסך.
var curMonth = loanCurMonth, movesOf = loanMovesOf, checkList = loanCheckList;
function lastCheckMonth(l) { var c = checkList(l); return c.length && c[c.length - 1].m || ''; }
// הטווח בגרפים — מהחודש הראשון של האפליקציה ועד שלושה חודשים קדימה, מתוכננים לפי תאריכי הפירעון.
var LOAN_AHEAD = 3;
function loanMonths() {
  var out = [], k = APP_FIRST_MONTH, end = shiftMonth(curMonth(), LOAN_AHEAD);
  while (k <= end) { out.push(k); k = shiftMonth(k, 1); }
  return out;
}
function kShort(v) {
  var a = Math.abs(v);
  return a >= 1e6 ? (Math.round(v / 1e5) / 10) + 'M' : a >= 1000 ? Math.round(v / 1000) + 'K' : String(Math.round(v));
}
function signed(v) { return (v < 0 ? '−' : '') + ils(Math.abs(v)); }

// ── לוח ההלוואות — לטווח ארוך בלבד; הלוואה בהחזר בתשלומים — ההחזר שלה בתקציב ──
function loanStat(lab, valHTML, small, cls) {
  return '<div class="stat ln-stat' + (cls ? ' ' + cls : '') + '"><span>' + esc(lab) + '</span><b>' + valHTML + '</b>' +
    (small ? '<small>' + small + '</small>' : '') + '</div>';
}
function loanDashHTML() {
  var cur = curMonth(), f = loanFlow(cur), debt = loanLongDebt(cur), start = loanLongDebt(shiftMonth(APP_FIRST_MONTH, -1)), ch = debt - start;
  return '<section class="card ln-dash"><h2>מצב ההלוואות לטווח ארוך<span class="sp ln-dash-m">' + esc(monthLabel(cur)) + '</span></h2>' +
    '<div class="hero-stats ln-stats">' +
      loanStat('הלוואות חדשות החודש', esc(ils(f.long)), '', f.long > 0 ? 'bad' : '') +
      loanStat('החזרים החודש', esc(ils(f.repaid)), '', f.repaid > 0 ? 'ok' : '') +
      loanStat('נטו החודש', esc(signed(f.net)), esc(f.net > 0 ? 'החוב גדל' : f.net < 0 ? 'החוב קטן' : 'ללא שינוי'), f.net > 0 ? 'bad' : f.net < 0 ? 'ok' : '') +
      loanStat('החוב לטווח ארוך', esc(ils(debt)), esc('מתחילת התקופה ' + (ch > 0 ? 'עלה ' : ch < 0 ? 'ירד ' : 'ללא שינוי ') + (ch ? kShort(Math.abs(ch)) : '')),
        ch > 0 ? 'bad-small' : ch < 0 ? 'ok-small' : '') +
    '</div></section>';
}

// ── הגרפים — חדשות מול החזרים · החוב בסוף כל חודש; החודשים הבאים מקווקוים — מתוכננים לפי תאריכי הפירעון ──
function hFr(v, max) { return Math.round(Math.min(1, Math.max(0, v || 0) / max) * 1000) / 1000; }
function monthLab(m) { var p = m.split('-'); return MONTH_SHORT[+p[1] - 1] + ' ' + p[0].slice(2); }
function colWrap(m, plot) {
  var cur = curMonth();
  return '<div class="fl-col' + (m > cur ? ' ln-future' : '') + (m === cur ? ' ln-now' : '') + '"><div class="fl-plot">' + plot + '</div>' +
    '<div class="fl-lab">' + esc(m === cur ? 'היום' : monthLab(m)) + '</div></div>';
}
function flowColHTML(f, max) {
  var hn = hFr(f.long, max), hr = hFr(f.repaid, max);
  var lb = function (v, cls) { return v > 0 ? '<b class="' + cls + '">' + esc(kShort(v)) + '</b>' : ''; };
  var lbls = hn >= hr ? lb(f.repaid, 'rep') + lb(f.long, 'loan') : lb(f.long, 'loan') + lb(f.repaid, 'rep');
  // עמודה בלי סכום אינה מצוירת — בחודש מתוכנן המסגרת המקווקות הייתה נשארת כקו
  var bar = function (v, h, cls, lbl) { return v > 0 ? '<span class="fl-bar ' + cls + '" style="--v:' + h + '" title="' + esc(lbl + ' ' + ils(v)) + '"></span>' : ''; };
  return colWrap(f.m, bar(f.long, hn, 'loan', 'חדשות') + bar(f.repaid, hr, 'rep', 'החזרים') +
    (lbls ? '<span class="fl-vals" style="--v:' + Math.max(hn, hr) + '">' + lbls + '</span>' : ''));
}
function debtColHTML(o, max) {
  var h = hFr(o.v, max);
  return colWrap(o.m, '<span class="fl-bar debt" style="--v:' + h + '"></span>' +
    (o.v > 0 ? '<span class="fl-vals" style="--v:' + h + '"><b class="ln-tot">' + esc(kShort(o.v)) + '</b></span>' : ''));
}
function loanChartsHTML() {
  var months = loanMonths(), flows = months.map(loanFlow), debt = months.map(function (m) { return { m: m, v: loanLongDebt(m) }; });
  var maxF = 1, maxD = 1;
  flows.forEach(function (f) { maxF = Math.max(maxF, f.long, f.repaid); });
  debt.forEach(function (o) { maxD = Math.max(maxD, o.v); });
  var track = function (list, fn, max) {
    return '<div class="fl-scroll" tabindex="0"><div class="fl-track">' + list.slice().reverse().map(function (x) { return fn(x, max * 1.12); }).join('') + '</div></div>';
  };
  var plan = '<span><i class="ln-k plan"></i>מקווקו — מתוכנן לפי תאריכי הפירעון</span>';
  return '<section class="card ln-charts">' +
    '<div class="fl-hist"><div class="fl-title"><span>הלוואות חדשות מול החזרים</span></div>' +
      '<div class="fl-legend"><div class="fl-lg"><span><i class="loan"></i>הלוואות חדשות</span><span><i class="rep"></i>החזרים</span>' + plan + '</div></div>' +
      track(flows, flowColHTML, maxF) + '</div>' +
    '<div class="fl-hist"><div class="fl-title"><span>החוב לטווח ארוך בסוף כל חודש</span></div>' +
      '<div class="fl-legend"><div class="fl-lg"><span><i class="ln-k dbar"></i>החוב</span>' + plan + '</div></div>' +
      track(debt, debtColHTML, maxD) + '</div>' +
  '</section>';
}

// ── תאריכי פירעון — הלוואות לטווח ארוך שנקבע להן מועד: באיחור, ומה שמועדו בשנה הקרובה ──
function forecastHTML() {
  var cur = curMonth(), items = [];
  state.loans.forEach(function (l) {
    var bal = loanBalance(l, cur), d = loanDueMonth(l);
    if (loanIsChecks(l) || !(bal > 0) || !d) return;
    var sub = 'מועד ההחזר ' + loanWhen(l, 'last_check');
    if (d < cur) items.push({ m: '', late: true, l: l, a: bal, sub: sub });
    else if (d <= shiftMonth(cur, 12)) items.push({ m: d, l: l, a: bal, sub: sub });
  });
  items.sort(function (x, y) { return x.late !== y.late ? (x.late ? -1 : 1) : x.m < y.m ? -1 : x.m > y.m ? 1 : y.a - x.a; });
  var total = sum(items, function (it) { return it.a; });
  var h = '<section class="card ln-fc"><h2>תאריכי פירעון<span class="cnt">' + items.length + '</span>' +
    '<span class="sp ln-fc-tot">' + esc(ils(total)) + '</span></h2>' +
    '<p class="ln-lead">הלוואות לטווח ארוך שנקבע להן מועד החזר, בשנה הקרובה. הלוואה בלי מועד אינה ברשימה — כדאי לקבוע לה מועד.</p>';
  if (!items.length) return h + emptyBox('loans', 'אין תאריכי פירעון בשנה הקרובה') + '</section>';
  return h + '<div class="rc-list">' + receiptHTML(items.map(function (it) {
    return { day: it.late ? 'באיחור — עבר המועד ולא נרשם החזר' : monthLabel(it.m), amt: esc(ils(it.a)), method: 'פירעון', ico: icon('calendar'),
             dashed: it.late, cls: it.late ? 'ln-late' : '',
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

// פרטי ההחזר בשורה — בתשלומים: מספר, סכום וחודשים; לטווח ארוך: מועד ההחזר.
function repayLine(l) {
  if (l.kind === 'checks' && +l.check_count) {
    var c = checkList(l), uneq = Array.isArray(l.check_amounts) && l.check_amounts.length;
    return c.length + ' תשלומים' + (uneq ? ' בסכומים שונים' : ' × ' + ils(l.check_amount)) +
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

// התשלומים של ההלוואה — חודש · סכום · נפרע או עתידי; תשלום בלי חודש — «בלי תאריך», ואינו בצפי.
function checksHTML(l, moves) {
  var cur = curMonth(), c = checkList(l);
  if (!c.length) return '<div class="ln-sub">תשלומים</div>' + emptyBox('cheque', 'לא הוגדרו תשלומים — בעריכת ההלוואה');
  return '<div class="ln-sub">תשלומים</div><div class="ln-cks">' + c.map(function (x) {
    var done = x.m && x.m <= cur;
    return '<div class="ln-ck' + (done ? ' done' : '') + '" title="תשלום ' + x.i + ' מתוך ' + x.n + '">' +
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
// סוג: בתשלומים — מספר · סכום לתשלום · חודש התשלום הראשון (רשות), ו«התשלומים אינם שווים» — סכום לכל צ׳ק;
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
        '<label class="fld"><span>מספר תשלומים</span><input class="inp" id="o-ck-n" inputmode="numeric" data-inp="ck-sync" value="' + esc(l && l.check_count || '') + '"></label>' +
        '<label class="fld" id="o-ck-a-box"' + (uneq ? ' hidden' : '') + '><span>סכום לתשלום</span><input class="inp" id="o-ck-a" inputmode="decimal" data-inp="ck-sync" value="' + esc(l && l.check_amount || '') + '"></label>' +
        '<label class="fld"><span>חודש התשלום הראשון</span><input class="inp" type="month" id="o-ck-m" data-chg="ck-sync" value="' + esc(l && l.first_check_month || '') + '"></label>' +
      '</div>' +
      '<label class="fld chk"><input type="checkbox" id="o-ck-uneq" data-chg="ck-uneq"' + (uneq ? ' checked' : '') + '><span>התשלומים אינם שווים</span></label>' +
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

// סכום לכל תשלום — שורה לכל תשלום, ובה החודש שלו כשיש חודש ראשון.
function ckListHTML(n, first, vals) {
  n = Math.min(+n || 0, 60);
  var h = '';
  for (var i = 0; i < n; i++) {
    h += '<label class="fld ln-ck-f"><span>תשלום ' + (i + 1) + (first ? ' · ' + mmYYYY(shiftMonth(first, i)) : '') + '</span>' +
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
// מספר התשלומים, החודש הראשון והסימון — הרשימה נבנית מחדש ושומרת את מה שהוקלד; ומתחת — סך הצ׳קים מול סכום ההלוואה.
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
  out.textContent = n ? 'סה״כ התשלומים ' + ils(tot) + (amt && tot !== amt ? ' — סכום ההלוואה ' + ils(amt) : '') : '';
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
