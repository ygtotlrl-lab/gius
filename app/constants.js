// app/constants.js — הנתונים: שמות הטבלאות, המחרוזות והקבועים
import { appConfigure } from '../core/util.js';

// ── מסירת התצורה ──
// כאן הנתונים שהליבה קוראת, והחיווט — ב-main.js; הקובץ הזה נטען ראשון, לפני כל קריאה לליבה.
// העידן עולה בשינוי צורת רשומה או מפתחה, ושינוי שם טבלה הוא שינוי כזה — המראה ממופתחת בשם.
// עותק בעידן ישן אינו נדחף — הממתין בו נרשם ביומן, והוא נזרק ונמשך מלא.
var DATA_ERA = 4;

appConfigure({ DATA_ERA: DATA_ERA });

var SUPABASE_URL = self.APP.supabase.url;

var SUPABASE_ANON_KEY = self.APP.supabase.key;

// נקודת פתיחה למצב ריק בלבד — הרשימות עצמן בטבלת ההגדרות וניתנות לעריכה.
var DEFAULT_CONFIG = {
  categories: ['תרומה', 'גביה', 'מגביות', 'פרוייקטים', 'הוראות קבע', 'פרנסים ותאריכים'],
  causes: [],
  domains: ['כספים', 'שימור תורמים', 'תשתיות', 'יעד יזום']
};

var CONFIG_KEYS = [
  { key: 'categories', label: 'סעיפי תנועה', hint: 'מזין את שדה "סעיף" בטופס התנועה' },
  { key: 'causes', label: 'עילות התחייבות', hint: 'מזין את שדה "עילה" בטופס ההתחייבות' },
  { key: 'domains', label: 'תחומי משימות', hint: 'מזין את שדה "תחום" בטופס המשימה' }
];

// ── עוזרי רשת ──
// בלי תקרת זמן sb.from אינו מוגבל — ברשת חצי מחוברת ה-fetch לא מצליח ולא נכשל, והמשתמש ממתין לנצח.
var MSG_BAD_LOGIN = '❌ שם משתמש או סיסמה שגויים';

// משתמש מושבת מקבל הודעה משלו — עם «סיסמה שגויה» הוא מקליד שוב ושוב סיסמה נכונה.
var MSG_USER_INACTIVE = '❌ המשתמש מושבת. פנו לבעלים.';

// ── הודעות פר-אפליקציה ──
var MSG_MAYBE_STALE = ') — המוצג עלול להיות לא מעודכן';

var MSG_OWNER_ONLY = '⚠️ אין הרשאה — מסך ההגדרות פתוח לבעלים בלבד';

var MSG_NEED_DONOR_NAME = '⚠️ נא למלא שם תורם';

var MSG_DONOR_CREATED = 'התורם נוצר';
var DONOR_NEW_LABEL = '＋ צור תורם חדש';
var DONOR_NO_PHONE = 'ללא טלפון';

var MSG_EDIT_TXN = 'עריכת תנועה';

var MSG_NEW_TXN = '💰 תנועה חדשה';

var MSG_PICK_DONOR = '⚠️ נא לבחור תורם';

var MSG_AMOUNT_POSITIVE = '⚠️ נא להזין סכום גדול מאפס';

var MSG_EDIT_PLEDGE = 'עריכת התחייבות';

var MSG_NEW_PLEDGE = '🤝 התחייבות חדשה';

var MSG_EDIT_TASK = 'עריכת משימה';

var MSG_NEW_TASK = '📋 משימה חדשה';

var MSG_NEED_TITLE = '⚠️ נא למלא כותרת';

var MSG_EDIT_DONOR = 'עריכת תורם';

var MSG_NEW_DONOR = '🙋 תורם חדש';

var MSG_NEED_NAME = '⚠️ נא למלא שם';

var MSG_EDIT_USER = 'עריכת משתמש';

var MSG_NEW_USER = '👤 משתמש חדש';

var MSG_NEED_FULL_AND_USER = '⚠️ נא למלא שם מלא ושם משתמש';

var MSG_NEED_PASS = '⚠️ נא להזין סיסמה';

var MSG_SAVED_NO_FP = '⚠️ נשמר — אך ללא הכנה לכניסה ללא רשת';

var MSG_PASS_CHANGE_FOR = 'שינוי סיסמה — ';

var MSG_NO_OTHER_USER_LOCAL = '⚠️ אין משתמש אחר בעותק המקומי של המכשיר';

var MSG_SWITCH_USER = '👥 החלפת משתמש';

var MSG_MONTH_GOAL = '🎯 יעד חודשי';

var MSG_PICK_VALID_MONTH = '⚠️ נא לבחור חודש תקין';

var MSG_PICK_USER_AND_PASS = '⚠️ נא לבחור משתמש ולהזין סיסמה';

var MSG_WHAT_TO_ADD = 'מה מוסיפים?';

var MSG_NOTES_SAVED = 'ההערות נשמרו';

var MSG_DEL_DONOR_TITLE = 'מחיקת תורם';

var MSG_DEL_DONOR_LINKED = 'לתורם יש התחייבויות או תנועות. המחיקה היא רכה — הרשומות יישמרו במסד ולא יוצגו.';

var MSG_DEL_QUOTE_PRE = 'למחוק את "';

var MSG_DEL_QUOTE_POST = '"? המחיקה רכה וניתנת לשחזור במסד.';

var MSG_DELETE_ACT = 'מחיקה';

var MSG_DEL_TXN_TITLE = 'מחיקת תנועה';

var MSG_DEL_TXN_BODY = 'למחוק את התנועה? המחיקה רכה.';

var MSG_DEL_PLEDGE_TITLE = 'מחיקת התחייבות';

var MSG_DEL_PLEDGE_BODY = 'למחוק את ההתחייבות? המחיקה רכה.';

var MSG_DEL_TASK_TITLE = 'מחיקת משימה';

var MSG_DEL_TASK_BODY = 'למחוק את המשימה? המחיקה רכה.';

var MSG_NO_SELF_DISABLE = '⚠️ אי אפשר להשבית את המשתמש המחובר';

var MSG_UPDATED = 'עודכן';

var MSG_NEED_VALUE = '⚠️ נא להזין ערך';

var MSG_VALUE_EXISTS2 = '⚠️ הערך כבר קיים';

var MSG_EDIT_VALUE = 'עריכת ערך';

var MSG_REMOVE_VALUE_TITLE = 'הסרת ערך';

var MSG_REMOVE_QUOTE_PRE = 'להסיר את "';

var MSG_REMOVE_QUOTE_POST = '" מהרשימה? רשומות קיימות שמשתמשות בערך יישארו כמות שהן.';

var MSG_REMOVE_ACT = 'הסרה';

// ── עמידות אחסון מקומי ──
var KV_TABLE = 'g_settings';

// ── PUSH_CFG ──
// g_users אינה כאן ולא תידחף — המראה מסירה ממנה את הסיסמה, ודחיפה שלה הייתה כותבת סיסמאות ריקות; מסלולה writeUser.
// הסדר שומר על המפתח הזר — תורמים לפני התחייבויות ותנועות.
var PUSH_TABLES = ['g_donors', 'g_pledges', 'g_txns', 'g_tasks', 'g_targets', KV_TABLE];

// ── מזהה מכשיר ──

// אין מרווח פולינג משלו — המרווח היחיד הוא PL_CFG.every.

// strip — עמודות שאינן נשמרות במראה: password נשלפת, ו-pass_salt ו-pass_fp לעולם לא — הן מה שמאפשר כניסה בלי רשת.
var TABLES = [
  { t: 'g_donors',  key: 'client_id', soft: true,  order: 'name' },
  { t: 'g_pledges', key: 'client_id', soft: true,  order: 'due_date' },
  { t: 'g_txns',    key: 'client_id', soft: true,  order: 'txn_date', desc: true },
  { t: 'g_tasks',   key: 'client_id', soft: true,  order: 'due_date' },
  { t: 'g_targets', key: 'client_id', soft: true,  order: 'target_month', desc: true },
  { t: 'g_users',   key: 'client_id', soft: false, order: 'created_at', strip: ['password'] },
  { t: KV_TABLE,    key: 'key', soft: false }
];

var EPS = 0.005;

// נאכפת ביצירה ובשינוי בלבד — אכיפה במסלול הכניסה נועלת בחוץ סיסמה תקפה שנקבעה לפני התקן
var PASS_SIX_RE = /^[0-9]{6}$/;

export { CONFIG_KEYS, DEFAULT_CONFIG, DONOR_NEW_LABEL, DONOR_NO_PHONE, EPS, KV_TABLE, MSG_AMOUNT_POSITIVE, MSG_BAD_LOGIN,
         MSG_DELETE_ACT, MSG_DEL_DONOR_LINKED, MSG_DEL_DONOR_TITLE, MSG_DEL_PLEDGE_BODY,
         MSG_DEL_PLEDGE_TITLE, MSG_DEL_QUOTE_POST, MSG_DEL_QUOTE_PRE, MSG_DEL_TASK_BODY,
         MSG_DEL_TASK_TITLE, MSG_DEL_TXN_BODY, MSG_DEL_TXN_TITLE, MSG_DONOR_CREATED,
         MSG_EDIT_DONOR, MSG_EDIT_PLEDGE, MSG_EDIT_TASK, MSG_EDIT_TXN, MSG_EDIT_USER,
         MSG_EDIT_VALUE, MSG_MAYBE_STALE, MSG_MONTH_GOAL, MSG_NEED_DONOR_NAME,
         MSG_NEED_FULL_AND_USER, MSG_NEED_NAME, MSG_NEED_PASS, MSG_NEED_TITLE,
         MSG_NEED_VALUE, MSG_NEW_DONOR, MSG_NEW_PLEDGE, MSG_NEW_TASK, MSG_NEW_TXN,
         MSG_NEW_USER, MSG_NOTES_SAVED, MSG_NO_OTHER_USER_LOCAL, MSG_NO_SELF_DISABLE,
         MSG_OWNER_ONLY, MSG_PASS_CHANGE_FOR, MSG_PICK_DONOR, MSG_PICK_USER_AND_PASS,
         MSG_PICK_VALID_MONTH, MSG_REMOVE_ACT, MSG_REMOVE_QUOTE_POST,
         MSG_REMOVE_QUOTE_PRE, MSG_REMOVE_VALUE_TITLE, MSG_SAVED_NO_FP, MSG_SWITCH_USER,
         MSG_UPDATED, MSG_USER_INACTIVE, MSG_VALUE_EXISTS2, MSG_WHAT_TO_ADD, PASS_SIX_RE,
         PUSH_TABLES, SUPABASE_ANON_KEY, SUPABASE_URL, TABLES };
