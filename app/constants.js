// app/constants.js — הנתונים: שמות הטבלאות, המחרוזות והקבועים
import { appConfigure } from '../core/util.js';

// ── מסירת התצורה ──
// כאן הנתונים שהליבה קוראת, והחיווט — ב-main.js; הקובץ הזה נטען ראשון, לפני כל קריאה לליבה.
// העידן עולה בשינוי צורת רשומה או מפתחה, ושינוי שם טבלה הוא שינוי כזה — המראה ממופתחת בשם.
// עותק בעידן ישן אינו נדחף — הממתין בו נרשם ביומן, והוא נזרק ונמשך מלא.
var DATA_ERA = 5;

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

// ── הודעות פר-אפליקציה ──
var MSG_MAYBE_STALE = ') — המוצג עלול להיות לא מעודכן';

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

var MSG_MONTH_GOAL = '🎯 יעד חודשי';

var MSG_PICK_VALID_MONTH = '⚠️ נא לבחור חודש תקין';

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

var MSG_NEED_VALUE = '⚠️ נא להזין ערך';

var MSG_VALUE_EXISTS2 = '⚠️ הערך כבר קיים';

var MSG_EDIT_VALUE = 'עריכת ערך';

var MSG_REMOVE_VALUE_TITLE = 'הסרת ערך';

var MSG_REMOVE_QUOTE_PRE = 'להסיר את "';

var MSG_REMOVE_QUOTE_POST = '" מהרשימה? רשומות קיימות שמשתמשות בערך יישארו כמות שהן.';

var MSG_REMOVE_ACT = 'הסרה';

// ── רשימת המנהלים — g_lookups ──
var LK_MANAGER = 'manager';

var MSG_MANAGERS = '👤 מנהלים';

var MSG_MANAGER_NEW = '＋ מנהל חדש';

var MSG_MANAGER_LABEL = 'שם המנהל';

var MSG_NEED_MANAGER = '⚠️ נא למלא שם מנהל';

var MSG_MANAGER_DUP = '⚠️ מנהל בשם הזה כבר קיים';

var MSG_DEL_MANAGER_TITLE = 'מחיקת מנהל';

var MSG_DEL_MANAGER_BODY = 'למחוק את המנהל מהרשימה? תנועות שכבר נרשמו על שמו יישארו כמות שהן.';

// ── עמידות אחסון מקומי ──
var KV_TABLE = 'g_settings';

// ── PUSH_CFG ──
// הסדר שומר על המפתח הזר — תורמים לפני התחייבויות ותנועות.
var PUSH_TABLES = ['g_donors', 'g_pledges', 'g_txns', 'g_tasks', 'g_targets', KV_TABLE, 'g_lookups'];

// ── מזהה מכשיר ──

// אין מרווח בדיקה מחזורית משלו — המרווח היחיד הוא PL_CFG.every.

// strip — עמודות שאינן נשמרות במראה; אין היום עמודה כזו, והמנגנון נשאר דרוך לסוד עתידי.
var TABLES = [
  { t: 'g_donors',  key: 'client_id', soft: true,  order: 'name' },
  { t: 'g_pledges', key: 'client_id', soft: true,  order: 'due_date' },
  { t: 'g_txns',    key: 'client_id', soft: true,  order: 'txn_date', desc: true },
  { t: 'g_tasks',   key: 'client_id', soft: true,  order: 'due_date' },
  { t: 'g_targets', key: 'client_id', soft: true,  order: 'target_month', desc: true },
  { t: KV_TABLE,    key: 'key', soft: false },
  { t: 'g_lookups', key: 'client_id', soft: true,  order: 'sort' }
];

var EPS = 0.005;

export { CONFIG_KEYS, DEFAULT_CONFIG, DONOR_NEW_LABEL, DONOR_NO_PHONE, EPS, KV_TABLE, LK_MANAGER,
         MSG_AMOUNT_POSITIVE, MSG_DELETE_ACT, MSG_DEL_DONOR_LINKED, MSG_DEL_DONOR_TITLE,
         MSG_DEL_MANAGER_BODY, MSG_DEL_MANAGER_TITLE, MSG_DEL_PLEDGE_BODY,
         MSG_DEL_PLEDGE_TITLE, MSG_DEL_QUOTE_POST, MSG_DEL_QUOTE_PRE, MSG_DEL_TASK_BODY,
         MSG_DEL_TASK_TITLE, MSG_DEL_TXN_BODY, MSG_DEL_TXN_TITLE, MSG_DONOR_CREATED,
         MSG_EDIT_DONOR, MSG_EDIT_PLEDGE, MSG_EDIT_TASK, MSG_EDIT_TXN,
         MSG_EDIT_VALUE, MSG_MANAGERS, MSG_MANAGER_DUP, MSG_MANAGER_LABEL, MSG_MANAGER_NEW,
         MSG_MAYBE_STALE, MSG_MONTH_GOAL, MSG_NEED_DONOR_NAME, MSG_NEED_MANAGER,
         MSG_NEED_NAME, MSG_NEED_TITLE,
         MSG_NEED_VALUE, MSG_NEW_DONOR, MSG_NEW_PLEDGE, MSG_NEW_TASK, MSG_NEW_TXN,
         MSG_NOTES_SAVED, MSG_PICK_DONOR,
         MSG_PICK_VALID_MONTH, MSG_REMOVE_ACT, MSG_REMOVE_QUOTE_POST,
         MSG_REMOVE_QUOTE_PRE, MSG_REMOVE_VALUE_TITLE,
         MSG_VALUE_EXISTS2, MSG_WHAT_TO_ADD,
         PUSH_TABLES, SUPABASE_ANON_KEY, SUPABASE_URL, TABLES };
