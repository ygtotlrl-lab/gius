// app/screens/plan.js — התכנית החודשית
// תכנית חדשה לכל חודש, בלי העברה אוטומטית; «בפועל» נגזר מתשלומי הכרטיס בחודש התכנית.
import { readNum } from '../../core/util.js';
import { pendTag } from '../../core/sync.js';
import { comboValue, esc, openModal, toast } from '../../core/ui.js';
import { LK_AMBASSADOR, MSG_PICK_DONOR, PLAN_KINDS } from '../constants.js';
import { state } from '../state.js';
import { $, dmyDate, donorById, donorFieldHTML, donorName, emptyBox, gSortPlan, ils, insert,
         lookupLabels, monthLabel, nextSort, nullable, pendRowKey, planActual, planOfMonth,
         selectHTML, sum, update, val } from '../domain.js';

function viewPlan() {
  var m = state.planMonth, list = gSortPlan(planOfMonth(m));
  var live = list.filter(function (r) { return !r.irrelevant; });
  var exp = sum(live, function (r) { return r.expected; }), act = sum(live, planActual);
  var h = '<section class="card">' +
    '<div class="monthnav">' +
      '<button class="btn ghost sm" data-act="plan-month" data-d="-1" aria-label="חודש קודם">›</button>' +
      '<b>' + esc(monthLabel(m)) + '</b>' +
      '<button class="btn ghost sm" data-act="plan-month" data-d="1" aria-label="חודש הבא">‹</button>' +
    '</div>' +
    '<div class="hero-stats stats-3">' +
      '<div class="stat"><span>שורות</span><b>' + live.length + '</b></div>' +
      '<div class="stat"><span>צפי</span><b>' + ils(exp) + '</b></div>' +
      '<div class="stat ok"><span>בפועל</span><b>' + ils(act) + '</b></div>' +
    '</div>' +
  '</section>';

  h += '<section class="card"><h2>התכנית<span class="cnt">' + list.length + '</span>' +
    '<span class="sp"><button class="btn sm" data-act="plan-new">＋ שורה</button></span></h2>';
  if (!list.length) h += emptyBox('🗓', 'אין עדיין שורות בתכנית של החודש');
  else h += list.map(function (r) {
    var a = planActual(r), id = esc(r.client_id);
    return '<div class="prow' + (r.irrelevant ? ' irr' : '') + '">' +
      '<div class="prow-main" data-act="plan-edit" data-id="' + id + '">' +
        '<b>' + esc(donorName(r.donor_client_id)) + pendTag(pendRowKey('g_plan_items', r.client_id)) + '</b>' +
        '<small><span class="badge ' + (r.kind === 'התרמה' ? 'gold' : 'brand') + '">' + esc(r.kind || '—') + '</span> ' +
          esc([r.ambassador, r.care_date ? 'טיפול ' + dmyDate(r.care_date) : '', r.note].filter(Boolean).join(' · ')) + '</small>' +
      '</div>' +
      '<div class="prow-nums"><span>צפי <b>' + ils(r.expected) + '</b></span>' +
        '<span class="' + (a > 0 ? 'ok' : '') + '">בפועל <b>' + ils(a) + '</b></span></div>' +
      '<button class="btn ghost xs" data-act="plan-irr" data-id="' + id + '" aria-pressed="' + !!r.irrelevant + '">' +
        (r.irrelevant ? 'רלוונטי' : 'לא רלוונטי') + '</button>' +
    '</div>';
  }).join('');
  h += '</section>';
  return h;
}

// השורה מקושרת לכרטיס; כרטיס שאינו קיים נוצר מהבורר. השגריר — מהכרטיס כברירה, וניתן לשינוי.
function formPlan(r) {
  var d = r ? donorById(r.donor_client_id) : null;
  openModal(r ? 'עריכת שורה' : 'שורה חדשה — ' + monthLabel(state.planMonth),
    '<div class="fld"><span>כרטיס *</span>' + donorFieldHTML('pl-donor', 'donor-plan', r ? r.donor_client_id : null) + '</div>' +
    '<div class="f2">' +
      '<label class="fld"><span>סוג</span><select class="inp" id="pl-kind">' + PLAN_KINDS.map(function (k) {
        return '<option' + ((r ? r.kind : PLAN_KINDS[0]) === k ? ' selected' : '') + '>' + esc(k) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="fld"><span>צפי</span><input class="inp" id="pl-exp" inputmode="decimal" value="' + esc(r && r.expected != null ? r.expected : '') + '"></label>' +
    '</div>' +
    '<div class="f2">' +
      '<label class="fld"><span>איש קשר</span>' + selectHTML('pl-amb', lookupLabels(LK_AMBASSADOR), r ? r.ambassador : (d && d.ambassador) || '', '— ללא —') + '</label>' +
      '<label class="fld"><span>תאריך טיפול</span><input class="inp" type="date" id="pl-care" value="' + esc(r && r.care_date ? r.care_date : '') + '"></label>' +
    '</div>' +
    '<label class="fld"><span>הערות</span><input class="inp" id="pl-note" value="' + esc(r ? r.note || '' : '') + '"></label>',
    '<button class="btn ghost" data-act="modal-close">ביטול</button>' +
    (r ? '<button class="btn danger" data-act="plan-del" data-id="' + esc(r.client_id) + '">מחיקה</button>' : '') +
    '<button class="btn" data-act="plan-save" data-id="' + esc(r ? r.client_id : '') + '" data-ksave>שמירה</button>');
}

function savePlan(id) {
  var donor = comboValue('pl-donor');
  if (!donor) { toast(MSG_PICK_DONOR, null, 'bad'); return; }
  var exp = $('#pl-exp');
  var row = { donor_client_id: donor, kind: val('pl-kind') || PLAN_KINDS[0],
              expected: exp && exp.value.trim() !== '' ? readNum(exp, 0) : null,
              ambassador: nullable(val('pl-amb')), care_date: nullable(val('pl-care')), note: nullable(val('pl-note')) };
  if (id) return update('g_plan_items', id, row);
  return insert('g_plan_items', Object.assign(row, { plan_month: state.planMonth, irrelevant: false,
                                                     sort: nextSort(planOfMonth(state.planMonth)) }));
}

export { formPlan, savePlan, viewPlan };
