// app/screens/pledges.js — ההתחייבויות
import { dayToday } from '../../core/util.js';
import { pendTag } from '../../core/sync.js';
import { comboValue, esc, openModal, toast } from '../../core/ui.js';
import { MSG_AMOUNT_POSITIVE, MSG_EDIT_PLEDGE, MSG_NEW_PLEDGE,
         MSG_PICK_DONOR } from '../constants.js';
import { state } from '../state.js';
import { $, agentPool, collectedForPledge, datalistHTML, dmyDate, donorFieldHTML,
         donorName, emptyBox, ils, insert, nullable, num, pendRowKey, pledgeStatus,
         selectHTML, statusClass, sum, update, val } from '../domain.js';

// ── התחייבויות ──
function filteredPledges() {
  var f = state.pf;
  return state.pledges.filter(function (p) {
    if (f.agent && p.agent !== f.agent) return false;
    if (f.cause && p.cause !== f.cause) return false;
    if (f.status && pledgeStatus(p) !== f.status) return false;
    if (f.from && (!p.due_date || p.due_date < f.from)) return false;
    if (f.to && (!p.due_date || p.due_date > f.to)) return false;
    return true;
  });
}

function pledgeTableHTML(list) {
  if (!list.length) return emptyBox('🤝', state.pledges.length ? 'אין התחייבות התואמת את המסננים' : 'עדיין אין התחייבויות');
  var h = '<div class="tw"><table><thead><tr><th>תורם</th><th>עילה</th><th>שגריר</th>' +
    '<th class="num">סכום</th><th class="num">נגבה</th><th class="num">נותר</th>' +
    '<th>תאריך יעד</th><th>סטטוס</th><th></th></tr></thead><tbody>';
  list.forEach(function (p) {
    var c = collectedForPledge(p.client_id), st = pledgeStatus(p);
    var late = p.due_date && p.due_date < dayToday() && st !== 'בוצע';
    h += '<tr class="click" data-act="donor-open" data-id="' + p.donor_client_id + '">' +
      '<td><b>' + esc(donorName(p.donor_client_id)) + '</b>' + pendTag(pendRowKey('g_pledges', p.client_id)) + '</td>' +
      '<td>' + esc(p.cause || '—') + '</td>' +
      '<td>' + esc(p.agent || '—') + '</td>' +
      '<td class="num">' + ils(p.amount) + '</td>' +
      '<td class="num">' + ils(c) + '</td>' +
      '<td class="num">' + ils(Math.max(0, num(p.amount) - c)) + '</td>' +
      '<td>' + (late ? '<span class="badge bad">' + esc(dmyDate(p.due_date)) + '</span>' : esc(dmyDate(p.due_date))) + '</td>' +
      '<td><span class="badge ' + statusClass(st) + '">' + st + '</span></td>' +
      '<td><button class="btn ghost xs" data-act="pledge-edit" data-id="' + p.client_id + '">עריכה</button> ' +
        '<button class="btn danger xs" data-act="pledge-del" data-id="' + p.client_id + '">מחיקה</button></td></tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

function pledgeTotalsHTML(list) {
  var pledged = sum(list, function (p) { return p.amount; });
  var got = sum(list, function (p) { return collectedForPledge(p.client_id); });
  return '<div class="stats-2 hero-stats">' +
    '<div class="stat"><span>סה"כ התחייבויות</span><b>' + ils(pledged) + '</b></div>' +
    '<div class="stat ok"><span>נגבה</span><b>' + ils(got) + '</b></div>' +
    '<div class="stat warn"><span>נותר</span><b>' + ils(Math.max(0, pledged - got)) + '</b></div>' +
    '<div class="stat"><span>מספר התחייבויות</span><b>' + list.length + '</b></div>' +
  '</div>';
}

function viewPledges() {
  var list = filteredPledges();
  var f = state.pf;
  return '<section class="card">' +
    '<h2>🤝 התחייבויות<span class="cnt">' + list.length + '</span>' +
      '<span class="sp"><button class="btn sm" data-act="pledge-new">＋ התחייבות</button></span></h2>' +
    '<div id="pledge-totals">' + pledgeTotalsHTML(list) + '</div>' +
    '<div class="filters-row filters">' +
      '<label class="fld"><span>שגריר</span>' + selectHTML('pf-agent', agentPool(), f.agent, 'הכל', 'pf-agent') + '</label>' +
      '<label class="fld"><span>סטטוס</span>' + selectHTML('pf-status', ['לא בוצע', 'חלקי', 'בוצע'], f.status, 'הכל', 'pf-status') + '</label>' +
      '<label class="fld"><span>עילה</span>' + selectHTML('pf-cause', state.config.causes, f.cause, 'הכל', 'pf-cause') + '</label>' +
      '<label class="fld"><span>מתאריך</span><input class="inp" type="date" id="pf-from" data-chg="pf-from" value="' + esc(f.from) + '"></label>' +
      '<label class="fld"><span>עד תאריך</span><input class="inp" type="date" id="pf-to" data-chg="pf-to" value="' + esc(f.to) + '"></label>' +
    '</div>' +
    '<div class="btnrow-top btnrow">' +
      '<button class="btn ghost sm" data-act="pf-clear">ניקוי מסננים</button></div>' +
    '<div id="pledge-table">' + pledgeTableHTML(list) + '</div>' +
  '</section>';
}

// רינדור חלקי ולא render() — רינדור מלא בונה מחדש את המסננים ומאבד את הפוקוס והבורר הפתוח.
function refreshPledges() {
  var list = filteredPledges();
  var t = $('#pledge-table'), o = $('#pledge-totals');
  if (t) t.innerHTML = pledgeTableHTML(list);
  if (o) o.innerHTML = pledgeTotalsHTML(list);
}

function formPledge(existing, presetDonor) {
  var p = existing || {};
  var body =
    '<label class="fld"><span>תורם *</span></label>' + donorFieldHTML('pl-donor', 'donor', p.donor_client_id || presetDonor || '') +
    '<div class="f2-gap f2">' +
      '<label class="fld"><span>סכום *</span><input class="inp" id="pl-amount" inputmode="decimal" value="' + esc(p.amount != null ? num(p.amount) : '') + '"></label>' +
      '<label class="fld"><span>תאריך יעד</span><input class="inp" type="date" id="pl-due" value="' + esc(p.due_date || '') + '"></label>' +
    '</div>' +
    '<div class="f2">' +
      '<label class="fld"><span>עילה</span>' + selectHTML('pl-cause', state.config.causes, p.cause, '— ללא עילה —') + '</label>' +
      '<label class="fld"><span>שגריר</span><input class="inp" id="pl-agent" list="dl-agents" value="' + esc(p.agent || (p.client_id ? '' : state.user.full_name)) + '"></label>' +
    '</div>' +
    '<label class="fld"><span>הערה</span><textarea class="inp" id="pl-note">' + esc(p.note || '') + '</textarea></label>' +
    (state.config.causes.length ? '' :
      '<div class="note">אין עדיין עילות. אפשר להוסיף אותן במסך ההגדרות.</div>') +
    datalistHTML('dl-agents', agentPool());

  var foot = '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (p.client_id ? '<button class="btn danger" data-act="pledge-del" data-id="' + p.client_id + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="pledge-save" data-ksave data-id="' + (p.client_id || '') + '">שמירה</button>';

  openModal(p.client_id ? MSG_EDIT_PLEDGE : MSG_NEW_PLEDGE, body, foot);
}

function savePledge(id) {
  var donorId = comboValue('pl-donor');
  if (!donorId) { toast(MSG_PICK_DONOR, null, 'bad'); return Promise.resolve(); }
  var amount = num(val('pl-amount'));
  if (!(amount > 0)) { toast(MSG_AMOUNT_POSITIVE, null, 'bad'); return Promise.resolve(); }
  var row = {
    donor_client_id: donorId,
    amount: amount,
    cause: nullable(val('pl-cause')),
    agent: nullable(val('pl-agent')),
    due_date: nullable(val('pl-due')),
    note: nullable(val('pl-note'))
  };
  return id ? update('g_pledges', id, row) : insert('g_pledges', row);
}

export { formPledge, refreshPledges, savePledge, viewPledges };
