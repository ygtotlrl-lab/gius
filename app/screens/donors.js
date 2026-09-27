// app/screens/donors.js — התורמים, כרטיס התורם והתנועות
import { dayToday } from '../../core/util.js';
import { pendTag } from '../../core/sync.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { barChart } from '../../core/chart.js';
import { state } from '../state.js';
import { MSG_AMOUNT_POSITIVE, MSG_EDIT_DONOR, MSG_EDIT_TXN, MSG_NEED_NAME,
         MSG_NEW_DONOR, MSG_NEW_TXN, MSG_PICK_DONOR } from '../config.js';
import { $, agentPool, byName, checked, collectedForPledge, datalistHTML, dmyDate,
         donorById, emptyBox, ils, initials, insert, monthLabel, monthTxns, nullable,
         num, pendRowKey, pickerHTML, pickerValue, pledgeOptionsFor, pledgeStatus,
         pledgesOfDonor, selectHTML, statusClass, sum, txnsOfDonor, update, val } from '../domain.js';
import { HE } from '../main.js';

// ── תורמים ──
function donorMatches(q) {
  q = String(q || '').trim().toLowerCase();
  var list = state.donors.slice().sort(byName);
  if (!q) return list;
  return list.filter(function (d) {
    return String(d.name || '').toLowerCase().indexOf(q) >= 0 ||
      String(d.phone || '').indexOf(q) >= 0 ||
      String(d.agent || '').toLowerCase().indexOf(q) >= 0;
  });
}

function donorRowsHTML(list) {
  if (!list.length) return emptyBox('🙋', state.donors.length ? 'אין תורם התואם את החיפוש' : 'עדיין אין תורמים');
  return list.map(function (d) {
    var given = sum(txnsOfDonor(d.client_id), function (t) { return t.amount; });
    return '<div class="row" data-act="donor-open" data-id="' + d.client_id + '">' +
      '<div class="av' + (d.is_vip ? ' vip' : '') + '">' + esc(initials(d.name)) + '</div>' +
      '<div class="main"><b>' + esc(d.name) + (d.is_vip ? ' <span class="badge gold">VIP</span>' : '') + pendTag(pendRowKey('g_donors', d.client_id)) + '</b>' +
      '<small>' + esc(d.phone || 'ללא טלפון') + (d.agent ? ' · ' + esc(d.agent) : '') + '</small></div>' +
      '<div class="end">' + ils(given) + '<small>נתן</small></div></div>';
  }).join('');
}

function viewDonors() {
  var list = donorMatches(state.donorSearch);
  return '<section class="card">' +
    '<div class="search-row addrow">' +
      '<input aria-label="חיפוש לפי שם, טלפון או שגריר" class="inp" id="donor-q" data-inp="donor-q" placeholder="חיפוש לפי שם, טלפון או שגריר…" value="' + esc(state.donorSearch) + '">' +
      '<button class="btn" data-act="donor-new">＋ תורם</button>' +
    '</div>' +
    '<h2>🙋 תורמים<span class="cnt">' + list.length + '</span></h2>' +
    '<div id="donor-list">' + donorRowsHTML(list) + '</div>' +
  '</section>';
}

function viewDonorCard() {
  var d = donorById(state.donorId);
  if (!d) { state.donorId = null; return viewDonors(); }

  var pl = pledgesOfDonor(d.client_id);
  var tx = txnsOfDonor(d.client_id).slice().sort(function (a, b) { return HE.compare(b.txn_date, a.txn_date); });
  var pledged = sum(pl, function (p) { return p.amount; });
  var given = sum(tx, function (t) { return t.amount; });
  var left = Math.max(0, pledged - given);

  var h = '<button class="back" data-act="donor-back">› חזרה לרשימת התורמים</button>';

  h += '<section class="card">' +
    '<div class="donor-head">' +
      '<div class="donor-av av' + (d.is_vip ? ' vip' : '') + '">' +
        esc(initials(d.name)) + '</div>' +
      '<div class="donor-id"><h2 class="donor-name">' + esc(d.name) +
        (d.is_vip ? ' <span class="badge gold">VIP</span>' : '') + '</h2>' +
        '<div class="donor-phone">' + esc(d.phone || 'ללא טלפון') + '</div></div>' +
    '</div>' +
    '<div class="btnrow-top btnrow">' +
      '<button class="btn sm" data-act="donor-edit" data-id="' + d.client_id + '">עריכה</button>' +
      '<button class="btn soft sm" data-act="vip-toggle" data-id="' + d.client_id + '">' +
        (d.is_vip ? '☆ הסרת VIP' : '★ סימון VIP') + '</button>' +
      '<button class="btn ghost sm" data-act="txn-new" data-donor="' + d.client_id + '">＋ תנועה</button>' +
      '<button class="btn ghost sm" data-act="pledge-new" data-donor="' + d.client_id + '">＋ התחייבות</button>' +
      '<button class="btn danger sm" data-act="donor-del" data-id="' + d.client_id + '">מחיקה</button>' +
    '</div>' +
    '<div class="stats-3 hero-stats">' +
      '<div class="stat"><span>סה"כ התחייב</span><b>' + ils(pledged) + '</b></div>' +
      '<div class="stat ok"><span>סה"כ נתן</span><b>' + ils(given) + '</b></div>' +
      '<div class="stat warn"><span>נותר</span><b>' + ils(left) + '</b></div>' +
    '</div>' +
    '<div class="donor-kv">' +
      '<div class="kv"><span>שגריר</span><b>' + esc(d.agent || '—') + '</b></div>' +
      '<div class="kv"><span>תגיות</span><b>' + ((d.tags && d.tags.length) ? d.tags.map(function (t) { return '<span class="badge">' + esc(t) + '</span>'; }).join(' ') : '—') + '</b></div>' +
    '</div>' +
    '<label class="notes-fld fld"><span>הערות</span>' +
      '<textarea aria-label="הערות חופשיות על התורם" class="inp" id="donor-notes" placeholder="הערות חופשיות על התורם…">' + esc(d.notes || '') + '</textarea></label>' +
    '<button class="btn sm" data-act="notes-save" data-id="' + d.client_id + '">שמירת הערות</button>' +
  '</section>';

  // ── התחייבויות התורם ──
  h += '<section class="card"><h2>🤝 התחייבויות<span class="cnt">' + pl.length + '</span></h2>';
  if (!pl.length) h += emptyBox('🤝', 'אין התחייבויות לתורם זה');
  else {
    h += '<div class="tw"><table><thead><tr><th>עילה</th><th class="num">סכום</th><th class="num">נגבה</th>' +
      '<th class="num">נותר</th><th>תאריך יעד</th><th>סטטוס</th><th></th></tr></thead><tbody>';
    pl.forEach(function (p) {
      var c = collectedForPledge(p.client_id), st = pledgeStatus(p);
      h += '<tr><td>' + esc(p.cause || '—') + pendTag(pendRowKey('g_pledges', p.client_id)) + '</td>' +
        '<td class="num">' + ils(p.amount) + '</td>' +
        '<td class="num">' + ils(c) + '</td>' +
        '<td class="num">' + ils(Math.max(0, num(p.amount) - c)) + '</td>' +
        '<td>' + esc(dmyDate(p.due_date)) + '</td>' +
        '<td><span class="badge ' + statusClass(st) + '">' + st + '</span></td>' +
        '<td><button class="btn ghost xs" data-act="pledge-edit" data-id="' + p.client_id + '">עריכה</button></td></tr>';
    });
    h += '</tbody></table></div>';
  }
  h += '</section>';

  // ── תנועות התורם ──
  h += '<section class="card"><h2>💰 תנועות<span class="cnt">' + tx.length + '</span></h2>';
  if (!tx.length) h += emptyBox('💰', 'אין תנועות לתורם זה');
  else {
    h += '<div class="tw"><table><thead><tr><th>תאריך</th><th class="num">סכום</th><th>סעיף</th>' +
      '<th>שגריר</th><th>מנהל</th><th>נפרע</th><th></th></tr></thead><tbody>';
    tx.forEach(function (t) {
      h += '<tr><td>' + esc(dmyDate(t.txn_date)) + pendTag(pendRowKey('g_txns', t.client_id)) + '</td>' +
        '<td class="num">' + ils(t.amount) + '</td>' +
        '<td>' + esc(t.category || '—') + '</td>' +
        '<td>' + esc(t.agent || '—') + '</td>' +
        '<td>' + esc(t.manager || '—') + '</td>' +
        '<td><span class="badge ' + (t.cleared ? 'ok' : 'warn') + '">' + (t.cleared ? 'נפרע' : 'ממתין') + '</span></td>' +
        '<td><button class="btn ghost xs" data-act="txn-edit" data-id="' + t.client_id + '">עריכה</button></td></tr>';
    });
    h += '</tbody></table></div>';
    // barChart מחזירה מחרוזת ריקה מתחת לשתי נקודות, והמסך נשאר עם הטבלה בלבד.
    h += barChart(state.targets.map(function (t) {
      var got = sum(monthTxns(t.month), function (x) { return x.amount; });
      var tg = num(t.amount);
      return { lab: t.month, val: got, tgt: tg,
               end: (tg > 0 ? Math.round(got / tg * 100) : 0) + '%',
               txt: monthLabel(t.month) + ': נגבה ' + ils(got) + ' מתוך יעד ' + ils(tg) };
    }), 'גבייה חודשית מול היעד');
  }
  h += '</section>';
  return h;
}

function formTxn(existing, presetDonor) {
  var t = existing || {};
  var donorId = t.donor_client_id || presetDonor || '';
  var body =
    '<label class="fld"><span>תורם *</span></label>' + pickerHTML('txn-donor', donorId) +
    '<div class="f2-gap f2">' +
      '<label class="fld"><span>סכום *</span><input class="inp" id="txn-amount" inputmode="decimal" value="' + esc(t.amount != null ? num(t.amount) : '') + '"></label>' +
      '<label class="fld"><span>תאריך *</span><input class="inp" type="date" id="txn-date" value="' + esc(t.txn_date || dayToday()) + '"></label>' +
    '</div>' +
    '<div class="f2">' +
      '<label class="fld"><span>סעיף</span>' + selectHTML('txn-category', state.config.categories, t.category, '— ללא סעיף —') + '</label>' +
      '<label class="fld"><span>שגריר</span><input class="inp" id="txn-agent" list="dl-agents" value="' + esc(t.agent || '') + '"></label>' +
    '</div>' +
    '<div class="f2">' +
      '<label class="fld"><span>מנהל מטפל</span>' +
        selectHTML('txn-manager', state.users.map(function (u) { return u.full_name; }),
          t.manager != null ? t.manager : state.user.full_name, '— ללא —') + '</label>' +
      '<label class="fld"><span>שיוך להתחייבות</span>' +
        '<select class="inp" id="txn-pledge">' + pledgeOptionsFor(donorId) + '</select></label>' +
    '</div>' +
    '<label class="fld chk"><input type="checkbox" id="txn-cleared"' + (t.client_id ? (t.cleared ? ' checked' : '') : ' checked') + '><span>נפרע</span></label>' +
    '<label class="fld"><span>הערה</span><textarea class="inp" id="txn-note">' + esc(t.note || '') + '</textarea></label>' +
    datalistHTML('dl-agents', agentPool());

  var foot = '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (t.client_id ? '<button class="btn danger" data-act="txn-del" data-id="' + t.client_id + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="txn-save" data-ksave data-id="' + (t.client_id || '') + '">שמירה</button>';

  openModal(t.client_id ? MSG_EDIT_TXN : MSG_NEW_TXN, body, foot);
  if (t.pledge_client_id) { var sel = $('#txn-pledge'); if (sel) sel.value = t.pledge_client_id; }
}

function saveTxn(id) {
  var donorId = pickerValue('txn-donor');
  if (!donorId) { toast(MSG_PICK_DONOR, null, 'bad'); return Promise.resolve(); }
  var amount = num(val('txn-amount'));
  if (!(amount > 0)) { toast(MSG_AMOUNT_POSITIVE, null, 'bad'); return Promise.resolve(); }
  var row = {
    donor_client_id: donorId,
    pledge_client_id: nullable(val('txn-pledge')),
    amount: amount,
    txn_date: val('txn-date') || dayToday(),
    category: nullable(val('txn-category')),
    agent: nullable(val('txn-agent')),
    manager: nullable(val('txn-manager')),
    cleared: checked('txn-cleared'),
    note: nullable(val('txn-note'))
  };
  return id ? update('g_txns', id, row) : insert('g_txns', row);
}

function formDonor(existing) {
  var d = existing || {};
  var body =
    '<div class="f2">' +
      '<label class="fld"><span>שם *</span><input class="inp" id="dn-name" value="' + esc(d.name || '') + '"></label>' +
      '<label class="fld"><span>טלפון</span><input class="inp" id="dn-phone" inputmode="tel" value="' + esc(d.phone || '') + '"></label>' +
    '</div>' +
    '<div class="f2">' +
      '<label class="fld"><span>שגריר</span><input class="inp" id="dn-agent" list="dl-agents" value="' + esc(d.agent || '') + '"></label>' +
      '<label class="fld"><span>תגיות (מופרדות בפסיק)</span><input class="inp" id="dn-tags" value="' +
        esc((d.tags || []).join(', ')) + '"></label>' +
    '</div>' +
    '<label class="fld chk"><input type="checkbox" id="dn-vip"' + (d.is_vip ? ' checked' : '') + '><span>תורם VIP</span></label>' +
    '<label class="fld"><span>הערות</span><textarea class="inp" id="dn-notes">' + esc(d.notes || '') + '</textarea></label>' +
    datalistHTML('dl-agents', agentPool());

  var foot = '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    '<button class="btn" data-act="donor-save" data-ksave data-id="' + (d.client_id || '') + '">שמירה</button>';
  openModal(d.client_id ? MSG_EDIT_DONOR : MSG_NEW_DONOR, body, foot);
  var n = $('#dn-name'); if (n && !d.client_id) n.focus();
}

function saveDonor(id) {
  var name = val('dn-name');
  if (!name) { toast(MSG_NEED_NAME, null, 'bad'); return Promise.resolve(); }
  var tags = val('dn-tags').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var row = {
    name: name,
    phone: nullable(val('dn-phone')),
    agent: nullable(val('dn-agent')),
    tags: tags,
    is_vip: checked('dn-vip'),
    notes: nullable(val('dn-notes'))
  };
  return id ? update('g_donors', id, row) : insert('g_donors', row);
}

export { donorMatches, donorRowsHTML, formDonor, formTxn, saveDonor, saveTxn,
         viewDonorCard, viewDonors };
