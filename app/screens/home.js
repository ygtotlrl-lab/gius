// app/screens/home.js — מסך הבית
import { dayToday } from '../../core/util.js';
import { isAdmin } from '../../core/auth.js';
import { esc } from '../../core/ui.js';
import { bar } from '../../core/chart.js';
import { EPS } from '../constants.js';
import { state } from '../state.js';
import { collectedForPledge, dmyDate, donorName, emptyBox, gSortGroups, ils, monthLabel, monthTxns,
         num, sum, targetFor } from '../domain.js';

// ── מסך הבית ──
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
    '<svg class="ring" viewBox="0 0 120 120">' +
      '<circle class="bg" cx="60" cy="60" r="' + R + '"></circle>' +
      '<circle class="fg" cx="60" cy="60" r="' + R + '" stroke-dasharray="' + dash.toFixed(1) + ' ' + C.toFixed(1) + '"></circle>' +
    '</svg>' +
    '<div class="ring-val"><b>' + Math.round(pct) + '%</b><span>מהיעד</span></div>' +
  '</div>';
}

function breakdownTable(rows, label, total) {
  if (!rows.length) return emptyBox('📊', 'אין תנועות בחודש זה');
  var h = '<div class="tw"><table><thead><tr><th>' + esc(label) + '</th><th class="num">תנועות</th>' +
    '<th class="num">סכום</th><th class="num">חלק</th></tr></thead><tbody>';
  rows.forEach(function (r) {
    var share = total > 0 ? (r.total / total * 100) : 0;
    h += '<tr><td>' + esc(r.key) + '</td>' +
      '<td class="num">' + r.count + '</td>' +
      '<td class="num">' + ils(r.total) + '</td>' +
      '<td class="share-cell num">' + bar(share.toFixed(1)) +
      '<small class="share-pct">' + share.toFixed(0) + '%</small></td></tr>';
  });
  h += '</tbody><tfoot><tr><td>סה"כ</td><td class="num">' + sum(rows, function (r) { return r.count; }) +
    '</td><td class="num">' + ils(total) + '</td><td></td></tr></tfoot></table></div>';
  return h;
}

function groupBy(list, pick, fallback) {
  var map = {}, order = [];
  list.forEach(function (item) {
    var k = String(pick(item) || '').trim() || fallback;
    if (!map[k]) { map[k] = { key: k, total: 0, count: 0 }; order.push(k); }
    map[k].total += num(item.amount);
    map[k].count++;
  });
  return gSortGroups(order.map(function (k) { return map[k]; }));
}

function viewHome() {
  var m = state.month;
  var txns = monthTxns(m);
  var collected = sum(txns, function (t) { return t.amount; });
  var target = targetFor(m);
  var remaining = Math.max(0, target - collected);
  var pct = target > 0 ? (collected / target * 100) : 0;

  var h = '';

  // ── מצב החודש ──
  h += '<section class="card">' +
    '<div class="monthnav">' +
      '<button class="btn ghost sm" data-act="month" data-d="-1" aria-label="חודש קודם">›</button>' +
      '<b>' + esc(monthLabel(m)) + '</b>' +
      '<button class="btn ghost sm" data-act="month" data-d="1" aria-label="חודש הבא">‹</button>' +
      '<span class="grow"></span>' +
      (isAdmin() ? '<button class="btn soft sm" data-act="target-set" data-month="' + m + '">קביעת יעד</button>' : '') +
    '</div>' +
    '<div class="hero">' + ringHTML(pct) +
      '<div class="hero-stats">' +
        '<div class="stat"><span>יעד החודש</span><b>' + (target > 0 ? ils(target) : '— לא הוגדר —') + '</b></div>' +
        '<div class="stat ok"><span>נגבה</span><b>' + ils(collected) + '</b></div>' +
        '<div class="stat warn"><span>נותר</span><b>' + (target > 0 ? ils(remaining) : '—') + '</b></div>' +
        '<div class="stat"><span>תנועות</span><b>' + txns.length + '</b></div>' +
      '</div>' +
    '</div>' +
    '<div class="momentum">' + momentumMsg(target > 0 ? pct : 0) + '</div>' +
  '</section>';

  // ── פילוחים ──
  h += '<div class="grid2">' +
    '<section class="card"><h2>📊 פילוח לפי סעיף</h2>' +
      breakdownTable(groupBy(txns, function (t) { return t.category; }, 'ללא סעיף'), 'סעיף', collected) +
    '</section>' +
    '<section class="card"><h2>🎖️ פילוח לפי שגריר</h2>' +
      breakdownTable(groupBy(txns, function (t) { return t.agent; }, 'ללא שגריר'), 'שגריר', collected) +
    '</section>' +
  '</div>';

  // ── היום שלי ──
  var me = state.user.full_name;
  var myTasks = state.tasks.filter(function (t) { return t.assignee === me && t.stage !== 'השלמה'; });
  var myPledges = state.pledges.filter(function (p) {
    return p.agent === me && collectedForPledge(p.client_id) + EPS < num(p.amount);
  });

  h += '<section class="card"><h2>☀️ מה שלי היום<span class="cnt">' + (myTasks.length + myPledges.length) + '</span></h2>';
  if (!myTasks.length && !myPledges.length) {
    h += emptyBox('✨', 'אין משימות פתוחות או התחייבויות ממתינות על שמך');
  } else {
    if (myTasks.length) {
      h += '<div class="today-head">משימות פתוחות</div>';
      myTasks.forEach(function (t) {
        var late = t.due_date && t.due_date < dayToday();
        h += '<div class="row" data-act="task-open" data-id="' + t.client_id + '">' +
          '<div class="av">🗂️</div><div class="main"><b>' + esc(t.title) + '</b>' +
          '<small>' + esc(t.domain || 'ללא תחום') + ' · ' + esc(t.stage) + '</small></div>' +
          '<div class="end"><span class="badge ' + (late ? 'bad' : '') + '">' + esc(dmyDate(t.due_date)) + '</span></div></div>';
      });
    }
    if (myPledges.length) {
      h += '<div class="today-head-next">התחייבויות שטרם נגבו במלואן</div>';
      myPledges.forEach(function (p) {
        var c = collectedForPledge(p.client_id);
        var left = Math.max(0, num(p.amount) - c);
        h += '<div class="row" data-act="donor-open" data-id="' + p.donor_client_id + '">' +
          '<div class="av">🤝</div><div class="main"><b>' + esc(donorName(p.donor_client_id)) + '</b>' +
          '<small>' + esc(p.cause || 'ללא עילה') + ' · ' + ils(p.amount) + '</small></div>' +
          '<div class="end">' + ils(left) + '<small>נותר</small></div></div>';
      });
    }
  }
  h += '</section>';
  return h;
}

export { viewHome };
