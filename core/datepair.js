// core/datepair.js — בורר התאריך הכפול: שני בוררים לאותו יום, בצורה אחת — לועזי ועברי. גוף אחד בכל האפליקציות.
// כפתור בצורת השדה, ובלחיצה שלושה גלגלים (יום · חודש · שנה), זהים בטלפון ובמחשב — ולא בורר המערכת, שנראה אחרת בכל מכשיר.
// הערך שנשמר — <px>-date, השדה הנסתר, ב-ISO; גלגל שנעצר מעדכן את שני הכפתורים. אייקון הלוח — מהסט של האפליקציה (shellIcon('date')).
import { dayIso, dayNoon, dayToday } from './util.js';
import { esc } from './ui.js';
import { shellIcon } from './icons.js';
import { hebDate, hebDayLabel, hebIsLeap, hebMonthNames, hebToGreg, hebYearInfo, hebYearLabelFull } from './hebrew.js';

var DP_H = 40;
var DP_YEARS = { g: [1900, 2100], h: [5660, 5860] };
var GREG_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
var MSG_DP = { greg: 'תאריך לועזי', heb: 'תאריך עברי', pick: 'בחירה', clear: 'ניקוי התאריך' };

function $(s) { return document.querySelector(s); }
function hebOf(iso) {
  var h;
  if (!iso) return null;
  try { h = hebDate(dayNoon(String(iso))); } catch (e) { return null; }
  return (h && h.ok) ? h : null;
}
function gregFull(iso) {
  var d = iso ? dayNoon(iso) : null;
  return d ? d.getDate() + ' ב' + GREG_MONTHS[d.getMonth()] + ' ' + d.getFullYear() : '';
}
function hebFull(iso) {
  var h = hebOf(iso);
  return h ? hebDayLabel(h.day) + ' ' + h.monthName + ' ' + hebYearLabelFull(h.year) : '';
}

// opts.empty — מותר בלי תאריך (הכפתורים מציגים «בחירה», והגלגלים נפתחים ב-opts.start או היום); opts.clear — ✕ שמרוקן
// opts.labels — [לועזי, עברי]; ובלי — «תאריך לועזי» · «תאריך עברי»
function datePairHTML(px, iso, opts) {
  opts = opts || {};
  var lab = opts.labels || [MSG_DP.greg, MSG_DP.heb];
  return '<input type="hidden" id="' + px + '-date" value="' + esc(iso || '') + '"' + (opts.start ? ' data-start="' + esc(opts.start) + '"' : '') + '>' +
    dpFieldHTML(px, 'g', lab[0], iso ? gregFull(iso) : '', opts) + dpFieldHTML(px, 'h', lab[1], iso ? hebFull(iso) : '', opts);
}
function dpFieldHTML(px, cal, lab, txt, opts) {
  return '<div class="fld dp-fld"><label for="' + px + '-' + cal + 'btn">' + esc(lab) + '</label>' +
    '<div class="dp-row"><button type="button" class="dp-trg" id="' + px + '-' + cal + 'btn" data-act="dp-open" data-px="' + px + '" data-cal="' + cal + '">' +
    '<span id="' + px + '-' + cal + 'lbl"' + (txt ? '' : ' class="dp-ph"') + '>' + esc(txt || MSG_DP.pick) + '</span>' + shellIcon('date') + '</button>' +
    (opts.clear && cal === 'h' ? '<button type="button" class="dp-clr" data-act="dp-clear" data-px="' + px + '" aria-label="' + MSG_DP.clear + '"' + (txt ? '' : ' hidden') + '>' + shellIcon('close') + '</button>' : '') +
    '</div><div class="dp-pop" id="' + px + '-' + cal + 'pop" hidden></div></div>';
}

// העמודות של לוח אחד ביום הנבחר — [תוויות, אינדקס הנבחר] לכל גלגל, מימין לשמאל: יום · חודש · שנה.
function dpCols(cal, iso) {
  var i, days = [], years = [], r = DP_YEARS[cal], d, h, info;
  if (cal === 'g') {
    d = dayNoon(iso);
    for (i = 1; i <= new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); i++) days.push(String(i));
    for (i = r[0]; i <= r[1]; i++) years.push(String(i));
    return { y: d.getFullYear(), cols: [[days, d.getDate() - 1], [GREG_MONTHS, d.getMonth()], [years, d.getFullYear() - r[0]]] };
  }
  h = hebOf(iso); info = hebYearInfo(h.year);
  for (i = 1; i <= info.ml[h.monthIndex]; i++) days.push(hebDayLabel(i));
  for (i = r[0]; i <= r[1]; i++) years.push(hebYearLabelFull(i));
  return { y: h.year, cols: [[days, h.day - 1], [hebMonthNames(h.year), h.monthIndex], [years, h.year - r[0]]] };
}
function dpIso(px) {
  var inp = $('#' + px + '-date');
  return (inp && inp.value) || (inp && inp.dataset.start) || dayToday();
}
function dpDraw(px, cal) {
  var pop = $('#' + px + '-' + cal + 'pop'), iso = dpIso(px), c, cols;
  if (!pop) return;
  c = dpCols(cal, iso);
  pop.dataset.y = c.y;
  pop.innerHTML = c.cols.map(function (col, k) {
    return '<div class="dp-col" data-dpcol="' + k + '" data-px="' + px + '" data-cal="' + cal + '"><div class="dp-pad"></div>' +
      col[0].map(function (t, n) {
        return '<div class="dp-it' + (n === col[1] ? ' on' : '') + '" data-act="dp-pick" data-n="' + n + '">' + esc(t) + '</div>';
      }).join('') + '<div class="dp-pad"></div></div>';
  }).join('');
  cols = pop.querySelectorAll('.dp-col');
  c.cols.forEach(function (col, k) { cols[k].scrollTop = col[1] * DP_H; });
}

// לחיצה פותחת את הבורר וסוגרת את השני; לחיצה שנייה סוגרת.
function dpOpen(el) {
  var px = el.dataset.px, cal = el.dataset.cal, pop = $('#' + px + '-' + cal + 'pop'), other = $('#' + px + '-' + (cal === 'g' ? 'h' : 'g') + 'pop');
  if (!pop) return;
  if (other) other.hidden = true;
  if (!pop.hidden) { pop.hidden = true; return; }
  pop.hidden = false;
  dpDraw(px, cal);
}
function dpPick(el) {
  var col = el.closest('.dp-col');
  if (col) col.scrollTo({ top: (+el.dataset.n) * DP_H, behavior: 'smooth' });
}
function dpSet(px, iso) {
  var inp = $('#' + px + '-date'), clr = document.querySelector('[data-act="dp-clear"][data-px="' + px + '"]');
  if (!inp) return;
  inp.value = iso || '';
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  ['g', 'h'].forEach(function (cal) {
    var l = $('#' + px + '-' + cal + 'lbl');
    if (!l) return;
    l.textContent = iso ? (cal === 'g' ? gregFull(iso) : hebFull(iso)) : MSG_DP.pick;
    l.classList.toggle('dp-ph', !iso);
  });
  if (clr) clr.hidden = !iso;
}
function dpClear(el) {
  var px = el.dataset.px;
  dpSet(px, '');
  ['g', 'h'].forEach(function (cal) { var p = $('#' + px + '-' + cal + 'pop'); if (p) p.hidden = true; });
}

// הגלגל נעצר — היום נבנה משלושת הגלגלים; יום שאינו בחודש וחודש שאינו בשנה נעצרים באחרון שקיים.
var _dpT = {};
function dpScroll(e) {
  var col = e.target && e.target.closest ? e.target.closest('[data-dpcol]') : null, key;
  if (!col) return;
  key = col.dataset.px + col.dataset.cal + col.dataset.dpcol;
  clearTimeout(_dpT[key]);
  _dpT[key] = setTimeout(function () { dpSettle(col); }, 140);
}
function dpSettle(col) {
  var px = col.dataset.px, cal = col.dataset.cal, pop = col.parentElement, cols = pop.querySelectorAll('.dp-col');
  var n = [0, 1, 2].map(function (k) { return Math.round(cols[k].scrollTop / DP_H); });
  var r = DP_YEARS[cal], y = r[0] + n[2], m = n[1], d = n[0] + 1, py = +pop.dataset.y, info, g, iso, inp = $('#' + px + '-date');
  if (cal === 'g') {
    d = Math.min(d, new Date(y, m + 1, 0).getDate());
    iso = dayIso(dayNoon(y, m, d));
  } else {
    // מעבר בין שנה רגילה למעוברת — אדר נשאר אדר, והחודשים שאחריו נשארים בשמם.
    if (hebIsLeap(py) && !hebIsLeap(y) && m >= 6) m -= 1;
    else if (!hebIsLeap(py) && hebIsLeap(y) && m >= 5) m += 1;
    info = hebYearInfo(y);
    if (!info) return;
    m = Math.min(m, info.ml.length - 1); d = Math.min(d, info.ml[m]);
    g = hebToGreg(y, m, d);
    if (!g) return;
    iso = dayIso(g);
  }
  if (!inp || inp.value === iso) return;
  dpSet(px, iso);
  dpDraw(px, cal);
}

// מפת הפעולות — האפליקציה פורשת אותה לתוך DOM_ACTIONS שלה; והגלילה נקלטת פעם אחת, בכל המסמך
var DATEPAIR_ACTIONS = { 'dp-open': dpOpen, 'dp-pick': dpPick, 'dp-clear': dpClear };
document.addEventListener('scroll', dpScroll, true);

export { DATEPAIR_ACTIONS, GREG_MONTHS, datePairHTML, dpSet, gregFull, hebFull };
