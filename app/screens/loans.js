// app/screens/loans.js — הלוואות
import { readNum } from '../../core/util.js';
import { pendTag } from '../../core/sync.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { LOAN_STATUSES, MSG_AMOUNT_POSITIVE, MSG_NEED_NAME } from '../constants.js';
import { state } from '../state.js';
import { $, dmyDate, emptyBox, gSortLoans, ils, insert, nullable, pendRowKey, sum, update, val } from '../domain.js';

var LOAN_CLS = { 'נמסר': 'ok', 'לטיפול': 'warn', 'להגשה': 'brand', 'בהתראה': 'bad' };

function viewLoans() {
  var list = gSortLoans(state.loans);
  var h = '<section class="card"><h2>הלוואות<span class="cnt">' + list.length + '</span>' +
    '<span class="sp"><button class="btn sm" data-act="loan-new">＋ הלוואה</button></span></h2>';
  if (!list.length) return h + emptyBox('⇄', 'אין הלוואות רשומות') + '</section>';
  h += list.map(function (l) {
    return '<div class="row" data-act="loan-edit" data-id="' + esc(l.client_id) + '">' +
      '<div class="main"><b>' + esc(l.lender) + pendTag(pendRowKey('g_loans', l.client_id)) + '</b>' +
        '<small>' + esc(['נלקחה ' + dmyDate(l.taken_date), l.repay_terms, l.last_check_date ? 'נבדק ' + dmyDate(l.last_check_date) : '', l.note]
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
    '<div class="f2">' +
      '<label class="fld"><span>תאריך לקיחה</span><input class="inp" type="date" id="o-taken" value="' + esc(l && l.taken_date ? l.taken_date : '') + '"></label>' +
      '<label class="fld"><span>תאריך בדיקה אחרון</span><input class="inp" type="date" id="o-check" value="' + esc(l && l.last_check_date ? l.last_check_date : '') + '"></label>' +
    '</div>' +
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
  var row = { lender: lender, amount: amount, taken_date: nullable(val('o-taken')), last_check_date: nullable(val('o-check')),
              repay_terms: nullable(val('o-terms')), status: nullable(val('o-status')), note: nullable(val('o-note')) };
  return id ? update('g_loans', id, row) : insert('g_loans', row);
}

export { formLoan, saveLoan, viewLoans };
