// app/screens/loans.js — הלוואות
import { readNum } from '../../core/util.js';
import { pendTag } from '../../core/sync.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { LOAN_STATUSES, MSG_AMOUNT_POSITIVE, MSG_NEED_NAME } from '../constants.js';
import { state } from '../state.js';
import { $, dmyDate, emptyBox, gSortLoans, ils, insert, nullable, pendRowKey, sum, update, val } from '../domain.js';

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

function viewLoans() {
  var list = gSortLoans(state.loans, state.loansSort);
  var h = '<section class="card cards-tools"><div class="tools-row"><div class="seg" role="group" aria-label="מיון">' +
    [['name', 'שם'], ['taken', 'תאריך לקיחה'], ['end', 'תאריך סיום'], ['status', 'סטטוס']].map(function (o) {
      return '<button class="' + (state.loansSort === o[0] ? 'on' : '') + '" data-act="loans-sort" data-v="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div></div></section>' +
    '<section class="card"><h2>הלוואות<span class="cnt">' + list.length + '</span>' +
    '<span class="sp"><button class="btn sm" data-act="loan-new">＋ הלוואה</button></span></h2>';
  if (!list.length) return h + emptyBox('⇄', 'אין הלוואות רשומות') + '</section>';
  h += list.map(function (l) {
    return '<div class="row" data-act="loan-edit" data-id="' + esc(l.client_id) + '">' +
      '<div class="main"><b>' + esc(l.lender) + pendTag(pendRowKey('g_loans', l.client_id)) + '</b>' +
        '<small>' + esc(['נלקחה ' + (loanWhen(l, 'taken') || '—'), l.repay_terms, loanWhen(l, 'last_check') ? 'סיום ' + loanWhen(l, 'last_check') : '', l.note]
          .filter(Boolean).join(' · ')) + '</small></div>' +
      '<div class="end">' + ils(l.amount) + (l.status ? '<small><span class="badge ' + (LOAN_CLS[l.status] || '') + '">' + esc(l.status) + '</span></small>' : '') + '</div>' +
    '</div>';
  }).join('');
  h += '<div class="total-row"><span>סה״כ</span><b>' + ils(sum(list, function (l) { return l.amount; })) + '</b></div>';
  return h + '</section>';
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

export { formLoan, saveLoan, viewLoans };
