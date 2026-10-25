// app/constants.js — הנתונים: שמות הטבלאות, הרשימות, המחרוזות והקבועים
import { appConfigure } from '../core/util.js';

// ── מסירת התצורה ──
// כאן הנתונים שהליבה קוראת, והחיווט — ב-main.js; הקובץ הזה נטען ראשון, לפני כל קריאה לליבה.
// העידן עולה בשינוי צורת רשומה או מפתחה, ושינוי שם טבלה הוא שינוי כזה — המראה ממופתחת בשם.
// עותק בעידן ישן אינו נדחף — הממתין בו נרשם ביומן, והוא נזרק ונמשך מלא.
var DATA_ERA = 8;

appConfigure({ DATA_ERA: DATA_ERA });

var SUPABASE_URL = self.APP.supabase.url;

var SUPABASE_ANON_KEY = self.APP.supabase.key;

// ── הרשימות — g_lookups ──
// הרשימה עצמה בטבלה וניתנת לעריכה ולגרירה; dflt — נקודת פתיחה להתקנה טרייה בלבד, והזריעה בפעולת המשתמש הראשונה.
var LK_SECTION = 'section';
var LK_PTYPE = 'ptype';
var LK_METHOD = 'method';
var LK_AFFIL = 'affiliation';
var LK_AMBASSADOR = 'ambassador';
var LK_DOMAIN = 'domain';

var LISTS = [
  { kind: LK_SECTION, title: 'סעיפים', one: 'סעיף',
    dflt: ['תרומה', 'גבייה', 'פרנסים, תאריכים, שיעורים, עליות לתורה', 'הוראות קבע', 'מגביות', 'פרויקטים', 'ריהוט וכלים'] },
  { kind: LK_PTYPE, title: 'סוגי התחייבויות', one: 'סוג',
    dflt: ['עליה לתורה', 'פרנס שבת', 'דינר', 'קמפיין', 'זכות החודש', 'ברכת השנה', 'שטר', 'מייסדים', 'זכות השמחה',
           'הוראת קבע', 'מגבית', 'חוב ישן', 'כללי', 'מפטיר יונה', 'כל נדרי', 'פתיחת נעילה', 'חתן תורה',
           'פתיחת הגשם', 'קופת צדקה', 'מקווה'] },
  { kind: LK_METHOD, title: 'אמצעי תשלום', one: 'אמצעי',
    dflt: ['העברה בנקאית', 'צ׳ק', 'ביט ופייבוקס', 'מזומן', 'אשראי'] },
  { kind: LK_AFFIL, title: 'שייכויות', one: 'שייכות',
    dflt: ['קיץ פ״ו', 'דינר פ״ז', 'מכירת מצוות פ״ז', 'אנשי מפתח', 'אגודת הנשים'] },
  { kind: LK_AMBASSADOR, title: 'שגרירים', one: 'שגריר', dflt: [] },
  { kind: LK_DOMAIN, title: 'תחומי משימות', one: 'תחום',
    dflt: ['כספים', 'שימור תורמים', 'תשתיות', 'יעד יזום'] }
];

// ── המשימות ──
// שלושת האחראים קבועים — אין להם רשימה בהגדרות.
var ASSIGNEES = ['הרב יוסי', 'אלישע', 'מענדי פרידמן'];

var STAGES = [
  { id: 'הרצה', cls: 'run' },
  { id: 'השלמה', cls: 'done' },
  { id: 'חסומה', cls: 'blocked' }
];

// ── התכנית ──
var PLAN_KINDS = ['גבייה', 'התרמה'];

// ── ההלוואות ──
var LOAN_STATUSES = ['נמסר', 'לטיפול', 'להגשה', 'בהתראה'];

// ── הרשומות — צבעי הרקע ──
var NOTE_COLORS = ['sand', 'terra', 'sage', 'sky', 'rose', 'plum'];

// ── הניווט ──
// ארבעה ראשיים ו«עוד» — והמשניים בלוח שנפתח מלמטה. ic — שם אייקון מהסט שב-app/icons.js.
var TABS = [
  { id: 'dash', ic: 'dash', label: 'דשבורד' },
  { id: 'cards', ic: 'cards', label: 'כרטיסים', title: 'כרטיסים ותשלומים' },
  { id: 'plan', ic: 'plan', label: 'תכנית' },
  { id: 'tasks', ic: 'tasks', label: 'משימות' }
];

var MORE = [
  { id: 'notes', ic: 'notes', label: 'רשומות' },
  { id: 'loans', ic: 'loans', label: 'הלוואות' },
  { id: 'budget', ic: 'budget', label: 'תקציב אירוע' },
  { id: 'settings', ic: 'settings', label: 'הגדרות' }
];

// ── הודעות פר-אפליקציה ──
var MSG_MAYBE_STALE = ') — המוצג עלול להיות לא מעודכן';
var MSG_NEED_NAME = '⚠️ נא למלא שם';
var MSG_NEED_TITLE = '⚠️ נא למלא כותרת';
var MSG_NEED_ITEM = '⚠️ נא למלא את פרטי ההוצאה';
var MSG_NEED_VALUE = '⚠️ נא להזין ערך';
var MSG_VALUE_EXISTS = '⚠️ הערך כבר קיים ברשימה';
var MSG_PICK_DONOR = '⚠️ נא לבחור כרטיס';
var MSG_PICK_TYPE = '⚠️ נא לבחור סוג';
var MSG_PICK_AMB = '⚠️ נא לבחור שגריר';
var MSG_PLEDGE_NO_AMB = '⚠️ להתחייבות אין שגריר — יש לבחור אותו בעריכת ההתחייבות';
var MSG_AMOUNT_POSITIVE = '⚠️ נא להזין סכום גדול מאפס';
var MSG_NEED_DATE = '⚠️ נא לבחור תאריך';
var MSG_PICK_VALID_MONTH = '⚠️ נא לבחור חודש תקין';
var MSG_DONOR_CREATED = 'הכרטיס נוצר';
var DONOR_NEW_LABEL = '＋ כרטיס חדש';
var DONOR_NO_PHONE = 'ללא טלפון';
var MSG_DELETE_ACT = 'מחיקה';
var MSG_DEL_SOFT = ' המחיקה רכה וניתנת לשחזור במסד.';
var MSG_DEL_DONOR = 'למחוק את הכרטיס? ההתחייבויות, התשלומים ושורות התכנית שלו יימחקו איתו.';
var MSG_DEL_PLEDGE = 'למחוק את ההתחייבות? התשלומים שלה יימחקו איתה.';
var MSG_DEL_PAY = 'למחוק את התשלום?';
var MSG_DEL_PLAN = 'למחוק את השורה מהתכנית?';
var MSG_DEL_TASK = 'למחוק את המשימה?';
var MSG_DEL_NOTE = 'למחוק את הפתק?';
var MSG_DEL_LOAN = 'למחוק את ההלוואה?';
var MSG_DEL_BUDGET = 'למחוק את ההוצאה?';
var MSG_DEL_EVENT = 'למחוק את האירוע וכל ההוצאות שבו?';
var MSG_NEED_EVENT_NAME = '⚠️ נא למלא את שם האירוע';
var MSG_DEL_LOOKUP = 'להסיר את הערך מהרשימה? רשומות שכבר משתמשות בו יישארו כמות שהן.';
var MSG_MONTH_GOAL = '🎯 יעד חודשי';

// ── עמידות אחסון מקומי ──
var KV_TABLE = 'g_settings';

// ── PUSH_CFG ──
// הסדר שומר על המפתח הזר — כרטיסים לפני התחייבויות ושורות תכנית, והתחייבויות לפני תשלומים.
var PUSH_TABLES = ['g_donors', 'g_pledges', 'g_txns', 'g_plan_items', 'g_tasks', 'g_targets',
                   'g_notes', 'g_loans', 'g_events', 'g_budget_items', KV_TABLE, 'g_lookups'];

// strip — עמודות שאינן נשמרות במראה; אין היום עמודה כזו, והמנגנון נשאר דרוך לסוד עתידי.
// אין כאן סדר תצוגה — המיון של כל רשומה בפונקציה אחת בתחום.
var TABLES = [
  { t: 'g_donors',       key: 'client_id', soft: true },
  { t: 'g_pledges',      key: 'client_id', soft: true },
  { t: 'g_txns',         key: 'client_id', soft: true },
  { t: 'g_plan_items',   key: 'client_id', soft: true },
  { t: 'g_tasks',        key: 'client_id', soft: true },
  { t: 'g_targets',      key: 'client_id', soft: true },
  { t: 'g_notes',        key: 'client_id', soft: true },
  { t: 'g_loans',        key: 'client_id', soft: true },
  { t: 'g_events',       key: 'client_id', soft: true },
  { t: 'g_budget_items', key: 'client_id', soft: true },
  { t: KV_TABLE,         key: 'key',       soft: false },
  { t: 'g_lookups',      key: 'client_id', soft: true }
];

var EPS = 0.005;

export { ASSIGNEES, DONOR_NEW_LABEL, DONOR_NO_PHONE, EPS, KV_TABLE, LISTS, LK_AFFIL, LK_AMBASSADOR,
         LK_DOMAIN, LK_METHOD, LK_PTYPE, LK_SECTION, LOAN_STATUSES, MORE,
         MSG_AMOUNT_POSITIVE, MSG_DELETE_ACT, MSG_DEL_BUDGET, MSG_DEL_DONOR, MSG_DEL_EVENT, MSG_NEED_EVENT_NAME, MSG_DEL_LOAN,
         MSG_DEL_LOOKUP, MSG_DEL_NOTE, MSG_DEL_PAY, MSG_DEL_PLAN, MSG_DEL_PLEDGE, MSG_DEL_SOFT,
         MSG_DEL_TASK, MSG_DONOR_CREATED, MSG_MAYBE_STALE, MSG_MONTH_GOAL, MSG_NEED_DATE,
         MSG_NEED_ITEM, MSG_NEED_NAME, MSG_NEED_TITLE, MSG_NEED_VALUE, MSG_PICK_AMB, MSG_PICK_DONOR,
         MSG_PICK_TYPE, MSG_PLEDGE_NO_AMB, MSG_PICK_VALID_MONTH, MSG_VALUE_EXISTS, NOTE_COLORS, PLAN_KINDS,
         PUSH_TABLES, STAGES, SUPABASE_ANON_KEY, SUPABASE_URL, TABLES, TABS };
