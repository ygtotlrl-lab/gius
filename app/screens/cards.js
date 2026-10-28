// app/screens/cards.js — כרטיסים ותשלומים: הרשימה, הכרטיס הפתוח, ההתחייבויות והתשלומים
import { dayToday, readNum } from '../../core/util.js';
import { pendTag } from '../../core/sync.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { LK_AFFIL, LK_AMBASSADOR, LK_METHOD, LK_PTYPE, LK_SECTION, METHOD_SO, MSG_AMOUNT_POSITIVE, MSG_PICK_AMB,
         MSG_PLEDGE_NO_AMB, MSG_NEED_NAME, MSG_PICK_TYPE, MSG_PICK_VALID_MONTH, MSG_SO_COUNT } from '../constants.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import { bar } from '../../core/chart.js';
import { $, checked, collectedForPledge, donorById, donorLeft, donorMatches, donorPaid,
         donorTotal, emptyBox, gSortPledges, gSortTxns, ils, initials, insert, leftForPledge,
         lookupLabels, monthAmount, nullable, pendRowKey, pledgeById, pledgeStatus, pledgesOfDonor, selectHTML,
         monthKeyOf, statusClass, txnSoLabel, txnWhen, txnsOfPledge, update, val } from '../domain.js';

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
// פס בכחול הזהות — סמל · שם · שגריר ופרטי הקשר · התחייב · נגבה · נותר · עריכה · כוכב · ✕;
// ומתחתיו ההתחייבויות, ו«＋ תשלום» ו«＋ התחייבות» לצדן. לחיצה על התחייבות פורשת את תשלומיה.
function cardOpenHTML(d) {
  var id = esc(d.client_id);
  var pl = gSortPledges(pledgesOfDonor(d.client_id));
  var total = donorTotal(d.client_id), paid = donorPaid(d.client_id), left = donorLeft(d.client_id);
  var chips = [d.ambassador ? 'שגריר: ' + d.ambassador : '', d.role, d.phone].concat(d.affiliations || []).filter(Boolean);
  var h = '<div class="copen">' +
    '<div class="cp-band">' +
      '<span class="cp-av">' + esc(initials(d.name)) + '</span>' +
      '<div class="cp-who"><h3>' + esc(d.name) + '</h3>' +
        (chips.length ? '<div class="cp-chips">' + chips.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' : '') +
        (d.notes ? '<div class="cp-note">' + esc(d.notes) + '</div>' : '') +
      '</div>' +
      '<div class="cp-sum">' +
        '<span><small>התחייב</small><b>' + ils(total) + '</b></span>' +
        '<span><small>נגבה</small><b>' + ils(paid) + '</b></span>' +
        '<span class="left"><small>נותר</small><b>' + ils(left) + '</b></span>' +
      '</div>' +
      '<div class="cp-acts">' +
        '<button class="cp-btn" data-act="donor-edit" data-id="' + id + '" aria-label="עריכת פרטי הכרטיס" title="עריכת פרטי הכרטיס">' + icon('edit') + '</button>' +
        '<button class="cp-btn star' + (d.starred ? ' on' : '') + '" data-act="card-star" data-id="' + id + '" aria-pressed="' + !!d.starred + '" aria-label="כוכב">' + icon('star') + '</button>' +
        '<button class="cp-btn" data-act="card-close" aria-label="סגירה">' + icon('close') + '</button>' +
      '</div>' +
    '</div>' +
    '<div class="cp-bar"><h4>התחייבויות<span class="cnt">' + pl.length + '</span></h4>' +
      '<button class="btn soft sm" data-act="pay-new" data-donor="' + id + '">' + icon('plus') + 'תשלום</button>' +
      '<button class="btn sm" data-act="pledge-new" data-donor="' + id + '">' + icon('plus') + 'התחייבות</button>' +
    '</div><div class="cp-body">' +
    (pl.length ? pl.map(pledgeRowHTML).join('') : '<div class="hint">אין התחייבויות. תרומה חד-פעמית נרשמת כהתחייבות ששולמה מיד.</div>');
  return h + '</div></div>';
}

// תשלום — מוסלק מודגש, ושטרם נסלק חיוור; בלי מילה.
function payRowHTML(t) {
  return '<button class="pay' + (t.cleared ? ' cleared' : ' uncleared') + '" data-act="pay-edit" data-id="' + esc(t.client_id) + '"' +
      ' title="' + (t.cleared ? 'נסלק' : 'טרם נסלק') + '">' +
    '<span>' + esc(txnWhen(t)) + '</span><span>' + esc(t.method || '—') + (txnSoLabel(t) ? ' · ' + esc(txnSoLabel(t)) : '') + '</span>' +
    pendTag(pendRowKey('g_txns', t.client_id)) +
    '<b>' + ils(t.amount) + '</b></button>';
}

// התחייבות — שורה אחת: סעיף · סוג · פירוט, והנותר בולט; לחיצה פורשת את התשלומים.
function pledgeRowHTML(p) {
  var st = pledgeStatus(p), id = esc(p.client_id), open = state.cards.plOpen === p.client_id;
  var tx = gSortTxns(txnsOfPledge(p.client_id));
  var r = '<div class="pl' + (open ? ' open' : '') + '">' +
    '<button class="pl-hd" data-act="pledge-toggle" data-id="' + id + '" aria-expanded="' + open + '">' +
      '<span class="pl-what">' +
        (p.section ? '<span class="badge brand">' + esc(p.section) + '</span>' : '') +
        '<b>' + esc(p.pledge_type || '—') + '</b>' +
        (p.detail ? '<span class="pl-detail">' + esc(p.detail) + '</span>' : '') +
        pendTag(pendRowKey('g_pledges', p.client_id)) +
        (p.initiated === true ? '<span class="badge ok">יזום</span>' : p.initiated === false ? '<span class="badge">לא יזום</span>' : '') +
      '</span>' +
      '<span class="pl-end"><b title="נותר">' + ils(leftForPledge(p)) + '</b>' +
        '<small>נגבה ' + ils(collectedForPledge(p.client_id)) + ' מתוך ' + ils(p.amount) +
        ' · <span class="badge ' + statusClass(st) + '">' + esc(st) + '</span></small></span>' +
      '<span class="pl-chev" aria-hidden="true">' + icon(open ? 'up' : 'down') + '</span>' +
    '</button>';
  if (open) {
    r += '<div class="pl-body">' +
      (tx.length ? '<div class="pays">' + tx.map(payRowHTML).join('') + '</div>' : '<div class="hint">אין עדיין תשלומים להתחייבות.</div>') +
      (p.note ? '<div class="pl-note">' + esc(p.note) + '</div>' : '') +
      '<div class="btnrow pl-acts"><button class="btn ghost xs" data-act="pledge-edit" data-id="' + id + '">עריכת ההתחייבות</button></div>' +
    '</div>';
  }
  return r + '</div>';
}

// ── פרטי הכרטיס ──
// השייכויות — בטופס הכרטיס, ונשמרות עם השמירה. ערך שכבר נרשם ואינו ברשימה נשאר.
function affChipsHTML(d) {
  var mine = d ? d.affiliations || [] : [], all = lookupLabels(LK_AFFIL).slice();
  mine.forEach(function (a) { if (all.indexOf(a) < 0) all.push(a); });
  return '<div class="fld"><span>שייכויות</span><div class="chips">' + all.map(function (a) {
    var on = mine.indexOf(a) >= 0;
    return '<label class="chip' + (on ? ' on' : '') + '"><input type="checkbox" class="d-aff" data-chg="aff-pick" value="' + esc(a) + '"' + (on ? ' checked' : '') + '>' + esc(a) + '</label>';
  }).join('') + (all.length ? '' : '<span class="hint">אין שייכויות ברשימה — מוסיפים בהגדרות.</span>') + '</div></div>';
}
function affRead() {
  return Array.prototype.map.call(document.querySelectorAll('.d-aff:checked'), function (x) { return x.value; });
}
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
    affChipsHTML(d) +
    '<label class="fld chk"><input type="checkbox" id="d-general"' + (d && d.is_general ? ' checked' : '') + '><span>כרטיס כללי — מגבית, פרויקט וכדומה; מוצג בנפרד בתחתית הרשימה</span></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (d ? '<button class="btn danger" data-act="donor-del" data-id="' + esc(d.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="donor-save" data-id="' + esc(d ? d.client_id : '') + '" data-ksave>שמירה</button>');
  var n = $('#d-name'); if (n && !d) n.focus();
}

function saveDonor(id) {
  var name = val('d-name');
  if (!name) { toast(MSG_NEED_NAME, null, 'bad'); return; }
  var row = { name: name, ambassador: nullable(val('d-amb')), birth_date: nullable(val('d-birth')),
              role: nullable(val('d-role')), phone: nullable(val('d-phone')), notes: nullable(val('d-notes')),
              is_general: checked('d-general'), affiliations: affRead() };
  if (id) return update('g_donors', id, row);
  return insert('g_donors', Object.assign(row, { starred: false })).then(function (d) {
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
    initSwitchHTML(p ? p.initiated : null);
  // חודש · תאריך · אמצעי — של התשלום שנרשם עם ההתחייבות; מוצגים רק כשמסמנים.
  if (!p) body += '<label class="fld chk"><input type="checkbox" id="p-now" data-chg="p-now"><span>תרומה חד-פעמית — שולמה עכשיו</span></label>' +
    '<div id="p-now-box" hidden>' + whenHTML('p', null) +
    '<label class="fld"><span>אמצעי</span>' + selectHTML('p-method', lookupLabels(LK_METHOD), '', 'אמצעי') + '</label></div>';
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
              initiated: initRead() };
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

// «יזום» — מתג צמוד למילה. התחייבות שטרם הוכרעה — המתג כבוי, ונשארת ריקה עד שנוגעים בו.
function initSwitchHTML(v) {
  return '<label class="fld tgl-row"><span>יזום</span>' +
    '<input type="checkbox" role="switch" class="tgl" id="p-init" data-chg="p-init"' + (v === true ? ' checked' : '') +
      (v == null ? '' : ' data-set="1"') + '></label>';
}
function initSwitchChange(el) { el.dataset.set = '1'; }
function initRead() { var el = $('#p-init'); return !el || !el.dataset.set ? null : el.checked; }

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

// תשלום חדש מהכרטיס — בוחרים על איזו התחייבות (ברירת המחדל — הראשונה שנותר בה), או פותחים התחייבות חדשה / תרומה חד-פעמית.
function payPickHTML(pls, cur) {
  return '<label class="fld"><span>התחייבות *</span><select class="inp" id="t-pledge" data-chg="pay-pledge" data-cur="' + esc(cur) + '">' +
    pls.map(function (q) {
      return '<option value="' + esc(q.client_id) + '"' + (q.client_id === cur ? ' selected' : '') + '>' +
        esc([q.pledge_type, q.section, q.detail].filter(Boolean).join(' · ') + ' — נותר ' + ils(leftForPledge(q))) + '</option>';
    }).join('') +
    '<option value="__new">＋ התחייבות חדשה</option><option value="__now">＋ תרומה חד-פעמית</option></select></label>';
}

function formPay(t, pledgeId, donorId) {
  var pick = !t && !pledgeId, pls = pick ? gSortPledges(pledgesOfDonor(donorId)) : [];
  if (pick && !pls.length) { formPledge(null, donorId); return; }
  if (pick) pledgeId = (pls.filter(function (q) { return leftForPledge(q) > 0; })[0] || pls[0]).client_id;
  var p = pledgeById(t ? t.pledge_client_id : pledgeId);
  if (!p) return;
  var d = donorById(p.donor_client_id);
  var amt = t ? t.amount : (leftForPledge(p) || '');
  var so = !!t && t.method === METHOD_SO;
  openModal((t ? 'עריכת תשלום — ' : 'תשלום — ') + (pick ? (d ? d.name : '') : (p.pledge_type || '')),
    (pick ? payPickHTML(pls, p.client_id) : '') +
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

// בורר ההתחייבות — התחייבות חדשה או תרומה חד-פעמית עוברות לטופס ההתחייבות; התחייבות קיימת — הסכום לנותר בה.
function payPledgePick(el) {
  var donorId = (pledgeById(el.dataset.cur || '') || {}).donor_client_id;
  if (el.value === '__new' || el.value === '__now') {
    formPledge(null, donorId);
    if (el.value === '__now') { var c = $('#p-now'), b = $('#p-now-box'); if (c) c.checked = true; if (b) b.hidden = false; }
    return;
  }
  el.dataset.cur = el.value;
  var p = pledgeById(el.value), a = $('#t-amount');
  if (p && a && !a.readOnly) a.value = leftForPledge(p) || '';
  var s = $('[data-act="pay-save"]'); if (s) s.dataset.pledge = el.value;
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

export { cardRowsHTML, formDonor, initPick, initSwitchChange, payPledgePick, formPay, formPledge, saveDonor, savePay, savePledge, soSync, soToggle, viewCards };
