// app/screens/dash.js — לוח הבקרה: קריאה בלבד, והכל נגזר מהתשלומים
import { esc, methodIcon, receiptHTML } from '../../core/ui.js';
import { stIcon } from '../../core/icons.js';
import { bar } from '../../core/chart.js';
import { pendTag } from '../../core/sync.js';
import { APP_FIRST_MONTH, MONTH_SHORT, STAGES } from '../constants.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import { dayToday } from '../../core/util.js';
import { donorName, emptyBox, gSortGroups, gSortTxns, ils, loanDebt, loanFlow, monthAmount, monthLabel, monthTxnsInit,
         assigneeNames, pendRowKey, pledgeById, shiftMonth, sum, targetFor, txnSoLabel, txnWhen } from '../domain.js';

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

// המשימות בעבודה לכל אחראי — השם, ובצד השמאלי המספר בלבד; מנותב למסך המשימות.
function tasksHTML() {
  var st = STAGES[0].id;
  return '<div class="who-grid">' + assigneeNames().map(function (who) {
    var n = state.tasks.filter(function (t) { return t.assignee === who && t.stage === st; }).length;
    return '<button class="who-card" data-act="dash-who" data-who="' + esc(who) + '">' +
      '<span class="who-main"><b>' + esc(who) + '</b></span>' +
      '<span class="who-total" aria-label="' + n + ' משימות ' + esc(st) + '">' + n + '</span></button>';
  }).join('') + '</div>';
}

// ── הכנסות והלוואות ──
// הכנסה — מה שנספר בחודש (monthAmount של התשלומים היזומים); הלוואות — משני הסוגים (loanFlow · loanDebt ב-domain.js):
// חדשות לפי חודש הלקיחה, והחזרים — בהסדר או תאריך לפי תאריך התנועה, ובהחזר צ׳קים לפי הצ׳קים שהוגדרו; נטו = חדשות פחות החזרים.
function flowOf(m) {
  var f = loanFlow(m);
  f.inc = sum(monthTxnsInit(m), monthAmount);
  f.tgt = targetFor(m);
  f.debt = loanDebt(m); f.debtLong = loanDebt(m, 'long'); f.debtInst = loanDebt(m, 'inst');
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
// עמודה לכל חודש: bars — [{v, cls, lbl}]; התוויות מעל העמודה הגבוהה, ממורכזות לקבוצה,
// הגבוה למעלה ובצבע העמודה — וכך גם בחודש המוצג (big: הסכום המלא, בלי תווית חודש); extra — נקודת המדד.
function colHTML(m, bars, max, tgt, big, extra) {
  var p = m.split('-');
  // full — העמודה כולה בגובה הסכום המלא וחיוורת, והחלק המודגש בתחתיתה — v (נטו)
  var hs = bars.map(function (x) { return hFr(x.full > x.v ? x.full : x.v, max); }), top = Math.max.apply(null, hs.concat([0]));
  var fmt = function (v) { return esc(big ? ils(v) : kShort(v)); };
  var plot = bars.map(function (x, i) {
    if (x.full > x.v) return '<span class="fl-bar ghost ' + x.cls + '" style="--v:' + hs[i] + '" title="' + esc(x.lbl + ' ' + ils(x.v) + ' מתוך ' + ils(x.full)) + '">' +
      '<span class="fl-solid" style="--s:' + hFr(x.v, x.full) + '"></span></span>';
    return '<span class="fl-bar ' + x.cls + '" style="--v:' + hs[i] + '" title="' + esc(x.lbl + ' ' + ils(x.v)) + '"></span>';
  }).join('');
  var lbls = bars.map(function (x, i) { return { v: x.v, full: x.full, h: hs[i], cls: x.cls, sumLbl: x.sumLbl }; }).filter(function (x) { return x.v > 0 || x.full > 0; })
    .sort(function (a, b) { return a.h - b.h; })
    .map(function (x) { return '<b class="' + x.cls + '">' + (x.sumLbl ? fmt(x.full > x.v ? x.full : x.v) : fmt(x.v) + (x.full > x.v ? '<small>מתוך ' + fmt(x.full) + '</small>' : '')) + '</b>'; }).join('');
  return '<div class="fl-col">' +
    '<div class="fl-plot">' + (tgt > 0 ? '<i class="fl-tgt" style="--v:' + hFr(tgt, max) + '"></i>' : '') + plot +
      (lbls ? '<span class="fl-vals" style="--v:' + top + '">' + lbls + '</span>' : '') + (extra || '') + '</div>' +
    (big ? '' : '<span class="fl-lab">' + esc(MONTH_SHORT[+p[1] - 1] + ' ' + p[0].slice(2)) + '</span>') +
  '</div>';
}

// מדד — כותרת: כמה החוב עלה (אדום, חץ למעלה) או ירד (ירוק, חץ למטה) מתחילת התקופה, והחוב היום;
// ועמודה לכל חודש — bars(f), ומעליהן קו החוב בסוף כל חודש, בסולם משלו. o: key · title · name · bars · legend · sub (שורה משנית בכותרת) · cls
function indexHTML(all, o) {
  var start = loanDebt(shiftMonth(APP_FIRST_MONTH, -1), o.kind), now = all.length ? all[all.length - 1][o.key] : start, ch = now - start;
  var maxB = 1, maxD = 1;
  all.forEach(function (f) { o.bars(f).forEach(function (x) { maxB = Math.max(maxB, x.v); }); maxD = Math.max(maxD, f[o.key], start); });
  maxB *= 2.1; // העמודות בחצי התחתון, והקו מעליהן
  var dv = function (v) { return Math.round((0.55 + 0.4 * Math.min(1, v / maxD)) * 1000) / 1000; };
  // נקודת ההתחלה — «תחילת <החודש הראשון>», החוב בסוף החודש שלפניו: הקו מתחיל מאותה נקודה שממנה נמדדת הכותרת,
  // וההפרש בין תחילתו לסופו הוא בדיוק המספר שבכותרת
  var n = all.length + 1, y = function (v) { return Math.round((1 - dv(v)) * 1000) / 10; };
  var pts = '0.5,' + y(start) + ' ' + all.map(function (f, i) { return (i + 1.5) + ',' + y(f[o.key]); }).join(' ');
  var fp = APP_FIRST_MONTH.split('-');
  var startCol = '<div class="fl-col ix-start"><div class="fl-plot"><span class="ix-dot" style="--v:' + dv(start) + '" title="' + esc('החוב בתחילת התקופה ' + ils(start)) + '"><b>' + esc(kShort(start)) + '</b></span></div>' +
    '<span class="fl-lab">' + esc('תחילת ' + MONTH_SHORT[+fp[1] - 1] + ' ' + fp[0].slice(2)) + '</span></div>';
  var head = '<div class="ix-head ' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '">' +
    '<span class="ix-ic">' + icon(ch > 0 ? 'up' : 'down') + '</span><div><b>' +
    esc(ch > 0 ? o.name + ' עלה ב־' + ils(ch) : ch < 0 ? o.name + ' ירד ב־' + ils(-ch) : o.name + ' לא השתנה') +
    '</b><small>' + esc('מתחילת התקופה · היום ' + ils(now)) + '</small>' + (o.sub ? '<small class="ix-sub">' + o.sub + '</small>' : '') + '</div></div>';
  // מדד בתוך מדד (o.nested) — בלי כרטיס ובלי כותרת: הכפתור שפתח אותו הוא הכותרת; o.after — תוכן בסוף הרכיב
  var tag = o.nested ? 'div' : 'section';
  return '<' + tag + ' class="' + (o.nested ? 'ix ix-nested' : 'card ix') + '">' + (o.nested ? '' : '<h2>' + esc(o.title) + '</h2>') + head +
    '<div class="fl-hist"><div class="fl-scroll" tabindex="0" aria-label="' + esc(o.title) + ' לפי חודש"><div class="fl-track">' +
      ('<svg class="ix-line" style="--n:' + n + '" viewBox="0 0 ' + n + ' 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '"/></svg>') +
      all.slice().reverse().map(function (f) {
        var dot = '<span class="ix-dot" style="--v:' + dv(f[o.key]) + '" title="' + esc('החוב ' + ils(f[o.key])) + '"><b>' + esc(kShort(f[o.key])) + '</b></span>';
        return colHTML(f.m, o.bars(f), maxB, 0, false, dot);
      }).join('') + startCol + '</div></div></div>' + o.legend.replace('class="fl-legend"', 'class="fl-legend fl-legend-below"') + (o.after || '') + '</' + tag + '>';
}
function chgTxt(all, key, kind) {
  var c = (all.length ? all[all.length - 1][key] : 0) - loanDebt(shiftMonth(APP_FIRST_MONTH, -1), kind);
  return (c > 0 ? 'עלה ' : c < 0 ? 'ירד ' : 'ללא שינוי ') + (c ? kShort(Math.abs(c)) : '');
}
// עלויות המימון — עמודה אחת: הכהה בתחתיתה — היתר עסקה, והחיוור מעליו — דמי התפשרות; התווית — הסך
function fin(interest, total) { return { v: interest, full: total, cls: 'int', lbl: 'היתר עסקה', sumLbl: true }; }
var FIN_NOTE = '<p class="fl-note"><span class="fl-sw int"></span>עלויות מימון — הכהה: היתר עסקה · החיוור: דמי התפשרות</p>';
function lg(items) {
  return '<div class="fl-legend"><div class="fl-lg">' + items.map(function (x) { return '<span><i class="' + x[0] + '"></i>' + esc(x[1]) + '</span>'; }).join('') + '</div></div>';
}
// שלושה מדדים: הכללי — הכנסות · הלוואות · היתר עסקה · החזרים, וקו החוב כולו; ובתוכו, בסופו, שני כפתורים זה מעל זה —
// הסדר או תאריך והחזר צ׳קים: סגורים, ולחיצה פותחת את המדד של הסוג מתחת לכפתור (`state.ixOpen`).
function indicesHTML(all) {
  var tone = function (key, kind) { return chgTxt(all, key, kind).indexOf('עלה') === 0 ? 'up' : 'down'; };
  var sub = '<span class="' + tone('debtLong', 'long') + '">הסדר או תאריך ' + esc(chgTxt(all, 'debtLong', 'long')) + '</span> · ' +
    '<span class="' + tone('debtInst', 'inst') + '">החזר צ׳קים ' + esc(chgTxt(all, 'debtInst', 'inst')) + '</span>' +
    ' · <span class="int">עלויות מימון ' + esc(kShort(sum(all, function (f) { return f.finance; }))) + '</span>';
  var debtLine = ['debt', 'החוב בסוף החודש'];
  var kinds = [
    { k: 'long', key: 'debtLong', title: 'הלוואות בהסדר או תאריך',
      bars: function (f) { return [{ v: f.long, cls: 'loan', lbl: 'הלוואות' }, fin(f.intLong, f.finLong), { v: f.repLong, cls: 'rep', lbl: 'החזרים' }]; } },
    { k: 'inst', key: 'debtInst', title: 'הלוואות בהחזר צ׳קים',
      bars: function (f) { return [{ v: f.inst, cls: 'loan', lbl: 'הלוואות' }, fin(f.intInst, f.finInst), { v: f.repInst, cls: 'rep', lbl: 'החזרים' }]; } }];
  var open = state.ixOpen || {};
  var subs = '<div class="ix-subs">' + kinds.map(function (x) {
    var on = !!open[x.k];
    return '<div class="ix-sub-wrap' + (on ? ' open' : '') + '">' +
      '<button class="ix-btn" data-act="ix-toggle" data-k="' + x.k + '" aria-expanded="' + on + '">' +
        '<span class="ix-btn-t">' + esc(x.title) + '<small class="' + tone(x.key, x.k) + '">' + esc('החוב ' + chgTxt(all, x.key, x.k)) + '</small></span>' +
        '<span class="ix-btn-c" aria-hidden="true">' + icon(on ? 'up' : 'down') + '</span></button>' +
      (on ? indexHTML(all, { key: x.key, kind: x.k, title: x.title, name: 'החוב', nested: true, bars: x.bars,
              legend: lg([['loan', 'הלוואות'], ['int', 'עלויות מימון'], ['rep', 'החזרים'], debtLine]) + FIN_NOTE }) : '') +
    '</div>';
  }).join('') + '</div>';
  return indexHTML(all, { key: 'debt', title: 'מדד החוב הכללי', name: 'החוב הכללי', sub: sub, after: subs,
      bars: function (f) { return [{ v: f.inc, cls: 'inc', lbl: 'הכנסות' }, { v: f.long + f.inst, cls: 'loan', lbl: 'הלוואות' },
                                   fin(f.interest, f.finance), { v: f.repaid, cls: 'rep', lbl: 'החזרים' }]; },
      legend: lg([['inc', 'הכנסות'], ['loan', 'הלוואות'], ['int', 'עלויות מימון'], ['rep', 'החזרים'], debtLine]) + FIN_NOTE });
}

// ── החודש המוצג במדד החוב — ארבע העמודות של החודש (הכנסות · הלוואות · עלויות מימון · החזרים), כל אחת ושמה מתחתיה
// והסכום מעליה; ומעליהן קו החוב, פרוס לכל הרוחב — מהחוב בתחילת החודש (ימין) עד החוב בסופו (שמאל), והשיפוע מראה אם עלה או ירד ──
function monthIxHTML(m) {
  var f = flowOf(m), start = loanDebt(shiftMonth(m, -1)), end = f.debt, ch = end - start;
  var bars = [{ v: f.inc, cls: 'inc', lbl: 'הכנסות' }, { v: f.long + f.inst, cls: 'loan', lbl: 'הלוואות' },
              fin(f.interest, f.finance), { v: f.repaid, cls: 'rep', lbl: 'החזרים' }];
  var maxB = 1;
  bars.forEach(function (x) { maxB = Math.max(maxB, x.full > x.v ? x.full : x.v); });
  maxB *= 2.2; // העמודות בחצי התחתון, והקו מעליהן
  // הקו מראה כיוון: הנמוך מהשניים בגובה אחד והגבוה מעליו, כך שהשיפוע נראה גם בשינוי קטן; הסכומים עצמם — בתוויות
  var dv = function (v) { return start === end ? 0.78 : v === Math.max(start, end) ? 0.9 : 0.66; };
  var y = function (v) { return Math.round((1 - dv(v)) * 1000) / 10; };
  var cols = bars.map(function (x) {
    var tot = x.full > x.v ? x.full : x.v, h = hFr(tot, maxB);
    var bar = x.full > x.v
      ? '<span class="fl-bar ghost ' + x.cls + '" style="--v:' + h + '" title="' + esc('עלויות מימון ' + ils(x.full) + ' · היתר עסקה ' + ils(x.v)) + '"><span class="fl-solid" style="--s:' + hFr(x.v, x.full) + '"></span></span>'
      : '<span class="fl-bar ' + x.cls + '" style="--v:' + h + '" title="' + esc(x.lbl + ' ' + ils(x.v)) + '"></span>';
    return '<div class="ixm-c"><div class="ixm-p"><span class="fl-vals" style="--v:' + h + '"><b class="' + x.cls + '">' + esc(kShort(tot)) + '</b></span>' + bar + '</div>' +
      '<span class="ixm-l">' + esc(x.cls === 'int' ? 'עלויות מימון' : x.lbl) + '</span></div>';
  }).join('');
  var dot = function (v, side, lab) {
    return '<span class="ixm-dot ' + side + '" style="--v:' + dv(v) + '" title="' + esc(lab + ' ' + ils(v)) + '"><b>' + esc(kShort(v)) + '<small>' + esc(lab) + '</small></b></span>';
  };
  var head = '<div class="ix-head ' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '"><span class="ix-ic">' + icon(ch > 0 ? 'up' : 'down') + '</span><div><b>' +
    esc(ch > 0 ? 'החוב עלה החודש ב־' + ils(ch) : ch < 0 ? 'החוב ירד החודש ב־' + ils(-ch) : 'החוב לא השתנה החודש') +
    '</b><small>' + esc('מ־' + ils(start) + ' בתחילת החודש ל־' + ils(end) + ' בסופו') + '</small></div></div>';
  return '<section class="card ix ixm"><h2>מדד החוב — ' + esc(monthLabel(m)) + '</h2>' + head +
    '<div class="ixm-box"><div class="ixm-plot">' +
      '<div class="ixm-ov"><svg class="ixm-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="0,' + y(end) + ' 100,' + y(start) + '"/></svg>' +
      dot(start, 'r', 'תחילת החודש') + dot(end, 'l', 'סוף החודש') + '</div>' + cols + '</div></div>' +
    lg([['inc', 'הכנסות'], ['loan', 'הלוואות'], ['int', 'עלויות מימון'], ['rep', 'החזרים'], ['debt', 'החוב']]).replace('class="fl-legend"', 'class="fl-legend fl-legend-below"') + FIN_NOTE + '</section>';
}
// מדד החוב — החודש המוצג, ומתחתיו המדד לאורך התקופה
function flowHTML(m) {
  return monthIxHTML(m) + indicesHTML(flowMonths().map(flowOf));
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

  h += '<section class="card"><h2>משימות בעבודה</h2>' + tasksHTML() + '</section>';

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
