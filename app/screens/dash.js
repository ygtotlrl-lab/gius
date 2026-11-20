// app/screens/dash.js — לוח הבקרה: קריאה בלבד, והכל נגזר מהתשלומים
import { esc, methodIcon, receiptHTML } from '../../core/ui.js';
import { stIcon } from '../../core/icons.js';
import { bar } from '../../core/chart.js';
import { pendTag } from '../../core/sync.js';
import { APP_FIRST_MONTH, ASSIGNEES, MONTH_SHORT, STAGES } from '../constants.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import { dayToday } from '../../core/util.js';
import { donorName, emptyBox, gSortGroups, gSortTxns, ils, loanFlow, loanLongDebt, monthAmount, monthLabel, monthTxnsInit,
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

// ── הכנסות והלוואות לטווח ארוך ──
// הכנסה — מה שנספר בחודש (monthAmount של התשלומים היזומים); הלוואות — לטווח ארוך בלבד (loanFlow ב-domain.js):
// חדשות לפי חודש הלקיחה, החזרים לפי תאריך התנועה, ונטו = חדשות פחות החזרים; הלוואה בהחזר בתשלומים — ההחזר שלה בתקציב, ואינה כאן.
function flowOf(m) {
  var f = loanFlow(m);
  f.inc = sum(monthTxnsInit(m), monthAmount);
  f.tgt = targetFor(m);
  f.debt = loanLongDebt(m);
  f.netUp = Math.max(0, f.net); f.netBack = Math.max(0, -f.net);
  return f;
}
// הטווח — מהחודש הראשון של האפליקציה ועד החודש של היום
function flowMonths() {
  var now = dayToday().slice(0, 7), out = [], k = APP_FIRST_MONTH;
  while (k <= now && out.length < 240) { out.push(k); k = shiftMonth(k, 1); }
  return out;
}
function kShort(v) { return v >= 1e6 ? (Math.round(v / 1e5) / 10) + 'M' : v >= 1000 ? Math.round(v / 1000) + 'K' : String(Math.round(v)); }
function hFr(v, max) { return Math.round(Math.min(1, (v || 0) / max) * 1000) / 1000; }
function signed(v) { return (v < 0 ? '−' : '') + ils(Math.abs(v)); }
// עמודה לכל חודש: bars — [{v, cls, lbl}]; התוויות מעל העמודה הגבוהה, ממורכזות לקבוצה,
// הגבוה למעלה ובצבע העמודה — וכך גם בחודש המוצג (big: הסכום המלא, בלי תווית חודש); extra — נקודת המדד.
function colHTML(m, bars, max, tgt, big, extra) {
  var p = m.split('-');
  var hs = bars.map(function (x) { return hFr(x.v, max); }), top = Math.max.apply(null, hs.concat([0]));
  var plot = bars.map(function (x, i) {
    return '<span class="fl-bar ' + x.cls + '" style="--v:' + hs[i] + '" title="' + esc(x.lbl + ' ' + ils(x.v)) + '"></span>';
  }).join('');
  var lbls = bars.map(function (x, i) { return { v: x.v, h: hs[i], cls: x.cls }; }).filter(function (x) { return x.v > 0; })
    .sort(function (a, b) { return a.h - b.h; })
    .map(function (x) { return '<b class="' + x.cls + '">' + esc(big ? ils(x.v) : kShort(x.v)) + '</b>'; }).join('');
  return '<div class="fl-col">' +
    '<div class="fl-plot">' + (tgt > 0 ? '<i class="fl-tgt" style="--v:' + hFr(tgt, max) + '"></i>' : '') + plot +
      (lbls ? '<span class="fl-vals" style="--v:' + top + '">' + lbls + '</span>' : '') + (extra || '') + '</div>' +
    (big ? '' : '<span class="fl-lab">' + esc(MONTH_SHORT[+p[1] - 1] + ' ' + p[0].slice(2)) + '</span>') +
  '</div>';
}

// מדד החוב לטווח ארוך — בכל חודש: הכנסות · הלוואות חדשות · החזרים, וקו החוב בסוף החודש (בסולם משלו);
// והכותרת — כמה החוב עלה או ירד מתחילת התקופה.
function indexHTML(all) {
  var start = loanLongDebt(shiftMonth(APP_FIRST_MONTH, -1)), now = all.length ? all[all.length - 1].debt : start, ch = now - start;
  var maxB = 1, maxD = 1;
  all.forEach(function (f) { maxB = Math.max(maxB, f.inc, f.long, f.repaid); maxD = Math.max(maxD, f.debt, start); });
  maxB *= 2.1; // העמודות בחצי התחתון, והקו מעליהן
  // הקו — מעל העמודות, בחלק העליון של הגרף, כדי שלא יסתיר אותן
  var dv = function (v) { return Math.round((0.55 + 0.4 * Math.min(1, v / maxD)) * 1000) / 1000; };
  var n = all.length;
  var pts = all.map(function (f, i) { return (i + 0.5) + ',' + Math.round((1 - dv(f.debt)) * 1000) / 10; }).join(' ');
  var head = '<div class="ix-head ' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '">' +
    '<span class="ix-ic">' + icon(ch > 0 ? 'up' : 'down') + '</span><div><b>' +
    esc(ch > 0 ? 'החוב לטווח ארוך עלה ב־' + ils(ch) : ch < 0 ? 'החוב לטווח ארוך ירד ב־' + ils(-ch) : 'החוב לטווח ארוך לא השתנה') +
    '</b><small>' + esc('מתחילת התקופה · היום ' + ils(now)) + '</small></div></div>';
  var legend = '<div class="fl-legend"><div class="fl-lg"><span><i class="inc"></i>הכנסות</span><span><i class="loan"></i>הלוואות חדשות לטווח ארוך</span>' +
    '<span><i class="rep"></i>החזרים</span></div><div class="fl-lg"><span><i class="debt"></i>החוב לטווח ארוך</span></div></div>';
  return '<section class="card ix"><h2>מדד החוב לטווח ארוך</h2>' + head + legend +
    '<div class="fl-hist"><div class="fl-scroll" tabindex="0" aria-label="מדד החוב לפי חודש"><div class="fl-track">' +
      (n ? '<svg class="ix-line" style="--n:' + n + '" viewBox="0 0 ' + n + ' 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '"/></svg>' : '') +
      all.slice().reverse().map(function (f) {
        var dot = '<span class="ix-dot" style="--v:' + dv(f.debt) + '" title="' + esc('החוב ' + ils(f.debt)) + '"><b>' + esc(kShort(f.debt)) + '</b></span>';
        return colHTML(f.m, [{ v: f.inc, cls: 'inc', lbl: 'הכנסות' }, { v: f.long, cls: 'loan', lbl: 'הלוואות חדשות' }, { v: f.repaid, cls: 'rep', lbl: 'החזרים' }],
          maxB, 0, false, dot);
      }).join('') + '</div></div></div></section>';
}

// הלוואות נטו — אדומה כשהחוב גדל, וירוקה («החזר נטו») כשהוחזר יותר משנלקח.
function netBars(f) {
  return [{ v: f.inc, cls: 'inc', lbl: 'הכנסות' },
          f.netBack > 0 ? { v: f.netBack, cls: 'rep', lbl: 'החזר נטו' } : { v: f.netUp, cls: 'loan', lbl: 'הלוואות נטו' }];
}
function flowHTML(m) {
  var all = flowMonths().map(flowOf), cur = flowOf(m);
  var avg = all.length ? sum(all, function (f) { return f.inc; }) / all.length : 0;
  var tot = { inc: sum(all, function (f) { return f.inc; }), net: sum(all, function (f) { return f.net; }) };
  var max = 1;
  all.concat([cur]).forEach(function (f) { max = Math.max(max, f.inc, f.netUp, f.netBack, f.tgt); });
  max *= 1.12;
  var legend = '<div class="fl-legend"><div class="fl-lg"><span><i class="inc"></i>הכנסות</span><span><i class="loan"></i>הלוואות נטו</span><span><i class="rep"></i>החזר נטו</span></div>' +
    '<div class="fl-lg"><span><i class="tgt"></i>יעד</span><span><i class="avg"></i>ממוצע הכנסה · ' + esc(ils(avg)) + '</span></div></div>' +
    '<div class="fl-total">מתחילת התקופה: הכנסות <b>' + esc(ils(tot.inc)) + '</b> · הלוואות נטו <b class="' + (tot.net > 0 ? 'loan' : 'rep') + '">' + esc(signed(tot.net)) + '</b></div>';
  var sumHTML = '<dl class="fl-sum"><div><dt><i class="inc"></i>הכנסות</dt><dd>' + esc(ils(cur.inc)) + '</dd></div>' +
    '<div><dt><i class="' + (cur.net < 0 ? 'rep' : 'loan') + '"></i>הלוואות נטו</dt><dd>' + esc(signed(cur.net)) + '</dd></div></dl>';
  // החודש — רכיב משלו; ההיסטוריה — נגללת בתוכה, והחדש בימין (תחילת השורה ב-RTL), כך שבכניסה רואים את החודשים האחרונים
  return indexHTML(all) +
    '<section class="card"><h2>הכנסות מול הלוואות נטו</h2>' + legend +
    '<div class="flow">' +
      '<div class="fl-month"><div class="fl-title"><span>' + esc(monthLabel(m)) + '</span></div>' + colHTML(m, netBars(cur), max, cur.tgt, true) + sumHTML + '</div>' +
      '<div class="fl-hist"><div class="fl-title"><span>לאורך הזמן</span></div><div class="fl-scroll" tabindex="0" aria-label="הכנסות והלוואות נטו לפי חודש">' +
        '<div class="fl-track">' + (avg > 0 ? '<i class="fl-avg" style="--v:' + hFr(avg, max) + '"></i>' : '') +
        all.slice().reverse().map(function (f) { return colHTML(f.m, netBars(f), max, f.tgt, false); }).join('') + '</div></div></div>' +
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
    // «קבלה» — רכיב הליבה: קבוצה לכל יום (התאריך של התשלום, ובלעדיו החודש); מה שטרם נסלק — מקווקו והסכום אפור.
    h += receiptHTML(shown.map(function (t) {
      var p = pledgeById(t.pledge_client_id);
      return { day: txnWhen(t), amt: ils(monthAmount(t)), method: t.method || '', ico: icon(methodIcon(t.method)),
        who: '<b>' + esc(donorName(t.donor_client_id)) + pendTag(pendRowKey('g_txns', t.client_id)) + '</b>' +
          '<small>' + esc((p && (p.pledge_type || p.section)) || '—') + (txnSoLabel(t) ? ' · ' + esc(txnSoLabel(t)) : '') + '</small>',
        dashed: !t.cleared, muted: !t.cleared, title: t.cleared ? '' : 'טרם נסלק', act: 'card-go', id: t.donor_client_id };
    }));
  }
  if (list.length > 3) h += '<button class="btn ghost pay-more" data-act="dash-pay-all" aria-expanded="' + (state.dashPayAll ? 'true' : 'false') + '">' +
    (state.dashPayAll ? 'הצג פחות' + icon('up') : 'הצג את כל ' + list.length + ' התשלומים' + icon('down')) + '</button>';
  h += '</section>';
  return h;
}

export { viewDash };
