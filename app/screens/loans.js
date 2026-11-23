// app/screens/loans.js — הלוואות
import { dayToday, readNum } from '../../core/util.js';
import { pendTag } from '../../core/sync.js';
import { comboDef, comboHTML, comboValue, esc, openModal, receiptHTML, toast } from '../../core/ui.js';
import { APP_FIRST_MONTH, LOAN_KINDS, MONTH_SHORT, LOAN_STATUSES, MSG_AMOUNT_POSITIVE, MSG_CK_AMT, MSG_CK_COUNT, MSG_CK_FIRST, MSG_LOAN_KIND, MSG_CK_SUM_PRE, MSG_NEED_MOVE_AMOUNT, MSG_NEED_NAME,
         TTL_LOAN_EDIT, TTL_LOAN_NEW, TTL_MOVE_EDIT } from '../constants.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import { $, dmyDate, donorById, emptyBox, gSortDonors, gSortLoans, ils, insert, loanBalance, loanCheckList, loanInterest, loanLeft, loanTotal, loanCurMonth, loanDueMonth, loanDebt, loanFlow, loanIsChecks, loanMovesOf,
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

// ── לוח ההלוואות — כל החוב, משני הסוגים: לטווח ארוך ובתשלומים ──
function loanStat(lab, valHTML, small, cls) {
  return '<div class="stat ln-stat' + (cls ? ' ' + cls : '') + '"><span>' + esc(lab) + '</span><b>' + valHTML + '</b>' +
    (small ? '<small>' + small + '</small>' : '') + '</div>';
}
function startMonth() { return shiftMonth(APP_FIRST_MONTH, -1); }
// השינוי מתחילת התקופה, כל חלק בצבעו: עלה — אדום, ירד — ירוק
function chg(lab, kind) {
  var c = loanDebt(curMonth(), kind) - loanDebt(startMonth(), kind);
  return '<span class="' + (c > 0 ? 'up' : c < 0 ? 'down' : '') + '">' + esc(lab + ' ' + (c > 0 ? '↑ ' : c < 0 ? '↓ ' : '') + kShort(Math.abs(c))) + '</span>';
}
function loanDashHTML() {
  var cur = curMonth(), f = loanFlow(cur), debt = loanDebt(cur), ch = debt - loanDebt(startMonth());
  return '<section class="card ln-dash"><h2>מצב ההלוואות<span class="sp ln-dash-m">' + esc(monthLabel(cur)) + '</span></h2>' +
    '<div class="hero-stats ln-stats">' +
      loanStat('הלוואות החודש', esc(ils(f.added)), esc('לטווח ארוך ' + kShort(f.long) + ' · בתשלומים ' + kShort(f.inst)), f.added > 0 ? 'bad' : '') +
      loanStat('החזרים החודש', esc(ils(f.repaid)), esc('לטווח ארוך ' + kShort(f.repLong) + ' · בתשלומים ' + kShort(f.repInst)) +
        // היתר העסקה — הוצאה: כתוב לצד ההחזרים, ואינו בחוב ובנטו
        (f.interest > 0 ? '<span class="int">' + esc('ועוד היתר עסקה ' + kShort(f.interest)) + '</span>' : ''), f.repaid > 0 ? 'ok' : '') +
      loanStat('נטו החודש', esc(signed(f.net)), esc(f.net > 0 ? 'החוב גדל' : f.net < 0 ? 'החוב קטן' : 'ללא שינוי'), f.net > 0 ? 'bad' : f.net < 0 ? 'ok' : '') +
      loanStat('החוב הכללי', esc(ils(debt)), chg('מתחילת התקופה', null) + ' · ' + chg('לטווח ארוך', 'long') + ' · ' + chg('בתשלומים', 'inst'), 'ln-chg') +
    '</div></section>';
}

// ── הגרפים — חדשות מול החזרים · החוב בסוף כל חודש, לפי סוג; החודשים הבאים מקווקוים — מתוכננים ──
function hFr(v, max) { return Math.round(Math.min(1, Math.max(0, v || 0) / max) * 1000) / 1000; }
function monthLab(m) { var p = m.split('-'); return MONTH_SHORT[+p[1] - 1] + ' ' + p[0].slice(2); }
function colWrap(m, plot, lab) {
  var cur = curMonth();
  return '<div class="fl-col' + (m > cur ? ' ln-future' : '') + (m === cur ? ' ln-now' : '') + (lab ? ' ln-start' : '') + '"><div class="fl-plot">' + plot + '</div>' +
    '<div class="fl-lab">' + esc(lab || (m === cur ? 'היום' : monthLab(m))) + '</div></div>';
}
// נקודת ההתחלה — «תחילת <החודש הראשון>»: החוב בסוף החודש שלפניו, כך שהגרף מתחיל מאותה נקודה שממנה נמדד «מתחילת התקופה»
function startLab() { return 'תחילת ' + monthLab(APP_FIRST_MONTH); }
// עמודה בלי סכום אינה מצוירת — בחודש מתוכנן המסגרת המקווקות הייתה נשארת כקו
function bar(v, h, cls, lbl) { return v > 0 ? '<span class="fl-bar ' + cls + '" style="--v:' + h + '" title="' + esc(lbl + ' ' + ils(v)) + '"></span>' : ''; }
function vals(list, top) {
  var b = list.filter(function (x) { return x.v > 0; }).sort(function (a, c) { return a.h - c.h; })
    .map(function (x) { return '<b class="' + x.cls + '">' + esc(kShort(x.v)) + '</b>'; }).join('');
  return b ? '<span class="fl-vals" style="--v:' + top + '">' + b + '</span>' : '';
}
// צפי ההחזרים — עמודה חיוורת בגובה כל ההחזרים של החודש (קרן והיתר עסקה, משני הסוגים), והחלק הצבוע בתחתיתה — לטווח ארוך.
function fcColHTML(f, max) {
  var all = f.grossLong + f.grossInst, h = hFr(all, max);
  var plot = all > 0 ? '<span class="fl-bar ln-fcbar" style="--v:' + h + '" title="' + esc('כל ההחזרים ' + ils(all) + ' · לטווח ארוך ' + ils(f.grossLong)) + '">' +
    '<span class="fl-solid" style="--s:' + hFr(f.grossLong, all || 1) + '"></span></span>' : '';
  return colWrap(f.m, plot + (all > 0 ? '<span class="fl-vals" style="--v:' + h + '"><b class="ln-a">' + esc(kShort(f.grossLong)) +
    '<small>מתוך ' + esc(kShort(all)) + '</small></b></span>' : ''));
}
function debtColHTML(o, max) {
  var hl = hFr(o.long, max), hi = hFr(o.inst, max);
  return colWrap(o.m, bar(o.long, hl, 'ln-a', 'לטווח ארוך') + bar(o.inst, hi, 'ln-b', 'בתשלומים') +
    vals([{ v: o.long, h: hl, cls: 'ln-a' }, { v: o.inst, h: hi, cls: 'ln-b' }], Math.max(hl, hi)), o.lab);
}
// שני גרפים, סגורים בכפתורים זה מעל זה (`state.lnChartOpen`): צפי ההחזרים לרבעון הקרוב · החוב בסוף כל חודש.
var FC_MONTHS = 3;
function loanChartsHTML() {
  var open = state.lnChartOpen || {}, cur = curMonth(), h = '';
  var btn = function (k, title, sub, body) {
    var on = !!open[k];
    return '<div class="ix-sub-wrap' + (on ? ' open' : '') + '"><button class="ix-btn" data-act="ln-chart" data-k="' + k + '" aria-expanded="' + on + '">' +
      '<span class="ix-btn-t">' + esc(title) + '<small>' + esc(sub) + '</small></span>' +
      '<span class="ix-btn-c" aria-hidden="true">' + icon(on ? 'up' : 'down') + '</span></button>' + (on ? '<div class="ln-chart-in">' + body() + '</div>' : '') + '</div>';
  };
  var track = function (list, fn, max) {
    return '<div class="fl-scroll" tabindex="0"><div class="fl-track">' + list.slice().reverse().map(function (x) { return fn(x, max * 1.35); }).join('') + '</div></div>';
  };
  var fcMonths = []; for (var i = 0; i < FC_MONTHS; i++) fcMonths.push(shiftMonth(cur, i));
  var fcFlows = fcMonths.map(loanFlow), fcTot = sum(fcFlows, function (f) { return f.grossLong + f.grossInst; });
  h += btn('fc', 'צפי ההחזרים לרבעון הקרוב', 'סה״כ ' + ils(fcTot), function () {
    var max = 1; fcFlows.forEach(function (f) { max = Math.max(max, f.grossLong + f.grossInst); });
    return '<div class="fl-legend"><div class="fl-lg"><span><i class="ln-k fcall"></i>כל ההחזרים</span><span><i class="ln-k dbar"></i>מתוכם לטווח ארוך</span></div></div>' +
      '<div class="ln-fc-chart">' + track(fcFlows, fcColHTML, max) + '</div>';
  });
  h += btn('debt', 'החוב בסוף כל חודש', 'היום ' + ils(loanDebt(cur)), function () {
    var s0 = startMonth(), months = loanMonths(), debt = [{ m: s0, lab: startLab(), long: loanDebt(s0, 'long'), inst: loanDebt(s0, 'inst') }]
      .concat(months.map(function (m) { return { m: m, long: loanDebt(m, 'long'), inst: loanDebt(m, 'inst') }; })), max = 1;
    debt.forEach(function (o) { max = Math.max(max, o.long, o.inst); });
    return '<div class="fl-legend"><div class="fl-lg"><span><i class="ln-k dbar"></i>לטווח ארוך</span><span><i class="ln-k ibar"></i>בתשלומים</span>' +
      '<span><i class="ln-k plan"></i>מקווקו — מתוכנן לפי תאריכי הפירעון והתשלומים</span></div></div>' + track(debt, debtColHTML, max);
  });
  return '<section class="card ln-charts"><h2>גרפים</h2><div class="ix-subs">' + h + '</div></section>';
}

// ── תאריכי פירעון — הלוואות לטווח ארוך שנקבע להן מועד: באיחור, ומה שמועדו בשנה הקרובה ──
function forecastHTML() {
  var cur = curMonth(), items = [];
  state.loans.forEach(function (l) {
    var bal = loanLeft(l, cur), d = loanDueMonth(l);
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
             who: '<b>' + esc(lenderOf(it.l)) + '</b><small>' + esc(it.sub) + '</small>', act: 'loan-open', id: it.l.client_id };
  })) + '</div></section>';
}

// המלווה — הכרטיס שההלוואה משויכת אליו (`donor_client_id`), ובלעדיו — השם שהוקלד (`lender`)
function lenderOf(l) { var d = l.donor_client_id ? donorById(l.donor_client_id) : null; return d ? d.name : l.lender || ''; }
function loanMatches() {
  var q = String(state.loansQ || '').trim().toLowerCase();
  var st = state.loansStatus;
  return gSortLoans(state.loans.filter(function (l) {
    if (st && l.status !== st) return false;
    return !q || lenderOf(l).toLowerCase().indexOf(q) >= 0;
  }), state.loansSort);
}

function viewLoans() {
  return loanDashHTML() + loanChartsHTML() + forecastHTML() +
    '<section class="card list-tools">' +
      '<label class="search-box"><input aria-label="חיפוש הלוואה" class="inp search" id="loans-q" data-inp="loans-q" placeholder="חיפוש הלוואה" value="' + esc(state.loansQ) + '">' +
        '<span class="search-ic">' + icon('search') + '</span></label>' +
      '<div class="tools-row">' + selectHTML('loans-status', LOAN_STATUSES, state.loansStatus, 'סינון לפי סטטוס', 'loans-status') +
      '<div class="seg" role="group" aria-label="תצוגה">' +
      [['loan', 'לפי הלוואות'], ['person', 'לפי אנשים']].map(function (o) {
        return '<button class="' + ((state.loansBy || 'loan') === o[0] ? 'on' : '') + '" data-act="loans-by" data-v="' + o[0] + '">' + o[1] + '</button>';
      }).join('') + '</div>' +
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
// קרן · היתר עסקה · להחזר — רק כשיש היתר עסקה.
function interestLine(l) {
  var i = loanInterest(l);
  return i > 0 ? 'קרן ' + ils(l.amount) + ' · היתר עסקה ' + ils(i) + ' · להחזר ' + ils(loanTotal(l)) : '';
}

// הלוואה סגורה — מלווה · פרטים · יתרה; לחיצה פותחת את התנועות, הלוואה אחת פתוחה בכל פעם.
function loansBodyHTML() {
  var list = loanMatches(), cur = curMonth();
  if (state.loansOpen && !list.some(function (l) { return l.client_id === state.loansOpen; })) state.loansOpen = null;
  var h = '<h2>הלוואות<span class="cnt">' + list.length + '</span>' +
    '<span class="sp"><button class="btn sm" data-act="loan-new">' + icon('plus') + 'הלוואה</button></span></h2>';
  if (!list.length) return h + emptyBox('loans', state.loans.length ? 'אין הלוואה התואמת את החיפוש או הסינון' : 'אין הלוואות רשומות');
  if ((state.loansBy || 'loan') === 'person') {
    // לפי אנשים — קבוצה לכל מלווה (הכרטיס, ובלעדיו השם), ובכותרת מספר ההלוואות וסך הנותר להחזיר
    // קבוצה לכל כרטיס, ולכל שם חופשי כפי שהוקלד — שם חופשי אינו משויך לכרטיס מעצמו: אי אפשר לדעת שזה אותו אדם
    var groups = {}, order = [];
    list.forEach(function (l) {
      var did = l.donor_client_id || '';
      var k = did ? 'd:' + did : 'n:' + String(l.lender || '').trim();
      if (!groups[k]) { groups[k] = { name: did ? (donorById(did) || {}).name || lenderOf(l) : lenderOf(l), card: !!did, list: [] }; order.push(k); }
      groups[k].list.push(l);
    });
    order.sort(function (a, b) { return groups[a].name.localeCompare(groups[b].name, 'he'); });
    h += order.map(function (k) {
      var g = groups[k];
      return '<div class="ln-person"><div class="ln-ph"><b>' + esc(g.name) + '</b>' +
          (g.card ? '<span class="ln-card" title="משויך לכרטיס">' + icon('cards') + '</span>' : '') +
          '<span class="cnt">' + g.list.length + '</span>' +
          '<span class="ln-ph-sum"><small>נותר להחזיר</small>' + ils(sum(g.list, function (l) { return loanLeft(l, cur); })) + '</span></div>' +
        '<div class="evs">' + g.list.map(function (l) { return loanCardHTML(l, cur); }).join('') + '</div></div>';
    }).join('');
  } else h += '<div class="evs">' + list.map(function (l) { return loanCardHTML(l, cur); }).join('') + '</div>';
  h += '<div class="total-row"><span>סה״כ נותר להחזיר</span><b>' + ils(sum(list, function (l) { return loanLeft(l, cur); })) + '</b></div>';
  return h;
}

// כרטיס הלוואה סגור — מלווה · פרטים · יתרה; לחיצה פותחת את התנועות. בתצוגה לפי אנשים — בלי השם, שכבר בכותרת הקבוצה
function loanCardHTML(l, cur) {
    var open = state.loansOpen === l.client_id, id = esc(l.client_id), moves = movesOf(l.client_id), bal = loanLeft(l, cur);
    var r = '<div class="ev' + (open ? ' open' : '') + '" id="ln-' + id + '">' +
      '<button class="ev-hd" data-act="loan-toggle" data-id="' + id + '" aria-expanded="' + open + '">' +
        '<span class="ev-name"><b>' + (state.loansBy === 'person' ? 'הלוואה ' + esc(ils(l.amount)) : esc(lenderOf(l)) + (l.donor_client_id ? ' <span class="ln-card" title="משויך לכרטיס">' + icon('cards') + '</span>' : '')) + pendTag(pendRowKey('g_loans', l.client_id)) +
          // סוג ההחזר — האייקון שלו (השם ברמז); הסטטוס — תגית בצבע האפליקציה, אחת לכולם
          (l.kind ? ' <span class="ln-kic" title="' + esc(LOAN_KINDS[l.kind]) + '" aria-label="' + esc(LOAN_KINDS[l.kind]) + '">' + icon(l.kind === 'checks' ? 'cheque' : 'calendar') + '</span>' : '') +
          (l.status ? ' <span class="badge brand">' + esc(l.status) + '</span>' : '') + '</b>' +
          '<small>' + esc([loanWhen(l, 'taken') ? 'נלקחה ' + loanWhen(l, 'taken') : '', repayLine(l), interestLine(l), l.repay_terms, l.note]
            .filter(Boolean).join(' · ')) + '</small></span>' +
        '<span class="ln-amt"><small>נותר להחזיר</small><b>' + ils(bal) + '</b><small>מתוך ' + ils(loanTotal(l)) + '</small></span>' +
        '<span class="ev-chev" aria-hidden="true">' + icon(open ? 'up' : 'down') + '</span>' +
      '</button>';
    if (open) {
      r += '<div class="ev-body" data-ks-area>' + (l.kind === 'checks' ? checksHTML(l, moves) : '') +
        (moves.length ? '<div class="ln-sub">תנועות</div>' + moves.map(function (m) {
          return '<div class="row" data-act="loan-move-edit" data-id="' + esc(m.client_id) + '">' +
            '<div class="main"><b>' + ils(m.amount) + pendTag(pendRowKey('g_loan_moves', m.client_id)) + '</b>' +
              '<small>' + esc([m.move_date ? dmyDate(m.move_date) : '', m.note].filter(Boolean).join(' · ') || '—') + '</small></div></div>';
        }).join('') : l.kind === 'checks' ? '' : emptyBox('loans', 'אין עדיין תנועות בהלוואה')) +
        '<div class="total-row"><span>נותר להחזיר</span><b>' + ils(bal) + '</b></div>' +
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
comboDef('loan-donor', { val: true, max: 30,
  items: function () {
    return gSortDonors(state.donors, 'abc').map(function (d) {
      return { value: d.client_id, label: d.name, sub: d.phone || '', find: [d.name, d.phone || ''].join('\n') };
    });
  },
  pick: function () {} });
function formLoan(l) {
  var ld = l && l.donor_client_id ? donorById(l.donor_client_id) : null;
  var kind = l ? l.kind || '' : '', uneq = !!(l && Array.isArray(l.check_amounts) && l.check_amounts.length);
  openModal(l ? TTL_LOAN_EDIT : TTL_LOAN_NEW,
    // המלווה — שדה אחד, כמו בתכנית: ההקלדה מחפשת בכרטיסים, ובחירה משייכת לכרטיס; ומי שאין לו כרטיס — מה שהוקלד נשמר כשם חופשי
    '<div class="f2">' +
      '<div class="fld"><span>מלווה *</span>' +
        comboHTML('loan-donor', { id: 'o-donor', label: 'מלווה — חיפוש כרטיס או שם חופשי', placeholder: 'חיפוש כרטיס או שם חופשי…',
                                 picked: l ? { value: ld ? ld.client_id : '', label: lenderOf(l) } : null }) + '</div>' +
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
        '<label class="fld"><span>מספר תשלומים *</span><input class="inp" id="o-ck-n" inputmode="numeric" data-inp="ck-sync" value="' + esc(l && l.check_count || '') + '"></label>' +
        '<label class="fld" id="o-ck-a-box"' + (uneq ? ' hidden' : '') + '><span>סכום לתשלום *</span><input class="inp" id="o-ck-a" inputmode="decimal" data-inp="ck-sync" value="' + esc(l && l.check_amount || '') + '"></label>' +
        '<label class="fld"><span>חודש התשלום הראשון *</span><input class="inp" type="month" id="o-ck-m" data-chg="ck-sync" value="' + esc(l && l.first_check_month || '') + '"></label>' +
      '</div>' +
      // היתר עסקה באחוזים — מהסכום ומהתשלום החודשי נגזרים מספר התשלומים והאחרון (היתרה)
      '<div class="ln-int"><div class="ln-int-h">היתר עסקה</div>' +
      '<p class="ln-int-lead">ממלאים אחוז, וממנו — לפי סכום ההלוואה והסכום לתשלום — נקבעים מספר התשלומים והאחרון שבהם. בלי היתר עסקה — משאירים ריק.</p>' +
      '<div class="ln-int-row"><label class="fld"><span>אחוז</span><input class="inp" id="o-ck-int" inputmode="decimal" data-inp="ck-int" placeholder="למשל 5" value="' + esc(ckIntOf(l)) + '"></label></div></div>' +
      '<label class="fld chk"><input type="checkbox" id="o-ck-uneq" data-chg="ck-uneq"' + (uneq ? ' checked' : '') + '><span>התשלומים אינם שווים</span></label>' +
      '<div class="ln-ck-list" id="o-ck-list">' + (uneq ? ckListHTML(l.check_count, l.first_check_month, l.check_amounts) : '') + '</div>' +
      '<div class="ln-ck-sum" id="o-ck-sum"></div>' +
    '</div>' +
    '<div class="ln-box" id="o-lg"' + (kind === 'long' ? '' : ' hidden') + '>' + whenFieldsHTML('o-check', 'מועד ההחזר', l, 'last_check') +
      // היתר עסקה — אחוז או סכום להחזר: ממלאים אחד, והשני מתמלא לבד; ריק — בלי היתר עסקה
      '<div class="ln-int"><div class="ln-int-h">היתר עסקה</div>' +
      '<p class="ln-int-lead">ממלאים <b>אחד</b> מהשניים — אחוז או סכום, והשני מתמלא לבד. בלי היתר עסקה — משאירים ריק.</p>' +
      '<div class="ln-int-row"><label class="fld"><span>אחוז</span><input class="inp" id="o-int-p" inputmode="decimal" data-inp="int-p" placeholder="למשל 5" value="' +
        esc(l && +l.repay_total > +l.amount ? Math.round((l.repay_total / l.amount - 1) * 10000) / 100 : '') + '"></label>' +
      '<span class="ln-int-or">או</span>' +
      '<label class="fld"><span>סכום להחזר, כולל היתר העסקה</span><input class="inp" id="o-total" inputmode="decimal" data-inp="int-t" value="' +
        esc(l && +l.repay_total > +l.amount ? l.repay_total : '') + '"></label></div>' +
      '<div class="ln-int-sum" id="o-int-sum"></div></div></div>' +
    whenFieldsHTML('o-taken', 'תאריך לקיחה', l, 'taken') +
    '<label class="fld"><span>תנאי החזר</span><input class="inp" id="o-terms" value="' + esc(l ? l.repay_terms || '' : '') + '"></label>' +
    '<label class="fld"><span>סטטוס</span><select class="inp" id="o-status"><option value="">— ללא —</option>' + LOAN_STATUSES.map(function (s) {
      return '<option' + (l && l.status === s ? ' selected' : '') + '>' + esc(s) + '</option>';
    }).join('') + '</select></label>' +
    '<label class="fld"><span>הערה</span><input class="inp" id="o-note" value="' + esc(l ? l.note || '' : '') + '"></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (l ? '<button class="btn danger" data-act="loan-del" data-id="' + esc(l.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="loan-save" data-id="' + esc(l ? l.client_id : '') + '" data-ksave>' + icon('save') + 'שמירה</button>');
  ckSync(); intSum();
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
// האחוז שבהלוואה קיימת — סך התשלומים מול הסכום
function ckIntOf(l) {
  if (!l || l.kind !== 'checks' || !(+l.amount > 0)) return '';
  var tot = l.check_amounts && l.check_amounts.length ? l.check_amounts.reduce(function (a, v) { return a + (+v || 0); }, 0) : (+l.check_count || 0) * (+l.check_amount || 0);
  return tot > +l.amount ? Math.round((tot / l.amount - 1) * 10000) / 100 : '';
}
// אחוז ⟵ סך להחזר = סכום × (1 + אחוז); מספר התשלומים = עיגול למעלה של הסך בתשלום, והאחרון — מה שנשאר
function ckInt() {
  var p = readNum($('#o-ck-int'), 0), amt = readNum($('#o-amount'), 0), uneq = $('#o-ck-uneq');
  var per = uneq && uneq.checked ? (ckReadList()[0] || 0) : readNum($('#o-ck-a'), 0);
  if (!(p > 0) || !(amt > 0) || !(per > 0)) { ckSync(); return; }
  var tot = Math.round(amt * (1 + p / 100) * 100) / 100, n = Math.ceil(tot / per - 1e-9), last = Math.round((tot - per * (n - 1)) * 100) / 100;
  if (n > 60) { ckSync(); return; }
  $('#o-ck-n').value = n; $('#o-ck-a').value = per;
  var list = $('#o-ck-list');
  if (last === per) { uneq.checked = false; list.innerHTML = ''; }
  else {
    uneq.checked = true;
    var vals = []; for (var i = 0; i < n; i++) vals.push(i < n - 1 ? per : last);
    list.innerHTML = ckListHTML(n, val('o-ck-m'), vals); list.dataset.first = val('o-ck-m');
  }
  ckSync();
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
  // מעבר לסכום ההלוואה — היתר עסקה; פחות ממנו — אזהרה
  out.textContent = n ? 'סה״כ התשלומים ' + ils(tot) + (amt && tot > amt ? ' — מתוכם היתר עסקה ' + ils(tot - amt) + ' (' + (Math.round((tot / amt - 1) * 10000) / 100) + '%)' : amt && tot < amt ? ' — פחות מסכום ההלוואה ' + ils(amt) : '') : '';
  out.classList.toggle('warn', !!(n && amt && tot < amt));
}

// היתר עסקה — אחוז ⟵ סכום להחזר, וסכום להחזר ⟵ אחוז, מול סכום ההלוואה.
function intSync(from) {
  var amt = readNum($('#o-amount'), 0), p = $('#o-int-p'), t = $('#o-total');
  if (!p || !t || !(amt > 0)) return;
  if (from === 'p') { var pv = readNum(p, 0); t.value = pv > 0 ? Math.round(amt * (1 + pv / 100) * 100) / 100 : ''; }
  else if (from === 't') { var tv = readNum(t, 0); p.value = tv > amt ? Math.round((tv / amt - 1) * 10000) / 100 : ''; }
  intSum();
}
// מתחת לשדות — במילים: הקרן, היתר העסקה וכמה מחזירים
function intSum() {
  var out = $('#o-int-sum'), amt = readNum($('#o-amount'), 0), tt = readNum($('#o-total'), 0);
  if (!out) return;
  out.textContent = amt > 0 && tt > amt ? 'קרן ' + ils(amt) + ' + היתר עסקה ' + ils(tt - amt) + ' = מחזירים ' + ils(tt) : '';
}
function saveLoan(id) {
  var donorId = nullable(comboValue('o-donor')), dn = donorId ? donorById(donorId) : null, q = $('#o-donor [data-combo-q]');
  var lender = dn ? dn.name : (q ? q.value.trim() : ''), amount = readNum($('#o-amount'), 0), kind = val('o-kind') || null;
  if (!lender) { toast(MSG_NEED_NAME, null, 'warn'); return; }
  if (!(amount > 0)) { toast(MSG_AMOUNT_POSITIVE, null, 'warn'); return; }
  // בלי סוג ההחזר אין דרך לדעת מתי ההלוואה יורדת מהחוב
  if (!kind) { toast(MSG_LOAN_KIND, null, 'warn'); return; }
  var td = nullable(val('o-taken'));
  var row = { lender: lender, donor_client_id: dn ? donorId : null, amount: amount, kind: kind,
              taken_date: td, taken_month: td ? null : nullable(val('o-taken-m')),
              repay_terms: nullable(val('o-terms')), status: nullable(val('o-status')), note: nullable(val('o-note')) };
  if (kind === 'checks') {
    var n = readNum($('#o-ck-n'), 0), uneq = $('#o-ck-uneq').checked;
    if (!(n > 0) || n !== Math.round(n)) { toast(MSG_CK_COUNT, null, 'warn'); return; }
    var per = uneq ? ckReadList() : null, a = uneq ? null : readNum($('#o-ck-a'), 0);
    if (uneq ? per.some(function (v) { return !(v > 0); }) : !(a > 0)) { toast(MSG_CK_AMT, null, 'warn'); return; }
    // בלי חודש התשלום הראשון אין לוח תשלומים — וההחזר אינו נכנס לחוב ולמדד
    if (!val('o-ck-m')) { toast(MSG_CK_FIRST, null, 'warn'); return; }
    var tot = uneq ? sum(per, function (v) { return v; }) : n * a;
    row.check_count = n; row.check_amount = a; row.check_amounts = per; row.first_check_month = nullable(val('o-ck-m'));
    if (tot < amount) toast(MSG_CK_SUM_PRE + ils(tot) + ' / ' + ils(amount), null, 'warn');
  } else {
    row.check_count = null; row.check_amount = null; row.check_amounts = null; row.first_check_month = null;
  }
  if (kind === 'long') {
    var cd = nullable(val('o-check'));
    row.last_check_date = cd; row.last_check_month = cd ? null : nullable(val('o-check-m'));
    var tt = readNum($('#o-total'), 0);
    row.repay_total = tt > amount ? tt : null;
  } else row.repay_total = null;
  return id ? update('g_loans', id, row) : insert('g_loans', row);
}

export { addLoanMove, ckInt, ckSync, formLoan, intSync, formLoanMove, loanKindPick, saveLoanMove, loansBodyHTML, saveLoan, viewLoans };
