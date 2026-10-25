// app/screens/cards.js — כרטיסים ותשלומים: הרשימה, הכרטיס הפתוח, ההתחייבויות והתשלומים
import { dayToday, readNum } from '../../core/util.js';
import { pendTag } from '../../core/sync.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { LK_AFFIL, LK_AMBASSADOR, LK_METHOD, LK_PTYPE, LK_SECTION, MSG_AMOUNT_POSITIVE,
         MSG_NEED_NAME, MSG_PICK_TYPE, MSG_PICK_VALID_MONTH } from '../constants.js';
import { state } from '../state.js';
import { $, checked, collectedForPledge, dmyDate, donorById, donorLeft, donorMatches, donorPaid,
         donorTotal, emptyBox, gSortPledges, gSortTxns, ils, initials, insert, leftForPledge,
         lookupLabels, nullable, pendRowKey, pledgeById, pledgeStatus, pledgesOfDonor, selectHTML,
         monthKeyOf, statusClass, txnWhen, txnsOfPledge, update, val } from '../domain.js';

// ── הרשימה ──
// הכרטיס נפתח בתוך הרשימה, מתחת לשורה שלו, והרשימה נשארת מעליו ומתחתיו; כרטיס אחד פתוח בכל פעם.
function cardRowsHTML() {
  var c = state.cards, list = donorMatches(c.q, c.aff, c.sort);
  if (c.open && !list.some(function (d) { return d.client_id === c.open; })) c.open = null;
  if (!list.length) return emptyBox('🗂', state.donors.length ? 'אין כרטיס התואם את החיפוש' : 'עדיין אין כרטיסים');
  return list.map(function (d) {
    var open = d.client_id === c.open, left = donorLeft(d.client_id);
    return '<div class="crow' + (d.starred ? ' star' : '') + (open ? ' open' : '') + '">' +
      '<div class="row" data-act="card-toggle" data-id="' + esc(d.client_id) + '" aria-expanded="' + open + '">' +
        '<div class="av">' + esc(initials(d.name)) + '</div>' +
        '<div class="main"><b>' + (d.starred ? '<span class="star-ic" aria-label="מסומן">★</span> ' : '') + esc(d.name) +
          pendTag(pendRowKey('g_donors', d.client_id)) + '</b>' +
          '<small>' + esc([d.role, d.ambassador].filter(Boolean).join(' · ') || d.phone || '—') + '</small></div>' +
        '<div class="end">' + (left > 0 ? ils(left) + '<small>נותר</small>' : '<small>—</small>') + '</div>' +
      '</div>' +
      (open ? cardOpenHTML(d) : '') +
    '</div>';
  }).join('');
}

function viewCards() {
  var c = state.cards, affs = lookupLabels(LK_AFFIL);
  return '<section class="card cards-tools">' +
      '<input aria-label="חיפוש כרטיס" class="inp search" id="cards-q" data-inp="cards-q" placeholder="חיפוש לפי שם, טלפון, תפקיד או שגריר…" value="' + esc(c.q) + '">' +
      '<div class="tools-row">' +
        selectHTML('cards-aff', affs, c.aff, 'כל השייכויות', 'cards-aff') +
        '<div class="seg" role="group" aria-label="מיון">' +
          '<button class="' + (c.sort === 'abc' ? 'on' : '') + '" data-act="cards-sort" data-v="abc">א״ב</button>' +
          '<button class="' + (c.sort === 'left' ? 'on' : '') + '" data-act="cards-sort" data-v="left">לפי נותר</button>' +
        '</div>' +
      '</div>' +
    '</section>' +
    '<section class="card"><div id="cards-list">' + cardRowsHTML() + '</div></section>';
}

// ── הכרטיס הפתוח ──
function kv(label, v) { return '<div class="kv"><span>' + esc(label) + '</span><b>' + (v ? esc(v) : '—') + '</b></div>'; }

function cardOpenHTML(d) {
  var id = esc(d.client_id), affs = lookupLabels(LK_AFFIL), mine = d.affiliations || [];
  var h = '<div class="copen">' +
    '<div class="copen-hd">' +
      '<h3>' + esc(d.name) + '</h3>' +
      '<button class="icon-btn' + (d.starred ? ' on' : '') + '" data-act="card-star" data-id="' + id + '" aria-pressed="' + !!d.starred + '" aria-label="כוכב">' + (d.starred ? '★' : '☆') + '</button>' +
      '<button class="icon-btn" data-act="card-close" aria-label="סגירה">✕</button>' +
    '</div>' +
    '<div class="copen-sec">' +
      kv('שם', d.name) + kv('שגריר', d.ambassador) + kv('יום הולדת', d.birth_date ? dmyDate(d.birth_date) : '') +
      kv('תפקיד', d.role) + kv('טלפון', d.phone) + kv('הערות', d.notes) +
      '<div class="btnrow"><button class="btn ghost sm" data-act="donor-edit" data-id="' + id + '">עריכת פרטים</button></div>' +
    '</div>';

  // השייכויות — סימון ישיר, נשמר בלחיצה.
  var all = affs.slice();
  mine.forEach(function (a) { if (all.indexOf(a) < 0) all.push(a); });
  h += '<div class="copen-sec"><div class="sec-t">שייכויות</div><div class="chips">' + all.map(function (a) {
    var on = mine.indexOf(a) >= 0;
    return '<label class="chip' + (on ? ' on' : '') + '"><input type="checkbox" data-chg="aff" data-id="' + id + '" value="' + esc(a) + '"' + (on ? ' checked' : '') + '>' + esc(a) + '</label>';
  }).join('') + (all.length ? '' : '<span class="hint">אין שייכויות ברשימה — מוסיפים בהגדרות.</span>') + '</div></div>';

  // ההתחייבויות
  var pl = gSortPledges(pledgesOfDonor(d.client_id));
  h += '<div class="copen-sec"><div class="sec-t">התחייבויות<span class="cnt">' + pl.length + '</span>' +
    '<button class="btn sm" data-act="pledge-new" data-donor="' + id + '">＋ התחייבות</button></div>';
  if (!pl.length) h += '<div class="hint">אין התחייבויות. תרומה חד-פעמית נרשמת כהתחייבות ששולמה מיד.</div>';
  h += pl.map(pledgeRowHTML).join('');
  h += '</div>';

  var total = donorTotal(d.client_id), paid = donorPaid(d.client_id), left = donorLeft(d.client_id);
  h += '<div class="ctotals">' +
      '<div class="stat"><span>סה״כ התחייב</span><b>' + ils(total) + '</b></div>' +
      '<div class="stat ok"><span>נגבה</span><b>' + ils(paid) + '</b></div>' +
      '<div class="stat warn"><span>נותר</span><b>' + ils(left) + '</b></div>' +
    '</div>' +
    '<div class="btnrow copen-ft"><button class="btn danger sm" data-act="donor-del" data-id="' + id + '">מחיקת הכרטיס</button></div>' +
  '</div>';
  return h;
}

function pledgeRowHTML(p) {
  var st = pledgeStatus(p), id = esc(p.client_id);
  var tx = gSortTxns(txnsOfPledge(p.client_id));
  return '<div class="pl">' +
    '<div class="pl-top">' +
      '<span class="badge brand">' + esc(p.section || 'ללא סעיף') + '</span>' +
      '<b>' + esc(p.pledge_type || '—') + '</b>' +
      pendTag(pendRowKey('g_pledges', p.client_id)) +
      '<span class="pl-amt">' + ils(p.amount) + '</span>' +
    '</div>' +
    (p.detail ? '<div class="pl-detail">' + esc(p.detail) + '</div>' : '') +
    '<div class="pl-meta">' +
      '<span>שגריר: ' + esc(p.ambassador || '—') + '</span>' +
      (p.note ? '<span>' + esc(p.note) + '</span>' : '') +
    '</div>' +
    '<div class="pl-st">' +
      '<span>נגבה ' + ils(collectedForPledge(p.client_id)) + '</span>' +
      '<span>נותר ' + ils(leftForPledge(p)) + '</span>' +
      '<span class="badge ' + statusClass(st) + '">' + esc(st) + '</span>' +
      '<span class="grow"></span>' +
      '<button class="btn soft xs" data-act="pay-new" data-pledge="' + id + '">תשלום</button>' +
      '<button class="btn ghost xs" data-act="pledge-edit" data-id="' + id + '">עריכה</button>' +
    '</div>' +
    (tx.length ? '<div class="pays">' + tx.map(function (t) {
      return '<button class="pay' + (t.cleared ? '' : ' uncleared') + '" data-act="pay-edit" data-id="' + esc(t.client_id) + '">' +
        '<span>' + esc(txnWhen(t)) + '</span><span>' + esc(t.method || '—') + '</span>' +
        '<span class="pay-cl">' + (t.cleared ? '✓ נסלק' : 'טרם נסלק') + '</span>' +
        pendTag(pendRowKey('g_txns', t.client_id)) +
        '<b>' + ils(t.amount) + '</b></button>';
    }).join('') + '</div>' : '') +
  '</div>';
}

// ── פרטי הכרטיס ──
function formDonor(d) {
  var amb = lookupLabels(LK_AMBASSADOR);
  openModal(d ? 'עריכת כרטיס' : 'כרטיס חדש',
    '<label class="fld"><span>שם *</span><input class="inp" id="d-name" value="' + esc(d ? d.name : '') + '"></label>' +
    '<label class="fld"><span>שגריר</span>' + selectHTML('d-amb', amb, d ? d.ambassador : '', '— ללא —') + '</label>' +
    '<div class="f2">' +
      '<label class="fld"><span>יום הולדת</span><input class="inp" type="date" id="d-birth" value="' + esc(d && d.birth_date ? d.birth_date : '') + '"></label>' +
      '<label class="fld"><span>תפקיד</span><input class="inp" id="d-role" value="' + esc(d ? d.role || '' : '') + '"></label>' +
    '</div>' +
    '<label class="fld"><span>טלפון</span><input class="inp" id="d-phone" inputmode="tel" value="' + esc(d ? d.phone || '' : '') + '"></label>' +
    '<label class="fld"><span>הערות</span><textarea class="inp" id="d-notes">' + esc(d ? d.notes || '' : '') + '</textarea></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    '<button class="btn" data-act="donor-save" data-id="' + esc(d ? d.client_id : '') + '" data-ksave>שמירה</button>');
  var n = $('#d-name'); if (n && !d) n.focus();
}

function saveDonor(id) {
  var name = val('d-name');
  if (!name) { toast(MSG_NEED_NAME, null, 'bad'); return; }
  var row = { name: name, ambassador: nullable(val('d-amb')), birth_date: nullable(val('d-birth')),
              role: nullable(val('d-role')), phone: nullable(val('d-phone')), notes: nullable(val('d-notes')) };
  if (id) return update('g_donors', id, row);
  return insert('g_donors', Object.assign(row, { affiliations: [], starred: false })).then(function (d) {
    state.cards.open = d.client_id;
    return d;
  });
}

// ── התחייבות ──
// השגריר נלקח מהכרטיס וניתן לשינוי; תרומה חד-פעמית — התחייבות ותשלום מלא באותה שמירה.
function formPledge(p, donorId) {
  var d = donorById(p ? p.donor_client_id : donorId);
  if (!d) return;
  var body = '<label class="fld"><span>סעיף</span>' + selectHTML('p-section', lookupLabels(LK_SECTION), p ? p.section : '', 'סעיף') + '</label>' +
    '<div class="f2">' +
      '<label class="fld"><span>סוג *</span>' + selectHTML('p-type', lookupLabels(LK_PTYPE), p ? p.pledge_type : '', 'סוג') + '</label>' +
      '<label class="fld"><span>סכום *</span><input class="inp" id="p-amount" inputmode="decimal" value="' + esc(p ? p.amount : '') + '"></label>' +
    '</div>' +
    '<label class="fld"><span>פירוט</span><input class="inp" id="p-detail" value="' + esc(p ? p.detail || '' : '') + '"></label>' +
    '<label class="fld"><span>שגריר</span>' + selectHTML('p-amb', lookupLabels(LK_AMBASSADOR), p ? p.ambassador : (d.ambassador || ''), '— ללא —') + '</label>' +
    '<label class="fld"><span>הערות</span><input class="inp" id="p-note" value="' + esc(p ? p.note || '' : '') + '"></label>';
  if (!p) body += '<label class="fld chk"><input type="checkbox" id="p-now"><span>תרומה חד-פעמית — שולמה עכשיו</span></label>' +
    whenHTML('p', null) +
    '<label class="fld"><span>אמצעי</span>' + selectHTML('p-method', lookupLabels(LK_METHOD), '', 'אמצעי') + '</label>';
  openModal((p ? 'עריכת התחייבות — ' : 'התחייבות — ') + d.name, body,
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (p ? '<button class="btn danger" data-act="pledge-del" data-id="' + esc(p.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="pledge-save" data-id="' + esc(p ? p.client_id : '') + '" data-donor="' + esc(d.client_id) + '" data-ksave>שמירה</button>');
}

function savePledge(id, donorId) {
  var type = val('p-type'), amount = readNum($('#p-amount'), 0);
  if (!type) { toast(MSG_PICK_TYPE, null, 'bad'); return; }
  if (!(amount > 0)) { toast(MSG_AMOUNT_POSITIVE, null, 'bad'); return; }
  var row = { section: nullable(val('p-section')), pledge_type: type, detail: nullable(val('p-detail')),
              ambassador: nullable(val('p-amb')), amount: amount, note: nullable(val('p-note')) };
  if (id) return update('g_pledges', id, row);
  var now = checked('p-now'), when = now ? readWhen('p') : null;
  if (now && !when) return;
  return insert('g_pledges', Object.assign(row, { donor_client_id: donorId })).then(function (p) {
    if (!now) return p;
    return insert('g_txns', { donor_client_id: donorId, pledge_client_id: p.client_id, amount: amount,
                              txn_month: when.txn_month, txn_date: when.txn_date,
                              method: nullable(val('p-method')), cleared: false });
  });
}

// ── חודש ותאריך ──
// החודש חובה ובברירת המחדל החודש הנוכחי; התאריך רשות, וכשממולא — החודש עובר אחריו.
function whenHTML(px, t) {
  var m = t ? (t.txn_month || '') : monthKeyOf(dayToday());
  return '<div class="f2">' +
    '<label class="fld"><span>חודש *</span><input class="inp" type="month" id="' + px + '-month" value="' + esc(m) + '"></label>' +
    '<label class="fld"><span>תאריך</span><input class="inp" type="date" id="' + px + '-date" data-chg="when-date" data-m="' + px + '-month" value="' + esc(t && t.txn_date ? t.txn_date : '') + '"></label>' +
  '</div>';
}

// פיירפוקס נופל לטקסט ב-type=month — החודש נבדק כאן ולא נסמך על הדפדפן.
function readWhen(px) {
  var date = val(px + '-date'), m = date ? monthKeyOf(date) : val(px + '-month');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) { toast(MSG_PICK_VALID_MONTH, null, 'bad'); return null; }
  return { txn_month: m, txn_date: date || null };
}

// ── תשלום ──
function formPay(t, pledgeId) {
  var p = pledgeById(t ? t.pledge_client_id : pledgeId);
  if (!p) return;
  var amt = t ? t.amount : (leftForPledge(p) || '');
  openModal((t ? 'עריכת תשלום — ' : 'תשלום — ') + (p.pledge_type || ''),
    '<label class="fld"><span>סכום *</span><input class="inp" id="t-amount" inputmode="decimal" value="' + esc(amt) + '"></label>' +
    whenHTML('t', t) +
    '<label class="fld"><span>אמצעי</span>' + selectHTML('t-method', lookupLabels(LK_METHOD), t ? t.method : '', 'אמצעי') + '</label>' +
    '<label class="fld chk"><input type="checkbox" id="t-cleared"' + (t && t.cleared ? ' checked' : '') + '><span>סליקה בפועל</span></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (t ? '<button class="btn danger" data-act="pay-del" data-id="' + esc(t.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="pay-save" data-id="' + esc(t ? t.client_id : '') + '" data-pledge="' + esc(p.client_id) + '" data-ksave>שמירה</button>');
}

function savePay(id, pledgeId) {
  var p = pledgeById(pledgeId);
  if (!p) return;
  var amount = readNum($('#t-amount'), 0);
  if (!(amount > 0)) { toast(MSG_AMOUNT_POSITIVE, null, 'bad'); return; }
  var when = readWhen('t');
  if (!when) return;
  var row = { txn_month: when.txn_month, txn_date: when.txn_date, amount: amount, method: nullable(val('t-method')), cleared: checked('t-cleared') };
  if (id) return update('g_txns', id, row);
  return insert('g_txns', Object.assign(row, { donor_client_id: p.donor_client_id, pledge_client_id: p.client_id }));
}

export { cardRowsHTML, formDonor, formPay, formPledge, saveDonor, savePay, savePledge, viewCards };
