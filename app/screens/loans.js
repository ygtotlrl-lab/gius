// app/screens/loans.js — הלוואות
import { readNum } from '../../core/util.js';
import { pendTag } from '../../core/sync.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { LOAN_STATUSES, MSG_AMOUNT_POSITIVE, MSG_NEED_MOVE_AMOUNT, MSG_NEED_NAME } from '../constants.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import { $, dmyDate, emptyBox, gSortLoanMoves, gSortLoans, ils, insert, nextSort, nullable, pendRowKey, selectHTML, sum, update, val } from '../domain.js';

// תאריך מלא, או חודש בלבד כשהיום אינו ידוע.
function loanWhen(l, k) {
  if (l[k + '_date']) return dmyDate(l[k + '_date']);
  var m = l[k + '_month'];
  return m ? m.slice(5, 7) + '/' + m.slice(0, 4) : '';
}

// שדה תאריך, ולצדו חודש בלבד — אחד מהשניים נשמר.
function whenFieldsHTML(id, label, l, k) {
  return '<div class="f2">' +
    '<label class="fld"><span>' + label + '</span><input class="inp" type="date" id="' + id + '" value="' + esc(l && l[k + '_date'] ? l[k + '_date'] : '') + '"></label>' +
    '<label class="fld"><span>או חודש בלבד</span><input class="inp" type="month" id="' + id + '-m" value="' + esc(l && l[k + '_month'] ? l[k + '_month'] : '') + '"></label>' +
  '</div>';
}

var LOAN_CLS = { 'נמסר': 'ok', 'לטיפול': 'warn', 'להגשה': 'brand', 'בהתראה': 'bad' };

// היתרה — סכום ההלוואה פחות התנועות שלה; נגזרת ואינה נשמרת.
function movesOf(id) { return gSortLoanMoves(state.loanMoves.filter(function (m) { return m.loan_client_id === id; })); }
function loanBalance(l) { return (Number(l.amount) || 0) - sum(movesOf(l.client_id), function (m) { return m.amount; }); }

function loanMatches() {
  var q = String(state.loansQ || '').trim().toLowerCase();
  var st = state.loansStatus;
  return gSortLoans(state.loans.filter(function (l) {
    if (st && l.status !== st) return false;
    return !q || String(l.lender || '').toLowerCase().indexOf(q) >= 0;
  }), state.loansSort);
}

function viewLoans() {
  return '<section class="card list-tools">' +
      '<label class="search-box"><input aria-label="חיפוש הלוואה" class="inp search" id="loans-q" data-inp="loans-q" placeholder="חיפוש הלוואה" value="' + esc(state.loansQ) + '">' +
        '<span class="search-ic">' + icon('search') + '</span></label>' +
      '<div class="tools-row">' + selectHTML('loans-status', LOAN_STATUSES, state.loansStatus, 'סינון לפי סטטוס', 'loans-status') +
      '<div class="seg" role="group" aria-label="מיון">' +
      [['name', 'שם'], ['taken', 'תאריך לקיחה'], ['end', 'תאריך סיום'], ['status', 'סטטוס']].map(function (o) {
        return '<button class="' + (state.loansSort === o[0] ? 'on' : '') + '" data-act="loans-sort" data-v="' + o[0] + '">' + o[1] + '</button>';
      }).join('') + '</div></div></section>' +
    '<section class="card" id="loans-list">' + loansBodyHTML() + '</section>';
}

// הלוואה סגורה — מלווה · פרטים · יתרה; לחיצה פותחת את התנועות, הלוואה אחת פתוחה בכל פעם.
function loansBodyHTML() {
  var list = loanMatches();
  if (state.loansOpen && !list.some(function (l) { return l.client_id === state.loansOpen; })) state.loansOpen = null;
  var h = '<h2>הלוואות<span class="cnt">' + list.length + '</span>' +
    '<span class="sp"><button class="btn sm" data-act="loan-new">' + icon('plus') + 'הלוואה</button></span></h2>';
  if (!list.length) return h + emptyBox('⇄', state.loans.length ? 'אין הלוואה התואמת את החיפוש או הסינון' : 'אין הלוואות רשומות');
  h += '<div class="evs">' + list.map(function (l) {
    var open = state.loansOpen === l.client_id, id = esc(l.client_id), moves = movesOf(l.client_id), bal = loanBalance(l);
    var r = '<div class="ev' + (open ? ' open' : '') + '">' +
      '<button class="ev-hd" data-act="loan-toggle" data-id="' + id + '" aria-expanded="' + open + '">' +
        '<span class="ev-name"><b>' + esc(l.lender) + pendTag(pendRowKey('g_loans', l.client_id)) +
          (l.status ? ' <span class="badge ' + (LOAN_CLS[l.status] || '') + '">' + esc(l.status) + '</span>' : '') + '</b>' +
          '<small>' + esc(['נלקחה ' + (loanWhen(l, 'taken') || '—'), l.repay_terms, loanWhen(l, 'last_check') ? 'סיום ' + loanWhen(l, 'last_check') : '', l.note]
            .filter(Boolean).join(' · ')) + '</small></span>' +
        '<span class="ln-amt"><small>יתרה</small><b>' + ils(bal) + '</b><small>מתוך ' + ils(l.amount) + '</small></span>' +
        '<span class="ev-chev" aria-hidden="true">' + icon(open ? 'up' : 'down') + '</span>' +
      '</button>';
    if (open) {
      r += '<div class="ev-body">' +
        (moves.length ? moves.map(function (m) {
          return '<div class="row" data-act="loan-move-edit" data-id="' + esc(m.client_id) + '">' +
            '<div class="main"><b>' + ils(m.amount) + pendTag(pendRowKey('g_loan_moves', m.client_id)) + '</b>' +
              '<small>' + esc(m.note || '—') + '</small></div></div>';
        }).join('') : emptyBox('⇄', 'אין עדיין תנועות בהלוואה')) +
        '<div class="total-row"><span>יתרה</span><b>' + ils(bal) + '</b></div>' +
        '<div class="lm-add" data-ks>' +
          '<input class="inp" id="lm-amt" inputmode="decimal" placeholder="סכום" aria-label="סכום התנועה">' +
          '<input class="inp" id="lm-note" placeholder="הערה" aria-label="הערה לתנועה">' +
          '<button class="btn sm" data-act="loan-move-add" data-id="' + id + '" data-ksave>' + icon('plus') + 'תנועה</button>' +
        '</div>' +
        '<div class="btnrow ev-acts"><button class="btn ghost sm" data-act="loan-edit" data-id="' + id + '">עריכת ההלוואה</button></div>' +
      '</div>';
    }
    return r + '</div>';
  }).join('') + '</div>';
  h += '<div class="total-row"><span>סה״כ יתרה</span><b>' + ils(sum(list, loanBalance)) + '</b></div>';
  return h;
}

// עריכת תנועה — סכום והערה, ומחיקה.
function formLoanMove(m) {
  openModal('עריכת תנועה',
    '<div class="f2">' +
      '<label class="fld"><span>סכום *</span><input class="inp" id="lm-e-amt" inputmode="decimal" value="' + esc(m.amount) + '"></label>' +
      '<label class="fld"><span>הערה</span><input class="inp" id="lm-e-note" value="' + esc(m.note || '') + '"></label>' +
    '</div>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    '<button class="btn danger" data-act="loan-move-del" data-id="' + esc(m.client_id) + '">מחיקה</button>' +
    '<button class="btn" data-act="loan-move-save" data-id="' + esc(m.client_id) + '" data-ksave>שמירה</button>');
}

function saveLoanMove(id) {
  var amount = readNum($('#lm-e-amt'), 0);
  if (!amount) { toast(MSG_NEED_MOVE_AMOUNT, null, 'bad'); return; }
  return update('g_loan_moves', id, { amount: amount, note: nullable(val('lm-e-note')) });
}

// תנועה — סכום (חובה, לא אפס; שלילי מגדיל את היתרה) והערה.
function addLoanMove(id) {
  var amount = readNum($('#lm-amt'), 0);
  if (!amount) { toast(MSG_NEED_MOVE_AMOUNT, null, 'bad'); return; }
  return insert('g_loan_moves', { loan_client_id: id, amount: amount, note: nullable(val('lm-note')), sort: nextSort(movesOf(id)) });
}

function formLoan(l) {
  openModal(l ? 'עריכת הלוואה' : 'הלוואה חדשה',
    '<div class="f2">' +
      '<label class="fld"><span>מלווה *</span><input class="inp" id="o-lender" value="' + esc(l ? l.lender : '') + '"></label>' +
      '<label class="fld"><span>סכום *</span><input class="inp" id="o-amount" inputmode="decimal" value="' + esc(l ? l.amount : '') + '"></label>' +
    '</div>' +
    whenFieldsHTML('o-taken', 'תאריך לקיחה', l, 'taken') +
    whenFieldsHTML('o-check', 'תאריך סיום (צ׳ק אחרון)', l, 'last_check') +
    '<label class="fld"><span>תנאי החזר</span><input class="inp" id="o-terms" value="' + esc(l ? l.repay_terms || '' : '') + '"></label>' +
    '<label class="fld"><span>סטטוס</span><select class="inp" id="o-status"><option value="">— ללא —</option>' + LOAN_STATUSES.map(function (s) {
      return '<option' + (l && l.status === s ? ' selected' : '') + '>' + esc(s) + '</option>';
    }).join('') + '</select></label>' +
    '<label class="fld"><span>הערה</span><input class="inp" id="o-note" value="' + esc(l ? l.note || '' : '') + '"></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (l ? '<button class="btn danger" data-act="loan-del" data-id="' + esc(l.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="loan-save" data-id="' + esc(l ? l.client_id : '') + '" data-ksave>שמירה</button>');
}

function saveLoan(id) {
  var lender = val('o-lender'), amount = readNum($('#o-amount'), 0);
  if (!lender) { toast(MSG_NEED_NAME, null, 'bad'); return; }
  if (!(amount > 0)) { toast(MSG_AMOUNT_POSITIVE, null, 'bad'); return; }
  var td = nullable(val('o-taken')), cd = nullable(val('o-check'));
  var row = { lender: lender, amount: amount,
              taken_date: td, taken_month: td ? null : nullable(val('o-taken-m')),
              last_check_date: cd, last_check_month: cd ? null : nullable(val('o-check-m')),
              repay_terms: nullable(val('o-terms')), status: nullable(val('o-status')), note: nullable(val('o-note')) };
  return id ? update('g_loans', id, row) : insert('g_loans', row);
}

export { addLoanMove, formLoan, formLoanMove, saveLoanMove, loansBodyHTML, saveLoan, viewLoans };
