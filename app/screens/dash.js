// app/screens/dash.js — לוח הבקרה: קריאה בלבד, והכל נגזר מהתשלומים
import { esc } from '../../core/ui.js';
import { bar } from '../../core/chart.js';
import { pendTag } from '../../core/sync.js';
import { ASSIGNEES, STAGES } from '../constants.js';
import { state } from '../state.js';
import { donorName, emptyBox, gSortGroups, gSortTxns, ils, initials, monthAmount, monthLabel, monthTxnsInit,
         pendRowKey, pledgeById, sum, targetFor, txnSoLabel, txnWhen } from '../domain.js';

// הסף בהודעת המומנטום הוא «גדול או שווה» — «גדול» משנה בשקט את ההודעה בקצה הטווח.
function momentumMsg(pct) {
  if (pct >= 100) return '🏆 עמדנו ביעד!';
  if (pct >= 75) return '⚡ כמעט שם — דחיפה אחרונה!';
  if (pct >= 50) return '🔥 מעל המחצית — ממשיכים!';
  if (pct >= 25) return '💪 רבע דרך — מומנטום!';
  return '🚀 מתחילים!';
}

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

function breakdownHTML(rows, total) {
  if (!rows.length) return emptyBox('📊', 'אין תשלומים בחודש זה');
  return '<div class="brk">' + rows.map(function (r) {
    var share = total > 0 ? r.total / total * 100 : 0;
    return '<div class="brk-row"><span class="brk-lab">' + esc(r.key) + '<small>' + r.count + ' תשלומים</small></span>' +
      '<span class="brk-bar">' + bar(share.toFixed(1)) + '</span>' +
      '<span class="brk-val">' + ils(r.total) + '<small>' + share.toFixed(0) + '%</small></span></div>';
  }).join('') + '</div>';
}

// מצב המשימות לכל אחראי — סה״כ פתוחות, ובהרצה ובהשלמה; מנותב למסך המשימות.
function tasksHTML() {
  return '<div class="who-grid">' + ASSIGNEES.map(function (who) {
    var mine = state.tasks.filter(function (t) { return t.assignee === who; });
    var cnt = function (st) { return mine.filter(function (t) { return t.stage === st; }).length; };
    return '<button class="who-card" data-act="dash-who" data-who="' + esc(who) + '">' +
      '<span class="who-main"><b>' + esc(who) + '</b>' +
        '<span class="who-stages">' + STAGES.slice(0, 2).map(function (s) {
          return '<span class="pill ' + s.cls + '">' + esc(s.id) + ' · ' + cnt(s.id) + '</span>';
        }).join('') + '</span></span>' +
      '<span class="who-total" aria-label="' + mine.length + ' משימות">' + mine.length + '</span></button>';
  }).join('') + '</div>';
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
      '<button class="btn ghost sm" data-act="month" data-d="-1" aria-label="חודש קודם">›</button>' +
      '<b>' + esc(monthLabel(m)) + '</b>' +
      '<button class="btn ghost sm" data-act="month" data-d="1" aria-label="חודש הבא">‹</button>' +
    '</div>' +
    '<div class="gauge-row">' + gaugeHTML(collected, target > 0 ? pct : 0) +
      '<dl class="g-list">' +
        '<div><dt>אחוזים</dt><dd>' + (target > 0 ? Math.round(pct) + '%' : '—') + '</dd></div>' +
        '<div><dt>יעד</dt><dd>' + (target > 0 ? ils(target) : 'לא הוגדר') + '</dd></div>' +
        '<div><dt>סכום שנותר</dt><dd>' + (target > 0 ? ils(remaining) : '—') + '</dd></div>' +
        '<div><dt>מספר תשלומים</dt><dd>' + txns.length + '</dd></div>' +
      '</dl>' +
    '</div>' +
    '<div class="momentum">' + momentumMsg(target > 0 ? pct : 0) + '</div>' +
  '</section>';

  h += '<div class="grid2">' +
    '<section class="card"><h2>פילוח סעיפים</h2>' +
      breakdownHTML(groupBy(txns, function (t) { return pledgeField(t, 'section'); }, 'ללא סעיף'), collected) +
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
  if (!list.length) h += emptyBox('💰', 'אין תשלומים בחודש זה');
  else h += shown.map(function (t) {
    var p = pledgeById(t.pledge_client_id), nm = donorName(t.donor_client_id);
    return '<div class="row' + (t.cleared ? '' : ' uncleared') + '" data-act="card-go" data-id="' + esc(t.donor_client_id) + '">' +
      '<span class="av">' + esc(initials(nm)) + '</span>' +
      '<div class="main"><b>' + esc(nm) + pendTag(pendRowKey('g_txns', t.client_id)) + '</b>' +
      '<small>' + esc(txnWhen(t)) + ' · ' + esc((p && (p.pledge_type || p.section)) || '—') +
        (t.method ? ' · ' + esc(t.method) : '') + (txnSoLabel(t) ? ' · ' + esc(txnSoLabel(t)) : '') +
        (t.cleared ? '' : ' · טרם נסלק') + '</small></div>' +
      '<div class="end">' + ils(monthAmount(t)) + '</div></div>';
  }).join('');
  if (list.length > 3) h += '<button class="btn ghost pay-more" data-act="dash-pay-all" aria-expanded="' + (state.dashPayAll ? 'true' : 'false') + '">' +
    (state.dashPayAll ? 'הצג פחות ▴' : 'הצג את כל ' + list.length + ' התשלומים ▾') + '</button>';
  h += '</section>';
  return h;
}

export { viewDash };
