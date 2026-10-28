// app/screens/cards.js — כרטיסים ותשלומים: הרשימה, הכרטיס הפתוח, ההתחייבויות והתשלומים
import { dayToday, readNum } from '../../core/util.js';
import { pendTag } from '../../core/sync.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { LK_AFFIL, LK_AMBASSADOR, LK_METHOD, LK_PTYPE, LK_SECTION, METHOD_SO, MSG_AMOUNT_POSITIVE, MSG_PICK_AMB,
         MSG_PLEDGE_NO_AMB, MSG_NEED_NAME, MSG_PICK_TYPE, MSG_PICK_VALID_MONTH, MSG_SO_COUNT } from '../constants.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import { bar } from '../../core/chart.js';
import { $, checked, collectedForPledge, dmyDate, donorById, donorLeft, donorMatches, donorPaid,
         donorTotal, emptyBox, gSortPledges, gSortTxns, ils, initials, insert, leftForPledge,
         lookupLabels, monthAmount, nullable, pendRowKey, pledgeById, pledgeStatus, pledgesOfDonor, selectHTML,
         monthKeyOf, statusClass, txnSoLabel, txnWhen, txnsOfDonor, txnsOfPledge, update, val } from '../domain.js';

// ── הרשימה ──
// אריחים — שלושה בשורה במסך רחב, אחד בטלפון. הכרטיס הפתוח נפרש לכל רוחב הרשת, בשורה שמתחת לאריח שלו
// (grid-auto-flow: dense — האריחים שאחריו ממלאים את המקומות שנותרו בשורה); כרטיס אחד פתוח בכל פעם.
// כרטיס כללי (`is_general`) — מגבית, פרויקט או «תורמים לא מזוהים» — תמיד בנפרד, בתחתית הרשימה.
// במיון לפי שגריר — כותרת לכל שגריר.
function cardRowsHTML() {
  var c = state.cards, list = donorMatches(c.q, c.aff, c.sort, c.pf);
  if (c.open && !list.some(function (d) { return d.client_id === c.open; })) c.open = null;
  if (!list.length) return emptyBox('🗂', state.donors.length ? 'אין כרטיס התואם את החיפוש' : 'עדיין אין כרטיסים');
  var people = list.filter(function (d) { return !d.is_general; }), general = list.filter(function (d) { return d.is_general; });
  // קבוצה — רשת משלה, כדי שהאריחים לא יעברו בין כותרות בזמן שהכרטיס הפתוח נפרש.
  var groups = [];
  people.forEach(function (d) {
    var t = c.sort === 'amb' ? (d.ambassador || 'ללא שגריר') : '';
    if (!groups.length || groups[groups.length - 1].title !== t) groups.push({ title: t, items: [] });
    groups[groups.length - 1].items.push(d);
  });
  if (general.length) groups.push({ title: 'כרטיסים כלליים', items: general, cls: ' general' });
  return groups.map(function (g) {
    return (g.title ? '<div class="list-sub' + (g.cls || '') + '">' + esc(g.title) + '</div>' : '') +
      '<div class="ctiles">' + g.items.map(cardTileHTML).join('') + '</div>';
  }).join('');
}

// גוון הסמל לפי השגריר — אותו שגריר, אותו גוון, בכל הרשימה.
var AV_TONES = 5;
function avTone(s) {
  var h = 0, t = String(s || '');
  for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 997;
  return t ? 'tone-' + (h % AV_TONES) : 'tone-none';
}

function cardTileHTML(d) {
  var c = state.cards, open = d.client_id === c.open;
  var left = donorLeft(d.client_id), total = donorTotal(d.client_id), paid = Math.max(0, total - left);
  var pct = total > 0 ? Math.round(paid / total * 1000) / 10 : 0;
  var tile = '<button class="ctile' + (d.is_general ? ' general' : '') + (d.starred ? ' star' : '') + (open ? ' open' : '') + '"' +
      ' data-act="card-toggle" data-id="' + esc(d.client_id) + '" aria-expanded="' + open + '">' +
    '<span class="ct-hd"><span class="ct-av ' + (d.is_general ? 'tone-gen' : avTone(d.ambassador)) + '">' + esc(initials(d.name)) + '</span>' +
      '<span class="ct-name"><b>' + (d.starred ? '<span class="star-ic" aria-label="מסומן">' + icon('star') + '</span> ' : '') + esc(d.name) +
        pendTag(pendRowKey('g_donors', d.client_id)) + '</b>' +
        '<small>' + esc(d.ambassador || d.role || '—') + '</small></span></span>' +
    '<span class="ct-amt"><small>' + (left > 0 ? 'נותר' : total > 0 ? 'שולם במלואו' : 'אין התחייבות') + '</small>' +
      '<b>' + (total > 0 ? ils(left) : '—') + '</b></span>' +
    (total > 0 ? bar(pct) +
      '<span class="ct-ft"><span>נגבה ' + ils(paid) + ' מתוך ' + ils(total) + '</span>' +
        '<span>' + pledgesOfDonor(d.client_id).length + ' התחייבויות</span></span>' : '') +
  '</button>';
  return tile + (open ? '<div class="ctile-open">' + cardOpenHTML(d) + '</div>' : '');
}

// סינון לפי ההתחייבויות — בורר אחד בשתי רמות: סעיף או סוג. ערך שכבר נרשם ואינו ברשימה נשאר.
function pledgeFilterHTML(v) {
  function grp(label, short, pre, list, field) {
    var opts = list.slice();
    state.pledges.forEach(function (p) { if (p[field] && opts.indexOf(p[field]) < 0) opts.push(p[field]); });
    return '<optgroup label="' + esc(label) + '">' + opts.map(function (o) {
      return '<option value="' + esc(pre + o) + '"' + (pre + o === v ? ' selected' : '') + '>' + esc(short + ' · ' + o) + '</option>';
    }).join('') + '</optgroup>';
  }
  return '<select class="inp" id="cards-pf" aria-label="סינון לפי סעיף או סוג" data-chg="cards-pf">' +
    '<option value="">סעיף או סוג</option>' +
    grp('סעיפים', 'סעיף', 's:', lookupLabels(LK_SECTION), 'section') +
    grp('סוגי התחייבויות', 'סוג', 't:', lookupLabels(LK_PTYPE), 'pledge_type') + '</select>';
}

function viewCards() {
  var c = state.cards, affs = lookupLabels(LK_AFFIL);
  return '<section class="card list-tools">' +
      '<label class="search-box"><input aria-label="חיפוש כרטיס" class="inp search" id="cards-q" data-inp="cards-q" placeholder="חיפוש כרטיס" value="' + esc(c.q) + '">' +
        '<span class="search-ic">' + icon('search') + '</span></label>' +
      '<div class="tools-row">' +
        selectHTML('cards-aff', affs, c.aff, 'אפשרויות סינון', 'cards-aff') +
        pledgeFilterHTML(c.pf) +
        '<div class="seg" role="group" aria-label="מיון">' +
          [['abc', 'סדר'], ['sum', 'סכום'], ['amb', 'שגריר']].map(function (o) {
            return '<button class="' + (c.sort === o[0] ? 'on' : '') + '" data-act="cards-sort" data-v="' + o[0] + '">' + o[1] + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</section>' +
    '<section class="card"><div id="cards-list">' + cardRowsHTML() + '</div></section>';
}

// ── הכרטיס הפתוח ──
function kv(label, v) { return '<div class="kv"><span>' + esc(label) + '</span><b>' + (v ? esc(v) : '—') + '</b></div>'; }

// הכרטיס הפתוח — פרופיל: פס בכחול הזהות (סמל · שם · שגריר · מספר ההתחייבויות · כוכב · סגירה),
// שלוש קוביות (התחייב · נגבה · נותר), ושלוש לשוניות: התחייבויות (ברירת המחדל) · תשלומים · פרטים.
function cardOpenHTML(d) {
  var id = esc(d.client_id), tab = state.cards.tab || 'pl';
  var pl = gSortPledges(pledgesOfDonor(d.client_id)), tx = gSortTxns(txnsOfDonor(d.client_id));
  var total = donorTotal(d.client_id), paid = donorPaid(d.client_id), left = donorLeft(d.client_id);
  var h = '<div class="copen">' +
    '<div class="cp-band">' +
      '<span class="cp-av">' + esc(initials(d.name)) + '</span>' +
      '<div class="cp-who"><h3>' + esc(d.name) + '</h3><div class="cp-chips">' +
        (d.ambassador ? '<span>שגריר: ' + esc(d.ambassador) + '</span>' : '') +
        '<span>' + pl.length + ' התחייבויות</span></div></div>' +
      '<button class="cp-btn star' + (d.starred ? ' on' : '') + '" data-act="card-star" data-id="' + id + '" aria-pressed="' + !!d.starred + '" aria-label="כוכב">' + icon('star') + '</button>' +
      '<button class="cp-btn" data-act="card-close" aria-label="סגירה">' + icon('close') + '</button>' +
    '</div>' +
    '<div class="cp-kpis">' +
      '<div><span>התחייב</span><b>' + ils(total) + '</b></div>' +
      '<div><span>נגבה</span><b>' + ils(paid) + '</b></div>' +
      '<div><span>נותר</span><b>' + ils(left) + '</b></div>' +
    '</div>' +
    '<div class="cp-tabs" role="tablist">' +
      [['pl', 'התחייבויות · ' + pl.length], ['tx', 'תשלומים · ' + tx.length], ['info', 'פרטים']].map(function (t) {
        return '<button role="tab" class="' + (tab === t[0] ? 'on' : '') + '" aria-selected="' + (tab === t[0]) + '" data-act="card-tab" data-v="' + t[0] + '">' + t[1] + '</button>';
      }).join('') +
      '<button class="btn sm" data-act="pledge-new" data-donor="' + id + '">' + icon('plus') + 'התחייבות</button>' +
    '</div><div class="cp-body">';

  if (tab === 'pl') {
    h += pl.length ? pl.map(pledgeRowHTML).join('') : '<div class="hint">אין התחייבויות. תרומה חד-פעמית נרשמת כהתחייבות ששולמה מיד.</div>';
  } else if (tab === 'tx') {
    h += tx.length ? '<div class="pays">' + tx.map(function (t) {
      var p = pledgeById(t.pledge_client_id);
      return '<button class="pay' + (t.cleared ? '' : ' uncleared') + '" data-act="pay-edit" data-id="' + esc(t.client_id) + '">' +
        '<span>' + esc(txnWhen(t)) + '</span><span>' + esc((p && (p.pledge_type || p.section)) || '—') + '</span>' +
        '<span>' + esc(t.method || '—') + (txnSoLabel(t) ? ' · ' + esc(txnSoLabel(t)) : '') + '</span>' +
        '<span class="pay-cl">' + (t.cleared ? '✓ נסלק' : 'טרם נסלק') + '</span>' +
        pendTag(pendRowKey('g_txns', t.client_id)) +
        '<b>' + ils(t.amount) + '</b></button>';
    }).join('') + '</div>' : '<div class="hint">אין תשלומים. תשלום נרשם מתוך ההתחייבות, בלשונית «התחייבויות».</div>';
  } else {
    var affs = lookupLabels(LK_AFFIL), mine = d.affiliations || [], all = affs.slice();
    mine.forEach(function (a) { if (all.indexOf(a) < 0) all.push(a); });
    h += '<div class="cp-info">' +
        kv('שגריר', d.ambassador) + kv('טלפון', d.phone) + kv('תפקיד', d.role) +
        kv('יום הולדת', d.birth_date ? dmyDate(d.birth_date) : '') +
        '<div class="cp-wide">' + kv('הערות', d.notes) + '</div>' +
      '</div>' +
      // השייכויות — סימון ישיר, נשמר בלחיצה.
      '<div class="sec-t">שייכויות</div><div class="chips">' + all.map(function (a) {
        var on = mine.indexOf(a) >= 0;
        return '<label class="chip' + (on ? ' on' : '') + '"><input type="checkbox" data-chg="aff" data-id="' + id + '" value="' + esc(a) + '"' + (on ? ' checked' : '') + '>' + esc(a) + '</label>';
      }).join('') + (all.length ? '' : '<span class="hint">אין שייכויות ברשימה — מוסיפים בהגדרות.</span>') + '</div>' +
      '<div class="btnrow copen-ft">' +
        '<button class="btn ghost sm" data-act="donor-edit" data-id="' + id + '">עריכת פרטים</button>' +
        '<button class="btn danger sm" data-act="donor-del" data-id="' + id + '">מחיקת הכרטיס</button>' +
      '</div>';
  }
  return h + '</div></div>';
}

function pledgeRowHTML(p) {
  var st = pledgeStatus(p), id = esc(p.client_id);
  var tx = gSortTxns(txnsOfPledge(p.client_id));
  return '<div class="pl">' +
    '<div class="pl-top">' +
      '<span class="badge brand">' + esc(p.section || 'ללא סעיף') + '</span>' +
      '<b>' + esc(p.pledge_type || '—') + '</b>' +
      pendTag(pendRowKey('g_pledges', p.client_id)) +
      (p.initiated === true ? '<span class="badge ok">יזום</span>' : p.initiated === false ? '<span class="badge">לא יזום</span>' : '') +
      '<span class="pl-amt" title="נותר">' + ils(leftForPledge(p)) + '</span>' +
    '</div>' +
    (p.detail ? '<div class="pl-detail">' + esc(p.detail) + '</div>' : '') +
    '<div class="pl-meta">' +
      '<span>שגריר: ' + esc(p.ambassador || '—') + '</span>' +
      (p.note ? '<span>' + esc(p.note) + '</span>' : '') +
    '</div>' +
    '<div class="pl-st">' +
      '<span>נגבה ' + ils(collectedForPledge(p.client_id)) + '</span>' +
      '<span>סה״כ ' + ils(p.amount) + '</span>' +
      '<span class="badge ' + statusClass(st) + '">' + esc(st) + '</span>' +
      '<span class="grow"></span>' +
      '<button class="btn soft xs" data-act="pay-new" data-pledge="' + id + '">תשלום</button>' +
      '<button class="btn ghost xs" data-act="pledge-edit" data-id="' + id + '">עריכה</button>' +
    '</div>' +
    (tx.length ? '<div class="pays">' + tx.map(function (t) {
      return '<button class="pay' + (t.cleared ? '' : ' uncleared') + '" data-act="pay-edit" data-id="' + esc(t.client_id) + '">' +
        '<span>' + esc(txnWhen(t)) + '</span><span>' + esc(t.method || '—') + (txnSoLabel(t) ? ' · ' + esc(txnSoLabel(t)) : '') + '</span>' +
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
    '<label class="fld"><span>הערות</span><textarea class="inp" id="d-notes">' + esc(d ? d.notes || '' : '') + '</textarea></label>' +
    '<label class="fld chk"><input type="checkbox" id="d-general"' + (d && d.is_general ? ' checked' : '') + '><span>כרטיס כללי — מגבית, פרויקט וכדומה; מוצג בנפרד בתחתית הרשימה</span></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    '<button class="btn" data-act="donor-save" data-id="' + esc(d ? d.client_id : '') + '" data-ksave>שמירה</button>');
  var n = $('#d-name'); if (n && !d) n.focus();
}

function saveDonor(id) {
  var name = val('d-name');
  if (!name) { toast(MSG_NEED_NAME, null, 'bad'); return; }
  var row = { name: name, ambassador: nullable(val('d-amb')), birth_date: nullable(val('d-birth')),
              role: nullable(val('d-role')), phone: nullable(val('d-phone')), notes: nullable(val('d-notes')),
              is_general: checked('d-general') };
  if (id) return update('g_donors', id, row);
  return insert('g_donors', Object.assign(row, { affiliations: [], starred: false })).then(function (d) {
    state.cards.open = d.client_id;
    return d;
  });
}

// ── התחייבות ──
// השגריר חובה — נלקח מהכרטיס וניתן לשינוי; תרומה חד-פעמית — התחייבות ותשלום מלא באותה שמירה.
function formPledge(p, donorId) {
  var d = donorById(p ? p.donor_client_id : donorId);
  if (!d) return;
  var body = '<label class="fld"><span>סעיף</span>' + selectHTML('p-section', lookupLabels(LK_SECTION), p ? p.section : '', 'סעיף') + '</label>' +
    '<div class="f2">' +
      '<label class="fld"><span>סוג *</span>' + selectHTML('p-type', lookupLabels(LK_PTYPE), p ? p.pledge_type : '', 'סוג') + '</label>' +
      '<label class="fld"><span>סכום *</span><input class="inp" id="p-amount" inputmode="decimal" value="' + esc(p ? p.amount : '') + '"></label>' +
    '</div>' +
    '<label class="fld"><span>פירוט</span><input class="inp" id="p-detail" value="' + esc(p ? p.detail || '' : '') + '"></label>' +
    '<label class="fld"><span>שגריר *</span>' + selectHTML('p-amb', lookupLabels(LK_AMBASSADOR), p ? p.ambassador : (d.ambassador || ''), 'שגריר') + '</label>' +
    '<label class="fld"><span>הערות</span><input class="inp" id="p-note" value="' + esc(p ? p.note || '' : '') + '"></label>' +
    '<label class="fld"><span>יזום</span><select class="inp" id="p-init">' +
      [['', '— טרם הוגדר —'], ['1', 'כן — יזום'], ['0', 'לא יזום']].map(function (o) {
        var cur = p && p.initiated === true ? '1' : p && p.initiated === false ? '0' : '';
        return '<option value="' + o[0] + '"' + (o[0] === cur ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>';
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
  if (!val('p-amb')) { toast(MSG_PICK_AMB, null, 'bad'); return; }
  var row = { section: nullable(val('p-section')), pledge_type: type, detail: nullable(val('p-detail')),
              ambassador: nullable(val('p-amb')), amount: amount, note: nullable(val('p-note')),
              initiated: initVal(val('p-init')) };
  if (id) return update('g_pledges', id, row);
  var now = checked('p-now'), when = now ? readWhen('p') : null;
  if (now && !when) return;
  var go = function (initiated) {
    return insert('g_pledges', Object.assign({}, row, { donor_client_id: donorId, initiated: initiated })).then(function (p) {
      if (!now) return p;
      return insert('g_txns', { donor_client_id: donorId, pledge_client_id: p.client_id, amount: amount,
                                txn_month: when.txn_month, txn_date: when.txn_date,
                                method: nullable(val('p-method')), cleared: false });
    });
  };
  // תשלום אינו נסגר בלי הכרעה על «יזום» — רק מה שיזום נספר בדשבורד.
  if (now && row.initiated == null) return initAsk(go);
  return go(row.initiated);
}

function initVal(v) { return v === '1' ? true : v === '0' ? false : null; }

// השאלה בחלון משלה; ערכי הטופס כבר נקראו, והשמירה רצה אחרי הבחירה.
var _initPending = null;
function initAsk(go) {
  _initPending = go;
  openModal('ההתחייבות יזומה?',
    '<div class="hint">רק תשלומים של התחייבות יזומה — שבאה מהעבודה — נספרים בדשבורד וביעד. ההכרעה נשמרת בהתחייבות.</div>',
    '<button class="btn ghost" data-act="init-pick" data-v="0">לא יזום</button>' +
    '<button class="btn" data-act="init-pick" data-v="1">יזום</button>');
}

function initPick(v) {
  var go = _initPending; _initPending = null;
  if (!go) return;
  return go(v === '1');
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
// הו״ק — פעימות וסכום לפעימה, והסכום הכולל נגזר מהם ונעול לעריכה ישירה.
function soHTML(t, open) {
  var has = !!t && +t.installments > 1;
  return '<div class="f2' + (open ? '' : ' hidden') + '" id="t-so">' +
    '<label class="fld"><span>פעימות *</span><input class="inp" id="t-so-n" inputmode="numeric" data-inp="pay-so" value="' +
      (has ? esc(t.installments) : '') + '"></label>' +
    '<label class="fld"><span>סכום לפעימה *</span><input class="inp" id="t-so-amt" inputmode="decimal" data-inp="pay-so" value="' +
      (has ? esc(monthAmount(t)) : '') + '"></label>' +
  '</div>';
}

// הסכום הכולל בטופס — פעימות × סכום לפעימה, בכל הקלדה.
function soSync() {
  var n = readNum($('#t-so-n'), 0), per = readNum($('#t-so-amt'), 0), a = $('#t-amount');
  if (a && n > 0 && per > 0) a.value = String(Math.round(n * per * 100) / 100);
}

function soToggle(method) {
  var on = method === METHOD_SO, box = $('#t-so'), a = $('#t-amount');
  if (box) box.classList.toggle('hidden', !on);
  if (a) a.readOnly = on;
  if (on) soSync();
}

function formPay(t, pledgeId) {
  var p = pledgeById(t ? t.pledge_client_id : pledgeId);
  if (!p) return;
  var amt = t ? t.amount : (leftForPledge(p) || '');
  var so = !!t && t.method === METHOD_SO;
  openModal((t ? 'עריכת תשלום — ' : 'תשלום — ') + (p.pledge_type || ''),
    '<label class="fld"><span>סכום *</span><input class="inp" id="t-amount" inputmode="decimal" value="' + esc(amt) + '"' +
      (so ? ' readonly' : '') + '></label>' +
    whenHTML('t', t) +
    '<label class="fld"><span>אמצעי</span>' + selectHTML('t-method', lookupLabels(LK_METHOD), t ? t.method : '', 'אמצעי', 'pay-method') + '</label>' +
    soHTML(t, so) +
    '<label class="fld chk"><input type="checkbox" id="t-cleared"' + (t && t.cleared ? ' checked' : '') + '><span>סליקה בפועל</span></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (t ? '<button class="btn danger" data-act="pay-del" data-id="' + esc(t.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="pay-save" data-id="' + esc(t ? t.client_id : '') + '" data-pledge="' + esc(p.client_id) + '" data-ksave>שמירה</button>');
}

function savePay(id, pledgeId) {
  var p = pledgeById(pledgeId);
  if (!p) return;
  // כל תשלום נושא שגריר — דרך ההתחייבות שלו.
  if (!p.ambassador) { toast(MSG_PLEDGE_NO_AMB, null, 'bad'); return; }
  var method = nullable(val('t-method')), n = null, amount;
  if (method === METHOD_SO) {
    n = readNum($('#t-so-n'), 0);
    var per = readNum($('#t-so-amt'), 0);
    if (!(n >= 2 && n === Math.floor(n))) { toast(MSG_SO_COUNT, null, 'bad'); return; }
    if (!(per > 0)) { toast(MSG_AMOUNT_POSITIVE, null, 'bad'); return; }
    amount = Math.round(n * per * 100) / 100;
  } else amount = readNum($('#t-amount'), 0);
  if (!(amount > 0)) { toast(MSG_AMOUNT_POSITIVE, null, 'bad'); return; }
  var when = readWhen('t');
  if (!when) return;
  var row = { txn_month: when.txn_month, txn_date: when.txn_date, amount: amount, method: method, installments: n,
              cleared: checked('t-cleared') };
  var go = function (initiated) {
    var w = initiated == null || p.initiated === initiated ? Promise.resolve() : update('g_pledges', p.client_id, { initiated: initiated });
    return w.then(function () {
      if (id) return update('g_txns', id, row);
      return insert('g_txns', Object.assign(row, { donor_client_id: p.donor_client_id, pledge_client_id: p.client_id }));
    });
  };
  if (p.initiated == null) return initAsk(go);
  return go(null);
}

export { cardRowsHTML, formDonor, initPick, formPay, formPledge, saveDonor, savePay, savePledge, soSync, soToggle, viewCards };
