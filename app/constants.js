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
           'הוראת קבע', 'מגבית', 'חוב ישן', 'כללי', 'ימים נוראים וחגים', 'קופת צדקה', 'מקווה'] },
  { kind: LK_METHOD, title: 'אמצעי תשלום', one: 'אמצעי',
    dflt: ['העברה בנקאית', 'צ׳ק', 'ביט ופייבוקס', 'מזומן', 'אשראי', 'הו״ק'] },
  { kind: LK_AFFIL, title: 'שייכויות', one: 'שייכות',
    dflt: ['קיץ פ״ו', 'דינר פ״ז', 'מכירת מצוות פ״ז', 'אנשי מפתח', 'אגודת הנשים'] },
  { kind: LK_AMBASSADOR, title: 'שגרירים', one: 'שגריר', dflt: [] },
  { kind: LK_DOMAIN, title: 'תחומי משימות', one: 'תחום',
    dflt: ['כספים', 'שימור תורמים', 'תשתיות', 'יעד יזום'] }
];

// ── המשימות ──

var STAGES = [
  { id: 'בעבודה', cls: 'run' },
  { id: 'הושלם', cls: 'done' },
  { id: 'לא רלוונטי', cls: 'off' }
];

// ── התכנית ──
var PLAN_KINDS = ['גבייה', 'התרמה'];

// ── ההלוואות ──
// בסדר הטיפול — מה שמחכה לפעולה ראשון, ומה שנמסר בסוף; זה גם סדר המיון לפי סטטוס.
var LOAN_STATUSES = ['להגשה', 'לטיפול', 'בהתראה', 'נמסר'];

// ── השטרות ──
// «תרם» ו«התחייב» — שתי תוצאות נפרדות, ושתיהן נושאות סכום ואמצעי (SHT_GIVE, הסכום רשות).
// «נסלק» אינה תוצאה ואינה שיחה: בדיקה שהכסף של «תרם» נסלק — הסימון «טופל» על שיחת «תרם», מ«ממתינים לטיפול»; ובבורר «לפי תוצאה» — מעל «תרם».
// תוצאת השיחה: fin — האיש יצא מהתור; בלי fin — «לא ענה» חוזר לתור אחרי SHT_RETRY_MS, ו«לחזור אליו» במועד שנקבע.
var SHT_STATUS = {
  na:    { l: 'לא ענה', cls: '' },
  wrong: { l: 'מספר שגוי', cls: '', fin: true },
  yes:   { l: 'תרם', cls: 'ok', fin: true },
  pl:    { l: 'התחייב', cls: 'gold', fin: true },
  int:   { l: 'ממתין לפרטים', cls: 'brand', fin: true },
  cb:    { l: 'לחזור אליו', cls: 'warn' },
  no:    { l: 'לא מעוניין', cls: '', fin: true },
  rmv:   { l: 'להסיר מהרשימה', cls: 'bad', fin: true }
};
var SHT_GIVE = ['yes', 'pl'];
// «ממתינים לטיפול» — המצב · הכפתור · המצבים שהלחיצה מעבירה אליהם: מעבר — שיחה חדשה ביום הלחיצה, והקודמת מסומנת «טופל»;
// ו«נסלק» (בלי מצב הבא) — רק הסימון «טופל» על שיחת «תרם», בלי שיחה חדשה.
var SHT_NEXT = [['int', 'טופל', ['pl', 'yes']], ['pl', 'תרם', ['yes']], ['yes', 'נסלק', []]];
var SHT_RETRY_MS = 2 * 60 * 60 * 1000;
// נעילה בלי סימן חיים — משתחררת מעצמה; סימן החיים כל דקה.
var SHT_LOCK_MS = 15 * 60 * 1000;
var SHT_BEAT_MS = 60 * 1000;
var SHT_PAGE = 60;

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
  { id: 'loans', ic: 'loans', label: 'הלוואות' },
  { id: 'shtarot', ic: 'shtarot', label: 'שטרות' },
  { id: 'notes', ic: 'notes', label: 'רשומות' },
  { id: 'budget', ic: 'budget', label: 'תקציב אירוע' },
  { id: 'settings', ic: 'settings', label: 'הגדרות' }
];

// ── הודעות פר-אפליקציה ──
var MSG_MAYBE_STALE = ') — המוצג עלול להיות לא מעודכן';
// החודש הראשון של האפליקציה — המעבר מהגיליון; הגרפים מתחילים בו, ומה שלפניו אינו נתון של הדשבורד.
var APP_FIRST_MONTH = '2026-06';
var MSG_NEED_NAME = 'נא למלא שם';
var MSG_PICK_DATE = 'בוחרים תאריך — עברי או לועזי';
// הטלפון בכרטיס — חיוג ו-וואטסאפ מהפס, והקידומת והמספר בטופס
var MSG_NO_PHONE = 'אין מספר טלפון בכרטיס';
var MSG_PHONE_PRE = 'חסרה קידומת לטלפון';
var MSG_PHONE_NUM = 'חסר מספר הטלפון אחרי הקידומת';
var MSG_PHONE_IL = 'מספר ישראלי — 9 או 10 ספרות עם הקידומת';
// סוג ההלוואה — לפי ההחזר: החזר צ׳קים (`checks` — לוח צ׳קים חודשי) או הסדר או תאריך (`long` — אחד מארבעה אופנים, `LOAN_VIA`).
// שמות החודשים המקוצרים — בתוויות הגרפים (הדשבורד וההלוואות).
var MONTH_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
var LOAN_KINDS = { checks: 'החזר צ׳קים', long: 'הסדר או תאריך' };
// אופן ההחזר בהסדר או תאריך — אריח לכל אחד: [מפתח, שם, אייקון]; «ללא תאריך» — בלי תשלומים ובלי מועד.
var LOAN_VIA = [['cash', 'מזומן', 'cash'], ['bank', 'העברה בנקאית', 'bank'], ['date', 'בתאריך', 'calendar'], ['nodate', 'ללא תאריך', 'nodate']];
var MSG_PLAN_AMT = 'נא להזין סכום לכל תשלום';
var MSG_LOAN_VIA = 'נא לבחור את אופן ההחזר — מזומן, העברה בנקאית, בתאריך או ללא תאריך';
var MSG_CK_COUNT = 'נא להזין את מספר התשלומים';
var MSG_CK_AMT = 'נא להזין סכום לכל תשלום';
var MSG_CK_FIRST = 'נא לבחור את חודש התשלום הראשון';
var MSG_LOAN_KIND = 'נא לבחור את סוג ההחזר';
var MSG_LOAN_TAKEN = 'נא לבחור תאריך לקיחה — תאריך מלא או חודש';
var MSG_LOAN_STATUS = 'נא לבחור סטטוס';
var MSG_SET_AMT = 'נא להזין סכום לחודש לדמי ההתפשרות';
var MSG_NEED_LENDER = 'נא למלא את שם המלווה';
var MSG_CK_SUM_PRE = 'סך התשלומים פחות מסכום ההלוואה: ';
var MSG_NEED_TITLE = 'נא למלא כותרת';
// מסך המשימות — החלקים של «בעבודה», בסדרם, והשאלות שבעיגול
var TASK_SECTIONS = [['soon', 'החודש הקרוב'], ['late', 'עבר זמנן'], ['none', 'ללא תאריך'], ['later', 'מאוחר יותר']];
var TASK_SOON_DAYS = 30;
var MSG_TASK_DONE_Q = 'להעביר את המשימה להושלמה?';
var MSG_TASK_DONE_ACT = 'הושלמה';
var MSG_TASK_BACK_Q = 'להחזיר את המשימה לעבודה?';
var MSG_TASK_BACK_ACT = 'חזרה לעבודה';
var MSG_TASK_NEXT = 'המשימה החוזרת נקבעה ל-';
var MSG_NEED_ITEM = 'נא למלא את פרטי ההוצאה';
var MSG_NEED_VALUE = 'נא להזין ערך';
var MSG_VALUE_EXISTS = 'הערך כבר קיים ברשימה';
var MSG_PICK_DONOR = 'נא לבחור כרטיס';
var MSG_PICK_TYPE = 'נא לבחור סוג';
var MSG_PICK_AMB = 'נא לבחור שגריר';
var MSG_PLEDGE_NO_AMB = 'להתחייבות אין שגריר — יש לבחור אותו בעריכת ההתחייבות';
var MSG_AMOUNT_POSITIVE = 'נא להזין סכום גדול מאפס';
var MSG_SO_COUNT = 'מספר הפעימות — 2 לפחות';
var MSG_SO_FIRST = 'הפעימה הראשונה — סכום חיובי';
var MSG_SO_FIRST_OVER = 'הפעימה הראשונה גדולה מהסכום הכולל';
// האמצעי שפותח את הפעימות — שורה ברשימת האמצעים, והתשלום עצמו מסווג לפי installments ולא לפי התווית.
var METHOD_SO = 'הו״ק';
var MSG_NEED_DATE = 'נא לבחור תאריך';
var MSG_PICK_VALID_MONTH = 'נא לבחור חודש תקין';
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
var MSG_DEL_LOAN = 'למחוק את ההלוואה וכל התנועות שבה?';
var MSG_DEL_LOAN_MOVE = 'למחוק את התנועה?';
var MSG_NEED_MOVE_AMOUNT = 'נא להזין את סכום התנועה';
var MSG_DEL_BUDGET = 'למחוק את ההוצאה?';
var MSG_DEL_EVENT = 'למחוק את האירוע וכל ההוצאות שבו?';
var MSG_NEED_EVENT_NAME = 'נא למלא את שם האירוע';
var MSG_DEL_LOOKUP = 'להסיר את הערך מהרשימה? רשומות שכבר משתמשות בו יישארו כמות שהן.';
var MSG_DEL_SHT = 'למחוק את האיש מרשימת השטרות? השיחות שלו יימחקו איתו.';
var MSG_DEL_SHT_CALL = 'למחוק את השיחה?';
var MSG_SHT_LOCKED = 'האיש בשימוש אצל טלפן אחר';
var MSG_SHT_STAR_T = 'פנייה באישור אלישע';
var MSG_SHT_STAR_B = 'הכרטיס של האיש מסומן בכוכב. פונים אליו רק אחרי אישור מאלישע.';
var MSG_SHT_AMB = 'נא לבחור את השגריר המטלפן';
var MSG_SHT_PICK = 'נא לבחור את תוצאת השיחה';
var MSG_SHT_PHONE = 'נא למלא טלפון';
var MSG_SHT_DUP = 'כבר ברשימה: ';
var MSG_SHT_NO_NAME = 'שם לא ידוע';
var MSG_SHT_LINK_COPIED = 'הקישור האישי הועתק';
var MSG_SHT_LINK_FAIL = 'ההעתקה נכשלה — נסה שוב';
// דף השגרירים — בריפו הדפים הציבוריים (dapim), ולא באפליקציה: מי שמקבל קישור אינו מגיע לאפליקציה.
var SHT_PAGE_URL = 'https://ygtotlrl-lab.github.io/dapim/shtarot/';
var MSG_MONTH_GOAL = 'יעד חודשי';

// ── עמידות אחסון מקומי ──
var KV_TABLE = 'g_settings';

// ── PUSH_CFG ──
// הסדר שומר על המפתח הזר — כרטיסים לפני התחייבויות ושורות תכנית, התחייבויות לפני תשלומים, והלוואות לפני תנועותיהן;
// אנשי השטרות אחרי הכרטיסים ולפני שיחותיהם, והקישורים האישיים אחרי הרשימות.
var PUSH_TABLES = ['g_donors', 'g_pledges', 'g_txns', 'g_plan_items', 'g_tasks', 'g_targets',
                   'g_notes', 'g_loans', 'g_loan_moves', 'g_events', 'g_budget_items',
                   'g_shtar_people', 'g_shtar_calls', KV_TABLE, 'g_lookups', 'g_shtar_links'];

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
  { t: 'g_loan_moves',   key: 'client_id', soft: true },
  { t: 'g_events',       key: 'client_id', soft: true },
  { t: 'g_budget_items', key: 'client_id', soft: true },
  { t: 'g_shtar_people', key: 'client_id', soft: true },
  { t: 'g_shtar_calls',  key: 'client_id', soft: true },
  { t: KV_TABLE,         key: 'key',       soft: false },
  { t: 'g_lookups',      key: 'client_id', soft: true },
  { t: 'g_shtar_links',  key: 'client_id', soft: true }
];

var EPS = 0.005;


// כותרות החלונות והודעות השמירה — מחרוזת למשתמש היא קבוע.
var TTL_MORE = 'עוד';
var TTL_EVENT_EDIT = 'עריכת אירוע';
var TTL_EVENT_NEW = 'אירוע חדש';
var TTL_EXP_EDIT = 'עריכת הוצאה';
var TTL_EXP_NEW = 'הוצאה חדשה';
var TTL_MOVE_EDIT = 'עריכת תנועה';
var TTL_LOAN_EDIT = 'עריכת הלוואה';
var TTL_LOAN_NEW = 'הלוואה חדשה';
var TTL_EDIT_PRE = 'עריכת ';
var TTL_ADD_PRE = 'הוספת ';
var TTL_GOAL_DEFAULT = 'יעד חודשי קבוע';
var TTL_DONOR_EDIT = 'עריכת כרטיס';
var TTL_DONOR_NEW = 'כרטיס חדש';
var TTL_PLEDGE_EDIT = 'עריכת התחייבות — ';
var TTL_PLEDGE_NEW = 'התחייבות — ';
var TTL_PAY_EDIT = 'עריכת תשלום — ';
var TTL_PAY_NEW = 'תשלום — ';
var TTL_PLAN_EDIT = 'עריכת שורה';
var TTL_PLAN_NEW = 'שורה חדשה — ';
var TTL_TASK_EDIT = 'עריכת משימה';
var TTL_TASK_NEW = 'משימה חדשה';
var TTL_CALL_EDIT = 'עריכת שיחה';
var TTL_SHT_EDIT = 'עריכת הפרטים';
var TTL_SHT_NEW = 'הוספה לרשימה';
var MSG_SHT_CLEARED = 'נסלק';
var MSG_SHT_CLEARED_PRE = 'לסמן שהתרומה של ';
var MSG_SHT_CLEARED_Q = ' נסלקה?';
var MSG_SHT_CLEARED_OK = 'סומן שנסלק';
var MSG_SHT_DUP_TITLE = 'כפילות';
var MSG_SHT_DUP_Q = '. לשמור בכל זאת?';
var MSG_SAVE_ACT = 'שמירה';
var MSG_DELETED = 'נמחק';
var MSG_SAVED_OK = 'נשמר';
var MSG_TASK_SAVED = 'המשימה נשמרה';
var MSG_CALL_SAVED = 'השיחה נשמרה';
var MSG_SHT_MOVED = 'הועבר';
var MSG_REMOVED = 'הוסר';
var MSG_GOAL_SAVED = 'היעד נשמר';
var MSG_GOAL_RESET = 'החודש חזר ליעד הקבוע';
var MSG_GOAL_DEFAULT_SAVED = 'היעד הקבוע נשמר';

export { TASK_SECTIONS, TASK_SOON_DAYS, MSG_TASK_DONE_Q, MSG_TASK_DONE_ACT, MSG_TASK_BACK_Q, MSG_TASK_BACK_ACT, MSG_TASK_NEXT, DONOR_NEW_LABEL, DONOR_NO_PHONE, EPS, KV_TABLE, LISTS, LK_AFFIL, LK_AMBASSADOR,
         LK_DOMAIN, LK_METHOD, LK_PTYPE, LK_SECTION, LOAN_STATUSES, MORE, MSG_DEL_SHT, MSG_DEL_SHT_CALL, MSG_SHT_AMB, MSG_SHT_DUP,
         MSG_SHT_LINK_COPIED, MSG_SHT_LINK_FAIL, MSG_SHT_LOCKED, MSG_SHT_NO_NAME, MSG_SHT_STAR_B, MSG_SHT_STAR_T, MSG_SHT_PICK, MSG_SHT_PHONE, SHT_BEAT_MS, SHT_GIVE, SHT_LOCK_MS, SHT_NEXT, SHT_PAGE, SHT_PAGE_URL, SHT_RETRY_MS, SHT_STATUS,
         METHOD_SO, MSG_AMOUNT_POSITIVE, MSG_SO_COUNT, MSG_SO_FIRST, MSG_SO_FIRST_OVER, MSG_DELETE_ACT, MSG_DEL_BUDGET, MSG_DEL_DONOR, MSG_DEL_EVENT, MSG_NEED_EVENT_NAME, MSG_DEL_LOAN, MSG_DEL_LOAN_MOVE, MSG_NEED_MOVE_AMOUNT,
         MSG_DEL_LOOKUP, MSG_DEL_NOTE, MSG_DEL_PAY, MSG_DEL_PLAN, MSG_DEL_PLEDGE, MSG_DEL_SOFT,
         MSG_DEL_TASK, MSG_DONOR_CREATED, MSG_MAYBE_STALE, MSG_MONTH_GOAL, MSG_NEED_DATE,
         APP_FIRST_MONTH, LOAN_VIA, MSG_LOAN_VIA, MSG_PLAN_AMT, MSG_PICK_DATE, MSG_NO_PHONE, MSG_PHONE_PRE, MSG_PHONE_NUM, MSG_PHONE_IL, MSG_NEED_ITEM, MSG_NEED_NAME, LOAN_KINDS, MONTH_SHORT, MSG_CK_AMT, MSG_CK_COUNT, MSG_CK_FIRST, MSG_CK_SUM_PRE, MSG_LOAN_KIND, MSG_LOAN_STATUS, MSG_LOAN_TAKEN, MSG_NEED_LENDER, MSG_SET_AMT, MSG_NEED_TITLE, MSG_NEED_VALUE, MSG_PICK_AMB, MSG_PICK_DONOR,
         MSG_PICK_TYPE, MSG_PLEDGE_NO_AMB, MSG_PICK_VALID_MONTH, MSG_VALUE_EXISTS, NOTE_COLORS, PLAN_KINDS,
         PUSH_TABLES, STAGES, SUPABASE_ANON_KEY, SUPABASE_URL, TABLES, TABS,
         TTL_MORE, TTL_EVENT_EDIT, TTL_EVENT_NEW, TTL_EXP_EDIT, TTL_EXP_NEW, TTL_MOVE_EDIT, TTL_LOAN_EDIT, TTL_LOAN_NEW, TTL_EDIT_PRE, TTL_ADD_PRE, TTL_GOAL_DEFAULT, TTL_DONOR_EDIT, TTL_DONOR_NEW, TTL_PLEDGE_EDIT, TTL_PLEDGE_NEW, TTL_PAY_EDIT, TTL_PAY_NEW, TTL_PLAN_EDIT, TTL_PLAN_NEW, TTL_TASK_EDIT, TTL_TASK_NEW, TTL_CALL_EDIT, TTL_SHT_EDIT, TTL_SHT_NEW, MSG_SHT_CLEARED, MSG_SHT_CLEARED_PRE, MSG_SHT_CLEARED_Q, MSG_SHT_CLEARED_OK, MSG_SHT_DUP_TITLE, MSG_SHT_DUP_Q, MSG_SAVE_ACT, MSG_DELETED, MSG_SAVED_OK, MSG_TASK_SAVED, MSG_CALL_SAVED, MSG_SHT_MOVED, MSG_REMOVED, MSG_GOAL_SAVED, MSG_GOAL_RESET, MSG_GOAL_DEFAULT_SAVED };
