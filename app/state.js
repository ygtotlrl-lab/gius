// app/state.js — המצב המשותף בין המודולים
import { dayToday } from '../core/util.js';
import { sessGet, sessSet } from '../core/auth.js';
import { monthKeyOf } from './domain.js';

// מצב שמודולים שונים כותבים — אובייקט אחד, כי קישור מיובא אינו ניתן להשמה.
export const S = {
  sb: null,
  // ההקשר נלכד לפני ההמתנה — mark רץ אחרי await, וקריאת הגלובלי הייתה זוקפת את ההצלחה למשתמש אחר.
  _gPushEp: 0,
  // משווה אחד ברמת המודול — localeCompare בונה משווה חדש בכל קריאה, ובתוך sort זה קורה O(n log n) פעמים.
  // בלי Intl.Collator — נפילה-חזרה ל-localeCompare עם אותו he ואותו סדר.
  _heColl: null,
  _pulling: false,
  _netWarned: false,
  _lastPullOk: 0,
  // _gSeenTs ו-_lastSeenOk מתקדמות גם במשיכה — אין להזין מהן את עד הפינוי; העד הוא _gPushedAt פר-טבלה.
  _gSeenTs: 0,
  _lastSeenOk: 0,
  _gPullLogged: false,
  lastViewKey: ''
};

// ── מצב האפליקציה ──
// state הוא תצוגה ולא מקור אמת — applyMirrorToState היא הדרך היחידה למלא אותו.
// אין לכתוב ישירות ל-state.donors — כתיבה כזו אינה מגיעה לדיסק ואינה נדחפת, ונעלמת בסנכרון הבא.
var state = {
  // state.user הוא חלון למודול הסשן — שדה רגיל היה מסלול שדרכו הסשן יורד לדיסק.
  get user() { return sessGet(); },
  set user(v) { sessSet(v); },
  screen: 'home',
  month: monthKeyOf(dayToday()),
  config: { categories: [], causes: [], domains: [] },
  donors: [], pledges: [], txns: [], tasks: [], targets: [], users: [],
  donorId: null,
  donorSearch: '',
  pf: { agent: '', status: '', cause: '', from: '', to: '' }
};

// גרירה על אירועי מצביע — dragstart, dragover ו-drop אינם נורים במגע.
// הגרירה מתחילה מהידית בלבד — כרטיס שכולו נגרר חוטף את גלילת המסך.
// הגרירה היא העברת שלב ולא שינוי סדר — הנמדד הוא העמודה שמתחת לשחרור.
var KDRAG = { el: null, col: null };

export { KDRAG, state };
