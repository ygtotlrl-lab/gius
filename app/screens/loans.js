// app/screens/loans.js — הלוואות
import { dayToday, readNum } from '../../core/util.js';
import { pendTag } from '../../core/sync.js';
import { amtSet, cardWinHTML, comboDef, comboHTML, comboValue, esc, openModal, receiptHTML, toast } from '../../core/ui.js';
import { APP_FIRST_MONTH, LOAN_KINDS, MONTH_SHORT, LOAN_STATUSES, MSG_AMOUNT_POSITIVE, MSG_CK_AMT, MSG_CK_COUNT, MSG_CK_FIRST, MSG_LOAN_KIND, MSG_CK_SUM_PRE, MSG_LOAN_STATUS, MSG_LOAN_TAKEN, MSG_NEED_MOVE_AMOUNT, MSG_NEED_NAME, MSG_SET_AMT,
         TTL_MOVE_EDIT } from '../constants.js';
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

// ── מצב ההלוואות — עיגולים, ומתחת לכל אחד הכותרת והשינוי; הסכומים בצבעם: אדום — חוב והלוואות,
// ירוק — החזרים, נטו של החזר וסגירת חוב, וזהב — עלויות המימון (היתר עסקה ודמי התפשרות); ההסבר — בכפתור המידע ──
function startMonth() { return shiftMonth(APP_FIRST_MONTH, -1); }
function debtChg(kind) { return loanDebt(curMonth(), kind) - loanDebt(startMonth(), kind); }
function chgTxt(c) { return c > 0 ? 'עלה ב־' + kShort(c) : c < 0 ? 'ירד ב־' + kShort(-c) : 'ללא שינוי'; }
function dot(o) {
  return '<div class="ln-dot ' + o.tone + '" title="' + esc(o.t + ' ' + ils(o.v)) + '"><span class="ln-dot-c"><b>' + esc(o.neg ? '−' + kShort(Math.abs(o.v)) : kShort(o.v)) + '</b></span>' +
    '<span class="ln-dot-t">' + esc(o.t) + '</span>' + (o.sub ? '<small class="' + (o.subTone || '') + '">' + esc(o.sub) + '</small>' : '') + '</div>';
}
function finSince() {
  var cur = curMonth(), m = APP_FIRST_MONTH, t = 0;
  while (m <= cur) { t += loanFlow(m).finance; m = shiftMonth(m, 1); }
  return t;
}
function loanDashHTML() {
  var cur = curMonth(), f = loanFlow(cur), dc = debtChg(null), lc = debtChg('long'), ic = debtChg('inst');
  var tone = function (c) { return c > 0 ? 'bad' : c < 0 ? 'ok' : ''; };
  return '<div class="ln-dots">' + [
    { t: 'החוב הכללי', v: loanDebt(cur), tone: 'bad', sub: chgTxt(dc) + ' מתחילת התקופה', subTone: tone(dc) },
    { t: 'לטווח ארוך', v: loanDebt(cur, 'long'), tone: 'bad', sub: chgTxt(lc), subTone: tone(lc) },
    { t: 'בתשלומים', v: loanDebt(cur, 'inst'), tone: 'bad', sub: chgTxt(ic), subTone: tone(ic) },
    { t: 'עלויות מימון', v: f.finance, tone: 'gold', sub: 'מתחילת התקופה ' + kShort(finSince()) },
    { t: 'החזרים החודש', v: f.repaid, tone: 'ok', sub: 'ארוך ' + kShort(f.repLong) + ' · תשלומים ' + kShort(f.repInst) },
    { t: 'הלוואות החודש', v: f.added, tone: 'bad', sub: 'ארוך ' + kShort(f.long) + ' · תשלומים ' + kShort(f.inst) },
    { t: 'נטו החודש', v: f.net, neg: f.net < 0, tone: f.net > 0 ? 'bad' : 'ok', sub: f.net > 0 ? 'החוב גדל' : f.net < 0 ? 'החוב קטן' : 'ללא שינוי' }
  ].map(dot).join('') + '</div>';
}
// ההסבר — חלון, ולא מלל על המסך
function loanInfo() {
  openModal('מצב ההלוואות', '<ul class="ln-info">' + [
    ['החוב הכללי', 'הקרן שעוד לא הוחזרה, בכל ההלוואות. מתחתיו — כמה עלה או ירד מתחילת התקופה.'],
    ['לטווח ארוך · בתשלומים', 'אותו חוב, לפי סוג ההחזר.'],
    ['עלויות מימון', 'מה שעלה המימון החודש: היתר עסקה (מה שמחזירים מעבר לקרן) ודמי התפשרות (סכום קבוע לכל חודש עד סגירת ההלוואה). הוצאה — אינה בחוב.'],
    ['החזרים החודש', 'חלק הקרן שהוחזר החודש — מקטין את החוב.'],
    ['הלוואות החודש', 'סכום ההלוואות שנלקחו החודש — מגדיל את החוב.'],
    ['נטו החודש', 'הלוואות פחות החזרים: אדום — החוב גדל, ירוק — החוב קטן.'],
    ['הצבעים', 'אדום — חוב והלוואות · ירוק — החזרים וחוב שקטן · זהב — עלויות המימון.']
  ].map(function (x) { return '<li><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ul>',
  '<button class="btn" data-act="modal-close">הבנתי</button>', icon('info'));
}

// ── הגרפים — חלון אחד: צפי ההחזרים לרבעון הקרוב, והחוב בסוף כל חודש; החודשים הבאים מקווקוים — מתוכננים ──
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
var FC_MONTHS = 3;
function track(list, fn, max) {
  return '<div class="fl-scroll" tabindex="0"><div class="fl-track">' + list.slice().reverse().map(function (x) { return fn(x, max * 1.35); }).join('') + '</div></div>';
}
function chartsBodyHTML() {
  var cur = curMonth(), fcMonths = [];
  for (var i = 0; i < FC_MONTHS; i++) fcMonths.push(shiftMonth(cur, i));
  var fcFlows = fcMonths.map(loanFlow), fcTot = sum(fcFlows, function (f) { return f.grossLong + f.grossInst; }), fmax = 1;
  fcFlows.forEach(function (f) { fmax = Math.max(fmax, f.grossLong + f.grossInst); });
  var s0 = startMonth(), debt = [{ m: s0, lab: startLab(), long: loanDebt(s0, 'long'), inst: loanDebt(s0, 'inst') }]
    .concat(loanMonths().map(function (m) { return { m: m, long: loanDebt(m, 'long'), inst: loanDebt(m, 'inst') }; })), dmax = 1;
  debt.forEach(function (o) { dmax = Math.max(dmax, o.long, o.inst); });
  return '<div class="ln-wsec"><h3>החוב בסוף כל חודש<span class="sp">היום ' + esc(ils(loanDebt(cur))) + '</span></h3>' +
      '<div class="fl-legend"><div class="fl-lg"><span><i class="ln-k dbar"></i>לטווח ארוך</span><span><i class="ln-k ibar"></i>בתשלומים</span>' +
      '<span><i class="ln-k plan"></i>מקווקו — מתוכנן לפי תאריכי הפירעון והתשלומים</span></div></div>' + track(debt, debtColHTML, dmax) + '</div>' +
    '<div class="ln-wsec"><h3>צפי ההחזרים לרבעון הקרוב<span class="sp">סה״כ ' + esc(ils(fcTot)) + '</span></h3>' +
      '<div class="fl-legend"><div class="fl-lg"><span><i class="ln-k fcall"></i>כל ההחזרים</span><span><i class="ln-k dbar"></i>מתוכם לטווח ארוך</span></div></div>' +
      '<div class="ln-fc-chart">' + track(fcFlows, fcColHTML, fmax) + '</div></div>';
}

// ── תאריכי פירעון — הלוואות לטווח ארוך שנקבע להן מועד: באיחור, ומה שמועדו בשנה הקרובה ──
function dueItems() {
  var cur = curMonth(), items = [];
  state.loans.forEach(function (l) {
    var bal = loanLeft(l, cur), d = loanDueMonth(l);
    if (loanIsChecks(l) || !(bal > 0) || !d) return;
    var sub = 'מועד ההחזר ' + loanWhen(l, 'last_check');
    if (d < cur) items.push({ m: '', late: true, l: l, a: bal, sub: sub });
    else if (d <= shiftMonth(cur, 12)) items.push({ m: d, l: l, a: bal, sub: sub });
  });
  return items.sort(function (x, y) { return x.late !== y.late ? (x.late ? -1 : 1) : x.m < y.m ? -1 : x.m > y.m ? 1 : y.a - x.a; });
}
function dueBodyHTML() {
  var items = dueItems(), total = sum(items, function (it) { return it.a; });
  var h = '<div class="ln-wsec"><h3>בשנה הקרובה<span class="cnt">' + items.length + '</span><span class="sp">' + esc(ils(total)) + '</span></h3>' +
    '<p class="ln-lead">הלוואות לטווח ארוך שנקבע להן מועד החזר. הלוואה בלי מועד אינה ברשימה — כדאי לקבוע לה מועד.</p>';
  if (!items.length) return h + emptyBox('loans', 'אין תאריכי פירעון בשנה הקרובה') + '</div>';
  return h + '<div class="rc-list">' + receiptHTML(items.map(function (it) {
    return { day: it.late ? 'באיחור — עבר המועד ולא נרשם החזר' : monthLabel(it.m), amt: esc(ils(it.a)), method: 'פירעון', ico: icon('calendar'),
             dashed: it.late, cls: it.late ? 'ln-late' : '',
             who: '<b>' + esc(lenderOf(it.l)) + '</b><small>' + esc(it.sub) + '</small>', act: 'loan-open', id: it.l.client_id };
  })) + '</div></div>';
}

// המלווה — הכרטיס שההלוואה משויכת אליו (`donor_client_id`), ובלעדיו — השם שהוקלד (`lender`)
function lenderOf(l) { var d = l.donor_client_id ? donorById(l.donor_client_id) : null; return d ? d.name : l.lender || ''; }
function loanMatches() {
  var q = String(state.loansQ || '').trim().toLowerCase();
  var st = state.loansStatus;
  var list = state.loans.filter(function (l) {
    if (st && l.status !== st) return false;
    return !q || lenderOf(l).toLowerCase().indexOf(q) >= 0;
  });
  return state.loansSort ? loanSort(list, state.loansSort) : gSortLoans(list, 'name');
}
// המיון — תאריך לקיחה (החדש ראשון) · תאריך סיום (הקרוב ראשון; בתשלומים — התשלום האחרון) · סטטוס; בלי ערך — בסוף
var LOAN_SORTS = [['taken', 'תאריך לקיחה'], ['end', 'תאריך סיום'], ['status', 'סטטוס']];
function endKey(l) {
  if (loanIsChecks(l)) { var m = lastCheckMonth(l); return m ? m + '-01' : ''; }
  return l.last_check_date || (l.last_check_month ? l.last_check_month + '-01' : '');
}
function loanSort(list, mode) {
  var key = mode === 'taken' ? function (l) { return l.taken_date || (l.taken_month ? l.taken_month + '-01' : ''); } : mode === 'end' ? endKey : null;
  var st = function (l) { var i = LOAN_STATUSES.indexOf(l.status); return i < 0 ? LOAN_STATUSES.length : i; };
  // בלי ערך — בסוף, לפי א״ב
  return list.slice().sort(function (a, b) {
    var r = 0;
    if (key) { var x = key(a), y = key(b); r = !x || !y ? (x ? 0 : 1) - (y ? 0 : 1) : (mode === 'taken' ? (y < x ? -1 : y > x ? 1 : 0) : (x < y ? -1 : x > y ? 1 : 0)); }
    else r = st(a) - st(b);
    return r || lenderOf(a).localeCompare(lenderOf(b), 'he');
  });
}

// המסך: בראש — רכיב אחד: חיפוש וסינון, ומתחתם העיגולים ושני כפתורים (הגרפים · תאריכי פירעון) שפותחים חלון;
// ואחריו ההלוואות — לפי אנשים, קבוע.
function viewLoans() {
  var dues = dueItems().length;
  var h = '<section class="card ln-top">' +
      '<div class="ln-tools"><label class="search-box"><input aria-label="חיפוש לפי מלווה" class="inp search" id="loans-q" data-inp="loans-q" placeholder="חיפוש לפי מלווה" value="' + esc(state.loansQ) + '">' +
        '<span class="search-ic">' + icon('search') + '</span></label>' +
        selectHTML('loans-status', LOAN_STATUSES, state.loansStatus, 'סינון', 'loans-status') +
        '<select class="inp" id="loans-sort" data-chg="loans-sort" aria-label="מיון"><option value="">מיון</option>' + LOAN_SORTS.map(function (o) {
          return '<option value="' + o[0] + '"' + (state.loansSort === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
        }).join('') + '</select></div>' +
      '<div class="ln-top-h"><h2>מצב ההלוואות<span class="sp ln-dash-m">' + esc(monthLabel(curMonth())) + '</span></h2>' +
        '<button class="ln-info-btn" data-act="ln-info" aria-label="הסבר על העיגולים" title="הסבר על העיגולים">' + icon('info') + '</button></div>' +
      loanDashHTML() +
      '<div class="ln-wbtns">' +
        '<button class="btn soft" data-act="ln-win" data-k="chart">' + icon('chart') + 'גרף הלוואות</button>' +
        '<button class="btn soft" data-act="ln-win" data-k="due">' + icon('calendar') + 'תאריכי פירעון' + (dues ? '<span class="cnt">' + dues + '</span>' : '') + '</button>' +
      '</div></section>' +
    '<section class="ln-list" id="loans-list">' + loansBodyHTML() + '</section>';
  if (state.lnWin) h += auxWinHTML();
  if (state.loansOpen) h += loanWinHTML(state.loansOpen === 'new' ? null : state.loans.find(function (l) { return l.client_id === state.loansOpen; }) || null);
  return h;
}

// פרטי ההלוואה, שורה אחרי שורה — לפי מה שמולא בה
function loanLines(l) {
  var cur = curMonth(), out = [], when = loanWhen(l, 'taken');
  if (when) out.push('תאריך לקיחה: ' + when);
  if (l.kind === 'checks' && +l.check_count) {
    var c = checkList(l), uneq = Array.isArray(l.check_amounts) && l.check_amounts.length;
    out.push(uneq ? 'תשלומים לא שווים: ' + c.length + ', סה״כ ' + ils(loanTotal(l)) : 'תשלומים שווים: ' + c.length + ', כל אחד ע״ס ' + ils(l.check_amount));
    var done = c.filter(function (x) { return x.m && x.m <= cur; }).length;
    if (l.first_check_month) out.push('בוצעו: ' + done + ' תשלומים · מ־' + mmYYYY(l.first_check_month) + ' עד ' + mmYYYY(lastCheckMonth(l)));
  }
  if (l.kind === 'long' && loanWhen(l, 'last_check')) out.push('מועד ההחזר: ' + loanWhen(l, 'last_check'));
  var i = loanInterest(l);
  if (i > 0) out.push('היתר עסקה: ' + ils(i));
  if (+l.settle_amount > 0 && l.kind === 'long') out.push('דמי התפשרות: ' + ils(l.settle_amount) + ' לחודש' + (+l.settle_count ? ', ' + l.settle_count + ' תשלומים' : ' — עד סגירת ההלוואה'));
  if (l.kind === 'long') { var mv = sum(movesOf(l.client_id), function (m) { return m.amount; }); if (mv) out.push('הוחזר: ' + ils(mv)); }
  var note = [l.repay_terms, l.note].filter(Boolean).join(' · ');
  if (note) out.push('הערה: ' + note);
  return out;
}
// השורה — מלווה (גדול) · הסכום · אייקון סוג ההחזר, ובצד השני הנותר להחזיר (בולט) והסטטוס; ומתחת — הפירוט. פס צבע בקצה לפי הסוג.
// שורת פירוט — שם השדה מודגש, והערך אחריו רגיל
function lineHTML(x) {
  var i = x.indexOf(': ');
  return '<span>' + (i > 0 ? '<b>' + esc(x.slice(0, i + 1)) + '</b> ' + esc(x.slice(i + 2)) : esc(x)) + '</span>';
}
// השורה — הסכום ואייקון סוג ההחזר בימין, ובצד השני הנותר להחזיר (בולט) והסטטוס; ומתחת — הפירוט. שם המלווה — מעל הרכיב, לא בשורה.
function loanRowHTML(l, cur, withName) {
  var lines = loanLines(l);
  return '<button class="ln-row' + (l.kind ? ' k-' + l.kind : '') + '" data-act="loan-open" data-id="' + esc(l.client_id) + '" aria-label="' + esc(lenderOf(l) + ' — ' + ils(l.amount)) + '">' +
    '<span class="ln-r-main">' + (withName ? '<b class="ln-r-name">' + esc(lenderOf(l)) + '</b>' : '') + '<span class="ln-r-top"><b class="ln-r-amt">' + esc(ils(l.amount)) + '</b>' + pendTag(pendRowKey('g_loans', l.client_id)) +
      (l.kind ? '<span class="ln-kic" title="' + esc(LOAN_KINDS[l.kind]) + '" aria-label="' + esc(LOAN_KINDS[l.kind]) + '">' + icon(l.kind === 'checks' ? 'cheque' : 'calendar') + '</span>' : '') + '</span>' +
      (lines.length ? '<span class="ln-r-det">' + lines.map(lineHTML).join('') + '</span>' : '') + '</span>' +
    '<span class="ln-r-end"><small>נותר להחזיר</small><b>' + esc(ils(loanLeft(l, cur))) + '</b>' + (l.status ? '<span class="badge brand">' + esc(l.status) + '</span>' : '') + '</span>' +
  '</button>';
}
// לפי אנשים, קבוע: אות גדולה לפני כל קבוצת אנשים שמתחילים בה, ולכל מלווה — רכיב לבן ובו ההלוואות שלו.
// קבוצה לכל כרטיס, ולכל שם חופשי כפי שהוקלד — שם חופשי אינו משויך לכרטיס מעצמו: אי אפשר לדעת שזה אותו אדם
function loansBodyHTML() {
  var list = loanMatches(), cur = curMonth();
  var h = '<div class="ln-list-h"><h2>הלוואות<span class="cnt">' + list.length + '</span></h2></div>';
  if (!list.length) return h + '<div class="card">' + emptyBox('loans', state.loans.length ? 'אין הלוואה התואמת את החיפוש או הסינון' : 'אין הלוואות רשומות') + '</div>';
  // במיון — לא לפי אנשים: תאריך לקיחה או סיום — רשימה אחת, ושם המלווה בשורה; סטטוס — כותרת לכל סטטוס (במקום האות),
  // ובלי סטטוס — בסוף (זמני: מהיום הסטטוס חובה)
  if (state.loansSort === 'status') {
    var cur0 = '\u0000';
    list.forEach(function (l) {
      var k = LOAN_STATUSES.indexOf(l.status) >= 0 ? l.status : '';
      if (k !== cur0) { if (cur0 !== '\u0000') h += '</div>'; cur0 = k; h += '<div class="ln-letter ln-stat-h" aria-hidden="true"><span>' + esc(k || 'ללא סטטוס') + '</span></div><div class="ln-pblock">'; }
      h += loanRowHTML(l, cur, true);
    });
    h += '</div>';
  } else if (state.loansSort) {
    h += '<div class="ln-pblock">' + list.map(function (l) { return loanRowHTML(l, cur, true); }).join('') + '</div>';
  } else {
    var groups = {}, order = [];
    list.forEach(function (l) {
      var did = l.donor_client_id || '';
      var k = did ? 'd:' + did : 'n:' + String(l.lender || '').trim();
      if (!groups[k]) { groups[k] = { name: lenderOf(l), list: [] }; order.push(k); }
      groups[k].list.push(l);
    });
    order.sort(function (a, b) { return groups[a].name.localeCompare(groups[b].name, 'he'); });
    var letter = '';
    order.forEach(function (k) {
      var g = groups[k], L = (g.name.trim().charAt(0) || '#');
      if (L !== letter) { letter = L; h += '<div class="ln-letter" aria-hidden="true"><span>' + esc(L) + '</span></div>'; }
      h += '<div class="ln-person">' + esc(g.name) + (g.list.length > 1 ? '<span class="cnt">' + g.list.length + '</span>' : '') + '</div>' +
        '<div class="ln-pblock">' + g.list.map(function (l) { return loanRowHTML(l, cur); }).join('') + '</div>';
    });
  }
  return h + '<div class="total-row ln-total"><span>סה״כ נותר להחזיר</span><b>' + ils(sum(list, function (l) { return loanLeft(l, cur); })) + '</b></div>';
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
      '<label class="fld"><span>סכום *</span><input class="inp" data-amt id="lm-e-amt" inputmode="decimal" value="' + esc(m.amount) + '"></label>' +
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
// ── כרטיס ההלוואה — חלון כמו הכרטיסים (cardWinHTML), בשני חלקים: פרטי ההלוואה (בגוון האפליקציה) · פרטי ההחזר (לבן);
// במחשב — שליש ושני שלישים, ובטלפון — זה מעל זה. השדות של שני החלקים — טופס אחד, שנשמר בכפתור (data-ks);
// והתנועות — מחוץ לטופס, ונשמרות כל אחת מיד. הלוואה חדשה — אותו חלון ריק, והתנועות — אחרי השמירה.
function seg(act, cur, opts, label, cls) {
  return '<div class="' + (cls || 'seg seg-wide') + ' ln-seg" role="radiogroup" aria-label="' + esc(label) + '">' + opts.map(function (o) {
    return '<button type="button" role="radio" aria-checked="' + (cur === o[0]) + '" class="' + (cur === o[0] ? 'on' : '') + '" data-act="' + act + '" data-v="' + o[0] + '">' +
      (cls ? '<i class="ln-radio" aria-hidden="true"></i>' : '') + (o[2] ? icon(o[2]) : '') + '<span>' + esc(o[1]) + '</span>' + (o[3] ? '<small>' + esc(o[3]) + '</small>' : '') + '</button>';
  }).join('') + '</div>';
}
function loanWinHTML(l) {
  var id = l ? esc(l.client_id) : '', ld = l && l.donor_client_id ? donorById(l.donor_client_id) : null, cur = curMonth();
  var kind = l ? l.kind || '' : '', uneq = !!(l && Array.isArray(l.check_amounts) && l.check_amounts.length);
  var fin = l && +l.settle_amount > 0 ? 'set' : (l && +l.repay_total > +l.amount ? 'int' : '');
  var note = l ? [l.repay_terms, l.note].filter(Boolean).join('\n') : '';
  var band = '<div class="cp-band cw-band ln-band" id="ln-band">' + loanBandHTML(l) +
    '<div class="cp-acts"><button class="cp-btn" data-act="loan-close" data-ks-leave aria-label="סגירה">' + icon('close') + '</button></div></div>';
  // חלק א — פרטי ההלוואה
  var p1 = '<section class="ln-p1"><h3>פרטי ההלוואה</h3>' +
    '<div class="ln-p1-row">' +
      '<div class="fld ln-f-lender"><span>מלווה *</span>' +
        comboHTML('loan-donor', { id: 'o-donor', label: 'מלווה — חיפוש כרטיס או שם חופשי', placeholder: 'חיפוש כרטיס או שם חופשי…',
                                 picked: l ? { value: ld ? ld.client_id : '', label: lenderOf(l) } : null }) + '</div>' +
      '<label class="fld ln-f-amt"><span>סכום *</span><input class="inp" data-amt id="o-amount" inputmode="decimal" data-inp="ck-sync" value="' + esc(l && l.amount != null ? l.amount : '') + '"></label>' +
      '<div class="fld ln-f-kind"><span>סוג ההחזר *</span><input type="hidden" id="o-kind" value="' + esc(kind) + '">' +
        seg('loan-kind', kind, [['checks', 'תשלומים', 'cheque'], ['long', 'טווח ארוך', 'calendar']], 'סוג ההחזר') + '</div>' +
    '</div>' +
    '<div class="f2">' +
      '<label class="fld"><span>תאריך לקיחה *</span><input class="inp" type="date" id="o-taken" value="' + esc(l && l.taken_date ? l.taken_date : '') + '"></label>' +
      '<label class="fld"><span>או חודש בלבד</span><input class="inp" type="month" id="o-taken-m" value="' + esc(l && l.taken_month ? l.taken_month : '') + '"></label>' +
    '</div>' +
    '<label class="fld"><span>תנאי החזר / הערה</span><textarea class="inp" id="o-note" rows="2">' + esc(note) + '</textarea></label>' +
    '<label class="fld"><span>סטטוס *</span><select class="inp" id="o-status"><option value="">— בחירה —</option>' + LOAN_STATUSES.map(function (s) {
      return '<option' + (l && l.status === s ? ' selected' : '') + '>' + esc(s) + '</option>';
    }).join('') + '</select></label>' +
  '</section>';
  var foot = '<div class="ln-foot">' + (l ? '<button class="btn danger" data-act="loan-del" data-id="' + id + '">מחיקה</button>' : '') +
      '<button class="btn" data-act="loan-save" data-id="' + id + '" data-ksave>' + icon('save') + 'שמירה</button></div>';
  // חלק ב — פרטי ההחזר, לפי הסוג
  var ck = '<div class="ln-box" id="o-ck"' + (kind === 'checks' ? '' : ' hidden') + '>' +
      '<input type="checkbox" id="o-ck-uneq" hidden' + (uneq ? ' checked' : '') + '>' +
      seg('ck-mode', uneq ? 'uneq' : 'eq', [['eq', 'תשלומים שווים', '', 'סכום אחד לכל תשלום'], ['uneq', 'תשלומים לא שווים', '', 'סכום לכל תשלום']], 'סוג התשלומים', 'ln-choice') +
      '<div class="f3">' +
        '<label class="fld"><span>מספר תשלומים *</span><input class="inp" id="o-ck-n" inputmode="numeric" data-inp="ck-sync" value="' + esc(l && l.check_count || '') + '"></label>' +
        '<label class="fld" id="o-ck-a-box"' + (uneq ? ' hidden' : '') + '><span>סכום תשלום *</span><input class="inp" data-amt id="o-ck-a" inputmode="decimal" data-inp="ck-sync" value="' + esc(l && l.check_amount || '') + '"></label>' +
        '<label class="fld"><span>החודש הראשון *</span><input class="inp" type="month" id="o-ck-m" data-chg="ck-sync" value="' + esc(l && l.first_check_month || '') + '"></label>' +
      '</div>' +
      '<div class="ln-ck-list" id="o-ck-list">' + (uneq ? ckListHTML(l.check_count, l.first_check_month, l.check_amounts) : '') + '</div>' +
      '<div class="ln-ck-sum" id="o-ck-sum"></div>' +
      '<div class="ln-fin-note" id="o-ck-note" hidden><b>היתר עסקה</b><span id="o-ck-note-t"></span></div>' +
    '</div>';
  var lg = '<div class="ln-box" id="o-lg"' + (kind === 'long' ? '' : ' hidden') + '>' +
      whenFieldsHTML('o-check', 'מועד ההחזר (רשות)', l, 'last_check') +
      '<label class="chk ln-fin-chk"><input type="checkbox" id="o-fin-on" data-chg="fin-on"' + (fin ? ' checked' : '') + '><span>עלויות מימון</span></label>' +
      '<input type="hidden" id="o-fin" value="' + fin + '">' +
      '<div id="o-fin-pick"' + (fin ? '' : ' hidden') + '>' +
      seg('fin-mode', fin, [['int', 'היתר עסקה', '', 'מחזירים יותר מהקרן'], ['set', 'דמי התפשרות', '', 'סכום קבוע לכל חודש']], 'עלויות מימון', 'ln-choice') + '</div>' +
      '<div class="ln-fin" id="o-fin-int"' + (fin === 'int' ? '' : ' hidden') + '>' +
        '<div class="ln-int-row"><label class="fld"><span>אחוז</span><input class="inp" id="o-int-p" inputmode="decimal" data-inp="int-p" value="' +
          esc(l && +l.repay_total > +l.amount ? Math.round((l.repay_total / l.amount - 1) * 10000) / 100 : '') + '"></label>' +
        '<span class="ln-int-or">או</span>' +
        '<label class="fld"><span>סכום להחזר, כולל היתר העסקה</span><input class="inp" data-amt id="o-total" inputmode="decimal" data-inp="int-t" value="' +
          esc(l && +l.repay_total > +l.amount ? l.repay_total : '') + '"></label></div>' +
        '<div class="ln-fin-note" id="o-int-note"><b>היתר עסקה</b><span id="o-int-sum">ממלאים אחד מהשניים — האחוז או הסכום להחזר. ההפרש מעל הקרן הוא עלות המימון, ואינו חוב.</span></div></div>' +
      '<div class="ln-fin" id="o-fin-set"' + (fin === 'set' ? '' : ' hidden') + '>' +
        '<div class="f2"><label class="fld"><span>סכום לחודש *</span><input class="inp" data-amt id="o-set-a" inputmode="decimal" value="' + esc(l && l.settle_amount || '') + '"></label>' +
        '<div class="fld"><span>מספר תשלומים</span><div class="ln-set-n">' +
          '<input class="inp" id="o-set-n" inputmode="numeric" placeholder="ללא הגבלה" value="' + esc(l && l.settle_count || '') + '"' + (l && +l.settle_count ? '' : ' readonly') + '>' +
          '<button type="button" class="ln-set-edit" data-act="set-count" aria-label="קביעת מספר תשלומים" title="קביעת מספר תשלומים">' + icon('edit') + '</button></div></div></div>' +
        '<div class="ln-fin-note"><b>דמי התפשרות</b><span>ממלאים את הסכום לחודש, ומספר תשלומים — אם יש. משולם מהחודש הראשון של ההלוואה עד שהקרן מוחזרת, או עד מספר התשלומים. הסכום הוא עלות המימון, ואינו חוב.</span></div></div>' +
    '</div>';
  var p2 = '<section class="ln-p2a"><h3>פרטי ההחזר</h3>' +
    '<p class="ln-lead" id="o-kind-hint"' + (kind ? ' hidden' : '') + '>בוחרים את סוג ההחזר בפרטי ההלוואה.</p>' + ck + lg + '</section>';
  var moves = '<section class="ln-p2b" id="ln-moves"' + (l ? ' data-ks' : '') + '>' + loanMovesHTML(l) + '</section>';
  return cardWinHTML({ id: 'ln-w-loan', label: l ? lenderOf(l) : 'הלוואה חדשה', close: 'loan-close',
    body: '<div class="copen cw-card ln-win" data-ks-area data-key="' + (l ? id : 'new') + '">' + band +
      '<div class="ln-split"><div class="ln-form" data-ks>' + p1 + p2 + '</div>' + moves + '</div>' + foot + '</div>' });
}
// הפס — המלווה, הסוג והסטטוס, והנותר להחזיר מתוך הסכום להחזר
function loanBandHTML(l) {
  if (!l) return '<div class="cp-who"><h3>הלוואה חדשה</h3></div>';
  var cur = curMonth();
  return '<div class="cp-who"><h3>' + esc(lenderOf(l)) + '</h3></div>' +
    '<div class="cp-sum"><span><small>קרן</small><b>' + ils(l.amount) + '</b></span>' +
      (loanInterest(l) > 0 ? '<span><small>היתר עסקה</small><b>' + ils(loanInterest(l)) + '</b></span>' : '') +
      '<span class="left"><small>נותר להחזיר</small><b>' + ils(loanLeft(l, cur)) + '</b></span></div>';
}
// התנועות — מעליהן הוספה (סכום · תאריך · הערה), ובתשלומים — גם לוח התשלומים
function loanMovesHTML(l) {
  if (!l) return '<h3>תנועות תשלומים</h3><p class="ln-lead">אחרי השמירה אפשר להוסיף תנועות.</p>';
  var id = esc(l.client_id), moves = movesOf(l.client_id);
  // בתשלומים — לוח התשלומים בלבד: אין תנועות שאינן צפויות. תנועות ישנות, אם נרשמו — לקריאה ולעריכה
  if (l.kind === 'checks') return checksHTML(l, moves) + (moves.length ? '<h3>תנועות שנרשמו<span class="cnt">' + moves.length + '</span></h3>' + movesRowsHTML(moves) : '');
  return '<h3>תנועות תשלומים<span class="cnt">' + moves.length + '</span></h3>' +
    '<div class="lm-add">' +
      '<input class="inp lm-amt" data-amt id="lm-amt" inputmode="decimal" placeholder="סכום *" aria-label="סכום התנועה">' +
      '<input class="inp lm-date" id="lm-date" type="date" value="' + esc(dayToday()) + '" aria-label="תאריך התנועה">' +
      '<input class="inp lm-note" id="lm-note" placeholder="הערה" aria-label="הערה לתנועה">' +
      '<button class="btn sm" data-act="loan-move-add" data-id="' + id + '" data-ksave>' + icon('plus') + 'הוספה</button>' +
    '</div>' +
    (moves.length ? movesRowsHTML(moves) : emptyBox('loans', 'אין עדיין תנועות בהלוואה'));
}
function movesRowsHTML(moves) {
  return moves.map(function (m) {
    return '<div class="row" data-act="loan-move-edit" data-id="' + esc(m.client_id) + '">' +
      '<div class="main"><b>' + ils(m.amount) + pendTag(pendRowKey('g_loan_moves', m.client_id)) + '</b>' +
        '<small>' + esc([m.move_date ? dmyDate(m.move_date) : '', m.note].filter(Boolean).join(' · ') || '—') + '</small></div></div>';
  }).join('');
}
// ציור חלקי — בכל ציור של המסך (גם מהבדיקה המחזורית): העיגולים, הרשימה, והחלונות — בלי לגעת בטופס שפתוח בחלון
function loansPartial() {
  var view = $('#view'), top = $('.ln-dots'), list = $('#loans-list');
  if (!view || !top || !list) return false;
  top.outerHTML = loanDashHTML();
  list.innerHTML = loansBodyHTML();
  var aux = $('#ln-w-aux'), want = state.lnWin || '';
  if (aux && aux.dataset.key !== want) { aux.remove(); aux = null; }
  if (want && !aux) view.insertAdjacentHTML('beforeend', auxWinHTML());
  else if (aux) { var b = $('.ln-wbody', aux); if (b) b.innerHTML = want === 'chart' ? chartsBodyHTML() : dueBodyHTML(); }
  var lw = $('#ln-w-loan'), key = state.loansOpen || '', has = lw && $('.ln-win', lw);
  var l = key && key !== 'new' ? state.loans.find(function (x) { return x.client_id === key; }) : null;
  if (key && key !== 'new' && !l) key = state.loansOpen = '';
  if (lw && (!key || has.dataset.key !== key)) { lw.remove(); lw = null; }
  if (key && !lw) { view.insertAdjacentHTML('beforeend', loanWinHTML(l)); loansAfter(); }
  else if (lw && l) {
    $('#ln-band').innerHTML = loanBandHTML(l) + '<div class="cp-acts"><button class="cp-btn" data-act="loan-close" data-ks-leave aria-label="סגירה">' + icon('close') + '</button></div>';
    // התנועות — רק כשלא מקלידים בהן
    var mv = $('#ln-moves');
    if (mv && !mv.contains(document.activeElement)) mv.innerHTML = loanMovesHTML(l);
  }
  return true;
}
function auxWinHTML() {
  var k = state.lnWin, t = k === 'chart' ? 'גרף הלוואות' : 'תאריכי פירעון';
  return cardWinHTML({ id: 'ln-w-aux', label: t, close: 'ln-win-close',
    body: '<div class="copen cw-card ln-wwin"><div class="cp-band cw-band"><div class="cp-who"><h3>' + esc(t) + '</h3></div>' +
      '<div class="cp-acts"><button class="cp-btn" data-act="ln-win-close" aria-label="סגירה">' + icon('close') + '</button></div></div>' +
      '<div class="ln-wbody">' + (k === 'chart' ? chartsBodyHTML() : dueBodyHTML()) + '</div></div>' }).replace('<div class="card-win"', '<div class="card-win" data-key="' + esc(k) + '"');
}
// אחרי שחלון ההלוואה נפתח — הסיכומים שמתחת לשדות
function loansAfter() { if ($('#ln-w-loan')) { ckSync(); intSum(); } }
// הבוררים בחלון — סוג התשלומים, עלויות המימון ומספר התשלומים של דמי ההתפשרות
function segSet(el, hidden) {
  var on = hidden.value;
  el.closest('[role=radiogroup]').querySelectorAll('button').forEach(function (b) { var x = b.dataset.v === on; b.classList.toggle('on', x); b.setAttribute('aria-checked', x); });
}
function ckMode(el) {
  var c = $('#o-ck-uneq'); if (!c) return;
  c.checked = el.dataset.v === 'uneq';
  el.closest('[role=radiogroup]').querySelectorAll('button').forEach(function (b) { var x = b === el; b.classList.toggle('on', x); b.setAttribute('aria-checked', x); });
  ckSync();
}
function finMode(el) {
  var h = $('#o-fin'); if (!h) return;
  h.value = el.dataset.v;
  segSet(el, h);
  $('#o-fin-int').hidden = h.value !== 'int';
  $('#o-fin-set').hidden = h.value !== 'set';
  intSum();
}
// עלויות מימון — תיבת הסימון פותחת את שתי האפשרויות; כיבוי — בלי עלויות מימון
function finOn(el) {
  var pick = $('#o-fin-pick'), h = $('#o-fin'); if (!pick || !h) return;
  pick.hidden = !el.checked;
  if (!el.checked) { h.value = ''; $('#o-fin-int').hidden = true; $('#o-fin-set').hidden = true;
    pick.querySelectorAll('button').forEach(function (b) { b.classList.remove('on'); b.setAttribute('aria-checked', false); }); }
}
// מספר התשלומים של דמי ההתפשרות — «ללא הגבלה» עד שלוחצים על העריכה; לחיצה נוספת — חזרה לללא הגבלה
function setCount() {
  var n = $('#o-set-n'); if (!n) return;
  if (n.readOnly) { n.readOnly = false; n.focus(); }
  else { n.value = ''; n.readOnly = true; }
}

// סכום לכל תשלום — שורה לכל תשלום, ובה החודש שלו כשיש חודש ראשון.
function ckListHTML(n, first, vals) {
  n = Math.min(+n || 0, 60);
  var h = '';
  for (var i = 0; i < n; i++) {
    h += '<label class="fld ln-ck-f"><span>תשלום ' + (i + 1) + (first ? ' · ' + mmYYYY(shiftMonth(first, i)) : '') + '</span>' +
      '<input class="inp" inputmode="decimal" data-amt data-ck="' + i + '" data-inp="ck-sync" value="' + esc(vals && vals[i] != null ? vals[i] : '') + '"></label>';
  }
  return h;
}
function ckReadList() {
  return Array.prototype.map.call(document.querySelectorAll('#o-ck-list [data-ck]'), function (el) { return readNum(el, 0); });
}
function loanKindPick(el) {
  var h = $('#o-kind'); if (!h) return;
  h.value = h.value === el.dataset.v ? '' : el.dataset.v;
  el.closest('[role=radiogroup]').querySelectorAll('button').forEach(function (b) { var on = b.dataset.v === h.value; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  $('#o-ck').hidden = h.value !== 'checks';
  $('#o-lg').hidden = h.value !== 'long';
  var hint = $('#o-kind-hint'); if (hint) hint.hidden = !!h.value;
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
  out.textContent = n ? 'סה״כ התשלומים ' + ils(tot) + (amt && tot < amt ? ' — פחות מסכום ההלוואה ' + ils(amt) : '') : '';
  out.classList.toggle('warn', !!(n && amt && tot < amt));
  // החזר שעולה על הקרן — הערה בצבע עלויות המימון
  var nb = $('#o-ck-note'), nt = $('#o-ck-note-t');
  if (nb && nt) {
    nb.hidden = !(n && amt && tot > amt);
    // היתר העסקה בתשלומים — אינו שדה: נגזר מהתשלומים, בסכום ובאחוזים
    nt.textContent = nb.hidden ? '' : ils(tot - amt) + ' (' + (Math.round((tot / amt - 1) * 10000) / 100) + '%) — סך התשלומים (' + ils(tot) + ') מעל הקרן (' + ils(amt) + '). ההפרש הוא עלות המימון, ואינו חוב.';
  }
}

// היתר עסקה — אחוז ⟵ סכום להחזר, וסכום להחזר ⟵ אחוז, מול סכום ההלוואה.
function intSync(from) {
  var amt = readNum($('#o-amount'), 0), p = $('#o-int-p'), t = $('#o-total');
  if (!p || !t || !(amt > 0)) return;
  if (from === 'p') { var pv = readNum(p, 0); amtSet(t, pv > 0 ? Math.round(amt * (1 + pv / 100) * 100) / 100 : ''); }
  else if (from === 't') { var tv = readNum(t, 0); p.value = tv > amt ? Math.round((tv / amt - 1) * 10000) / 100 : ''; }
  intSum();
}
// מתחת לשדות — במילים: הקרן, היתר העסקה וכמה מחזירים
function intSum() {
  var out = $('#o-int-sum'), amt = readNum($('#o-amount'), 0), tt = readNum($('#o-total'), 0);
  if (!out) return;
  out.textContent = amt > 0 && tt > amt ? 'קרן ' + ils(amt) + ' + היתר עסקה ' + ils(tt - amt) + ' = מחזירים ' + ils(tt) + '. ההפרש הוא עלות המימון, ואינו חוב.'
    : 'ממלאים אחד מהשניים — האחוז או הסכום להחזר. ההפרש מעל הקרן הוא עלות המימון, ואינו חוב.';
}
function saveLoan(id) {
  var donorId = nullable(comboValue('o-donor')), dn = donorId ? donorById(donorId) : null, q = $('#o-donor [data-combo-q]');
  var lender = dn ? dn.name : (q ? q.value.trim() : ''), amount = readNum($('#o-amount'), 0), kind = val('o-kind') || null;
  var td = nullable(val('o-taken')), tm = td ? null : nullable(val('o-taken-m')), status = nullable(val('o-status'));
  if (!lender) { toast(MSG_NEED_NAME, null, 'warn'); return; }
  if (!(amount > 0)) { toast(MSG_AMOUNT_POSITIVE, null, 'warn'); return; }
  // בלי סוג ההחזר אין דרך לדעת מתי ההלוואה יורדת מהחוב
  if (!kind) { toast(MSG_LOAN_KIND, null, 'warn'); return; }
  if (!td && !tm) { toast(MSG_LOAN_TAKEN, null, 'warn'); return; }
  if (!status) { toast(MSG_LOAN_STATUS, null, 'warn'); return; }
  // תנאי ההחזר וההערה — שדה אחד, נשמר בהערה
  var row = { lender: lender, donor_client_id: dn ? donorId : null, amount: amount, kind: kind,
              taken_date: td, taken_month: tm, repay_terms: null, status: status, note: nullable(val('o-note')) };
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
  row.repay_total = null; row.settle_amount = null; row.settle_count = null;
  if (kind === 'long') {
    var cd = nullable(val('o-check'));
    row.last_check_date = cd; row.last_check_month = cd ? null : nullable(val('o-check-m'));
    // עלויות המימון — אחת מהשתיים: היתר עסקה (הסכום להחזר) או דמי התפשרות (סכום לחודש, ומספר תשלומים — רשות)
    var fin = $('#o-fin-on') && $('#o-fin-on').checked ? val('o-fin') : '';
    if (fin === 'int') { var tt = readNum($('#o-total'), 0); row.repay_total = tt > amount ? tt : null; }
    if (fin === 'set') {
      var sa = readNum($('#o-set-a'), 0), sn = $('#o-set-n') && !$('#o-set-n').readOnly ? readNum($('#o-set-n'), 0) : 0;
      if (!(sa > 0)) { toast(MSG_SET_AMT, null, 'warn'); return; }
      row.settle_amount = sa; row.settle_count = sn > 0 ? Math.round(sn) : null;
    }
  }
  if (id) return update('g_loans', id, row);
  // הלוואה חדשה — אחרי השמירה החלון נשאר פתוח עליה, וההוספה של תנועות נפתחת
  return insert('g_loans', row).then(function (r) { state.loansOpen = r && r.client_id ? r.client_id : null; return r; });
}

export { addLoanMove, ckMode, ckSync, finMode, finOn, intSync, formLoanMove, loanInfo, loanKindPick, loansAfter, loansPartial, saveLoanMove, loansBodyHTML, saveLoan, setCount, viewLoans };
