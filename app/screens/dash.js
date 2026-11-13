// app/screens/dash.js — לוח הבקרה: קריאה בלבד, והכל נגזר מהתשלומים
import { esc, methodIcon } from '../../core/ui.js';
import { stIcon } from '../../core/icons.js';
import { bar } from '../../core/chart.js';
import { pendTag } from '../../core/sync.js';
import { APP_FIRST_MONTH, ASSIGNEES, STAGES } from '../constants.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import { dayToday } from '../../core/util.js';
import { donorName, emptyBox, gSortGroups, gSortTxns, ils, monthAmount, monthKeyOf, monthLabel, monthTxnsInit,
         pendRowKey, pledgeById, shiftMonth, sum, targetFor, txnSoLabel, txnWhen } from '../domain.js';

// הסף בהודעת המומנטום הוא «גדול או שווה» — «גדול» משנה בשקט את ההודעה בקצה הטווח.
function momentumMsg(pct) {
  if (pct >= 100) return momentumHTML('trophy', 'עמדנו ביעד!');
  if (pct >= 75) return momentumHTML('medal1', 'כמעט שם — דחיפה אחרונה!');
  if (pct >= 50) return momentumHTML('medal2', 'מעל המחצית — ממשיכים!');
  if (pct >= 25) return momentumHTML('medal3', 'רבע דרך — מומנטום!');
  return momentumHTML('star', 'מתחילים!');
}
function momentumHTML(ic, text) { return stIcon(icon(ic)) + esc(text); }

// מד בחצי עיגול שמתמלא מימין לשמאל, כיוון הקריאה; במרכזו הנגבה בלבד, בצבע שלב ההתקדמות.
// מעל 100% הקשת נשארת מלאה.
var GAUGE_LEN = Math.PI * 170;
function stageCls(pct) { return pct >= 100 ? 'st-done' : pct >= 50 ? 'st-mid' : pct >= 25 ? 'st-low' : 'st-start'; }
function gaugeHTML(collected, pct) {
  var fill = GAUGE_LEN * Math.max(0, Math.min(100, pct)) / 100;
  var arc = 'M370,200 A170,170 0 0 0 30,200';
  return '<div class="gauge">' +
    '<svg viewBox="0 0 400 220" aria-hidden="true">' +
      '<path class="bg" d="' + arc + '"></path>' +
      (fill > 0 ? '<path class="fg" d="' + arc + '" stroke-dasharray="' + fill.toFixed(1) + ' ' + GAUGE_LEN.toFixed(1) + '"></path>' : '') +
    '</svg>' +
    '<b class="gauge-val ' + stageCls(pct) + '">' + ils(collected) + '</b>' +
  '</div>';
}

// שורה ברשימה שליד המד — אייקון בעיגול, התווית מעל והערך מתחתיה.
function gStat(ic, lab, val) {
  return '<div><span class="g-ic">' + icon(ic) + '</span><span class="g-txt"><dt>' + esc(lab) + '</dt><dd>' + esc(val) + '</dd></span></div>';
}

// הסעיף והשגריר של תשלום — מההתחייבות שהוא נזקף אליה; התשלום עצמו אינו נושא אותם.
function groupBy(list, pick, fallback) {
  var map = {}, order = [];
  list.forEach(function (t) {
    var k = String(pick(t) || '').trim() || fallback;
    if (!map[k]) { map[k] = { key: k, total: 0, count: 0 }; order.push(k); }
    map[k].total += monthAmount(t);
    map[k].count++;
  });
  return gSortGroups(order.map(function (k) { return map[k]; }));
}

function pledgeField(t, f) { var p = pledgeById(t.pledge_client_id); return p ? p[f] : ''; }

// אייקון לסעיף — לפי מילה בשם, כמו אמצעי התשלום; סעיף שאינו מוכר — תגית.
var SECTION_ICONS = [[/מגבי/, 'megaphone'], [/גבי/, 'coins'], [/פרויקט/, 'building'], [/תרומ/, 'heart'],
  [/ריהוט|כלים/, 'chair'], [/פרנס|תאריכ|שיעור/, 'calendar'], [/הוראו?ת קבע|הו״ק/, 'repeat']];
function sectionIcon(name) {
  for (var i = 0; i < SECTION_ICONS.length; i++) if (SECTION_ICONS[i][0].test(name || '')) return SECTION_ICONS[i][1];
  return 'tag';
}

// שורה רזה אחת: (אייקון) שם · פס · אחוז · סכום — עמודות משותפות, והפסים מתחילים ונגמרים באותו קו.
function breakdownHTML(rows, total, withIcon) {
  if (!rows.length) return emptyBox('dash', 'אין תשלומים בחודש זה');
  return '<div class="brk">' + rows.map(function (r) {
    var share = total > 0 ? r.total / total * 100 : 0;
    return '<div class="brk-row"><span class="brk-lab">' +
      (withIcon ? '<span class="brk-ic">' + icon(sectionIcon(r.key)) + '</span>' : '') +
      '<b>' + esc(r.key) + '</b></span>' +
      '<span class="brk-bar">' + bar(share.toFixed(1)) + '</span>' +
      '<span class="brk-pct">' + share.toFixed(0) + '%</span>' +
      '<b class="brk-val">' + ils(r.total) + '</b></div>';
  }).join('') + '</div>';
}

// מצב המשימות לכל אחראי — שלושת השלבים ומספריהם, והמספר הבולט — בהרצה; מנותב למסך המשימות.
function tasksHTML() {
  return '<div class="who-grid">' + ASSIGNEES.map(function (who) {
    var mine = state.tasks.filter(function (t) { return t.assignee === who; });
    var cnt = function (st) { return mine.filter(function (t) { return t.stage === st; }).length; };
    return '<button class="who-card" data-act="dash-who" data-who="' + esc(who) + '">' +
      '<span class="who-main"><b>' + esc(who) + '</b>' +
        '<span class="who-stages">' + STAGES.map(function (s) {
          return '<span class="pill ' + s.cls + '">' + esc(s.id) + ' · ' + cnt(s.id) + '</span>';
        }).join('') + '</span></span>' +
      '<span class="who-total" aria-label="' + cnt(STAGES[0].id) + ' משימות ' + esc(STAGES[0].id) + '">' + cnt(STAGES[0].id) +
        '<small>' + esc(STAGES[0].id) + '</small></span></button>';
  }).join('') + '</div>';
}

// ── הכנסות מול הלוואות ──
// הכנסה — מה שנספר בחודש (monthAmount של התשלומים היזומים); הלוואה — לפי חודש הלקיחה.
var MONTH_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
function loanMonth(l) { return l.taken_date ? monthKeyOf(l.taken_date) : (l.taken_month || ''); }
function flowOf(m) {
  return { m: m, inc: sum(monthTxnsInit(m), monthAmount),
           loan: sum(state.loans.filter(function (l) { return loanMonth(l) === m; }), function (l) { return l.amount; }),
           tgt: targetFor(m) };
}
// הטווח — מהחודש הראשון של האפליקציה ועד החודש של היום
function flowMonths() {
  var now = dayToday().slice(0, 7), out = [], k = APP_FIRST_MONTH;
  while (k <= now && out.length < 240) { out.push(k); k = shiftMonth(k, 1); }
  return out;
}
function kShort(v) { return v >= 1000 ? Math.round(v / 1000) + 'K' : String(Math.round(v)); }
function hFr(v, max) { return Math.round(Math.min(1, (v || 0) / max) * 1000) / 1000; }
function flowColHTML(f, max, big) {
  var p = f.m.split('-'), hi = hFr(f.inc, max), hl = hFr(f.loan, max);
  var b = function (v, h, cls, lbl) {
    return '<span class="fl-bar ' + cls + '" style="--v:' + h + '" title="' + lbl + ' ' + esc(ils(v)) + '"></span>';
  };
  // התוויות — מעל העמודה הגבוהה, ממורכזות לזוג ובצבע העמודה; הסכום הגבוה למעלה והנמוך מתחתיו
  var lb = function (v, cls) { return v > 0 ? '<b class="' + cls + '">' + esc(big ? ils(v) : kShort(v)) + '</b>' : ''; };
  var lbls = hi >= hl ? lb(f.loan, 'loan') + lb(f.inc, 'inc') : lb(f.inc, 'inc') + lb(f.loan, 'loan');
  return '<div class="fl-col">' +
    '<div class="fl-plot">' +
      (f.tgt > 0 ? '<i class="fl-tgt" style="--v:' + hFr(f.tgt, max) + '"></i>' : '') +
      b(f.inc, hi, 'inc', 'הכנסות') + b(f.loan, hl, 'loan', 'הלוואות') +
      (lbls ? '<span class="fl-vals" style="--v:' + Math.max(hi, hl) + '">' + lbls + '</span>' : '') +
    '</div>' +
    (big ? '' : '<span class="fl-lab">' + esc(MONTH_SHORT[+p[1] - 1] + ' ' + p[0].slice(2)) + '</span>') +
  '</div>';
}
function flowHTML(m) {
  var months = flowMonths(), all = months.map(flowOf), cur = flowOf(m);
  var max = 1;
  all.concat([cur]).forEach(function (f) { max = Math.max(max, f.inc, f.loan, f.tgt); });
  max *= 1.12;
  var avg = all.length ? sum(all, function (f) { return f.inc; }) / all.length : 0;
  // שתי קבוצות — הצבעים והקווים; בטלפון כל קבוצה בשורה משלה
  var legend = '<div class="fl-legend"><div class="fl-lg"><span><i class="inc"></i>הכנסות</span><span><i class="loan"></i>הלוואות</span></div>' +
    '<div class="fl-lg"><span><i class="tgt"></i>יעד</span><span><i class="avg"></i>ממוצע הכנסה · ' + esc(ils(avg)) + '</span></div></div>';
  // החודש — רכיב משלו; ההיסטוריה — נגללת בתוכה, והחדש בימין (תחילת השורה ב-RTL), כך שבכניסה רואים את החודשים האחרונים
  return '<section class="card"><h2>הכנסות מול הלוואות</h2>' + legend +
    '<div class="flow">' +
      '<div class="fl-month"><div class="fl-title"><span>' + esc(monthLabel(m)) + '</span></div>' + flowColHTML(cur, max, true) +
        '<dl class="fl-sum"><div><dt><i class="inc"></i>הכנסות</dt><dd>' + esc(ils(cur.inc)) + '</dd></div>' +
        '<div><dt><i class="loan"></i>הלוואות</dt><dd>' + esc(ils(cur.loan)) + '</dd></div></dl></div>' +
      '<div class="fl-hist"><div class="fl-title"><span>לאורך הזמן</span></div><div class="fl-scroll" tabindex="0" aria-label="הכנסות והלוואות לפי חודש">' +
        '<div class="fl-track">' + (avg > 0 ? '<i class="fl-avg" style="--v:' + hFr(avg, max) + '"></i>' : '') +
        all.slice().reverse().map(function (f) { return flowColHTML(f, max, false); }).join('') + '</div></div></div>' +
    '</div></section>';
}

function viewDash() {
  var m = state.month;
  var txns = monthTxnsInit(m);
  var collected = sum(txns, monthAmount);
  var target = targetFor(m);
  var remaining = Math.max(0, target - collected);
  var pct = target > 0 ? collected / target * 100 : 0;

  var h = '<section class="card">' +
    '<div class="monthnav">' +
      '<button class="btn ghost sm ic" data-act="month" data-d="-1" aria-label="חודש קודם"' + (m <= APP_FIRST_MONTH ? ' disabled' : '') + '>' + icon('prev') + '</button>' +
      '<b>' + esc(monthLabel(m)) + '</b>' +
      '<button class="btn ghost sm ic" data-act="month" data-d="1" aria-label="חודש הבא">' + icon('next') + '</button>' +
    '</div>' +
    '<div class="gauge-row">' + gaugeHTML(collected, target > 0 ? pct : 0) +
      '<dl class="g-list">' +
        gStat('dash', 'אחוזים', target > 0 ? Math.round(pct) + '%' : '—') +
        gStat('target', 'יעד', target > 0 ? ils(target) : 'לא הוגדר') +
        gStat('wait', 'סכום שנותר', target > 0 ? ils(remaining) : '—') +
        gStat('cash', 'מספר תשלומים', String(txns.length)) +
      '</dl>' +
    '</div>' +
    '<div class="momentum">' + momentumMsg(target > 0 ? pct : 0) + '</div>' +
  '</section>';

  h += flowHTML(m);

  h += '<div class="grid2">' +
    '<section class="card"><h2>פילוח סעיפים</h2>' +
      breakdownHTML(groupBy(txns, function (t) { return pledgeField(t, 'section'); }, 'ללא סעיף'), collected, true) +
    '</section>' +
    '<section class="card"><h2>פילוח שגרירים</h2>' +
      breakdownHTML(groupBy(txns, function (t) { return pledgeField(t, 'ambassador'); }, 'ללא שגריר'), collected) +
    '</section>' +
  '</div>';

  h += '<section class="card"><h2>משימות</h2>' + tasksHTML() + '</section>';

  // תשלום שלא סומן «סליקה בפועל» — שקוף מעט; הוא נספר בנגבה כמו כל תשלום.
  // שלושה אחרונים, והשאר בלחיצה — הרשימה המלאה ארוכה מדי לראש הלוח.
  var list = gSortTxns(txns), shown = state.dashPayAll ? list : list.slice(0, 3);
  h += '<section class="card"><h2>תשלומי החודש<span class="cnt">' + list.length + '</span></h2>';
  if (!list.length) h += emptyBox('cash', 'אין תשלומים בחודש זה');
  else {
    // קבוצה לכל יום — התאריך של התשלום, ובלעדיו החודש.
    var lastDay = null;
    h += shown.map(function (t) {
      var p = pledgeById(t.pledge_client_id), nm = donorName(t.donor_client_id), day = txnWhen(t), head = '';
      if (day !== lastDay) { head = '<div class="rc-day">' + esc(day) + '</div>'; lastDay = day; }
      return head + '<div class="rc' + (t.cleared ? '' : ' uncleared') + '" data-act="card-go" data-id="' + esc(t.donor_client_id) + '"' +
          (t.cleared ? '' : ' title="טרם נסלק"') + '>' +
        '<span class="rc-amt">' + ils(monthAmount(t)) + '</span>' +
        '<div class="rc-who"><b>' + esc(nm) + pendTag(pendRowKey('g_txns', t.client_id)) + '</b>' +
          '<small>' + esc((p && (p.pledge_type || p.section)) || '—') + (txnSoLabel(t) ? ' · ' + esc(txnSoLabel(t)) : '') + '</small></div>' +
        '<span class="rc-end" title="' + esc(t.method || '') + '">' + icon(methodIcon(t.method)) + '<span>' + esc(t.method || '') + '</span></span></div>';
    }).join('');
  }
  if (list.length > 3) h += '<button class="btn ghost pay-more" data-act="dash-pay-all" aria-expanded="' + (state.dashPayAll ? 'true' : 'false') + '">' +
    (state.dashPayAll ? 'הצג פחות' + icon('up') : 'הצג את כל ' + list.length + ' התשלומים' + icon('down')) + '</button>';
  h += '</section>';
  return h;
}

export { viewDash };
