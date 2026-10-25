// app/screens/dash.js — לוח הבקרה: קריאה בלבד, והכל נגזר מהתשלומים
import { esc } from '../../core/ui.js';
import { bar } from '../../core/chart.js';
import { pendTag } from '../../core/sync.js';
import { ASSIGNEES, STAGES } from '../constants.js';
import { state } from '../state.js';
import { donorName, emptyBox, gSortGroups, gSortTxns, ils, initials, monthLabel, monthTxnsInit, num,
         pendRowKey, pledgeById, sum, targetFor, txnWhen } from '../domain.js';

// הסף בהודעת המומנטום הוא «גדול או שווה» — «גדול» משנה בשקט את ההודעה בקצה הטווח.
function momentumMsg(pct) {
  if (pct >= 100) return '🏆 עמדנו ביעד!';
  if (pct >= 75) return '⚡ כמעט שם — דחיפה אחרונה!';
  if (pct >= 50) return '🔥 מעל המחצית — ממשיכים!';
  if (pct >= 25) return '💪 רבע דרך — מומנטום!';
  return '🚀 מתחילים!';
}

function ringHTML(pct) {
  var R = 52, C = 2 * Math.PI * R;
  var dash = C * Math.max(0, Math.min(100, pct)) / 100;
  return '<div class="ring-wrap">' +
    '<svg class="ring" viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle class="bg" cx="60" cy="60" r="' + R + '"></circle>' +
      '<circle class="fg" cx="60" cy="60" r="' + R + '" stroke-dasharray="' + dash.toFixed(1) + ' ' + C.toFixed(1) + '"></circle>' +
    '</svg>' +
    '<div class="ring-val"><b>' + Math.round(pct) + '%</b><span>מהיעד</span></div>' +
  '</div>';
}

// הסעיף והשגריר של תשלום — מההתחייבות שהוא נזקף אליה; התשלום עצמו אינו נושא אותם.
function groupBy(list, pick, fallback) {
  var map = {}, order = [];
  list.forEach(function (t) {
    var k = String(pick(t) || '').trim() || fallback;
    if (!map[k]) { map[k] = { key: k, total: 0, count: 0 }; order.push(k); }
    map[k].total += num(t.amount);
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
      '<b>' + esc(who) + '</b>' +
      '<span class="who-total">' + mine.length + '<small>משימות</small></span>' +
      '<span class="who-stages">' + STAGES.slice(0, 2).map(function (s) {
        return '<span class="pill ' + s.cls + '">' + esc(s.id) + ' · ' + cnt(s.id) + '</span>';
      }).join('') + '</span></button>';
  }).join('') + '</div>';
}

function viewDash() {
  var m = state.month;
  var txns = monthTxnsInit(m);
  var collected = sum(txns, function (t) { return t.amount; });
  var target = targetFor(m);
  var remaining = Math.max(0, target - collected);
  var pct = target > 0 ? collected / target * 100 : 0;

  var h = '<section class="card">' +
    '<div class="monthnav">' +
      '<button class="btn ghost sm" data-act="month" data-d="-1" aria-label="חודש קודם">›</button>' +
      '<b>' + esc(monthLabel(m)) + '</b>' +
      '<button class="btn ghost sm" data-act="month" data-d="1" aria-label="חודש הבא">‹</button>' +
    '</div>' +
    '<div class="hero">' + ringHTML(pct) +
      '<div class="hero-stats">' +
        '<div class="stat"><span>יעד החודש</span><b>' + (target > 0 ? ils(target) : '— לא הוגדר —') + '</b></div>' +
        '<div class="stat ok"><span>נגבה</span><b>' + ils(collected) + '</b></div>' +
        '<div class="stat warn"><span>נותר</span><b>' + (target > 0 ? ils(remaining) : '—') + '</b></div>' +
        '<div class="stat"><span>תשלומים</span><b>' + txns.length + '</b></div>' +
      '</div>' +
    '</div>' +
    '<div class="momentum">' + momentumMsg(target > 0 ? pct : 0) + '</div>' +
  '</section>';

  h += '<div class="grid2">' +
    '<section class="card"><h2>פילוח לפי סעיף</h2>' +
      breakdownHTML(groupBy(txns, function (t) { return pledgeField(t, 'section'); }, 'ללא סעיף'), collected) +
    '</section>' +
    '<section class="card"><h2>פילוח לפי שגריר</h2>' +
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
        (t.method ? ' · ' + esc(t.method) : '') + (t.cleared ? '' : ' · טרם נסלק') + '</small></div>' +
      '<div class="end">' + ils(t.amount) + '</div></div>';
  }).join('');
  if (list.length > 3) h += '<button class="btn ghost pay-more" data-act="dash-pay-all" aria-expanded="' + (state.dashPayAll ? 'true' : 'false') + '">' +
    (state.dashPayAll ? 'הצג פחות ▴' : 'הצג את כל ' + list.length + ' התשלומים ▾') + '</button>';
  h += '</section>';
  return h;
}

export { viewDash };
